import { Button } from '@/components/ui/button'
import { Check, X, Clock, AlertCircle } from 'lucide-react'
import type { ApprovalRequest } from '@/types'

interface ApprovalCardProps {
  approval: ApprovalRequest
  onApprove: (approvalId: string, decision: 'approve' | 'deny') => Promise<void>
}

export function ApprovalCard({ approval, onApprove }: ApprovalCardProps) {
  const isPending = approval.status === 'pending'
  const hasError = !!approval.error && isPending

  return (
    <div className={`max-w-[80%] rounded-lg border px-4 py-3 text-sm ${
      hasError
        ? 'border-red-500/30 bg-red-500/5'
        : 'border-amber-500/30 bg-amber-500/5'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {hasError ? (
          <AlertCircle className="w-4 h-4 text-red-500" />
        ) : (
          <Clock className="w-4 h-4 text-amber-500" />
        )}
        <span className={`font-medium ${
          hasError
            ? 'text-red-600 dark:text-red-400'
            : 'text-amber-600 dark:text-amber-400'
        }`}>
          {hasError ? 'Approval failed' : 'Approval required'}
        </span>
        {!isPending && (
          <span className={`text-xs ${approval.status === 'approved' ? 'text-green-500' : 'text-red-500'}`}>
            {approval.status === 'approved' ? 'Approved' : 'Denied'}
          </span>
        )}
      </div>

      <div className="text-foreground mb-1">{approval.summary}</div>

      {hasError && (
        <div className="text-xs text-red-500 mt-1">{approval.error}</div>
      )}

      {approval.preview && (
        <pre className="mt-2 p-2 rounded bg-background/50 text-xs text-muted-foreground overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
          {approval.preview}
        </pre>
      )}

      {isPending && (
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-green-500/30 text-green-600 hover:bg-green-500/10"
            onClick={() => onApprove(approval.approvalId, 'approve')}
          >
            <Check className="w-3 h-3" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-red-500/30 text-red-600 hover:bg-red-500/10"
            onClick={() => onApprove(approval.approvalId, 'deny')}
          >
            <X className="w-3 h-3" />
            Deny
          </Button>
        </div>
      )}
    </div>
  )
}
