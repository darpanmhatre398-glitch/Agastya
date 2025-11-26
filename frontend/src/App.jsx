import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { LogsProvider } from '@/context/LogsContext'
import MainLayout from '@/layouts/MainLayout'
import HomePage from '@/pages/HomePage'
import DocSplitterPage from '@/pages/DocSplitterPage'
import DocSplitter2Page from '@/pages/DocSplitter2Page'
import ExcelRenamerPage from '@/pages/ExcelRenamerPage'
import ExcelGeneratorPage from '@/pages/ExcelGeneratorPage'
import FileRenamerPage from '@/pages/FileRenamerPage'
import IcnMakerPage from '@/pages/IcnMakerPage'
import IcnExtractorPage from '@/pages/IcnExtractorPage'
import IcnValidatorPage from '@/pages/IcnValidatorPage'
import DocxToAdocPage from '@/pages/DocxToAdocPage'
import AdocToXmlPage from '@/pages/AdocToXmlPage'
import PdfToDocxPage from '@/pages/PdfToDocxPage'
import AdminPage from '@/pages/AdminPage'

function App() {
  return (
    <LogsProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="doc-splitter" element={<DocSplitterPage />} />
            <Route path="doc-splitter-v2" element={<DocSplitter2Page />} />
            <Route path="excel-generator" element={<ExcelGeneratorPage />} />
            <Route path="excel-renamer" element={<ExcelRenamerPage />} />
            <Route path="file-renamer" element={<FileRenamerPage />} />
            <Route path="icn-maker" element={<IcnMakerPage />} />
            <Route path="icn-extractor" element={<IcnExtractorPage />} />
            <Route path="icn-validator" element={<IcnValidatorPage />} />
            <Route path="docx-to-adoc" element={<DocxToAdocPage />} />
            <Route path="adoc-to-xml" element={<AdocToXmlPage />} />
            <Route path="pdf-to-docx" element={<PdfToDocxPage />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </Router>
    </LogsProvider>
  )
}

export default App
