import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import axios from 'axios'
import { 
  Home, Scissors, Split, FileSpreadsheet, FileEdit, TableProperties,
  Image, Search, CheckCircle, FileText, Code, FileType, Settings 
} from 'lucide-react'
import { cn } from '@/lib/utils'

const allNavItems = [
  { to: '/', icon: Home, label: 'Home', alwaysShow: true },
  { to: '/doc-splitter', icon: Scissors, label: 'Doc Splitter', featureKey: 'doc_splitter' },
  { to: '/doc-splitter-v2', icon: Split, label: 'Doc Splitter V2', featureKey: 'doc_splitter_v2' },
  { to: '/excel-generator', icon: TableProperties, label: 'Excel Generator', featureKey: 'excel_renamer' },
  { to: '/excel-renamer', icon: FileSpreadsheet, label: 'Excel Renamer', featureKey: 'excel_renamer' },
  { to: '/file-renamer', icon: FileEdit, label: 'File Renamer', featureKey: 'file_renamer' },
  { to: '/icn-maker', icon: Image, label: 'ICN Generator', featureKey: 'icn_maker' },
  { to: '/icn-extractor', icon: Search, label: 'ICN Extractor', featureKey: 'icn_extractor' },
  { to: '/icn-validator', icon: CheckCircle, label: 'ICN Validator', featureKey: 'icn_validator' },
  { to: '/docx-to-adoc', icon: FileText, label: 'DOCX to ADOC', featureKey: 'docx_to_adoc' },
  { to: '/adoc-to-xml', icon: Code, label: 'ADOC to XML', featureKey: 'adoc_to_s1000d' },
  { to: '/pdf-to-docx', icon: FileType, label: 'PDF to DOCX', featureKey: 'pdf_to_docx' },
  { to: '/admin', icon: Settings, label: 'Admin', alwaysShow: true },
]

export default function Navigation() {
  const [features, setFeatures] = useState({})
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const isHomePage = location.pathname === '/'

  useEffect(() => {
    loadFeatures()
  }, [])

  const loadFeatures = async () => {
    try {
      const response = await axios.get('/api/admin/features')
      setFeatures(response.data)
    } catch (err) {
      console.error('Failed to load features')
    } finally {
      setLoading(false)
    }
  }

  const visibleNavItems = allNavItems.filter(item => {
    // Always show Home and Admin
    if (item.alwaysShow) return true
    
    // On home page, hide all tool items
    if (isHomePage) return false
    
    // On other pages, show enabled tools
    return features[item.featureKey] === true
  })
  if (loading) {
    return (
      <nav className="bg-card border border-border rounded-lg p-3 mb-5 shadow-sm">
        <div className="text-sm text-muted-foreground">Loading navigation...</div>
      </nav>
    )
  }

  // Separate admin from other nav items
  const toolNavItems = visibleNavItems.filter(item => item.to !== '/admin')
  const adminItem = visibleNavItems.find(item => item.to === '/admin')

  return (
    <nav className="bg-card border border-border rounded-lg p-3 mb-5 shadow-sm">
      <div className="flex justify-between items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {toolNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all",
                  "border border-input hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-primary text-primary-foreground border-primary shadow-md"
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{label}</span>
            </NavLink>
          ))}
        </div>
        
        {adminItem && (
          <NavLink
            to={adminItem.to}
            className={({ isActive }) =>
              cn(
                "flex items-center justify-center p-2.5 rounded-md transition-all",
                "border border-input hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-primary text-primary-foreground border-primary shadow-md"
              )
            }
            title="Admin Panel"
          >
            <Settings className="h-5 w-5" />
          </NavLink>
        )}
      </div>
    </nav>
  )
}
