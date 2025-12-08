/**
 * Electron Main Process
 * - License validation with HWID binding
 * - Spawns Python backend
 * - Serves React frontend
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const LicenseManager = require('./license');

// Paths - Handle both dev and packaged scenarios
const isDev = !app.isPackaged;

// In packaged app, __dirname points to app.asar, we need the unpacked resources
const getAppPath = () => {
  if (isDev) {
    return __dirname;
  }
  // For portable exe, files are in the same directory as the executable
  return path.dirname(process.execPath);
};

const appBasePath = getAppPath();
const frontendPath = isDev
  ? path.join(__dirname, 'frontend/dist')
  : path.join(appBasePath, 'resources', 'app', 'frontend', 'dist');
const backendPath = isDev
  ? path.join(__dirname, 'backend')
  : path.join(appBasePath, 'resources', 'app', 'backend');

// Globals
let mainWindow = null;
let activationWindow = null;
let backendProcess = null;
let licenseManager = null;

const BACKEND_PORT = 8765;
const FRONTEND_PORT = 3456;

// ============================================================================
// Backend Process Management
// ============================================================================

function startBackend() {
  return new Promise((resolve, reject) => {
    // Try multiple possible backend locations
    const possiblePaths = [
      // Development path - onedir structure
      path.join(__dirname, 'backend', 'dist', 'backend', 'backend.exe'),
      // Production path - onedir in resources/backend
      path.join(process.resourcesPath, 'backend', 'backend.exe'),
      // Alternative production path
      path.join(path.dirname(process.execPath), 'resources', 'backend', 'backend.exe'),
      // Portable installation path
      path.join(path.dirname(process.execPath), 'backend', 'backend.exe')
    ];

    let backendExe = null;
    let checkedPaths = [];

    // Find the first existing backend executable
    for (const testPath of possiblePaths) {
      checkedPaths.push(testPath);
      if (fs.existsSync(testPath)) {
        backendExe = testPath;
        console.log('✓ Found backend at:', backendExe);
        break;
      }
    }

    // If backend not found, create detailed error log
    if (!backendExe) {
      const errorMsg = `Backend executable not found!\n\nSearched locations:\n${checkedPaths.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nPlease ensure the application was built correctly.`;
      console.error(errorMsg);

      // Write error to log file for debugging
      const logPath = path.join(app.getPath('userData'), 'backend-error.log');
      fs.writeFileSync(logPath, errorMsg + '\n\nTimestamp: ' + new Date().toISOString());

      reject(new Error(`Backend not found. Log saved to: ${logPath}`));
      return;
    }

    // Verify required dependencies exist
    const backendDir = path.dirname(backendExe);

    // In PyInstaller onedir mode, dependencies are in _internal folder
    const internalDir = path.join(backendDir, '_internal');
    const checkDir = fs.existsSync(internalDir) ? internalDir : backendDir;

    const requiredDeps = ['config.json', 'tools', 'ruby', 'ruby-runtime', 'saxon'];
    const missingDeps = [];

    for (const dep of requiredDeps) {
      const depPath = path.join(checkDir, dep);
      if (!fs.existsSync(depPath)) {
        missingDeps.push(dep);
      }
    }

    if (missingDeps.length > 0) {
      const errorMsg = `Missing backend dependencies: ${missingDeps.join(', ')}\nBackend directory: ${backendDir}\nChecked in: ${checkDir}`;
      console.error(errorMsg);
      const logPath = path.join(app.getPath('userData'), 'backend-error.log');
      fs.writeFileSync(logPath, errorMsg + '\n\nTimestamp: ' + new Date().toISOString());
      reject(new Error(`Missing dependencies. Log saved to: ${logPath}`));
      return;
    }

    console.log('Starting backend:', backendExe);
    console.log('Backend directory:', backendDir);

    backendProcess = spawn(backendExe, [], {
      cwd: backendDir,
      env: { ...process.env, FLASK_PORT: BACKEND_PORT.toString() }
    });

    let backendOutput = '';

    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      backendOutput += output;
      console.log(`Backend: ${output}`);
      if (output.includes('Running on')) {
        resolve();
      }
    });

    backendProcess.stderr.on('data', (data) => {
      const output = data.toString();
      backendOutput += output;
      console.error(`Backend Error: ${output}`);
      // Flask logs to stderr, check for running message
      if (output.includes('Running on')) {
        resolve();
      }
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err);
      const logPath = path.join(app.getPath('userData'), 'backend-error.log');
      fs.writeFileSync(logPath, `Backend startup error:\n${err.message}\n\nOutput:\n${backendOutput}\n\nTimestamp: ${new Date().toISOString()}`);
      reject(new Error(`Backend failed to start. Log saved to: ${logPath}`));
    });

    // Timeout - assume started after 5 seconds (increased from 3)
    setTimeout(() => {
      if (backendOutput.includes('error') || backendOutput.includes('Error')) {
        const logPath = path.join(app.getPath('userData'), 'backend-error.log');
        fs.writeFileSync(logPath, `Backend may have errors:\n${backendOutput}\n\nTimestamp: ${new Date().toISOString()}`);
        console.warn('Backend started but may have errors. Check log:', logPath);
      }
      resolve();
    }, 5000);
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

// ============================================================================
// Window Management
// ============================================================================

function createActivationWindow() {
  activationWindow = new BrowserWindow({
    width: 450,
    height: 350,
    resizable: false,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  activationWindow.setMenu(null);
  activationWindow.loadFile(path.join(__dirname, 'activation.html'));

  activationWindow.on('closed', () => {
    activationWindow = null;
    // If activation window closed without successful activation, quit
    if (!licenseManager.checkLicense()) {
      app.quit();
    }
  });
}

async function createMainWindow() {
  // Start backend first
  try {
    await startBackend();
  } catch (err) {
    const logPath = path.join(app.getPath('userData'), 'backend-error.log');
    dialog.showErrorBox(
      'Backend Startup Failed',
      `The application backend failed to start.\n\n${err.message}\n\nPlease check the log file for details:\n${logPath}\n\nIf the problem persists, try reinstalling the application.`
    );
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Maximize window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Check if frontend dist exists
  const indexPath = path.join(frontendPath, 'index.html');

  if (fs.existsSync(indexPath)) {
    // Load built frontend
    mainWindow.loadFile(indexPath);
  } else if (isDev) {
    // In dev mode, load from Vite dev server
    mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
  } else {
    dialog.showErrorBox('Error', 'Frontend files not found. Please rebuild the application.');
    app.quit();
    return;
  }

  // Open DevTools in dev mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// IPC Handlers
// ============================================================================

function setupIPC() {
  // License activation
  ipcMain.handle('activate-key', async (_event, key) => {
    const result = licenseManager.activate(key);
    if (result.success) {
      setTimeout(async () => {
        if (activationWindow) {
          activationWindow.close();
          activationWindow = null;
        }
        await createMainWindow();
      }, 800);
    }
    return result;
  });

  // Get HWID
  ipcMain.handle('get-hwid', () => {
    return licenseManager.getHWID();
  });

  // Get license info
  ipcMain.handle('get-license-info', () => {
    return licenseManager.getLicenseInfo();
  });

  // Deactivate license
  ipcMain.handle('deactivate-license', () => {
    return licenseManager.deactivate();
  });

  // Check license status
  ipcMain.handle('check-license', () => {
    return licenseManager.checkLicense();
  });

  // Cancel all operations - restart backend to kill running processes
  ipcMain.handle('cancel-operations', async () => {
    console.log('Canceling all operations - restarting backend...');
    stopBackend();
    try {
      await startBackend();
      return { success: true, message: 'All operations cancelled' };
    } catch (err) {
      return { success: false, message: 'Failed to restart backend' };
    }
  });
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  licenseManager = new LicenseManager(app);
  setupIPC();

  if (licenseManager.checkLicense()) {
    createMainWindow();
  } else {
    createActivationWindow();
  }
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (licenseManager && licenseManager.checkLicense()) {
      createMainWindow();
    } else {
      createActivationWindow();
    }
  }
});

app.on('before-quit', () => {
  stopBackend();
});
