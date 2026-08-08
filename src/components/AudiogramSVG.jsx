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

// ── PRESENTATION-MODE DESATURATION ───────────────────────────────────────────
// Patient-facing presentation halves the saturation of every clinical color so
// the chart reads calmer and the counseling overlays (speech banana, band
// boxes) carry the story. Clinical entry keeps full-strength colors.
// Accepts "#rrggbb", "rgb(...)" or "rgba(...)"; alpha is preserved.
function desat(color, amount=0.5){
  let r,g,b,a=null;
  if(color.startsWith("#")){
    r=parseInt(color.slice(1,3),16); g=parseInt(color.slice(3,5),16); b=parseInt(color.slice(5,7),16);
  }else{
    const m=color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
    if(!m)return color;
    r=Number(m[1]); g=Number(m[2]); b=Number(m[3]); a=m[4]!=null?Number(m[4]):null;
  }
  const rn=r/255,gn=g/255,bn=b/255;
  const max=Math.max(rn,gn,bn),min=Math.min(rn,gn,bn);
  const l=(max+min)/2;
  let h=0,s=0;
  if(max!==min){
    const d=max-min;
    s=d/(1-Math.abs(2*l-1));
    if(max===rn)h=60*(((gn-bn)/d+6)%6);
    else if(max===gn)h=60*((bn-rn)/d+2);
    else h=60*((rn-gn)/d+4);
  }
  s*=amount;
  const c=(1-Math.abs(2*l-1))*s;
  const x=c*(1-Math.abs((h/60)%2-1));
  const m0=l-c/2;
  const [r1,g1,b1]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  const R=Math.round((r1+m0)*255),G=Math.round((g1+m0)*255),B=Math.round((b1+m0)*255);
  return a==null?`rgb(${R},${G},${B})`:`rgba(${R},${G},${B},${a})`;
}

const DEGREE_REGIONS_SOFT = DEGREE_REGIONS.map(r=>({...r, fill:desat(r.fill), color:desat(r.color)}));
const RED_AC="#dc2626", BLUE_AC="#2563eb";
const RED_SOFT=desat(RED_AC), BLUE_SOFT=desat(BLUE_AC);

// ── FREQUENCY BAND BOXES (presentation mode) ─────────────────────────────────
// Two patient-facing bands drawn over the plot: low frequencies carry loudness
// and vowel energy; highs carry the consonants that make speech distinct.
const BAND_BOXES=[
  {from:250, to:1000, label:"Volume & Vowels",      stroke:desat("#4f46e5"), fill:desat("#4f46e5"), text:desat("#4338ca")},
  {from:1000, to:8000, label:"Consonants & Clarity", stroke:desat("#d97706"), fill:desat("#d97706"), text:desat("#b45309")},
];

export function getDegreeName(pta){
  if(pta==null)return null;
  if(pta<=20)return"Normal"; if(pta<=40)return"Mild";
  if(pta<=55)return"Moderate"; if(pta<=70)return"Moderately Severe";
  if(pta<=90)return"Severe"; return"Profound";
}

// ── FREQUENCY COLUMN POSITIONS ───────────────────────────────────────────────
// Standard clinical audiogram layout: octaves get evenly spaced full columns,
// inter-octave frequencies (750/1500/3000/6000) sit midway between neighbors.
const FREQ_POS = {250:0, 500:1, 750:1.5, 1000:2, 1500:2.5, 2000:3, 3000:3.5, 4000:4, 6000:4.5, 8000:5};
const FREQ_POS_MAX = 5;
const INTER_OCTAVES = new Set([750, 1500, 3000, 6000]);

// ── CONTINUOUS FREQUENCY → X MAPPER ──────────────────────────────────────────
// Maps any Hz value to SVG x — piecewise log-interpolation between the two
// surrounding FREQ_POS columns, so arbitrary frequencies (phonemes, banana
// vertices) stay aligned with the plotted gridlines.
export function freqToSvgX(hz, ML, PW){
  const posX=p=>ML+(p/FREQ_POS_MAX)*PW;
  if(FREQ_POS[hz]!=null)return posX(FREQ_POS[hz]);
  if(hz<=AUDIG_FREQS[0])return posX(0);
  const last=AUDIG_FREQS[AUDIG_FREQS.length-1];
  if(hz>=last)return posX(FREQ_POS_MAX);
  let lo=AUDIG_FREQS[0], hi=last;
  for(const f of AUDIG_FREQS){ if(f<=hz)lo=f; if(f>=hz&&f<hi)hi=f; }
  const frac=(Math.log2(hz)-Math.log2(lo))/(Math.log2(hi)-Math.log2(lo));
  return posX(FREQ_POS[lo]+frac*(FREQ_POS[hi]-FREQ_POS[lo]));
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
// Matched to the MedRx/Avant speech area: average conversational speech spans
// ~10–50 dB HL from 250 Hz to 6 kHz, drawn as a band with chamfered bottom
// corners (the low-frequency vowel shelf and the high-frequency roll-off).
const SPEECH_BANANA_UPPER=[
  {freq:250,db:10},{freq:6000,db:10}
];
const SPEECH_BANANA_LOWER=[
  {freq:6000,db:38},{freq:4000,db:50},{freq:500,db:50},{freq:250,db:45}
];

// ── PHONEME POSITIONS ────────────────────────────────────────────────────────
// Phoneme positions — clinical freq/dB matched to the MedRx/Avant speech
// banana, with display offsets to prevent label overlap.
// displayFreq/displayDb are used for SVG placement; freq/db for audibility math.
// Layout: voiced consonants + vowels hug the bottom-left (250–800 Hz, 30–48 dB);
// v/z sit high-left; unvoiced consonants climb right and QUIET — f/s/th land at
// 15–25 dB in the 4–6 kHz region, which is why a mild high-frequency loss
// takes out clarity first.
export const PHONEMES=[
  {label:'v',freq:290,db:15, displayFreq:290,displayDb:15},
  {label:'z',freq:280,db:21, displayFreq:280,displayDb:21},
  {label:'j',freq:250,db:30, displayFreq:250,displayDb:30},
  {label:'d',freq:290,db:33, displayFreq:290,displayDb:33},
  {label:'b',freq:330,db:35, displayFreq:330,displayDb:35},
  {label:'m',freq:270,db:38, displayFreq:270,displayDb:38},
  {label:'n',freq:310,db:41, displayFreq:310,displayDb:41},
  {label:'u',freq:290,db:44, displayFreq:290,displayDb:44},
  {label:'e',freq:350,db:44, displayFreq:355,displayDb:44},
  {label:'l',freq:500,db:46, displayFreq:480,displayDb:46},
  {label:'i',freq:620,db:42, displayFreq:600,displayDb:41},
  {label:'o',freq:650,db:47, displayFreq:670,displayDb:47},
  {label:'a',freq:760,db:44, displayFreq:770,displayDb:43},
  {label:'r',freq:800,db:47, displayFreq:880,displayDb:48},
  {label:'ch',freq:1050,db:35, displayFreq:1050,displayDb:35},
  {label:'sh',freq:1300,db:42, displayFreq:1300,displayDb:42},
  {label:'p',freq:1750,db:23, displayFreq:1650,displayDb:22},
  {label:'h',freq:1900,db:27, displayFreq:1900,displayDb:26},
  {label:'g',freq:2000,db:30, displayFreq:2100,displayDb:31},
  {label:'k',freq:2700,db:31, displayFreq:2700,displayDb:31},
  {label:'t',freq:4000,db:30, displayFreq:4000,displayDb:30},
  {label:'f',freq:4500,db:22, displayFreq:4300,displayDb:21},
  {label:'s',freq:4700,db:25, displayFreq:4900,displayDb:26},
  {label:'th',freq:5500,db:15, displayFreq:5500,displayDb:15},
];

export function AudigramSVG({rightT={},leftT={},rightBC={},leftBC={},rightMask={},leftMask={},rightBCMask={},leftBCMask={},ghostRightT={},ghostLeftT={},interactive=false,onSet,activeEar="right",activeTestType="AC",maskMode=false,showBanana=false,phonemeDimMode=null,dimIntensity=75,presentation=false}){
  // H=395 (was 340) stretches the plot area ~20% vertically — deliberate
  // exaggeration so threshold drops read steeper during counseling.
  const W=600,H=395,ML=52,MT=42,MR=88,MB=24;
  const PW=W-ML-MR, PH=H-MT-MB;
  const fx=f=>ML+(FREQ_POS[f]/FREQ_POS_MAX)*PW;
  const dy=db=>MT+(db-(-10))/130*PH;
  // Presentation mode: 50%-desaturated palette, half-size threshold symbols.
  const regions=presentation?DEGREE_REGIONS_SOFT:DEGREE_REGIONS;
  const redC=presentation?RED_SOFT:RED_AC;
  const blueC=presentation?BLUE_SOFT:BLUE_AC;
  const symK=presentation?0.5:1;
  const symSW=2.5*symK;
  // Connecting lines stay at full clinical saturation even in presentation —
  // with the regions/symbols desaturated, the threshold contour is the one
  // element that pops. Slightly heavier and more opaque there for the same
  // reason.
  const lineRed=RED_AC, lineBlue=BLUE_AC;
  const lineW=presentation?2.25:1.5;
  const lineOp=presentation?0.95:0.7;
  const bcLineOp=presentation?0.7:0.5;

  const handleClick=e=>{
    if(!interactive)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const svgX=(e.clientX-rect.left)*(W/rect.width);
    const svgY=(e.clientY-rect.top)*(H/rect.height);
    // Snap to the nearest frequency column; ignore clicks outside the plot
    // (columns are no longer index-even, so nearest-by-x replaces rounding).
    if(svgX<ML-10||svgX>ML+PW+10)return;
    let freq=null, best=Infinity;
    for(const f of AUDIG_FREQS){
      const d=Math.abs(svgX-fx(f));
      if(d<best){ best=d; freq=f; }
    }
    const db=Math.round(((svgY-MT)/PH*130+(-10))/5)*5;
    const clamped=Math.max(-10,Math.min(120,db));
    const curMap=activeTestType==="BC"
      ?(activeEar==="right"?rightBC:leftBC)
      :(activeEar==="right"?rightT:leftT);
    onSet?.(activeEar,freq,curMap[freq]===clamped?null:clamped,activeTestType,maskMode);
  };

  const pts=thr=>AUDIG_FREQS.map(f=>thr[f]!=null?`${fx(f)},${dy(thr[f])}`:null).filter(Boolean);
  const rPts=pts(rightT), lPts=pts(leftT);
  const rBCPts=pts(rightBC), lBCPts=pts(leftBC);
  const ghostRPts=pts(ghostRightT), ghostLPts=pts(ghostLeftT);

  // Symbol renderers
  const acRightSymbol=f=>{
    const cx_=fx(f), cy_=dy(rightT[f]), s=(interactive&&activeEar==="right"&&activeTestType==="AC"?7:6)*symK;
    const masked=rightMask[f];
    if(masked) return(
      <g key={"r"+f}>
        <polygon points={`${cx_},${cy_-s} ${cx_+s},${cy_+s} ${cx_-s},${cy_+s}`}
          fill="white" stroke={redC} strokeWidth={symSW}/>
      </g>
    );
    return <circle key={"r"+f} cx={cx_} cy={cy_} r={s} fill="white" stroke={redC} strokeWidth={symSW}/>;
  };

  const acLeftSymbol=f=>{
    const cx_=fx(f), cy_=dy(leftT[f]), s=(interactive&&activeEar==="left"&&activeTestType==="AC"?7:6)*symK;
    const masked=leftMask[f];
    if(masked) return(
      <g key={"l"+f}>
        <rect x={cx_-s} y={cy_-s} width={s*2} height={s*2}
          fill="white" stroke={blueC} strokeWidth={symSW}/>
      </g>
    );
    return(
      <g key={"l"+f}>
        <line x1={cx_-s} y1={cy_-s} x2={cx_+s} y2={cy_+s} stroke={blueC} strokeWidth={symSW}/>
        <line x1={cx_+s} y1={cy_-s} x2={cx_-s} y2={cy_+s} stroke={blueC} strokeWidth={symSW}/>
      </g>
    );
  };

  const bcRightSymbol=f=>{
    const cx_=fx(f), cy_=dy(rightBC[f]), s=6*symK, i2=2*symK, i3=3*symK;
    const masked=rightBCMask[f];
    if(masked) return(
      <g key={"rb"+f}>
        <path d={`M${cx_+s},${cy_-s} L${cx_-s+i2},${cy_-s} L${cx_-s+i2},${cy_+s} L${cx_+s},${cy_+s}`}
          fill="none" stroke={redC} strokeWidth={symSW}/>
      </g>
    );
    return(
      <g key={"rb"+f}>
        <path d={`M${cx_+i3},${cy_-s} L${cx_-s+i2},${cy_} L${cx_+i3},${cy_+s}`}
          fill="none" stroke={redC} strokeWidth={symSW}/>
      </g>
    );
  };

  const bcLeftSymbol=f=>{
    const cx_=fx(f), cy_=dy(leftBC[f]), s=6*symK, i2=2*symK, i3=3*symK;
    const masked=leftBCMask[f];
    if(masked) return(
      <g key={"lb"+f}>
        <path d={`M${cx_-s},${cy_-s} L${cx_+s-i2},${cy_-s} L${cx_+s-i2},${cy_+s} L${cx_-s},${cy_+s}`}
          fill="none" stroke={blueC} strokeWidth={symSW}/>
      </g>
    );
    return(
      <g key={"lb"+f}>
        <path d={`M${cx_-i3},${cy_-s} L${cx_+s-i2},${cy_} L${cx_-i3},${cy_+s}`}
          fill="none" stroke={blueC} strokeWidth={symSW}/>
      </g>
    );
  };

  // Greyscale "previous test" overlay — circles for right, X for left, drawn
  // behind the live plot so the change between tests reads at a glance.
  const ghostRightSymbol=f=>(
    <circle key={"gr"+f} cx={fx(f)} cy={dy(ghostRightT[f])} r="5"
      fill="none" stroke="#9ca3af" strokeWidth="1.5" opacity="0.6"/>
  );
  const ghostLeftSymbol=f=>{
    const cx_=fx(f), cy_=dy(ghostLeftT[f]), s=5;
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
      {regions.map(r=>(
        <rect key={r.label} x={ML} y={dy(r.from)} width={PW}
          height={Math.max(0,dy(Math.min(r.to,120))-dy(r.from))} fill={r.fill}/>
      ))}
      {regions.map(r=>(
        <text key={r.label+"t"} x={ML+PW+5} y={dy((r.from+Math.min(r.to,120))/2)+4}
          fontSize="9" fill={r.color} fontWeight="700">{r.label}</text>
      ))}
      {AUDIG_FREQS.map(f=>{
        const inter=INTER_OCTAVES.has(f);
        return(
          <g key={f}>
            <line x1={fx(f)} y1={MT} x2={fx(f)} y2={MT+PH}
              stroke={inter?"#f3f4f6":"#e5e7eb"} strokeWidth="1" strokeDasharray={inter?"3 3":undefined}/>
            <text x={fx(f)} y={MT-12} fontSize={inter?8:10} fill={inter?"#9ca3af":"#374151"}
              textAnchor="middle" fontWeight="600">
              {f>=1000?f/1000+"k":f}
            </text>
            {!inter&&<text x={fx(f)} y={MT-2} fontSize="8" fill="#9ca3af" textAnchor="middle">Hz</text>}
          </g>
        );
      })}
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
          {!presentation&&<>
            {/* 1000 Hz dashed vertical divider */}
            <line x1={freqToSvgX(1000,ML,PW)} y1={MT} x2={freqToSvgX(1000,ML,PW)} y2={MT+PH}
              stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 3"/>
            {/* Awareness / Clarity labels */}
            <text x={(ML+freqToSvgX(1000,ML,PW))/2} y={dy(16)} fontSize="9" fill="#9ca3af"
              textAnchor="middle" fontWeight="600" fontStyle="italic">Awareness</text>
            <text x={(freqToSvgX(1000,ML,PW)+ML+PW)/2} y={dy(16)} fontSize="9" fill="#9ca3af"
              textAnchor="middle" fontWeight="600" fontStyle="italic">Clarity</text>
          </>}
        </g>
      )}
      {/* Frequency band boxes — patient-facing framing of lows vs. highs */}
      {presentation&&BAND_BOXES.map(b=>{
        const x0=freqToSvgX(b.from,ML,PW)+2, x1=freqToSvgX(b.to,ML,PW)-2;
        return(
          <g key={b.label}>
            <rect x={x0} y={MT+2} width={x1-x0} height={PH-4} rx="9"
              fill={b.fill} fillOpacity="0.05" stroke={b.stroke} strokeWidth="2" strokeOpacity="0.75"/>
            <text x={(x0+x1)/2} y={MT+20} fontSize="15" fill={b.text}
              textAnchor="middle" fontWeight="800" letterSpacing="0.2">{b.label}</text>
          </g>
        );
      })}
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
      {AUDIG_FREQS.map(f=>ghostRightT[f]!=null&&ghostRightSymbol(f))}
      {AUDIG_FREQS.map(f=>ghostLeftT[f]!=null&&ghostLeftSymbol(f))}
      {/* AC polylines — white halo underneath in presentation so the saturated
          line reads crisply over the shaded regions and band boxes */}
      {presentation&&rPts.length>1&&<polyline points={rPts.join(" ")} fill="none" stroke="#ffffff" strokeWidth={lineW+3} strokeOpacity="0.55" strokeLinejoin="round" strokeLinecap="round"/>}
      {presentation&&lPts.length>1&&<polyline points={lPts.join(" ")} fill="none" stroke="#ffffff" strokeWidth={lineW+3} strokeOpacity="0.55" strokeLinejoin="round" strokeLinecap="round"/>}
      {rPts.length>1&&<polyline points={rPts.join(" ")} fill="none" stroke={lineRed} strokeWidth={lineW} strokeOpacity={lineOp} strokeLinejoin="round" strokeLinecap="round"/>}
      {lPts.length>1&&<polyline points={lPts.join(" ")} fill="none" stroke={lineBlue} strokeWidth={lineW} strokeOpacity={lineOp} strokeLinejoin="round" strokeLinecap="round"/>}
      {/* BC polylines (dashed) */}
      {rBCPts.length>1&&<polyline points={rBCPts.join(" ")} fill="none" stroke={lineRed} strokeWidth={lineW} strokeOpacity={bcLineOp} strokeDasharray="4 3"/>}
      {lBCPts.length>1&&<polyline points={lBCPts.join(" ")} fill="none" stroke={lineBlue} strokeWidth={lineW} strokeOpacity={bcLineOp} strokeDasharray="4 3"/>}
      {/* AC symbols */}
      {AUDIG_FREQS.map(f=>rightT[f]!=null&&acRightSymbol(f))}
      {AUDIG_FREQS.map(f=>leftT[f]!=null&&acLeftSymbol(f))}
      {/* BC symbols */}
      {AUDIG_FREQS.map(f=>rightBC[f]!=null&&bcRightSymbol(f))}
      {AUDIG_FREQS.map(f=>leftBC[f]!=null&&bcLeftSymbol(f))}
      {/* Legend — full-size symbols even in presentation so it stays readable */}
      <circle cx={ML+4} cy={MT-26} r="4" fill="white" stroke={redC} strokeWidth="2"/>
      <text x={ML+12} y={MT-22} fontSize="9" fill={redC} fontWeight="600">R AC</text>
      <g transform={`translate(${ML+44},${MT-26})`}>
        <line x1={-4} y1={-4} x2={4} y2={4} stroke={blueC} strokeWidth="2"/>
        <line x1={4} y1={-4} x2={-4} y2={4} stroke={blueC} strokeWidth="2"/>
      </g>
      <text x={ML+52} y={MT-22} fontSize="9" fill={blueC} fontWeight="600">L AC</text>
      <path d={`M${ML+92},${MT-31} L${ML+84},${MT-26} L${ML+92},${MT-21}`} fill="none" stroke={redC} strokeWidth="2"/>
      <text x={ML+96} y={MT-22} fontSize="9" fill={redC} fontWeight="600">R BC</text>
      <path d={`M${ML+128},${MT-31} L${ML+136},${MT-26} L${ML+128},${MT-21}`} fill="none" stroke={blueC} strokeWidth="2"/>
      <text x={ML+140} y={MT-22} fontSize="9" fill={blueC} fontWeight="600">L BC</text>
    </svg>
  );
}
