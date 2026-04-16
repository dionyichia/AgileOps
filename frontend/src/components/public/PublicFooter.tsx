import { useNavigate } from 'react-router-dom'

export default function PublicFooter() {
  const navigate = useNavigate()

  return (
    <footer className="mt-16 md:mt-24 bg-black px-8 pb-16 pt-24 text-white md:px-16 lg:px-24">
      <div>
        <div className="grid gap-16 lg:grid-cols-[1fr_2fr_1.1fr] lg:gap-24">
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/axis-logo.png"
                alt="Axis logo"
                className="h-11 w-11 rounded-2xl object-cover"
              />
              <span className="text-[22px] font-bold">Axis</span>
            </div>
            <p className="mt-6 max-w-xs text-[15px] leading-7 text-white/70 text-balance">
              We help revenue teams evaluate and select the right tools by
              analyzing real workflows and delivering data-backed
              recommendations.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-16 gap-y-10 lg:grid-cols-4">
            {[
              {
                title: 'Product',
                items: [
                  'How It Works',
                  'Workflow Analysis',
                  'Tool Evaluation',
                  'Recommendations',
                  'Sample Report',
                ],
              },
              {
                title: 'Company',
                items: ['About', 'Why Axis', 'Contact'],
              },
              {
                title: 'Resources',
                items: ['FAQs', 'Case Studies', 'Documentation'],
              },
              {
                title: 'Legal',
                items: ['Privacy Policy', 'Terms of Service', 'Security'],
              },
            ].map((group) => (
              <div key={group.title}>
                <h3 className="mb-5 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  {group.title}
                </h3>
                <ul className="space-y-0">
                  {group.items.map((item) => (
                    <li
                      key={item}
                      className="cursor-pointer text-[15px] leading-8 text-white/70 transition-colors hover:text-white"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="min-w-[280px] rounded-[24px] border border-white/[0.12] bg-white/[0.06] px-8 py-8 backdrop-blur-sm">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/50">
              Get Started
            </p>
            <h3 className="mt-4 text-[28px] font-bold leading-tight text-white text-balance">
              Make your next tool decision with confidence.
            </h3>
            <button
              onClick={() => navigate('/get-started')}
              className="mt-6 w-full rounded-full bg-white py-4 text-[15px] font-bold text-black transition-transform hover:-translate-y-0.5"
            >
              Get My Recommendation
            </button>
          </div>
        </div>

        <div className="mt-20 border-t border-white/[0.12] pt-6 text-[13px] text-white/40">
          © 2026 Axis. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
