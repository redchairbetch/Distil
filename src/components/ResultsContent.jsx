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

// Results content — audiogram presentation, phoneme dimming, hearing-loss
// simulation (Web Audio), drawing overlay, and counseling copy. Rendered by
// both the wizard's Results step and Consultation Mode.
//
// Backlog #40b: converted from Distil.jsx's renderResultsContent closure into
// a real component. The counseling state (dim mode/intensity, sim playback,
// draw paths) is now PER-INSTANCE instead of a ProviderCRM singleton, and the
// audio bank tears down when the results screen unmounts. displayLang stays
// lifted — the session display language spans other patient-facing surfaces.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { AudigramSVG, PHONEMES, interpolateThreshold } from "./AudiogramSVG.jsx";
import LangToggle from "./LangToggle.jsx";
import { getPTA, getWorstThresholdSeverity } from "../lib/audiogram.js";
import {
  SIM_BANDS, simAttenForBand, HIGH_FREQ_CONSONANTS, HEARING_SIM_TEXT,
} from "../lib/counseling.js";
import { mapComplaintsToFindings } from "../lib/intakeReview.js";
import { CONSULT_T } from "../i18n/consultation.js";
import hearingSimUrl from "../assets/audio/hearing-sim.m4a";

// Draw-overlay palette. Yellow/orange/green line up with the audiogram's
// degree-region colors so a drawn rectangle can echo the category of loss.
const DRAW_COLORS = [
  ["#dc2626", "Red"], ["#2563eb", "Blue"], ["#1e293b", "Black"],
  ["#16a34a", "Green"], ["#eab308", "Yellow"], ["#ea580c", "Orange"],
];

// "#rrggbb" → rgba() at the given alpha, for the rectangle interior shade.
const hexToRgba = (hex, a) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

export default function ResultsContent({ aud, chiefComplaint, intakeAnswers = null, displayLang, setDisplayLang }) {
  const [phonemeDimMode, setPhonemeDimMode] = useState("both");
  const [dimIntensity, setDimIntensity] = useState(75); // 0 = no dimming, 100 = full fade

  // ── Hearing-loss simulation (audio) ──
  const [simPlaying, setSimPlaying] = useState(false);
  const [simMode, setSimMode] = useState("yours"); // 'typical' | 'yours'
  const audioCtxRef = useRef(null);
  const simBufferRef = useRef(null);   // decoded AudioBuffer (fetched once)
  const simSourceRef = useRef(null);   // current AudioBufferSourceNode
  const simFiltersRef = useRef([]);    // current BiquadFilterNode bank
  const simAudRef = useRef(null);      // audiology snapshot driving the live bank

  const applySimGains = useCallback(() => {
    const ctx = audioCtxRef.current, filters = simFiltersRef.current;
    if (!ctx || !filters.length) return;
    filters.forEach((flt, i) => {
      const atten = simMode === "yours" ? simAttenForBand(simAudRef.current, SIM_BANDS[i], phonemeDimMode) : 0;
      flt.gain.setTargetAtTime(-atten, ctx.currentTime, 0.04);
    });
  }, [simMode, phonemeDimMode]);

  const stopHearingSim = useCallback(() => {
    try { simSourceRef.current?.stop(); } catch (e) { /* already stopped */ }
    simSourceRef.current = null;
    setSimPlaying(false);
  }, []);

  const playHearingSim = useCallback(async (aud) => {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      if (!simBufferRef.current) {
        const bytes = await (await fetch(hearingSimUrl)).arrayBuffer();
        simBufferRef.current = await ctx.decodeAudioData(bytes);
      }
      try { simSourceRef.current?.stop(); } catch (e) { /* none playing */ }
      simAudRef.current = aud;
      const src = ctx.createBufferSource();
      src.buffer = simBufferRef.current;
      // Peaking filter bank — one per octave band, attenuated by that band's loss.
      const filters = SIM_BANDS.map((f) => {
        const flt = ctx.createBiquadFilter();
        flt.type = "peaking";
        flt.frequency.value = f;
        flt.Q.value = 1.0;
        flt.gain.value = simMode === "yours" ? -simAttenForBand(aud, f, phonemeDimMode) : 0;
        return flt;
      });
      let node = src;
      filters.forEach((flt) => { node.connect(flt); node = flt; });
      node.connect(ctx.destination);
      simFiltersRef.current = filters;
      simSourceRef.current = src;
      src.onended = () => { if (simSourceRef.current === src) { simSourceRef.current = null; setSimPlaying(false); } };
      setSimPlaying(true);
      src.start();
    } catch (e) {
      console.error("hearing sim playback:", e);
      alert("Could not play the hearing simulation: " + (e.message || e));
      setSimPlaying(false);
    }
  }, [simMode, phonemeDimMode]);

  // Live-update the bank when the A/B mode or ear changes mid-playback so the
  // audio always agrees with the on-screen dimming.
  useEffect(() => { if (simPlaying) applySimGains(); }, [simMode, phonemeDimMode, simPlaying, applySimGains]);

  // Tear down audio on unmount.
  useEffect(() => () => {
    try { simSourceRef.current?.stop(); } catch (e) { /* noop */ }
    try { audioCtxRef.current?.close?.(); } catch (e) { /* noop */ }
  }, []);

  // Audiogram drawing overlay state. Shapes share one undo stack:
  // pen  → {type:"pen", points:[{x,y}], color, width}
  // rect → {type:"rect", x0,y0,x1,y1, color, width} (drag-to-size, 20% fill)
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [drawTool, setDrawTool] = useState("pen");      // 'pen' | 'rect'
  const [drawPaths, setDrawPaths] = useState([]);
  const [drawColor, setDrawColor] = useState("#dc2626");
  const drawCanvasRef = useRef(null);
  const drawingRef = useRef(false);                      // is pointer currently down
  const currentPathRef = useRef(null);                   // in-progress path

  const redrawCanvas = useCallback((paths, inProgress) => {
    const c = drawCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    const renderPath = (p) => {
      if (!p) return;
      if (p.type === "rect") {
        const x = Math.min(p.x0, p.x1), y = Math.min(p.y0, p.y1);
        const w = Math.abs(p.x1 - p.x0), h = Math.abs(p.y1 - p.y0);
        if (w < 2 || h < 2) return;
        ctx.fillStyle = hexToRgba(p.color, 0.2);
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width;
        ctx.strokeRect(x, y, w, h);
        return;
      }
      if (p.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length; i++) ctx.lineTo(p.points[i].x, p.points[i].y);
      ctx.stroke();
    };
    paths.forEach(renderPath);
    if (inProgress) renderPath(inProgress);
  }, []);

  const getCanvasPoint = useCallback((e) => {
    const c = drawCanvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }, []);

  const onDrawPointerDown = useCallback((e) => {
    e.preventDefault();
    drawingRef.current = true;
    const pt = getCanvasPoint(e);
    currentPathRef.current = drawTool === "rect"
      ? { type: "rect", x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y, color: drawColor, width: 3 }
      : { type: "pen", points: [pt], color: drawColor, width: 3 };
    drawCanvasRef.current?.setPointerCapture(e.pointerId);
  }, [drawColor, drawTool, getCanvasPoint]);

  const onDrawPointerMove = useCallback((e) => {
    if (!drawingRef.current || !currentPathRef.current) return;
    e.preventDefault();
    const pt = getCanvasPoint(e);
    const cur = currentPathRef.current;
    if (cur.type === "rect") { cur.x1 = pt.x; cur.y1 = pt.y; }
    else cur.points.push(pt);
    redrawCanvas(drawPaths, cur);
  }, [drawPaths, getCanvasPoint, redrawCanvas]);

  const onDrawPointerUp = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const finishedPath = currentPathRef.current;
    currentPathRef.current = null;
    // Discard accidental taps: a rect needs real area, a pen stroke ≥2 points.
    const keep = finishedPath && (finishedPath.type === "rect"
      ? Math.abs(finishedPath.x1 - finishedPath.x0) >= 6 && Math.abs(finishedPath.y1 - finishedPath.y0) >= 6
      : finishedPath.points.length >= 2);
    if (keep) {
      setDrawPaths(prev => [...prev, finishedPath]);
      redrawCanvas([...drawPaths, finishedPath], null);
    } else {
      redrawCanvas(drawPaths, null);
    }
  }, [drawPaths, redrawCanvas]);

  // Resize canvas to match container
  useEffect(() => {
    if (!drawingEnabled) return;
    const c = drawCanvasRef.current;
    if (!c) return;
    const parent = c.parentElement;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      c.width = parent.offsetWidth * dpr;
      c.height = parent.offsetHeight * dpr;
      c.style.width = parent.offsetWidth + "px";
      c.style.height = parent.offsetHeight + "px";
      redrawCanvas(drawPaths, null);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [drawingEnabled, drawPaths, redrawCanvas]);

    if (!aud) return null;
    const ct = CONSULT_T[displayLang] || CONSULT_T.en;
    const rPTA = getPTA(aud.rightT);
    const lPTA = getPTA(aud.leftT);
    const hasThresholds = rPTA!=null || lPTA!=null;
    const hasAnyData = hasThresholds || aud.unaidedR!=null || aud.unaidedL!=null || aud.cctR!=null || aud.cctL!=null || aud.wrMclR!=null || aud.wrMclL!=null || aud.sinBin!=null;

    const rSeverity = getWorstThresholdSeverity(aud.rightT);
    const lSeverity = getWorstThresholdSeverity(aud.leftT);
    const severityRank = s => ["Normal","Mild","Moderate","Moderately Severe","Severe","Profound"].indexOf(s);
    const overallSeverity = (rSeverity && lSeverity)
      ? (severityRank(rSeverity) >= severityRank(lSeverity) ? rSeverity : lSeverity)
      : (rSeverity || lSeverity);

    const cctR = aud.cctR ?? aud.unaidedR, cctL = aud.cctL ?? aud.unaidedL;
    const cctDefR = cctR!=null ? 100-cctR : null;
    const cctDefL = cctL!=null ? 100-cctL : null;
    const worseCCT = (cctR!=null && cctL!=null) ? Math.min(cctR, cctL) : (cctR ?? cctL);
    const cctColor = v => v==null ? "#9ca3af" : v>=90 ? "#16a34a" : v>=75 ? "#f59e0b" : "#dc2626";

    const computeInaudible = (thresholds, dimMode) => {
      return PHONEMES.map(ph => {
        const rThr = interpolateThreshold(aud.rightT, ph.freq);
        const lThr = interpolateThreshold(aud.leftT, ph.freq);
        const rIn = rThr!=null && rThr > ph.db;
        const lIn = lThr!=null && lThr > ph.db;
        let inaudible = false;
        if(dimMode==="right") inaudible = rIn;
        else if(dimMode==="left") inaudible = lIn;
        else inaudible = rIn || lIn;
        return inaudible ? ph.label : null;
      }).filter(Boolean);
    };
    const inaudibleBoth = computeInaudible(null, "both");
    const highFreqInaudible = inaudibleBoth.filter(l => HIGH_FREQ_CONSONANTS.includes(l));

    const findingSentence = ct.findingSentence[overallSeverity] || null;

    const clarityGapCopy = (() => {
      if(worseCCT==null || worseCCT >= 90) return null;
      const deficit = 100 - worseCCT;
      if(worseCCT >= 75) return ct.clarityMild;
      if(worseCCT >= 60) return ct.clarityGap(worseCCT, deficit);
      return ct.claritySevere;
    })();

    const missingCopy = (() => {
      if(!hasThresholds) return null;
      const n = highFreqInaudible.length;
      if(n >= 5) return ct.missingMany;
      if(n >= 3) return ct.missingSome;
      if(n >= 1) return ct.missingFew;
      return null;
    })();

    // Intake carry-forward: what the patient told us at intake, explained
    // by what we just measured. Empty when there's no intake, nothing was
    // endorsed, or no test data to explain anything with.
    const complaintRows = (intakeAnswers && hasAnyData)
      ? mapComplaintsToFindings(intakeAnswers, {
          overallSeverity,
          worseCCT,
          highFreqCount: highFreqInaudible.length,
          hasThresholds,
        }, displayLang)
      : [];
    const intakeVisitReason = (intakeAnswers?.visitReason || "").trim();

    return (
      <>
        {hasThresholds && (
          <div className="card">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div className="card-title">{ct.yourAudiogram}</div>
              <LangToggle lang={displayLang} onChange={setDisplayLang} />
            </div>
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
              {["left","both","right"].map(mode=>(
                <button key={mode} onClick={()=>setPhonemeDimMode(mode)}
                  style={{padding:"5px 14px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",
                    border:phonemeDimMode===mode?"2px solid #6366f1":"1px solid #d1d5db",
                    background:phonemeDimMode===mode?"#eef2ff":"#fff",
                    color:phonemeDimMode===mode?"#4f46e5":mode==="right"?"#dc2626":mode==="left"?"#2563eb":"#374151"}}>
                  {mode==="left"?ct.earLeft:mode==="right"?ct.earRight:ct.earBoth}
                </button>
              ))}
              <span style={{fontSize:11,color:"#9ca3af",alignSelf:"center",marginLeft:4}}>{ct.focusEar}</span>

              <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
                <button onClick={()=>setDrawingEnabled(!drawingEnabled)}
                  style={{padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4,
                    border:drawingEnabled?"2px solid #f59e0b":"1px solid #d1d5db",
                    background:drawingEnabled?"#fffbeb":"#fff",
                    color:drawingEnabled?"#b45309":"#6b7280"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  {ct.draw}
                </button>
                {drawingEnabled && <>
                  <div style={{display:"inline-flex",border:"1px solid #d1d5db",borderRadius:6,overflow:"hidden",flexShrink:0}}>
                    <button onClick={()=>setDrawTool("pen")} title="Freehand"
                      style={{padding:"4px 8px",border:"none",cursor:"pointer",display:"flex",alignItems:"center",
                        background:drawTool==="pen"?"#fffbeb":"#fff",color:drawTool==="pen"?"#b45309":"#9ca3af"}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button onClick={()=>setDrawTool("rect")} title="Rectangle"
                      style={{padding:"4px 8px",border:"none",borderLeft:"1px solid #d1d5db",cursor:"pointer",display:"flex",alignItems:"center",
                        background:drawTool==="rect"?"#fffbeb":"#fff",color:drawTool==="rect"?"#b45309":"#9ca3af"}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/></svg>
                    </button>
                  </div>
                  {DRAW_COLORS.map(([c,label])=>(
                    <button key={c} onClick={()=>setDrawColor(c)} title={label}
                      style={{width:20,height:20,borderRadius:"50%",border:drawColor===c?"3px solid #f59e0b":"2px solid #d1d5db",background:c,cursor:"pointer",padding:0,flexShrink:0}}/>
                  ))}
                  <button onClick={()=>setDrawPaths(prev=>prev.slice(0,-1))} disabled={drawPaths.length===0} title="Undo"
                    style={{padding:"4px 8px",borderRadius:6,fontSize:11,fontWeight:600,cursor:drawPaths.length?"pointer":"default",border:"1px solid #d1d5db",background:"#fff",color:drawPaths.length?"#6b7280":"#d1d5db",display:"flex",alignItems:"center",gap:3}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                  </button>
                  <button onClick={()=>setDrawPaths([])} disabled={drawPaths.length===0} title="Clear all"
                    style={{padding:"4px 8px",borderRadius:6,fontSize:11,fontWeight:600,cursor:drawPaths.length?"pointer":"default",border:"1px solid #d1d5db",background:"#fff",color:drawPaths.length?"#6b7280":"#d1d5db",display:"flex",alignItems:"center",gap:3}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </>}
              </div>
            </div>
            <div style={{position:"relative",background:"#fafafa",border:"1px solid #E4E0D5",borderRadius:10,padding:"12px 8px",marginBottom:14}}>
              <AudigramSVG rightT={aud.rightT||{}} leftT={aud.leftT||{}} rightBC={aud.rightBC||{}} leftBC={aud.leftBC||{}} rightMask={aud.rightMask||{}} leftMask={aud.leftMask||{}} rightBCMask={aud.rightBCMask||{}} leftBCMask={aud.leftBCMask||{}} interactive={false} showBanana={true} presentation={true} phonemeDimMode={phonemeDimMode} dimIntensity={dimIntensity} earFocus={phonemeDimMode}/>
              {drawingEnabled && (
                <canvas
                  ref={drawCanvasRef}
                  onPointerDown={onDrawPointerDown}
                  onPointerMove={onDrawPointerMove}
                  onPointerUp={onDrawPointerUp}
                  onPointerLeave={onDrawPointerUp}
                  style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",cursor:"crosshair",touchAction:"none",borderRadius:10}}
                />
              )}
              {!drawingEnabled && drawPaths.length > 0 && (
                <canvas
                  ref={el=>{if(el){drawCanvasRef.current=el;const p=el.parentElement;const dpr=window.devicePixelRatio||1;el.width=p.offsetWidth*dpr;el.height=p.offsetHeight*dpr;el.style.width=p.offsetWidth+"px";el.style.height=p.offsetHeight+"px";redrawCanvas(drawPaths,null);}}}
                  style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",borderRadius:10}}
                />
              )}
            </div>

            {/* Hearing Simulation Paragraph */}
            <div style={{margin:"0 0 16px",padding:"16px 20px",background:"#fff",border:"1px solid #E4E0D5",borderRadius:10}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>{ct.simTitle}</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:10,color:"#9ca3af",fontWeight:600}}>{ct.dim}</span>
                  <input type="range" min="0" max="100" value={dimIntensity} onChange={e=>setDimIntensity(Number(e.target.value))}
                    style={{width:100,accentColor:"#6366f1",cursor:"pointer"}}/>
                  <span style={{fontSize:10,color:"#9ca3af",fontWeight:600,minWidth:28}}>{dimIntensity}%</span>
                </div>
              </div>
              {/* A/B hearing simulation — plays the sentence through the patient's
                  audiogram (Web Audio biquad bank); uses the ear selector above. */}
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:14,paddingBottom:14,borderBottom:"1px solid #F0EDE3"}}>
                <button onClick={()=> simPlaying ? stopHearingSim() : playHearingSim(aud)}
                  style={{display:"flex",alignItems:"center",gap:7,padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",
                    background: simPlaying ? "#dc2626" : "#4f46e5", color:"#fff", fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:13}}>
                  <span style={{fontSize:12}}>{simPlaying ? "■" : "▶"}</span>
                  {simPlaying ? ct.stop : ct.hearThis}
                </button>
                <div style={{display:"inline-flex",border:"1px solid #d1d5db",borderRadius:8,overflow:"hidden"}}>
                  {[["typical",ct.typicalHearing],["yours",ct.yourHearing]].map(([m,label])=>(
                    <button key={m} onClick={()=>setSimMode(m)}
                      style={{padding:"7px 13px",fontSize:12,fontWeight:600,cursor:"pointer",border:"none",fontFamily:"'Sora',sans-serif",
                        background: simMode===m ? (m==="yours" ? "#4f46e5" : "#0a1628") : "#fff",
                        color: simMode===m ? "#fff" : "#6b7280"}}>
                      {label}
                    </button>
                  ))}
                </div>
                <span style={{fontSize:11,color:"#9ca3af"}}>
                  {simPlaying ? ct.simCaptionPlaying : ct.simCaptionIdle}
                </span>
              </div>
              <p style={{fontSize:16,lineHeight:2,fontFamily:"'DM Sans',sans-serif",margin:0,letterSpacing:"0.01em"}}>
                {HEARING_SIM_TEXT.map((seg,i) => {
                  if (!seg.ph) return <span key={i}>{seg.t}</span>;
                  const ph = PHONEMES.find(p => p.label === seg.ph);
                  if (!ph) return <span key={i}>{seg.t}</span>;
                  const rThr = interpolateThreshold(aud.rightT, ph.freq);
                  const lThr = interpolateThreshold(aud.leftT, ph.freq);
                  const rIn = rThr != null && rThr > ph.db;
                  const lIn = lThr != null && lThr > ph.db;
                  const rBorder = rThr != null && !rIn && rThr > ph.db - 5;
                  const lBorder = lThr != null && !lIn && lThr > ph.db - 5;
                  let inaudible = false, borderline = false;
                  if (phonemeDimMode === "right") { inaudible = rIn; borderline = !inaudible && rBorder; }
                  else if (phonemeDimMode === "left") { inaudible = lIn; borderline = !inaudible && lBorder; }
                  else { inaudible = rIn || lIn; borderline = !inaudible && (rBorder || lBorder); }
                  const t = dimIntensity / 100;
                  const base = [30, 41, 59]; // #1e293b
                  const inaudTarget = [229, 231, 235]; // #E4E0D5
                  const borderTarget = [176, 181, 189]; // #b0b5bd
                  const lerp = (a,b,f) => Math.round(a + (b - a) * f);
                  const color = inaudible
                    ? `rgb(${lerp(base[0],inaudTarget[0],t)},${lerp(base[1],inaudTarget[1],t)},${lerp(base[2],inaudTarget[2],t)})`
                    : borderline
                    ? `rgb(${lerp(base[0],borderTarget[0],t)},${lerp(base[1],borderTarget[1],t)},${lerp(base[2],borderTarget[2],t)})`
                    : "#1e293b";
                  return <span key={i} style={{color,transition:"color 0.3s ease"}}>{seg.t}</span>;
                })}
              </p>
            </div>

            {/* Severity per ear */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
              {rSeverity&&(
                <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#dc2626",marginBottom:2}}>{ct.rightEar}</div>
                  <div style={{fontSize:16,fontWeight:800,color:"#0a1628"}}>{ct.severity[rSeverity]||rSeverity}</div>
                </div>
              )}
              {lSeverity&&(
                <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#2563eb",marginBottom:2}}>{ct.leftEar}</div>
                  <div style={{fontSize:16,fontWeight:800,color:"#0a1628"}}>{ct.severity[lSeverity]||lSeverity}</div>
                </div>
              )}
              {aud.sinBin!=null&&(
                <div style={{background:"#FAF8F2",border:"1px solid #E4E0D5",borderRadius:8,padding:"10px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:2}}>{ct.quickSin}</div>
                  <div style={{fontSize:18,fontWeight:800,color:"#0a1628"}}>{aud.sinBin} <span style={{fontSize:11,color:"#9ca3af",fontWeight:400}}>dB</span></div>
                  <div style={{fontSize:11,fontWeight:600,marginTop:2,
                    color:aud.sinBin<=2?"#16a34a":aud.sinBin<=7?"#ca8a04":aud.sinBin<=15?"#ea580c":"#dc2626"}}>
                    {ct.noiseDifficulty(aud.sinBin<=2?ct.noiseLabels.nearNormal:aud.sinBin<=7?ct.noiseLabels.mild:aud.sinBin<=15?ct.noiseLabels.moderate:ct.noiseLabels.severe)}
                  </div>
                </div>
              )}
              {(aud.tinnitusRight||aud.tinnitusLeft)&&(
                <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,padding:"10px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#92400e",marginBottom:2}}>{ct.tinnitus}</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>
                    {aud.tinnitusRight&&aud.tinnitusLeft?ct.bilateral:aud.tinnitusRight?ct.rightEar:ct.leftEar}
                  </div>
                </div>
              )}
            </div>

            {/* CCT + WRS @ MCL Scorecard */}
            {(cctR!=null||cctL!=null||aud.wrMclR!=null||aud.wrMclL!=null) && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#dc2626",marginBottom:10}}>{ct.rightEar}</div>
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:3}}>{ct.cctScore}</div>
                    <div style={{fontSize:22,fontWeight:800,color:cctColor(cctR)}}>{cctR!=null?`${cctR}%`:"\u2014"}</div>
                    {cctDefR!=null&&cctDefR>0&&(
                      <div style={{fontSize:12,fontWeight:700,color:"#dc2626",marginTop:2}}>{ct.ptsBelowNormal(cctDefR)}</div>
                    )}
                    <div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>{ct.cctCaption}</div>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:3}}>{ct.wrsMcl}</div>
                    <div style={{fontSize:22,fontWeight:800,color:"#0a1628"}}>{aud.wrMclR!=null?`${aud.wrMclR}%`:"\u2014"}</div>
                    <div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>{ct.wrsCaption}</div>
                  </div>
                </div>
                <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#2563eb",marginBottom:10}}>{ct.leftEar}</div>
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:3}}>{ct.cctScore}</div>
                    <div style={{fontSize:22,fontWeight:800,color:cctColor(cctL)}}>{cctL!=null?`${cctL}%`:"\u2014"}</div>
                    {cctDefL!=null&&cctDefL>0&&(
                      <div style={{fontSize:12,fontWeight:700,color:"#dc2626",marginTop:2}}>{ct.ptsBelowNormal(cctDefL)}</div>
                    )}
                    <div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>{ct.cctCaption}</div>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:"#6b7280",marginBottom:3}}>{ct.wrsMcl}</div>
                    <div style={{fontSize:22,fontWeight:800,color:"#0a1628"}}>{aud.wrMclL!=null?`${aud.wrMclL}%`:"\u2014"}</div>
                    <div style={{fontSize:10,color:"#9ca3af",marginTop:3}}>{ct.wrsCaption}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Intake carry-forward — their words from intake, explained by the
            measurements. Rows come pre-filtered to endorsed complaints only;
            `supported:false` rows render the honest "test doesn't explain
            this" state rather than an invented mechanism. */}
        {complaintRows.length > 0 && (
          <div className="card">
            <div className="card-title">{ct.toldUsTitle}</div>
            {intakeVisitReason && (
              <div style={{fontSize:14,fontStyle:"italic",color:"#374151",lineHeight:1.6,padding:"10px 16px",background:"#F0F9FA",borderLeft:"3px solid #0A7B8C",borderRadius:"0 8px 8px 0",marginBottom:16}}>
                “{intakeVisitReason}”
                <span style={{display:"block",fontSize:11,fontStyle:"normal",color:"#6b7280",marginTop:4}}>{ct.visitReasonCaption}</span>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {complaintRows.map(row => (
                <div key={row.key} style={{
                  display:"flex",gap:14,alignItems:"flex-start",
                  padding:"12px 14px",borderRadius:10,
                  background: row.supported ? "#fafafa" : "#f8fafc",
                  border: `1px solid ${row.supported ? "#E4E0D5" : "#e2e8f0"}`,
                }}>
                  <div style={{fontSize:22,lineHeight:1.2,flexShrink:0}}>{row.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#0a1628",marginBottom:3}}>
                      {ct.youToldUs} {row.restatement.toLowerCase()}
                    </div>
                    <div style={{fontSize:13,color: row.supported ? "#374151" : "#64748b",lineHeight:1.6}}>
                      {row.explanation}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Counseling Copy */}
        {hasAnyData && (
          <div className="card">
            <div className="card-title">{ct.understandingTitle}</div>
            {findingSentence && (
              <div style={{fontSize:14,color:"#0a1628",fontWeight:600,lineHeight:1.7,marginBottom:16}}>
                {findingSentence}
              </div>
            )}
            {clarityGapCopy && (
              <div style={{fontSize:13,color:"#374151",lineHeight:1.75,marginBottom:16}}>
                {clarityGapCopy}
              </div>
            )}
            {missingCopy && (
              <div style={{fontSize:13,color:"#374151",lineHeight:1.75,marginBottom:16}}>
                {missingCopy}
              </div>
            )}
            <div style={{fontSize:13,color:"#6b7280",fontWeight:500,lineHeight:1.7,paddingTop:8,borderTop:"1px solid #F0EDE3"}}>
              {ct.treatmentBelow}
            </div>
          </div>
        )}

        {!hasAnyData && (
          <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"#9ca3af"}}>
            <div style={{fontSize:40,marginBottom:12}}>📋</div>
            <div style={{fontSize:16,fontWeight:600,color:"#374151",marginBottom:8}}>{ct.noDataTitle}</div>
            <div style={{fontSize:13}}>{ct.noDataBody}</div>
          </div>
        )}
      </>
    );
}
