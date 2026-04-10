import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import DataForm from './pages/unused_DataForm'
import WorkflowReport from './pages/WorkflowReport'
import ToolInputForm from './pages/ToolInputForm'
import SimulationResults from './pages/SimulationResults'
import SimulationsList from './pages/SimulationsList'
import ToolDraftsList from './pages/ToolDraftsList'
import ReportsList from './pages/ReportsList'
import FinalRecommendation from './pages/FinalRecommendation'
import TranscriptInput from './pages/TranscriptInput'
import InternalDashboard from './pages/InternalDashboard'
import Consultation from './pages/Consultation'
import Login from './pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/get-started" element={<Consultation />} />
        <Route path="/login" element={<Login />} />

        {/* Client workspace — legacy flat routes (no project scope) */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/toolinput" element={<ToolInputForm />} />
        <Route path="/simulations" element={<SimulationsList />} />
        <Route path="/tool-drafts" element={<ToolDraftsList />} />
        <Route path="/reports" element={<ReportsList />} />
        <Route path="/simulation" element={<SimulationResults />} />
        <Route path="/recommendation" element={<FinalRecommendation />} />

        {/* Internal tools hub */}
        <Route path="/internal" element={<InternalDashboard />} />
        {/* Internal step routes — legacy, replaced by project-scoped flow */}
        <Route path="/internal/form" element={<DataForm />} />
        <Route path="/internal/workflow-report" element={<WorkflowReport />} />
        <Route path="/internal/tool-input" element={<ToolInputForm />} />

        {/* Project-scoped routes (production) */}
        <Route path="/projects/:projectId/dashboard" element={<Dashboard />} />
        <Route path="/projects/:projectId/transcripts" element={<TranscriptInput />} />
        <Route path="/projects/:projectId/workflow-report" element={<WorkflowReport />} />
        <Route path="/projects/:projectId/tool-input" element={<ToolInputForm />} />
        <Route path="/projects/:projectId/simulation/:toolEvalId" element={<SimulationResults />} />
        <Route path="/projects/:projectId/recommendation/:toolEvalId" element={<FinalRecommendation />} />
      </Routes>
    </BrowserRouter>
  )
}
