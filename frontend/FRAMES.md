# Frontend Frames

This document describes every frame (page) in the app, what it contains, and who it's for.

**Internal frames** (used by the AgileOps team): Dashboard, Transcript Input
**Client-facing frames** (the customer walks through): Workflow Report, Tool Input, Simulation Results, Final Recommendation

Route flow: `/` → `/transcripts/:projectId` → `/workflow-report/:projectId` → `/tool-input/:projectId` → `/simulation/:projectId` → `/recommendation/:projectId`

---

## Frame 1: Dashboard (`Dashboard.tsx`)

**Audience:** Internal (AgileOps team)

**Purpose:** Central hub for managing all client projects. After a client fills out the Typeform and you've done the call, this is where you go to paste transcripts and track progress.

### Content

**Navbar**
- Axis logo + branding
- Navigation: Dashboard (active), Projects, Settings
- User avatar / account menu

**Project List (main content area)**
- Table or card grid of all client projects
- Each project shows:
  - Client company name
  - Team / role being analyzed (e.g. "SDR Team")
  - Number of transcripts submitted (e.g. "3 transcripts")
  - Pipeline status badge:
    - `No transcripts` — grey, waiting for first interview
    - `Processing` — amber, transcript being analyzed
    - `Ready to review` — blue, pipeline has run, results available
    - `Shared with client` — green, client has been given access
  - Last updated timestamp
  - Actions:
    - "Add Transcript" button → navigates to Transcript Input for this project
    - "View Report" button → navigates to Workflow Report (only enabled when pipeline has run)
    - "Share Link" button → generates a client-facing URL starting at Workflow Report

**New Project Button**
- Opens a modal or inline form to create a new project:
  - Client company name (required)
  - Team name (required)
  - Primary role (dropdown: SDR, AE, CSM, Sales Manager, etc.)
  - Team size (number)
  - Notes (optional freeform)
- On create → navigates to Transcript Input for the new project

**Empty State**
- When no projects exist: illustration + "Create your first project" CTA

### Data
- Project list fetched from backend (or JSON file during prototyping)
- Each project is a folder/record keyed by project ID containing its own `all_tasks.json`

---

## Frame 2: Transcript Input (`TranscriptInput.tsx` — NEW)

**Audience:** Internal (AgileOps team)

**Purpose:** After conducting an interview call, paste the transcript here. Supports multiple interviews over time for the same project — each transcript merges into the project's `all_tasks.json`.

### Content

**Project Header**
- Breadcrumb: Dashboard > {Client Name}
- Project name, team, role summary
- Status badge (same as Dashboard)

**Transcript Submission Form**
- Interviewee name (text input, required)
- Interviewee role (dropdown or text, required — e.g. "Senior SDR", "SDR Manager", "AE")
- Interview date (date picker, defaults to today)
- Transcript body (large textarea, required)
  - Placeholder: "Paste the full call transcript here..."
  - Monospace font, line numbers if possible
  - Should comfortably hold 5,000+ words
- "Process Transcript" button
  - On click: sends transcript to backend → runs `transcript_to_tasks.py` logic
  - Shows processing spinner with status ("Extracting tasks...", "Merging with existing data...", "Done")
  - On success: shows summary of what changed (e.g. "Updated 8 existing tasks, added 2 new tasks")
  - On error: shows error message with option to retry

**Transcript History Panel**
- List of all previously submitted transcripts for this project
- Each entry shows:
  - Interviewee name and role
  - Date submitted
  - Number of tasks extracted / updated
  - Expandable to view the original transcript text
- Sorted newest first

**Pipeline Actions (bottom bar or sidebar)**
- "Run Full Pipeline" button — triggers `syth_data_gen.py` → `markov_builder.py` → `sim.py` in sequence
  - Only enabled when at least one transcript has been processed
  - Shows pipeline progress (Stage 1/3, 2/3, 3/3 with labels)
  - On completion: status changes to "Ready to review"
- "Preview Tasks" button — opens a modal/drawer showing the current `all_tasks.json` as a readable table:
  - Columns: Task Name, Description, Tools, Avg Duration, Automatable, Sources
  - Allows quick sanity check before running the pipeline
- "Reset Tasks" button (with confirmation) — clears `all_tasks.json` back to empty for a fresh start

### Data
- Reads/writes project-specific `all_tasks.json`
- Stores transcript history (interviewee, role, date, raw text, extraction summary)
- Calls `transcript_to_tasks.py` via backend API

---

## Frame 3: Workflow Report (`WorkflowReport.tsx`)

**Audience:** Client-facing (first frame the customer sees)

**Purpose:** Visualize the customer's current workflow as an interactive pipeline graph, derived from interview data. Shows where time is spent, what tools are used, and where bottlenecks exist.

### Content

**Left Sidebar (fixed width, scrollable)**

*Role Stats Card*
- Team type (e.g. "Sales")
- Role analyzed (e.g. "SDR")
- Number of employees
- Average tools used per person
- Average weekly hours
- Data source: derived from processed transcripts / project metadata

*Tool Stack Card*
- Tools grouped by category (CRM, Sales Engagement, Intelligence, Communication, Meeting & Recording, Content & Notes)
- Each tool shows:
  - Name (clickable to highlight in graph)
  - Usage percentage across team
  - Hours per week
- Categories color-coded with distinct badges

*Popular Tools Table*
- Top 6 tools ranked by hours/week
- Columns: Tool name, % of team using, Intensity (High/Medium/Low with colored dot)

**Right Panel (main area)**

*Workflow Graph (ReactFlow)*
- Directed graph showing the full task pipeline
- Task nodes show:
  - Task label
  - Tools used (as colored pill badges)
  - Average duration in minutes
  - Automation potential (High/Medium/Low badge)
- Terminal nodes for outcomes (success states in green, fail states in red)
- Edges labeled with:
  - Transition probability (e.g. "75%")
  - Average dwell time between steps (e.g. "~12m")
  - Color-coded: green (success path), red (fail/exit path), amber (retry/loop)
- Interactive: pan, zoom, minimap, drag nodes to reposition
- "Add Task" button for manual node creation

*Header*
- Workflow title (e.g. "Sales Pipeline — {Client Name}")
- Legend: Success / Fail / Retry color key

### Data
- Nodes/edges from `useMarkovData()` hook → loads `transition_matrix.json`
- Falls back to mock data if unavailable
- Role stats and tool buckets: currently from mockData, should come from project data

---

## Frame 4: Tool Input (`ToolInputForm.tsx`)

**Audience:** Client-facing (or internal — can be filled by either party)

**Purpose:** Specify which tool to evaluate against the current workflow. Provide documentation so the system can understand the tool's capabilities.

### Content

**Use Case Selection**
- Two option cards:
  - "Increase adoption of existing tool" (recommended badge)
  - "Compare tools for a use case"
- Default: adoption

**Tool Name** (required)
- Text input
- Placeholder: "e.g. Apollo.io, Gong, Seismic..."

**Website Domain** (optional)
- URL input
- Placeholder: "https://apollo.io"
- Helper text: "Axis will scrape the product site for feature info"

**Product Documentation / Pitch Deck** (optional)
- Dual input: paste a link OR upload a file
- Accepted formats: .pdf, .pptx, .docx

**API Documentation** (optional)
- Dual input: link or file upload
- Accepted formats: .pdf, .html, .txt

**Case Studies** (optional)
- Dual input: link or file upload
- Accepted formats: .pdf, .docx

**Validation**
- Submit enabled when: tool name is filled AND at least one of (website, docs link, docs file, API link, API file, case study, pitch deck) is provided

### Data
- On submit: stores `{ useCase, toolName, website }` to localStorage (`axisToolInput`)
- Files captured in component state but not yet sent to backend

---

## Frame 5: Simulation Results (`SimulationResults.tsx`)

**Audience:** Client-facing

**Purpose:** Show the impact of adding the proposed tool to the customer's workflow. Displays before/after workflow comparison, time savings per tool, and ROI estimation.

### Content

**Loading State (shown while pipeline runs)**
- Axis logo + "Running Simulation" heading
- Animated progress bar (0–100%)
- Step checklist with status icons:
  1. Parsing tool documentation
  2. Scraping product website
  3. Mapping features to workflow
  4. Running Monte Carlo simulation
  5. Computing impact estimates
  6. Generating workflow diff
- Each step: checkmark when done, spinner when active, circle when pending
- Subtext: "Analyzing how {toolName} would affect your {role} workflow..."

**Results — Left Sidebar**

*Updated Tool Stack*
- Same categories as Workflow Report
- New tool highlighted with blue badge and "NEW" label at the top

*Estimated Time Impact Table*
- Per-tool rows showing:
  - Tool name
  - Before time (minutes/day)
  - After time (minutes/day)
  - Change: saved minutes (green) or increased minutes with "learning curve" note (red)
  - Info tooltip icon with explanation on hover
- Net summary row:
  - Total minutes saved per day
  - Converted to hours per rep per week

*Cost Estimation Card*
- Annual license cost
- Estimated value of time saved (annual)
- Net ROI multiplier
- Footnote with assumptions (team size, avg salary)

**Results — Right Panel**

*Modified Workflow Graph (ReactFlow, read-only)*
- Original nodes + new nodes added by the tool (highlighted in blue with "NEW" badge)
- New edges shown in blue
- Legend: Success / Fail / New path
- Nodes not draggable (read-only view)

### Data
- `toolName` from localStorage
- Nodes/edges, time metrics, cost data: currently from mockData, should come from actual Monte Carlo output (`monte_carlo_results.json`)

---

## Frame 6: Final Recommendation (`FinalRecommendation.tsx`)

**Audience:** Client-facing

**Purpose:** Present the final recommendation with confidence score, adjustable adoption modeling, use cases, and an exportable summary.

### Content

**Recommendation Header Card**
- Title: "Adopt {toolName} for your {role} team"
- Confidence badge with percentage (e.g. 87%)
  - Green: 80%+, Amber: 60–79%, Red: <60%
- Summary paragraph (2-3 sentences explaining the recommendation rationale)

**Impact Analysis Section**

*Adoption Rate Slider*
- Range: 10% – 70% (step 5)
- Styled range input with gradient background
- All metrics below update in real-time as the slider moves

*Employee Level Metrics (left column)*
- Time saved per rep: `{X}h/week` (interpolated from p10/p40/p70)
- Prospects processed increase: `+{X}%`
- Learning rate: estimated ramp time (e.g. "3–4 weeks")

*Company Level Metrics (right column)*
- Qualified leads throughput increase: `+{X}%`
- Estimated revenue impact: `${X}/yr`
- Net of tool cost: `${X}/yr`
- Annual tool cost: `${X}`

*Interpolation logic:* `t = (adoption - 10) / 60` maps slider to 0–1, then lerp between p10 and p70 estimates for each metric.

**Use Cases Card**
- Grid of use case items (e.g. 4 items, 2 columns)
- Each with checkmark icon, title, and one-line description
- Derived from tool analysis (currently hardcoded for Apollo.io)

**Summary & Integration Plan**
- Narrative text block with interpolated values from the slider
- Recommended rollout plan (e.g. "Start with a 5-rep pilot for 4 weeks, then expand to full team")
- Two buttons:
  - "Download Report" — exports PDF/CSV of the full recommendation
  - "Back to Dashboard" — returns to `/`

### Data
- `toolName` from localStorage
- Recommendation metrics, confidence score, use cases: currently from mockData (`recommendationData`), should come from simulation output
- Adoption slider drives real-time interpolation of all displayed metrics
