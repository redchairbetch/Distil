/*!
 * Distil — hearing clinic patient management & intake system
 *
 * Copyright (c) 2026 Kurt Mooney. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL. This source code is the exclusive property of
 * the copyright holder. Unauthorized copying, distribution, modification, or
 * use of this file, in whole or in part, via any medium, is strictly
 * prohibited without the prior written permission of the copyright holder.
 * See the LICENSE file at the repository root for full terms.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  loadEvidenceReview,
  setEvidenceSourceStatus,
  setEvidenceClaimStatus,
} from "../db.js";

// Admin-only evidence sign-off queue (Phase 1b tail → clinical review).
// v1 is SIGN-OFF ONLY: it verifies / rejects / reopens sources and claims.
// It deliberately does NOT author or edit content — that stays in SQL, where
// the banned-term and matching CHECK constraints are the safety net. The
// database enforces the rest: a source cannot be verified without a DOI/PMID
// (citation gate), and verified/rejected rows must carry reviewer + timestamp
// (review provenance). Nothing here reaches a patient until BOTH its claim and
// its source are verified and the claim is not marked imprecise — that gate is
// the evidence_claim_patient_safe view, not this screen.

const NAVY = "#0a1628";

const STATUS_META = {
  draft:          { label: "Draft",    color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
  pending_review: { label: "Pending",  color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  verified:       { label: "Verified", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  rejected:       { label: "Rejected", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
};
const NEEDS = new Set(["draft", "pending_review"]);

const st = {
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginBottom: 10 },
  btnPrimary: { background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12.5, cursor: "pointer" },
  btnGhost: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 12px", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12.5, cursor: "pointer", color: "#6b7280" },
  btnGood: { background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12.5, cursor: "pointer" },
  btnDanger: { background: "#fff", border: "1px solid #fecaca", borderRadius: 8, padding: "7px 12px", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 12.5, cursor: "pointer", color: "#dc2626" },
  meta: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", letterSpacing: 0.6, marginBottom: 3 },
  notes: { whiteSpace: "pre-wrap", fontSize: 12.5, lineHeight: 1.55, color: "#374151", background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "10px 12px" },
};

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: m.color, background: m.bg, border: `1px solid ${m.border}`, borderRadius: 6, padding: "1px 7px", textTransform: "uppercase", letterSpacing: 0.5 }}>
      {m.label}
    </span>
  );
}

function Chip({ children, tone = "neutral" }) {
  const tones = {
    neutral: { c: "#4338ca", bg: "#eef2ff", b: "#e0e7ff" },
    warn:    { c: "#b45309", bg: "#fffbeb", b: "#fcd34d" },
    good:    { c: "#16a34a", bg: "#f0fdf4", b: "#bbf7d0" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: t.c, background: t.bg, border: `1px solid ${t.b}`, borderRadius: 20, padding: "2px 9px" }}>
      {children}
    </span>
  );
}

export default function EvidenceReview({ staffId }) {
  const [data, setData] = useState(null); // { sources, claims }
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("sources");
  const [needsOnly, setNeedsOnly] = useState(true);
  const [expanded, setExpanded] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState("");

  const reload = async () => {
    setLoading(true); setErr("");
    try { setData(await loadEvidenceReview()); }
    catch (e) { setErr("Couldn't load the evidence queue. " + (e.message || "")); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };
  const toggle = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const sources = data?.sources || [];
  const claims = data?.claims || [];
  const pendingSources = sources.filter(s => NEEDS.has(s.status)).length;
  const pendingClaims = claims.filter(c => NEEDS.has(c.status)).length;

  const shownSources = useMemo(
    () => (needsOnly ? sources.filter(s => NEEDS.has(s.status)) : sources),
    [sources, needsOnly]
  );
  const shownClaims = useMemo(
    () => (needsOnly ? claims.filter(c => NEEDS.has(c.status)) : claims),
    [claims, needsOnly]
  );

  // ── sign-off actions ────────────────────────────────────────────────────────
  // reason (reject only) is appended to review_notes so the audit trail keeps
  // both the transcription findings and the rejection rationale.
  const act = async (kind, entity, item) => {
    const isVerify = kind === "verified";
    const isReject = kind === "rejected";
    let reviewNotes = null;

    if (isVerify) {
      const what = entity === "source" ? "source" : "claim";
      if (!window.confirm(`Sign off this ${what} as VERIFIED? It becomes eligible for patient-facing use.`)) return;
    }
    if (isReject) {
      const reason = window.prompt("Reason for rejection (recorded in the audit trail):", "");
      if (reason == null) return; // cancelled
      const stamp = `REJECTED ${new Date().toISOString().slice(0, 10)}: ${reason.trim() || "(no reason given)"}`;
      reviewNotes = item.review_notes ? `${item.review_notes}\n\n${stamp}` : stamp;
    }

    setBusyId(item.id); setErr("");
    try {
      if (entity === "source") await setEvidenceSourceStatus(item.id, kind, staffId, reviewNotes);
      else await setEvidenceClaimStatus(item.id, kind, staffId, reviewNotes);
      showToast(isVerify ? "Verified" : isReject ? "Rejected" : "Reopened");
      await reload();
    } catch (e) {
      // Surface the DB constraint name so a blocked sign-off is legible.
      setErr("Sign-off failed: " + (e.message || "unknown error") + (e.hint ? ` (${e.hint})` : ""));
    } finally {
      setBusyId(null);
    }
  };

  const ActionRow = ({ entity, item, verifyBlocked, verifyBlockedReason }) => {
    const busy = busyId === item.id;
    const isPending = NEEDS.has(item.status);
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
        <button
          style={{ ...st.btnGood, opacity: busy || item.status === "verified" || verifyBlocked ? 0.45 : 1, cursor: verifyBlocked ? "not-allowed" : "pointer" }}
          disabled={busy || item.status === "verified" || verifyBlocked}
          title={verifyBlocked ? verifyBlockedReason : ""}
          onClick={() => act("verified", entity, item)}
        >✓ Verify</button>
        <button
          style={{ ...st.btnDanger, opacity: busy || item.status === "rejected" ? 0.45 : 1 }}
          disabled={busy || item.status === "rejected"}
          onClick={() => act("rejected", entity, item)}
        >✕ Reject</button>
        {!isPending && (
          <button
            style={{ ...st.btnGhost, opacity: busy ? 0.45 : 1 }}
            disabled={busy}
            onClick={() => act("pending_review", entity, item)}
          >↩ Reopen</button>
        )}
        {busy && <span style={{ fontSize: 12, color: "#9ca3af" }}>Saving…</span>}
      </div>
    );
  };

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Evidence Review</div>
          <div className="topbar-sub">
            {data
              ? <>{sources.length} sources · {claims.length} claims
                  {(pendingSources + pendingClaims) > 0 &&
                    <span style={{ color: "#b45309", fontWeight: 600 }}> · {pendingSources + pendingClaims} awaiting sign-off</span>}
                </>
              : "Loading…"}
          </div>
        </div>
      </div>

      <div className="content">
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
            {[["sources", `Sources${pendingSources ? ` (${pendingSources})` : ""}`],
              ["claims", `Claims${pendingClaims ? ` (${pendingClaims})` : ""}`]].map(([id, lbl]) => (
              <div key={id} onClick={() => setTab(id)}
                style={{ padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: tab === id ? NAVY : "#fff", color: tab === id ? "#fff" : "#6b7280",
                  border: tab === id ? `1px solid ${NAVY}` : "1px solid #e5e7eb" }}>
                {lbl}
              </div>
            ))}
            <div onClick={() => setNeedsOnly(v => !v)}
              style={{ marginLeft: "auto", padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: needsOnly ? "#fffbeb" : "#fff", color: needsOnly ? "#b45309" : "#6b7280",
                border: needsOnly ? "1px solid #fcd34d" : "1px solid #e5e7eb" }}>
              Needs review only {needsOnly ? "✓" : ""}
            </div>
          </div>

          {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>⚠ {err}</div>}
          {loading && <div style={{ color: "#9ca3af", fontSize: 13, padding: "20px 0" }}>Loading…</div>}

          {/* ── SOURCES ─────────────────────────────────────────────────────── */}
          {!loading && tab === "sources" && (
            shownSources.length === 0
              ? <div style={{ color: "#9ca3af", fontSize: 13, padding: "16px 0" }}>Nothing here{needsOnly ? " awaiting review" : ""}.</div>
              : shownSources.map(s => {
                const open = expanded.has(s.id);
                const hasId = !!(s.doi || s.pmid);
                return (
                  <div key={s.id} style={st.card}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }} onClick={() => toggle(s.id)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <StatusPill status={s.status} />
                          {hasId
                            ? <Chip tone="good">{s.doi ? "DOI" : "PMID"} ✓</Chip>
                            : <Chip tone="warn">⚠ no identifier</Chip>}
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>{s.study_design}</span>
                        </div>
                        <div style={{ fontWeight: 700, color: NAVY, fontSize: 14, marginTop: 5 }}>{s.title}</div>
                        <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 2 }}>
                          {s.authors} · <i>{s.journal}</i> · {s.pub_year}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>{open ? "▲" : "▼"}</span>
                    </div>

                    {open && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10, fontSize: 12.5, color: "#374151" }}>
                          {s.doi && <div><span style={st.meta}>DOI</span>{s.doi}</div>}
                          {s.pmid && <div><span style={st.meta}>PMID</span>{s.pmid}</div>}
                          {s.sample_n != null && <div><span style={st.meta}>n</span>{s.sample_n.toLocaleString()}</div>}
                          <div><span style={st.meta}>Peer reviewed</span>{s.is_peer_reviewed ? "Yes" : "No"}</div>
                        </div>
                        <div style={st.meta}>Review notes</div>
                        <div style={st.notes}>{s.review_notes || "— none —"}</div>
                        {!hasId && (
                          <div style={{ fontSize: 12, color: "#b45309", marginTop: 8 }}>
                            Can't verify without a DOI or PMID — the citation gate blocks it at the database.
                          </div>
                        )}
                        <ActionRow entity="source" item={s} verifyBlocked={!hasId}
                          verifyBlockedReason="Needs a DOI or PMID before it can be verified." />
                      </div>
                    )}
                  </div>
                );
              })
          )}

          {/* ── CLAIMS ──────────────────────────────────────────────────────── */}
          {!loading && tab === "claims" && (
            shownClaims.length === 0
              ? <div style={{ color: "#9ca3af", fontSize: 13, padding: "16px 0" }}>Nothing here{needsOnly ? " awaiting review" : ""}.</div>
              : shownClaims.map(c => {
                const open = expanded.has(c.id);
                const src = c.source;
                const srcVerified = src?.status === "verified";
                return (
                  <div key={c.id} style={st.card}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }} onClick={() => toggle(c.id)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <StatusPill status={c.status} />
                          <Chip>{c.claim_frame}</Chip>
                          {c.imprecise && <Chip tone="warn">imprecise</Chip>}
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>{c.claim_key}</span>
                        </div>
                        <div style={{ fontWeight: 600, color: NAVY, fontSize: 13.5, marginTop: 5, lineHeight: 1.4 }}>
                          {c.patient_statement}
                        </div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                          {src ? <>{src.authors?.split(",")[0]} · {src.pub_year}</> : "unlinked source"}
                          {src && !srcVerified && <span style={{ color: "#b45309", fontWeight: 600 }}> · source not verified</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>{open ? "▲" : "▼"}</span>
                    </div>

                    {open && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
                        <div style={{ marginBottom: 10 }}>
                          <div style={st.meta}>Clinical statement</div>
                          <div style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.5 }}>{c.clinical_statement}</div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <div style={st.meta}>Population scope</div>
                          <div style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.5 }}>{c.population_scope}</div>
                        </div>
                        {(c.effect_summary || c.ci_low != null || c.sample_n != null) && (
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10, fontSize: 12.5, color: "#374151" }}>
                            {c.effect_summary && <div><span style={st.meta}>Effect</span>{c.effect_summary}</div>}
                            {c.ci_low != null && c.ci_high != null && <div><span style={st.meta}>95% CI</span>{c.ci_low}–{c.ci_high}</div>}
                            {c.sample_n != null && <div><span style={st.meta}>n</span>{c.sample_n.toLocaleString()}</div>}
                          </div>
                        )}
                        {c.supporting_quote && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={st.meta}>Supporting quote</div>
                            <div style={{ fontSize: 12.5, color: "#374151", fontStyle: "italic", borderLeft: "3px solid #e5e7eb", paddingLeft: 10 }}>
                              “{c.supporting_quote}”
                            </div>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                          {(c.match_min_severity || c.match_max_severity) &&
                            <Chip>severity {c.match_min_severity || "…"}–{c.match_max_severity || "…"}</Chip>}
                          {(c.match_min_age != null || c.match_max_age != null) &&
                            <Chip>age {c.match_min_age ?? "…"}–{c.match_max_age ?? "…"}</Chip>}
                          {c.match_sex && <Chip>{c.match_sex}</Chip>}
                          {(c.match_min_snr_loss != null || c.match_max_snr_loss != null) &&
                            <Chip>SNR {c.match_min_snr_loss ?? "…"}–{c.match_max_snr_loss ?? "…"}</Chip>}
                          {(c.match_tags || []).map(t => <Chip key={t}>#{t}</Chip>)}
                          {(c.match_exclude_tags || []).map(t => <Chip key={t} tone="warn">−{t}</Chip>)}
                        </div>
                        {c.imprecise && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={st.meta}>Imprecision note</div>
                            <div style={{ fontSize: 12.5, color: "#b45309", lineHeight: 1.5 }}>{c.imprecision_note || "— (flagged imprecise with no note) —"}</div>
                          </div>
                        )}
                        {c.review_notes && (
                          <>
                            <div style={st.meta}>Review notes</div>
                            <div style={st.notes}>{c.review_notes}</div>
                          </>
                        )}
                        {src && !srcVerified && (
                          <div style={{ fontSize: 12, color: "#b45309", marginTop: 8 }}>
                            Its source isn't verified yet — verifying this claim won't surface it to patients until the source is signed off too.
                          </div>
                        )}
                        {c.imprecise && (
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
                            Marked imprecise: excluded from the patient-safe view even once verified.
                          </div>
                        )}
                        <ActionRow entity="claim" item={c} verifyBlocked={false} />
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: NAVY, color: "#4ade80", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "'Sora',sans-serif", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}>
          ✓ {toast}
        </div>
      )}
    </>
  );
}
