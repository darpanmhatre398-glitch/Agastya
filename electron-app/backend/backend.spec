# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('config.json', '.'),
        ('ruby', 'ruby'),
        ('ruby-runtime', 'ruby-runtime'),  # Full Ruby installation with AsciiDoctor
        ('saxon', 'saxon'),
        ('tools', 'tools'),  # Include pandoc and other conversion tools
        ('converters.py', '.')  # Include converters module
    ],
    hiddenimports=[
        'flask',
        'flask_cors',
        'werkzeug',
        'docx',
        'openpyxl',
        'PIL',
        'PyPDF2'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],  # Don't include binaries and datas in EXE (onedir mode)
    exclude_binaries=True,  # This makes it onedir instead of onefile
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# COLLECT creates the directory with all files
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='backend',
)
