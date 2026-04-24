import { useState, useEffect, useRef } from "react";

// Health History — provider clinical-review surface for an accepted intake.
// Renders the patient's intake responses as editable inputs, with a "+"
// affordance on each row that reveals a provider-note textarea. Used as
// step 1 of the wizard (between Patient and Testing) so the provider can
// walk through responses with the patient before testing begins.
//
// Save model: per-field on blur (no Save button — keeps the clinical
// flow frictionless). The parent owns the persistence write via the two
// onUpdate* callbacks; this component owns the transient "Saved ✓"
// indicator and which note rows are expanded.

const TEAL = "#0A7B8C";
const TEAL_BG = "#F0F9FA";
const TEAL_BORDER = "#B7DDE2";
const TEXT = "#0a1628";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

// US states for the address dropdown.
const US_STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],
  ["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],
  ["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],
  ["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],
  ["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],
  ["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],
  ["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],
  ["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],
  ["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],
  ["WY","Wyoming"],
];

// Multi-select option labels — mirror the kiosk so the provider sees
// the same choices the patient saw, in the same order. Stored values
// stay as the canonical English keys regardless of kiosk display lang.
const FAMILY_OPTIONS = [
  ["mother","Mother"],["father","Father"],
  ["grandparent_maternal","Maternal grandparent"],["grandparent_paternal","Paternal grandparent"],
  ["siblings","Siblings"],["children","Children"],["aunt_uncle","Aunt/uncle"],
  ["none","None known"],["unsure","Unsure"],
];
const NOISE_OCCUPATIONAL = [
  ["military","Military"],["construction","Construction"],["manufacturing","Manufacturing"],
  ["machinery","Heavy machinery"],["aviation","Aviation"],["emergency","Emergency services"],
  ["agriculture","Agriculture"],["other","Other"],
];
const NOISE_RECREATIONAL = [
  ["firearms","Firearms or hunting"],["power_tools","Power tools"],
  ["motorcycles","Motorcycles or ATVs"],["concerts","Concerts or live music"],
  ["lawn","Lawn or yard equipment"],["woodworking","Woodworking"],
  ["machinery","Loud machinery"],["other","Other"],
];
const RESISTANCE = [
  ["cost","Cost or affordability"],["cosmetics","Cosmetics or appearance"],
  ["denial","Didn't feel ready"],["bad_experience","Past bad experience"],
  ["stigma","Stigma"],["dont_know","Didn't know where to start"],
  ["fear_dependence","Fear of becoming dependent"],["other","Other"],
];

// Per-field render config. Order = display order within section.
// type: "text" | "textarea" | "tel" | "email" | "date" | "yesno" |
//       "radio" | "multiSelect" | "scale" | "state" | "gender"
// followUpKey: the answer key whose value we render indented underneath
//              when this field's value === showFollowUpWhen.
const SECTIONS = [
  {
    id: "about", label: "About You",
    fields: [
      { key:"firstName", label:"First name", type:"text" },
      { key:"mi", label:"MI", type:"text" },
      { key:"lastName", label:"Last name", type:"text" },
      { key:"dob", label:"Date of birth", type:"date" },
      { key:"gender", label:"Gender", type:"radio", options:[["male","Male"],["female","Female"],["preferNotSay","Prefer not to say"]] },
      { key:"street", label:"Street", type:"text" },
      { key:"apt", label:"Apt / unit", type:"text" },
      { key:"city", label:"City", type:"text" },
      { key:"state", label:"State", type:"state" },
      { key:"zip", label:"ZIP", type:"text" },
      { key:"homePhone", label:"Home phone", type:"tel" },
      { key:"mobilePhone", label:"Mobile phone", type:"tel" },
      { key:"mobileType", label:"Mobile device", type:"radio", options:[["iPhone","iPhone"],["android","Android"],["otherDevice","Other"]] },
      { key:"email", label:"Email", type:"email" },
      { key:"workPhone", label:"Work phone", type:"tel" },
      { key:"spouseName", label:"Spouse / partner name", type:"text" },
      { key:"spousePhone", label:"Spouse / partner phone", type:"tel" },
      { key:"spouseDob", label:"Spouse / partner DOB", type:"date" },
      { key:"emergencyName", label:"Emergency contact name", type:"text" },
      { key:"emergencyPhone", label:"Emergency contact phone", type:"tel" },
      { key:"pcp", label:"Primary care physician", type:"text" },
      { key:"visitReason", label:"Reason for visit today", type:"textarea" },
      { key:"referralSource", label:"How did they hear about us?", type:"text", followUpKey:"referralOther", followUpLabel:"Other (specify)" },
    ],
  },
  {
    id: "medical", label: "Medical History",
    fields: [
      { key:"med_pain", label:"Pain in either ear", type:"yesno" },
      { key:"med_drain", label:"Drainage from either ear", type:"yesno" },
      { key:"med_sudden", label:"Sudden hearing change", type:"yesno" },
      { key:"med_ring", label:"Ringing or noise in ears", type:"yesno" },
      { key:"med_dizzy", label:"Dizziness or vertigo", type:"yesno" },
      { key:"med_full", label:"Fullness or pressure", type:"yesno" },
      { key:"med_doctor", label:"Seen a doctor for hearing", type:"yesno", followUpKey:"med_doctor_when", followUpLabel:"When?" },
      { key:"med_surgery", label:"Ear surgery", type:"yesno" },
      { key:"med_thinner", label:"On blood thinners", type:"yesno" },
      { key:"med_diabetic", label:"Diabetic", type:"yesno",
        followUpKey:"med_diabetic_type", followUpLabel:"Type",
        followUpType:"radio", followUpOptions:[["type1","Type 1"],["type2","Type 2"]] },
      { key:"medFamilyHistory", label:"Family history of hearing loss", type:"multiSelect", options:FAMILY_OPTIONS },
      { key:"med_noise_occupational", label:"Occupational noise exposure", type:"yesno",
        followUpKey:"med_noise_occupational_types", followUpLabel:"Sources",
        followUpType:"multiSelect", followUpOptions:NOISE_OCCUPATIONAL,
        otherFollowUpKey:"med_noise_occupational_other", otherFollowUpLabel:"Other (describe)" },
      { key:"med_noise_recreational", label:"Recreational noise exposure", type:"yesno",
        followUpKey:"med_noise_recreational_types", followUpLabel:"Sources",
        followUpType:"multiSelect", followUpOptions:NOISE_RECREATIONAL,
        otherFollowUpKey:"med_noise_recreational_other", otherFollowUpLabel:"Other (describe)" },
    ],
  },
  {
    id: "hearing", label: "Hearing History",
    fields: [
      { key:"hear_tested", label:"Hearing tested before", type:"yesno",
        followUpKey:"hear_tested_when", followUpLabel:"When?",
        secondFollowUpKey:"hear_tested_results", secondFollowUpLabel:"Results / outcome" },
      { key:"hear_best", label:"Better-hearing ear", type:"radio",
        options:[["right","Right"],["left","Left"],["same","Same"]] },
      { key:"hear_mumble", label:"People sound like they mumble", type:"yesno" },
      { key:"hear_repeat", label:"Asks people to repeat", type:"yesno" },
      { key:"hear_understand", label:"Trouble understanding speech", type:"yesno" },
      { key:"hear_noisy", label:"Trouble in noisy places", type:"yesno" },
      { key:"hear_loud", label:"TV / music too loud for others", type:"yesno" },
      { key:"hear_tv", label:"Trouble hearing TV", type:"yesno" },
      { key:"hear_kids", label:"Trouble hearing children / women", type:"yesno" },
      { key:"hear_other", label:"Other listening challenges", type:"text" },
      { key:"hear_rating", label:"Self-rated hearing (1–10)", type:"scale" },
      { key:"hear_ready", label:"Ready for help", type:"yesno",
        followUpKey:"hear_changed", followUpLabel:"What changed?" },
      { key:"resistancePoints", label:"What's held them back", type:"multiSelect",
        options:RESISTANCE, otherKey:"other", otherValueKey:"resistancePointsOther" },
      { key:"aids_q", label:"Currently wears hearing aids", type:"yesno" },
    ],
  },
  {
    id: "aids", label: "Current Hearing Aids", showWhen:(a) => a.aids_q === true,
    fields: [
      { key:"aids_ear", label:"Which ear(s)", type:"text" },
      { key:"aids_howOften", label:"How often worn", type:"text" },
      { key:"aids_howOld", label:"How old", type:"text" },
      { key:"aids_brand", label:"Brand", type:"text" },
      { key:"aids_style", label:"Style", type:"text" },
      { key:"aids_cost", label:"Cost", type:"text" },
      { key:"aids_satisfied", label:"Satisfied with current aids", type:"yesno" },
      { key:"aids_whyNot", label:"What's not working", type:"text" },
    ],
  },
];

export default function HealthHistory({ intake, onUpdateAnswer, onUpdateNote }) {
  // Notes that have a value on load are auto-expanded so the provider
  // sees prior context immediately. New notes start collapsed.
  const [expandedNotes, setExpandedNotes] = useState(() => new Set(
    Object.entries(intake?.providerNotes || {})
      .filter(([, v]) => v && String(v).trim().length > 0)
      .map(([k]) => k)
  ));

  if (!intake) {
    return (
      <div style={{ padding:32, color:MUTED, fontStyle:"italic" }}>
        No intake on file for this patient.
      </div>
    );
  }

  const answers = intake.answers || {};
  const notes = intake.providerNotes || {};

  const toggleNote = (key) =>
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <Header intake={intake} />
      {SECTIONS
        .filter(sec => !sec.showWhen || sec.showWhen(answers))
        .map(sec => (
          <Section
            key={sec.id}
            section={sec}
            answers={answers}
            notes={notes}
            expandedNotes={expandedNotes}
            onToggleNote={toggleNote}
            onUpdateAnswer={onUpdateAnswer}
            onUpdateNote={onUpdateNote}
          />
        ))}
    </div>
  );
}

function Header({ intake }) {
  const submitted = intake._meta?.submittedAt
    ? new Date(intake._meta.submittedAt).toLocaleString()
    : "—";
  return (
    <div style={{ padding:"12px 16px", background:TEAL_BG, borderLeft:`4px solid ${TEAL}`, borderRadius:6, fontSize:13, color:TEXT }}>
      <div style={{ fontWeight:700, marginBottom:2 }}>Walk through this together with the patient.</div>
      <div style={{ color:MUTED }}>
        Intake submitted {submitted}. Edits save automatically. Use <strong>＋ Note</strong> on any row for a clinical note that stays separate from the patient's response.
      </div>
    </div>
  );
}

function Section({ section, answers, notes, expandedNotes, onToggleNote, onUpdateAnswer, onUpdateNote }) {
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
        {section.label}
      </div>
      <div style={{ border:`1px solid ${BORDER}`, borderRadius:8, background:"#fff" }}>
        {section.fields.map((field, i) => (
          <FieldRow
            key={field.key}
            field={field}
            isLast={i === section.fields.length - 1}
            answers={answers}
            note={notes[field.key] || ""}
            noteExpanded={expandedNotes.has(field.key)}
            onToggleNote={() => onToggleNote(field.key)}
            onUpdateAnswer={onUpdateAnswer}
            onUpdateNote={onUpdateNote}
          />
        ))}
      </div>
    </div>
  );
}

function FieldRow({ field, isLast, answers, note, noteExpanded, onToggleNote, onUpdateAnswer, onUpdateNote }) {
  const value = answers[field.key];

  return (
    <div style={{ padding:"10px 14px", borderBottom: isLast ? "none" : `1px solid ${BORDER}` }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <label style={{ fontSize:12, fontWeight:600, color:MUTED }}>{field.label}</label>
            <SaveIndicator fieldKey={field.key} />
          </div>
          <FieldInput field={field} value={value} answers={answers} onUpdateAnswer={onUpdateAnswer} />
          {field.followUpKey && shouldShowFollowUp(field, value) && (
            <div style={{ marginTop:8, paddingLeft:12, borderLeft:`2px solid ${BORDER}` }}>
              <FollowUp field={field} answers={answers} onUpdateAnswer={onUpdateAnswer} />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleNote}
          title={noteExpanded ? "Hide provider note" : "Add provider note"}
          style={{
            flexShrink:0, padding:"4px 8px", fontSize:11, fontWeight:600,
            color: noteExpanded ? TEAL : MUTED,
            background:"transparent", border:`1px solid ${noteExpanded ? TEAL : BORDER}`,
            borderRadius:4, cursor:"pointer", whiteSpace:"nowrap"
          }}
        >
          {noteExpanded ? "− Note" : "＋ Note"}
        </button>
      </div>
      {noteExpanded && (
        <ProviderNote fieldKey={field.key} initial={note} onUpdateNote={onUpdateNote} />
      )}
    </div>
  );
}

function shouldShowFollowUp(field, value) {
  // Yes/no fields show their follow-up only on "yes". Other types
  // (text, etc.) show the follow-up whenever the parent has a value.
  if (field.type === "yesno") return value === true;
  return value !== undefined && value !== "" && value !== null;
}

function FollowUp({ field, answers, onUpdateAnswer }) {
  const subType = field.followUpType || "text";
  const subOptions = field.followUpOptions;
  return (
    <>
      <div style={{ fontSize:11, fontWeight:600, color:MUTED, marginBottom:4 }}>{field.followUpLabel}</div>
      <FieldInput
        field={{ key: field.followUpKey, type: subType, options: subOptions, otherKey: "other", otherValueKey: field.otherFollowUpKey }}
        value={answers[field.followUpKey]}
        answers={answers}
        onUpdateAnswer={onUpdateAnswer}
      />
      {field.secondFollowUpKey && (
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:11, fontWeight:600, color:MUTED, marginBottom:4 }}>{field.secondFollowUpLabel}</div>
          <FieldInput
            field={{ key: field.secondFollowUpKey, type: "text" }}
            value={answers[field.secondFollowUpKey]}
            answers={answers}
            onUpdateAnswer={onUpdateAnswer}
          />
        </div>
      )}
    </>
  );
}

function FieldInput({ field, value, answers, onUpdateAnswer }) {
  // Local state mirrors the saved value so typing feels snappy without
  // writing per keystroke. We commit to the parent on blur.
  const [local, setLocal] = useState(value ?? (field.type === "multiSelect" ? [] : ""));
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) setLocal(value ?? (field.type === "multiSelect" ? [] : ""));
  }, [value, field.type]);

  const commit = (next) => {
    dirtyRef.current = false;
    onUpdateAnswer(field.key, next);
    flashSaved(field.key);
  };

  const onTextBlur = () => {
    if (dirtyRef.current) commit(local);
  };

  const inputStyle = {
    width:"100%", boxSizing:"border-box", padding:"8px 10px",
    fontSize:13, border:`1px solid ${BORDER}`, borderRadius:6,
    color:TEXT, fontFamily:"inherit", outline:"none",
  };

  if (field.type === "yesno") {
    return (
      <div style={{ display:"flex", gap:8 }}>
        {[["Yes", true], ["No", false]].map(([label, v]) => {
          const active = value === v;
          return (
            <button key={label} type="button" onClick={() => commit(v)}
              style={pillStyle(active)}>
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.type === "radio") {
    return (
      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
        {(field.options || []).map(([k, label]) => (
          <button key={k} type="button" onClick={() => commit(k)}
            style={pillStyle(value === k)}>
            {label}
          </button>
        ))}
      </div>
    );
  }

  if (field.type === "multiSelect") {
    const arr = Array.isArray(value) ? value : [];
    const otherKey = field.otherKey;
    const otherValueKey = field.otherValueKey;
    const togglePick = (k) => {
      let next;
      if (arr.includes(k)) {
        next = arr.filter(x => x !== k);
      } else {
        // Mutually exclusive with none/unsure — picking either clears
        // the rest, picking anything else clears them.
        if (k === "none" || k === "unsure") next = [k];
        else next = arr.filter(x => x !== "none" && x !== "unsure").concat(k);
      }
      commit(next);
    };
    return (
      <>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {(field.options || []).map(([k, label]) => (
            <button key={k} type="button" onClick={() => togglePick(k)}
              style={pillStyle(arr.includes(k))}>
              {label}
            </button>
          ))}
        </div>
        {otherKey && otherValueKey && arr.includes(otherKey) && (
          <input
            type="text"
            placeholder="Other (specify)"
            defaultValue={answers[otherValueKey] || ""}
            onBlur={(e) => { onUpdateAnswer(otherValueKey, e.target.value); flashSaved(otherValueKey); }}
            style={{ ...inputStyle, marginTop:6 }}
          />
        )}
      </>
    );
  }

  if (field.type === "scale") {
    const n = Number(value) || 0;
    return (
      <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
          <button key={num} type="button" onClick={() => commit(num)}
            style={{
              ...pillStyle(n === num),
              minWidth:32, padding:"6px 0", textAlign:"center",
            }}>
            {num}
          </button>
        ))}
      </div>
    );
  }

  if (field.type === "state") {
    return (
      <select
        value={local || ""}
        onChange={(e) => commit(e.target.value)}
        style={inputStyle}
      >
        <option value="">—</option>
        {US_STATES.map(([code, name]) => (
          <option key={code} value={code}>{name}</option>
        ))}
      </select>
    );
  }

  if (field.type === "date") {
    return (
      <input
        type="date"
        value={local || ""}
        onChange={(e) => { dirtyRef.current = true; setLocal(e.target.value); }}
        onBlur={onTextBlur}
        style={inputStyle}
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={local || ""}
        onChange={(e) => { dirtyRef.current = true; setLocal(e.target.value); }}
        onBlur={onTextBlur}
        rows={3}
        style={{ ...inputStyle, resize:"vertical", minHeight:60 }}
      />
    );
  }

  // Default — text-like (text, tel, email)
  return (
    <input
      type={field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
      value={local || ""}
      onChange={(e) => { dirtyRef.current = true; setLocal(e.target.value); }}
      onBlur={onTextBlur}
      style={inputStyle}
    />
  );
}

function pillStyle(active) {
  return {
    padding:"6px 12px",
    fontSize:12,
    fontWeight:600,
    border:`1px solid ${active ? TEAL : BORDER}`,
    background: active ? TEAL_BG : "#fff",
    color: active ? TEAL : TEXT,
    borderRadius:6,
    cursor:"pointer",
    fontFamily:"inherit",
  };
}

function ProviderNote({ fieldKey, initial, onUpdateNote }) {
  const [local, setLocal] = useState(initial || "");
  useEffect(() => { setLocal(initial || ""); }, [initial, fieldKey]);
  return (
    <div style={{
      marginTop:8, padding:"8px 10px",
      background:TEAL_BG, borderLeft:`3px solid ${TEAL}`, borderRadius:"0 6px 6px 0",
    }}>
      <div style={{ fontSize:10, fontWeight:700, color:TEAL, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>
        Provider note
      </div>
      <textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { onUpdateNote(fieldKey, local); flashSaved(`note:${fieldKey}`); }}
        rows={2}
        placeholder="Clinical observation, follow-up needed, conversation context…"
        style={{
          width:"100%", boxSizing:"border-box", padding:"6px 8px",
          fontSize:13, border:`1px solid ${TEAL_BORDER}`, borderRadius:4,
          color:TEXT, background:"#fff", fontFamily:"inherit", outline:"none",
          resize:"vertical", minHeight:50,
        }}
      />
      <div style={{ marginTop:2 }}>
        <SaveIndicator fieldKey={`note:${fieldKey}`} />
      </div>
    </div>
  );
}

// ── Save indicator ─────────────────────────────────────────────────────
// Uses a small custom-event bus so any FieldInput can fire a "saved"
// pulse and the matching SaveIndicator (mounted alongside the label or
// note) flashes briefly without each pair needing to share state.

const SAVE_EVT = "healthhistory:saved";
function flashSaved(key) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SAVE_EVT, { detail: { key } }));
}
function SaveIndicator({ fieldKey }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onEvt = (e) => {
      if (e.detail?.key === fieldKey) {
        setShow(true);
        const t = setTimeout(() => setShow(false), 1500);
        return () => clearTimeout(t);
      }
    };
    window.addEventListener(SAVE_EVT, onEvt);
    return () => window.removeEventListener(SAVE_EVT, onEvt);
  }, [fieldKey]);
  if (!show) return null;
  return (
    <span style={{ fontSize:10, fontWeight:600, color:TEAL, opacity:0.85 }}>Saved ✓</span>
  );
}
