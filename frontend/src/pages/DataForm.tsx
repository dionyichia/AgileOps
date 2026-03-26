import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Loader2, CheckCircle2, ChevronDown } from 'lucide-react'
import StepLayout from '../components/layout/StepLayout'

const ROLES = [
  'Sales Development Representative (SDR)',
  'Account Executive (AE)',
  'Customer Success Manager',
  'Sales Manager / Director',
  'Marketing Manager',
  'Product Manager',
  'Software Engineer',
  'Data Analyst',
]

const ROLE_RESPONSIBILITIES: Record<string, string[]> = {
  'Sales Development Representative (SDR)': [
    'Prospecting & lead generation',
    'Cold calling',
    'Cold emailing & outreach sequences',
    'Qualifying inbound leads',
    'LinkedIn outreach & social selling',
    'CRM data entry & hygiene',
    'Scheduling discovery calls',
    'Follow-up cadence management',
    'Account & company research',
    'Objection handling',
  ],
  'Account Executive (AE)': [
    'Running discovery calls',
    'Product demonstrations',
    'Proposal & quote drafting',
    'Contract negotiation',
    'Stakeholder mapping',
    'Forecast management',
    'Objection handling & deal closing',
    'CRM opportunity management',
  ],
  'Customer Success Manager': [
    'Onboarding new customers',
    'QBR preparation & delivery',
    'Health score monitoring',
    'Renewal & expansion conversations',
    'Support ticket escalation',
    'Training & product adoption',
  ],
}

const DEFAULT_RESPONSIBILITIES = [
  'Daily task planning',
  'Internal meetings & collaboration',
  'Documentation & reporting',
  'Email & communication management',
  'Cross-functional coordination',
]

export default function DataForm() {
  const navigate = useNavigate()
  const [role, setRole] = useState('')
  const [loadingResponsibilities, setLoadingResponsibilities] = useState(false)
  const [responsibilities, setResponsibilities] = useState<string[]>([])
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([])
  const [tools, setTools] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!role) return
    setLoadingResponsibilities(true)
    setSelectedResponsibilities([])
    setResponsibilities([])
    // Simulate LLM response delay
    const timer = setTimeout(() => {
      const options = ROLE_RESPONSIBILITIES[role] ?? DEFAULT_RESPONSIBILITIES
      setResponsibilities(options)
      setLoadingResponsibilities(false)
    }, 1400)
    return () => clearTimeout(timer)
  }, [role])

  const toggleResponsibility = (r: string) => {
    setSelectedResponsibilities((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    )
  }

  const canSubmit = role && selectedResponsibilities.length > 0 && tools.trim().length > 0

  const handleNext = () => {
    localStorage.setItem('axisFormData', JSON.stringify({ role, selectedResponsibilities, tools, description }))
    navigate('/internal/workflow-report')
  }

  return (
    <StepLayout
      currentStep={1}
      title="Workflow Info"
      subtitle="Tell us about your team's role, responsibilities, and tools so we can map your workflow."
      onNext={handleNext}
      nextDisabled={!canSubmit}
      nextLabel="Generate Workflow Report"
      showBack={true}
    >
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Role selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-2">
            Assume Role <span className="text-gold">*</span>
          </label>
          <div className="relative">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full appearance-none bg-[#111827] border border-slate-700 hover:border-slate-600 focus:border-cerulean focus:outline-none text-white rounded-xl px-4 py-3 pr-10 text-sm transition-colors cursor-pointer"
            >
              <option value="">Select a role...</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Responsibilities */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-slate-200">
              Main Responsibilities <span className="text-gold">*</span>
            </label>
            {responsibilities.length > 0 && (
              <span className="text-xs text-gold bg-cerulean-500/10 px-2 py-0.5 rounded-full">
                AI-generated options
              </span>
            )}
          </div>

          {!role && (
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 text-center text-slate-500 text-sm">
              Select a role above to generate responsibility options
            </div>
          )}

          {role && loadingResponsibilities && (
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex items-center justify-center gap-3 text-slate-400 text-sm">
              <Loader2 size={16} className="animate-spin text-gold" />
              Generating responsibility options for {role.split('(')[0].trim()}...
            </div>
          )}

          {role && !loadingResponsibilities && responsibilities.length > 0 && (
            <div className="bg-[#111827] border border-slate-700 rounded-xl p-4 space-y-2">
              <p className="text-xs text-slate-500 mb-3">Select all that apply to your daily/weekly work:</p>
              {responsibilities.map((r) => {
                const selected = selectedResponsibilities.includes(r)
                return (
                  <button
                    key={r}
                    onClick={() => toggleResponsibility(r)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-all ${
                      selected
                        ? 'bg-cerulean-500/15 border border-cerulean-500/40 text-cerulean-200'
                        : 'bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
                      selected ? 'bg-cerulean border-cerulean-400' : 'border-slate-600'
                    }`}>
                      {selected && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                    {r}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Tools */}
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-1">
            What main SaaS tools do you use on a daily/weekly basis? <span className="text-gold">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-2">List all tools your team regularly uses (one per line or comma-separated)</p>
          <textarea
            value={tools}
            onChange={(e) => setTools(e.target.value)}
            placeholder="e.g. Salesforce, LinkedIn Sales Navigator, Outreach, Gmail, Slack, Zoom, Gong, ZoomInfo..."
            rows={4}
            className="w-full bg-[#111827] border border-slate-700 hover:border-slate-600 focus:border-cerulean focus:outline-none text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm resize-none transition-colors"
          />
        </div>

        {/* CSV Upload */}
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-1">
            1 week of telemetry data (CSV)
          </label>
          <p className="text-xs text-slate-500 mb-2">Time-series tracking what your team clicks and which tools they use</p>
          <label className="cursor-pointer block">
            <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              csvFile
                ? 'border-cerulean-500/60 bg-cerulean-500/5'
                : 'border-slate-700 hover:border-slate-600 bg-[#111827]'
            }`}>
              {csvFile ? (
                <div className="flex items-center justify-center gap-3 text-gold">
                  <CheckCircle2 size={20} />
                  <span className="text-sm font-medium">{csvFile.name}</span>
                  <span className="text-xs text-slate-500">({(csvFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <>
                  <Upload size={24} className="mx-auto mb-2 text-slate-500" />
                  <p className="text-sm text-slate-400">Drop your CSV here or <span className="text-gold underline">browse</span></p>
                  <p className="text-xs text-slate-600 mt-1">Accepts .csv files up to 10MB</p>
                </>
              )}
            </div>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {/* Optional description */}
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-1">
            How would you explain the workflow to a new hire?{' '}
            <span className="text-slate-500 font-normal">(Optional)</span>
          </label>
          <p className="text-xs text-slate-500 mb-2">Free-form description of how your team works day to day</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Walk us through a typical week. What does your team do first thing Monday morning? How do leads move through your process?..."
            rows={5}
            className="w-full bg-[#111827] border border-slate-700 hover:border-slate-600 focus:border-cerulean focus:outline-none text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm resize-none transition-colors"
          />
        </div>

      </div>
    </StepLayout>
  )
}
