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
import AcceptInvite from './pages/AcceptInvite'
import AdminRoute from './components/AdminRoute'
import InternalLogin from './pages/InternalLogin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/get-started" element={<Consultation />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<AcceptInvite />} />

        {/* Client workspace — legacy flat routes (no project scope) */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/toolinput" element={<ToolInputForm />} />
        <Route path="/simulations" element={<SimulationsList />} />
        <Route path="/tool-drafts" element={<ToolDraftsList />} />
        <Route path="/reports" element={<ReportsList />} />
        <Route path="/simulation" element={<SimulationResults />} />
        <Route path="/recommendation" element={<FinalRecommendation />} />

        {/* Internal tools hub — admin only */}
        <Route path="/internal/login" element={<InternalLogin />} />
        <Route path="/internal" element={<AdminRoute><InternalDashboard /></AdminRoute>} />
        <Route path="/internal/form" element={<AdminRoute><DataForm /></AdminRoute>} />
        <Route path="/internal/workflow-report" element={<AdminRoute><WorkflowReport /></AdminRoute>} />
        <Route path="/internal/tool-input" element={<AdminRoute><ToolInputForm /></AdminRoute>} />

        {/* Project-scoped routes (production) */}
        <Route path="/projects/:projectId/dashboard" element={<Dashboard />} />
        {/* Transcript upload — admin only */}
        <Route path="/projects/:projectId/transcripts" element={<AdminRoute><TranscriptInput /></AdminRoute>} />
        <Route path="/projects/:projectId/workflow-report" element={<WorkflowReport />} />
        <Route path="/projects/:projectId/tool-input" element={<ToolInputForm />} />
        <Route path="/projects/:projectId/simulation/:toolEvalId" element={<SimulationResults />} />
        <Route path="/projects/:projectId/recommendation/:toolEvalId" element={<FinalRecommendation />} />
      </Routes>
    </BrowserRouter>
  )
}
