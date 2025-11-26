# 🚀 Agastya Document Processing Suite

A comprehensive web-based document processing toolkit built with React and Flask, featuring 12 powerful tools for document conversion, manipulation, and management.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.3.1-61dafb.svg)
![Flask](https://img.shields.io/badge/Flask-3.0+-000000.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg)

## ✨ Features

### Document Processing Tools

| Tool | Description | Status |
|------|-------------|--------|
| **Doc Splitter** | Split DOCX documents by headings with images and tables preserved | ✅ Active |
| **Doc Splitter V2** | Enhanced document splitting with improved error handling | ✅ Active |
| **Excel Generator** | Generate Excel templates from filenames for easy mapping | ✅ Active |
| **Excel Renamer** | Batch rename DOCX files based on Excel mapping with DMC codes | ✅ Active |
| **File Renamer** | Batch rename files by replacing text patterns in filenames | ✅ Active |
| **ICN Generator** | Create ICN-tagged images from bulk image uploads | ✅ Active |
| **ICN Extractor** | Extract ICN-tagged images from DOCX documents | ✅ Active |
| **ICN Validator** | Validate and audit ICN references in DOCX files | ✅ Active |
| **DOCX to ADOC** | Convert Word documents to AsciiDoc format | ✅ Active |
| **ADOC to XML** | Convert AsciiDoc to S1000D XML format | ✅ Active |
| **PDF to DOCX** | Convert PDF documents to editable DOCX format | ✅ Active |
| **DM Code Generator** | Generate Data Module codes for S1000D documentation | ✅ Active |

### Additional Features

- 🎨 **Modern UI** - Built with React 18, Tailwind CSS, and Shadcn/ui components
- 🔐 **Admin Panel** - Toggle features on/off, manage application settings
- 📊 **Activity Logs** - Track all operations with detailed logging
- 🐳 **Docker Ready** - Full containerization with Docker Compose
- 🎯 **Responsive Design** - Works seamlessly on desktop and mobile
- ⚡ **Fast Build** - Powered by Vite for lightning-fast development
- 🌙 **Modern Theme** - Clean, professional light theme with vibrant accents

## 🏗️ Architecture

```
agastya/
├── frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Tool pages (12 tools)
│   │   ├── layouts/      # Layout components
│   │   ├── context/      # React context (logs)
│   │   └── api/          # API client
│   ├── public/           # Static assets
│   │   └── version2.0/   # DM Code Generator
│   └── Dockerfile        # Frontend container
│
├── backend/              # Flask API
│   ├── app.py           # Main Flask application
│   ├── converters.py    # Document processing logic
│   ├── config.json      # Feature flags & admin settings
│   ├── requirements.txt # Python dependencies
│   └── Dockerfile       # Backend container
│
├── docker-compose.yml           # Development compose file
├── docker-compose-deployment.yml # Production compose file
└── DEPLOYMENT_INSTRUCTIONS.txt  # Deployment guide
```

## 🚀 Quick Start

### Option 1: Docker (Recommended)

**Prerequisites:**
- Docker Desktop installed and running

**Steps:**
```bash
# Clone the repository
git clone https://github.com/darpanmhatre398-glitch/Agastya.git
cd Agastya

# Start services
docker-compose up --build

# Access the application
# Frontend: http://localhost:3456
# Backend API: http://localhost:8765
```

### Option 2: Manual Setup

**Prerequisites:**
- Python 3.11+
- Node.js 18+
- Pandoc
- Ruby (for AsciiDoc conversion)

**Backend Setup:**
```bash
cd backend
pip install -r requirements.txt
python app.py
```

**Frontend Setup (new terminal):**
```bash
cd frontend
npm install
npm run dev
```

Access at: `http://localhost:3456`

## 🎮 Usage

### Basic Workflow

1. **Access the application** at `http://localhost:3456`
2. **Select a tool** from the home page
3. **Upload your files** using drag & drop or file picker
4. **Configure options** (if applicable)
5. **Process & download** results

### Excel Generator + Renamer Workflow

Perfect for batch renaming with DMC codes:

1. **Excel Generator** - Upload DOCX files → Generate template Excel
2. **Fill DMC codes** in the Excel file
3. **Excel Renamer** - Upload Excel + DOCX files → Get renamed files

### Admin Panel

Access: `http://localhost:3456/admin`
- Password: `admin@123`
- Toggle features on/off
- Save/Cancel changes
- Real-time feature visibility updates

## 🛠️ Technology Stack

### Frontend
- **Framework:** React 18.3.1
- **Build Tool:** Vite 5.1.0
- **Styling:** Tailwind CSS 3.4.1
- **UI Components:** Shadcn/ui
- **Icons:** Lucide React
- **HTTP Client:** Axios
- **Routing:** React Router v6
- **Excel Generation:** xlsx (SheetJS)

### Backend
- **Framework:** Flask 3.0+
- **Server:** Gunicorn (production)
- **Document Processing:** 
  - python-docx (DOCX manipulation)
  - Pandoc (format conversion)
  - PyPDF2 (PDF processing)
  - Pillow (image processing)
  - openpyxl (Excel handling)
  - asciidoctor (AsciiDoc conversion)

### DevOps
- **Containerization:** Docker + Docker Compose
- **Web Server:** Nginx (frontend)
- **Reverse Proxy:** Nginx (API routing)

## 📦 Deployment

### Production Deployment with Pre-built Images

1. **Load Docker images:**
```bash
docker load -i agastya-docker-deployment.tar
```

2. **Start services:**
```bash
docker-compose -f docker-compose-deployment.yml up -d
```

3. **Verify:**
```bash
docker-compose ps
curl http://localhost:8765/api/admin/features
```

See [DEPLOYMENT_INSTRUCTIONS.txt](DEPLOYMENT_INSTRUCTIONS.txt) for detailed deployment guide.

## ⚙️ Configuration

### Backend Configuration (`backend/config.json`)

```json
{
  "features": {
    "doc_splitter": true,
    "doc_splitter_v2": true,
    "excel_renamer": true,
    "file_renamer": true,
    "icn_maker": true,
    "icn_extractor": true,
    "icn_validator": true,
    "docx_to_adoc": true,
    "adoc_to_s1000d": true,
    "pdf_to_docx": true
  },
  "admin": {
    "enabled": true,
    "password": "admin@123"
  }
}
```

### Environment Variables

**Frontend (vite.config.js):**
- `VITE_API_URL` - Backend API URL (default: `http://localhost:8765`)

**Backend:**
- `FLASK_ENV` - Environment mode (development/production)
- `PYTHONUNBUFFERED` - Disable Python buffering

## 🔒 Security

- Admin panel password protection
- CORS configured for frontend domain
- Input validation on all file uploads
- Sanitized file names
- Temporary file cleanup
- Docker container isolation

## 🐛 Troubleshooting

### Port Conflicts
```bash
# Check what's using the port
netstat -ano | findstr :3456
netstat -ano | findstr :8765

# Change ports in docker-compose.yml if needed
```

### Docker Build Issues
```bash
# Clean rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### Backend Errors
```bash
# Check logs
docker-compose logs backend

# Verify config.json exists and is valid JSON
cat backend/config.json | python -m json.tool
```

### Frontend Build Issues
```bash
# Clear cache and rebuild
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

## 📊 Project Status

- ✅ All 12 tools implemented and tested
- ✅ Docker deployment ready
- ✅ Admin panel functional
- ✅ Feature toggle system active
- ✅ Modern UI with Tailwind CSS
- ✅ Production-ready

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

- **Darpan Mhatre** - [@darpanmhatre398-glitch](https://github.com/darpanmhatre398-glitch)

## 🙏 Acknowledgments

- Built with React and Flask
- UI components from Shadcn/ui
- Icons from Lucide React
- Document processing powered by Pandoc and python-docx

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check the [DEPLOYMENT_INSTRUCTIONS.txt](DEPLOYMENT_INSTRUCTIONS.txt) for deployment help

---

**Made with ❤️ for document processing professionals**
