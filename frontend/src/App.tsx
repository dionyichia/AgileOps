import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import DataForm from './pages/DataForm'
import WorkflowReport from './pages/WorkflowReport'
import ToolInputForm from './pages/ToolInputForm'
import SimulationResults from './pages/SimulationResults'
import FinalRecommendation from './pages/FinalRecommendation'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/form" element={<DataForm />} />
        <Route path="/workflow-report" element={<WorkflowReport />} />
        <Route path="/tool-input" element={<ToolInputForm />} />
        <Route path="/simulation" element={<SimulationResults />} />
        <Route path="/recommendation" element={<FinalRecommendation />} />
      </Routes>
    </BrowserRouter>
  )
}
