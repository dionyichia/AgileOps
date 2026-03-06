import type { Node, Edge } from 'reactflow'

export const roleStats = {
  teamType: 'Sales',
  role: 'Sales Development Representative (SDR)',
  numEmployees: 24,
  avgToolsUsed: 8.3,
  avgWeeklyHours: 42.5,
}

export const toolBuckets = [
  {
    category: 'CRM',
    color: 'indigo',
    tools: [
      { name: 'Salesforce', pctUsers: 92, hoursPerWeek: 8.4, intensity: 'High' },
      { name: 'HubSpot', pctUsers: 21, hoursPerWeek: 2.1, intensity: 'Low' },
    ],
  },
  {
    category: 'Sales Engagement',
    color: 'violet',
    tools: [
      { name: 'Outreach', pctUsers: 78, hoursPerWeek: 5.2, intensity: 'High' },
      { name: 'Apollo.io', pctUsers: 34, hoursPerWeek: 1.8, intensity: 'Medium' },
    ],
  },
  {
    category: 'Intelligence',
    color: 'cyan',
    tools: [
      { name: 'LinkedIn Sales Nav', pctUsers: 88, hoursPerWeek: 4.6, intensity: 'High' },
      { name: 'ZoomInfo', pctUsers: 61, hoursPerWeek: 2.9, intensity: 'Medium' },
    ],
  },
  {
    category: 'Communication',
    color: 'emerald',
    tools: [
      { name: 'Gmail', pctUsers: 100, hoursPerWeek: 9.1, intensity: 'High' },
      { name: 'Slack', pctUsers: 96, hoursPerWeek: 3.7, intensity: 'Medium' },
    ],
  },
  {
    category: 'Meeting & Recording',
    color: 'amber',
    tools: [
      { name: 'Zoom', pctUsers: 90, hoursPerWeek: 3.2, intensity: 'High' },
      { name: 'Gong.io', pctUsers: 28, hoursPerWeek: 0.9, intensity: 'Low' },
      { name: 'Calendly', pctUsers: 71, hoursPerWeek: 1.1, intensity: 'Low' },
    ],
  },
  {
    category: 'Content & Notes',
    color: 'rose',
    tools: [
      { name: 'Notion', pctUsers: 55, hoursPerWeek: 2.3, intensity: 'Medium' },
      { name: 'Google Docs', pctUsers: 80, hoursPerWeek: 2.7, intensity: 'Medium' },
    ],
  },
]

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

// ─── Workflow diagram: simulation (Apollo.io added) ───────────────────────────

const newStyle = { stroke: '#60A5FA', strokeWidth: 3 }
const newLbl = { fill: '#60A5FA', fontWeight: 700, fontSize: 11 }

export const simulationNodes: Node[] = [
  ...existingNodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      minutes:
        n.id === 'prospect-research' ? 18
        : n.id === 'draft-outreach' ? 10
        : n.data.minutes,
    },
  })),
  {
    id: 'ai-scoring',
    type: 'taskNode',
    position: { x: 600, y: 80 },
    data: { label: 'AI Prospect Scoring', tools: ['Apollo.io', 'AI'], minutes: 5, automatable: 'high', isNew: true },
  },
  {
    id: 'ai-outreach',
    type: 'taskNode',
    position: { x: 600, y: 270 },
    data: { label: 'AI-Assisted Drafting', tools: ['Apollo.io', 'Gmail'], minutes: 8, automatable: 'high', isNew: true },
  },
]

export const simulationEdges: Edge[] = [
  ...existingEdges,
  { id: 'n1', source: 'prospect-research', target: 'ai-scoring',    label: '60%', type: 'smoothstep', style: newStyle, labelStyle: newLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'n2', source: 'ai-scoring',        target: 'draft-outreach', label: '85%', type: 'smoothstep', style: newStyle, labelStyle: newLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'n3', source: 'ai-scoring',        target: 'not-qualified',  label: '15%', type: 'smoothstep', style: { ...fStyle, strokeDasharray: '5 4' }, labelStyle: fLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'n4', source: 'draft-outreach',    target: 'ai-outreach',    label: '70%', type: 'smoothstep', style: newStyle, labelStyle: newLbl, labelBgStyle: bg, labelBgPadding: pad },
  { id: 'n5', source: 'ai-outreach',       target: 'send-log',       label: '95%', type: 'smoothstep', style: newStyle, labelStyle: newLbl, labelBgStyle: bg, labelBgPadding: pad },
]

// ─── Simulation metrics ───────────────────────────────────────────────────────

export const toolTimeMetrics = [
  { tool: 'Apollo.io',           before: null,      after: '5m/day',  change: 'new',      note: 'AI prospect scoring & enrichment', annualCost: 8400 },
  { tool: 'LinkedIn Sales Nav',  before: '35m/day', after: '18m/day', change: 'decrease', saved: 17, note: 'Fewer manual searches needed' },
  { tool: 'Gmail (Outreach)',    before: '24m/day', after: '10m/day', change: 'decrease', saved: 14, note: 'AI-generated first drafts' },
  { tool: 'Outreach',           before: '18m/day', after: '22m/day', change: 'increase', note: 'Temporary learning curve (~3 wks)' },
  { tool: 'Salesforce',         before: '8m/day',  after: '7m/day',  change: 'decrease', saved: 1,  note: 'Auto-enriched contact records' },
]

// ─── Recommendation data ──────────────────────────────────────────────────────

export const recommendationData = {
  tool: 'Apollo.io',
  useCase: 'AI-powered prospect research and personalized outreach automation',
  confidenceScore: 87,
  summary: `Apollo.io's AI-driven prospecting and sequence automation directly addresses the two highest time-cost tasks in your SDR workflow: Prospect Research (35min → 18min avg) and Draft Outreach Message (24min → 10min avg). The platform's intent data and AI-assisted email drafting reduce manual effort by up to 52% for these tasks.

Based on your team's current tool stack and workflow patterns, Apollo.io integrates natively with Salesforce and Gmail, requiring minimal onboarding disruption. Similar sales teams (n=47 in our case study database) have seen meaningful improvements in qualified lead volume within 4–6 weeks of full adoption.`,
  employeeImpact: {
    timeSaved:    { p10: 1.2, p40: 2.8, p70: 4.1 }, // hours/week per SDR
    velocityGain: { p10: 8,   p40: 22,  p70: 38  }, // % more prospects processed
  },
  companyImpact: {
    throughput:    { p10: 6,       p40: 18,      p70: 31      }, // % more qualified leads
    revenueImpact: { p10: 48000,   p40: 192000,  p70: 336000  }, // $/year
    toolCost: 8400,
  },
  useCases: [
    { title: 'Prospect Intelligence',      description: 'AI-powered ICP scoring and buying intent signals to prioritize highest-value outreach.' },
    { title: 'Sequence Automation',        description: 'Multi-channel sequences (email + LinkedIn) with smart send-time optimization.' },
    { title: 'Personalization at Scale',   description: 'Auto-personalize messages using job change alerts, news mentions, and tech stack data.' },
    { title: 'CRM Data Enrichment',        description: 'Automatically enrich and update Salesforce records from Apollo\'s 265M+ contact database.' },
  ],
}
