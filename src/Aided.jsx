import { useState, useEffect } from "react";
import { supabase } from './supabase.js'
import { listInboxMessages, markMessageRead, countUnreadMessages } from './db.js'

// ── DEMO PATIENT (shown when no real data exists yet) ─────────────────────────
const DEMO = {
  id: "DEMO01",
  name: "Sarah Mitchell",
  dob: "1958-04-12",
  phone: "(602) 555-0182",
  location: "My Hearing Centers – Phoenix, AZ",
  payType: "insurance",
  insurance: { carrier: "Humana", planGroup: "Humana TruHearing Advanced", tpa: "TruHearing", tier: "Premium", tierPrice: 1299 },
  devices: {
    manufacturer: "Signia", model: "Pure Charge&Go IX", style: "ric",
    color: "Rose Gold", battery: "Rechargeable", receiver: "Medium (M)", dome: "Tulip Dome",
    fittingDate: "2024-11-14",
    warrantyExpiry: "2027-11-14",
    serialLeft: "SG4A8F2", serialRight: "SG4A8F3",
  },
  carePlan: "punch",
  appointments: [
    { date: new Date(Date.now() + 5*86400000).toISOString().split("T")[0], type: "Quarterly Clean & Check" },
    { date: new Date(Date.now() + 42*86400000).toISOString().split("T")[0], type: "Annual Exam" },
    { date: new Date(Date.now() + 120*86400000).toISOString().split("T")[0], type: "Quarterly Clean & Check" },
  ],
  notes: "Mild-moderate SNHL bilateral. Prefer phone calls over texts.",
  createdAt: "2024-11-14T10:30:00Z",
};

const CARE_PLAN_LABELS = { complete: "Complete Care+", punch: "MHC Punch Card", paygo: "Standard Billing" };

// Parse a bare 'YYYY-MM-DD' as a local-time Date. `new Date('YYYY-MM-DD')` is
// UTC midnight, which renders a day earlier in negative-offset US timezones —
// so fitting/warranty dates were showing one day off. Returns null for anything
// that isn't a bare date so timestamptz values fall through.
function parseDateOnly(s) {
  if (typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2]-1, +m[3]) : null;
}
function fmtDate(d) { return (parseDateOnly(d) || new Date(d)).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function daysUntil(dateStr) {
  const dateOnly = parseDateOnly(dateStr);
  if (dateOnly) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((dateOnly - today) / 86400000);
  }
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}
function daysAgo(dateStr) {
  const dateOnly = parseDateOnly(dateStr);
  if (dateOnly) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((today - dateOnly) / 86400000);
  }
  return Math.ceil((new Date() - new Date(dateStr)) / 86400000);
}

const CLEANING_STEPS = [
  { icon:"🪮", title:"Wipe the shell", desc:"Use the soft dry cloth to gently wipe the outer surface of both hearing aids. Never use water or cleaning sprays." },
  { icon:"🔍", title:"Check the microphone ports", desc:"Use the small brush to clear any debris from the microphone openings on top of the device." },
  { icon:"🔄", title:"Clean or replace the dome", desc:"Remove the dome from the receiver tip. Rinse with the provided tool, or replace if worn or discolored." },
  { icon:"🔧", title:"Replace the wax filter", desc:"Use the filter replacement stick. White end removes old filter, dark end inserts new one. Change monthly or when sound is muffled." },
  { icon:"🔋", title:"Place in charger overnight", desc:"For rechargeable devices, always place in the charging case each evening. Ensure the light confirms a connection." },
];

const TROUBLESHOOT_TIPS = [
  { q:"No sound", a:"Check that the device is powered on. Inspect the wax filter — if clogged, replace it. Ensure the dome is seated properly on the receiver." },
  { q:"Feedback / whistling", a:"Reinsert the hearing aid — an improper seal causes feedback. Check if the dome or earmold is damaged. If it persists, call the clinic." },
  { q:"Sound is muffled", a:"The wax filter is almost certainly blocked. Replace it using your cleaning kit. Also verify the microphone ports are clear of debris." },
  { q:"Won't charge", a:"Check the charging contacts on both device and case for debris. Try a different outlet. If the case LED doesn't light, contact your clinic." },
  { q:"Bluetooth not connecting", a:"Open your phone's Bluetooth settings and forget the device. Power cycle the hearing aid, then re-pair. Stay within 30 feet of your phone." },
];

// ── Achievement badge display map ────────────────────────────────────────────
const ACHIEVEMENT_DISPLAY = {
  first_fitting:         { emoji: '🎧', label: 'First Fitting' },
  one_year_anniversary:  { emoji: '🎂', label: '1 Year Strong' },
  three_year_anniversary:{ emoji: '🏆', label: '3 Year Veteran' },
  five_year_anniversary: { emoji: '⭐', label: '5 Year Champion' },
  six_year_survivor:     { emoji: '🦴', label: 'Stubborn Survivor' },
  care_plan_streak_6:    { emoji: '🔥', label: '6-Month Streak' },
  care_plan_streak_12:   { emoji: '💎', label: 'Full Year Streak' },
  lima_charlie_donor:    { emoji: '🎖️', label: 'Lima Charlie Donor' },
  early_upgrader:        { emoji: '⚡', label: 'Early Upgrader' },
  serial_upgrader:       { emoji: '🚀', label: 'Serial Upgrader' },
  two_sets_one_year:     { emoji: '😅', label: 'Overachiever' },
  hearing_champion:      { emoji: '👑', label: 'Hearing Champion' },
};

// ── Web Push helpers ─────────────────────────────────────────────────────────
// Public VAPID key — safe to ship in the client; the matching private key
// signs send-push requests on the edge function side. Rotating the key
// invalidates any existing subscriptions: a device must clear its old
// subscription and re-subscribe before it can receive pushes again.
const VAPID_PUBLIC_KEY = 'BJCKzkGWeA724r7lKUs2xwq19HGIazobrVD8FzZhr6kLgcBn9E1mSLatAGehFNjhYaM7KSA3iCrPGhNPZkmxPrk';

function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - b64.length % 4) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

async function getActiveSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function postSubscription(patientId, subscription) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscribe-push`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      patient_id: patientId,
      subscription: subscription.toJSON(),
      user_agent: navigator.userAgent,
    }),
  });
  return resp.ok;
}

async function subscribeToPush(patientId) {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: permission };

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // pushManager.subscribe can throw on iOS Safari if the PWA isn't installed
      // to the home screen, or on locked-down enterprise browsers.
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const ok = await postSubscription(patientId, sub);
    if (!ok) return { ok: false, reason: 'server_error' };
    return { ok: true };
  } catch (err) {
    console.warn('subscribeToPush failed:', err);
    return { ok: false, reason: 'error' };
  }
}

async function unsubscribeFromPush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();

  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscribe-push`, {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    // Best-effort: local unsubscribe already happened.
  }
}

// ── DOB confirmation gate ────────────────────────────────────────────────────
// First-launch gate for real (non-demo) patients. Provider sets up patient in
// office, then the patient scans the QR and confirms their DOB to unlock the
// app on this device. 3 wrong attempts → 60s lockout, then counter resets.
function DobGate({ patient, onVerified }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const lockoutUntil = parseInt(localStorage.getItem('aided_dob_lockout_until') || '0', 10);
  const locked = lockoutUntil > now;
  const lockSeconds = Math.max(0, Math.ceil((lockoutUntil - now) / 1000));

  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [locked]);

  const submit = (e) => {
    e.preventDefault();
    if (locked || !input) return;

    const expected = patient.dob;
    if (!expected) {
      // No DOB on the record. Soft-failing the gate would lock a real patient
      // out indefinitely — better to let them through and surface this as a
      // data issue for the clinic.
      console.warn('Patient has no DOB on file; bypassing gate');
      localStorage.setItem('aided_dob_verified', 'true');
      onVerified();
      return;
    }

    if (input === expected) {
      localStorage.setItem('aided_dob_verified', 'true');
      localStorage.removeItem('aided_dob_attempts');
      localStorage.removeItem('aided_dob_lockout_until');
      onVerified();
      return;
    }

    const attempts = parseInt(localStorage.getItem('aided_dob_attempts') || '0', 10) + 1;
    if (attempts >= 3) {
      const until = Date.now() + 60_000;
      localStorage.setItem('aided_dob_lockout_until', String(until));
      localStorage.setItem('aided_dob_attempts', '0');
      setError('Too many attempts.');
      setNow(Date.now());
    } else {
      localStorage.setItem('aided_dob_attempts', String(attempts));
      setError(`That doesn't match. ${3 - attempts} ${3 - attempts === 1 ? 'attempt' : 'attempts'} remaining.`);
    }
    setInput('');
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0a1628', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: 'white',
    }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Confirm it's you</h1>
      <p style={{ fontSize: 14, opacity: 0.6, marginBottom: 28, textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
        Enter your date of birth to access your hearing care profile.
      </p>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="date"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={locked}
          style={{
            padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: 16,
            fontFamily: 'inherit', outline: 'none', colorScheme: 'dark',
          }}
        />
        {error && !locked && (
          <div style={{ fontSize: 13, color: '#fca5a5', textAlign: 'center' }}>{error}</div>
        )}
        {locked && (
          <div style={{ fontSize: 13, color: '#fbbf24', textAlign: 'center' }}>
            Locked. Try again in {lockSeconds}s.
          </div>
        )}
        <button
          type="submit"
          disabled={locked || !input}
          style={{
            padding: '14px', borderRadius: 12, border: 'none',
            background: (locked || !input) ? 'rgba(255,255,255,0.1)' : '#4ade80',
            color: (locked || !input) ? 'rgba(255,255,255,0.4)' : '#0a1628',
            fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            cursor: (locked || !input) ? 'default' : 'pointer',
          }}
        >
          Continue
        </button>
      </form>
      <div style={{ fontSize: 12, opacity: 0.45, marginTop: 24, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
        Trouble? Call your clinic — they can re-link your device.
      </div>
    </div>
  );
}

// ── Map Supabase patient join to the flat shape Aided's render functions expect ──
function mapSupabasePatientToAidedShape(data) {
  // Find the most recent active fitting
  const fitting = (data.device_fittings || [])
    .sort((a, b) => new Date(b.fitting_date || 0) - new Date(a.fitting_date || 0))[0];

  // Get device sides from the fitting
  const sides = fitting?.device_sides || [];
  const left = sides.find(s => s.side === 'left') || {};
  const right = sides.find(s => s.side === 'right') || {};
  // Use left side as primary for display (bilateral assumption)
  const primary = left.id ? left : right;

  // Find insurance coverage
  const coverage = (data.insurance_coverage || [])[0];

  // Map appointments to expected shape
  const appointments = (data.appointments || []).map(a => ({
    date: a.appointment_date || a.date,
    type: a.appointment_type || a.type || 'Appointment',
  }));

  return {
    id: data.id,
    name: [data.first_name, data.last_name].filter(Boolean).join(' ') || data.name || 'Patient',
    dob: data.date_of_birth || data.dob,
    phone: data.phone,
    location: data.clinic_name || '',
    payType: coverage ? 'insurance' : (data.pay_type || 'private'),
    insurance: coverage ? {
      carrier: coverage.carrier || coverage.insurance_carrier,
      planGroup: coverage.plan_group || coverage.plan_name,
      tpa: coverage.tpa,
      tier: coverage.tier,
      tierPrice: coverage.tier_price || coverage.copay,
    } : null,
    devices: fitting ? {
      manufacturer: fitting.manufacturer || primary.manufacturer,
      model: fitting.model || primary.model,
      style: fitting.style || primary.style || 'ric',
      color: primary.color || fitting.color,
      battery: primary.battery_type || fitting.battery_type || 'Rechargeable',
      receiver: primary.receiver || fitting.receiver,
      dome: primary.dome || fitting.dome,
      fittingDate: fitting.fitting_date,
      warrantyExpiry: fitting.warranty_expiry || fitting.warranty_end,
      serialLeft: left.serial_number || '',
      serialRight: right.serial_number || '',
    } : DEMO.devices, // Fallback to demo devices if no fitting found
    carePlan: fitting?.care_plan || data.care_plan || 'complete',
    appointments,
    notes: data.notes,
    createdAt: data.created_at,
    clinic_id: data.clinic_id,
  };
}

// If a real pid is present on first paint, render nothing (loading) until the
// fetch resolves — avoids flashing demo data behind the DOB gate.
function initialPatient() {
  if (typeof window === 'undefined') return null;
  const pid = new URLSearchParams(window.location.search).get('pid')
    || localStorage.getItem('aided_pid');
  return pid ? null : DEMO;
}

export default function PatientApp() {
  const [patient, setPatient] = useState(initialPatient);
  const [clinicName, setClinicName] = useState("My Hearing Centers");
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return ['home','devices','care','schedule','inbox','help'].includes(t) ? t : 'home';
  });
  // Inbox state — long-form messages from the clinic that persist beyond the
  // push toast. Deep-linked from push notifications via ?tab=inbox&msg=<id>.
  const [inboxMessages, setInboxMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedInboxId, setExpandedInboxId] = useState(() => {
    const m = new URLSearchParams(window.location.search).get('msg');
    return m || null;
  });
  const [checkedSteps, setCheckedSteps] = useState({});
  const [expandedTip, setExpandedTip] = useState(null);
  const [punchUsed, setPunchUsed] = useState({ cleanings: 0, appointments: 0 });
  const [punchConfirm, setPunchConfirm] = useState(null); // "cleaning" | "appointment" | null
  const [achievements, setAchievements] = useState([]);
  const [dobVerified, setDobVerified] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('aided_dob_verified') === 'true'
  );
  // 'unseen' | 'dismissed' | 'subscribed' | 'denied' — UI hint only; truth is
  // pushSubscribed + Notification.permission.
  const [notifPrompt, setNotifPrompt] = useState(() =>
    (typeof window !== 'undefined' && localStorage.getItem('aided_notif_state')) || 'unseen'
  );
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);

  // Load punch card state from Supabase (or skip for demo patient)
  useEffect(() => {
    if (!patient || patient.id === 'DEMO01') return;
    (async () => {
      try {
        const { data } = await supabase
          .from('punch_card_usage')
          .select('cleanings, appointments')
          .eq('patient_id', patient.id)
          .single();
        if (data) {
          setPunchUsed({ cleanings: data.cleanings, appointments: data.appointments });
        }
      } catch {}
    })();
  }, [patient?.id]);

  // Load achievements from Supabase (skip for demo patient)
  useEffect(() => {
    if (!patient || patient.id === 'DEMO01') { setAchievements([]); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from('patient_achievements')
          .select('achievement, earned_at')
          .eq('patient_id', patient.id)
          .order('earned_at', { ascending: true });
        if (data?.length) setAchievements(data);
      } catch {}
    })();
  }, [patient?.id]);

  // Inbox: load messages + unread count whenever the patient changes or the
  // user returns to the Inbox tab (reading on another device should reflect
  // here on re-entry). Demo patient has no real rows; skip the network call.
  const refreshInbox = async (pid) => {
    if (!pid || pid === 'DEMO01') {
      setInboxMessages([]);
      setUnreadCount(0);
      return;
    }
    try {
      const [msgs, unread] = await Promise.all([
        listInboxMessages(pid),
        countUnreadMessages(pid),
      ]);
      setInboxMessages(msgs);
      setUnreadCount(unread);
    } catch (err) {
      console.warn('Inbox load failed:', err);
    }
  };

  useEffect(() => { refreshInbox(patient?.id); }, [patient?.id]);
  useEffect(() => {
    if (tab === 'inbox') refreshInbox(patient?.id);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a message is expanded (either via tap or via the ?msg=<id> deep link),
  // flip read_at server-side and update local state so the unread badge clears.
  useEffect(() => {
    if (!expandedInboxId) return;
    const msg = inboxMessages.find(m => m.id === expandedInboxId);
    if (!msg || msg.read_at) return;
    (async () => {
      try {
        await markMessageRead(expandedInboxId);
        setInboxMessages(rows => rows.map(r =>
          r.id === expandedInboxId ? { ...r, read_at: new Date().toISOString() } : r
        ));
        setUnreadCount(c => Math.max(0, c - 1));
      } catch (err) {
        console.warn('markMessageRead failed:', err);
      }
    })();
  }, [expandedInboxId, inboxMessages]);

  const savePunch = async (next) => {
    setPunchUsed(next);
    if (!patient || patient.id === 'DEMO01') return; // Don't persist demo data
    try {
      await supabase.from('punch_card_usage').upsert({
        patient_id: patient.id,
        cleanings: next.cleanings,
        appointments: next.appointments,
        updated_at: new Date().toISOString()
      }, { onConflict: 'patient_id' });
    } catch (err) {
      console.warn('Punch card save failed:', err);
    }
  };

  const usePunch = async (type) => {
    const key = type === "cleaning" ? "cleanings" : "appointments";
    const limit = type === "cleaning" ? 12 : 16;
    if (punchUsed[key] >= limit) return;
    const next = { ...punchUsed, [key]: punchUsed[key] + 1 };
    await savePunch(next);
    setPunchConfirm(null);
  };

  const undoPunch = async (type) => {
    const key = type === "cleaning" ? "cleanings" : "appointments";
    if (punchUsed[key] <= 0) return;
    const next = { ...punchUsed, [key]: punchUsed[key] - 1 };
    await savePunch(next);
  };

  useEffect(() => {
    const loadPatient = async (patientId) => {
      try {
        const { data: patientData } = await supabase
          .from('patients')
          .select(`
            *,
            insurance_coverage(*),
            device_fittings(
              *,
              device_sides(*)
            ),
            appointments(*)
          `)
          .eq('id', patientId)
          .single();

        if (patientData) {
          if (patientData.clinic_id) {
            const { data: clinic } = await supabase
              .from('clinics')
              .select('name')
              .eq('id', patientData.clinic_id)
              .single();
            if (clinic?.name) setClinicName(clinic.name);
          }
          setPatient(mapSupabasePatientToAidedShape(patientData));
          return true;
        }
      } catch (err) {
        console.warn('Patient load failed:', err);
      }
      return false;
    };

    (async () => {
      // 1. URL param (fresh QR scan) — save and load
      const pid = new URLSearchParams(window.location.search).get('pid');
      if (pid) {
        localStorage.setItem('aided_pid', pid);
        if (!(await loadPatient(pid))) setPatient(DEMO);
        return;
      }

      // 2. localStorage pid (PWA reopen)
      const savedPid = localStorage.getItem('aided_pid');
      if (savedPid) {
        if (!(await loadPatient(savedPid))) setPatient(DEMO);
        return;
      }

      // 3. Future: authenticated patient login
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          if (!(await loadPatient(sessionData.session.user.id))) setPatient(DEMO);
          return;
        }
      } catch {}

      // 4. No identifier — DEMO mode
      setPatient(DEMO);
    })();
  }, []);

  // Reconcile push subscription state on mount + whenever the patient changes.
  // Handles browser-rotated subscriptions: if the local endpoint differs from
  // what was last sent to the server, we re-POST it. Catches the
  // pushsubscriptionchange case without explicit SW message wiring.
  useEffect(() => {
    if (!patient || patient.id === 'DEMO01') {
      setPushSubscribed(false);
      return;
    }
    (async () => {
      const sub = await getActiveSubscription();
      if (!sub) {
        setPushSubscribed(false);
        return;
      }
      // We have a local subscription. Make sure the server has the current
      // endpoint for this patient. Cheap to re-POST — the edge fn upserts.
      const ok = await postSubscription(patient.id, sub);
      setPushSubscribed(ok);
    })();
  }, [patient?.id]);

  const enableNotifications = async () => {
    if (!patient || patient.id === 'DEMO01' || notifBusy) return;
    setNotifBusy(true);
    try {
      const result = await subscribeToPush(patient.id);
      if (result.ok) {
        setPushSubscribed(true);
        setNotifPrompt('subscribed');
        localStorage.setItem('aided_notif_state', 'subscribed');
      } else if (result.reason === 'denied') {
        setNotifPrompt('denied');
        localStorage.setItem('aided_notif_state', 'denied');
      } else {
        // 'default' (user dismissed prompt), 'unsupported', 'server_error'
        setNotifPrompt('dismissed');
        localStorage.setItem('aided_notif_state', 'dismissed');
      }
    } finally {
      setNotifBusy(false);
    }
  };

  const disableNotifications = async () => {
    if (notifBusy) return;
    setNotifBusy(true);
    try {
      await unsubscribeFromPush();
      setPushSubscribed(false);
      setNotifPrompt('dismissed');
      localStorage.setItem('aided_notif_state', 'dismissed');
    } finally {
      setNotifBusy(false);
    }
  };

  const dismissNotifPrompt = () => {
    setNotifPrompt('dismissed');
    localStorage.setItem('aided_notif_state', 'dismissed');
  };

  if (!patient) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"system-ui",color:"#6b7280"}}>
      Loading your profile…
    </div>
  );

  // DOB gate for real patients only. Demo skips entirely.
  if (patient.id !== 'DEMO01' && !dobVerified) {
    return <DobGate patient={patient} onVerified={() => setDobVerified(true)} />;
  }

  const p = patient;
  const warrantyDays = daysUntil(p.devices?.warrantyExpiry);
  const fittingDaysAgo = daysAgo(p.devices?.fittingDate);
  const nextAppt = (p.appointments||[]).filter(a=>daysUntil(a.date)>=0).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
  const warrantyPct = Math.max(0,Math.min(100, warrantyDays / ((p.carePlan==="complete"?4:3)*365) * 100));

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f7; }
    .app { max-width: 390px; margin: 0 auto; background: #f5f5f7; min-height: 100vh; display: flex; flex-direction: column; position: relative; }
    /* STATUS BAR */
    .status-bar { background: #0a1628; padding: 12px 20px 0; display: flex; justify-content: space-between; align-items: center; }
    .sb-logo { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.5); letter-spacing: 1px; }
    .sb-icons { font-size: 12px; color: rgba(255,255,255,0.5); }
    /* HEADER */
    .header { background: #0a1628; padding: 16px 20px 24px; color: white; }
    .header-greeting { font-size: 13px; color: rgba(255,255,255,0.5); margin-bottom: 4px; }
    .header-name { font-size: 24px; font-weight: 800; }
    /* SCROLL CONTENT */
    .scroll-content { flex: 1; overflow-y: auto; padding-bottom: 80px; }
    .section { padding: 0 16px; margin-bottom: 20px; }
    /* CARDS */
    .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .card-pad { padding: 16px; }
    .card-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #9ca3af; margin-bottom: 14px; }
    /* DEVICE CARD */
    .device-hero { background: linear-gradient(135deg, #0a1628 0%, #1a3050 100%); padding: 20px; color: white; }
    .device-mfr { font-size: 11px; font-weight: 600; letter-spacing: 2px; opacity: 0.5; text-transform: uppercase; margin-bottom: 6px; }
    .device-model { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
    .device-style { font-size: 12px; opacity: 0.55; }
    .device-specs { padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
    .spec-item { padding: 10px; border-bottom: 1px solid #f5f5f7; }
    .spec-item:nth-child(odd) { border-right: 1px solid #f5f5f7; }
    .spec-key { font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px; }
    .spec-val { font-size: 13px; font-weight: 600; color: #0a1628; }
    /* WARRANTY */
    .warranty-block { padding: 16px; }
    .warranty-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .warranty-label { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; }
    .warranty-days { font-size: 24px; font-weight: 800; color: ${warrantyDays > 180 ? "#16a34a" : warrantyDays > 60 ? "#f59e0b" : "#ef4444"}; }
    .warranty-sub { font-size: 11px; color: #9ca3af; }
    .progress-track { height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 4px; background: ${warrantyDays > 180 ? "linear-gradient(90deg,#16a34a,#4ade80)" : warrantyDays > 60 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" : "linear-gradient(90deg,#ef4444,#f87171)"}; transition: width 0.6s ease; }
    /* NEXT APPT */
    .appt-card { background: linear-gradient(135deg, #1a6b5a, #2d9b7e); padding: 18px; color: white; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; }
    .appt-date-big { font-size: 32px; font-weight: 800; line-height: 1; }
    .appt-month { font-size: 12px; opacity: 0.65; margin-bottom: 4px; }
    .appt-type { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
    .appt-countdown { font-size: 12px; opacity: 0.7; }
    .appt-icon { font-size: 40px; opacity: 0.4; }
    /* CLEANING */
    .clean-step { display: flex; gap: 14px; align-items: flex-start; padding: 14px 16px; border-bottom: 1px solid #f5f5f7; transition: background 0.15s; cursor: pointer; }
    .clean-step:last-child { border-bottom: none; }
    .clean-step.done { opacity: 0.45; }
    .clean-check { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #e5e7eb; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; transition: all 0.2s; }
    .clean-check.checked { background: #16a34a; border-color: #16a34a; color: white; }
    .clean-icon { font-size: 20px; flex-shrink: 0; }
    .clean-title { font-size: 14px; font-weight: 600; color: #0a1628; }
    .clean-desc { font-size: 12px; color: #6b7280; margin-top: 3px; line-height: 1.5; }
    /* TROUBLESHOOT */
    .tip-row { padding: 14px 16px; border-bottom: 1px solid #f5f5f7; cursor: pointer; }
    .tip-row:last-child { border-bottom: none; }
    .tip-q { font-size: 14px; font-weight: 600; color: #0a1628; display: flex; justify-content: space-between; }
    .tip-a { font-size: 13px; color: #6b7280; margin-top: 8px; line-height: 1.6; }
    /* SCHEDULE */
    .appt-row { display: flex; gap: 14px; padding: 14px 16px; border-bottom: 1px solid #f5f5f7; align-items: center; }
    .appt-row:last-child { border-bottom: none; }
    .appt-dot { width: 10px; height: 10px; border-radius: 50%; background: #0a1628; flex-shrink: 0; margin-top: 4px; }
    .appt-dot.past { background: #d1d5db; }
    .appt-row-date { font-size: 13px; font-weight: 700; color: #0a1628; }
    .appt-row-type { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .appt-row-countdown { margin-left: auto; font-size: 11px; font-weight: 600; color: #16a34a; }
    /* BOTTOM NAV */
    .bottom-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 390px; max-width: 100%; background: rgba(255,255,255,0.95); backdrop-filter: blur(20px); border-top: 1px solid rgba(0,0,0,0.08); padding: 8px 0 calc(16px + env(safe-area-inset-bottom, 0px)); display: flex; }
    .nav-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; padding: 4px 0; }
    .nav-tab-icon { font-size: 22px; }
    .nav-tab-label { font-size: 10px; font-weight: 600; color: #9ca3af; letter-spacing: 0.3px; }
    .nav-tab.active .nav-tab-label { color: #0a1628; }
    .nav-tab.active .nav-tab-icon { transform: scale(1.1); }
    /* PUNCH CARD */
    .punch-card { background: linear-gradient(135deg, #1a3050 0%, #0a1628 100%); border-radius: 18px; padding: 20px; color: white; }
    .punch-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .punch-card-title { font-size: 18px; font-weight: 800; }
    .punch-card-sub { font-size: 11px; opacity: 0.5; margin-top: 3px; }
    .punch-card-badge { background: rgba(74,222,128,0.15); border: 1px solid rgba(74,222,128,0.3); border-radius: 20px; padding: 4px 12px; font-size: 11px; font-weight: 700; color: #4ade80; }
    .punch-section { margin-bottom: 16px; }
    .punch-section-label { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; opacity: 0.5; text-transform: uppercase; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    .punch-dots { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 10px; }
    .punch-dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 13px; transition: all 0.2s; cursor: default; }
    .punch-dot.used { background: #4ade80; border-color: #4ade80; }
    .punch-use-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; color: white; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: background 0.15s; }
    .punch-use-btn:hover { background: rgba(255,255,255,0.18); }
    .punch-use-btn:disabled { opacity: 0.3; cursor: default; }
    .punch-confirm-bar { background: rgba(74,222,128,0.12); border: 1px solid rgba(74,222,128,0.25); border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
    .punch-confirm-text { font-size: 12px; color: #4ade80; font-weight: 600; }
    .punch-confirm-btns { display: flex; gap: 8px; }
    .punch-confirm-yes { background: #4ade80; color: #0a1628; border: none; border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; }
    .punch-confirm-no { background: transparent; color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; }
    .punch-undo { font-size: 11px; color: rgba(255,255,255,0.35); cursor: pointer; text-decoration: underline; margin-left: 8px; }
    .punch-exhausted { text-align: center; padding: 8px; font-size: 12px; color: #4ade80; font-weight: 700; }
    /* HOME PUNCH MINI */
    .punch-mini { background: linear-gradient(135deg,#1a3050,#0a1628); border-radius: 16px; padding: 16px 18px; color: white; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
    .punch-mini-left { }
    .punch-mini-title { font-size: 14px; font-weight: 700; }
    .punch-mini-sub { font-size: 11px; opacity: 0.5; margin-top: 2px; }
    .punch-mini-pills { display: flex; gap: 10px; }
    .punch-mini-pill { text-align: center; }
    .punch-mini-num { font-size: 20px; font-weight: 800; color: #4ade80; }
    .punch-mini-label { font-size: 9px; opacity: 0.5; letter-spacing: 0.5px; text-transform: uppercase; }
    .profile-id { font-size: 10px; font-weight: 600; color: #16a34a; font-family: monospace; background: rgba(22,163,74,0.1); padding: 2px 8px; border-radius: 10px; margin-top: 4px; display: inline-block; }
    /* SECTION PADDING TOP */
    .pt-section { padding-top: 20px; }
    /* PWA STANDALONE MODE — hide simulated status bar, respect iOS safe areas */
    @media (display-mode: standalone) {
      html, body { background: #0a1628; }
      .status-bar { display: none; }
      .header { padding-top: calc(16px + env(safe-area-inset-top, 0px)); }
    }
  `;

  const renderHome = () => (
    <>
      <div className="header">
        <div className="header-greeting">Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"},</div>
        <div className="header-name">{p.name.split(" ")[0]} 👋</div>
        <div className="profile-id">ID: {p.id}</div>
      </div>
      <div className="scroll-content">
        {nextAppt && (
          <div className="section pt-section">
            <div className="card-label" style={{paddingLeft:4,marginBottom:8}}>Next Appointment</div>
            <div className="appt-card">
              <div>
                <div className="appt-month">{new Date(nextAppt.date).toLocaleDateString("en-US",{month:"long",year:"numeric"})}</div>
                <div className="appt-type">{nextAppt.type}</div>
                <div className="appt-countdown">
                  {daysUntil(nextAppt.date) === 0 ? "Today!" : `In ${daysUntil(nextAppt.date)} days`}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div className="appt-date-big">{new Date(nextAppt.date).getDate()}</div>
                <div style={{fontSize:12,opacity:0.65,marginTop:2}}>
                  {new Date(nextAppt.date).toLocaleDateString("en-US",{weekday:"short"})}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="section">
          <div className="card-label" style={{paddingLeft:4,marginBottom:8}}>My Devices</div>
          <div className="card">
            <div className="device-hero">
              <div className="device-mfr">{p.devices?.manufacturer}</div>
              <div className="device-model">{p.devices?.model}</div>
              <div className="device-style">{p.devices?.style?.toUpperCase()} · {p.devices?.color} · {p.devices?.battery}</div>
            </div>
            <div className="warranty-block">
              <div className="warranty-top">
                <div>
                  <div className="warranty-label">Warranty</div>
                  <div style={{fontSize:12,color:"#9ca3af",marginTop:2}}>Expires {fmtDate(p.devices?.warrantyExpiry)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div className="warranty-days">{warrantyDays > 0 ? `${warrantyDays}d` : "Expired"}</div>
                  <div className="warranty-sub">remaining</div>
                </div>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{width:`${warrantyPct}%`}} />
              </div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="card-label" style={{paddingLeft:4,marginBottom:8}}>Quick Actions</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[["🧹","Clean Guide",()=>setTab("care")],["💬","Get Help",()=>setTab("help")],["📅","Schedule",()=>setTab("schedule")],["🎧","Device Info",()=>setTab("devices")]].map(([icon,label,action])=>(
              <div key={label} onClick={action} style={{background:"white",borderRadius:14,padding:"16px",textAlign:"center",cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
                <div style={{fontSize:26,marginBottom:6}}>{icon}</div>
                <div style={{fontSize:13,fontWeight:600,color:"#0a1628"}}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="card-label" style={{paddingLeft:4,marginBottom:8}}>Care Plan</div>
          {p.carePlan === "punch" ? (
            <div className="punch-mini" onClick={()=>setTab("care")}>
              <div className="punch-mini-left">
                <div className="punch-mini-title">MHC Punch Card</div>
                <div className="punch-mini-sub">Tap to use a visit · {(12 - punchUsed.cleanings) + (16 - punchUsed.appointments)} visits remaining</div>
              </div>
              <div className="punch-mini-pills">
                <div className="punch-mini-pill">
                  <div className="punch-mini-num">{12 - punchUsed.cleanings}</div>
                  <div className="punch-mini-label">Cleanings</div>
                </div>
                <div className="punch-mini-pill">
                  <div className="punch-mini-num">{16 - punchUsed.appointments}</div>
                  <div className="punch-mini-label">Appts</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-pad" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#0a1628"}}>{CARE_PLAN_LABELS[p.carePlan]||p.carePlan}</div>
                  <div style={{fontSize:12,color:"#9ca3af",marginTop:3}}>{p.location}</div>
                </div>
                <div style={{fontSize:28}}>✅</div>
              </div>
            </div>
          )}
        </div>

        {/* Achievements — only show if the patient has earned any */}
        {achievements.length > 0 && (
          <div className="section">
            <div className="card-label" style={{paddingLeft:4,marginBottom:8}}>Achievements</div>
            <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
              {achievements.map((a, i) => {
                const display = ACHIEVEMENT_DISPLAY[a.achievement];
                if (!display) return null;
                return (
                  <div key={i} style={{
                    minWidth:100,flexShrink:0,background:"white",borderRadius:14,padding:"14px 12px",
                    textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"
                  }}>
                    <div style={{fontSize:28,marginBottom:6}}>{display.emoji}</div>
                    <div style={{fontSize:12,fontWeight:700,color:"#0a1628",marginBottom:4}}>{display.label}</div>
                    <div style={{fontSize:10,color:"#9ca3af"}}>{fmtDate(a.earned_at)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );

  const renderDevices = () => (
    <>
      <div className="header">
        <div className="header-greeting">Device Specifications</div>
        <div className="header-name">{p.devices?.manufacturer}</div>
      </div>
      <div className="scroll-content">
        <div className="section pt-section">
          <div className="card">
            <div className="device-hero">
              <div className="device-mfr">{p.devices?.manufacturer}</div>
              <div className="device-model">{p.devices?.model}</div>
              <div className="device-style">{p.devices?.style?.toUpperCase()} · {p.devices?.battery}</div>
            </div>
            <div className="device-specs">
              {[["Color",p.devices?.color||"N/A"],["Battery",p.devices?.battery],["Receiver",p.devices?.receiver||"N/A"],["Dome",p.devices?.dome||"N/A"],["Serial (L)",p.devices?.serialLeft],["Serial (R)",p.devices?.serialRight]].map(([k,v])=>(
                <div className="spec-item" key={k}><div className="spec-key">{k}</div><div className="spec-val">{v}</div></div>
              ))}
            </div>
          </div>
        </div>

        <div className="section">
          <div className="card-label" style={{paddingLeft:4,marginBottom:8}}>Warranty</div>
          <div className="card">
            <div className="warranty-block">
              <div className="warranty-top">
                <div>
                  <div className="warranty-label">Warranty Status</div>
                  <div style={{fontSize:12,color:"#9ca3af",marginTop:2}}>Fitted {fmtDate(p.devices?.fittingDate)} · {fittingDaysAgo} days ago</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div className="warranty-days">{warrantyDays > 0 ? `${warrantyDays}d` : "Expired"}</div>
                  <div className="warranty-sub">remaining</div>
                </div>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{width:`${warrantyPct}%`}} />
              </div>
              <div style={{marginTop:12,fontSize:12,color:"#6b7280"}}>Expires {fmtDate(p.devices?.warrantyExpiry)}</div>
              {p.carePlan === "complete" && (
                <div style={{marginTop:8,background:"#dcfce7",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#16a34a",fontWeight:600}}>
                  ✓ Extended to 4 years with Complete Care+
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="section">
          <div className="card-label" style={{paddingLeft:4,marginBottom:8}}>Insurance Coverage</div>
          <div className="card">
            <div className="card-pad">
              {p.payType === "insurance" ? (
                [["Carrier",p.insurance?.carrier],["Plan",p.insurance?.planGroup],["TPA",p.insurance?.tpa],["Tier",p.insurance?.tier],["Copay",`$${p.insurance?.tierPrice?.toLocaleString()} per aid`]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f5f5f7",fontSize:13}}>
                    <span style={{color:"#9ca3af"}}>{k}</span>
                    <span style={{fontWeight:600,color:"#0a1628"}}>{v}</span>
                  </div>
                ))
              ) : (
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:"#0a1628"}}>Private Pay</div>
                  <div style={{fontSize:12,color:"#6b7280",marginTop:6,lineHeight:1.5}}>Contact your clinic for current pricing.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderCare = () => {
    const checkedCount = Object.values(checkedSteps).filter(Boolean).length;
    return (
      <>
        <div className="header">
          <div className="header-greeting">Cleaning & Care</div>
          <div className="header-name">Daily Routine</div>
        </div>
        <div className="scroll-content">

          {/* PUNCH CARD — read-only for patients, punched by clinic */}
          {p.carePlan === "punch" && (() => {
            const cleanLeft = 12 - punchUsed.cleanings;
            const apptLeft = 16 - punchUsed.appointments;
            const totalLeft = cleanLeft + apptLeft;
            const allUsed = totalLeft === 0;
            return (
              <div className="section pt-section">
                <div className="card-label" style={{paddingLeft:4,marginBottom:8}}>MHC Punch Card</div>
                <div className="punch-card">
                  <div className="punch-card-header">
                    <div>
                      <div className="punch-card-title">My Punch Card</div>
                      <div className="punch-card-sub">Punched by your specialist at each visit</div>
                    </div>
                    <div className="punch-card-badge">{totalLeft} left</div>
                  </div>

                  {/* CLEANINGS */}
                  <div className="punch-section">
                    <div className="punch-section-label">
                      <span>🧹 Cleanings</span>
                      <span style={{color:"#4ade80"}}>{punchUsed.cleanings}/12 used</span>
                    </div>
                    <div className="punch-dots">
                      {Array.from({length:12},(_,i) => (
                        <div key={i} className={`punch-dot ${i < punchUsed.cleanings ? "used" : ""}`}>
                          {i < punchUsed.cleanings ? "✓" : ""}
                        </div>
                      ))}
                    </div>
                    {cleanLeft === 0 && <div className="punch-exhausted">All 12 cleaning visits used ✓</div>}
                  </div>

                  {/* APPOINTMENTS */}
                  <div className="punch-section" style={{marginBottom:0}}>
                    <div className="punch-section-label">
                      <span>📅 Appointments</span>
                      <span style={{color:"#4ade80"}}>{punchUsed.appointments}/16 used</span>
                    </div>
                    <div className="punch-dots">
                      {Array.from({length:16},(_,i) => (
                        <div key={i} className={`punch-dot ${i < punchUsed.appointments ? "used" : ""}`}>
                          {i < punchUsed.appointments ? "✓" : ""}
                        </div>
                      ))}
                    </div>
                    {apptLeft === 0 && <div className="punch-exhausted">All 16 appointment visits used ✓</div>}
                  </div>

                  {allUsed && (
                    <div style={{marginTop:14,background:"rgba(74,222,128,0.1)",borderRadius:10,padding:"12px",textAlign:"center",fontSize:13,color:"#4ade80",fontWeight:700}}>
                      🎉 All visits used! Your clinic will be in touch about next steps.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="section pt-section">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div className="card-label" style={{paddingLeft:4}}>Cleaning Checklist</div>
              {checkedCount > 0 && (
                <div style={{fontSize:12,color:"#16a34a",fontWeight:600,cursor:"pointer"}} onClick={()=>setCheckedSteps({})}>Reset</div>
              )}
            </div>
            <div className="card">
              {CLEANING_STEPS.map((s,i)=>(
                <div key={i} className={`clean-step ${checkedSteps[i]?"done":""}`} onClick={()=>setCheckedSteps(c=>({...c,[i]:!c[i]}))}>
                  <div className={`clean-check ${checkedSteps[i]?"checked":""}`}>{checkedSteps[i]?"✓":""}</div>
                  <div style={{fontSize:22,flexShrink:0}}>{s.icon}</div>
                  <div>
                    <div className="clean-title">{s.title}</div>
                    <div className="clean-desc">{s.desc}</div>
                  </div>
                </div>
              ))}
              {checkedCount === CLEANING_STEPS.length && (
                <div style={{padding:"14px 16px",background:"#dcfce7",textAlign:"center",fontSize:14,fontWeight:700,color:"#16a34a"}}>
                  ✓ All done! Great job caring for your devices.
                </div>
              )}
            </div>
          </div>

          <div className="section">
            <div className="card-label" style={{paddingLeft:4,marginBottom:8}}>Troubleshooting</div>
            <div className="card">
              {TROUBLESHOOT_TIPS.map((t,i)=>(
                <div key={i} className="tip-row" onClick={()=>setExpandedTip(expandedTip===i?null:i)}>
                  <div className="tip-q">{t.q}<span>{expandedTip===i?"▲":"▼"}</span></div>
                  {expandedTip===i && <div className="tip-a">{t.a}</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="card" style={{background:"linear-gradient(135deg,#0a1628,#1a3050)",padding:"18px"}}>
              <div style={{fontSize:16,fontWeight:700,color:"white",marginBottom:6}}>Need more help?</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginBottom:14}}>Call your clinic or see the Help tab for troubleshooting tips.</div>
              <div style={{background:"#4ade80",borderRadius:8,padding:"10px",textAlign:"center",cursor:"pointer",fontWeight:700,fontSize:14,color:"#0a1628"}} onClick={()=>setTab("help")}>
                Open Help →
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderSchedule = () => {
    const allAppts = [...(p.appointments||[])].sort((a,b)=>new Date(a.date)-new Date(b.date));
    const upcomingCount = allAppts.filter(a => daysUntil(a.date) >= 0).length;
    const showNotifPrompt = (
      patient.id !== 'DEMO01' &&
      pushSupported() &&
      !pushSubscribed &&
      notifPrompt === 'unseen' &&
      upcomingCount > 0 &&
      Notification.permission !== 'denied'
    );
    return (
      <>
        <div className="header">
          <div className="header-greeting">My Appointments</div>
          <div className="header-name">{p.location || clinicName}</div>
        </div>
        <div className="scroll-content">
          {showNotifPrompt && (
            <div className="section pt-section">
              <div style={{
                background:"linear-gradient(135deg,#1a3050,#0a1628)", borderRadius:16,
                padding:"18px", color:"white", position:"relative",
              }}>
                <div style={{fontSize:24,marginBottom:8}}>🔔</div>
                <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>Want a heads-up before your next visit?</div>
                <div style={{fontSize:13,opacity:0.7,lineHeight:1.5,marginBottom:14}}>
                  Get a reminder 24 hours before each appointment, plus monthly cleaning prompts.
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button
                    onClick={enableNotifications}
                    disabled={notifBusy}
                    style={{
                      flex:1, background:"#4ade80", color:"#0a1628", border:"none",
                      borderRadius:8, padding:"10px", fontSize:13, fontWeight:700,
                      fontFamily:"inherit", cursor: notifBusy ? "default" : "pointer",
                      opacity: notifBusy ? 0.6 : 1,
                    }}>
                    {notifBusy ? "…" : "Turn on"}
                  </button>
                  <button
                    onClick={dismissNotifPrompt}
                    style={{
                      flex:1, background:"transparent", color:"rgba(255,255,255,0.6)",
                      border:"1px solid rgba(255,255,255,0.2)", borderRadius:8,
                      padding:"10px", fontSize:13, fontWeight:600, fontFamily:"inherit", cursor:"pointer",
                    }}>
                    Not now
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className={`section ${showNotifPrompt ? '' : 'pt-section'}`}>
            <div className="card-label" style={{paddingLeft:4,marginBottom:8}}>Upcoming</div>
            <div className="card">
              {allAppts.filter(a=>daysUntil(a.date)>=0).length === 0 ? (
                <div style={{padding:"24px",textAlign:"center",color:"#9ca3af",fontSize:14}}>No upcoming appointments scheduled</div>
              ) : allAppts.filter(a=>daysUntil(a.date)>=0).map((a,i)=>(
                <div className="appt-row" key={i}>
                  <div className="appt-dot" />
                  <div>
                    <div className="appt-row-date">{fmtDate(a.date)}</div>
                    <div className="appt-row-type">{a.type}</div>
                  </div>
                  <div className="appt-row-countdown">
                    {daysUntil(a.date)===0?"Today":daysUntil(a.date)===1?"Tomorrow":`${daysUntil(a.date)} days`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="card-label" style={{paddingLeft:4,marginBottom:8}}>Past Appointments</div>
            <div className="card">
              <div className="appt-row">
                <div className="appt-dot past" />
                <div>
                  <div className="appt-row-date">{fmtDate(p.devices?.fittingDate)}</div>
                  <div className="appt-row-type">Initial Fitting</div>
                </div>
                <div style={{marginLeft:"auto",fontSize:11,color:"#9ca3af"}}>{fittingDaysAgo}d ago</div>
              </div>
            </div>
          </div>

          <div className="section">
            <div style={{background:"#f0fdf4",borderRadius:14,padding:"16px",border:"1px solid #bbf7d0"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#16a34a",marginBottom:4}}>📞 To reschedule or book</div>
              <div style={{fontSize:13,color:"#374151"}}>Call your clinic directly or request an appointment through the {clinicName} website.</div>
            </div>
          </div>
        </div>
      </>
    );
  };

  // ── INBOX ─────────────────────────────────────────────────────────────────
  // Longer-form messages from the clinic. Push notifications drop a toast
  // with a preview; the full message lives here. Tap to expand — that also
  // flips read_at via the mark_message_read RPC (see migration 014).
  const renderInbox = () => {
    if (patient.id === 'DEMO01') {
      return (
        <>
          <div className="header">
            <div className="header-greeting">Inbox</div>
            <div className="header-sub">Messages from your clinic</div>
          </div>
          <div className="section">
            <div className="card"><div className="card-pad">
              <div className="card-label">Demo Mode</div>
              <div style={{fontSize:13,color:"#6b7280",lineHeight:1.55}}>
                Once you scan your clinic's QR code, real messages from your provider will show up here.
              </div>
            </div></div>
          </div>
        </>
      );
    }
    return (
      <>
        <div className="header">
          <div className="header-greeting">Inbox</div>
          <div className="header-sub">
            {inboxMessages.length === 0
              ? "Messages from your clinic will show up here"
              : `${inboxMessages.length} message${inboxMessages.length === 1 ? "" : "s"}${unreadCount > 0 ? ` · ${unreadCount} unread` : ""}`}
          </div>
        </div>
        <div className="section">
          {inboxMessages.length === 0 ? (
            <div className="card"><div className="card-pad">
              <div style={{fontSize:32,textAlign:"center",marginBottom:8}}>📭</div>
              <div style={{fontSize:14,fontWeight:600,color:"#0a1628",textAlign:"center",marginBottom:6}}>No messages yet</div>
              <div style={{fontSize:12,color:"#6b7280",textAlign:"center",lineHeight:1.55}}>
                When your clinic sends you a reminder, follow-up, or note, it will land here.
              </div>
            </div></div>
          ) : (
            <div className="card">
              {inboxMessages.map((m, i) => {
                const expanded = expandedInboxId === m.id;
                const unread = !m.read_at;
                return (
                  <div
                    key={m.id}
                    onClick={() => setExpandedInboxId(expanded ? null : m.id)}
                    style={{
                      padding: "14px 16px",
                      borderBottom: i === inboxMessages.length - 1 ? "none" : "1px solid #f5f5f7",
                      cursor: "pointer",
                      background: expanded ? "#f9fafb" : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: unread ? "#1d4ed8" : "transparent",
                        marginTop: 6, flexShrink: 0,
                      }} />
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{
                          fontSize: 14,
                          fontWeight: unread ? 700 : 500,
                          color: "#0a1628",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: expanded ? "normal" : "nowrap",
                        }}>{m.title}</div>
                        {!expanded && (
                          <div style={{
                            fontSize: 12, color: "#6b7280", marginTop: 3,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>{m.body}</div>
                        )}
                        <div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>{fmtDate(m.created_at)}</div>
                      </div>
                      <div style={{fontSize:12,color:"#9ca3af",marginTop:4}}>{expanded ? "▲" : "▼"}</div>
                    </div>
                    {expanded && (
                      <div style={{
                        fontSize: 14, color: "#374151", lineHeight: 1.6,
                        marginTop: 12, paddingTop: 12,
                        borderTop: "1px dashed #e5e7eb", whiteSpace: "pre-wrap",
                      }}>
                        {m.body}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  };

  const renderHelp = () => {
    const showNotifRow = patient.id !== 'DEMO01' && pushSupported();
    const permission = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
    const blocked = permission === 'denied';
    return (
    <>
      <div className="header">
        <div className="header-greeting">Need a hand?</div>
        <div className="header-name">We're here to help</div>
      </div>
      <div className="scroll-content">
        <div className="section" style={{paddingTop:16}}>
          <div className="card card-pad">
            <div className="card-label">Contact your clinic</div>
            <div style={{fontSize:15,fontWeight:700,color:"#0a1628",marginBottom:6}}>{clinicName}</div>
            {p.phone && <div style={{fontSize:14,color:"#374151",marginBottom:4}}>📞 {p.phone}</div>}
            {p.location && <div style={{fontSize:13,color:"#6b7280"}}>📍 {p.location}</div>}
            <div style={{fontSize:12,color:"#9ca3af",marginTop:12,lineHeight:1.5}}>
              Call your clinic for appointments, device issues, or any questions about your hearing care.
            </div>
          </div>
        </div>
        {showNotifRow && (
          <div className="section">
            <div className="card card-pad">
              <div className="card-label">Notifications</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600,color:"#0a1628"}}>Reminders & alerts</div>
                  <div style={{fontSize:12,color:"#6b7280",marginTop:4,lineHeight:1.5}}>
                    {blocked
                      ? "Blocked at the device level. Enable in your phone's notification settings."
                      : pushSubscribed
                      ? "On. You'll get appointment reminders, cleaning prompts, and warranty alerts."
                      : "Off. Turn on to get appointment reminders, cleaning prompts, and warranty alerts."}
                  </div>
                </div>
                {!blocked && (
                  <button
                    onClick={pushSubscribed ? disableNotifications : enableNotifications}
                    disabled={notifBusy}
                    style={{
                      flexShrink:0, width:52, height:30, borderRadius:15,
                      border:"none", padding:0, cursor: notifBusy ? "default" : "pointer",
                      background: pushSubscribed ? "#16a34a" : "#d1d5db",
                      position:"relative", transition:"background 0.2s",
                      opacity: notifBusy ? 0.6 : 1,
                    }}
                    aria-label={pushSubscribed ? "Disable notifications" : "Enable notifications"}>
                    <div style={{
                      position:"absolute", top:3, left: pushSubscribed ? 25 : 3,
                      width:24, height:24, borderRadius:"50%", background:"white",
                      transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="section">
          <div className="card">
            <div className="card-pad">
              <div className="card-label">Quick Troubleshooting</div>
            </div>
            {TROUBLESHOOT_TIPS.map((t,i)=>(
              <div key={i} className="tip-row" onClick={()=>setExpandedTip(expandedTip===i?null:i)}>
                <div className="tip-q">{t.q}<span>{expandedTip===i?"▲":"▼"}</span></div>
                {expandedTip===i && <div className="tip-a">{t.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
    );
  };

  const TABS = [
    { id:"home", icon:"🏠", label:"Home" },
    { id:"devices", icon:"🎧", label:"Devices" },
    { id:"care", icon:"🧹", label:"Care" },
    { id:"schedule", icon:"📅", label:"Schedule" },
    { id:"inbox", icon:"✉️", label:"Inbox" },
    { id:"help", icon:"💬", label:"Help" },
  ];

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="status-bar">
          <div className="sb-logo">AIDED · {clinicName.toUpperCase()}</div>
          <div className="sb-icons">●●● 📶 🔋</div>
        </div>
        {tab==="home" && renderHome()}
        {tab==="devices" && renderDevices()}
        {tab==="care" && renderCare()}
        {tab==="schedule" && renderSchedule()}
        {tab==="inbox" && renderInbox()}
        {tab==="help" && renderHelp()}
        <div className="bottom-nav">
          {TABS.map(t=>(
            <div key={t.id} className={`nav-tab ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
              <div className="nav-tab-icon" style={{position:"relative"}}>
                {t.icon}
                {t.id === "inbox" && unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -10,
                    background: "#ef4444", color: "white",
                    fontSize: 9, fontWeight: 700,
                    minWidth: 16, height: 16, padding: "0 4px",
                    borderRadius: 10, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    lineHeight: 1,
                  }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </div>
              <div className="nav-tab-label">{t.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
