import { useState, useCallback } from 'react'
import { FileText, Upload, FileCode, ClipboardList, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useLogs } from '@/context/LogsContext'
import apiClient from '@/api/apiClient'

const API_BASE = apiClient.defaults.baseURL || ''

export default function DocxToAdocPage() {
  const { addLog } = useLogs()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')
  const [docType, setDocType] = useState('descript')
  const [convertedCount, setConvertedCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)
  const [fileStatuses, setFileStatuses] = useState({})

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
    setConvertedCount(0)
    setFailedCount(0)
    setTotalFiles(files.length)
    setProcessingStatus('Uploading files...')
    
    // Initialize file statuses
    const initialStatuses = {}
    files.forEach((file) => {
      initialStatuses[file.name] = { status: 'pending', name: file.name }
    })
    setFileStatuses(initialStatuses)
    
    addLog(`Starting conversion of ${files.length} file(s) as ${docType}...`, 'info')

    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    formData.append('doc_type', docType)

    try {
      // Use fetch with streaming for real-time progress
      const response = await fetch(`${API_BASE}/api/convert/docx-to-s1000d/stream`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      setUploadProgress(100)
      setProcessingStatus('Converting files...')
      
      // Mark all as converting
      setFileStatuses(prev => {
        const updated = {}
        files.forEach(file => {
          updated[file.name] = { status: 'converting', name: file.name }
        })
        return updated
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let lastDownloadId = null
      let converted = 0
      let failed = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'start') {
                setTotalFiles(data.total)
              } else if (data.type === 'progress') {
                const newStatus = data.status === 'completed' ? 'completed' : 
                                  data.status === 'failed' ? 'failed' : 'converting'
                
                setFileStatuses(prev => ({
                  ...prev,
                  [data.filename]: { 
                    status: newStatus, 
                    name: data.filename,
                    error: data.error
                  }
                }))
                
                if (data.status === 'completed') {
                  converted++
                  setConvertedCount(converted)
                } else if (data.status === 'failed') {
                  failed++
                  setFailedCount(failed)
                }
                
                setProcessingStatus(`Converting: ${data.current} / ${data.total} files`)
              } else if (data.type === 'complete') {
                lastDownloadId = data.download_id
                setConvertedCount(data.converted)
                setFailedCount(data.failed)
                setProcessingStatus(`Complete! ${data.converted} succeeded, ${data.failed} failed`)
              } else if (data.type === 'error') {
                throw new Error(data.message)
              }
            } catch (e) {
              if (e.message && !e.message.includes('JSON')) {
                throw e
              }
            }
          }
        }
      }
      
      // Auto-download if successful
      if (lastDownloadId && converted > 0) {
        addLog(`Successfully converted ${converted} file(s) to AsciiDoc`, 'success')
        
        const downloadUrl = `${API_BASE}/api/convert/docx-to-s1000d/download/${lastDownloadId}`
        const link = document.createElement('a')
        link.href = downloadUrl
        link.setAttribute('download', files.length === 1 ? files[0].name.replace('.docx', '.adoc') : 'converted_files.zip')
        document.body.appendChild(link)
        link.click()
        link.remove()
        
        setTimeout(() => {
          setFiles([])
          setUploadProgress(0)
          setProcessingStatus('')
          setConvertedCount(0)
          setFailedCount(0)
          setFileStatuses({})
        }, 3000)
      } else if (converted === 0) {
        setError('No files were converted successfully')
      }
      
    } catch (err) {
      const errorMsg = err.message || 'Conversion failed. Please try again.'
      setError(errorMsg)
      addLog(`Conversion failed: ${errorMsg}`, 'error')
      setProcessingStatus('')
      setFileStatuses({})
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
            <div className="grid grid-cols-2 gap-3">
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
                {files.map((file, index) => {
                  const status = fileStatuses[file.name]
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div className="flex items-center gap-2">
                        {status?.status === 'converting' && <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />}
                        {status?.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {status?.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                        <span className="text-sm">{file.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{processingStatus}</p>
                <span className="text-sm font-bold">
                  <span className="text-green-500">{convertedCount} ✓</span>
                  {failedCount > 0 && <span className="text-red-500 ml-2">{failedCount} ✗</span>}
                  <span className="text-muted-foreground"> / {totalFiles}</span>
                </span>
              </div>
              
              <div className="space-y-1">
                <Progress 
                  value={totalFiles > 0 ? ((convertedCount + failedCount) / totalFiles) * 100 : uploadProgress} 
                  className="h-3" 
                />
                <p className="text-xs text-center text-muted-foreground">
                  {uploadProgress < 100 
                    ? `Uploading: ${uploadProgress}%` 
                    : `Progress: ${Math.round(((convertedCount + failedCount) / totalFiles) * 100)}%`
                  }
                </p>
              </div>
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
