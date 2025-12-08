# Rebuild Instructions for Electron App

Follow these steps to rebuild the Electron app with the fixes applied.

## Prerequisites

Ensure you have:
- Python 3.11+ installed
- Node.js 18+ installed
- PyInstaller installed: `pip install pyinstaller`
- All npm dependencies installed in `electron-app/` and `electron-app/frontend/`

---

## Step 1: Rebuild the Backend Executable

The backend needs to be rebuilt with the updated `backend.spec` file that now includes all dependencies.

```powershell
# Navigate to backend directory
cd electron-app\backend

# Clean previous builds (optional but recommended)
Remove-Item -Recurse -Force dist, build -ErrorAction SilentlyContinue

# Build with PyInstaller
pyinstaller backend.spec

# Verify the build
dir dist\backend\backend.exe
```

**Expected result:**
- `dist/backend/backend.exe` should exist (~110-120 MB)
- `dist/backend/tools/` folder should exist
- `dist/backend/ruby/` folder should exist
- `dist/backend/saxon/` folder should exist
- `dist/backend/config.json` should exist

---

## Step 2: Verify Backend Works Standalone

Before building the Electron app, test the backend executable:

```powershell
# Run the backend
.\dist\backend\backend.exe

# You should see output like:
# * Running on http://127.0.0.1:8765
# Press CTRL+C to stop
```

If you see errors, check that all dependencies were bundled correctly.

---

## Step 3: Build the Frontend

```powershell
# Navigate to frontend directory
cd ..\frontend

# Install dependencies (if not already done)
npm install

# Build the frontend
npm run build

# Verify the build
dir dist\index.html
```

**Expected result:**
- `dist/index.html` should exist
- `dist/assets/` folder should contain JS and CSS files

---

## Step 4: Build the Electron App

```powershell
# Navigate back to electron-app root
cd ..

# Install dependencies (if not already done)
npm install

# Build the complete Electron app
npm run build:all
```

This will:
1. Build the frontend (if not already built)
2. Package everything with electron-builder
3. Create the installer

**Expected output:**
- `dist/DocumentTools-1.0.0-Setup.exe` (installer)
- `dist/win-unpacked/` (portable version)

---

## Step 5: Run Diagnostic Check

Before distributing, verify everything is correctly bundled:

```powershell
# Run the diagnostic script
node check-backend.js
```

**Expected output:**
```
======================================================================
Backend Diagnostic Tool
======================================================================

Environment: Development

Checking backend executable locations:
  1. ✓ D:\Projects\...\backend\dist\backend\backend.exe

✓ Backend found at: D:\Projects\...\backend\dist\backend\backend.exe

Checking dependencies:
  ✓ config.json (file)
  ✓ tools (dir)
    ✓ pandoc.exe
  ✓ ruby (dir)
  ✓ saxon (dir)
  ✓ converters.py (file)

✓ All dependencies found

Testing backend startup...
(This will take a few seconds)

Backend output:
----------------------------------------------------------------------
 * Running on http://127.0.0.1:8765
----------------------------------------------------------------------

✓ SUCCESS: Backend started successfully!

Your Electron app should work correctly.

======================================================================
```

If you see any ❌ errors, fix them before proceeding.

---

## Step 6: Test the Packaged App

### Option A: Test Unpacked Version

```powershell
# Run the unpacked version
.\dist\win-unpacked\DocumentTools.exe
```

### Option B: Install and Test

```powershell
# Run the installer
.\dist\DocumentTools-1.0.0-Setup.exe
```

After installation:
1. Launch the app
2. Activate with a license key (if required)
3. Test each conversion tool:
   - PDF to DOCX
   - DOCX to AsciiDoc
   - Doc Splitter
   - ICN Generator
   - etc.

---

## Step 7: Deploy to Target PC

### Transfer Files

Copy the installer to the target PC:
- `dist/DocumentTools-1.0.0-Setup.exe`

### Installation on Target PC

1. Run the installer
2. Launch the app
3. Activate if needed
4. Test conversions

### If Issues Occur on Target PC

1. **Check the error log:**
   ```
   %APPDATA%\document-tools-app\backend-error.log
   ```

2. **Verify installation directory:**
   ```
   C:\Program Files\Document Tools\resources\backend\
   ```
   
   Should contain:
   - `backend.exe`
   - `tools/` folder
   - `ruby/` folder
   - `saxon/` folder
   - `config.json`

3. **Run backend manually:**
   ```powershell
   cd "C:\Program Files\Document Tools\resources\backend"
   .\backend.exe
   ```

4. **Check the troubleshooting guide:**
   See `ELECTRON_TROUBLESHOOTING.md` for detailed solutions

---

## Common Build Issues

### Issue: PyInstaller fails with "module not found"

**Solution:**
```powershell
pip install --upgrade pyinstaller
pip install flask flask-cors werkzeug python-docx openpyxl Pillow PyPDF2
```

### Issue: Frontend build fails

**Solution:**
```powershell
cd frontend
Remove-Item -Recurse -Force node_modules
npm install
npm run build
```

### Issue: Electron build fails with "backend not found"

**Solution:**
Ensure backend was built first:
```powershell
dir backend\dist\backend\backend.exe
```

If missing, rebuild the backend (Step 1).

### Issue: App starts but conversions fail

**Solution:**
The `tools` folder wasn't bundled. Verify `backend.spec` includes:
```python
datas=[
    # ...
    ('tools', 'tools'),  # ← This line must be present
]
```

Then rebuild the backend.

---

## Quick Rebuild Commands

For subsequent rebuilds after making changes:

```powershell
# Full rebuild
cd electron-app\backend
pyinstaller backend.spec
cd ..\frontend
npm run build
cd ..
npm run build:all

# Verify
node check-backend.js
```

---

## File Sizes Reference

After successful build, file sizes should be approximately:

| File | Size |
|------|------|
| `backend/dist/backend/backend.exe` | ~110-120 MB |
| `frontend/dist/` (total) | ~5-10 MB |
| `dist/DocumentTools-1.0.0-Setup.exe` | ~130-150 MB |
| `dist/win-unpacked/` (total) | ~200-250 MB |

If sizes are significantly different, something may be missing.

---

## Success Checklist

Before distributing to other PCs:

- [ ] Backend executable built successfully
- [ ] Backend runs standalone without errors
- [ ] Frontend built successfully
- [ ] Electron app packaged successfully
- [ ] Diagnostic script shows all ✓ checks
- [ ] Tested on development PC - all tools work
- [ ] Tested on clean PC without Python/Node.js
- [ ] All 12 conversion tools tested and working
- [ ] Error logging works (check AppData folder)
- [ ] License activation works (if applicable)

---

**Ready to distribute!** 🎉

Your Electron app should now work correctly on other PCs without requiring Python or any development tools.
