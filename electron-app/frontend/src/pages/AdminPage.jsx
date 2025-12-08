import { useState, useEffect } from 'react'
import { Settings, Lock, Unlock, KeyRound, LogOut, Save } from 'lucide-react'
import apiClient from '@/api/apiClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLogs } from '@/context/LogsContext'

export default function AdminPage() {
  const { addLog } = useLogs()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [features, setFeatures] = useState({})
  const [originalFeatures, setOriginalFeatures] = useState({})
  const [hasChanges, setHasChanges] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    loadFeatures()
  }, [])

  const loadFeatures = async () => {
    try {
      const response = await apiClient.get('/api/admin/features')
      setFeatures(response.data)
      setOriginalFeatures(response.data)
      setHasChanges(false)
    } catch (err) {
      console.error('Failed to load features')
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    
    if (!password || password.trim() === '') {
      setError('Please enter a password')
      return
    }
    
    try {
      const response = await apiClient.post('/api/admin/login', { password })
      if (response.data.success) {
        setIsLoggedIn(true)
        setSuccess('Login successful')
        addLog('Admin logged in', 'success')
        await loadFeatures()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Invalid password'
      setError(errorMsg)
      addLog('Admin login failed', 'error')
      setTimeout(() => setError(null), 5000)
    }
  }

  const handleToggleFeature = (featureName) => {
    setError(null)
    setSuccess(null)
    
    const updatedFeatures = {
      ...features,
      [featureName]: !features[featureName]
    }

    setFeatures(updatedFeatures)
    setHasChanges(true)
  }

  const handleSaveChanges = async () => {
    setError(null)
    setSuccess(null)

    console.log('Saving features:', features)
    console.log('Sending password:', password ? '***' : 'MISSING')

    try {
      const response = await apiClient.post('/api/admin/features', {
        password,
        features: features
      })
      
      console.log('Response:', response.data)
      
      if (response.data.success) {
        setOriginalFeatures(features)
        setHasChanges(false)
        setSuccess('All changes saved successfully')
        addLog('Feature settings saved', 'success')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      console.error('Save error:', err.response?.data || err.message)
      const errorMsg = err.response?.data?.error || 'Failed to save changes'
      setError(errorMsg)
      addLog(`Failed to save changes: ${errorMsg}`, 'error')
      setTimeout(() => setError(null), 5000)
    }
  }

  const handleCancelChanges = () => {
    setFeatures(originalFeatures)
    setHasChanges(false)
    setError(null)
    setSuccess(null)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      setTimeout(() => setError(null), 5000)
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      setTimeout(() => setError(null), 5000)
      return
    }

    try {
      const response = await apiClient.post('/api/admin/password', {
        old_password: password,
        new_password: newPassword
      })
      
      if (response.data.success) {
        setSuccess('Password changed successfully')
        addLog('Admin password changed', 'success')
        setPassword(newPassword)
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to change password'
      setError(errorMsg)
      addLog('Password change failed', 'error')
      setTimeout(() => setError(null), 5000)
    }
  }

  const featureLabels = {
    docx_to_adoc: 'DOCX to ADOC Converter',
    pdf_to_docx: 'PDF to DOCX Converter',
    doc_splitter: 'Document Splitter',
    file_renamer: 'Batch File Renamer',
    excel_renamer: 'Excel-Based Renamer',
    icn_extractor: 'ICN Extractor',
    icn_maker: 'ICN Maker',
    icn_validator: 'ICN Validator',
    adoc_to_s1000d: 'ADOC to S1000D'
  }

  if (!isLoggedIn) {
    return (
      <div className="space-y-6 max-w-md mx-auto mt-12">
        <div className="flex items-center gap-3">
          <Lock className="h-8 w-8" />
          <h2 className="text-3xl font-bold">Admin Panel</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Admin Authentication</CardTitle>
            <CardDescription>
              Enter the admin password to manage features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Password:</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full p-2 bg-secondary border border-border rounded-md text-foreground"
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full">
                <Lock className="h-4 w-4 mr-2" />
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8" />
          <h2 className="text-3xl font-bold">Admin Panel</h2>
        </div>
        <Button variant="outline" onClick={() => {
          setIsLoggedIn(false)
          setPassword('')
          addLog('Admin logged out', 'info')
        }}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 text-sm">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Feature Management</CardTitle>
              <CardDescription>
                Enable or disable features for all users
              </CardDescription>
            </div>
            {hasChanges && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancelChanges}>
                  Cancel
                </Button>
                <Button onClick={handleSaveChanges} className="bg-green-600 hover:bg-green-700">
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.keys(features).map((featureKey) => (
              <div
                key={featureKey}
                className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  {features[featureKey] ? (
                    <Unlock className="h-5 w-5 text-green-500" />
                  ) : (
                    <Lock className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <h4 className="font-semibold text-foreground">
                      {featureLabels[featureKey] || featureKey}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Status: {features[featureKey] ? (
                        <span className="text-green-500">Enabled</span>
                      ) : (
                        <span className="text-destructive">Disabled</span>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant={features[featureKey] ? 'default' : 'outline'}
                  onClick={() => handleToggleFeature(featureKey)}
                >
                  {features[featureKey] ? 'Disable' : 'Enable'}
                </Button>
              </div>
            ))}
          </div>
          
          {hasChanges && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                You have unsaved changes. Click "Save Changes" to apply them.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Admin Password</CardTitle>
          <CardDescription>
            Update your admin password (minimum 6 characters)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password:</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full p-2 bg-secondary border border-border rounded-md text-foreground"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm Password:</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full p-2 bg-secondary border border-border rounded-md text-foreground"
              />
            </div>
            <Button type="submit" className="w-full md:w-auto">
              <KeyRound className="h-4 w-4 mr-2" />
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
