# Excel Renamer - Complete Logic Location Guide

## Overview
The Excel Renamer feature allows users to rename DOCX files based on mappings defined in an Excel file. It has a preview-then-execute workflow.

---

## Backend Logic

### Location: `electron-app/backend/converters.py`

#### Main Functions:

**1. `generate_rename_preview_from_excel()` - Lines 781-864**
- **Purpose**: Generates a preview of file renames based on Excel mapping
- **Input**: 
  - `excel_path`: Path to Excel file with mappings
  - `docx_folder`: Folder containing DOCX files to rename
- **Output**: Dictionary with `preview` list and `excel_data`
- **Logic**:
  - Reads Excel file using pandas
  - Finds columns: "Doc_Name" and "DMC_Code" (case-insensitive)
  - Creates mapping: `{doc_name.lower(): dmc_code}`
  - Scans DOCX folder and matches files to mapping
  - Returns preview with status indicators:
    - `✓ ready` - File can be renamed
    - `✗ conflict` - New name already exists
    - `⚠ no_mapping` - No mapping found in Excel

**2. `execute_rename_from_excel()` - Lines 866-897**
- **Purpose**: Executes the rename based on preview data
- **Input**:
  - `excel_path`: Path to Excel file
  - `docx_folder`: Folder with files
  - `preview_data`: Preview data from step 1
- **Output**: Count of renamed files and errors
- **Logic**:
  - Iterates through preview data
  - Renames files with `✓ ready` status
  - Handles conflicts by adding number suffix (`_1`, `_2`, etc.)
  - Uses `shutil.move()` to rename files

---

## API Endpoints

### Location: `electron-app/backend/app.py`

#### Route 1: Preview Endpoint - Lines 620-667
```python
@app.route('/api/rename-preview', methods=['POST'])
def rename_preview():
```
- **Method**: POST
- **Input**: 
  - `excel_file`: Excel file upload
  - `docx_files`: Multiple DOCX files
- **Process**:
  1. Saves Excel file to temp directory
  2. Saves DOCX files to `temp_dir/docx_files/`
  3. Calls `generate_rename_preview_from_excel()`
  4. Returns preview and Excel data
- **Response**:
```json
{
  "preview": [...],
  "excel_data": [...],
  "temp_dir": "path/to/temp"
}
```

#### Route 2: Execute Endpoint - Lines 669-711
```python
@app.route('/api/rename-execute', methods=['POST'])
def rename_execute():
```
- **Method**: POST
- **Input**: JSON with `temp_dir` and `preview_data`
- **Process**:
  1. Finds Excel file in temp directory
  2. Calls `execute_rename_from_excel()`
  3. Creates ZIP of renamed files
  4. Returns ZIP file for download
- **Response**: ZIP file with renamed DOCX files

---

## Frontend Logic

### Location: `electron-app/frontend/src/pages/ExcelRenamerPage.jsx`

**Component**: `ExcelRenamerPage`

**Features**:
- Excel file upload
- Multiple DOCX file upload
- Preview table showing:
  - Original filename
  - New filename
  - DMC code
  - Status (ready/conflict/no mapping)
- Execute button to perform rename
- Download renamed files as ZIP

**Workflow**:
1. User uploads Excel file + DOCX files
2. Click "Preview" → calls `/api/rename-preview`
3. Shows preview table
4. Click "Execute" → calls `/api/rename-execute`
5. Downloads ZIP with renamed files

---

## Excel File Format

### Required Columns (case-insensitive):

**Column 1**: Doc Name / Doc_Name / DocName / filename / File / FileName
- Contains original DOCX filenames (without .docx extension)

**Column 2**: DMC Code / DMC_Code / dmc_code / DMC
- Contains new names (DMC codes) for the files

### Example Excel:
```
| Doc Name          | DMC Code                    |
|-------------------|-----------------------------|
| Introduction      | DMC-S1000D-01-00-00-00A-000A-D |
| Safety            | DMC-S1000D-01-01-00-00A-000A-D |
| Maintenance       | DMC-S1000D-01-02-00-00A-000A-D |
```

---

## File Structure

```
electron-app/
├── backend/
│   ├── app.py                    # API routes (lines 620-711)
│   └── converters.py             # Core logic (lines 781-897)
└── frontend/
    └── src/
        ├── App.jsx               # Route definition (line 73)
        └── pages/
            └── ExcelRenamerPage.jsx  # UI component
```

---

## Key Features

### 1. Flexible Column Detection
- Searches for columns case-insensitively
- Supports multiple column name variations
- Example: "Doc Name", "doc_name", "DocName" all work

### 2. Conflict Handling
- Detects if new filename already exists
- Shows warning in preview
- Auto-adds number suffix during execution (`_1`, `_2`, etc.)

### 3. Filename Sanitization
- Removes invalid characters from DMC codes
- Keeps only: alphanumeric, space, dash, underscore
- Example: `DMC-S1000D/01` → `DMC-S1000D-01`

### 4. Preview Before Execute
- Shows all changes before applying
- Color-coded status indicators
- Prevents accidental overwrites

---

## Usage Example

### 1. Prepare Excel File
```excel
Doc_Name          | DMC_Code
------------------|---------------------------
Chapter1          | DMC-AIRCRAFT-01-00-00-00A-000A-D
Chapter2          | DMC-AIRCRAFT-01-01-00-00A-000A-D
```

### 2. Upload Files
- Upload Excel file
- Upload DOCX files: `Chapter1.docx`, `Chapter2.docx`

### 3. Preview
```
Original Name    | New Name                           | Status
-----------------|------------------------------------|--------
Chapter1.docx    | DMC-AIRCRAFT-01-00-00-00A-000A-D.docx | ✓ ready
Chapter2.docx    | DMC-AIRCRAFT-01-01-00-00A-000A-D.docx | ✓ ready
```

### 4. Execute
- Click "Execute Rename"
- Download ZIP with renamed files

---

## Error Handling

### Excel Errors:
- Missing required columns → Error message
- Invalid Excel format → Pandas error
- Empty Excel → No mappings warning

### File Errors:
- File not found → Skip with error
- Permission denied → Error in results
- Duplicate names → Auto-number suffix

---

## Testing

### Test Case 1: Normal Rename
```python
Excel: Doc1 → DMC-001
Files: Doc1.docx
Result: DMC-001.docx ✓
```

### Test Case 2: Conflict
```python
Excel: Doc1 → DMC-001, Doc2 → DMC-001
Files: Doc1.docx, Doc2.docx
Result: DMC-001.docx, DMC-001_1.docx ✓
```

### Test Case 3: No Mapping
```python
Excel: Doc1 → DMC-001
Files: Doc1.docx, Doc2.docx
Result: DMC-001.docx, Doc2.docx (unchanged) ⚠
```

---

## Summary

**Backend**: `converters.py` (lines 781-897)
**API**: `app.py` (lines 620-711)
**Frontend**: `ExcelRenamerPage.jsx`
**Feature**: Enabled in `config.json` as `excel_renamer: true`
