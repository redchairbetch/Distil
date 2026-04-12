import { useState, useEffect, useRef } from "react";
import { supabase } from './supabase.js'

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

const CARE_PLAN_LABELS = { complete: "Complete Care+", punch: "Punch Card", paygo: "Pay-As-You-Go" };

function fmtDate(d) { return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function daysUntil(dateStr) { return Math.ceil((new Date(dateStr) - new Date()) / 86400000); }
function daysAgo(dateStr) { return Math.ceil((new Date() - new Date(dateStr)) / 86400000); }

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

export default function PatientApp() {
  const [patient, setPatient] = useState(null);
  const [clinicName, setClinicName] = useState("My Hearing Centers");
  const [tab, setTab] = useState("home");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your hearing care assistant. Ask me anything about your devices, cleaning, troubleshooting, or your upcoming appointments." }
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState({});
  const [expandedTip, setExpandedTip] = useState(null);
  const [punchUsed, setPunchUsed] = useState({ cleanings: 0, appointments: 0 });
  const [punchConfirm, setPunchConfirm] = useState(null); // "cleaning" | "appointment" | null
  const [achievements, setAchievements] = useState([]);
  const messagesEndRef = useRef(null);

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
    // Always render immediately with demo data — update if real Supabase session exists
    setPatient(DEMO);
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          const patientId = sessionData.session.user.id;

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
            // Load clinic name from clinics table using patient's clinic_id
            if (patientData.clinic_id) {
              const { data: clinic } = await supabase
                .from('clinics')
                .select('name')
                .eq('id', patientData.clinic_id)
                .single();
              if (clinic?.name) setClinicName(clinic.name);
            }

            const mapped = mapSupabasePatientToAidedShape(patientData);
            setPatient(mapped);
            return;
          }
        }
        // No session or no patient found — stay on DEMO
      } catch (err) {
        console.warn('Patient load failed, using demo:', err);
      }
    })();
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || chatLoading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(m => [...m, { role:"user", content: userMsg }]);
    setChatLoading(true);
    try {
      const p = patient || DEMO;
      const systemPrompt = `You are a friendly hearing care assistant for ${clinicName}. You're helping a patient named ${p.name} who wears ${p.devices?.manufacturer} ${p.devices?.model} hearing aids (${p.devices?.style?.toUpperCase()}, ${p.devices?.color}, ${p.devices?.battery} battery, ${p.devices?.receiver} receiver, ${p.devices?.dome} dome). Their care plan is ${CARE_PLAN_LABELS[p.carePlan] || p.carePlan}. Their warranty expires ${fmtDate(p.devices?.warrantyExpiry)}. Be warm, concise, and practical. Keep responses under 120 words. If they need urgent help, direct them to call the clinic.`;
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system: systemPrompt,
          messages: [...messages.filter(m=>m.role!=="system"), {role:"user",content:userMsg}]
        })
      });
      const data = await resp.json();
      const reply = data.content?.[0]?.text || "I'm sorry, I couldn't process that. Please try again.";
      setMessages(m => [...m, { role:"assistant", content: reply }]);
    } catch {
      setMessages(m => [...m, { role:"assistant", content:"I'm having trouble connecting right now. Please call your clinic directly if you need immediate help." }]);
    }
    setChatLoading(false);
  };

  if (!patient) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"system-ui",color:"#6b7280"}}>
      Loading your profile…
    </div>
  );

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
    /* CHAT */
    .chat-messages { padding: 16px; display: flex; flex-direction: column; gap: 12px; min-height: 300px; }
    .msg { max-width: 80%; }
    .msg.user { align-self: flex-end; }
    .msg.assistant { align-self: flex-start; }
    .msg-bubble { padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; }
    .msg.user .msg-bubble { background: #0a1628; color: white; border-bottom-right-radius: 4px; }
    .msg.assistant .msg-bubble { background: white; color: #1f2937; border-bottom-left-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .chat-input-bar { padding: 12px 16px; background: white; border-top: 1px solid #f3f4f6; display: flex; gap: 10px; }
    .chat-input { flex: 1; border: 1px solid #e5e7eb; border-radius: 22px; padding: 10px 16px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; }
    .chat-send { background: #0a1628; color: white; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 18px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .typing-dots { display: flex; gap: 4px; padding: 10px 14px; }
    .typing-dot { width: 7px; height: 7px; border-radius: 50%; background: #9ca3af; animation: bounce 1.2s infinite; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)} }
    .quick-chips { display: flex; gap: 8px; flex-wrap: wrap; padding: 0 16px 12px; }
    .chip { padding: 6px 14px; border-radius: 20px; border: 1px solid #e5e7eb; font-size: 12px; font-weight: 500; cursor: pointer; background: white; white-space: nowrap; }
    .chip:hover { background: #f9fafb; }
    /* BOTTOM NAV */
    .bottom-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 390px; max-width: 100%; background: rgba(255,255,255,0.95); backdrop-filter: blur(20px); border-top: 1px solid rgba(0,0,0,0.08); padding: 8px 0 16px; display: flex; }
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
                <div className="punch-mini-title">Treatment Punch Card</div>
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
                <div style={{fontSize:14,fontWeight:600,color:"#0a1628"}}>Private Pay – Standard of Care ($5,500)</div>
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
                <div className="card-label" style={{paddingLeft:4,marginBottom:8}}>Treatment Punch Card</div>
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
              <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginBottom:14}}>Chat with your hearing care AI assistant for personalized guidance.</div>
              <div style={{background:"#4ade80",borderRadius:8,padding:"10px",textAlign:"center",cursor:"pointer",fontWeight:700,fontSize:14,color:"#0a1628"}} onClick={()=>setTab("help")}>
                Open AI Assistant →
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderSchedule = () => {
    const allAppts = [...(p.appointments||[])].sort((a,b)=>new Date(a.date)-new Date(b.date));
    return (
      <>
        <div className="header">
          <div className="header-greeting">My Appointments</div>
          <div className="header-name">{p.location || clinicName}</div>
        </div>
        <div className="scroll-content">
          <div className="section pt-section">
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

  const renderHelp = () => (
    <>
      <div className="header">
        <div className="header-greeting">AI Assistant</div>
        <div className="header-name">How can I help?</div>
      </div>
      <div className="scroll-content" style={{display:"flex",flexDirection:"column"}}>
        <div className="quick-chips" style={{paddingTop:12}}>
          {["My device won't turn on","How do I clean my aids?","Warranty question","Book an appointment"].map(q=>(
            <div key={q} className="chip" onClick={()=>{ setInput(q); }}>{q}</div>
          ))}
        </div>
        <div className="chat-messages">
          {messages.map((m,i)=>(
            <div key={i} className={`msg ${m.role}`}>
              {m.role==="assistant" && <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",marginBottom:4,letterSpacing:1}}>HEARING CARE AI</div>}
              <div className="msg-bubble">{m.content}</div>
            </div>
          ))}
          {chatLoading && (
            <div className="msg assistant">
              <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",marginBottom:4,letterSpacing:1}}>HEARING CARE AI</div>
              <div className="msg-bubble" style={{padding:"8px 14px"}}>
                <div className="typing-dots">
                  <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-input-bar" style={{position:"sticky",bottom:80}}>
          <input className="chat-input" placeholder="Ask anything about your hearing aids…" value={input}
            onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage()} />
          <button className="chat-send" onClick={sendMessage}>↑</button>
        </div>
      </div>
    </>
  );

  const TABS = [
    { id:"home", icon:"🏠", label:"Home" },
    { id:"devices", icon:"🎧", label:"Devices" },
    { id:"care", icon:"🧹", label:"Care" },
    { id:"schedule", icon:"📅", label:"Schedule" },
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
        {tab==="help" && renderHelp()}
        <div className="bottom-nav">
          {TABS.map(t=>(
            <div key={t.id} className={`nav-tab ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
              <div className="nav-tab-icon">{t.icon}</div>
              <div className="nav-tab-label">{t.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
