import { useEffect, useRef, useState } from 'react'
import { Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react'

import { cosmo } from '../../api/client'
import type { CosmoMessage } from '../../api/client'

interface CosmoChatWidgetProps {
  projectId?: string
  page: 'dashboard' | 'simulation' | 'recommendation'
  toolEvaluationId?: string | null
  demoContext?: Record<string, unknown>
}

const GRADIENT = 'linear-gradient(135deg, #5E149F 0%, #E2409B 52%, #F75A8C 100%)'

export default function CosmoChatWidget({
  projectId,
  page,
  toolEvaluationId,
  demoContext,
}: CosmoChatWidgetProps) {
  const storageKey = projectId ? `cosmo-launcher-state:${projectId}` : null
  const [isOpen, setIsOpen] = useState(false)
  const [launcherCompact, setLauncherCompact] = useState(false)
  const [messages, setMessages] = useState<CosmoMessage[]>([
    {
      role: 'assistant',
      content:
        "I'm Cosmo. Ask me about this workflow, what changed in the simulation, or what the results mean for your team.",
    },
  ])
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!storageKey) return
    setLauncherCompact(window.localStorage.getItem(storageKey) === 'compact')
  }, [storageKey])

  useEffect(() => {
    const viewport = scrollRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [messages, isSending])

  if (!projectId && !demoContext) return null

  const markLauncherSeen = () => {
    if (!storageKey || launcherCompact) return
    setLauncherCompact(true)
    window.localStorage.setItem(storageKey, 'compact')
  }

  const openChat = () => {
    setIsOpen(true)
    markLauncherSeen()
  }

  const closeChat = () => {
    setIsOpen(false)
    markLauncherSeen()
  }

  const sendMessage = async () => {
    const trimmed = draft.trim()
    if (!trimmed || isSending) return

    const nextMessages = [...messages, { role: 'user' as const, content: trimmed }]
    setMessages(nextMessages)
    setDraft('')
    setError(null)
    setIsSending(true)

    try {
      const response = projectId
        ? await cosmo.chat(projectId, {
            page,
            tool_evaluation_id: toolEvaluationId ?? null,
            messages: nextMessages.slice(-12),
          })
        : await cosmo.demoChat({
            page,
            context: demoContext ?? {},
            messages: nextMessages.slice(-12),
          })
      setMessages((prev) => [...prev, { role: 'assistant', content: response.reply }])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reach Cosmo right now.'
      setError(message)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "I couldn't answer that just now. Please try again in a moment.",
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70] flex items-end justify-end sm:bottom-6 sm:right-6">
      {isOpen ? (
        <div className="flex h-[min(70vh,620px)] w-[min(calc(100vw-24px),390px)] flex-col overflow-hidden rounded-[28px] border border-white/40 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)]">
          <div className="flex items-start justify-between px-5 py-4 text-white" style={{ background: GRADIENT }}>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles size={15} />
                Cosmo
              </div>
              <p className="mt-1 max-w-[250px] text-xs text-white/84">
                Scoped to this client workflow and its simulation context only.
              </p>
            </div>
            <button
              type="button"
              onClick={closeChat}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/14 transition-colors hover:bg-white/22"
              aria-label="Close Cosmo"
            >
              <X size={17} />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,#FFFDFE_0%,#FBF6FF_100%)] px-4 py-4"
          >
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-[20px] px-4 py-3 text-sm leading-relaxed shadow-[0_10px_24px_rgba(15,23,42,0.06)] ${
                    message.role === 'user'
                      ? 'rounded-br-md text-white'
                      : 'rounded-bl-md border border-black/6 bg-white text-black/76'
                  }`}
                  style={message.role === 'user' ? { background: GRADIENT } : undefined}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-[18px] rounded-bl-md border border-black/6 bg-white px-4 py-3 text-sm text-black/54 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <Loader2 size={14} className="animate-spin text-[#5E149F]" />
                  Cosmo is thinking
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-black/6 bg-white px-4 py-3">
            {error && <p className="mb-2 text-xs text-[#B42318]">{error}</p>}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder="Ask about this workflow or simulation..."
                rows={1}
                className="max-h-28 min-h-[48px] flex-1 resize-none rounded-[18px] border border-black/10 bg-[#FCFAFF] px-4 py-3 text-sm text-black outline-none transition-colors placeholder:text-black/34 focus:border-[#B4308B]"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!draft.trim() || isSending}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
                style={{ background: GRADIENT }}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openChat}
          className={`group inline-flex items-center justify-center text-white shadow-[0_20px_50px_rgba(94,20,159,0.30)] transition-transform hover:-translate-y-0.5 ${
            launcherCompact ? 'h-14 w-14 rounded-full' : 'h-14 rounded-full px-5'
          }`}
          style={{ background: GRADIENT }}
          aria-label="Ask Cosmo"
        >
          <MessageCircle size={18} />
          {!launcherCompact && <span className="ml-2 text-sm font-semibold">Ask Cosmo</span>}
        </button>
      )}
    </div>
  )
}
