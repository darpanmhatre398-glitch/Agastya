# DMC Mapper Fix - Rebuild Instructions

## What Was Fixed

The DMC mapper was not working because static data files were not being served properly in the packaged Electron application. The fix includes:

1. **Vite Configuration**: Added explicit `publicDir` and `copyPublicDir` settings to ensure all static assets are copied during build
2. **Electron Main Process**: Added `webRequest.onBeforeRequest` handler to intercept and serve `/version2.0/` files from the correct location

## Files Modified

- `frontend/vite.config.js` - Added public directory copy configuration
- `main.js` - Added protocol handler and webRequest interceptor for static files

## Rebuild Steps

### 1. Rebuild Frontend
```powershell
cd electron-app\frontend
npm run build
```

**Verify**: Check that `frontend/dist/version2.0/` folder exists with:
- `data/info_codes.json`
- `data2/*.json` (system definition files)
- `lib/docx.min.js`

### 2. Test in Development Mode (Optional)
```powershell
cd electron-app
npm start
```

Navigate to DMC Generator and verify:
- Data source dropdown loads system definitions
- Info codes are searchable
- Generated codes can be downloaded

### 3. Rebuild Electron App
```powershell
cd electron-app
npm run build:all
```

This will:
- Package the updated frontend
- Create installer in `dist/DocumentTools-1.0.0-Setup.exe`

### 4. Test Packaged App

Install the new build and verify:
- [ ] DMC Generator page loads without errors
- [ ] Data source dropdown shows all options
- [ ] System hierarchy loads when data source is selected
- [ ] Info codes load and are searchable
- [ ] Global info code selection works
- [ ] Per-unit info code selection works
- [ ] DMC codes are generated correctly
- [ ] Download buttons work

## Verification Checklist

### In Browser Console (F12)
- [ ] No 404 errors for `/version2.0/data/info_codes.json`
- [ ] No 404 errors for `/version2.0/data2/*.json`
- [ ] No 404 errors for `/version2.0/lib/docx.min.js`

### Functional Tests
- [ ] Select "General Air Vehicles" from data source
- [ ] Verify system hierarchy appears
- [ ] Select a subsystem
- [ ] Enter model name (e.g., "TEST")
- [ ] Enter SDC (e.g., "01")
- [ ] Set unit count to 3
- [ ] Verify DMC codes are generated
- [ ] Click download on a generated code
- [ ] Verify DOCX file is created

## Troubleshooting

### If DMC Mapper Still Doesn't Work

1. **Check frontend build output**:
   ```powershell
   dir electron-app\frontend\dist\version2.0
   ```
   Should show `data`, `data2`, `lib`, `styles` folders

2. **Check packaged app resources**:
   After installation, check:
   ```
   C:\Program Files\Document Tools\resources\app\frontend\dist\version2.0\
   ```

3. **Enable DevTools in production**:
   In `main.js`, temporarily add:
   ```javascript
   mainWindow.webContents.openDevTools();
   ```
   Then rebuild and check console for errors

4. **Check webRequest handler**:
   Add logging to the webRequest handler in `main.js`:
   ```javascript
   console.log('Request intercepted:', requestUrl);
   console.log('Serving from:', staticFilePath);
   ```

## Expected Behavior

After the fix:
- All static files in `public/version2.0/` are copied to `dist/version2.0/`
- The webRequest handler intercepts requests for `/version2.0/*` files
- Files are served from the correct location in both dev and production
- DMC mapper loads all data and functions correctly
