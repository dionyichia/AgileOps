const STORAGE_KEY = 'axisToolDrafts'

export interface SerializedFileEntry {
  link: string
  fileName: string | null
}

export interface ToolDraft {
  id: string
  savedAt: string
  toolName: string
  website: string
  docs: SerializedFileEntry
  api: SerializedFileEntry
  caseStudies: SerializedFileEntry
  pitchDeck: SerializedFileEntry
}

function safeParse(raw: string | null): ToolDraft[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.filter((d): d is ToolDraft => {
      if (!d || typeof d !== 'object') return false
      const o = d as Record<string, unknown>
      return typeof o.id === 'string' && typeof o.savedAt === 'string'
    })
  } catch {
    return []
  }
}

export function loadToolDrafts(): ToolDraft[] {
  return safeParse(localStorage.getItem(STORAGE_KEY))
}

export function saveToolDrafts(drafts: ToolDraft[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
}

export function upsertToolDraft(draft: ToolDraft): void {
  const list = loadToolDrafts()
  const i = list.findIndex((d) => d.id === draft.id)
  if (i >= 0) list[i] = draft
  else list.unshift(draft)
  saveToolDrafts(list)
}

export function deleteToolDraft(id: string): void {
  saveToolDrafts(loadToolDrafts().filter((d) => d.id !== id))
}

export function getToolDraft(id: string): ToolDraft | undefined {
  return loadToolDrafts().find((d) => d.id === id)
}
