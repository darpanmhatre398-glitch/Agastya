import { useState, useCallback } from 'react'
import { FileType, Upload, X } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useLogs } from '@/context/LogsContext'

export default function PdfToDocxPage() {
  const { addLog } = useLogs()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')

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
    setProcessingStatus('Preparing files...')
    addLog(`Starting conversion of ${files.length} PDF file(s)...`, 'info')

    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })

    try {
      setProcessingStatus('Uploading files...')
      const response = await axios.post('/api/convert/pdf-to-docx', formData, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
          if (percentCompleted === 100) {
            setProcessingStatus('Converting PDFs...')
          }
        }
      })

      setProcessingStatus('Conversion complete!')
      addLog('PDF conversion completed successfully', 'success')

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const downloadName = files.length === 1 
        ? files[0].name.replace('.pdf', '.docx')
        : 'converted_pdfs.zip'
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
      addLog(`PDF conversion failed: ${errorMsg}`, 'error')
      setProcessingStatus('')
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
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
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
            {loading ? 'Converting...' : `Convert ${files.length} File${files.length !== 1 ? 's' : ''} to DOCX`}
          </Button>

          <div className="p-4 bg-accent rounded-lg space-y-2">
            <h4 className="text-sm font-semibold">Note</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Best results with text-based PDFs</li>
              <li>Scanned PDFs may require OCR</li>
              <li>Complex layouts may need manual adjustment</li>
              <li>Batch processing supported</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
