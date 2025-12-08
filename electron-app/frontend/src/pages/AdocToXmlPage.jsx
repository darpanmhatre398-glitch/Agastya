import { useState, useCallback, useRef } from 'react'
import { Code, Upload, X, FileText, ClipboardList, AlertTriangle, Package, CheckCircle2, Loader2, XCircle, Download } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import apiClient from '@/api/apiClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useLogs } from '@/context/LogsContext'

// Get the API base URL
const API_BASE = apiClient.defaults.baseURL || 'http://localhost:8765'

export default function AdocToXmlPage() {
  const { addLog } = useLogs()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')
  const [conversionType, setConversionType] = useState('descript') // 'descript', 'proced', 'fault', 'ipd'
  const [convertedCount, setConvertedCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)
  const [fileStatuses, setFileStatuses] = useState({}) // Track individual file status
  const [downloadId, setDownloadId] = useState(null)
  const [originalFiles, setOriginalFiles] = useState([])
  const abortControllerRef = useRef(null)

  const onDrop = useCallback((acceptedFiles) => {
    const adocFiles = acceptedFiles.filter(file => file.name.toLowerCase().endsWith('.adoc'))
    setFiles(adocFiles)
    setError(null)
    addLog(`Selected ${adocFiles.length} ADOC file(s) for conversion`, 'info')
  }, [addLog])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.adoc']
    },
    multiple: true
  })

  const handleConvert = async () => {
    if (files.length === 0) {
      setError('Please select at least one AsciiDoc file')
      addLog('No files selected', 'error')
      return
    }

    setLoading(true)
    setError(null)
    setUploadProgress(0)
    setConvertedCount(0)
    setFailedCount(0)
    setTotalFiles(files.length)
    setDownloadId(null)
    setProcessingStatus('Uploading files...')
    
    // Initialize file statuses with file names
    const initialStatuses = {}
    files.forEach((file) => {
      initialStatuses[file.name] = { status: 'pending', name: file.name }
    })
    setFileStatuses(initialStatuses)
    
    addLog(`Starting ${conversionType} conversion of ${files.length} file(s)...`, 'info')

    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    formData.append('conversion_type', conversionType)

    try {
      // Use fetch with ReadableStream for real-time SSE progress
      const response = await fetch(`${API_BASE}/api/convert/adoc-to-s1000d/stream`, {
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
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'start') {
                setTotalFiles(data.total)
              } else if (data.type === 'progress') {
                const newStatus = data.status === 'completed' ? 'converted' : 
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
                setDownloadId(data.download_id)
                setConvertedCount(data.converted)
                setFailedCount(data.failed)
                setProcessingStatus(`Complete! ${data.converted} succeeded, ${data.failed} failed`)
              } else if (data.type === 'error') {
                throw new Error(data.message)
              }
            } catch (e) {
              // Skip non-JSON lines
              if (e.message && !e.message.includes('JSON')) {
                throw e
              }
            }
          }
        }
      }
      
      // Set download ID for manual download button
      if (lastDownloadId && converted > 0) {
        addLog(`Successfully converted ${converted} file(s)`, 'success')
        setDownloadId(lastDownloadId)
        setOriginalFiles([...files])
      } else if (converted === 0) {
        setError('No files were converted successfully')
      }
      
    } catch (err) {
      const errorMessage = err.message || 'Conversion failed'
      setError(errorMessage)
      addLog(`Conversion failed: ${errorMessage}`, 'error')
      setProcessingStatus('')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!downloadId) return
    
    const downloadUrl = `${API_BASE}/api/convert/adoc-to-s1000d/download/${downloadId}`
    const link = document.createElement('a')
    link.href = downloadUrl
    link.setAttribute('download', originalFiles.length === 1 ? originalFiles[0].name.replace('.adoc', '.xml') : 'converted_s1000d.zip')
    document.body.appendChild(link)
    link.click()
    link.remove()
    addLog('Download started', 'info')
  }

  const handleReset = () => {
    setFiles([])
    setUploadProgress(0)
    setProcessingStatus('')
    setConvertedCount(0)
    setFailedCount(0)
    setFileStatuses({})
    setDownloadId(null)
    setOriginalFiles([])
    setError(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Code className="h-8 w-8" />
        <h2 className="text-3xl font-bold">ADOC to S1000D XML</h2>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Convert AsciiDoc to S1000D XML</CardTitle>
          <CardDescription>
            Convert AsciiDoc files to S1000D XML format. Choose the appropriate conversion type based on your document type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Conversion Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Conversion Type</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setConversionType('descript')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  conversionType === 'descript' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <FileText className="h-6 w-6" />
                <span className="text-sm font-medium">Descriptive</span>
                <span className="text-xs text-muted-foreground text-center">General info</span>
              </button>
              <button
                type="button"
                onClick={() => setConversionType('proced')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  conversionType === 'proced' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <ClipboardList className="h-6 w-6" />
                <span className="text-sm font-medium">Procedural</span>
                <span className="text-xs text-muted-foreground text-center">Step-by-step</span>
              </button>
              <button
                type="button"
                onClick={() => setConversionType('fault')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  conversionType === 'fault' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <AlertTriangle className="h-6 w-6" />
                <span className="text-sm font-medium">Fault</span>
                <span className="text-xs text-muted-foreground text-center">Fault isolation</span>
              </button>
              <button
                type="button"
                onClick={() => setConversionType('ipd')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  conversionType === 'ipd' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Package className="h-6 w-6" />
                <span className="text-sm font-medium">IPD</span>
                <span className="text-xs text-muted-foreground text-center">Parts data</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {conversionType === 'descript' && '• Descriptive: For general information and description data modules'}
              {conversionType === 'proced' && '• Procedural: For step-by-step procedures with preliminary/closeout requirements'}
              {conversionType === 'fault' && '• Fault: For fault isolation procedures and troubleshooting'}
              {conversionType === 'ipd' && '• IPD: For Illustrated Parts Data with parts breakdown'}
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
                ? 'Drop the ADOC files here...'
                : 'Drag & drop ADOC files here, or click to select (multiple files supported)'}
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
                        {(status?.status === 'converted' || status?.status === 'completed') && <CheckCircle2 className="h-4 w-4 text-green-500" />}
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
                  <span className="text-muted-foreground"> / {totalFiles || files.length}</span>
                </span>
              </div>
              
              {/* Overall Progress Bar */}
              <div className="space-y-1">
                <Progress 
                  value={totalFiles > 0 ? ((convertedCount + failedCount) / totalFiles) * 100 : uploadProgress} 
                  className="h-3" 
                />
                <p className="text-xs text-center text-muted-foreground">
                  {uploadProgress < 100 
                    ? `Uploading: ${uploadProgress}%` 
                    : `Progress: ${Math.round(((convertedCount + failedCount) / (totalFiles || files.length)) * 100)}%`
                  }
                </p>
              </div>
              
              {/* Individual File Status */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {Object.entries(fileStatuses).map(([key, fileInfo]) => (
                  <div key={key} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-lg">
                    {fileInfo.status === 'pending' && (
                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                    )}
                    {fileInfo.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                    {fileInfo.status === 'uploaded' && (
                      <div className="h-4 w-4 rounded-full bg-blue-500" />
                    )}
                    {fileInfo.status === 'converting' && (
                      <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                    )}
                    {fileInfo.status === 'converted' && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {fileInfo.status === 'failed' && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm flex-1 truncate">{fileInfo.name}</span>
                    <span className={`text-xs capitalize ${
                      fileInfo.status === 'converted' ? 'text-green-500' : 
                      fileInfo.status === 'failed' ? 'text-red-500' : 
                      'text-muted-foreground'
                    }`}>
                      {fileInfo.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button 
            onClick={handleConvert} 
            disabled={files.length === 0 || loading || downloadId}
            className="w-full"
          >
            {loading ? 'Converting...' : `Convert to S1000D XML`}
          </Button>

          {/* Download Section - shown when conversion is complete */}
          {downloadId && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Conversion Complete!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {convertedCount} file(s) converted successfully{failedCount > 0 ? `, ${failedCount} failed` : ''}
              </p>
              <div className="flex gap-2">
                <Button onClick={handleDownload} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download {originalFiles.length === 1 ? 'File' : 'ZIP'}
                </Button>
                <Button onClick={handleReset} variant="outline" className="flex-1">
                  Convert More Files
                </Button>
              </div>
            </div>
          )}

          <div className="p-4 bg-accent rounded-lg space-y-2">
            <h4 className="text-sm font-semibold">Requirements</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>AsciiDoc files should contain proper S1000D metadata headers</li>
              <li>Batch conversion will produce a ZIP file with all converted XML files</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
