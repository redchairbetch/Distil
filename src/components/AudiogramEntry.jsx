import React, { useState, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { AudigramSVG, getDegreeName } from "./AudiogramSVG.jsx";
import { getPTA } from "../audiogramAnalysis.js";
import { parseMedRxPdf } from "../parsers/medrxParser.js";
import { parseNHAX } from "../parsers/nhaxParser.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

// Audiogram-entry surface, extracted verbatim from Distil.jsx step 2 (Testing)
// so the new-patient wizard and the established-patient UpgradeWizard share one
// threshold grid + PDF/NHAX import + speech-score cards. Contract is a controlled
// `value` (the camelCase audiology object) / `onChange(nextAudiology)` pair; the
// ear/test/mask toggles and the import banner are internal state. Pass an optional
// `ghost` (a prior audiology object) to overlay the previous test in greyscale.

export default function AudiogramEntry({ value, onChange, ghost = null, hideUnaidedSpeech = false }) {
  const [audEar, setAudEar] = useState("right");
  const [audTestType, setAudTestType] = useState("AC");
  const [maskMode, setMaskMode] = useState(false);
  const [pdfImport, setPdfImport] = useState(null);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const pdfInputRef = useRef(null);

  const ghostHasAC = !!ghost && (Object.keys(ghost.rightT || {}).length > 0 || Object.keys(ghost.leftT || {}).length > 0);
  const [showGhost, setShowGhost] = useState(true);
  const ghostOn = ghostHasAC && showGhost;

  const updAud = (k, v) => onChange({ ...value, [k]: v });

  const setThreshold = (ear, freq, val, testType = "AC", isMasked = false) => {
    const key = testType === "BC"
      ? (ear === "right" ? "rightBC" : "leftBC")
      : (ear === "right" ? "rightT" : "leftT");
    const maskKey = testType === "BC"
      ? (ear === "right" ? "rightBCMask" : "leftBCMask")
      : (ear === "right" ? "rightMask" : "leftMask");
    const next = { ...value[key] };
    const nextMask = { ...value[maskKey] };
    if (val == null) { delete next[freq]; delete nextMask[freq]; }
    else { next[freq] = val; if (isMasked) nextMask[freq] = true; else delete nextMask[freq]; }
    onChange({ ...value, [key]: next, [maskKey]: nextMask });
  };

  const copyToOtherEar = () => {
    const src = audEar, dst = src === "right" ? "left" : "right";
    const patch = {};
    // AC thresholds + masks
    patch[dst === "right" ? "rightT" : "leftT"] = { ...(src === "right" ? value.rightT : value.leftT) };
    patch[dst === "right" ? "rightMask" : "leftMask"] = { ...(src === "right" ? value.rightMask : value.leftMask) };
    // BC thresholds + masks
    patch[dst === "right" ? "rightBC" : "leftBC"] = { ...(src === "right" ? value.rightBC : value.leftBC) };
    patch[dst === "right" ? "rightBCMask" : "leftBCMask"] = { ...(src === "right" ? value.rightBCMask : value.leftBCMask) };
    onChange({ ...value, ...patch });
  };

  const handleAudioImport = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    const isPdf = ext === "pdf" || file.type === "application/pdf";
    const isNhax = ext === "nhax";

    if (!isPdf && !isNhax) {
      alert("Please upload a MedRx PDF or Noah NHAX file.");
      return;
    }

    try {
      const arrayBuf = await file.arrayBuffer();
      let result;

      if (isNhax) {
        result = await parseNHAX(arrayBuf);
      } else {
        // Existing MedRx PDF parsing
        const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const lineMap = new Map();
          for (const item of content.items) {
            if (!item.str.trim()) continue;
            const y = Math.round(item.transform[5]);
            if (!lineMap.has(y)) lineMap.set(y, []);
            lineMap.get(y).push({ x: item.transform[4], str: item.str });
          }
          const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
          for (const y of sortedYs) {
            const items = lineMap.get(y).sort((a, b) => a.x - b.x);
            fullText += items.map(it => it.str).join(" ") + "\n";
          }
        }
        result = parseMedRxPdf(fullText);
      }

      if (!result.success) {
        alert(result.error);
        return;
      }

      // Merge parsed data into value — parsed values win, nulls don't overwrite
      const merged = { ...value };
      const d = result.data;
      if (Object.keys(d.rightT).length)  merged.rightT  = { ...merged.rightT, ...d.rightT };
      if (Object.keys(d.leftT).length)   merged.leftT   = { ...merged.leftT, ...d.leftT };
      if (Object.keys(d.rightBC).length) merged.rightBC = { ...merged.rightBC, ...d.rightBC };
      if (Object.keys(d.leftBC).length)  merged.leftBC  = { ...merged.leftBC, ...d.leftBC };
      if (d.wrMclR != null) merged.wrMclR = d.wrMclR;
      if (d.wrMclL != null) merged.wrMclL = d.wrMclL;
      if (d.sinBin != null) merged.sinBin = d.sinBin;
      if (d.cctR != null)   merged.cctR = d.cctR;
      if (d.cctL != null)   merged.cctL = d.cctL;
      if (d.cctLevelR != null) merged.cctLevelR = d.cctLevelR;
      if (d.cctLevelL != null) merged.cctLevelL = d.cctLevelL;
      // Tag source type for db save
      merged._sourceType = isNhax ? "nhax" : "medrx_pdf";
      onChange(merged);

      const importInfo = {
        fields: result.importedFields,
        warnings: result.warnings,
        patientName: result.patientName,
        testDate: result.testDate,
        sourceType: isNhax ? "nhax" : "medrx_pdf",
      };
      // Attach NHAX metadata for richer import banner
      if (isNhax && d._nhaxMeta) {
        importInfo.nhaxMeta = d._nhaxMeta;
      }
      setPdfImport(importInfo);
    } catch (err) {
      console.error("Audio import error:", err);
      alert(isNhax
        ? "Failed to parse Noah NHAX file. Make sure it's a valid Noah export."
        : "Failed to read PDF. Make sure it's a valid audiometry report.");
    }
  };

  const clearPdfImport = () => setPdfImport(null);

  const rPTA = getPTA(value.rightT);
  const lPTA = getPTA(value.leftT);
  const rDeg = getDegreeName(rPTA);
  const lDeg = getDegreeName(lPTA);
  const gRPTA = getPTA(ghost?.rightT);
  const gLPTA = getPTA(ghost?.leftT);
  const importHighlight = (field) => pdfImport?.fields?.has(field)
    ? { background: "#fef9c3", border: "1.5px solid #f59e0b", borderRadius: 6 }
    : {};

  return (
    <>
      {/* ── PDF Import Drop Zone ── */}
      <div
        onDragOver={e => { e.preventDefault(); setPdfDragOver(true); }}
        onDragLeave={() => setPdfDragOver(false)}
        onDrop={e => { e.preventDefault(); setPdfDragOver(false); handleAudioImport(e.dataTransfer.files[0]); }}
        onClick={() => pdfInputRef.current?.click()}
        style={{
          border: pdfImport ? "2px solid #f59e0b" : pdfDragOver ? "2px solid #6366f1" : "2px dashed #d1d5db",
          borderRadius: 10,
          padding: pdfImport ? 14 : 24,
          marginBottom: 16,
          textAlign: "center",
          cursor: "pointer",
          background: pdfImport ? "#fefce8" : pdfDragOver ? "#eef2ff" : "#fafafa",
          transition: "all 0.15s",
        }}
      >
        <input ref={pdfInputRef} type="file" accept=".pdf,.nhax" style={{display:"none"}}
          onChange={e => { handleAudioImport(e.target.files[0]); e.target.value = ""; }} />
        {pdfImport ? (
          <div style={{textAlign:"left"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:14,fontWeight:700,color:"#92400e"}}>
                {pdfImport.sourceType === "nhax" ? "Noah Export Imported" : "MedRx Report Imported"}
              </span>
              <button onClick={e => { e.stopPropagation(); clearPdfImport(); }}
                style={{padding:"4px 12px",borderRadius:6,border:"1px solid #d1d5db",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#6b7280"}}>
                Clear Import
              </button>
            </div>
            <div style={{fontSize:12,color:"#78716c"}}>
              {pdfImport.patientName && <span><strong>Patient:</strong> {pdfImport.patientName} &nbsp; </span>}
              {pdfImport.testDate && <span><strong>Test Date:</strong> {pdfImport.testDate} &nbsp; </span>}
              <strong>{pdfImport.fields?.size || 0}</strong> fields imported
            </div>
            {/* NHAX-specific summary: PTA, CCT scores */}
            {pdfImport.nhaxMeta && (
              <div style={{marginTop:8,fontSize:12,color:"#374151",lineHeight:1.8}}>
                <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
                  <span><strong>L:</strong> PTA {pdfImport.nhaxMeta.ptaLeft ?? "—"} dB
                    {value.cctL != null && <> | CCT {value.cctL}% @ {value.cctLevelL}dB</>}
                    {value.wrMclL != null && <> | WRS {value.wrMclL}%</>}
                  </span>
                  <span><strong>R:</strong> PTA {pdfImport.nhaxMeta.ptaRight ?? "—"} dB
                    {value.cctR != null && <> | CCT {value.cctR}% @ {value.cctLevelR}dB</>}
                    {value.wrMclR != null && <> | WRS {value.wrMclR}%</>}
                  </span>
                </div>
                {pdfImport.nhaxMeta.device && (
                  <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Device: {pdfImport.nhaxMeta.device}</div>
                )}
              </div>
            )}
            {pdfImport.warnings?.length > 0 && (
              <div style={{marginTop:8,fontSize:11,color:"#b45309",lineHeight:1.5}}>
                {pdfImport.warnings.map((w, i) => <div key={i}>&#9888; {w}</div>)}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{fontSize:13,fontWeight:600,color:pdfDragOver?"#4f46e5":"#9ca3af",marginBottom:4}}>
              Drop audiogram file here or click to upload
            </div>
            <div style={{fontSize:11,color:"#d1d5db"}}>
              Supports MedRx PDF and Noah NHAX exports
            </div>
          </>
        )}
      </div>

      {/* ── Pure Tone Audiometry ── */}
      <div className="card">
        <div className="card-title">Pure Tone Audiometry</div>
        <div style={{fontSize:12,color:"#6b7280",marginBottom:14,lineHeight:1.6}}>
          Click directly on the audiogram to plot thresholds. Click an existing symbol to clear it.
          Switch ears, test type (AC/BC), and masking mode using the controls below.
          PTA calculates automatically from 500, 1000, and 2000 Hz.
        </div>
        {/* Ear toggle + Copy button */}
        <div style={{display:"flex",alignItems:"stretch",gap:8,marginBottom:10}}>
          <div className="side-tabs" style={{flex:1,marginBottom:0}}>
            {["right","left"].map(ear=>(
              <button key={ear} className={`side-tab ${audEar===ear?"active":""}`}
                onClick={()=>setAudEar(ear)}>
                <div className="side-tab-label">{ear==="right"?"Right Ear":"Left Ear"}</div>
                <div className="side-tab-sub">
                  {ear==="right"
                    ?(rPTA!=null?`PTA: ${rPTA} dB HL`:"No thresholds")
                    :(lPTA!=null?`PTA: ${lPTA} dB HL`:"No thresholds")}
                </div>
              </button>
            ))}
          </div>
          <button onClick={copyToOtherEar}
            style={{padding:"6px 14px",borderRadius:8,border:"1px solid #d1d5db",background:"#f9fafb",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}
            title={`Copy all thresholds from ${audEar} ear to ${audEar==="right"?"left":"right"} ear`}>
            Copy {audEar==="right"?"→ Left":"← Right"}
          </button>
        </div>
        {/* AC/BC toggle + Mask mode + Tinnitus */}
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:"#374151"}}>
            <span>Test:</span>
            {["AC","BC"].map(t=>(
              <button key={t} onClick={()=>setAudTestType(t)}
                style={{padding:"4px 12px",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",
                  border:audTestType===t?"2px solid #6366f1":"1px solid #d1d5db",
                  background:audTestType===t?"#eef2ff":"#fff",
                  color:audTestType===t?"#4f46e5":"#6b7280"}}>
                {t==="AC"?"Air (AC)":"Bone (BC)"}
              </button>
            ))}
          </div>
          <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:maskMode?"#7c3aed":"#6b7280",cursor:"pointer"}}>
            <input type="checkbox" checked={maskMode} onChange={e=>setMaskMode(e.target.checked)}
              style={{accentColor:"#7c3aed"}}/>
            Masked
          </label>
          <div style={{borderLeft:"1px solid #e5e7eb",paddingLeft:12,display:"flex",alignItems:"center",gap:12}}>
            <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"#dc2626",fontWeight:600,cursor:"pointer"}}>
              <input type="checkbox" checked={value.tinnitusRight}
                onChange={e=>updAud("tinnitusRight",e.target.checked)}
                style={{accentColor:"#dc2626"}}/>
              Tinnitus R
            </label>
            <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"#2563eb",fontWeight:600,cursor:"pointer"}}>
              <input type="checkbox" checked={value.tinnitusLeft}
                onChange={e=>updAud("tinnitusLeft",e.target.checked)}
                style={{accentColor:"#2563eb"}}/>
              Tinnitus L
            </label>
          </div>
          {ghostHasAC && (
            <label style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:ghostOn?"#4b5563":"#9ca3af",cursor:"pointer"}}>
              <input type="checkbox" checked={showGhost} onChange={e=>setShowGhost(e.target.checked)}
                style={{accentColor:"#6b7280"}}/>
              Overlay previous test
            </label>
          )}
        </div>
        <div style={{background:"#fafafa",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 8px"}}>
          <AudigramSVG
            rightT={value.rightT} leftT={value.leftT}
            rightBC={value.rightBC} leftBC={value.leftBC}
            rightMask={value.rightMask} leftMask={value.leftMask}
            rightBCMask={value.rightBCMask} leftBCMask={value.leftBCMask}
            ghostRightT={ghostOn ? ghost.rightT : {}} ghostLeftT={ghostOn ? ghost.leftT : {}}
            interactive={true} onSet={setThreshold} activeEar={audEar}
            activeTestType={audTestType} maskMode={maskMode}/>
        </div>
        {ghostOn && (gRPTA!=null || gLPTA!=null) && (
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,fontSize:11,color:"#6b7280"}}>
            <span style={{display:"inline-block",width:14,height:0,borderTop:"2px dashed #9ca3af"}}></span>
            Previous test (greyscale):
            {gRPTA!=null && <span style={{color:"#6b7280"}}>R PTA {gRPTA} dB</span>}
            {gLPTA!=null && <span style={{color:"#6b7280"}}>L PTA {gLPTA} dB</span>}
          </div>
        )}
        {(rPTA!=null||lPTA!=null)&&(
          <div style={{display:"flex",gap:12,marginTop:12,flexWrap:"wrap"}}>
            {rPTA!=null&&(
              <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 14px",fontSize:12}}>
                <span style={{color:"#dc2626",fontWeight:700}}>Right PTA: {rPTA} dB HL</span>
                {rDeg&&<span style={{color:"#9ca3af",marginLeft:6}}>({rDeg})</span>}
                {ghostOn&&gRPTA!=null&&<span style={{color:"#9ca3af",marginLeft:6}}>· was {gRPTA} ({gRPTA>rPTA?`−${gRPTA-rPTA}`:gRPTA<rPTA?`+${rPTA-gRPTA}`:"±0"} dB)</span>}
              </div>
            )}
            {lPTA!=null&&(
              <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"8px 14px",fontSize:12}}>
                <span style={{color:"#2563eb",fontWeight:700}}>Left PTA: {lPTA} dB HL</span>
                {lDeg&&<span style={{color:"#9ca3af",marginLeft:6}}>({lDeg})</span>}
                {ghostOn&&gLPTA!=null&&<span style={{color:"#9ca3af",marginLeft:6}}>· was {gLPTA} ({gLPTA>lPTA?`−${gLPTA-lPTA}`:gLPTA<lPTA?`+${lPTA-gLPTA}`:"±0"} dB)</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CCT / Unaided Speech Discrimination — hidden in the upgrade flow (not tested at annual/upgrade visits) ── */}
      {!hideUnaidedSpeech && (
      <div className="card" style={pdfImport?.fields?.has("cctR") || pdfImport?.fields?.has("cctL") ? {border:"1.5px solid #f59e0b",background:"#fffbeb"} : {}}>
        <div className="card-title">Unaided Speech Discrimination</div>
        <div style={{fontSize:12,color:"#6b7280",marginBottom:14,lineHeight:1.6}}>
          California Consonant Test at <strong>45 dB</strong> — monaurally. This measures clarity, not
          volume — the best predictor of real-world benefit from amplification.
          {pdfImport?.fields?.has("cctR") || pdfImport?.fields?.has("cctL")
            ? <span style={{color:"#b45309",fontWeight:600}}> Imported from Noah export.</span>
            : ""}
        </div>
        <div className="field-grid">
          <div className="field">
            <label>Right Ear Score (%)</label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" min="0" max="100" step="2" placeholder="e.g. 72"
                value={value.unaidedR??""} style={{width:90,...importHighlight("cctR")}}
                onChange={e=>updAud("unaidedR",e.target.value===""?null:Number(e.target.value))}/>
              {value.unaidedR!=null&&(
                <span style={{fontSize:11,fontWeight:700,
                  color:value.unaidedR>=70?"#16a34a":value.unaidedR>=50?"#ca8a04":"#dc2626"}}>
                  {value.unaidedR>=70?"Good":value.unaidedR>=50?"Reduced":"Poor"} consonant clarity
                </span>
              )}
            </div>
          </div>
          <div className="field">
            <label>Left Ear Score (%)</label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" min="0" max="100" step="2" placeholder="e.g. 64"
                value={value.unaidedL??""} style={{width:90,...importHighlight("cctL")}}
                onChange={e=>updAud("unaidedL",e.target.value===""?null:Number(e.target.value))}/>
              {value.unaidedL!=null&&(
                <span style={{fontSize:11,fontWeight:700,
                  color:value.unaidedL>=70?"#16a34a":value.unaidedL>=50?"#ca8a04":"#dc2626"}}>
                  {value.unaidedL>=70?"Good":value.unaidedL>=50?"Reduced":"Poor"} consonant clarity
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── WR at MCL (from MedRx report) ── */}
      <div className="card" style={pdfImport?.fields?.has("wrMclR") || pdfImport?.fields?.has("wrMclL") ? {border:"1.5px solid #f59e0b",background:"#fffbeb"} : {}}>
        <div className="card-title">Word Recognition at MCL</div>
        <div style={{fontSize:12,color:"#6b7280",marginBottom:14,lineHeight:1.6}}>
          Word recognition tested at the patient's <strong>most comfortable level (MCL)</strong>.
          {pdfImport?.fields?.has("wrMclR") || pdfImport?.fields?.has("wrMclL")
            ? <span style={{color:"#b45309",fontWeight:600}}> Imported from {pdfImport.sourceType === "nhax" ? "Noah export" : "MedRx report"}.</span>
            : " Enter manually or import from a file above."}
        </div>
        <div className="field-grid">
          <div className="field">
            <label>Right Ear Score (%)</label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" min="0" max="100" step="2" placeholder="e.g. 96"
                value={value.wrMclR??""} style={{width:90,...importHighlight("wrMclR")}}
                onChange={e=>updAud("wrMclR",e.target.value===""?null:Number(e.target.value))}/>
              {value.wrMclR!=null&&value.wrMclR<100&&(
                <span style={{fontSize:11,fontWeight:700,color:"#6b7280"}}>
                  {100-value.wrMclR}% deficit at MCL
                </span>
              )}
            </div>
          </div>
          <div className="field">
            <label>Left Ear Score (%)</label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" min="0" max="100" step="2" placeholder="e.g. 92"
                value={value.wrMclL??""} style={{width:90,...importHighlight("wrMclL")}}
                onChange={e=>updAud("wrMclL",e.target.value===""?null:Number(e.target.value))}/>
              {value.wrMclL!=null&&value.wrMclL<100&&(
                <span style={{fontSize:11,fontWeight:700,color:"#6b7280"}}>
                  {100-value.wrMclL}% deficit at MCL
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── QuickSIN ── */}
      <div className="card">
        <div className="card-title">Signal-to-Noise Ratio Assessment — QuickSIN</div>
        <div style={{fontSize:12,color:"#6b7280",marginBottom:14,lineHeight:1.6}}>
          Administered <strong>binaurally at the patient's MCL</strong>. Enter the SNR Loss result in dB.
          0–2 = normal · 3–7 = mild · 8–15 = moderate · 15+ = severe.
          <span style={{display:"block",marginTop:6,color:"#9ca3af",fontStyle:"italic"}}>
            Tip: normalize the experience before administering — most patients feel like they crash and burn even when they do reasonably well.
          </span>
        </div>
        <div className="field" style={{maxWidth:320}}>
          <label>Binaural SNR Loss (dB)</label>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <input type="number" min="0" max="30" step="0.5" placeholder="e.g. 9.5"
              value={value.sinBin??""} style={{width:110,...importHighlight("sinBin")}}
              onChange={e=>updAud("sinBin",e.target.value===""?null:Number(e.target.value))}/>
            {value.sinBin!=null&&(
              <div>
                <span style={{fontSize:13,fontWeight:700,
                  color:value.sinBin<=2?"#16a34a":value.sinBin<=7?"#ca8a04":value.sinBin<=15?"#ea580c":"#dc2626"}}>
                  {value.sinBin<=2?"Near-normal":value.sinBin<=7?"Mild":value.sinBin<=15?"Moderate":"Severe"} difficulty in noise
                </span>
                <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>
                  {value.sinBin<=2?"Minimal impact from background noise expected."
                  :value.sinBin<=7?"Modern directional processing can recover much of this gap."
                  :value.sinBin<=15?"Noise will remain the hardest situation — technology provides meaningful relief."
                  :"Complex noise environments will be genuinely difficult regardless of technology — sets honest expectations."}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
