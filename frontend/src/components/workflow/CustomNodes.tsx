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
  high:   { label: 'High automation',   cls: 'text-[#5E149F] bg-[#F4E8FB] border border-[#5E149F]/12' },
  medium: { label: 'Med automation',    cls: 'text-[#B4308B] bg-[#FCEAF4] border border-[#B4308B]/12' },
  low:    { label: 'Low automation',    cls: 'text-[#F75A8C] bg-[#FFE9EF] border border-[#F75A8C]/12' },
}

export function TaskNode({ data }: { data: TaskNodeData }) {
  const isNew = data.isNew

  return (
    <div
      className={`rounded-[18px] p-3 min-w-[220px] max-w-[260px] transition-all ${
        isNew
          ? 'border-2 border-[#B4308B] bg-[#FFF5FB]'
          : 'border bg-white'
      }`}
      style={{
        boxShadow: isNew ? '0 18px 34px rgba(180,48,139,0.14)' : '0 16px 30px rgba(15, 23, 42, 0.08)',
        background: isNew
          ? 'linear-gradient(180deg, #FFF8FC 0%, #FFF0F8 100%)'
          : 'linear-gradient(180deg, #FFFFFF 0%, #FCF7FF 100%)',
        borderColor: isNew ? '#E2409B' : 'rgba(94,20,159,0.10)',
      }}
    >
      <Handle type="target" position={Position.Top}    style={{ background: '#D29AE8', width: 8, height: 8, border: '2px solid #fff' }} />
      <Handle type="target" position={Position.Left}   style={{ background: '#D29AE8', width: 8, height: 8, border: '2px solid #fff' }} />

      {isNew && (
        <span className="inline-block text-[10px] font-bold tracking-widest text-[#B4308B] bg-[#FCEAF4] border border-[#B4308B]/12 px-2 py-0.5 rounded-full mb-2">
          NEW
        </span>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-[#111111] text-sm leading-snug">{data.label}</div>
        {data.onComment && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              data.onComment!(data.nodeId!)
            }}
            className="relative flex-shrink-0 p-1.5 rounded-full hover:bg-black/[0.05] transition-colors group"
            title="Leave feedback"
          >
            <MessageSquare size={14} className={`${data.commentCount ? 'text-[#F75A8C]' : 'text-black/30 group-hover:text-black/55'}`} />
            {!!data.commentCount && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#F75A8C] text-[8px] font-bold text-white flex items-center justify-center">
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
              className={`text-xs px-2 py-1 rounded-full font-medium ${
              isNew ? 'bg-[#FCEAF4] text-[#B4308B]' : 'bg-[#F4E8FB] text-[#5E149F]'
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

      <Handle type="source" position={Position.Bottom} style={{ background: '#D29AE8', width: 8, height: 8, border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right}  style={{ background: '#D29AE8', width: 8, height: 8, border: '2px solid #fff' }} />
    </div>
  )
}

interface TerminalNodeData {
  label: string
  nodeType: 'success' | 'fail' | 'neutral'
}

const terminalConfig = {
  success: 'border-[#5E149F]/20 bg-[#F4E8FB] text-[#5E149F]',
  fail:    'border-[#F75A8C]/20 bg-[#FFE9EF] text-[#F75A8C]',
  neutral: 'border-black/10 bg-white text-black/65',
}

export function TerminalNode({ data }: { data: TerminalNodeData }) {
  return (
    <div
      className={`border rounded-[16px] px-4 py-2.5 text-sm font-semibold ${terminalConfig[data.nodeType]}`}
      style={{ boxShadow: '0 12px 24px rgba(15,23,42,0.05)' }}
    >
      <Handle type="target" position={Position.Top}  style={{ background: '#D29AE8', width: 8, height: 8, border: '2px solid #fff' }} />
      <Handle type="target" position={Position.Left} style={{ background: '#D29AE8', width: 8, height: 8, border: '2px solid #fff' }} />
      {data.label}
    </div>
  )
}

export const nodeTypes = {
  taskNode:     TaskNode,
  terminalNode: TerminalNode,
}
