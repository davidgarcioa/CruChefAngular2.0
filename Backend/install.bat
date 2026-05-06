@echo off
REM Script de instalación automático para AI Voice Service
REM Para Windows

echo.
echo ========================================
echo  AI Voice Assistant - Instalador
echo ========================================
echo.

REM Verificar que Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Python no está instalado o no está en PATH
    echo Descarga Python desde: https://www.python.org/downloads/
    echo Asegúrate de marcar "Add Python to PATH"
    pause
    exit /b 1
)

echo ✅ Python encontrado
python --version
echo.

REM Crear entorno virtual
echo 📦 Creando entorno virtual...
python -m venv venv

if not exist venv (
    echo ❌ Error creando entorno virtual
    pause
    exit /b 1
)

echo ✅ Entorno virtual creado
echo.

REM Activar entorno virtual
echo 🔧 Activando entorno virtual...
call venv\Scripts\activate.bat

echo ✅ Entorno virtual activado
echo.

REM Instalar dependencias
echo 📥 Instalando dependencias...
pip install -r requirements.txt

if errorlevel 1 (
    echo ❌ Error instalando dependencias
    pause
    exit /b 1
)

echo ✅ Dependencias instaladas
echo.

REM Crear archivo .env
if not exist .env (
    echo 🔐 Creando archivo .env...
    (
        echo DEEPSEEK_API_KEY=sk-b55730508d4f4f19b7c0ebeba0cc5679
    ) > .env
    echo ✅ Archivo .env creado (actualiza con tu clave real si es necesario)
)
echo.

REM Mensaje final
echo ========================================
echo  ✅ Instalación completada
echo ========================================
echo.
echo Para ejecutar el servidor:
echo   1. Abre una terminal en esta carpeta
echo   2. Ejecuta: venv\Scripts\activate.bat
echo   3. Ejecuta: python ai_service.py
echo.
echo El servidor estará disponible en:
echo   http://localhost:8000
echo.
pause
