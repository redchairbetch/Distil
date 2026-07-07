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

import { useCallback, useEffect, useState } from "react";
import {
  listClinicInbox,
  countClinicUnread,
  markMessageHandled,
  subscribeToClinicMessages,
} from "../db.js";
import { messagePreview, patientDisplayName, channelLabel } from "../lib/comms.js";
import SendMessageModal from "../components/SendMessageModal.jsx";

// Dashboard "Patient Messages" card — the provider-facing half of two-way
// patient_messages. Lists messages patients sent us (Aided replies today;
// ingested email replies land in the same table later via the channel
// column), unread first styling, with Reply / Mark handled / open-chart
// actions. Either the front desk or the provider can respond; a reply goes
// out through the existing SendMessageModal (Aided inbox + push) and marks
// the inbound message handled.
//
// Scoped to the active clinic — same Sycle-style "one clinic at a time"
// model as the rest of the dashboard. Distil remounts on clinic switch, so
// clinicId is stable for the life of this component.

const fmtWhen = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

export default function CommsInbox({ clinicId, staffId, patients, onOpenPatient }) {
  const [rows, setRows] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [replyTo, setReplyTo] = useState(null); // inbox row being replied to
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    if (!clinicId) return;
    try {
      const [list, count] = await Promise.all([
        listClinicInbox(clinicId),
        countClinicUnread(clinicId),
      ]);
      setRows(list);
      setUnread(count);
      setError(null);
    } catch (e) {
      console.error("CommsInbox refresh:", e);
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    refresh();
    if (!clinicId) return undefined;
    // Realtime INSERT payloads lack the patient embed — refetch for display.
    const unsubscribe = subscribeToClinicMessages(clinicId, () => refresh());
    return unsubscribe;
  }, [clinicId, refresh]);

  const handleMarkHandled = async (row) => {
    setBusyId(row.id);
    try {
      await markMessageHandled(row.id);
      await refresh();
    } catch (e) {
      console.error("markMessageHandled:", e);
      setError(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  };

  const chartPatientFor = (row) => (patients || []).find((p) => p.id === row.patient_id) || null;

  if (loading && rows.length === 0 && !error) return null;

  return (
    <>
      <div className="table-card" style={{ marginBottom: 16, borderLeft: unread > 0 ? "4px solid #1d4ed8" : undefined }}>
        <div
          className="table-header"
          style={{ cursor: "pointer" }}
          onClick={() => setExpanded((e) => !e)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="table-title" style={{ color: unread > 0 ? "#1d4ed8" : undefined }}>
              {"✉️"} Patient Messages
            </div>
            {unread > 0 && (
              <span style={{
                background: "#dbeafe", color: "#1e40af",
                borderRadius: 99, padding: "2px 10px",
                fontSize: 12, fontWeight: 700,
              }}>
                {unread} unread
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            {expanded ? "▲ Collapse" : "▼ Expand"}
          </span>
        </div>

        {expanded && (
          <>
            {error && (
              <div style={{
                margin: "10px 16px", padding: "10px 14px", borderRadius: 6,
                background: "#fef2f2", color: "#991b1b", fontSize: 13,
                border: "1px solid #fecaca",
              }}>
                Couldn't load patient messages: {error}
              </div>
            )}

            {rows.length === 0 && !error ? (
              <div style={{ padding: "14px 16px", fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>
                No patient messages yet — when a patient writes back from the Aided app, it lands here.
              </div>
            ) : (
              <div>
                {rows.map((row, i) => {
                  const isUnread = !row.read_at;
                  const isOpen = expandedId === row.id;
                  const chartPatient = chartPatientFor(row);
                  const name = chartPatient?.name || patientDisplayName(row.patient);
                  return (
                    <div
                      key={row.id}
                      style={{
                        padding: "12px 16px",
                        borderBottom: i === rows.length - 1 ? "none" : "1px solid #f3f4f6",
                        background: isUnread ? "#f8fafc" : "white",
                      }}
                    >
                      <div
                        onClick={() => setExpandedId(isOpen ? null : row.id)}
                        style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
                      >
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: isUnread ? "#1d4ed8" : "transparent",
                          marginTop: 6, flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: isUnread ? 700 : 600, color: "#0a1628" }}>
                              {name}
                            </span>
                            <span style={{
                              fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
                              background: row.channel === "email" ? "#fef3c7" : "#e0f2f1",
                              color: row.channel === "email" ? "#92400e" : "#0f766e",
                              borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap",
                            }}>
                              {channelLabel(row.channel)}
                            </span>
                            <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>
                              {fmtWhen(row.created_at)}
                            </span>
                          </div>
                          <div style={{
                            fontSize: 12.5, color: isUnread ? "#374151" : "#6b7280", marginTop: 3,
                            whiteSpace: isOpen ? "pre-wrap" : "nowrap",
                            overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.5,
                          }}>
                            {isOpen ? row.body : messagePreview(row.body, 120)}
                          </div>
                          {row.channel === "email" && row.email_from && (
                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>
                              from {row.email_from}
                            </div>
                          )}
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ display: "flex", gap: 8, marginTop: 10, marginLeft: 18, alignItems: "center" }}>
                          {row.channel === "email" ? (
                            // An in-app reply won't reach an email sender —
                            // until outbound email replies ship, answer from
                            // the front-desk mailbox and mark handled here.
                            <span style={{ fontSize: 12, color: "#92400e" }}>
                              Reply from the front-desk email inbox, then mark handled.
                            </span>
                          ) : (
                            <button
                              className="btn-primary green"
                              style={{ fontSize: 12, padding: "6px 14px" }}
                              onClick={() => setReplyTo(row)}
                            >
                              Reply
                            </button>
                          )}
                          {isUnread && (
                            <button
                              className="btn-ghost"
                              style={{ fontSize: 12, padding: "6px 14px" }}
                              disabled={busyId === row.id}
                              onClick={() => handleMarkHandled(row)}
                            >
                              {busyId === row.id ? "Saving…" : "Mark handled"}
                            </button>
                          )}
                          {chartPatient && (
                            <button
                              className="btn-ghost"
                              style={{ fontSize: 12, padding: "6px 14px" }}
                              onClick={() => onOpenPatient?.(chartPatient)}
                            >
                              Open chart
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {replyTo && (
        <SendMessageModal
          patient={{
            id: replyTo.patient_id,
            name: chartPatientFor(replyTo)?.name || patientDisplayName(replyTo.patient),
          }}
          staffId={staffId}
          clinicId={clinicId}
          onClose={() => setReplyTo(null)}
          onSent={async () => {
            // Replying handles the inbound message — clear it from the queue.
            try { await markMessageHandled(replyTo.id); } catch (e) { console.error("markMessageHandled after reply:", e); }
            refresh();
          }}
        />
      )}
    </>
  );
}
