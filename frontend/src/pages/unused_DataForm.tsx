import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ChevronDown } from 'lucide-react'

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
  ],
  'Account Executive (AE)': [
    'Running discovery calls',
    'Product demonstrations',
    'Proposal & quote drafting',
    'Contract negotiation',
    'Stakeholder mapping',
    'Forecast management',
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
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [loadingResponsibilities, setLoadingResponsibilities] = useState(false)
  const [responsibilities, setResponsibilities] = useState<string[]>([])
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([])
  const [tools, setTools] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!role) return
    setLoadingResponsibilities(true)
    setSelectedResponsibilities([])
    setResponsibilities([])
    const timer = setTimeout(() => {
      const options = ROLE_RESPONSIBILITIES[role] ?? DEFAULT_RESPONSIBILITIES
      setResponsibilities(options)
      setLoadingResponsibilities(false)
    }, 700)
    return () => clearTimeout(timer)
  }, [role])

  const toggleResponsibility = (r: string) => {
    setSelectedResponsibilities((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    )
  }

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    role &&
    selectedResponsibilities.length > 0 &&
    description.trim().length > 0

  const handleNext = () => {
    localStorage.setItem(
      'axisFormData',
      JSON.stringify({
        firstName,
        lastName,
        email,
        role,
        selectedResponsibilities,
        tools,
        description,
      }),
    )
    navigate('/internal/workflow-report')
  }

  const inputClass =
    'w-full rounded-[18px] border border-black/10 bg-[#F6F6F6] px-5 py-4 text-[15px] text-black outline-none transition-colors placeholder:text-black/35 focus:border-[#B4308B]'

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-black/5 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg font-bold"
              style={{ background: 'linear-gradient(180deg, #5E149F 0%, #F75A8C 100%)' }}
            >
              A
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-10 text-[16px] font-medium">
            <button onClick={() => navigate('/')} className="transition-opacity hover:opacity-70">Why Axis?</button>
            <button onClick={() => navigate('/')} className="transition-opacity hover:opacity-70">How it Works</button>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="hidden md:inline text-[16px] font-medium transition-opacity hover:opacity-70"
            >
              Client Login
            </button>
            <button className="axis-gradient-button rounded-full px-6 py-3 text-[16px] font-bold">
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 md:px-10 py-12 md:py-16">
        <div className="max-w-7xl mx-auto grid gap-12 lg:grid-cols-[0.95fr_1.05fr] items-start">
          <section className="pt-6 md:pt-16">
            <p className="max-w-xl text-[24px] leading-[1.35] font-medium text-black/84">
              Tell us about your team, your workflow, and the tools you&apos;re currently using. We&apos;ll analyze your setup and prepare a tailored recommendation through your consultation.
            </p>

            <ul className="mt-12 space-y-5">
              {[
                'A consultation tailored to your current workflow',
                'A clearer view of where your team loses time today',
                'Recommendations based on your stack and process',
                'A practical starting point for your workflow audit',
              ].map((item) => (
                <li key={item} className="flex items-start gap-4">
                  <span
                    className="mt-1 flex h-6 w-6 items-center justify-center rounded-full text-white"
                    style={{ background: 'linear-gradient(180deg, #B4308B 0%, #F75A8C 100%)' }}
                  >
                    <CheckCircle2 size={14} />
                  </span>
                  <span className="text-[17px] leading-7 text-black/70">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-white rounded-[28px] p-7 md:p-9 axis-soft-shadow border border-black/5">
            <h1 className="text-center text-[36px] leading-tight font-bold">Book a Consultation</h1>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <input
                className={inputClass}
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <input
                className={inputClass}
                placeholder="Work Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="mt-4 relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={`${inputClass} appearance-none pr-12 cursor-pointer`}
              >
                <option value="">Your Team Role</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-black/45 pointer-events-none" />
            </div>

            <div className="mt-4">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your workflow, key challenges, and what you want to improve."
                rows={6}
                className={`${inputClass} min-h-[170px] resize-none`}
              />
            </div>

            <div className="mt-4">
              <textarea
                value={tools}
                onChange={(e) => setTools(e.target.value)}
                placeholder="Current tools you're using (optional)"
                rows={4}
                className={`${inputClass} min-h-[120px] resize-none`}
              />
            </div>

            {role && (
              <div className="mt-5 rounded-[22px] border border-black/6 bg-[#FAFAFA] p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[14px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#5E149F' }}>
                    Team Responsibilities
                  </p>
                  {responsibilities.length > 0 && (
                    <span className="text-[13px] font-medium text-black/45">
                      Select all that apply
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {loadingResponsibilities && (
                    <p className="text-[15px] text-black/55">Loading recommendations...</p>
                  )}

                  {!loadingResponsibilities && responsibilities.map((r) => {
                    const selected = selectedResponsibilities.includes(r)
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleResponsibility(r)}
                        className="rounded-full border px-4 py-2 text-[14px] font-medium transition-colors"
                        style={{
                          borderColor: selected ? '#B4308B' : 'rgba(0,0,0,0.08)',
                          background: selected ? 'rgba(180, 48, 139, 0.10)' : '#FFFFFF',
                          color: selected ? '#5E149F' : 'rgba(0,0,0,0.72)',
                        }}
                      >
                        {r}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={handleNext}
                disabled={!canSubmit}
                className="axis-gradient-button rounded-full px-10 py-4 text-[18px] font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
