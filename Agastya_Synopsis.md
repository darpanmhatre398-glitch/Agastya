# AGASTYA
## Document Processing and Conversion Platform
### Synopsis

---

## 1. Introduction

**Agastya** is a comprehensive web-based document processing platform designed specifically for **S1000D technical documentation** workflows. It provides a suite of specialized tools for document conversion, splitting, renaming, and code generation, streamlining the complex processes involved in aerospace and defense documentation.

**Developed By:** Darpan & Prathamesh

**Version:** Beta v0.6

---

## 2. Purpose

Agastya addresses the challenges faced by technical writers and documentation teams working with S1000D standards by providing:

- Automated document processing and conversion
- Batch file operations with intelligent renaming
- XML/HTML generation from various source formats
- Data Module Code (DMC) generation
- Publication Module creation and management

---

## 3. Tools Overview

### 3.1 Doc Splitter
Splits large DOCX documents into smaller files based on heading levels. Preserves images, tables, and formatting in each split document.

### 3.2 Doc Splitter V2
Enhanced version with improved error handling, better heading detection, and support for complex document structures.

### 3.3 Excel Generator
Generates Excel templates from filenames for easy mapping and organization of document batches.

### 3.4 Excel Renamer
Batch renames DOCX files based on Excel mapping with DMC codes. Maps original filenames to S1000D compliant names.

### 3.5 File Renamer
Simple batch rename tool for replacing text patterns across multiple filenames simultaneously.

### 3.6 ICN Generator
Creates ICN (Information Control Number) tagged images from bulk image uploads for S1000D compliance.

### 3.7 ICN Extractor
Extracts ICN-tagged images from DOCX documents, organizing them for use in technical publications.

### 3.8 ICN Validator
Validates and audits ICN references in DOCX files to ensure compliance and detect missing or incorrect references.

### 3.9 DOCX to ADOC
Converts Microsoft Word documents to AsciiDoc format for further processing in documentation pipelines.

### 3.10 ADOC to XML
Converts AsciiDoc files to S1000D compliant XML format using predefined transformation rules.

### 3.11 XML to HTML
Transforms S1000D XML to HTML using Saxon XSLT processor for web-based viewing and publishing.

### 3.12 HTML to JSON
Extracts HTML content into searchable JSON/JavaScript data sources for integration with web applications.

### 3.13 PMC Builder
Visual drag-and-drop tool for building S1000D Publication Module XML files. Supports folder uploads and hierarchical organization.

### 3.14 TOC Builder
Generates JavaScript Table of Contents from PM XML files using XSL transformation logic.

### 3.15 DMC Generator
Generates Data Module Codes for S1000D documentation with:
- Multiple data source support (Air, Surface, Sea vehicles)
- System hierarchy browser
- Per-unit info code selection
- Batch code generation

---

## 4. Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React.js, Tailwind CSS |
| Backend | Python Flask |
| Document Processing | python-docx, mammoth, docx.js |
| XML Processing | Saxon XSLT |
| Desktop App | Electron.js |

---

## 5. Key Features

- **Modern UI** - Clean, responsive interface with dark theme
- **Batch Processing** - Handle multiple files simultaneously
- **Real-time Preview** - See results before downloading
- **Activity Logs** - Track all operations and errors
- **Admin Panel** - Enable/disable features as needed
- **Cross-Platform** - Works on Windows, Mac, and Linux

---

## 6. Conclusion

Agastya simplifies the complex workflow of S1000D technical documentation by providing an integrated suite of tools that automate repetitive tasks, ensure compliance, and improve productivity for documentation teams.

---

**© 2024 Agastya - Developed by Darpan & Prathamesh**
