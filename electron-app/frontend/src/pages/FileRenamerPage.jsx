import { useState, useCallback } from 'react'
import { FileEdit, Upload, ArrowRight } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import apiClient from '@/api/apiClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useLogs } from '@/context/LogsContext'

export default function FileRenamerPage() {
  const { addLog } = useLogs()
  const [files, setFiles] = useState([])
  const [oldText, setOldText] = useState('')
  const [newText, setNewText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')

  const onDrop = useCallback((acceptedFiles) => {
    setFiles(acceptedFiles)
    setError(null)
    addLog(`Selected ${acceptedFiles.length} file(s)`, 'info')
  }, [addLog])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true
  })

  const getPreviewName = (filename) => {
    if (!oldText) return filename
    return filename.replace(new RegExp(oldText, 'g'), newText)
  }

  const handleRename = async () => {
    if (files.length === 0 || !oldText) {
      setError('Please select files and enter text to replace')
      addLog('Missing files or search text', 'error')
      return
    }

    setLoading(true)
    setError(null)
    setUploadProgress(0)
    setProcessingStatus('Preparing files...')
    addLog(`Starting batch rename of ${files.length} file(s)...`, 'info')

    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })
    formData.append('old_text', oldText)
    formData.append('new_text', newText)

    try {
      setProcessingStatus('Uploading files...')
      const response = await apiClient.post('/api/rename-files', formData, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
          if (percentCompleted === 100) {
            setProcessingStatus('Renaming files...')
          }
        }
      })

      setProcessingStatus('Rename complete!')
      addLog('Batch rename completed successfully', 'success')

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'renamed_files.zip')
      document.body.appendChild(link)
      link.click()
      link.remove()
      
      addLog('Download started: renamed_files.zip', 'success')
      setFiles([])
      setOldText('')
      setNewText('')
      setUploadProgress(0)
      setProcessingStatus('')
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Renaming failed. Please try again.'
      setError(errorMsg)
      addLog(`Batch rename failed: ${errorMsg}`, 'error')
      setProcessingStatus('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileEdit className="h-8 w-8" />
        <h2 className="text-3xl font-bold">Batch File Renamer</h2>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Rename Multiple Files</CardTitle>
          <CardDescription>
            Rename multiple files at once by replacing text patterns in their filenames. All renamed files will be downloaded as a ZIP archive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Text to Replace:</label>
              <input
                type="text"
                value={oldText}
                onChange={(e) => setOldText(e.target.value)}
                placeholder="Enter text to find in filenames"
                className="w-full p-2 bg-secondary border border-border rounded-md text-foreground"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Replacement Text:</label>
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Enter replacement text"
                className="w-full p-2 bg-secondary border border-border rounded-md text-foreground"
              />
            </div>
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
                ? 'Drop the files here...'
                : 'Drag & drop files here, or click to select (any file type supported)'}
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
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((file, index) => (
                  <div key={index} className="p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{file.name}</span>
                      {oldText && oldText !== getPreviewName(file.name) && (
                        <>
                          <ArrowRight className="h-3 w-3 text-primary" />
                          <span className="text-primary font-medium">{getPreviewName(file.name)}</span>
                        </>
                      )}
                    </div>
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
            onClick={handleRename} 
            disabled={files.length === 0 || !oldText || loading}
            className="w-full"
          >
            {loading ? 'Renaming...' : 'Rename Files'}
          </Button>

          <div className="p-4 bg-accent rounded-lg space-y-2">
            <h4 className="text-sm font-semibold">How it works</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Enter the text pattern you want to replace</li>
              <li>Enter the new text to replace it with</li>
              <li>Upload files with matching text in their names</li>
              <li>All renamed files are returned in a ZIP archive</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
