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

// Archive view (backlog #40d — extracted from Distil.jsx renderArchive).
// Pure render extraction: the archived-patient list, search state, and the
// restore handler live in ProviderCRM and arrive as props.

import React from "react";
import Icon from "../components/Icon.jsx";
import { fmtDate } from "../lib/dates.js";

export default function Archive({
  clinic, archivedPatients, archivedFiltered, archivedLoading,
  archivedSearch, setArchivedSearch, archiveBusy, handleRestorePatient,
  setSelectedPatient, setView,
}) {
  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Archive</div>
          <div className="topbar-sub">{clinic.name} · {archivedPatients.length} archived patient{archivedPatients.length === 1 ? "" : "s"}</div>
        </div>
      </div>
      <div className="content">
        <div className="table-card">
          <div className="table-header">
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div className="table-title">Archived Patients</div>
              <span style={{fontSize:11,color:"#9ca3af"}}>Inactive — hidden from the patient list &amp; search</span>
            </div>
            <input className="search-input" placeholder="Search archive…" value={archivedSearch} onChange={e => setArchivedSearch(e.target.value)} />
          </div>
          {archivedLoading ? (
            <div className="empty-state">
              <div className="empty-icon"><Icon name="archive" size={40}/></div>
              <div className="empty-title">Loading archive…</div>
            </div>
          ) : archivedFiltered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Icon name="archive" size={40}/></div>
              {archivedPatients.length === 0 ? (
                <>
                  <div className="empty-title">Nothing archived</div>
                  <div className="empty-sub">Archive a patient from their profile to move them here.</div>
                </>
              ) : (
                <>
                  <div className="empty-title">No matches</div>
                  <div className="empty-sub">No archived patient matches “{archivedSearch.trim()}”.</div>
                </>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Patient</th><th>Device</th><th>Coverage</th><th>Status</th><th>Archived</th><th></th>
                </tr>
              </thead>
              <tbody>
                {archivedFiltered.map(p => {
                  const isTns = p.patientStatus === "tns";
                  return (
                    <tr key={p.id} onClick={() => { setSelectedPatient(p); setView("patient"); }} style={{cursor:"pointer"}}>
                      <td>
                        <div className="patient-name">{p.name}</div>
                        <div style={{fontSize:11,color:"#9ca3af"}}>{p.phone}</div>
                      </td>
                      <td>
                        <div style={{fontWeight:500}}>{p.devices?.manufacturer} {p.devices?.family||p.devices?.model}</div>
                        <div style={{fontSize:11,color:"#9ca3af"}}>{p.devices?.techLevel||"—"}</div>
                      </td>
                      <td>
                        <span className={`badge ${p.payType === "insurance" ? "insurance" : "private"}`}>
                          {p.payType === "insurance" ? p.insurance?.carrier || "Insurance" : "Private Pay"}
                        </span>
                      </td>
                      <td>
                        <span style={{background:isTns?"#fef3c7":p.patientStatus==="tnl"?"#dbeafe":"#F0EDE3",color:isTns?"#92400e":p.patientStatus==="tnl"?"#1d4ed8":"#6b7280",borderRadius:99,padding:"1px 9px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.4}}>
                          {p.patientStatus}
                        </span>
                      </td>
                      <td style={{fontSize:12,color:"#6b7280"}}>{p.archivedAt ? fmtDate(p.archivedAt) : "—"}</td>
                      <td>
                        <button
                          className="btn-ghost"
                          style={{fontSize:12,padding:"6px 14px",color:"#0f766e",fontWeight:600}}
                          disabled={archiveBusy}
                          onClick={(e) => { e.stopPropagation(); handleRestorePatient(p); }}
                        >
                          {archiveBusy ? "Restoring…" : "↩ Restore"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
