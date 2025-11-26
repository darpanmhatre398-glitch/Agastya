import { useState, useCallback } from 'react'
import { Code, Upload, X } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useLogs } from '@/context/LogsContext'

export default function AdocToXmlPage() {
  const { addLog } = useLogs()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')

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
    setProcessingStatus('Preparing files...')
    addLog(`Starting conversion of ${files.length} file(s)...`, 'info')

    const formData = new FormData()
    files.forEach(file => formData.append('files', file))

    try {
      setProcessingStatus('Uploading files...')
      const response = await axios.post('/api/convert/adoc-to-s1000d', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
        timeout: 300000,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
          if (percentCompleted === 100) {
            setProcessingStatus('Converting to S1000D XML...')
          }
        }
      })

      setProcessingStatus('Conversion complete!')
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      
      if (files.length === 1) {
        const originalName = files[0].name.replace('.adoc', '.xml')
        link.setAttribute('download', originalName)
      } else {
        link.setAttribute('download', 'converted_s1000d.zip')
      }
      
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      addLog(`Successfully converted ${files.length} file(s)`, 'success')
      setFiles([])
      setUploadProgress(0)
      setProcessingStatus('')
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Conversion failed'
      setError(errorMessage)
      addLog(`Conversion failed: ${errorMessage}`, 'error')
      setProcessingStatus('')
    } finally {
      setLoading(false)
    }
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
            Convert AsciiDoc files to S1000D XML format using the Ruby backend. Batch conversion supported.
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
            {loading ? 'Converting...' : `Convert to S1000D XML`}
          </Button>

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
