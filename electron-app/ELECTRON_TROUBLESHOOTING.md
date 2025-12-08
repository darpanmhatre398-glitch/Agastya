# Electron App Troubleshooting Guide

## Common Issue: "Unable to Convert" Error

If the Electron app installs successfully but shows "unable to convert" errors when trying to use any conversion tools, this guide will help you diagnose and fix the problem.

---

## Quick Diagnosis

### Step 1: Check Backend Status

The app creates a log file when the backend fails. Check this location:

**Windows:**
```
%APPDATA%\document-tools-app\backend-error.log
```

**Full path example:**
```
C:\Users\YourUsername\AppData\Roaming\document-tools-app\backend-error.log
```

Open this file in Notepad to see what went wrong.

---

## Common Problems and Solutions

### Problem 1: Backend Executable Not Found

**Error in log:**
```
Backend executable not found!
Searched locations:
1. C:\...\backend.exe
2. C:\...\resources\backend\backend.exe
...
```

**Solution:**
The backend wasn't packaged correctly. You need to rebuild the app:

1. **Rebuild the backend:**
   ```powershell
   cd electron-app\backend
   pyinstaller backend.spec
   ```

2. **Rebuild the Electron app:**
   ```powershell
   cd electron-app
   npm run build:all
   ```

3. **Reinstall the app** on the target PC

---

### Problem 2: Missing Dependencies

**Error in log:**
```
Missing backend dependencies: tools, ruby, saxon
```

**Solution:**
The PyInstaller build didn't include all required files.

1. **Verify backend.spec includes all dependencies:**
   ```python
   datas=[
       ('config.json', '.'),
       ('ruby', 'ruby'),
       ('saxon', 'saxon'),
       ('tools', 'tools'),  # ← Must be present
       ('converters.py', '.')
   ]
   ```

2. **Ensure the folders exist in the backend directory:**
   - `backend/tools/` (contains pandoc)
   - `backend/ruby/`
   - `backend/saxon/`

3. **Rebuild using the updated spec file**

---

### Problem 3: Backend Starts But Conversions Fail

**Symptoms:**
- App opens successfully
- No error on startup
- Conversions fail with generic errors

**Solution:**
This usually means Pandoc or other conversion tools are missing.

1. **Check if tools folder was bundled:**
   - Navigate to the installation directory
   - Look for `resources\backend\tools\pandoc\pandoc.exe`

2. **If missing, update backend.spec:**
   ```python
   datas=[
       # ... other entries ...
       ('tools', 'tools'),  # Add this line
   ]
   ```

3. **Rebuild the backend and app**

---

## Testing the Backend Manually

You can test if the backend works independently:

### Method 1: Using the Diagnostic Script

```powershell
cd electron-app
node check-backend.js
```

This will:
- ✓ Check if backend.exe exists
- ✓ Verify all dependencies are present
- ✓ Test backend startup
- ✓ Show detailed error messages

### Method 2: Run Backend Directly

1. **Navigate to the backend location:**
   ```powershell
   cd "C:\Program Files\Document Tools\resources\backend"
   ```

2. **Run the backend:**
   ```powershell
   .\backend.exe
   ```

3. **Look for this message:**
   ```
   * Running on http://127.0.0.1:8765
   ```

4. **If you see errors**, they'll tell you what's missing

---

## Rebuilding the Application

If you need to rebuild the entire application:

### Step 1: Rebuild Backend Executable

```powershell
cd electron-app\backend
pyinstaller backend.spec
```

**Expected output:**
- `dist/backend/backend.exe` (110+ MB)
- All dependencies bundled inside

### Step 2: Build Frontend

```powershell
cd electron-app\frontend
npm run build
```

### Step 3: Build Electron App

```powershell
cd electron-app
npm run build:all
```

**This creates:**
- `dist/DocumentTools-1.0.0-Setup.exe` (installer)
- `dist/win-unpacked/` (portable version)

---

## Verifying the Build

Before distributing, verify the build includes everything:

### Check 1: Backend Executable Exists

```powershell
dir electron-app\backend\dist\backend\backend.exe
```

Should show a file ~110 MB in size.

### Check 2: Dependencies Are Bundled

```powershell
dir electron-app\backend\dist\backend\tools
dir electron-app\backend\dist\backend\ruby
dir electron-app\backend\dist\backend\saxon
```

All should exist and contain files.

### Check 3: Frontend Is Built

```powershell
dir electron-app\frontend\dist\index.html
```

Should exist.

### Check 4: Run Diagnostic

```powershell
cd electron-app
node check-backend.js
```

Should show all green checkmarks (✓).

---

## Installation on Target PC

### Requirements

The target PC needs:
- ✓ Windows 10/11 (64-bit)
- ✓ ~500 MB free disk space
- ✗ **NO Python required** (bundled in executable)
- ✗ **NO Node.js required** (app is compiled)

### Installation Steps

1. **Copy the installer:**
   - `DocumentTools-1.0.0-Setup.exe`

2. **Run the installer** on the target PC

3. **Launch the app** from Start Menu or Desktop

4. **Activate with license key** (if required)

5. **Test a conversion:**
   - Try PDF to DOCX conversion
   - Upload a small PDF file
   - Verify it converts successfully

---

## Getting Help

If you're still experiencing issues:

1. **Collect diagnostic information:**
   - Run `node check-backend.js` and save output
   - Copy `backend-error.log` from AppData
   - Note the exact error message shown

2. **Check these files exist in the installation:**
   ```
   resources\backend\backend.exe
   resources\backend\tools\pandoc\pandoc.exe
   resources\backend\ruby\
   resources\backend\saxon\
   resources\backend\config.json
   ```

3. **Verify the backend runs standalone:**
   ```powershell
   cd "C:\Program Files\Document Tools\resources\backend"
   .\backend.exe
   ```

---

## Advanced: Debugging in Development

If you're developing and testing:

### Enable Console Logging

In `main.js`, the backend output is logged to console. To see it:

1. **Run in development mode:**
   ```powershell
   npm start
   ```

2. **Open DevTools** (automatically opens in dev mode)

3. **Check Console tab** for backend messages

### Test Backend Separately

1. **Start backend manually:**
   ```powershell
   cd backend
   python app.py
   ```

2. **Start Electron without backend:**
   - Comment out `startBackend()` in main.js
   - Run `npm start`

3. **Test API endpoints:**
   ```
   http://localhost:8765/api/admin/features
   ```

---

## Summary Checklist

Before deploying to another PC:

- [ ] Backend executable built with PyInstaller
- [ ] All dependencies included in backend.spec
- [ ] Frontend built successfully
- [ ] Electron app packaged with electron-builder
- [ ] Diagnostic script shows all green checks
- [ ] Tested on a clean VM or PC without dev tools
- [ ] All 12 conversion tools tested and working

---

## File Locations Reference

| File | Location (Development) | Location (Production) |
|------|----------------------|---------------------|
| Backend executable | `backend/dist/backend/backend.exe` | `resources/backend/backend.exe` |
| Frontend files | `frontend/dist/` | `resources/app/frontend/dist/` |
| Error logs | N/A | `%APPDATA%/document-tools-app/backend-error.log` |
| Config file | `backend/config.json` | `resources/backend/config.json` |
| Pandoc | `backend/tools/pandoc/pandoc.exe` | `resources/backend/tools/pandoc/pandoc.exe` |

---

**Last Updated:** December 2025  
**Version:** 1.0.0
