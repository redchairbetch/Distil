// Date helpers shared across Distil (extracted from Distil.jsx so they can be
// unit-tested; Aided.jsx and UpgradeWizard.jsx still carry local copies —
// dedupe those when next touching them).

// Parse a bare 'YYYY-MM-DD' as a local-time Date. `new Date('YYYY-MM-DD')` is
// UTC midnight, which renders a day earlier in negative-offset US timezones —
// so DOB, fitting/warranty dates, etc. were showing one day off. Returns null
// for anything that isn't a bare date so timestamptz values fall through.
export function parseDateOnly(s) {
  if (typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2]-1, +m[3]) : null;
}

export function fmtDate(d) { return (parseDateOnly(d) || new Date(d)).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }

export function warrantyDate(fittingDate, years=3) {
  const d = new Date(fittingDate);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split("T")[0];
}

export function daysUntil(dateStr) {
  const dateOnly = parseDateOnly(dateStr);
  if (dateOnly) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((dateOnly - today) / 86400000);
  }
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}
