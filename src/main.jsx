import React from 'react'
import ReactDOM from 'react-dom/client'
import Distil from './Distil.jsx'
import IntakeKiosk from './IntakeKiosk.jsx'

// Route based on URL path:
//   / or /distil  → Provider CRM (workstation)
//   /intake        → Patient kiosk (iPad)
const path = window.location.pathname.replace(/\/$/, '')
const App = path === '/intake' ? IntakeKiosk : Distil

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
