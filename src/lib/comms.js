// Pure helpers for patient communications (patient_messages) — shared by
// db.js (push preview), the Distil dashboard inbox, and the patient profile
// Communication card. Extracted so the truncation/name logic is testable.

// Mobile platforms typically display ~120 chars of a push notification before
// truncating anyway — the full body lives in the inbox, not the toast. The
// same preview length works for one-line list rows in the dashboard inbox.
export const PUSH_PREVIEW_MAX = 140;

// Collapse whitespace and truncate with an ellipsis. Never longer than max.
export function messagePreview(body, max = PUSH_PREVIEW_MAX) {
  const trimmed = (body || "").trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

// Display name for an embedded patients row ({ first_name, last_name }).
// Messages survive patient edits, so tolerate partial/missing names.
export function patientDisplayName(patientRow) {
  const name = [patientRow?.first_name, patientRow?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || "Patient";
}

// Human label for a message's channel column.
export function channelLabel(channel) {
  if (channel === "email") return "Email";
  return "Aided app";
}
