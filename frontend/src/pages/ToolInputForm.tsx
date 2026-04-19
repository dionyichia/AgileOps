import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { Upload, Link2, FileText, Globe, Briefcase, CheckCircle2, Loader2, ArrowRight, ChevronLeft } from 'lucide-react'
import StepLayout from '../components/layout/StepLayout'
import ClientWorkspaceShell from '../components/workspace/ClientWorkspaceShell'
import { toolEvals, pipeline as pipelineApi, uploads } from '../api/client'
import { getToolDraft, upsertToolDraft, type ToolDraft, type SerializedFileEntry } from '../lib/toolDraftStorage'

type UseCase = 'adoption' | 'compare'

interface FileEntry {
  file: File | null
  link: string
}

const emptyFile = (): FileEntry => ({ file: null, link: '' })

function serializeFileEntry(entry: FileEntry): SerializedFileEntry {
  return { link: entry.link, fileName: entry.file?.name ?? null }
}

function deserializeFileEntry(saved: SerializedFileEntry): FileEntry {
  return { link: saved.link, file: null }
}

export default function ToolInputForm() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const draftParam = searchParams.get('draft')
  const isClientToolInput = pathname === '/toolinput'
  const [useCase, setUseCase] = useState<UseCase>('adoption')
  const [toolName, setToolName] = useState('')
  const [docs, setDocs] = useState<FileEntry>(emptyFile())
  const [api, setApi] = useState<FileEntry>(emptyFile())
  const [website, setWebsite] = useState('')
  const [caseStudies, setCaseStudies] = useState<FileEntry>(emptyFile())
  const [pitchDeck, setPitchDeck] = useState<FileEntry>(emptyFile())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isClientToolInput || !draftParam) return
    const d = getToolDraft(draftParam)
    if (!d) return
    setUseCase(d.useCase)
    setToolName(d.toolName)
    setWebsite(d.website)
    setDocs(deserializeFileEntry(d.docs))
    setApi(deserializeFileEntry(d.api))
    setCaseStudies(deserializeFileEntry(d.caseStudies))
    setPitchDeck(deserializeFileEntry(d.pitchDeck))
  }, [isClientToolInput, draftParam])

  const handleFile = (setter: (v: FileEntry) => void, current: FileEntry) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setter({ ...current, file: e.target.files?.[0] ?? null })

  const canSubmit = toolName.trim().length > 0 && (
    docs.file || docs.link || api.file || website || caseStudies.file || pitchDeck.file
  ) && !submitting

  const canSaveDraft =
    isClientToolInput &&
    !submitting &&
    (toolName.trim().length > 0 ||
      website.trim().length > 0 ||
      Boolean(docs.link || api.link || caseStudies.link || pitchDeck.link) ||
      Boolean(docs.file || api.file || caseStudies.file || pitchDeck.file))

  const handleSaveDraft = () => {
    if (!canSaveDraft) return
    const id = draftParam ?? `draft-${Date.now()}`
    const draft: ToolDraft = {
      id,
      savedAt: new Date().toISOString(),
      useCase,
      toolName: toolName.trim(),
      website: website.trim(),
      docs: serializeFileEntry(docs),
      api: serializeFileEntry(api),
      caseStudies: serializeFileEntry(caseStudies),
      pitchDeck: serializeFileEntry(pitchDeck),
    }
    upsertToolDraft(draft)
    if (!draftParam) setSearchParams({ draft: id }, { replace: true })
  }

  const handleNext = async () => {
    // Always save to localStorage for legacy route compatibility
    localStorage.setItem('axisToolInput', JSON.stringify({ useCase, toolName, website }))

    if (projectId) {
      // Project-scoped: save to API, upload files, trigger simulation, navigate
      setSubmitting(true)
      try {
        const toolEval = await toolEvals.create(projectId, {
          use_case: useCase,
          tool_name: toolName.trim(),
          website_url: website || undefined,
        })

        // Upload any attached files in parallel
        const fileUploads: Promise<unknown>[] = []
        if (pitchDeck.file) fileUploads.push(uploads.upload(projectId, pitchDeck.file, 'product_docs', toolEval.id))
        if (docs.file) fileUploads.push(uploads.upload(projectId, docs.file, 'product_docs', toolEval.id))
        if (api.file) fileUploads.push(uploads.upload(projectId, api.file, 'api_docs', toolEval.id))
        if (caseStudies.file) fileUploads.push(uploads.upload(projectId, caseStudies.file, 'case_study', toolEval.id))
        if (fileUploads.length > 0) {
          await Promise.all(fileUploads)
        }

        const { job_id } = await pipelineApi.simulate(projectId, toolEval.id)
        navigate(`/projects/${projectId}/dashboard`, {
          state: { openTab: toolEval.id, jobId: job_id },
        })
      } catch (err) {
        console.error('Failed to create tool evaluation:', err)
        navigate(`/projects/${projectId}/dashboard`)
      } finally {
        setSubmitting(false)
      }
    } else {
      navigate(projectId ? `/projects/${projectId}/dashboard` : '/dashboard')
    }
  }

  const layout = (
    <StepLayout
      currentStep={3}
      title={isClientToolInput ? '' : 'Tool Input'}
      subtitle={
        isClientToolInput
          ? ''
          : 'Provide information about the tool you want to analyze. Axis will run a simulation against your workflow.'
      }
      onNext={handleNext}
      nextDisabled={!canSubmit}
      nextLabel="Run Simulation"
      compact={isClientToolInput}
      nested={isClientToolInput}
      hideNextButton={isClientToolInput}
      backPath={isClientToolInput ? '/dashboard' : undefined}
    >
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Use Case */}
        <div>
          <label className="block text-sm font-semibold text-black/42 mb-3">Use Case</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'adoption' as UseCase, label: 'Increase adoption of existing tool', icon: CheckCircle2, desc: 'Understand how to get your team to use a tool you already pay for.' },
              { id: 'compare'  as UseCase, label: 'Compare tools for a use case',       icon: Briefcase,    desc: 'Evaluate multiple tools side-by-side for a specific need.' },
            ].map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                onClick={() => setUseCase(id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  useCase === id
                    ? 'border-[#5E149F]/25 bg-white'
                    : 'border-black/8 bg-white hover:border-black/14'
                }`}
                style={{
                  boxShadow: useCase === id ? '0 20px 40px rgba(94,20,159,0.10)' : '0 14px 28px rgba(15,23,42,0.04)',
                  background: useCase === id
                    ? 'linear-gradient(180deg, #FFFFFF 0%, #FCF7FF 100%)'
                    : 'linear-gradient(180deg, #FFFFFF 0%, #FFF8FC 100%)',
                }}
              >
                <Icon size={18} className={useCase === id ? 'text-[#F75A8C] mb-2' : 'text-black/32 mb-2'} />
                <div className={`text-sm font-semibold mb-1 ${useCase === id ? 'text-[#5E149F]' : 'text-black'}`}>{label}</div>
                <div className="text-xs text-black/52 leading-snug">{desc}</div>
                {id === 'adoption' && (
                  <span className="inline-block mt-2 text-[10px] font-bold tracking-widest text-[#B4308B] bg-[#FCEAF4] border border-[#B4308B]/12 px-2 py-1 rounded-full">
                    RECOMMENDED
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tool name */}
        <div>
          <label className="block text-sm font-semibold text-black/72 mb-2">
            Tool Name <span className="text-[#F75A8C]">*</span>
          </label>
          <input
            type="text"
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
            placeholder="e.g. Apollo.io, Gong, Seismic..."
            className="w-full bg-white border border-black/8 hover:border-black/14 focus:border-[#B4308B]/40 focus:outline-none text-black placeholder:text-black/28 rounded-xl px-4 py-3 text-sm transition-colors"
            style={{ boxShadow: '0 14px 28px rgba(15,23,42,0.04)' }}
          />
        </div>

        {/* Website domain */}
        <UploadField
          label="Website Domain"
          required={false}
          icon={Globe}
          hint="Axis will scrape the product site for feature info"
        >
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://apollo.io"
            className="w-full bg-white border border-black/8 hover:border-black/14 focus:border-[#B4308B]/40 focus:outline-none text-black placeholder:text-black/28 rounded-xl px-3 py-2.5 text-sm transition-colors"
            style={{ boxShadow: '0 14px 28px rgba(15,23,42,0.04)' }}
          />
        </UploadField>

        {/* Product documentation */}
        <UploadField label="Product Documentation / Pitch Deck" icon={FileText} hint="PDF or link to product docs, one-pager, or pitch deck">
          <DualInput entry={pitchDeck} setter={setPitchDeck} onFile={handleFile(setPitchDeck, pitchDeck)} accept=".pdf,.pptx,.docx" placeholder="https://docs.apollo.io or paste link..." />
        </UploadField>

        {/* API documentation */}
        <UploadField label="API Documentation" icon={Link2} hint="PDF or link to API/integration docs">
          <DualInput entry={api} setter={setApi} onFile={handleFile(setApi, api)} accept=".pdf,.html,.txt" placeholder="https://developer.apollo.io..." />
        </UploadField>

        {/* Case studies */}
        <UploadField label="Case Studies" icon={Briefcase} hint="Customer success stories or ROI reports from similar companies">
          <DualInput entry={caseStudies} setter={setCaseStudies} onFile={handleFile(setCaseStudies, caseStudies)} accept=".pdf,.docx" placeholder="Paste link to case study..." />
        </UploadField>

        {isClientToolInput && (
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={!canSaveDraft}
              className="order-2 inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-semibold text-black/72 transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40 sm:order-1"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => void handleNext()}
              disabled={!canSubmit}
              className="order-1 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/30 sm:order-2"
              style={
                canSubmit
                  ? { background: 'linear-gradient(90deg, #5E149F 0%, #F75A8C 100%)', boxShadow: '0 12px 24px rgba(94,20,159,0.14)' }
                  : undefined
              }
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  Run Simulation
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </StepLayout>
  )

  if (isClientToolInput) {
    return (
      <ClientWorkspaceShell
        headerLeft={
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => navigate(projectId ? `/projects/${projectId}/dashboard` : '/dashboard')}
              className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 text-black/70 transition-colors hover:bg-black/[0.03]"
              aria-label="Back to dashboard"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-black md:text-3xl">Add new tool</h1>
              <p className="mt-1 text-sm text-black/55">
                Provide details about the tool. Axis will run a simulation against your workflow.
              </p>
            </div>
          </div>
        }
      >
        <main className="flex-1 bg-[#F7F4FB]">
          <div className="mx-auto max-w-7xl px-6 py-8">{layout}</div>
        </main>
      </ClientWorkspaceShell>
    )
  }

  return layout
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function UploadField({
  label,
  required = false,
  icon: Icon,
  hint,
  children,
}: {
  label: string
  required?: boolean
  icon: React.ElementType
  hint: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-black/34" />
        <label className="text-sm font-semibold text-black/72">
          {label}
          {required && <span className="text-[#F75A8C] ml-1">*</span>}
          {!required && <span className="text-black/38 font-normal ml-1">(Optional)</span>}
        </label>
      </div>
      <p className="text-xs text-black/48 mb-2">{hint}</p>
      {children}
    </div>
  )
}

function DualInput({
  entry,
  setter,
  onFile,
  accept,
  placeholder,
}: {
  entry: FileEntry
  setter: (v: FileEntry) => void
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  accept: string
  placeholder: string
}) {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={entry.link}
        onChange={(e) => setter({ ...entry, link: e.target.value })}
        placeholder={placeholder}
        className="flex-1 bg-white border border-black/8 hover:border-black/14 focus:border-[#B4308B]/40 focus:outline-none text-black placeholder:text-black/28 rounded-xl px-3 py-2.5 text-sm transition-colors"
        style={{ boxShadow: '0 14px 28px rgba(15,23,42,0.04)' }}
      />
      <label className="cursor-pointer">
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
          entry.file
            ? 'border-[#B4308B]/25 bg-[#FCEAF4] text-[#B4308B]'
            : 'border-black/8 bg-white text-black/56 hover:border-black/14 hover:text-black/72'
        }`}>
          <Upload size={14} />
          {entry.file ? entry.file.name.slice(0, 12) + '…' : 'Upload'}
        </div>
        <input type="file" accept={accept} className="hidden" onChange={onFile} />
      </label>
    </div>
  )
}
