import { useState, useCallback } from 'react'
import { Scissors, Upload, X } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import apiClient from '@/api/apiClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useLogs } from '@/context/LogsContext'

export default function DocSplitterPage() {
  const { addLog } = useLogs()
  const [file, setFile] = useState(null)
  const [headingStyle, setHeadingStyle] = useState('Heading 1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      setError(null)
      addLog(`Selected file: ${acceptedFiles[0].name}`, 'info')
    }
  }, [addLog])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: false
  })

  const handleSplit = async () => {
    if (!file) {
      setError('Please select a file first')
      return
    }

    setLoading(true)
    setError(null)
    setUploadProgress(0)
    setProcessingStatus('Preparing document...')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('heading_style', headingStyle)

    try {
      setProcessingStatus('Uploading file...')
      const response = await apiClient.post('/api/split-docx', formData, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
          if (percentCompleted === 100) {
            setProcessingStatus('Splitting document...')
          }
        }
      })

      setProcessingStatus('Split complete!')

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${file.name.replace('.docx', '')}_split.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      
      addLog(`Document split successful: ${file.name} by ${headingStyle}`, 'success')
      
      setFile(null)
      setUploadProgress(0)
      setProcessingStatus('')
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Splitting failed. Please try again.'
      setError(errorMsg)
      addLog(`Split failed: ${file.name} - ${errorMsg}`, 'error')
      setProcessingStatus('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Scissors className="h-8 w-8" />
        <h2 className="text-3xl font-bold">Document Splitter</h2>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Split DOCX by Heading Style</CardTitle>
          <CardDescription>
            Split a DOCX document into multiple files based on heading styles. Each section will be saved as a separate document.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Heading Style:</label>
            <select 
              value={headingStyle} 
              onChange={(e) => setHeadingStyle(e.target.value)}
              className="w-full p-2 bg-secondary border border-border rounded-md text-foreground"
              disabled={loading}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <option key={num} value={`Heading ${num}`}>
                  Heading {num}
                </option>
              ))}
            </select>
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
                ? 'Drop the DOCX file here...'
                : 'Drag & drop a DOCX file here, or click to select'}
            </p>
          </div>

          {file && (
            <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
              <span className="text-sm">{file.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                <X className="h-4 w-4" />
              </Button>
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
            onClick={handleSplit} 
            disabled={!file || loading}
            className="w-full"
          >
            {loading ? 'Splitting...' : 'Split Document'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
