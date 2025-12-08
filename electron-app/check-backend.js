/**
 * Backend Diagnostic Script
 * Run this to verify the backend installation and dependencies
 * Usage: node check-backend.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('='.repeat(70));
console.log('Backend Diagnostic Tool');
console.log('='.repeat(70));
console.log();

// Check if running in development or production
const isDev = fs.existsSync(path.join(__dirname, 'backend', 'app.py'));
console.log(`Environment: ${isDev ? 'Development' : 'Production'}`);
console.log();

// Possible backend locations
const possiblePaths = [
    path.join(__dirname, 'backend', 'dist', 'backend', 'backend.exe'),
    path.join(process.resourcesPath || __dirname, 'backend', 'backend.exe'),
    path.join(__dirname, '..', 'resources', 'backend', 'backend.exe')
];

console.log('Checking backend executable locations:');
let backendExe = null;

for (let i = 0; i < possiblePaths.length; i++) {
    const testPath = possiblePaths[i];
    const exists = fs.existsSync(testPath);
    console.log(`  ${i + 1}. ${exists ? '✓' : '✗'} ${testPath}`);
    if (exists && !backendExe) {
        backendExe = testPath;
    }
}
console.log();

if (!backendExe) {
    console.error('❌ ERROR: Backend executable not found!');
    console.log();
    console.log('Solution:');
    console.log('  1. Rebuild the backend using PyInstaller:');
    console.log('     cd backend');
    console.log('     pyinstaller backend.spec');
    console.log();
    console.log('  2. Rebuild the Electron app:');
    console.log('     npm run build:all');
    process.exit(1);
}

console.log(`✓ Backend found at: ${backendExe}`);
console.log();

// Check dependencies
const backendDir = path.dirname(backendExe);
const requiredDeps = [
    { name: 'config.json', type: 'file' },
    { name: 'tools', type: 'dir', critical: true },
    { name: 'ruby', type: 'dir', critical: true },
    { name: 'saxon', type: 'dir', critical: true },
    { name: 'converters.py', type: 'file' }
];

console.log('Checking dependencies:');
let allDepsOk = true;

for (const dep of requiredDeps) {
    const depPath = path.join(backendDir, dep.name);
    const exists = fs.existsSync(depPath);
    const icon = exists ? '✓' : (dep.critical ? '❌' : '⚠');
    console.log(`  ${icon} ${dep.name} (${dep.type})`);

    if (!exists && dep.critical) {
        allDepsOk = false;
    }

    // Check tools subdirectory for pandoc
    if (dep.name === 'tools' && exists) {
        const pandocPath = path.join(depPath, 'pandoc', 'pandoc.exe');
        const pandocExists = fs.existsSync(pandocPath);
        console.log(`    ${pandocExists ? '✓' : '❌'} pandoc.exe`);
        if (!pandocExists) allDepsOk = false;
    }
}
console.log();

if (!allDepsOk) {
    console.error('❌ ERROR: Missing critical dependencies!');
    console.log();
    console.log('Solution:');
    console.log('  1. Ensure all dependencies are in the backend folder');
    console.log('  2. Rebuild using PyInstaller with updated backend.spec');
    console.log('  3. Verify backend.spec includes all data files');
    process.exit(1);
}

console.log('✓ All dependencies found');
console.log();

// Try to start backend
console.log('Testing backend startup...');
console.log('(This will take a few seconds)');
console.log();

const backendProcess = spawn(backendExe, [], {
    cwd: backendDir,
    env: { ...process.env, FLASK_PORT: '8765' }
});

let output = '';
let started = false;

backendProcess.stdout.on('data', (data) => {
    output += data.toString();
    if (data.toString().includes('Running on')) {
        started = true;
    }
});

backendProcess.stderr.on('data', (data) => {
    output += data.toString();
    if (data.toString().includes('Running on')) {
        started = true;
    }
});

setTimeout(() => {
    backendProcess.kill();

    console.log('Backend output:');
    console.log('-'.repeat(70));
    console.log(output || '(no output)');
    console.log('-'.repeat(70));
    console.log();

    if (started) {
        console.log('✓ SUCCESS: Backend started successfully!');
        console.log();
        console.log('Your Electron app should work correctly.');
    } else {
        console.error('❌ ERROR: Backend did not start properly!');
        console.log();
        console.log('Possible issues:');
        console.log('  - Missing Python dependencies in the executable');
        console.log('  - Port 8765 already in use');
        console.log('  - Missing DLL files or system dependencies');
        console.log();
        console.log('Try running the backend manually to see detailed errors:');
        console.log(`  ${backendExe}`);
    }

    console.log();
    console.log('='.repeat(70));
    process.exit(started ? 0 : 1);
}, 5000);
