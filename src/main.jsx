import { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import React from 'react'
import Distil from './Distil.jsx'
import IntakeKiosk from './IntakeKiosk.jsx'
import PatientApp from './Aided.jsx'
import Login from './Login.jsx'
import DeviceSelection from './views/DeviceSelection.jsx'
import { getSession, getCurrentStaff, onAuthStateChange } from './db.js'

// Route based on URL path:
//   / or /distil                  → Provider CRM (requires login)
//   /distil/select/:patientId     → Device Selection & Pricing (requires login)
//   /intake                       → Patient kiosk (no login required)
//   /aided                        → Patient app (no login required)
const path = window.location.pathname.replace(/\/$/, '')
const isKiosk = path === '/intake'
const isAided = path === '/aided'
const selectMatch = path.match(/^\/distil\/select\/([0-9a-fA-F-]{36})$/)
const selectPatientId = selectMatch ? selectMatch[1] : null

// Aided runs as a PWA — installable, standalone-capable, scoped to /aided.
// Distil and IntakeKiosk are deliberately excluded; they share the index.html
// shell, so PWA metadata is injected at runtime only when on /aided.
if (isAided) {
  document.title = 'Aided'

  const head = document.head
  const addTag = (tag, attrs) => {
    const el = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    head.appendChild(el)
  }
  addTag('link', { rel: 'manifest', href: '/manifest.webmanifest' })
  addTag('link', { rel: 'apple-touch-icon', href: '/icons/aided.svg' })
  addTag('meta', { name: 'theme-color', content: '#0a1628' })
  addTag('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' })
  addTag('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' })
  addTag('meta', { name: 'apple-mobile-web-app-title', content: 'Aided' })

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/aided' })
        .catch((err) => console.warn('Aided SW registration failed:', err))
    })
  }
}

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

  // Patient app and kiosk never need auth
  if (isAided) return <PatientApp />
  if (isKiosk) return <IntakeKiosk />

  // Still checking session
  if (session === undefined) return null

  // Not logged in — show login screen
  if (!session) return <Login />

  // Logged in — Device Selection screen if that route, otherwise main CRM
  if (selectPatientId) {
    return (
      <DeviceSelection
        patientId={selectPatientId}
        staffId={staff?.id}
        clinicId={staff?.clinic_id}
      />
    )
  }

  return (
    <Distil
      staffId={staff?.id}
      clinicId={staff?.clinic_id}
      staffRole={staff?.role}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
