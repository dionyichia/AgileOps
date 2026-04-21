import { Handle, Position } from 'reactflow'
import { MessageSquare, Pencil } from 'lucide-react'

interface TaskNodeData {
  label: string
  tools: string[]
  minutes: number
  automatable: 'high' | 'medium' | 'low'
  isNew?: boolean
  commentCount?: number
  hasPendingEdit?: boolean
  onComment?: (nodeId: string) => void
  onEdit?: (nodeId: string) => void
  editMode?: boolean
  nodeId?: string
}

const autoConfig = {
  high:   { label: 'High automation', cls: 'text-axispurple-900 bg-[var(--surface-accent-subtle)] border border-axispurple-900/12' },
  medium: { label: 'Med automation',  cls: 'text-axispurple-700 bg-[var(--surface-accent-subtle)] border border-axispurple-700/12' },
  low:    { label: 'Low automation',  cls: 'text-axispurple-300 bg-axispurple-300/10 border border-axispurple-300/20' },
}

export function TaskNode({ data }: { data: TaskNodeData }) {
  const isNew = data.isNew
  const handleStyle = {
    background: 'var(--axis-violet-700)',
    width: 8,
    height: 8,
    border: '2px solid var(--surface-card)',
  }

  return (
    <div
      className={`rounded-[18px] p-3 min-w-[220px] max-w-[260px] transition-all ${
        isNew ? 'border-2' : 'border'
      }`}
      style={{
        boxShadow: isNew
          ? '0 18px 34px rgba(180,48,139,0.14)'
          : '0 16px 30px rgba(15, 23, 42, 0.08)',
        background: isNew
          ? 'linear-gradient(180deg, var(--rf-new-start, #FFF8FC) 0%, var(--rf-new-end, #FFF0F8) 100%)'
          : 'var(--surface-card)',
        borderColor: isNew ? 'var(--axis-pink-500)' : 'var(--border-accent)',
      }}
    >
      <Handle id="top" type="target" position={Position.Top} style={handleStyle} />
      <Handle id="left-source" type="source" position={Position.Left} style={{ ...handleStyle, background: '#EF4444' }} />
      <Handle id="right-source" type="source" position={Position.Right} style={{ ...handleStyle, background: '#F59E0B' }} />
      <Handle id="right-target" type="target" position={Position.Right} style={{ ...handleStyle, background: '#F59E0B', top: '65%' }} />

      {isNew && (
        <span className="inline-block text-[10px] font-bold tracking-widest text-axispurple-700 bg-[var(--surface-accent-subtle)] border border-axispurple-700/12 px-2 py-0.5 rounded-full mb-2">
          NEW
        </span>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-semibold text-black text-sm leading-snug">{data.label}</div>
          {data.hasPendingEdit && (
            <span className="mt-1 inline-flex items-center rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-700">
              Pending review
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {data.onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                data.onEdit!(data.nodeId!)
              }}
              className="p-1.5 rounded-full hover:bg-[var(--surface-accent-subtle)] transition-colors group"
              title="Edit step"
            >
              <Pencil size={13} className="text-axispurple-900/50 group-hover:text-axispurple-900" />
            </button>
          )}
          {data.onComment && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                data.onComment!(data.nodeId!)
              }}
              className="relative p-1.5 rounded-full hover:bg-black/[0.05] transition-colors group"
              title="Leave feedback"
            >
              <MessageSquare size={14} className={`${data.commentCount ? 'text-axispurple-300' : 'text-black/30 group-hover:text-black/55'}`} />
              {!!data.commentCount && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-axispurple-300 text-[8px] font-bold text-white flex items-center justify-center">
                  {data.commentCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {data.tools.map((tool) => (
          <span
            key={tool}
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              isNew
                ? 'bg-[var(--surface-accent-subtle)] text-axispurple-700'
                : 'bg-[var(--surface-accent-subtle)] text-axispurple-900'
            }`}
          >
            {tool}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-black/8">
        <span className="text-xs text-black/42">{data.minutes}min avg</span>
        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${autoConfig[data.automatable].cls}`}>
          {autoConfig[data.automatable].label}
        </span>
      </div>

      <Handle id="bottom" type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  )
}

interface TerminalNodeData {
  label: string
  nodeType: 'success' | 'fail' | 'neutral'
}

const terminalConfig = {
  success: 'border-axispurple-900/20 bg-[var(--surface-accent-subtle)] text-axispurple-900',
  fail:    'border-axispurple-300/20 bg-axispurple-300/10 text-axispurple-300',
  neutral: 'border-black/10 bg-[var(--surface-card)] text-black/65',
}

export function TerminalNode({ data }: { data: TerminalNodeData }) {
  const handleStyle = {
    background: 'var(--axis-violet-700)',
    width: 8,
    height: 8,
    border: '2px solid var(--surface-card)',
  }
  return (
    <div
      className={`border rounded-[16px] px-4 py-2.5 text-sm font-semibold ${terminalConfig[data.nodeType]}`}
      style={{ boxShadow: '0 12px 24px rgba(15,23,42,0.05)' }}
    >
      <Handle id="top" type="target" position={Position.Top} style={handleStyle} />
      <Handle id="right" type="target" position={Position.Right} style={handleStyle} />
      {data.label}
    </div>
  )
}

export const nodeTypes = {
  taskNode:     TaskNode,
  terminalNode: TerminalNode,
}
