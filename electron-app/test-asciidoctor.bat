@echo off
echo Testing AsciiDoctor Installation
echo ================================
echo.

set SCRIPT_DIR=%~dp0
set RUBY_DIR=%SCRIPT_DIR%backend\_internal\ruby-runtime

echo Ruby Directory: %RUBY_DIR%
echo.

if exist "%RUBY_DIR%\bin\ruby.exe" (
    echo [OK] Ruby executable found
) else (
    echo [ERROR] Ruby executable NOT found
    goto :end
)

if exist "%RUBY_DIR%\bin\asciidoctor.bat" (
    echo [OK] AsciiDoctor batch file found
) else (
    echo [ERROR] AsciiDoctor batch file NOT found
    goto :end
)

echo.
echo Testing Ruby version:
"%RUBY_DIR%\bin\ruby.exe" --version
echo.

echo Testing AsciiDoctor version:
"%RUBY_DIR%\bin\asciidoctor.bat" --version
echo.

echo Testing AsciiDoctor with sample file:
echo = Test Document > test.adoc
echo This is a test. >> test.adoc

"%RUBY_DIR%\bin\asciidoctor.bat" -b html test.adoc
if exist test.html (
    echo [OK] AsciiDoctor conversion successful
    del test.html
) else (
    echo [ERROR] AsciiDoctor conversion failed
)

del test.adoc

:end
echo.
echo Test complete. Press any key to exit.
pause >nul
