import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Upload, Link2, FileText, Globe, Briefcase, CheckCircle2, Loader2 } from 'lucide-react'
import StepLayout from '../components/layout/StepLayout'
import { toolEvals, pipeline as pipelineApi, uploads } from '../api/client'

type UseCase = 'adoption' | 'compare'

interface FileEntry {
  file: File | null
  link: string
}

const emptyFile = (): FileEntry => ({ file: null, link: '' })

export default function ToolInputForm() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [useCase, setUseCase] = useState<UseCase>('adoption')
  const [toolName, setToolName] = useState('')
  const [docs, setDocs] = useState<FileEntry>(emptyFile())
  const [api, setApi] = useState<FileEntry>(emptyFile())
  const [website, setWebsite] = useState('')
  const [caseStudies, setCaseStudies] = useState<FileEntry>(emptyFile())
  const [pitchDeck, setPitchDeck] = useState<FileEntry>(emptyFile())
  const [submitting, setSubmitting] = useState(false)

  const handleFile = (setter: (v: FileEntry) => void, current: FileEntry) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setter({ ...current, file: e.target.files?.[0] ?? null })

  const canSubmit = toolName.trim().length > 0 && (
    docs.file || docs.link || api.file || website || caseStudies.file || pitchDeck.file
  ) && !submitting

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
        navigate(`/projects/${projectId}/simulation/${toolEval.id}`, {
          state: { jobId: job_id },
        })
      } catch (err) {
        console.error('Failed to create tool evaluation:', err)
        navigate('/simulation')
      } finally {
        setSubmitting(false)
      }
    } else {
      navigate('/simulation')
    }
  }

  return (
    <StepLayout
      currentStep={3}
      title="Tool Input"
      subtitle="Provide information about the tool you want to analyze. Axis will run a simulation against your workflow."
      onNext={handleNext}
      nextDisabled={!canSubmit}
      nextLabel="Run Simulation"
    >
      <div className="max-w-2xl mx-auto space-y-8">

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

      </div>
    </StepLayout>
  )
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
