import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ChatMessages } from '@/components/ChatMessages'
import { ChatInput } from '@/components/ChatInput'
import { FolderPicker } from '@/components/FolderPicker'
import type { LayoutContext } from './Layout'
import { cn } from '@/lib/utils'
import { Folder, X, Check } from 'lucide-react'

export function ChatPage() {
  const ctx = useOutletContext<LayoutContext>()
  const { messages, processing, status, sendMessage, stopGenerating, mode, setMode, workingDir, setWorkingDir, autoApproveEdits, setAutoApproveEdits, canSend, approveAction } = ctx
  const [showFolderPicker, setShowFolderPicker] = useState(false)

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card gap-3">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setMode('chat')}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-md transition-colors',
              mode === 'chat'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setMode('agent')}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-md transition-colors',
              mode === 'agent'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Agent
          </button>
        </div>

        {/* Folder selector (agent mode only) */}
        {mode === 'agent' && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {workingDir ? (
              <div className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary rounded-md px-2 py-1 max-w-[300px]">
                <Folder className="w-3 h-3 shrink-0" />
                <span className="truncate">{workingDir.split('/').pop()}</span>
                <button type="button" onClick={() => setWorkingDir(null)} className="shrink-0 hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowFolderPicker(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-2 py-1"
              >
                <Folder className="w-3 h-3" />
                Selecionar pasta
              </button>
            )}

            {/* Auto-approve checkbox */}
            <button
              type="button"
              onClick={() => setAutoApproveEdits(!autoApproveEdits)}
              className={cn(
                'flex items-center gap-1.5 text-xs rounded-md px-2 py-1 border transition-colors shrink-0 ml-auto',
                autoApproveEdits
                  ? 'border-green-500/30 bg-green-500/10 text-green-600'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {autoApproveEdits && <Check className="w-3 h-3" />}
              Auto-approve edits
            </button>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${
              processing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
            }`}
          />
          <span className="text-xs text-muted-foreground">{status}</span>
        </div>
      </div>

      {/* Agent mode hint */}
      {mode === 'agent' && !workingDir && (
        <div className="px-4 py-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/5 border-b border-amber-500/20">
          Select a project folder to enable agent tools.
        </div>
      )}

      <ChatMessages messages={messages} processing={processing} onApprove={approveAction} />
      <ChatInput onSend={sendMessage} onStop={stopGenerating} disabled={processing || !canSend} placeholder={mode === 'agent' && !workingDir ? 'Select a folder first...' : 'Send a message...'} />

      <FolderPicker
        open={showFolderPicker}
        onOpenChange={setShowFolderPicker}
        onSelect={setWorkingDir}
        initialPath={workingDir}
      />
    </div>
  )
}
