import { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import React from 'react'
import Distil from './Distil.jsx'
import IntakeKiosk from './IntakeKiosk.jsx'
import Login from './Login.jsx'
import { getSession, getCurrentStaff, onAuthStateChange } from './db.js'

// Route based on URL path:
//   / or /distil  → Provider CRM (requires login)
//   /intake        → Patient kiosk (no login required)
const path = window.location.pathname.replace(/\/$/, '')
const isKiosk = path === '/intake'

function App() {
  const [session, setSession]   = useState(undefined) // undefined = loading
  const [staff, setStaff]       = useState(null)

  useEffect(() => {
    // Check for existing session on mount
    getSession().then(s => {
      setSession(s)
      if (s) getCurrentStaff().then(setStaff)
    })

    // Listen for login / logout events
    const { data: { subscription } } = onAuthStateChange(async (s) => {
      setSession(s)
      if (s) {
        const staffRecord = await getCurrentStaff()
        setStaff(staffRecord)
      } else {
        setStaff(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Kiosk never needs auth
  if (isKiosk) return <IntakeKiosk />

  // Still checking session
  if (session === undefined) return null

  // Not logged in — show login screen
  if (!session) return <Login />

  // Logged in — pass staff context into Distil
  return (
    <Distil
      staffId={staff?.id}
      clinicId={staff?.clinic_id}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
