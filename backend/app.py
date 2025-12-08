from flask import Flask, request, jsonify, send_file, Response, stream_with_context
from flask_cors import CORS
import os
import sys
from werkzeug.utils import secure_filename
import tempfile
import shutil
import traceback
import json

# Import all the processing functions
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from converters import (
    convert_docx_to_s1000d,
    convert_pdf_to_docx,
    split_docx_by_heading,
    split_docx_by_heading_v2,
    rename_files_batch,
    extract_icn_from_docx,
    generate_icn_labels,
    validate_adoc_images,
    generate_rename_preview_from_excel,
    execute_rename_from_excel,
    convert_adoc_to_s1000d
)

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = tempfile.gettempdir()
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

# Load feature flags
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')

def load_config():
    try:
        with open(CONFIG_PATH, 'r') as f:
            return json.load(f)
    except:
        return {
            "features": {
                "docx_to_adoc": True,
                "pdf_to_docx": True,
                "doc_splitter": True,
                "file_renamer": True,
                "excel_renamer": True,
                "icn_extractor": True,
                "icn_maker": True,
                "icn_validator": True,
                "adoc_to_s1000d": True
            },
            "admin": {"enabled": True, "password": "admin123"}
        }

def save_config(config):
    with open(CONFIG_PATH, 'w') as f:
        json.dump(config, f, indent=2)

def check_feature(feature_name):
    config = load_config()
    if not config['features'].get(feature_name, False):
        return jsonify({'error': f'This feature is currently disabled'}), 403
    return None

# Helper function to clean up temporary files
def cleanup_temp_files(*paths):
    for path in paths:
        try:
            if os.path.isfile(path):
                os.remove(path)
            elif os.path.isdir(path):
                shutil.rmtree(path)
        except Exception as e:
            print(f"Error cleaning up {path}: {e}")

# Route 1: DOCX to S1000D AsciiDoc Converter (Batch Support)
@app.route('/api/convert/docx-to-s1000d', methods=['POST'])
def docx_to_s1000d():
    feature_check = check_feature('docx_to_adoc')
    if feature_check:
        return feature_check
    
    temp_dirs = []
    zip_path = None
    try:
        files = request.files.getlist('files')
        if not files or len(files) == 0:
            # Fallback to single file upload
            if 'file' not in request.files:
                return jsonify({'error': 'No files provided'}), 400
            files = [request.files['file']]
        
        if len(files) == 1 and files[0].filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get document type from form data
        # 'proced' for procedural, 'descript' for descriptive, 'auto' for auto-detect
        doc_type = request.form.get('doc_type', 'auto')
        if doc_type == 'auto':
            doc_type = None  # None triggers auto-detection in converter
        
        # Create temp directories with unique names to avoid conflicts
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        input_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'docx_input_{unique_id}')
        output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'docx_output_{unique_id}')
        os.makedirs(input_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)
        temp_dirs.extend([input_dir, output_dir])
        
        # Process files
        for file in files:
            if file.filename:
                filename = secure_filename(file.filename)
                input_path = os.path.join(input_dir, filename)
                file.save(input_path)
                
                output_path = os.path.join(output_dir, filename.replace('.docx', '.adoc'))
                success, message = convert_docx_to_s1000d(input_path, output_path, doc_type)
                
                if not success:
                    error_details = {
                        'error': f'Failed to convert {filename}: {message}',
                        'file': filename,
                        'details': message,
                        'type': 'conversion_error'
                    }
                    print(f"[ERROR] Conversion failed for {filename}: {message}", file=sys.stderr)
                    return jsonify(error_details), 500
        
        # Verify output files were created
        output_files = os.listdir(output_dir)
        if not output_files:
            return jsonify({'error': 'No files were converted'}), 500
        
        # Return single file or ZIP
        if len(files) == 1:
            output_path = os.path.join(output_dir, output_files[0])
            return send_file(output_path, as_attachment=True, download_name=output_files[0])
        else:
            zip_path = output_dir + '.zip'
            shutil.make_archive(output_dir, 'zip', output_dir)
            return send_file(zip_path, as_attachment=True, download_name='converted_files.zip')
            
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500
    finally:
        for temp_dir in temp_dirs:
            cleanup_temp_files(temp_dir)
        if zip_path:
            cleanup_temp_files(zip_path)


# SSE endpoint for DOCX to ADOC with real-time progress
@app.route('/api/convert/docx-to-s1000d/stream', methods=['POST'])
def docx_to_s1000d_stream():
    """Stream DOCX to ADOC conversion progress"""
    feature_check = check_feature('docx_to_adoc')
    if feature_check:
        return feature_check
    
    files = request.files.getlist('files')
    if not files or len(files) == 0:
        if 'file' not in request.files:
            return jsonify({'error': 'No files provided'}), 400
        files = [request.files['file']]
    
    if len(files) == 1 and files[0].filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    doc_type = request.form.get('doc_type', 'auto')
    if doc_type == 'auto':
        doc_type = None
    
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    input_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'docx_input_{unique_id}')
    output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'docx_output_{unique_id}')
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    
    saved_files = []
    for file in files:
        if file.filename:
            filename = secure_filename(file.filename)
            input_path = os.path.join(input_dir, filename)
            file.save(input_path)
            saved_files.append(filename)
    
    def generate():
        import json as json_module
        from concurrent.futures import ThreadPoolExecutor
        from queue import Queue
        
        total_files = len(saved_files)
        result_queue = Queue()
        
        yield f"data: {json_module.dumps({'type': 'start', 'total': total_files})}\n\n"
        
        def convert_file(filename, idx):
            input_path = os.path.join(input_dir, filename)
            output_path = os.path.join(output_dir, filename.replace('.docx', '.adoc'))
            success, message = convert_docx_to_s1000d(input_path, output_path, doc_type)
            result_queue.put((filename, success, message, idx))
        
        max_workers = min(4, total_files)
        executor = ThreadPoolExecutor(max_workers=max_workers)
        
        for idx, filename in enumerate(saved_files):
            executor.submit(convert_file, filename, idx)
        
        converted_count = 0
        failed_count = 0
        completed = 0
        
        while completed < total_files:
            try:
                filename, success, message, idx = result_queue.get(timeout=300)
                completed += 1
                
                if success:
                    converted_count += 1
                    yield f"data: {json_module.dumps({'type': 'progress', 'current': completed, 'total': total_files, 'filename': filename, 'status': 'completed'})}\n\n"
                else:
                    failed_count += 1
                    yield f"data: {json_module.dumps({'type': 'progress', 'current': completed, 'total': total_files, 'filename': filename, 'status': 'failed', 'error': str(message)[:200]})}\n\n"
            except Exception as e:
                break
        
        executor.shutdown(wait=True)
        
        if converted_count > 0:
            output_files = os.listdir(output_dir)
            if len(output_files) > 1:
                shutil.make_archive(output_dir, 'zip', output_dir)
            
            yield f"data: {json_module.dumps({'type': 'complete', 'converted': converted_count, 'failed': failed_count, 'total': total_files, 'download_id': unique_id})}\n\n"
        else:
            yield f"data: {json_module.dumps({'type': 'error', 'message': 'No files were converted successfully'})}\n\n"
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )


# Download endpoint for DOCX to ADOC conversions
@app.route('/api/convert/docx-to-s1000d/download/<download_id>', methods=['GET'])
def download_converted_docx(download_id):
    output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'docx_output_{download_id}')
    zip_path = output_dir + '.zip'
    
    if os.path.exists(zip_path):
        return send_file(zip_path, as_attachment=True, download_name='converted_files.zip')
    elif os.path.exists(output_dir):
        output_files = os.listdir(output_dir)
        if output_files:
            return send_file(os.path.join(output_dir, output_files[0]), as_attachment=True, download_name=output_files[0])
    
    return jsonify({'error': 'Download not found or expired'}), 404


# Route 2: PDF to DOCX Converter (Batch Support)
@app.route('/api/convert/pdf-to-docx', methods=['POST'])
def pdf_to_docx():
    feature_check = check_feature('pdf_to_docx')
    if feature_check:
        return feature_check
    
    temp_dirs = []
    zip_path = None
    try:
        files = request.files.getlist('files')
        if not files or len(files) == 0:
            # Fallback to single file upload
            if 'file' not in request.files:
                return jsonify({'error': 'No files provided'}), 400
            files = [request.files['file']]
        
        if len(files) == 1 and files[0].filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Create temp directories with unique names to avoid conflicts
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        input_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'pdf_input_{unique_id}')
        output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'pdf_output_{unique_id}')
        os.makedirs(input_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)
        temp_dirs.extend([input_dir, output_dir])
        
        # Process files
        for file in files:
            if file.filename:
                filename = secure_filename(file.filename)
                input_path = os.path.join(input_dir, filename)
                file.save(input_path)
                
                output_path = os.path.join(output_dir, filename.replace('.pdf', '.docx'))
                success, message = convert_pdf_to_docx(input_path, output_path)
                
                if not success:
                    return jsonify({'error': f'Failed to convert {filename}: {message}'}), 500
        
        # Verify output files were created
        output_files = os.listdir(output_dir)
        if not output_files:
            return jsonify({'error': 'No files were converted'}), 500
        
        # Return single file or ZIP
        if len(files) == 1:
            output_path = os.path.join(output_dir, output_files[0])
            return send_file(output_path, as_attachment=True, download_name=output_files[0])
        else:
            zip_path = output_dir + '.zip'
            shutil.make_archive(output_dir, 'zip', output_dir)
            return send_file(zip_path, as_attachment=True, download_name='converted_pdfs.zip')
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        for temp_dir in temp_dirs:
            cleanup_temp_files(temp_dir)
        if zip_path:
            cleanup_temp_files(zip_path)


# SSE endpoint for PDF to DOCX with real-time progress
@app.route('/api/convert/pdf-to-docx/stream', methods=['POST'])
def pdf_to_docx_stream():
    """Stream PDF to DOCX conversion progress"""
    feature_check = check_feature('pdf_to_docx')
    if feature_check:
        return feature_check
    
    files = request.files.getlist('files')
    if not files or len(files) == 0:
        if 'file' not in request.files:
            return jsonify({'error': 'No files provided'}), 400
        files = [request.files['file']]
    
    if len(files) == 1 and files[0].filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    input_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'pdf_input_{unique_id}')
    output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'pdf_output_{unique_id}')
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    
    # Save all files
    saved_files = []
    for file in files:
        if file.filename:
            filename = secure_filename(file.filename)
            input_path = os.path.join(input_dir, filename)
            file.save(input_path)
            saved_files.append(filename)
    
    def generate():
        import json as json_module
        from concurrent.futures import ThreadPoolExecutor
        from queue import Queue
        
        total_files = len(saved_files)
        result_queue = Queue()
        
        yield f"data: {json_module.dumps({'type': 'start', 'total': total_files})}\n\n"
        
        def convert_file(filename, idx):
            input_path = os.path.join(input_dir, filename)
            output_path = os.path.join(output_dir, filename.replace('.pdf', '.docx'))
            success, message = convert_pdf_to_docx(input_path, output_path)
            result_queue.put((filename, success, message, idx))
        
        max_workers = min(2, total_files)  # PDF conversion is heavy, limit to 2
        executor = ThreadPoolExecutor(max_workers=max_workers)
        
        for idx, filename in enumerate(saved_files):
            executor.submit(convert_file, filename, idx)
        
        converted_count = 0
        failed_count = 0
        completed = 0
        
        while completed < total_files:
            try:
                filename, success, message, idx = result_queue.get(timeout=600)
                completed += 1
                
                if success:
                    converted_count += 1
                    yield f"data: {json_module.dumps({'type': 'progress', 'current': completed, 'total': total_files, 'filename': filename, 'status': 'completed'})}\n\n"
                else:
                    failed_count += 1
                    yield f"data: {json_module.dumps({'type': 'progress', 'current': completed, 'total': total_files, 'filename': filename, 'status': 'failed', 'error': str(message)[:200]})}\n\n"
            except Exception as e:
                break
        
        executor.shutdown(wait=True)
        
        if converted_count > 0:
            output_files = os.listdir(output_dir)
            if len(output_files) > 1:
                shutil.make_archive(output_dir, 'zip', output_dir)
            
            yield f"data: {json_module.dumps({'type': 'complete', 'converted': converted_count, 'failed': failed_count, 'total': total_files, 'download_id': unique_id})}\n\n"
        else:
            yield f"data: {json_module.dumps({'type': 'error', 'message': 'No files were converted successfully'})}\n\n"
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )


# Download endpoint for PDF conversions
@app.route('/api/convert/pdf-to-docx/download/<download_id>', methods=['GET'])
def download_converted_pdf(download_id):
    output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'pdf_output_{download_id}')
    zip_path = output_dir + '.zip'
    
    if os.path.exists(zip_path):
        return send_file(zip_path, as_attachment=True, download_name='converted_pdfs.zip')
    elif os.path.exists(output_dir):
        output_files = os.listdir(output_dir)
        if output_files:
            return send_file(os.path.join(output_dir, output_files[0]), as_attachment=True, download_name=output_files[0])
    
    return jsonify({'error': 'Download not found or expired'}), 404


# Route 3: DOCX Splitter
@app.route('/api/split-docx', methods=['POST'])
def split_docx():
    feature_check = check_feature('doc_splitter')
    if feature_check:
        return feature_check
    
    temp_dirs = []
    zip_path = None
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        heading_style = request.form.get('heading_style', 'Heading 1')
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Create unique directories for this request
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        filename = secure_filename(file.filename)
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], f'split_input_{unique_id}_{filename}')
        file.save(input_path)
        temp_dirs.append(input_path)
        
        output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'split_output_{unique_id}')
        os.makedirs(output_dir, exist_ok=True)
        temp_dirs.append(output_dir)
        
        count = split_docx_by_heading(input_path, output_dir, heading_style)
        
        # Create a ZIP file of the output directory
        zip_path = output_dir + '.zip'
        shutil.make_archive(output_dir, 'zip', output_dir)
        
        return send_file(zip_path, as_attachment=True, download_name=f'{os.path.splitext(filename)[0]}_split.zip')
    except Exception as e:
        error_trace = traceback.format_exc()
        error_details = {
            'error': 'Document splitting failed',
            'message': str(e),
            'traceback': error_trace,
            'type': 'split_error'
        }
        print(f"[ERROR] Split failed for {file.filename if 'file' in locals() else 'unknown'}:\\n{error_trace}", file=sys.stderr)
        return jsonify(error_details), 500
    finally:
        for temp_dir in temp_dirs:
            cleanup_temp_files(temp_dir)
        if zip_path:
            cleanup_temp_files(zip_path)

# Route 3b: Document Splitter V2 (Enhanced)
@app.route('/api/split-docx-v2', methods=['POST'])
def split_docx_v2():
    feature_check = check_feature('doc_splitter_v2')
    if feature_check:
        return feature_check
    
    temp_dirs = []
    zip_path = None
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        heading_style = request.form.get('heading_style', 'Heading 1')
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Create unique directories for this request
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        filename = secure_filename(file.filename)
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], f'split_v2_input_{unique_id}_{filename}')
        file.save(input_path)
        temp_dirs.append(input_path)
        
        output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'split_v2_output_{unique_id}')
        os.makedirs(output_dir, exist_ok=True)
        temp_dirs.append(output_dir)
        
        count = split_docx_by_heading_v2(input_path, output_dir, heading_style)
        
        # Create a ZIP file of the output directory
        zip_path = output_dir + '.zip'
        shutil.make_archive(output_dir, 'zip', output_dir)
        
        return send_file(zip_path, as_attachment=True, download_name=f'{os.path.splitext(filename)[0]}_split_v2.zip')
    except Exception as e:
        error_trace = traceback.format_exc()
        error_details = {
            'error': 'Document splitting failed (V2)',
            'message': str(e),
            'traceback': error_trace,
            'type': 'split_v2_error'
        }
        print(f"[ERROR] Split V2 failed for {file.filename if 'file' in locals() else 'unknown'}:\\n{error_trace}", file=sys.stderr)
        return jsonify(error_details), 500
    finally:
        for temp_dir in temp_dirs:
            cleanup_temp_files(temp_dir)
        if zip_path:
            cleanup_temp_files(zip_path)

# Route 4: File Renamer
@app.route('/api/rename-files', methods=['POST'])
def rename_files():
    feature_check = check_feature('file_renamer')
    if feature_check:
        return feature_check
    
    temp_dir = None
    zip_path = None
    try:
        files = request.files.getlist('files')
        old_text = request.form.get('old_text', '')
        new_text = request.form.get('new_text', '')
        
        if not files or not old_text:
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Create unique directory for this request
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'rename_temp_{unique_id}')
        os.makedirs(temp_dir, exist_ok=True)
        
        # Save uploaded files
        for file in files:
            filename = secure_filename(file.filename)
            file.save(os.path.join(temp_dir, filename))
        
        # Rename files
        count = rename_files_batch(temp_dir, old_text, new_text)
        
        # Create a ZIP file
        zip_path = temp_dir + '.zip'
        shutil.make_archive(temp_dir, 'zip', temp_dir)
        
        return send_file(zip_path, as_attachment=True, download_name='renamed_files.zip')
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if temp_dir:
            cleanup_temp_files(temp_dir)
        if zip_path:
            cleanup_temp_files(zip_path)

# Route 4b: Excel Rename Preview
@app.route('/api/rename-preview', methods=['POST'])
def rename_preview():
    feature_check = check_feature('excel_renamer')
    if feature_check:
        return feature_check
    
    try:
        if 'excel_file' not in request.files:
            return jsonify({'error': 'No Excel file provided'}), 400
        
        excel_file = request.files['excel_file']
        files = request.files.getlist('docx_files')
        
        if not files:
            return jsonify({'error': 'No DOCX files provided'}), 400
        
        # Create unique temp directories for this request
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'excel_rename_temp_{unique_id}')
        docx_dir = os.path.join(temp_dir, 'docx_files')
        os.makedirs(docx_dir, exist_ok=True)
        
        # Save Excel file
        excel_filename = secure_filename(excel_file.filename)
        excel_path = os.path.join(temp_dir, excel_filename)
        excel_file.save(excel_path)
        
        # Save DOCX files
        for file in files:
            filename = secure_filename(file.filename)
            file.save(os.path.join(docx_dir, filename))
        
        # Generate preview
        result = generate_rename_preview_from_excel(excel_path, docx_dir)
        
        # Check if error returned
        if isinstance(result, dict) and 'error' in result:
            return jsonify(result), 400
        
        return jsonify({
            'preview': result['preview'],
            'excel_data': result['excel_data'],
            'temp_dir': temp_dir
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Route 4c: Excel Rename Execute
@app.route('/api/rename-execute', methods=['POST'])
def rename_execute():
    feature_check = check_feature('excel_renamer')
    if feature_check:
        return feature_check
    
    zip_path = None
    try:
        data = request.get_json()
        temp_dir = data.get('temp_dir')
        preview_data = data.get('preview_data')
        
        if not temp_dir or not preview_data:
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Find the Excel file and docx folder
        excel_path = None
        docx_dir = os.path.join(temp_dir, 'docx_files')
        
        for file in os.listdir(temp_dir):
            if file.endswith(('.xlsx', '.xls')):
                excel_path = os.path.join(temp_dir, file)
                break
        
        if not excel_path:
            return jsonify({'error': 'Excel file not found'}), 400
        
        # Execute rename
        results = execute_rename_from_excel(excel_path, docx_dir, preview_data)
        
        # Create a ZIP file of renamed files
        zip_path = docx_dir + '.zip'
        shutil.make_archive(docx_dir, 'zip', docx_dir)
        
        return send_file(zip_path, as_attachment=True, download_name='renamed_files.zip')
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if 'temp_dir' in locals():
            cleanup_temp_files(temp_dir)
        if zip_path:
            cleanup_temp_files(zip_path)

# Route 5: ICN Extractor
@app.route('/api/extract-icn', methods=['POST'])
def extract_icn():
    feature_check = check_feature('icn_extractor')
    if feature_check:
        return feature_check
    
    temp_dir = None
    output_dir = None
    zip_path = None
    try:
        files = request.files.getlist('files')
        
        if not files:
            return jsonify({'error': 'No files provided'}), 400
        
        # Create unique directories for this request
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'icn_extract_{unique_id}')
        os.makedirs(temp_dir, exist_ok=True)
        
        output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'icn_output_{unique_id}')
        os.makedirs(output_dir, exist_ok=True)
        
        # Save uploaded files
        for file in files:
            filename = secure_filename(file.filename)
            file.save(os.path.join(temp_dir, filename))
        
        # Extract ICNs
        extract_icn_from_docx(temp_dir, output_dir)
        
        # Create a ZIP file
        zip_path = output_dir + '.zip'
        shutil.make_archive(output_dir, 'zip', output_dir)
        
        return send_file(zip_path, as_attachment=True, download_name='extracted_icn.zip')
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if temp_dir:
            cleanup_temp_files(temp_dir)
        if output_dir:
            cleanup_temp_files(output_dir)
        if zip_path:
            cleanup_temp_files(zip_path)

# Route 6: ICN Maker
@app.route('/api/generate-icn', methods=['POST'])
def generate_icn():
    feature_check = check_feature('icn_maker')
    if feature_check:
        return feature_check
    
    temp_dir = None
    output_dir = None
    zip_path = None
    try:
        files = request.files.getlist('files')
        params = {
            'kpc': request.form.get('kpc', '1'),
            'xyz': request.form.get('xyz', '1671Y'),
            'sq_start': request.form.get('sq_start', '00005'),
            'icv': request.form.get('icv', 'A'),
            'issue': request.form.get('issue', '001'),
            'sec': request.form.get('sec', '01')
        }
        
        if not files:
            return jsonify({'error': 'No files provided'}), 400
        
        # Create unique directories for this request
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'icn_generate_{unique_id}')
        os.makedirs(temp_dir, exist_ok=True)
        
        output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'icn_generated_{unique_id}')
        os.makedirs(output_dir, exist_ok=True)
        
        # Save uploaded files
        for file in files:
            filename = secure_filename(file.filename)
            file.save(os.path.join(temp_dir, filename))
        
        # Generate ICNs
        generate_icn_labels(temp_dir, output_dir, params)
        
        # Create a ZIP file
        zip_path = output_dir + '.zip'
        shutil.make_archive(output_dir, 'zip', output_dir)
        
        return send_file(zip_path, as_attachment=True, download_name='generated_icn.zip')
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if temp_dir:
            cleanup_temp_files(temp_dir)
        if output_dir:
            cleanup_temp_files(output_dir)
        if zip_path:
            cleanup_temp_files(zip_path)

# Route 7: ICN Validator
@app.route('/api/validate-icn', methods=['POST'])
def validate_icn():
    feature_check = check_feature('icn_validator')
    if feature_check:
        return feature_check
    
    temp_dir = None
    try:
        adoc_files = request.files.getlist('adoc_files')
        image_files = request.files.getlist('image_files')
        
        if not adoc_files:
            return jsonify({'error': 'No ADOC files provided'}), 400
        
        # Create unique directories for this request
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'icn_validate_{unique_id}')
        os.makedirs(temp_dir, exist_ok=True)
        
        adoc_dir = os.path.join(temp_dir, 'adoc')
        images_dir = os.path.join(temp_dir, 'images')
        os.makedirs(adoc_dir, exist_ok=True)
        os.makedirs(images_dir, exist_ok=True)
        
        # Save uploaded files
        for file in adoc_files:
            filename = secure_filename(file.filename)
            file.save(os.path.join(adoc_dir, filename))
        
        for file in image_files:
            filename = secure_filename(file.filename)
            file.save(os.path.join(images_dir, filename))
        
        # Validate ICNs
        results = validate_adoc_images(adoc_dir, images_dir)
        
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if temp_dir:
            cleanup_temp_files(temp_dir)

# Route 8: AsciiDoc to S1000D XML Converter (Batch Support)
@app.route('/api/convert/adoc-to-s1000d', methods=['POST'])
def adoc_to_s1000d():
    feature_check = check_feature('adoc_to_s1000d')
    if feature_check:
        return feature_check
    
    temp_dirs = []
    zip_path = None
    try:
        files = request.files.getlist('files')
        if not files or len(files) == 0:
            # Fallback to single file upload
            if 'file' not in request.files:
                return jsonify({'error': 'No files provided'}), 400
            files = [request.files['file']]
        
        if len(files) == 1 and files[0].filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get conversion type from form data
        conversion_type = request.form.get('conversion_type', 'descript')
        
        # Map conversion type to Ruby backend file
        ruby_backends = {
            'descript': 's1000d1.rb',
            'proced': 'pro.rb',
            'fault': 'fault.rb',
            'ipd': 'ipd.rb'
        }
        
        ruby_file = ruby_backends.get(conversion_type, 's1000d1.rb')
        
        # Create temp directories with unique names to avoid conflicts
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        input_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'adoc_input_{unique_id}')
        output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'adoc_output_{unique_id}')
        os.makedirs(input_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)
        temp_dirs.extend([input_dir, output_dir])
        
        # Path to the Ruby backend file (in the ruby subfolder)
        ruby_backend_path = os.path.join(os.path.dirname(__file__), 'ruby', ruby_file)
        
        # Verify Ruby backend exists
        if not os.path.exists(ruby_backend_path):
            return jsonify({'error': f'Ruby backend file not found: {ruby_file}. Please ensure {ruby_file} is in the backend folder.'}), 500
        
        app.logger.info(f"Using Ruby backend: {ruby_file} for conversion type: {conversion_type}")
        
        # Save all files first and collect filenames
        saved_files = []
        for file in files:
            if file.filename:
                filename = secure_filename(file.filename)
                input_path = os.path.join(input_dir, filename)
                file.save(input_path)
                saved_files.append(filename)
        
        total_files = len(saved_files)
        converted_files = []
        failed_files = []
        
        # Process files one by one
        for idx, filename in enumerate(saved_files):
            input_path = os.path.join(input_dir, filename)
            output_path = os.path.join(output_dir, filename.replace('.adoc', '.xml'))
            
            app.logger.info(f"Converting file {idx + 1}/{total_files}: {filename}")
            success, message = convert_adoc_to_s1000d(input_path, output_path, ruby_backend_path)
            
            if success:
                converted_files.append(filename)
            else:
                failed_files.append({'filename': filename, 'error': message})
        
        # Check if any files were converted
        if not converted_files:
            error_msg = 'No files were converted successfully.'
            if failed_files:
                error_msg += f' Errors: {failed_files[0]["error"]}'
            return jsonify({'error': error_msg}), 500
        
        # Verify output files were created
        output_files = os.listdir(output_dir)
        if not output_files:
            return jsonify({'error': 'No files were converted'}), 500
        
        # Build response with conversion stats
        response_headers = {
            'X-Converted-Count': str(len(converted_files)),
            'X-Total-Count': str(total_files),
            'X-Failed-Count': str(len(failed_files))
        }
        
        # Return single file or ZIP
        if len(output_files) == 1:
            output_path = os.path.join(output_dir, output_files[0])
            response = send_file(output_path, as_attachment=True, download_name=output_files[0])
            for key, value in response_headers.items():
                response.headers[key] = value
            return response
        else:
            zip_path = output_dir + '.zip'
            shutil.make_archive(output_dir, 'zip', output_dir)
            response = send_file(zip_path, as_attachment=True, download_name='converted_s1000d.zip')
            for key, value in response_headers.items():
                response.headers[key] = value
            return response
            
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500
    finally:
        for temp_dir in temp_dirs:
            cleanup_temp_files(temp_dir)
        if zip_path:
            cleanup_temp_files(zip_path)


# SSE endpoint for streaming conversion progress with multi-threading
@app.route('/api/convert/adoc-to-s1000d/stream', methods=['POST'])
def adoc_to_s1000d_stream():
    """Stream conversion progress using Server-Sent Events with parallel processing"""
    feature_check = check_feature('adoc_to_s1000d')
    if feature_check:
        return feature_check
    
    files = request.files.getlist('files')
    if not files or len(files) == 0:
        if 'file' not in request.files:
            return jsonify({'error': 'No files provided'}), 400
        files = [request.files['file']]
    
    if len(files) == 1 and files[0].filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    conversion_type = request.form.get('conversion_type', 'descript')
    
    ruby_backends = {
        'descript': 's1000d1.rb',
        'proced': 'pro.rb',
        'fault': 'fault.rb',
        'ipd': 'ipd.rb'
    }
    
    ruby_file = ruby_backends.get(conversion_type, 's1000d1.rb')
    ruby_backend_path = os.path.join(os.path.dirname(__file__), 'ruby', ruby_file)
    
    if not os.path.exists(ruby_backend_path):
        return jsonify({'error': f'Ruby backend file not found: {ruby_file}'}), 500
    
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    input_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'adoc_input_{unique_id}')
    output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'adoc_output_{unique_id}')
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    
    # Save all files
    saved_files = []
    for file in files:
        if file.filename:
            filename = secure_filename(file.filename)
            input_path = os.path.join(input_dir, filename)
            file.save(input_path)
            saved_files.append(filename)
    
    def generate():
        import json as json_module
        from concurrent.futures import ThreadPoolExecutor, as_completed
        from queue import Queue
        import threading
        
        total_files = len(saved_files)
        result_queue = Queue()
        
        # Send initial status
        yield f"data: {json_module.dumps({'type': 'start', 'total': total_files})}\n\n"
        
        # Define conversion task that puts results in queue
        def convert_file(filename, idx):
            input_path = os.path.join(input_dir, filename)
            output_path = os.path.join(output_dir, filename.replace('.adoc', '.xml'))
            success, message = convert_adoc_to_s1000d(input_path, output_path, ruby_backend_path)
            result_queue.put((filename, success, message, idx))
        
        # Start all conversions in threads
        max_workers = min(4, total_files)
        executor = ThreadPoolExecutor(max_workers=max_workers)
        
        # Submit all tasks
        futures = []
        for idx, filename in enumerate(saved_files):
            future = executor.submit(convert_file, filename, idx)
            futures.append(future)
        
        # Collect results as they complete
        converted_count = 0
        failed_count = 0
        completed = 0
        
        while completed < total_files:
            try:
                # Wait for next result with timeout
                filename, success, message, idx = result_queue.get(timeout=300)
                completed += 1
                
                if success:
                    converted_count += 1
                    event_data = {
                        'type': 'progress',
                        'current': completed,
                        'total': total_files,
                        'filename': filename,
                        'status': 'completed'
                    }
                else:
                    failed_count += 1
                    event_data = {
                        'type': 'progress',
                        'current': completed,
                        'total': total_files,
                        'filename': filename,
                        'status': 'failed',
                        'error': str(message)[:200] if message else 'Unknown error'
                    }
                
                yield f"data: {json_module.dumps(event_data)}\n\n"
                
            except Exception as e:
                app.logger.error(f"Error in conversion stream: {e}")
                break
        
        executor.shutdown(wait=True)
        
        # Create ZIP if multiple files
        if converted_count > 0:
            output_files = os.listdir(output_dir)
            if len(output_files) > 1:
                zip_path = output_dir + '.zip'
                shutil.make_archive(output_dir, 'zip', output_dir)
            
            # Send completion with download info
            yield f"data: {json_module.dumps({'type': 'complete', 'converted': converted_count, 'failed': failed_count, 'total': total_files, 'download_id': unique_id})}\n\n"
        else:
            yield f"data: {json_module.dumps({'type': 'error', 'message': 'No files were converted successfully'})}\n\n"
    
    response = Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*'
        }
    )
    response.headers['Content-Type'] = 'text/event-stream; charset=utf-8'
    return response


# Download endpoint for streamed conversions
@app.route('/api/convert/adoc-to-s1000d/download/<download_id>', methods=['GET'])
def download_converted_adoc(download_id):
    """Download the converted files after streaming conversion"""
    output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'adoc_output_{download_id}')
    zip_path = output_dir + '.zip'
    
    if os.path.exists(zip_path):
        return send_file(zip_path, as_attachment=True, download_name='converted_s1000d.zip')
    elif os.path.exists(output_dir):
        output_files = os.listdir(output_dir)
        if output_files:
            output_path = os.path.join(output_dir, output_files[0])
            return send_file(output_path, as_attachment=True, download_name=output_files[0])
    
    return jsonify({'error': 'Download not found or expired'}), 404


# Route: XML to HTML Converter (S1000D XML to HTML using Saxon XSLT)
@app.route('/api/convert/xml-to-html/stream', methods=['POST'])
def xml_to_html_stream():
    """Convert S1000D XML files to HTML using Saxon XSLT processor with streaming progress"""
    feature_check = check_feature('xml_to_html')
    if feature_check:
        return feature_check
    
    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400
    
    files = request.files.getlist('files')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No files selected'}), 400
    
    import uuid
    import json as json_module
    import subprocess
    import glob
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from queue import Queue
    
    unique_id = str(uuid.uuid4())[:8]
    input_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'xml_input_{unique_id}')
    output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'html_output_{unique_id}')
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    
    # Get Saxon JAR and XSL paths from backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    saxon_jar = os.path.join(backend_dir, 'saxon', 'saxon9he.jar')
    xsl_stylesheet = os.path.join(backend_dir, 'saxon', 'demo3-1.xsl')
    
    # Validate required files exist
    if not os.path.exists(saxon_jar):
        return jsonify({'error': f'Saxon JAR not found. Please place saxon9he.jar in backend/saxon/ folder'}), 500
    if not os.path.exists(xsl_stylesheet):
        return jsonify({'error': f'XSL stylesheet not found. Please place demo3-1.xsl in backend/saxon/ folder'}), 500
    
    # Save uploaded files
    saved_files = []
    for file in files:
        if file and file.filename:
            filename = secure_filename(file.filename)
            if filename.lower().endswith('.xml'):
                filepath = os.path.join(input_dir, filename)
                file.save(filepath)
                saved_files.append((filename, filepath))
    
    if not saved_files:
        return jsonify({'error': 'No valid XML files found'}), 400
    
    total_files = len(saved_files)
    
    def convert_xml_to_html(filename, filepath):
        """Convert a single XML file to HTML using Saxon"""
        try:
            base_name = os.path.splitext(filename)[0]
            html_filename = f"{base_name}.html"
            html_filepath = os.path.join(output_dir, html_filename)
            
            # Build Saxon command
            saxon_args = [
                'java', '-jar', saxon_jar,
                f'-s:{filepath}',
                f'-xsl:{xsl_stylesheet}',
                f'-o:{html_filepath}',
                'outputFormat=html',
                'graphicPathPrefix=figures/'
            ]
            
            # Run Saxon transformation
            result = subprocess.run(
                saxon_args,
                check=True,
                capture_output=True,
                text=True,
                timeout=120  # 2 minute timeout per file
            )
            
            if os.path.exists(html_filepath):
                return (True, filename, html_filename)
            else:
                return (False, filename, 'Output file not created')
                
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr if e.stderr else str(e)
            return (False, filename, f'Saxon error: {error_msg[:200]}')
        except subprocess.TimeoutExpired:
            return (False, filename, 'Transformation timed out')
        except FileNotFoundError:
            return (False, filename, 'Java not found. Please install Java and add to PATH')
        except Exception as e:
            return (False, filename, str(e)[:200])
    
    def generate():
        # Start event
        yield f"data: {json_module.dumps({'type': 'start', 'total': total_files})}\n\n"
        
        converted_count = 0
        failed_count = 0
        results_queue = Queue()
        
        # Use ThreadPoolExecutor for parallel processing
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {executor.submit(convert_xml_to_html, fname, fpath): fname 
                      for fname, fpath in saved_files}
            
            completed = 0
            for future in as_completed(futures):
                completed += 1
                try:
                    success, filename, message = future.result()
                    
                    if success:
                        converted_count += 1
                        event_data = {
                            'type': 'progress',
                            'current': completed,
                            'total': total_files,
                            'filename': filename,
                            'output': message,
                            'status': 'completed'
                        }
                    else:
                        failed_count += 1
                        event_data = {
                            'type': 'progress',
                            'current': completed,
                            'total': total_files,
                            'filename': filename,
                            'status': 'failed',
                            'error': str(message)
                        }
                    
                    yield f"data: {json_module.dumps(event_data)}\n\n"
                    
                except Exception as e:
                    app.logger.error(f"Error in XML to HTML conversion: {e}")
                    failed_count += 1
                    yield f"data: {json_module.dumps({'type': 'progress', 'current': completed, 'total': total_files, 'filename': futures[future], 'status': 'failed', 'error': str(e)[:200]})}\n\n"
        
        # Create ZIP if multiple files
        if converted_count > 0:
            output_files = os.listdir(output_dir)
            if len(output_files) > 1:
                shutil.make_archive(output_dir, 'zip', output_dir)
            
            yield f"data: {json_module.dumps({'type': 'complete', 'converted': converted_count, 'failed': failed_count, 'total': total_files, 'download_id': unique_id})}\n\n"
        else:
            yield f"data: {json_module.dumps({'type': 'error', 'message': 'No files were converted successfully'})}\n\n"
        
        # Cleanup input directory
        try:
            shutil.rmtree(input_dir)
        except:
            pass
    
    response = Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*'
        }
    )
    response.headers['Content-Type'] = 'text/event-stream; charset=utf-8'
    return response


@app.route('/api/convert/xml-to-html/download/<download_id>', methods=['GET'])
def download_converted_html(download_id):
    """Download the converted HTML files after streaming conversion"""
    output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'html_output_{download_id}')
    zip_path = output_dir + '.zip'
    
    if os.path.exists(zip_path):
        return send_file(zip_path, as_attachment=True, download_name='converted_html.zip')
    elif os.path.exists(output_dir):
        output_files = os.listdir(output_dir)
        if output_files:
            output_path = os.path.join(output_dir, output_files[0])
            return send_file(output_path, as_attachment=True, download_name=output_files[0])
    
    return jsonify({'error': 'Download not found or expired'}), 404


# Admin Routes
@app.route('/api/admin/features', methods=['GET'])
def get_features():
    config = load_config()
    return jsonify(config['features'])

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    password = data.get('password')
    config = load_config()
    
    if config['admin']['enabled'] and password == config['admin']['password']:
        return jsonify({'success': True, 'message': 'Login successful'})
    return jsonify({'success': False, 'message': 'Invalid password'}), 401

@app.route('/api/admin/features', methods=['POST'])
def update_features():
    data = request.get_json()
    password = data.get('password')
    features = data.get('features')
    
    config = load_config()
    
    if not config['admin']['enabled'] or password != config['admin']['password']:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if features:
        config['features'] = features
        save_config(config)
        return jsonify({'success': True, 'message': 'Features updated'})
    
    return jsonify({'error': 'No features provided'}), 400

@app.route('/api/admin/password', methods=['POST'])
def change_password():
    data = request.get_json()
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    
    config = load_config()
    
    if not config['admin']['enabled'] or old_password != config['admin']['password']:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if new_password:
        config['admin']['password'] = new_password
        save_config(config)
        return jsonify({'success': True, 'message': 'Password changed'})
    
    return jsonify({'error': 'No new password provided'}), 400

# HTML to JSON/JS Data Source Converter
@app.route('/api/convert/html-to-json', methods=['POST'])
def html_to_json():
    feature_check = check_feature('html_to_json')
    if feature_check:
        return feature_check
    
    temp_dir = None
    
    try:
        from bs4 import BeautifulSoup
        
        files = request.files.getlist('files')
        if not files or len(files) == 0:
            return jsonify({'error': 'No files provided'}), 400
        
        # Get output format from form data (js or json)
        output_format = request.form.get('format', 'js')
        
        data_collection = []
        
        for file in files:
            if file.filename == '':
                continue
                
            file_name = secure_filename(file.filename)
            if not file_name.lower().endswith('.html') and not file_name.lower().endswith('.htm'):
                continue
            
            base_name = os.path.splitext(file_name)[0]
            
            # Extract DMC ID (everything before the last underscore)
            last_underscore_index = base_name.rfind('_')
            dmc_id = base_name[:last_underscore_index] if last_underscore_index != -1 else base_name
            
            try:
                html_content = file.read().decode('utf-8', errors='ignore')
                soup = BeautifulSoup(html_content, 'lxml')
                
                # Extract title
                page_title = ''
                title_tag = soup.find('title')
                if title_tag and title_tag.string:
                    page_title = title_tag.string.strip()
                
                # Extract body content
                inner_content = ''
                body_tag = soup.find('body')
                if body_tag:
                    inner_content = ''.join(str(c) for c in body_tag.contents).strip()
                
                data_entry = {
                    'id': dmc_id,
                    'title': page_title,
                    'type': 'data_module',
                    'data': inner_content
                }
                data_collection.append(data_entry)
                
            except Exception as e:
                print(f"Error processing file {file_name}: {e}")
                continue
        
        if not data_collection:
            return jsonify({'error': 'No valid HTML files were processed'}), 400
        
        # Create output file
        temp_dir = tempfile.mkdtemp()
        
        if output_format == 'json':
            output_path = os.path.join(temp_dir, 'dataIndex.json')
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data_collection, f, indent=2)
            download_name = 'dataIndex.json'
        else:
            output_path = os.path.join(temp_dir, 'dataIndex.js')
            with open(output_path, 'w', encoding='utf-8') as f:
                json_string = json.dumps(data_collection, indent=2)
                f.write('const htmlDataSource = ')
                f.write(json_string)
                f.write(';\n\n')
                f.write('module.exports = htmlDataSource;\n')
            download_name = 'dataIndex.js'
        
        response = send_file(output_path, as_attachment=True, download_name=download_name)
        
        # Schedule cleanup
        @response.call_on_close
        def cleanup():
            cleanup_temp_files(temp_dir)
        
        return response
        
    except ImportError:
        return jsonify({'error': 'BeautifulSoup (bs4) is not installed. Please install it with: pip install beautifulsoup4 lxml'}), 500
    except Exception as e:
        if temp_dir:
            cleanup_temp_files(temp_dir)
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# PMC Builder - Generate Publication Module XML
@app.route('/api/generate-pmc', methods=['POST'])
def generate_pmc():
    feature_check = check_feature('pmc_builder')
    if feature_check:
        return feature_check
    
    temp_dir = None
    
    try:
        from xml.etree.ElementTree import Element, SubElement, tostring
        from xml.dom import minidom
        import re
        
        metadata = json.loads(request.form.get('metadata', '{}'))
        structure = json.loads(request.form.get('structure', '[]'))
        is_preview = request.form.get('preview', 'false') == 'true'
        
        # Get uploaded files
        files = request.files.getlist('files')
        file_map = {f.filename: f for f in files}
        
        # Build XML
        ns = {
            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
            'xsi:noNamespaceSchemaLocation': 'http://www.s1000d.org/S1000D_4-2/xml_schema_flat/pm.xsd'
        }
        pm_root = Element('pm', ns)
        
        # identAndStatusSection
        ident_status = SubElement(pm_root, 'identAndStatusSection')
        pm_address = SubElement(ident_status, 'pmAddress')
        pm_ident = SubElement(pm_address, 'pmIdent')
        
        SubElement(pm_ident, 'pmCode',
            modelIdentCode=metadata.get('pmCode_modelIdentCode', 'MODEL'),
            pmIssuer=metadata.get('pmCode_pmIssuer', '00000'),
            pmNumber=metadata.get('pmCode_pmNumber', '00000'),
            pmVolume=metadata.get('pmCode_pmVolume', '00')
        )
        SubElement(pm_ident, 'language',
            countryIsoCode=metadata.get('language_countryIsoCode', 'US'),
            languageIsoCode=metadata.get('language_languageIsoCode', 'en')
        )
        SubElement(pm_ident, 'issueInfo',
            issueNumber=metadata.get('issueInfo_issueNumber', '001'),
            inWork=metadata.get('issueInfo_inWork', '00')
        )
        
        pm_address_items = SubElement(pm_address, 'pmAddressItems')
        SubElement(pm_address_items, 'issueDate',
            year=metadata.get('issueDate_year', '2025'),
            month=metadata.get('issueDate_month', '01'),
            day=metadata.get('issueDate_day', '01')
        )
        SubElement(pm_address_items, 'pmTitle').text = metadata.get('pmTitle', 'Untitled')
        SubElement(pm_address_items, 'shortPmTitle').text = metadata.get('shortPmTitle', 'UNTITLED')
        
        # pmStatus
        pm_status = SubElement(ident_status, 'pmStatus')
        SubElement(pm_status, 'security',
            securityClassification=metadata.get('securityClassification', '01')
        )
        
        rpc = SubElement(pm_status, 'responsiblePartnerCompany',
            enterpriseCode=metadata.get('responsiblePartnerCompany_enterpriseCode', '00000')
        )
        SubElement(rpc, 'enterpriseName').text = metadata.get('responsiblePartnerCompany_enterpriseName', 'ENTERPRISE')
        
        org = SubElement(pm_status, 'originator',
            enterpriseCode=metadata.get('originator_enterpriseCode', '00000')
        )
        SubElement(org, 'enterpriseName').text = metadata.get('originator_enterpriseName', 'ENTERPRISE')
        
        # content section
        content = SubElement(pm_root, 'content')
        
        def parse_dmc_filename(filename):
            """Parse DMC filename to extract components"""
            pattern = re.compile(
                r'DMC-(?P<modelIdentCode>[\w-]+?)'
                r'-(?P<systemDiffCode>\w+?)'
                r'-(?P<systemCode>\w{2})'
                r'-(?P<subSystemCode>\d)'
                r'(?P<subSubSystemCode>\d)'
                r'-(?P<assyCode>\d+)'
                r'-(?P<disassyCode>\d+)'
                r'(?P<disassyCodeVariant>[A-Z])'
                r'-(?P<infoCode>\d+)'
                r'(?P<infoCodeVariant>[A-Z])'
                r'-(?P<itemLocationCode>\w)',
                re.IGNORECASE
            )
            match = pattern.search(filename)
            if match:
                return match.groupdict()
            return None
        
        def build_content(parent_xml, nodes):
            for node in nodes:
                pm_entry = SubElement(parent_xml, 'pmEntry')
                
                if node.get('type') == 'Folder':
                    SubElement(pm_entry, 'pmEntryTitle').text = node.get('name', 'Untitled')
                    if node.get('children'):
                        build_content(pm_entry, node['children'])
                elif node.get('type') == 'DM':
                    dm_filename = node.get('name', '')
                    dmc_data = parse_dmc_filename(dm_filename)
                    
                    if dmc_data:
                        dm_ref = SubElement(pm_entry, 'dmRef')
                        dm_ref_ident = SubElement(dm_ref, 'dmRefIdent')
                        SubElement(dm_ref_ident, 'dmCode', **dmc_data)
                        SubElement(dm_ref_ident, 'issueInfo', issueNumber='001', inWork='00')
                        SubElement(dm_ref_ident, 'language', languageIsoCode='en', countryIsoCode='US')
                        
                        dm_ref_addr = SubElement(dm_ref, 'dmRefAddressItems')
                        dm_title = SubElement(dm_ref_addr, 'dmTitle')
                        SubElement(dm_title, 'techName').text = 'Data Module'
                        SubElement(dm_title, 'infoName').text = dm_filename
        
        build_content(content, structure)
        
        # Format XML
        xml_string = tostring(pm_root, encoding='unicode')
        reparsed = minidom.parseString(xml_string)
        pretty_xml = reparsed.toprettyxml(indent='  ')
        
        # Add DOCTYPE
        doctype = '''<!DOCTYPE pm [
<!ENTITY % ISOEntities PUBLIC "ISO 8879-1986//ENTITIES ISO Character Entities 20030531//EN//XML" "http://www.s1000d.org/S1000D_4-2/ent/ISOEntities">
%ISOEntities;
]>
'''
        final_xml = pretty_xml.replace(
            '<?xml version="1.0" ?>',
            f'<?xml version="1.0" encoding="UTF-8"?>\n{doctype}'
        )
        
        if is_preview:
            return jsonify({'xml': final_xml})
        
        # Save to file
        temp_dir = tempfile.mkdtemp()
        output_filename = f"PMC-{metadata.get('pmCode_modelIdentCode', 'MODEL')}-{metadata.get('pmCode_pmIssuer', '00000')}-{metadata.get('pmCode_pmNumber', '00000')}.xml"
        output_path = os.path.join(temp_dir, output_filename)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(final_xml)
        
        response = send_file(output_path, as_attachment=True, download_name=output_filename)
        
        @response.call_on_close
        def cleanup():
            cleanup_temp_files(temp_dir)
        
        return response
        
    except Exception as e:
        if temp_dir:
            cleanup_temp_files(temp_dir)
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# Route: PM to TOC Converter (Publication Module XML to JavaScript TOC using Saxon XSLT)
@app.route('/api/convert/pm-to-toc', methods=['POST'])
def pm_to_toc():
    """Convert Publication Module XML files to JavaScript TOC using Saxon XSLT processor"""
    feature_check = check_feature('toc_builder')
    if feature_check:
        return feature_check
    
    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400
    
    files = request.files.getlist('files')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No files selected'}), 400
    
    import uuid
    import subprocess
    
    unique_id = str(uuid.uuid4())[:8]
    input_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'pm_input_{unique_id}')
    output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'toc_output_{unique_id}')
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    
    # Get Saxon JAR and XSL paths from backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    saxon_jar = os.path.join(backend_dir, 'saxon', 'saxon9he.jar')
    xsl_stylesheet = os.path.join(backend_dir, 'saxon', 'PMtoTOC02.xsl')
    
    # Validate required files exist
    if not os.path.exists(saxon_jar):
        return jsonify({'error': 'Saxon JAR not found. Please place saxon9he.jar in backend/saxon/ folder'}), 500
    if not os.path.exists(xsl_stylesheet):
        return jsonify({'error': 'PMtoTOC02.xsl stylesheet not found. Please place it in backend/saxon/ folder'}), 500
    
    temp_dir = None
    
    try:
        # Save uploaded files
        saved_files = []
        for file in files:
            if file and file.filename:
                filename = secure_filename(file.filename)
                if filename.lower().endswith('.xml'):
                    filepath = os.path.join(input_dir, filename)
                    file.save(filepath)
                    saved_files.append((filename, filepath))
        
        if not saved_files:
            return jsonify({'error': 'No valid XML files found'}), 400
        
        # Process each file and combine results
        all_toc_js = []
        
        for filename, filepath in saved_files:
            try:
                base_name = os.path.splitext(filename)[0]
                js_filename = f"{base_name}_toc.js"
                js_filepath = os.path.join(output_dir, js_filename)
                
                # Build Saxon command
                saxon_args = [
                    'java', '-jar', saxon_jar,
                    f'-s:{filepath}',
                    f'-xsl:{xsl_stylesheet}',
                    f'-o:{js_filepath}'
                ]
                
                # Run Saxon transformation
                result = subprocess.run(
                    saxon_args,
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=120  # 2 minute timeout per file
                )
                
                if os.path.exists(js_filepath):
                    with open(js_filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        all_toc_js.append({
                            'filename': filename,
                            'output_filename': js_filename,
                            'content': content,
                            'success': True
                        })
                else:
                    all_toc_js.append({
                        'filename': filename,
                        'success': False,
                        'error': 'Output file not created'
                    })
                    
            except subprocess.CalledProcessError as e:
                error_msg = e.stderr if e.stderr else str(e)
                all_toc_js.append({
                    'filename': filename,
                    'success': False,
                    'error': f'Saxon error: {error_msg[:200]}'
                })
            except subprocess.TimeoutExpired:
                all_toc_js.append({
                    'filename': filename,
                    'success': False,
                    'error': 'Transformation timed out'
                })
            except FileNotFoundError:
                all_toc_js.append({
                    'filename': filename,
                    'success': False,
                    'error': 'Java not found. Please install Java and add to PATH'
                })
            except Exception as e:
                all_toc_js.append({
                    'filename': filename,
                    'success': False,
                    'error': str(e)[:200]
                })
        
        # If only one file, return directly
        if len(saved_files) == 1 and all_toc_js[0].get('success'):
            content = all_toc_js[0]['content']
            cleanup_temp_files(input_dir)
            cleanup_temp_files(output_dir)
            return jsonify({
                'success': True,
                'results': all_toc_js,
                'combined_content': content
            })
        
        # If multiple files, combine content
        combined = ""
        for item in all_toc_js:
            if item.get('success'):
                combined += f"// === From: {item['filename']} ===\n"
                combined += item['content'] + "\n\n"
        
        cleanup_temp_files(input_dir)
        cleanup_temp_files(output_dir)
        
        return jsonify({
            'success': True,
            'results': all_toc_js,
            'combined_content': combined
        })
        
    except Exception as e:
        cleanup_temp_files(input_dir)
        cleanup_temp_files(output_dir)
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Backend is running'})

if __name__ == '__main__':
    # Enable threaded mode to handle multiple requests concurrently
    # This prevents timeouts when processing large files
    app.run(debug=True, port=8765, threaded=True)
