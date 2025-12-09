import { FileText } from 'lucide-react'

export default function Header() {
  return (
    <div className="bg-card border border-border rounded-lg p-6 mb-5 shadow-sm flex justify-between items-center">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">
            Agastya <span className="text-sm font-normal text-muted-foreground ml-2">Beta v0.6</span>
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Professional Document Processing and Conversion Tools
        </p>
      </div>
    </div>

  )
}
