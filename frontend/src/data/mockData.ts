import type { Node, Edge } from 'reactflow'


// This is pulled after user input the first survey form

export const roleStats = {
  teamType: 'Sales',
  role: 'Sales Development Representative (SDR)',
  numEmployees: 24,
  avgToolsUsed: 8.3,
  avgWeeklyHours: 42.5,
}

// This is pulled after parsing telemetry data
// Each tool has features — some used by the team, some not (underutilized)

export interface ToolFeature {
  name: string
  used: boolean
  workflowStep?: string       // which workflow step it could help
  potentialTimeSaved?: number  // minutes per occurrence
  description: string
}

export interface Tool {
  name: string
  pctUsers: number
  hoursPerWeek: number
  intensity: 'High' | 'Medium' | 'Low'
  utilization: number // 0–100, % of features the team actually uses
  features: ToolFeature[]
}

export interface ToolBucket {
  category: string
  color: string
  tools: Tool[]
}

export const toolBuckets: ToolBucket[] = [
  {
    category: 'CRM',
    color: 'indigo',
    tools: [
      {
        name: 'Salesforce', pctUsers: 92, hoursPerWeek: 8.4, intensity: 'High', utilization: 38,
        features: [
          { name: 'Contact & Account Management', used: true, description: 'Basic CRM record keeping' },
          { name: 'Activity Logging', used: true, description: 'Manual call/email logging' },
          { name: 'Opportunity Tracking', used: true, description: 'Pipeline stage management' },
          { name: 'Lead Scoring (Einstein)', used: false, workflowStep: 'Prospect Research', potentialTimeSaved: 12, description: 'AI-powered lead prioritization based on engagement signals and fit score' },
          { name: 'Auto-Activity Capture', used: false, workflowStep: 'Send & Log Activity', potentialTimeSaved: 6, description: 'Automatically logs emails, calls, and meetings — eliminates manual data entry' },
          { name: 'Workflow Rules & Automation', used: false, workflowStep: 'Follow-Up Sequence', potentialTimeSaved: 8, description: 'Auto-assign tasks, send alerts, and update fields based on deal stage changes' },
          { name: 'Reports & Dashboards', used: false, workflowStep: 'Discovery Call Prep', potentialTimeSaved: 10, description: 'Pre-built pipeline reports and engagement dashboards for call prep' },
          { name: 'Email Templates', used: false, workflowStep: 'Draft Outreach Message', potentialTimeSaved: 5, description: 'Reusable email templates with merge fields for faster personalized outreach' },
        ],
      },
      {
        name: 'HubSpot', pctUsers: 21, hoursPerWeek: 2.1, intensity: 'Low', utilization: 25,
        features: [
          { name: 'Contact Management', used: true, description: 'Basic contact database' },
          { name: 'Sequences', used: false, workflowStep: 'Follow-Up Sequence', potentialTimeSaved: 10, description: 'Automated multi-step email sequences with personalization tokens' },
          { name: 'Meeting Scheduler', used: false, workflowStep: 'Discovery Call Prep', potentialTimeSaved: 5, description: 'Shareable booking links synced to your calendar' },
          { name: 'Prospect Tracking', used: false, workflowStep: 'Inbound Response Triage', potentialTimeSaved: 7, description: 'Real-time notifications when prospects open emails or visit your site' },
        ],
      },
    ],
  },
  {
    category: 'Sales Engagement',
    color: 'violet',
    tools: [
      {
        name: 'Outreach', pctUsers: 78, hoursPerWeek: 5.2, intensity: 'High', utilization: 45,
        features: [
          { name: 'Sequence Builder', used: true, description: 'Multi-step outreach cadences' },
          { name: 'Email Send & Track', used: true, description: 'Send and track email opens/clicks' },
          { name: 'A/B Testing', used: false, workflowStep: 'Draft Outreach Message', potentialTimeSaved: 8, description: 'Test subject lines and messaging to find what converts — stop guessing' },
          { name: 'Smart Send Windows', used: false, workflowStep: 'Send & Log Activity', potentialTimeSaved: 3, description: 'Auto-deliver emails when prospects are most likely to engage' },
          { name: 'Trigger-Based Sequences', used: false, workflowStep: 'Inbound Response Triage', potentialTimeSaved: 6, description: 'Auto-enroll prospects into sequences based on behavior (e.g., website visit, email reply)' },
          { name: 'Analytics & Reports', used: false, workflowStep: 'Follow-Up Sequence', potentialTimeSaved: 4, description: 'Sequence performance metrics to optimize cadence timing and messaging' },
        ],
      },
      {
        name: 'Apollo.io', pctUsers: 34, hoursPerWeek: 1.8, intensity: 'Medium', utilization: 20,
        features: [
          { name: 'Contact Search', used: true, description: 'Basic prospect database lookups' },
          { name: 'AI Lead Scoring', used: false, workflowStep: 'Prospect Research', potentialTimeSaved: 14, description: 'AI-powered ICP fit scoring and buying intent signals' },
          { name: 'Auto-Sequences', used: false, workflowStep: 'Follow-Up Sequence', potentialTimeSaved: 10, description: 'Automated multi-channel sequences (email + LinkedIn + calls)' },
          { name: 'AI Email Writer', used: false, workflowStep: 'Draft Outreach Message', potentialTimeSaved: 12, description: 'Generate personalized first drafts using prospect context and job changes' },
          { name: 'Data Enrichment', used: false, workflowStep: 'Prospect Research', potentialTimeSaved: 8, description: 'Auto-enrich Salesforce records from 265M+ contact database' },
        ],
      },
    ],
  },
  {
    category: 'Intelligence',
    color: 'cyan',
    tools: [
      {
        name: 'LinkedIn Sales Nav', pctUsers: 88, hoursPerWeek: 4.6, intensity: 'High', utilization: 50,
        features: [
          { name: 'Lead Search', used: true, description: 'Advanced people search with filters' },
          { name: 'InMail Messaging', used: true, description: 'Direct messages to non-connections' },
          { name: 'Saved Searches & Alerts', used: false, workflowStep: 'Prospect Research', potentialTimeSaved: 10, description: 'Auto-notify when new prospects match your ICP filters — no manual re-searching' },
          { name: 'TeamLink', used: false, workflowStep: 'Discovery Call Prep', potentialTimeSaved: 5, description: 'See warm intro paths through your company\'s network' },
          { name: 'CRM Sync', used: false, workflowStep: 'Send & Log Activity', potentialTimeSaved: 4, description: 'Auto-sync InMail activity and lead data back to Salesforce' },
          { name: 'Buyer Intent', used: false, workflowStep: 'Prospect Research', potentialTimeSaved: 8, description: 'See which accounts are researching topics relevant to your product' },
        ],
      },
      {
        name: 'ZoomInfo', pctUsers: 61, hoursPerWeek: 2.9, intensity: 'Medium', utilization: 35,
        features: [
          { name: 'Contact Lookup', used: true, description: 'Phone and email lookup' },
          { name: 'Company Profiles', used: true, description: 'Firmographic data' },
          { name: 'Intent Data', used: false, workflowStep: 'Prospect Research', potentialTimeSaved: 9, description: 'See which companies are actively researching your solution category' },
          { name: 'Org Charts', used: false, workflowStep: 'Discovery Call Prep', potentialTimeSaved: 7, description: 'Map the buying committee before the call — know who else to loop in' },
          { name: 'Workflows (Auto-Enrich)', used: false, workflowStep: 'Send & Log Activity', potentialTimeSaved: 4, description: 'Auto-enrich new leads in Salesforce with verified contact data' },
        ],
      },
    ],
  },
  {
    category: 'Communication',
    color: 'emerald',
    tools: [
      {
        name: 'Gmail', pctUsers: 100, hoursPerWeek: 9.1, intensity: 'High', utilization: 55,
        features: [
          { name: 'Email Compose & Reply', used: true, description: 'Core email functionality' },
          { name: 'Labels & Filters', used: true, description: 'Basic organization' },
          { name: 'Templates', used: false, workflowStep: 'Draft Outreach Message', potentialTimeSaved: 6, description: 'Canned responses for common outreach patterns — one click instead of rewriting' },
          { name: 'Schedule Send', used: false, workflowStep: 'Send & Log Activity', potentialTimeSaved: 2, description: 'Queue emails to send at optimal times' },
          { name: 'Priority Inbox', used: false, workflowStep: 'Inbound Response Triage', potentialTimeSaved: 5, description: 'Auto-surface important prospect replies above noise' },
        ],
      },
      {
        name: 'Slack', pctUsers: 96, hoursPerWeek: 3.7, intensity: 'Medium', utilization: 60,
        features: [
          { name: 'Channels & DMs', used: true, description: 'Team communication' },
          { name: 'Huddles', used: true, description: 'Quick audio/video calls' },
          { name: 'Workflow Builder', used: false, workflowStep: 'Inbound Response Triage', potentialTimeSaved: 5, description: 'Auto-route inbound lead notifications to the right rep' },
          { name: 'Salesforce Integration', used: false, workflowStep: 'Send & Log Activity', potentialTimeSaved: 3, description: 'Get deal updates and close alerts directly in Slack channels' },
        ],
      },
    ],
  },
  {
    category: 'Meeting & Recording',
    color: 'amber',
    tools: [
      {
        name: 'Zoom', pctUsers: 90, hoursPerWeek: 3.2, intensity: 'High', utilization: 65,
        features: [
          { name: 'Video Meetings', used: true, description: 'Standard video calls' },
          { name: 'Screen Share', used: true, description: 'Share presentations and demos' },
          { name: 'AI Companion', used: false, workflowStep: 'Discovery Call Execution', potentialTimeSaved: 10, description: 'Auto-generate meeting summaries, action items, and next steps' },
          { name: 'Clips (Async Video)', used: false, workflowStep: 'Follow-Up Sequence', potentialTimeSaved: 5, description: 'Record short personalized video messages for follow-ups' },
        ],
      },
      {
        name: 'Gong.io', pctUsers: 28, hoursPerWeek: 0.9, intensity: 'Low', utilization: 15,
        features: [
          { name: 'Call Recording', used: true, description: 'Records discovery calls' },
          { name: 'Deal Intelligence', used: false, workflowStep: 'Discovery Call Prep', potentialTimeSaved: 12, description: 'AI analyzes past calls to surface deal risks and coaching moments' },
          { name: 'Talk Pattern Analytics', used: false, workflowStep: 'Discovery Call Execution', potentialTimeSaved: 8, description: 'Track talk-to-listen ratio, questions asked, and competitor mentions' },
          { name: 'Forecast Intelligence', used: false, workflowStep: 'Follow-Up Sequence', potentialTimeSaved: 6, description: 'AI-based pipeline forecasting using actual conversation signals' },
          { name: 'Smart Trackers', used: false, workflowStep: 'Inbound Response Triage', potentialTimeSaved: 4, description: 'Auto-flag calls mentioning competitors, pricing objections, or churn signals' },
        ],
      },
      {
        name: 'Calendly', pctUsers: 71, hoursPerWeek: 1.1, intensity: 'Low', utilization: 50,
        features: [
          { name: 'Booking Pages', used: true, description: 'Self-serve meeting scheduling' },
          { name: 'Round-Robin Routing', used: false, workflowStep: 'Inbound Response Triage', potentialTimeSaved: 4, description: 'Auto-distribute inbound demo requests across available reps' },
          { name: 'Salesforce Integration', used: false, workflowStep: 'Discovery Call Prep', potentialTimeSaved: 3, description: 'Auto-create Salesforce events and update opportunity fields on booking' },
        ],
      },
    ],
  },
  {
    category: 'Content & Notes',
    color: 'rose',
    tools: [
      {
        name: 'Notion', pctUsers: 55, hoursPerWeek: 2.3, intensity: 'Medium', utilization: 30,
        features: [
          { name: 'Notes & Docs', used: true, description: 'Meeting notes and playbooks' },
          { name: 'Templates', used: false, workflowStep: 'Discovery Call Prep', potentialTimeSaved: 8, description: 'Pre-built discovery call templates with auto-filled prospect data' },
          { name: 'Databases', used: false, workflowStep: 'Prospect Research', potentialTimeSaved: 5, description: 'Track prospect research and competitive intel in structured views' },
          { name: 'AI Assist', used: false, workflowStep: 'Draft Outreach Message', potentialTimeSaved: 7, description: 'AI-generated meeting summaries and email drafts from your notes' },
        ],
      },
      {
        name: 'Google Docs', pctUsers: 80, hoursPerWeek: 2.7, intensity: 'Medium', utilization: 45,
        features: [
          { name: 'Document Editing', used: true, description: 'Proposals and shared docs' },
          { name: 'Smart Chips', used: true, description: 'Inline dates, people, and file references' },
          { name: 'Template Gallery', used: false, workflowStep: 'Draft Outreach Message', potentialTimeSaved: 4, description: 'Standardized proposal and case study templates' },
        ],
      },
    ],
  },
]


// This is pulled after running the build markov script and obtaining the node domains, node duration, edge list, edge dwell
// ─── Workflow diagram: existing ───────────────────────────────────────────────

export const existingNodes: Node[] = [
  {
    id: 'prospect-research',
    type: 'taskNode',
    position: { x: 240, y: 0 },
    data: { label: 'Prospect Research', tools: ['LinkedIn', 'Salesforce', 'ZoomInfo'], minutes: 35, automatable: 'high' },
  },
  {
    id: 'draft-outreach',
    type: 'taskNode',
    position: { x: 240, y: 190 },
    data: { label: 'Draft Outreach Message', tools: ['Gmail', 'Notion'], minutes: 24, automatable: 'high' },
  },
  {
    id: 'send-log',
    type: 'taskNode',
    position: { x: 240, y: 380 },
    data: { label: 'Send & Log Activity', tools: ['Gmail', 'Salesforce'], minutes: 8, automatable: 'medium' },
  },
  {
    id: 'follow-up',
    type: 'taskNode',
    position: { x: 240, y: 570 },
    data: { label: 'Follow-Up Sequence', tools: ['Outreach', 'Gmail', 'Salesforce'], minutes: 18, automatable: 'high' },
  },
  {
    id: 'response-triage',
    type: 'taskNode',
    position: { x: 240, y: 760 },
    data: { label: 'Inbound Response Triage', tools: ['Gmail', 'Salesforce', 'Slack'], minutes: 14, automatable: 'medium' },
  },
  {
    id: 'discovery-prep',
    type: 'taskNode',
    position: { x: 240, y: 950 },
    data: { label: 'Discovery Call Prep', tools: ['Salesforce', 'Notion', 'Gong'], minutes: 42, automatable: 'high' },
  },
  {
    id: 'discovery-call',
    type: 'taskNode',
    position: { x: 240, y: 1140 },
    data: { label: 'Discovery Call Execution', tools: ['Zoom', 'Gong', 'Calendly'], minutes: 38, automatable: 'low' },
  },
  // terminal nodes
  { id: 'not-qualified', type: 'terminalNode', position: { x: 600, y: 10 }, data: { label: 'Not Qualified', nodeType: 'fail' } },
  { id: 'unsubscribed', type: 'terminalNode', position: { x: 600, y: 580 }, data: { label: 'Unsubscribed', nodeType: 'fail' } },
  { id: 'cold', type: 'terminalNode', position: { x: 600, y: 770 }, data: { label: 'Cold / No Interest', nodeType: 'fail' } },
  { id: 'qualified', type: 'terminalNode', position: { x: 600, y: 1150 }, data: { label: 'Qualified Lead', nodeType: 'success' } },
  { id: 'disqualified', type: 'terminalNode', position: { x: 600, y: 1230 }, data: { label: 'Disqualified', nodeType: 'fail' } },
]

const sStyle = { stroke: '#10B981', strokeWidth: 2 }
const fStyle = { stroke: '#EF4444', strokeWidth: 2 }
const pStyle = { stroke: '#F59E0B', strokeWidth: 2 }
const sLbl = { fill: '#10B981', fontWeight: 700, fontSize: 11 }
const fLbl = { fill: '#EF4444', fontWeight: 700, fontSize: 11 }
const pLbl = { fill: '#F59E0B', fontWeight: 700, fontSize: 11 }
const bg = { fill: '#0F1629', fillOpacity: 0.9 }
const pad: [number, number] = [4, 8]

export const existingEdges: Edge[] = [
  { id: 'e1',  source: 'prospect-research', target: 'draft-outreach',   label: '75%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e1b', source: 'prospect-research', target: 'not-qualified',     label: '25%', type: 'smoothstep', style: fStyle, labelStyle: fLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e2',  source: 'draft-outreach',    target: 'send-log',          label: '90%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e2b', source: 'draft-outreach',    target: 'draft-outreach',    label: '10% revise', type: 'smoothstep', style: pStyle, labelStyle: pLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e3',  source: 'send-log',          target: 'follow-up',         label: '70%', type: 'smoothstep', style: pStyle, labelStyle: pLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e3b', source: 'send-log',          target: 'response-triage',   label: '30%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e4',  source: 'follow-up',         target: 'response-triage',   label: '35%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e4b', source: 'follow-up',         target: 'unsubscribed',      label: '10%', type: 'smoothstep', style: fStyle, labelStyle: fLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e5',  source: 'response-triage',   target: 'discovery-prep',    label: '40%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e5b', source: 'response-triage',   target: 'cold',              label: '60%', type: 'smoothstep', style: fStyle, labelStyle: fLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e6',  source: 'discovery-prep',    target: 'discovery-call',    label: '95%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e7',  source: 'discovery-call',    target: 'qualified',         label: '60%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e7b', source: 'discovery-call',    target: 'disqualified',      label: '40%', type: 'smoothstep', style: fStyle, labelStyle: fLbl, labelBgStyle: bg, labelBgPadding: pad },
]

// ─── Workflow diagram: simulation (Salesforce full adoption) ─────────────────
// Shows what happens when the team uses Salesforce features they're currently ignoring

const newStyle = { stroke: '#60A5FA', strokeWidth: 3 }
const newLbl = { fill: '#60A5FA', fontWeight: 700, fontSize: 11 }

export const simulationNodes: Node[] = [
  ...existingNodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      // Time savings from using underutilized Salesforce features
      minutes:
        n.id === 'prospect-research' ? 23      // Lead Scoring saves 12min
        : n.id === 'draft-outreach' ? 19       // Email Templates saves 5min
        : n.id === 'send-log' ? 2              // Auto-Activity Capture saves 6min
        : n.id === 'follow-up' ? 10            // Workflow Rules saves 8min
        : n.id === 'discovery-prep' ? 32       // Reports & Dashboards saves 10min
        : n.data.minutes,
    },
  })),
  // No new nodes — just better utilization of what they already have
]

export const simulationEdges: Edge[] = [
  ...existingEdges,
  // Improved edges from better tool usage (auto-routing, smarter follow-ups)
  { id: 'n1', source: 'send-log',        target: 'response-triage', label: '45%', type: 'smoothstep', style: newStyle, labelStyle: newLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'n2', source: 'response-triage', target: 'discovery-prep',  label: '55%', type: 'smoothstep', style: newStyle, labelStyle: newLbl, labelBgStyle: bg, labelBgPadding: pad },
]

// ─── Simulation metrics ───────────────────────────────────────────────────────
// Framed as "features you already pay for but aren't using"

export const toolTimeMetrics = [
  { tool: 'Salesforce — Lead Scoring',     before: '35m/day', after: '23m/day', change: 'decrease', saved: 12, note: 'Einstein AI prioritizes leads — skip manual research on low-fit prospects' },
  { tool: 'Salesforce — Auto-Capture',     before: '8m/day',  after: '2m/day',  change: 'decrease', saved: 6,  note: 'Emails and calls auto-logged — eliminates manual CRM data entry' },
  { tool: 'Salesforce — Workflow Rules',    before: '18m/day', after: '10m/day', change: 'decrease', saved: 8,  note: 'Auto-assign follow-up tasks and stage updates based on deal triggers' },
  { tool: 'Salesforce — Reports',           before: '42m/day', after: '32m/day', change: 'decrease', saved: 10, note: 'Pre-built dashboards replace manual account research for call prep' },
  { tool: 'Salesforce — Email Templates',  before: '24m/day', after: '19m/day', change: 'decrease', saved: 5,  note: 'One-click personalized templates instead of writing from scratch' },
]

// ─── Recommendation data ──────────────────────────────────────────────────────
// Reframed: "You're leaving X on the table with tools you already own"

export const recommendationData = {
  tool: 'Salesforce',
  useCase: 'Full feature adoption — your team uses 38% of available Salesforce capabilities',
  confidenceScore: 91,
  summary: `Your team currently uses Salesforce primarily for contact management, activity logging, and opportunity tracking — 3 of 8 available features. Five underutilized features (Lead Scoring, Auto-Activity Capture, Workflow Rules, Reports & Dashboards, Email Templates) directly map to your highest time-cost workflow steps.

Enabling these features requires zero additional licensing cost — they're included in your current Salesforce plan. Based on our simulation across 2,000 deal cycles, full adoption reduces your average deal cycle time by 23% and frees up 4.1 hours per SDR per week. Similar sales teams (n=47 in our database) saw measurable improvements within 3–4 weeks of feature rollout.`,
  employeeImpact: {
    timeSaved:    { p10: 1.8, p40: 3.4, p70: 4.1 }, // hours/week per SDR
    velocityGain: { p10: 12,  p40: 23,  p70: 35  }, // % more prospects processed
  },
  companyImpact: {
    throughput:    { p10: 8,       p40: 19,      p70: 28      }, // % more qualified leads
    revenueImpact: { p10: 62000,   p40: 216000,  p70: 384000  }, // $/year
    toolCost: 0, // No additional cost — features already included
  },
  useCases: [
    { title: 'Einstein Lead Scoring',        description: 'AI-powered lead prioritization surfaces highest-fit prospects — your team stops wasting time on cold leads.' },
    { title: 'Auto-Activity Capture',        description: 'Emails, calls, and meetings auto-logged to CRM — eliminates 6 min/day of manual data entry per rep.' },
    { title: 'Workflow Rules & Automation',  description: 'Auto-assign follow-up tasks and update deal stages based on triggers — no more forgotten follow-ups.' },
    { title: 'Pre-built Reports & Dashboards', description: 'Pipeline visibility and account intelligence for call prep — replaces 10 min of manual research per call.' },
  ],
}


/**
 * mockData.ts  (updated)
 * ──────────────────────
 * Static data that doesn't come from telemetry (role info, tool buckets)
 * lives here as before.
 *
 * The workflow graph (nodes + edges) is now loaded dynamically from
 * transition_matrix.json via `loadMarkovData()` in dataLoader.ts.
 *
 * HOW TO USE IN A COMPONENT:
 *
 *   // Option A — async component (Next.js App Router / React Server Component)
 *   import { loadMarkovData } from '@/lib/dataLoader'
 *   const { nodes, edges } = await loadMarkovData()
 *
 *   // Option B — client component with useState/useEffect
 *   import { useMarkovData } from '@/hooks/useMarkovData'
 *   const { nodes, edges, loading, error } = useMarkovData()
 *
 * For prototyping:
 *   1. Run:  python 02_markov_builder.py
 *   2. Copy: backend/data/transition_matrix.json  →  public/data/transition_matrix.json
 *   3. Start your dev server — the graph auto-loads.
 *
 * To add a real upload flow later, call clearMarkovCache() then loadMarkovData(url)
 * with the URL returned by your backend after processing the uploaded file.
 */

// ─── Re-export loader so components have one import path ─────────────────────
export { loadMarkovData, clearMarkovCache, TOOL_ENRICHMENT } from '../hooks/dataLoader'
export type { LoadedMarkovData } from '../hooks/dataLoader'

// ─── Static data (unchanged from original) ───────────────────────────────────

// ─── Legacy static graph (keep as fallback / Storybook fixture) ───────────────
// These are the original hardcoded nodes/edges from before the JSON integration.
// Import them as `fallbackNodes` / `fallbackEdges` if you need offline previews.

export const fallbackNodes: Node[] = [
  { id: 'prospect-research', type: 'taskNode', position: { x: 240, y: 0 },    data: { label: 'Prospect Research',        tools: ['LinkedIn', 'Salesforce', 'ZoomInfo'], minutes: 35, automatable: 'high' } },
  { id: 'draft-outreach',    type: 'taskNode', position: { x: 240, y: 190 },  data: { label: 'Draft Outreach Message',   tools: ['Gmail', 'Notion'],                   minutes: 24, automatable: 'high' } },
  { id: 'send-log',          type: 'taskNode', position: { x: 240, y: 380 },  data: { label: 'Send & Log Activity',      tools: ['Gmail', 'Salesforce'],               minutes: 8,  automatable: 'medium' } },
  { id: 'follow-up',         type: 'taskNode', position: { x: 240, y: 570 },  data: { label: 'Follow-Up Sequence',       tools: ['Outreach', 'Gmail', 'Salesforce'],   minutes: 18, automatable: 'high' } },
  { id: 'response-triage',   type: 'taskNode', position: { x: 240, y: 760 },  data: { label: 'Inbound Response Triage',  tools: ['Gmail', 'Salesforce', 'Slack'],      minutes: 14, automatable: 'medium' } },
  { id: 'discovery-prep',    type: 'taskNode', position: { x: 240, y: 950 },  data: { label: 'Discovery Call Prep',      tools: ['Salesforce', 'Notion', 'Gong'],      minutes: 42, automatable: 'high' } },
  { id: 'discovery-call',    type: 'taskNode', position: { x: 240, y: 1140 }, data: { label: 'Discovery Call Execution', tools: ['Zoom', 'Gong', 'Calendly'],          minutes: 38, automatable: 'low' } },
  { id: 'not-qualified', type: 'terminalNode', position: { x: 600, y: 10 },   data: { label: 'Not Qualified',  nodeType: 'fail' } },
  { id: 'unsubscribed',  type: 'terminalNode', position: { x: 600, y: 580 },  data: { label: 'Unsubscribed',   nodeType: 'fail' } },
  { id: 'cold',          type: 'terminalNode', position: { x: 600, y: 770 },  data: { label: 'Cold / No Interest', nodeType: 'fail' } },
  { id: 'qualified',     type: 'terminalNode', position: { x: 600, y: 1150 }, data: { label: 'Qualified Lead', nodeType: 'success' } },
  { id: 'disqualified',  type: 'terminalNode', position: { x: 600, y: 1230 }, data: { label: 'Disqualified',   nodeType: 'fail' } },
]

export const fallbackEdges: Edge[] = [
  { id: 'e1',  source: 'prospect-research', target: 'draft-outreach',  label: '75%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e1b', source: 'prospect-research', target: 'not-qualified',   label: '25%', type: 'smoothstep', style: fStyle, labelStyle: fLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e2',  source: 'draft-outreach',    target: 'send-log',        label: '90%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e2b', source: 'draft-outreach',    target: 'draft-outreach',  label: '10% revise', type: 'smoothstep', style: pStyle, labelStyle: pLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e3',  source: 'send-log',          target: 'follow-up',       label: '70%', type: 'smoothstep', style: pStyle, labelStyle: pLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e3b', source: 'send-log',          target: 'response-triage', label: '30%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e4',  source: 'follow-up',         target: 'response-triage', label: '35%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e4b', source: 'follow-up',         target: 'unsubscribed',    label: '10%', type: 'smoothstep', style: fStyle, labelStyle: fLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e5',  source: 'response-triage',   target: 'discovery-prep',  label: '40%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e5b', source: 'response-triage',   target: 'cold',            label: '60%', type: 'smoothstep', style: fStyle, labelStyle: fLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e6',  source: 'discovery-prep',    target: 'discovery-call',  label: '95%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e7',  source: 'discovery-call',    target: 'qualified',       label: '60%', type: 'smoothstep', style: sStyle, labelStyle: sLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'e7b', source: 'discovery-call',    target: 'disqualified',    label: '40%', type: 'smoothstep', style: fStyle, labelStyle: fLbl, labelBgStyle: bg, labelBgPadding: pad },
]