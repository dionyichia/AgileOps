import { Handle, Position } from 'reactflow'

interface TaskNodeData {
  label: string
  tools: string[]
  minutes: number
  automatable: 'high' | 'medium' | 'low'
  isNew?: boolean
}

const autoConfig = {
  high:   { label: 'High automation',   cls: 'text-emerald-400 bg-emerald-500/10' },
  medium: { label: 'Med automation',    cls: 'text-amber-400  bg-amber-500/10'  },
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

      <div className="font-semibold text-white text-sm mb-2 leading-snug">{data.label}</div>

      <div className="flex flex-wrap gap-1 mb-2">
        {data.tools.map((tool) => (
          <span
            key={tool}
            className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              isNew ? 'bg-blue-500/20 text-blue-300' : 'bg-indigo-500/15 text-indigo-400'
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
  success: 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
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
