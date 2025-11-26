import { Trash2, Activity } from 'lucide-react'
import { useLogs } from '@/context/LogsContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function LogsPanel() {
  const { logs, clearLogs } = useLogs()

  const getLogStyles = (type) => {
    switch (type) {
      case 'success':
        return 'bg-green-950 border-l-green-500 text-green-200'
      case 'error':
        return 'bg-red-950 border-l-red-500 text-red-200'
      case 'warning':
        return 'bg-yellow-950 border-l-yellow-500 text-yellow-200'
      default:
        return 'bg-card border-l-blue-500 text-blue-200'
    }
  }

  return (
    <aside className="w-96 bg-background border-l border-border p-5 overflow-y-auto max-h-[calc(100vh-220px)] flex flex-col">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Logs
        </h3>
        <Button
          onClick={clearLogs}
          variant="ghost"
          size="sm"
          className="h-8"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-2">
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-10 text-sm">
            No activity yet
          </p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={cn(
                "p-3 rounded-md border-l-4 text-sm leading-relaxed",
                getLogStyles(log.type)
              )}
            >
              <span className="block text-xs text-muted-foreground mb-1">
                {log.timestamp}
              </span>
              {log.message}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
