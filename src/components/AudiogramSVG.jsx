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

import React from "react";
import { AUDIG_FREQS } from "../audiogramAnalysis.js";

// Audiogram rendering core, extracted verbatim from Distil.jsx so both the
// new-patient wizard and the established-patient UpgradeWizard can plot
// thresholds from one component. Behavior is unchanged from the inline version;
// the only addition is the optional greyscale `ghost*` overlay (a prior test
// drawn behind the live plot) used by the upgrade flow to show change-over-time.

// ── DEGREE-OF-LOSS SHADING REGIONS ───────────────────────────────────────────
const DEGREE_REGIONS = [
  {label:"Normal",       from:-10, to:20,  fill:"rgba(220,252,231,0.55)", color:"#16a34a"},
  {label:"Mild",         from:25,  to:40,  fill:"rgba(254,249,195,0.7)",  color:"#ca8a04"},
  {label:"Moderate",     from:40,  to:55,  fill:"rgba(254,215,170,0.7)",  color:"#ea580c"},
  {label:"Mod-Severe",   from:55,  to:70,  fill:"rgba(254,202,202,0.7)",  color:"#dc2626"},
  {label:"Severe",       from:70,  to:90,  fill:"rgba(252,165,165,0.6)",  color:"#b91c1c"},
  {label:"Profound",     from:90,  to:120, fill:"rgba(239,68,68,0.18)",   color:"#7f1d1d"},
];

export function getDegreeName(pta){
  if(pta==null)return null;
  if(pta<=20)return"Normal"; if(pta<=40)return"Mild";
  if(pta<=55)return"Moderate"; if(pta<=70)return"Moderately Severe";
  if(pta<=90)return"Severe"; return"Profound";
}

// ── CONTINUOUS FREQUENCY → X MAPPER ──────────────────────────────────────────
// Maps any Hz value to SVG x using log-interpolation across AUDIG_FREQS
export function freqToSvgX(hz, ML, PW){
  const logFreqs=AUDIG_FREQS.map(f=>Math.log2(f));
  const logHz=Math.log2(hz);
  const logMin=logFreqs[0], logMax=logFreqs[logFreqs.length-1];
  const frac=(logHz-logMin)/(logMax-logMin);
  return ML+frac*PW;
}

// ── THRESHOLD INTERPOLATION ──────────────────────────────────────────────────
// Linearly interpolates patient threshold at any frequency from tested frequencies
export function interpolateThreshold(thresholds, freq){
  if(!thresholds)return null;
  if(thresholds[freq]!=null)return thresholds[freq];
  const tested=AUDIG_FREQS.filter(f=>thresholds[f]!=null).sort((a,b)=>a-b);
  if(!tested.length)return null;
  if(freq<=tested[0])return thresholds[tested[0]];
  if(freq>=tested[tested.length-1])return thresholds[tested[tested.length-1]];
  let lo=tested[0], hi=tested[tested.length-1];
  for(const f of tested){ if(f<=freq)lo=f; if(f>=freq&&f<hi)hi=f; }
  if(lo===hi)return thresholds[lo];
  const ratio=(freq-lo)/(hi-lo);
  return thresholds[lo]+ratio*(thresholds[hi]-thresholds[lo]);
}

// ── SPEECH BANANA BOUNDARY COORDINATES ───────────────────────────────────────
const SPEECH_BANANA_UPPER=[
  {freq:250,db:20},{freq:500,db:15},{freq:1000,db:20},{freq:2000,db:20},
  {freq:4000,db:25},{freq:6000,db:35},{freq:8000,db:40}
];
const SPEECH_BANANA_LOWER=[
  {freq:8000,db:65},{freq:6000,db:65},{freq:4000,db:70},{freq:2000,db:65},
  {freq:1000,db:65},{freq:500,db:60},{freq:250,db:60}
];

// ── PHONEME POSITIONS ────────────────────────────────────────────────────────
// Phoneme positions — clinical freq/dB, with display offsets to prevent overlap
// displayFreq/displayDb are used for SVG placement; freq/db for audibility math
export const PHONEMES=[
  {label:'j',freq:250,db:35, displayFreq:250,displayDb:35},
  {label:'u',freq:310,db:28, displayFreq:310,displayDb:28},
  {label:'v',freq:500,db:22, displayFreq:420,displayDb:22},
  {label:'z',freq:500,db:24, displayFreq:580,displayDb:24},
  {label:'m',freq:500,db:34, displayFreq:430,displayDb:33},
  {label:'b',freq:500,db:36, displayFreq:530,displayDb:37},
  {label:'n',freq:500,db:38, displayFreq:440,displayDb:40},
  {label:'g',freq:500,db:42, displayFreq:540,displayDb:43},
  {label:'d',freq:500,db:44, displayFreq:450,displayDb:47},
  {label:'e',freq:600,db:30, displayFreq:650,displayDb:30},
  {label:'l',freq:750,db:40, displayFreq:750,displayDb:40},
  {label:'i',freq:1000,db:34, displayFreq:1000,displayDb:34},
  {label:'a',freq:1000,db:50, displayFreq:1050,displayDb:50},
  {label:'o',freq:900,db:44, displayFreq:900,displayDb:44},
  {label:'r',freq:1500,db:44, displayFreq:1500,displayDb:44},
  {label:'p',freq:2000,db:34, displayFreq:1900,displayDb:34},
  {label:'h',freq:2000,db:38, displayFreq:2100,displayDb:38},
  {label:'ch',freq:2500,db:54, displayFreq:2400,displayDb:54},
  {label:'sh',freq:2500,db:56, displayFreq:2650,displayDb:58},
  {label:'k',freq:3000,db:40, displayFreq:3000,displayDb:40},
  {label:'t',freq:4000,db:30, displayFreq:3850,displayDb:30},
  {label:'f',freq:4000,db:44, displayFreq:4000,displayDb:44},
  {label:'s',freq:5000,db:40, displayFreq:5000,displayDb:40},
  {label:'th',freq:6000,db:44, displayFreq:6000,displayDb:44},
];

export function AudigramSVG({rightT={},leftT={},rightBC={},leftBC={},rightMask={},leftMask={},rightBCMask={},leftBCMask={},ghostRightT={},ghostLeftT={},interactive=false,onSet,activeEar="right",activeTestType="AC",maskMode=false,showBanana=false,phonemeDimMode=null,dimIntensity=75}){
  const W=600,H=340,ML=52,MT=42,MR=88,MB=24;
  const PW=W-ML-MR, PH=H-MT-MB;
  const fx=i=>ML+i*(PW/(AUDIG_FREQS.length-1));
  const dy=db=>MT+(db-(-10))/130*PH;

  const handleClick=e=>{
    if(!interactive)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const svgX=(e.clientX-rect.left)*(W/rect.width);
    const svgY=(e.clientY-rect.top)*(H/rect.height);
    const fi=Math.round((svgX-ML)/(PW/(AUDIG_FREQS.length-1)));
    if(fi<0||fi>=AUDIG_FREQS.length)return;
    const db=Math.round(((svgY-MT)/PH*130+(-10))/5)*5;
    const clamped=Math.max(-10,Math.min(120,db));
    const freq=AUDIG_FREQS[fi];
    const curMap=activeTestType==="BC"
      ?(activeEar==="right"?rightBC:leftBC)
      :(activeEar==="right"?rightT:leftT);
    onSet?.(activeEar,freq,curMap[freq]===clamped?null:clamped,activeTestType,maskMode);
  };

  const pts=thr=>AUDIG_FREQS.map((f,i)=>thr[f]!=null?`${fx(i)},${dy(thr[f])}`:null).filter(Boolean);
  const rPts=pts(rightT), lPts=pts(leftT);
  const rBCPts=pts(rightBC), lBCPts=pts(leftBC);
  const ghostRPts=pts(ghostRightT), ghostLPts=pts(ghostLeftT);

  // Symbol renderers
  const acRightSymbol=(f,i)=>{
    const cx_=fx(i), cy_=dy(rightT[f]), s=interactive&&activeEar==="right"&&activeTestType==="AC"?7:6;
    const masked=rightMask[f];
    if(masked) return(
      <g key={"r"+f}>
        <polygon points={`${cx_},${cy_-s} ${cx_+s},${cy_+s} ${cx_-s},${cy_+s}`}
          fill="white" stroke="#dc2626" strokeWidth="2.5"/>
      </g>
    );
    return <circle key={"r"+f} cx={cx_} cy={cy_} r={s} fill="white" stroke="#dc2626" strokeWidth="2.5"/>;
  };

  const acLeftSymbol=(f,i)=>{
    const cx_=fx(i), cy_=dy(leftT[f]), s=interactive&&activeEar==="left"&&activeTestType==="AC"?7:6;
    const masked=leftMask[f];
    if(masked) return(
      <g key={"l"+f}>
        <rect x={cx_-s} y={cy_-s} width={s*2} height={s*2}
          fill="white" stroke="#2563eb" strokeWidth="2.5"/>
      </g>
    );
    return(
      <g key={"l"+f}>
        <line x1={cx_-s} y1={cy_-s} x2={cx_+s} y2={cy_+s} stroke="#2563eb" strokeWidth="2.5"/>
        <line x1={cx_+s} y1={cy_-s} x2={cx_-s} y2={cy_+s} stroke="#2563eb" strokeWidth="2.5"/>
      </g>
    );
  };

  const bcRightSymbol=(f,i)=>{
    const cx_=fx(i), cy_=dy(rightBC[f]), s=6;
    const masked=rightBCMask[f];
    if(masked) return(
      <g key={"rb"+f}>
        <path d={`M${cx_+s},${cy_-s} L${cx_-s+2},${cy_-s} L${cx_-s+2},${cy_+s} L${cx_+s},${cy_+s}`}
          fill="none" stroke="#dc2626" strokeWidth="2.5"/>
      </g>
    );
    return(
      <g key={"rb"+f}>
        <path d={`M${cx_+3},${cy_-s} L${cx_-s+2},${cy_} L${cx_+3},${cy_+s}`}
          fill="none" stroke="#dc2626" strokeWidth="2.5"/>
      </g>
    );
  };

  const bcLeftSymbol=(f,i)=>{
    const cx_=fx(i), cy_=dy(leftBC[f]), s=6;
    const masked=leftBCMask[f];
    if(masked) return(
      <g key={"lb"+f}>
        <path d={`M${cx_-s},${cy_-s} L${cx_+s-2},${cy_-s} L${cx_+s-2},${cy_+s} L${cx_-s},${cy_+s}`}
          fill="none" stroke="#2563eb" strokeWidth="2.5"/>
      </g>
    );
    return(
      <g key={"lb"+f}>
        <path d={`M${cx_-3},${cy_-s} L${cx_+s-2},${cy_} L${cx_-3},${cy_+s}`}
          fill="none" stroke="#2563eb" strokeWidth="2.5"/>
      </g>
    );
  };

  // Greyscale "previous test" overlay — circles for right, X for left, drawn
  // behind the live plot so the change between tests reads at a glance.
  const ghostRightSymbol=(f,i)=>(
    <circle key={"gr"+f} cx={fx(i)} cy={dy(ghostRightT[f])} r="5"
      fill="none" stroke="#9ca3af" strokeWidth="1.5" opacity="0.6"/>
  );
  const ghostLeftSymbol=(f,i)=>{
    const cx_=fx(i), cy_=dy(ghostLeftT[f]), s=5;
    return(
      <g key={"gl"+f} opacity="0.6">
        <line x1={cx_-s} y1={cy_-s} x2={cx_+s} y2={cy_+s} stroke="#9ca3af" strokeWidth="1.5"/>
        <line x1={cx_+s} y1={cy_-s} x2={cx_-s} y2={cy_+s} stroke="#9ca3af" strokeWidth="1.5"/>
      </g>
    );
  };

  return(
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}
      style={{cursor:interactive?"crosshair":"default",fontFamily:"Sora,sans-serif",display:"block"}}
      onClick={handleClick}>
      {DEGREE_REGIONS.map(r=>(
        <rect key={r.label} x={ML} y={dy(r.from)} width={PW}
          height={Math.max(0,dy(Math.min(r.to,120))-dy(r.from))} fill={r.fill}/>
      ))}
      {DEGREE_REGIONS.map(r=>(
        <text key={r.label+"t"} x={ML+PW+5} y={dy((r.from+Math.min(r.to,120))/2)+4}
          fontSize="9" fill={r.color} fontWeight="700">{r.label}</text>
      ))}
      {AUDIG_FREQS.map((f,i)=>(
        <g key={f}>
          <line x1={fx(i)} y1={MT} x2={fx(i)} y2={MT+PH} stroke="#e5e7eb" strokeWidth="1"/>
          <text x={fx(i)} y={MT-12} fontSize="10" fill="#374151" textAnchor="middle" fontWeight="600">
            {f>=1000?f/1000+"k":f}
          </text>
          <text x={fx(i)} y={MT-2} fontSize="8" fill="#9ca3af" textAnchor="middle">Hz</text>
        </g>
      ))}
      {[-10,0,10,20,30,40,50,60,70,80,90,100,110,120].map(db=>(
        <g key={db}>
          <line x1={ML} y1={dy(db)} x2={ML+PW} y2={dy(db)}
            stroke={db===0?"#374151":"#e5e7eb"} strokeWidth={db===0?1.5:1}/>
          <text x={ML-6} y={dy(db)+4} fontSize="10" fill="#6b7280" textAnchor="end">{db}</text>
        </g>
      ))}
      <text x={ML-38} y={MT+PH/2} fontSize="10" fill="#9ca3af" textAnchor="middle"
        transform={`rotate(-90,${ML-38},${MT+PH/2})`}>Hearing Level (dB HL)</text>
      <text x={ML+PW/2} y={H-2} fontSize="10" fill="#9ca3af" textAnchor="middle">Frequency (Hz)</text>
      {/* Speech banana overlay */}
      {showBanana&&(
        <g>
          <polygon
            points={[...SPEECH_BANANA_UPPER,...SPEECH_BANANA_LOWER].map(p=>`${freqToSvgX(p.freq,ML,PW)},${dy(p.db)}`).join(" ")}
            fill="#ffffff" fillOpacity="0.75" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.4"/>
          {/* 1000 Hz dashed vertical divider */}
          <line x1={freqToSvgX(1000,ML,PW)} y1={MT} x2={freqToSvgX(1000,ML,PW)} y2={MT+PH}
            stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 3"/>
          {/* Awareness / Clarity labels */}
          <text x={(ML+freqToSvgX(1000,ML,PW))/2} y={dy(12)} fontSize="9" fill="#9ca3af"
            textAnchor="middle" fontWeight="600" fontStyle="italic">Awareness</text>
          <text x={(freqToSvgX(1000,ML,PW)+ML+PW)/2} y={dy(12)} fontSize="9" fill="#9ca3af"
            textAnchor="middle" fontWeight="600" fontStyle="italic">Clarity</text>
        </g>
      )}
      {/* Phoneme labels with dimming */}
      {showBanana&&phonemeDimMode&&PHONEMES.map((ph,pi)=>{
        const px=freqToSvgX(ph.displayFreq,ML,PW);
        const py=dy(ph.displayDb);
        // Determine audibility per ear
        const rThr=interpolateThreshold(rightT,ph.freq);
        const lThr=interpolateThreshold(leftT,ph.freq);
        const rInaudible=rThr!=null&&rThr>ph.db;
        const lInaudible=lThr!=null&&lThr>ph.db;
        const rBorderline=rThr!=null&&!rInaudible&&(rThr>ph.db-5);
        const lBorderline=lThr!=null&&!lInaudible&&(lThr>ph.db-5);
        // Pick which ear(s) to evaluate
        let inaudible=false, borderline=false;
        if(phonemeDimMode==="right"){ inaudible=rInaudible; borderline=!inaudible&&rBorderline; }
        else if(phonemeDimMode==="left"){ inaudible=lInaudible; borderline=!inaudible&&lBorderline; }
        else{ /* both — use worse ear */ inaudible=rInaudible||lInaudible; borderline=!inaudible&&(rBorderline||lBorderline); }
        const t=dimIntensity/100;
        const lerpC=(a,b,f)=>Math.round(a+(b-a)*f);
        const baseRgb=[30,41,59];
        const inaudRgb=[194,65,12]; // #c2410c
        const borderRgb=[245,158,11]; // #f59e0b
        const opacity=inaudible?t:borderline?(0.85*t+1*(1-t)):1.0;
        const color=inaudible
          ?`rgb(${lerpC(baseRgb[0],inaudRgb[0],t)},${lerpC(baseRgb[1],inaudRgb[1],t)},${lerpC(baseRgb[2],inaudRgb[2],t)})`
          :borderline
          ?`rgb(${lerpC(baseRgb[0],borderRgb[0],t)},${lerpC(baseRgb[1],borderRgb[1],t)},${lerpC(baseRgb[2],borderRgb[2],t)})`
          :"#1e293b";
        const weight=inaudible?700:600;
        return(
          <g key={"ph"+pi}>
            <text x={px} y={py+4} fontSize="10" fill={color} opacity={opacity}
              textAnchor="middle" fontWeight={weight} style={{fontFamily:"Sora,sans-serif"}}
              letterSpacing="0.5">
              {ph.label}
            </text>
          </g>
        );
      })}
      {/* Ghost (previous test) overlay — greyscale, behind live data */}
      {ghostRPts.length>1&&<polyline points={ghostRPts.join(" ")} fill="none" stroke="#9ca3af" strokeWidth="1.25" strokeOpacity="0.5" strokeDasharray="3 3"/>}
      {ghostLPts.length>1&&<polyline points={ghostLPts.join(" ")} fill="none" stroke="#9ca3af" strokeWidth="1.25" strokeOpacity="0.5" strokeDasharray="3 3"/>}
      {AUDIG_FREQS.map((f,i)=>ghostRightT[f]!=null&&ghostRightSymbol(f,i))}
      {AUDIG_FREQS.map((f,i)=>ghostLeftT[f]!=null&&ghostLeftSymbol(f,i))}
      {/* AC polylines */}
      {rPts.length>1&&<polyline points={rPts.join(" ")} fill="none" stroke="#dc2626" strokeWidth="1.5" strokeOpacity="0.7"/>}
      {lPts.length>1&&<polyline points={lPts.join(" ")} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.7"/>}
      {/* BC polylines (dashed) */}
      {rBCPts.length>1&&<polyline points={rBCPts.join(" ")} fill="none" stroke="#dc2626" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 3"/>}
      {lBCPts.length>1&&<polyline points={lBCPts.join(" ")} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 3"/>}
      {/* AC symbols */}
      {AUDIG_FREQS.map((f,i)=>rightT[f]!=null&&acRightSymbol(f,i))}
      {AUDIG_FREQS.map((f,i)=>leftT[f]!=null&&acLeftSymbol(f,i))}
      {/* BC symbols */}
      {AUDIG_FREQS.map((f,i)=>rightBC[f]!=null&&bcRightSymbol(f,i))}
      {AUDIG_FREQS.map((f,i)=>leftBC[f]!=null&&bcLeftSymbol(f,i))}
      {/* Legend */}
      <circle cx={ML+4} cy={MT-26} r="4" fill="white" stroke="#dc2626" strokeWidth="2"/>
      <text x={ML+12} y={MT-22} fontSize="9" fill="#dc2626" fontWeight="600">R AC</text>
      <g transform={`translate(${ML+44},${MT-26})`}>
        <line x1={-4} y1={-4} x2={4} y2={4} stroke="#2563eb" strokeWidth="2"/>
        <line x1={4} y1={-4} x2={-4} y2={4} stroke="#2563eb" strokeWidth="2"/>
      </g>
      <text x={ML+52} y={MT-22} fontSize="9" fill="#2563eb" fontWeight="600">L AC</text>
      <path d={`M${ML+92},${MT-31} L${ML+84},${MT-26} L${ML+92},${MT-21}`} fill="none" stroke="#dc2626" strokeWidth="2"/>
      <text x={ML+96} y={MT-22} fontSize="9" fill="#dc2626" fontWeight="600">R BC</text>
      <path d={`M${ML+128},${MT-31} L${ML+136},${MT-26} L${ML+128},${MT-21}`} fill="none" stroke="#2563eb" strokeWidth="2"/>
      <text x={ML+140} y={MT-22} fontSize="9" fill="#2563eb" fontWeight="600">L BC</text>
    </svg>
  );
}
