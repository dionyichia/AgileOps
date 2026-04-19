/**
 * Typed API client for the AgileOps backend.
 *
 * Auth tokens come from Supabase — no manual token storage needed.
 * The Vite dev proxy forwards /api/* to the FastAPI server on :8000.
 */

import { getAccessToken, supabase } from '../lib/supabase'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

// ── Token helpers ──────────────────────────────────────
// Kept for backward-compat with any legacy code that calls token.clear().
export const token = {
  get: (): string | null => null,           // use getAccessToken() for async access
  set: (_t: string) => {},                  // no-op; Supabase manages the session
  clear: () => supabase.auth.signOut(),
}

async function authHeaders(): Promise<Record<string, string>> {
  const t = await getAccessToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()), ...opts?.headers },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body || res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Types ──────────────────────────────────────────────

export interface Project {
  id: string
  company_name: string
  team_name: string
  primary_role: string
  team_size: number | null
  notes: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface ProjectCreate {
  company_name: string
  team_name: string
  primary_role: string
  team_size?: number
  notes?: string
}

export interface WorkflowProfile {
  id: string
  project_id: string
  role: string
  selected_responsibilities: string[]
  tools: string | null
  description: string | null
  created_at: string
}

export interface ProfileCreate {
  role: string
  selected_responsibilities: string[]
  tools?: string
  description?: string
}

export interface Transcript {
  id: string
  project_id: string
  interviewee_name: string
  interviewee_role: string
  interview_date: string
  raw_text: string
  tasks_extracted: number | null
  tasks_updated: number | null
  processed_at: string | null
  created_at: string
}

export interface TranscriptCreate {
  interviewee_name: string
  interviewee_role: string
  interview_date: string
  raw_text: string
}

export interface TranscriptSubmitResult {
  transcript: Transcript
  job_id: string
}

export interface TaskNode {
  node_id: string
  label: string
  description: string
  action_verb: string
  inputs: string[]
  outputs: string[]
  app_cluster: string[]
  duration_distribution: { type: string; mean_minutes: number; std_minutes: number }
  automatable_fraction: string
  sources?: string[]
}

export interface Job {
  id: string
  project_id: string
  job_type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress_pct: number
  current_step: string | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

// ── Auth ───────────────────────────────────────────────
// Registration, login, and session management are handled by Supabase Auth.
// Use the `supabase` client from `src/lib/supabase.ts` directly in pages.
// The helpers below exist for convenience / legacy call-sites.

export const auth = {
  login: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),
  register: (email: string, password: string) =>
    supabase.auth.signUp({ email, password }),
  resetPassword: (email: string) =>
    supabase.auth.resetPasswordForEmail(email),
  logout: () => supabase.auth.signOut(),
}

// ── Consultation (public — no auth needed) ─────────────

export interface ConsultationPayload {
  first_name: string
  last_name: string
  email: string
  role: string
  selected_responsibilities: string[]
  tools?: string
  description?: string
}

export const consultation = {
  submit: (data: ConsultationPayload) =>
    request<{ project_id: string; invite_token: string }>('/consultation', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ── Projects ───────────────────────────────────────────

export const projects = {
  list: () => request<Project[]>('/projects'),
  listAll: () => request<Project[]>('/admin/projects'),
  claim: (id: string) => request<Project>(`/projects/${id}/claim`, { method: 'POST' }),
  create: (data: ProjectCreate) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request<Project>(`/projects/${id}`),
  update: (id: string, data: Partial<ProjectCreate & { status: string }>) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
}

// ── Workflow Profiles ──────────────────────────────────

export const profiles = {
  get: (projectId: string) => request<WorkflowProfile>(`/projects/${projectId}/profile`),
  upsert: (projectId: string, data: ProfileCreate) =>
    request<WorkflowProfile>(`/projects/${projectId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}

// ── Transcripts ────────────────────────────────────────

export const transcripts = {
  list: (projectId: string) => request<Transcript[]>(`/projects/${projectId}/transcripts`),
  get: (projectId: string, transcriptId: string) =>
    request<Transcript>(`/projects/${projectId}/transcripts/${transcriptId}`),
  submit: (projectId: string, data: TranscriptCreate) =>
    request<TranscriptSubmitResult>(`/projects/${projectId}/transcripts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ── Task Graph ─────────────────────────────────────────

export const tasks = {
  get: (projectId: string) => request<TaskNode[]>(`/projects/${projectId}/tasks`),
  update: (projectId: string, nodes: TaskNode[]) =>
    request<TaskNode[]>(`/projects/${projectId}/tasks`, {
      method: 'PUT',
      body: JSON.stringify(nodes),
    }),
  reset: (projectId: string) =>
    request<void>(`/projects/${projectId}/tasks/reset`, { method: 'POST' }),
}

// ── Pipeline ───────────────────────────────────────────

export const pipeline = {
  run: (projectId: string) =>
    request<{ job_id: string }>(`/projects/${projectId}/pipeline/run`, { method: 'POST' }),
  simulate: (projectId: string, toolEvalId: string) =>
    request<{ job_id: string }>(`/projects/${projectId}/pipeline/simulate`, {
      method: 'POST',
      body: JSON.stringify({ tool_evaluation_id: toolEvalId }),
    }),
}

// ── Tool Evaluations ───────────────────────────────────

export interface ToolEvaluation {
  id: string
  project_id: string
  use_case: string
  tool_name: string
  website_url: string | null
  created_at: string
}

export interface ToolEvaluationCreate {
  use_case: string
  tool_name: string
  website_url?: string
}

export const toolEvals = {
  list: (projectId: string) => request<ToolEvaluation[]>(`/projects/${projectId}/tools`),
  get: (projectId: string, evalId: string) =>
    request<ToolEvaluation>(`/projects/${projectId}/tools/${evalId}`),
  create: (projectId: string, data: ToolEvaluationCreate) =>
    request<ToolEvaluation>(`/projects/${projectId}/tools`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ── Simulation Results ─────────────────────────────────

export interface SimulationData {
  results_json: Record<string, unknown>
  tool_name: string
  n_simulations: number
  n_weeks: number
  final_work_saved_pct: number
  final_throughput_lift_pct: number
}

export const simulation = {
  get: (projectId: string, evalId: string) =>
    request<SimulationData>(`/projects/${projectId}/simulation/${evalId}`),
}

// ── Recommendation ─────────────────────────────────────

export interface RecommendationData {
  tool_name: string
  confidence_score: number
  summary: string
  employee_impact: {
    time_saved: { p10: number; p70: number }
    velocity_gain: { p10: number; p70: number }
    learning_weeks: string
  }
  company_impact: {
    throughput: { p10: number; p70: number }
    revenue_impact: { p10: number; p70: number }
    tool_cost: number
  }
  use_cases: Array<{ title: string; description: string }>
}

export const recommendation = {
  get: (projectId: string, evalId: string) =>
    request<RecommendationData>(`/projects/${projectId}/recommendation/${evalId}`),
}

// ── File Uploads ───────────────────────────────────────

export interface UploadedFile {
  id: string
  project_id: string
  file_type: string
  original_name: string
  storage_path: string
  size_bytes: number
  uploaded_at: string
}

export const uploads = {
  /** Upload a file via multipart/form-data */
  upload: async (
    projectId: string,
    file: File,
    fileType: string,
    toolEvalId?: string,
  ): Promise<UploadedFile> => {
    const form = new FormData()
    form.append('file', file)
    form.append('file_type', fileType)
    if (toolEvalId) form.append('tool_evaluation_id', toolEvalId)

    const res = await fetch(`${BASE}/projects/${projectId}/uploads`, {
      method: 'POST',
      body: form,
      // Do NOT set Content-Type — browser sets it with boundary for multipart
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Upload failed ${res.status}: ${body || res.statusText}`)
    }
    return res.json()
  },

  list: (projectId: string) => request<UploadedFile[]>(`/projects/${projectId}/uploads`),

  delete: (projectId: string, fileId: string) =>
    request<void>(`/projects/${projectId}/uploads/${fileId}`, { method: 'DELETE' }),
}

// ── Jobs ───────────────────────────────────────────────

export const jobs = {
  get: (jobId: string) => request<Job>(`/jobs/${jobId}`),
}

// ── Workflow Topology ──────────────────────────────────

export interface WorkflowTopology {
  positions: Record<string, { x: number; y: number }>
  edges: Array<Record<string, unknown>>
}

export const topology = {
  get: (projectId: string) =>
    request<WorkflowTopology>(`/projects/${projectId}/topology`),
  save: (projectId: string, data: WorkflowTopology) =>
    request<WorkflowTopology>(`/projects/${projectId}/topology`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}
