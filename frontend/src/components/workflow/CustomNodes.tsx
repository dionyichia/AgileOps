import { Handle, Position } from 'reactflow'
import { MessageSquare } from 'lucide-react'

interface TaskNodeData {
  label: string
  tools: string[]
  minutes: number
  automatable: 'high' | 'medium' | 'low'
  isNew?: boolean
  commentCount?: number
  onComment?: (nodeId: string) => void
  nodeId?: string
}

const autoConfig = {
  high:   { label: 'High automation',   cls: 'text-sea-400 bg-sea-500/10' },
  medium: { label: 'Med automation',    cls: 'text-gold-400 bg-gold-500/10'  },
  low:    { label: 'Low automation',    cls: 'text-red-400    bg-red-500/10'    },
}

export function TaskNode({ data }: { data: TaskNodeData }) {
  const isNew = data.isNew

  return (
    <div
      className={`rounded-xl p-3 min-w-[220px] max-w-[260px] shadow-xl transition-all ${
        isNew
          ? 'border-2 border-blue-400 bg-blue-950/60 shadow-blue-500/20'
          : 'border border-slate-700 bg-[#1A2235]'
      }`}
    >
      <Handle type="target" position={Position.Top}    style={{ background: '#475569', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left}   style={{ background: '#475569', width: 8, height: 8 }} />

      {isNew && (
        <span className="inline-block text-[10px] font-bold tracking-widest text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded mb-2">
          NEW
        </span>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-white text-sm leading-snug">{data.label}</div>
        {data.onComment && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              data.onComment!(data.nodeId!)
            }}
            className="relative flex-shrink-0 p-1 rounded-md hover:bg-slate-700/60 transition-colors group"
            title="Leave feedback"
          >
            <MessageSquare size={14} className={`${data.commentCount ? 'text-gold' : 'text-slate-500 group-hover:text-slate-300'}`} />
            {!!data.commentCount && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-gold text-[8px] font-bold text-black flex items-center justify-center">
                {data.commentCount}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {data.tools.map((tool) => (
          <span
            key={tool}
            className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              isNew ? 'bg-blue-500/20 text-blue-300' : 'bg-cerulean-500/15 text-cerulean'
            }`}
          >
            {tool}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-700/60">
        <span className="text-xs text-slate-400">{data.minutes}min avg</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${autoConfig[data.automatable].cls}`}>
          {autoConfig[data.automatable].label}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#475569', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right}  style={{ background: '#475569', width: 8, height: 8 }} />
    </div>
  )
}

interface TerminalNodeData {
  label: string
  nodeType: 'success' | 'fail' | 'neutral'
}

const terminalConfig = {
  success: 'border-sea bg-sea-500/10 text-sea-300',
  fail:    'border-red-500    bg-red-500/10    text-red-300',
  neutral: 'border-slate-500  bg-slate-700/50  text-slate-300',
}

export function TerminalNode({ data }: { data: TerminalNodeData }) {
  return (
    <div className={`border-2 rounded-lg px-4 py-2 text-sm font-semibold ${terminalConfig[data.nodeType]}`}>
      <Handle type="target" position={Position.Top}  style={{ background: '#475569', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ background: '#475569', width: 8, height: 8 }} />
      {data.label}
    </div>
  )
}

export const nodeTypes = {
  taskNode:     TaskNode,
  terminalNode: TerminalNode,
}
