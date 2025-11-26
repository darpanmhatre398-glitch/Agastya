import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from './api/apiClient';
import Home from './components/Home';
import DocxToS1000D from './components/DocxToS1000D';
import AdocToS1000D from './components/AdocToS1000D';
import PdfToDocx from './components/PdfToDocx';
import DocSplitter from './components/DocSplitter';
import DocSplitter2 from './components/DocSplitter2';
import FileRenamer from './components/FileRenamer';
import ExcelRenamer from './components/ExcelRenamer';
import IcnExtractor from './components/IcnExtractor';
import IcnMaker from './components/IcnMaker';
import IcnValidator from './components/IcnValidator';
import Admin from './components/Admin';
import LogsPanel from './components/LogsPanel';

// Create a context for logs
export const LogsContext = React.createContext();

const HomeIcon = () => (
  <svg 
    width="16" 
    height="16" 
    viewBox="0 0 512 512" 
    fill="currentColor"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M256 52.1L56 252.1v207.8h127.9V340.2h144.2v119.7H456V252.1L256 52.1zM256 0l256 256v256H296.2V340.2H215.8V512H0V256L256 0z"/>
    <path d="M296.2 340.2h-80.4V512h80.4V340.2z"/>
    <path d="M439.8 259.8L256 75.9 72.2 259.8v199.1h71.6V340.2h224.4v118.7h71.6V259.8z"/>
  </svg>
);

function Navigation({ enabledFeatures }) {
  const location = useLocation();

  const allTools = [
    { path: '/', name: <HomeIcon />, feature: null },
    { path: '/doc-splitter', name: 'Doc Splitter', feature: 'doc_splitter' },
    { path: '/doc-splitter-v2', name: 'Doc Splitter V2', feature: 'doc_splitter_v2' },
    { path: '/excel-renamer', name: 'Excel Renamer', feature: 'excel_renamer' },
    { path: '/icn-maker', name: 'ICN Maker', feature: 'icn_maker' },
    { path: '/icn-extractor', name: 'ICN Extractor', feature: 'icn_extractor' },
    { path: '/docx-to-adoc', name: 'DOCX to ADOC', feature: 'docx_to_adoc' },
    { path: '/adoc-to-s1000d', name: 'ADOC to XML', feature: 'adoc_to_s1000d' },
    { path: '/pdf-to-docx', name: 'PDF to DOCX', feature: 'pdf_to_docx' },
    { path: '/file-renamer', name: 'File Renamer', feature: 'file_renamer' },
    { path: '/icn-validator', name: 'ICN Validator', feature: 'icn_validator' },
    { path: '/admin', name: '🔐 Admin', feature: null },
  ];

  const tools = allTools.filter(tool => 
    !tool.feature || enabledFeatures[tool.feature]
  );

  return (
    <nav className="nav">
      <div className="nav-grid">
        {tools.map((tool) => (
          <Link
            key={tool.path}
            to={tool.path}
            className={`nav-button ${location.pathname === tool.path ? 'active' : ''}`}
          >
            {tool.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function AppContent() {
  const [logs, setLogs] = useState([]);
  const [enabledFeatures, setEnabledFeatures] = useState({});

  useEffect(() => {
    loadFeatures();
    // Refresh features every 10 seconds
    const interval = setInterval(loadFeatures, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadFeatures = async () => {
    try {
      const response = await axios.get('/api/admin/features');
      setEnabledFeatures(response.data);
    } catch (err) {
      console.error('Failed to load features');
    }
  };

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: Date.now() }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <LogsContext.Provider value={{ addLog, enabledFeatures }}>
      <div className="app">
        <div className="container">
          <header className="header">
            <div className="header-content">
              <h1>📄 Agastya <span style={{ fontSize: '0.4em', color: '#71717a', fontWeight: '500', background: '#27272a', padding: '4px 12px', borderRadius: '4px', marginLeft: '10px' }}>Beta v0.2</span></h1>
              <p>Professional Document Processing and Conversion Tools</p>
            </div>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-label">Tools</span>
                <span className="stat-value">{Object.values(enabledFeatures).filter(v => v).length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Active</span>
                <span className="stat-value" style={{ color: '#86efac' }}>●</span>
              </div>
            </div>
          </header>

          <Navigation enabledFeatures={enabledFeatures} />

          <main className="content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/docx-to-adoc" element={<DocxToS1000D />} />
              <Route path="/adoc-to-s1000d" element={<AdocToS1000D />} />
              <Route path="/pdf-to-docx" element={<PdfToDocx />} />
              <Route path="/doc-splitter" element={<DocSplitter />} />
              <Route path="/doc-splitter-v2" element={<DocSplitter2 />} />
              <Route path="/file-renamer" element={<FileRenamer />} />
              <Route path="/excel-renamer" element={<ExcelRenamer />} />
              <Route path="/icn-extractor" element={<IcnExtractor />} />
              <Route path="/icn-maker" element={<IcnMaker />} />
              <Route path="/icn-validator" element={<IcnValidator />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
            <LogsPanel logs={logs} onClear={clearLogs} />
          </main>
        </div>
      </div>
    </LogsContext.Provider>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
