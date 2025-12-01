import { useState, useCallback } from 'react'
import { FileText, Upload, X, FileCode, ClipboardList } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useLogs } from '@/context/LogsContext'

export default function DocxToAdocPage() {
  const { addLog } = useLogs()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')
  const [docType, setDocType] = useState('auto') // 'auto', 'proced', 'descript'

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFiles(acceptedFiles)
      setError(null)
      addLog(`${acceptedFiles.length} file(s) selected for conversion`, 'info')
    }
  }, [addLog])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: true
  })

  const handleConvert = async () => {
    if (files.length === 0) {
      setError('Please select at least one file')
      addLog('No files selected', 'error')
      return
    }

    setLoading(true)
    setError(null)
    setUploadProgress(0)
    setProcessingStatus('Preparing files...')
    addLog(`Starting conversion of ${files.length} file(s) as ${docType === 'auto' ? 'auto-detect' : docType}...`, 'info')

    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })
    formData.append('doc_type', docType)

    try {
      setProcessingStatus('Uploading files...')
      const response = await axios.post('/api/convert/docx-to-s1000d', formData, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
          if (percentCompleted === 100) {
            setProcessingStatus('Processing files...')
          }
        }
      })

      setProcessingStatus('Conversion complete!')
      addLog('Conversion completed successfully', 'success')
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const downloadName = files.length === 1 
        ? files[0].name.replace('.docx', '.adoc')
        : 'converted_files.zip'
      link.setAttribute('download', downloadName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      
      addLog(`Download started: ${downloadName}`, 'success')
      setFiles([])
      setUploadProgress(0)
      setProcessingStatus('')
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Conversion failed. Please try again.'
      setError(errorMsg)
      addLog(`Conversion failed: ${errorMsg}`, 'error')
      setProcessingStatus('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8" />
        <h2 className="text-3xl font-bold">DOCX to ADOC Converter</h2>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Convert DOCX to AsciiDoc</CardTitle>
          <CardDescription>
            Convert DOCX files to S1000D AsciiDoc format. Choose between Procedural (step-by-step instructions) 
            or Descriptive (general information) document types, or let the system auto-detect based on the DMC code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Document Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Document Type</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setDocType('auto')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  docType === 'auto' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <FileText className="h-6 w-6" />
                <span className="text-sm font-medium">Auto Detect</span>
                <span className="text-xs text-muted-foreground text-center">Based on DMC code</span>
              </button>
              <button
                type="button"
                onClick={() => setDocType('proced')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  docType === 'proced' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <ClipboardList className="h-6 w-6" />
                <span className="text-sm font-medium">Procedural</span>
                <span className="text-xs text-muted-foreground text-center">Step-by-step tasks</span>
              </button>
              <button
                type="button"
                onClick={() => setDocType('descript')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  docType === 'descript' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <FileCode className="h-6 w-6" />
                <span className="text-sm font-medium">Descriptive</span>
                <span className="text-xs text-muted-foreground text-center">General information</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {docType === 'auto' && '• Auto-detect will use info code from DMC (000 = Procedural, others = Descriptive)'}
              {docType === 'proced' && '• Procedural includes: Preliminary Requirements, Main Procedure, Closeout Requirements sections'}
              {docType === 'descript' && '• Descriptive includes: Standard metadata header with descriptive content structure'}
            </p>
          </div>

          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-accent' : 'border-border hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isDragActive
                ? 'Drop the DOCX files here...'
                : 'Drag & drop DOCX files here, or click to select (multiple files supported)'}
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Selected Files ({files.length})</h3>
                <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
                  Clear All
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              <p className="text-sm text-center text-muted-foreground">{processingStatus}</p>
              <Progress value={uploadProgress} />
              <p className="text-xs text-center text-muted-foreground">{uploadProgress}%</p>
            </div>
          )}

          <Button 
            onClick={handleConvert} 
            disabled={files.length === 0 || loading}
            className="w-full"
          >
            {loading ? 'Converting...' : `Convert ${files.length} File${files.length !== 1 ? 's' : ''} to AsciiDoc`}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
