import { useState, useCallback } from 'react'
import { FileType, Upload, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import apiClient from '@/api/apiClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useLogs } from '@/context/LogsContext'

// Get the API base URL - empty string means relative path (nginx proxies /api/)
const API_BASE = apiClient.defaults.baseURL || ''

export default function PdfToDocxPage() {
  const { addLog } = useLogs()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')
  const [convertedCount, setConvertedCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)
  const [fileStatuses, setFileStatuses] = useState({})

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFiles(acceptedFiles)
      setError(null)
      addLog(`Selected ${acceptedFiles.length} PDF file(s)`, 'info')
    }
  }, [addLog])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
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
    
    addLog(`Starting conversion of ${files.length} PDF file(s)...`, 'info')

    const formData = new FormData()
    files.forEach(file => formData.append('files', file))

    try {
      // Use fetch with streaming for real-time progress
      const response = await fetch(`${API_BASE}/api/convert/pdf-to-docx/stream`, {
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
        addLog(`Successfully converted ${converted} file(s)`, 'success')
        
        const downloadUrl = `${API_BASE}/api/convert/pdf-to-docx/download/${lastDownloadId}`
        const link = document.createElement('a')
        link.href = downloadUrl
        link.setAttribute('download', files.length === 1 ? files[0].name.replace('.pdf', '.docx') : 'converted_pdfs.zip')
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
      addLog(`PDF conversion failed: ${errorMsg}`, 'error')
      setProcessingStatus('')
      setFileStatuses({})
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileType className="h-8 w-8" />
        <h2 className="text-3xl font-bold">PDF to DOCX Converter</h2>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Convert PDF to Editable DOCX</CardTitle>
          <CardDescription>
            Convert PDF documents to editable DOCX format. Preserves formatting, text, and images from the original PDF file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                ? 'Drop the PDF files here...'
                : 'Drag & drop PDF files here, or click to select (multiple files supported)'}
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
                      <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
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
            {loading ? 'Converting...' : `Convert ${files.length} File${files.length !== 1 ? 's' : ''} to DOCX`}
          </Button>

          <div className="p-4 bg-accent rounded-lg space-y-2">
            <h4 className="text-sm font-semibold">Note</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Best results with text-based PDFs</li>
              <li>Scanned PDFs may require OCR</li>
              <li>Complex layouts may need manual adjustment</li>
              <li>Batch processing with real-time progress</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
