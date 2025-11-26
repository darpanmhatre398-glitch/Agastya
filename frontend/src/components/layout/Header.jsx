import { FileText } from 'lucide-react'

export default function Header() {
  return (
    <div className="bg-card border border-border rounded-lg p-6 mb-5 shadow-sm flex justify-between items-center">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">
            Agastya <span className="text-sm font-normal text-muted-foreground ml-2">Beta v0.2</span>
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Professional Document Processing and Conversion Tools
        </p>
      </div>
      
      <div className="flex gap-5">
        <div className="text-center px-4 py-2 bg-background rounded-md border border-border">
          <span className="block text-xs text-muted-foreground uppercase font-semibold tracking-wide mb-1">
            Tools
          </span>
          <span className="block text-2xl font-bold text-foreground">7</span>
        </div>
        <div className="text-center px-4 py-2 bg-background rounded-md border border-border">
          <span className="block text-xs text-muted-foreground uppercase font-semibold tracking-wide mb-1">
            Active
          </span>
          <span className="block text-2xl font-bold text-green-500">●</span>
        </div>
      </div>
    </div>
  )
}
