from flask import Flask, request, jsonify, send_file
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
                success, message = convert_docx_to_s1000d(input_path, output_path)
                
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
        
        # Create temp directories with unique names to avoid conflicts
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        input_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'adoc_input_{unique_id}')
        output_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'adoc_output_{unique_id}')
        os.makedirs(input_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)
        temp_dirs.extend([input_dir, output_dir])
        
        # Path to the Ruby backend file (should be in the same directory as app.py)
        ruby_backend_path = os.path.join(os.path.dirname(__file__), 's1000d1.rb')
        
        # Process files
        for file in files:
            if file.filename:
                filename = secure_filename(file.filename)
                input_path = os.path.join(input_dir, filename)
                file.save(input_path)
                
                output_path = os.path.join(output_dir, filename.replace('.adoc', '.xml'))
                success, message = convert_adoc_to_s1000d(input_path, output_path, ruby_backend_path)
                
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
            return send_file(zip_path, as_attachment=True, download_name='converted_s1000d.zip')
            
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500
    finally:
        for temp_dir in temp_dirs:
            cleanup_temp_files(temp_dir)
        if zip_path:
            cleanup_temp_files(zip_path)

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

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Backend is running'})

if __name__ == '__main__':
    app.run(debug=True, port=8765)
