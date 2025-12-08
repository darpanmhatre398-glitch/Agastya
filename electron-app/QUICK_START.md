# Quick Start - Rebuild and Deploy

## TL;DR - Essential Commands

```powershell
# 1. Rebuild backend (REQUIRED - includes new fixes)
cd electron-app\backend
pyinstaller backend.spec

# 2. Build frontend
cd ..\frontend
npm run build

# 3. Package Electron app
cd ..
npm run build:all

# 4. Verify everything works
node check-backend.js

# 5. Your installer is ready!
# Location: electron-app\dist\DocumentTools-1.0.0-Setup.exe
```

---

## What Changed?

### ✅ Fixed Issues
1. **Backend not found** - Added multiple fallback paths
2. **Missing Pandoc tools** - Now bundled in backend.exe
3. **No error messages** - Logs saved to AppData folder

### 📝 Files Modified
- `backend/backend.spec` - Added tools folder and dependencies
- `main.js` - Better path resolution and error handling

### 🆕 New Files
- `check-backend.js` - Diagnostic script
- `ELECTRON_TROUBLESHOOTING.md` - Troubleshooting guide
- `REBUILD_INSTRUCTIONS.md` - Detailed rebuild steps

---

## Deploy to Other PC

1. **Copy installer:**
   ```
   electron-app\dist\DocumentTools-1.0.0-Setup.exe
   ```

2. **Install on target PC** (no Python/Node.js needed!)

3. **Test conversions** - All 12 tools should work

4. **If issues occur:**
   - Check: `%APPDATA%\document-tools-app\backend-error.log`
   - See: `ELECTRON_TROUBLESHOOTING.md`

---

## File Structure

```
electron-app/
├── backend/              # Python backend
│   ├── backend.spec     # ✅ UPDATED
│   └── dist/backend/
│       └── backend.exe  # ← Rebuild this!
│
├── frontend/            # React frontend
│   └── dist/           # Built files
│
├── main.js             # ✅ UPDATED
├── check-backend.js    # 🆕 NEW
└── dist/               # Final packaged app
    └── DocumentTools-1.0.0-Setup.exe
```

---

## Need Help?

- **Detailed steps:** See `REBUILD_INSTRUCTIONS.md`
- **Troubleshooting:** See `ELECTRON_TROUBLESHOOTING.md`
- **Diagnostic check:** Run `node check-backend.js`

---

**Ready to rebuild!** 🚀
