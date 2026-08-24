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

// Hearing-loss simulation + counseling narrative generator. Extracted verbatim
// from Distil.jsx (backlog #40a — monolith decomposition).

import { getDegreeName, interpolateThreshold } from "../components/AudiogramSVG.jsx";
import { getPTA4, getSlope } from "./audiogram.js";

// ── HEARING-LOSS SIMULATION (Web Audio) ──────────────────────────────────────
// A biquad peaking bank attenuates each octave band by the patient's hearing
// loss at that frequency, so a normal-hearing listener hears roughly what the
// patient hears. Drives the A/B "your hearing" mode on the results screen and is
// kept consistent with the phoneme-dimming logic so audio + dimmed text agree.
export const SIM_BANDS = [250, 500, 1000, 2000, 4000, 8000];
export const SIM_NORMAL_DB = 20;   // domain rule: normal hearing threshold = 20 dB
export const SIM_MAX_ATTEN = 55;   // cap per band so it never goes fully silent

// Threshold driving a band's attenuation for the selected ear. 'both' uses the
// worse ear per band — matching the dimming paragraph's "inaudible if either ear
// misses it" rule, so the audio tells the same story as the dimmed text.
export function simBandThreshold(aud, freq, ear) {
  const r = interpolateThreshold(aud?.rightT, freq);
  const l = interpolateThreshold(aud?.leftT, freq);
  if (ear === "right") return r;
  if (ear === "left") return l;
  if (r == null) return l;
  if (l == null) return r;
  return Math.max(r, l);
}
export function simAttenForBand(aud, freq, ear) {
  const thr = simBandThreshold(aud, freq, ear);
  if (thr == null) return 0;
  return Math.max(0, Math.min(SIM_MAX_ATTEN, thr - SIM_NORMAL_DB));
}

// SPEECH_BANANA_* + PHONEMES now live in components/AudiogramSVG.jsx (PHONEMES
// imported above for the results render). HIGH_FREQ_CONSONANTS stays — only the
// results render's missing-sounds copy uses it.
export const HIGH_FREQ_CONSONANTS=['s','th','f','sh','ch','k','t','p'];

// Pre-annotated paragraph for hearing simulation. Each segment: {t:text, ph:phoneme|null}
// Paragraph intentionally loads high-frequency consonants (s,f,th,sh,ch,k,p).
export const HEARING_SIM_TEXT = [
  // "Can you hear me? "
  {t:"C",ph:"k"},{t:"a",ph:"a"},{t:"n",ph:"n"},{t:" "},
  {t:"y",ph:"j"},{t:"ou",ph:"u"},{t:" "},
  {t:"h",ph:"h"},{t:"ea",ph:"i"},{t:"r",ph:"r"},{t:" "},
  {t:"m",ph:"m"},{t:"e",ph:"i"},{t:"?"},{t:" "},
  // "My wife says I keep the television too loud, "
  {t:"M",ph:"m"},{t:"y",ph:"a"},{t:" "},
  {t:"w",ph:"v"},{t:"i",ph:"a"},{t:"f",ph:"f"},{t:"e"},{t:" "},
  {t:"s",ph:"s"},{t:"a",ph:"e"},{t:"y",ph:"i"},{t:"s",ph:"z"},{t:" "},
  {t:"I",ph:"a"},{t:" "},
  {t:"k",ph:"k"},{t:"ee",ph:"i"},{t:"p",ph:"p"},{t:" "},
  {t:"th",ph:"th"},{t:"e",ph:"e"},{t:" "},
  {t:"t",ph:"t"},{t:"e",ph:"e"},{t:"l",ph:"l"},{t:"e",ph:"e"},{t:"v",ph:"v"},{t:"i",ph:"i"},{t:"s",ph:"z"},{t:"i",ph:"i"},{t:"o",ph:"o"},{t:"n",ph:"n"},{t:" "},
  {t:"t",ph:"t"},{t:"oo",ph:"u"},{t:" "},
  {t:"l",ph:"l"},{t:"ou",ph:"o"},{t:"d",ph:"d"},{t:","},{t:" "},
  // "but the sound seems fine to me. "
  {t:"b",ph:"b"},{t:"u",ph:"u"},{t:"t",ph:"t"},{t:" "},
  {t:"th",ph:"th"},{t:"e",ph:"e"},{t:" "},
  {t:"s",ph:"s"},{t:"ou",ph:"o"},{t:"n",ph:"n"},{t:"d",ph:"d"},{t:" "},
  {t:"s",ph:"s"},{t:"ee",ph:"i"},{t:"m",ph:"m"},{t:"s",ph:"z"},{t:" "},
  {t:"f",ph:"f"},{t:"i",ph:"a"},{t:"n",ph:"n"},{t:"e"},{t:" "},
  {t:"t",ph:"t"},{t:"o",ph:"u"},{t:" "},
  {t:"m",ph:"m"},{t:"e",ph:"i"},{t:"."},{t:" "},
  // "She thinks I should get my hearing checked. "
  {t:"Sh",ph:"sh"},{t:"e",ph:"i"},{t:" "},
  {t:"th",ph:"th"},{t:"i",ph:"i"},{t:"n",ph:"n"},{t:"k",ph:"k"},{t:"s",ph:"s"},{t:" "},
  {t:"I",ph:"a"},{t:" "},
  {t:"sh",ph:"sh"},{t:"ou",ph:"u"},{t:"l",ph:"l"},{t:"d",ph:"d"},{t:" "},
  {t:"g",ph:"g"},{t:"e",ph:"e"},{t:"t",ph:"t"},{t:" "},
  {t:"m",ph:"m"},{t:"y",ph:"a"},{t:" "},
  {t:"h",ph:"h"},{t:"ea",ph:"i"},{t:"r",ph:"r"},{t:"i",ph:"i"},{t:"n",ph:"n"},{t:"g",ph:"g"},{t:" "},
  {t:"ch",ph:"ch"},{t:"e",ph:"e"},{t:"ck",ph:"k"},{t:"e",ph:"e"},{t:"d",ph:"d"},{t:"."},{t:" "},
  // "I can hear people speaking, "
  {t:"I",ph:"a"},{t:" "},
  {t:"c",ph:"k"},{t:"a",ph:"a"},{t:"n",ph:"n"},{t:" "},
  {t:"h",ph:"h"},{t:"ea",ph:"i"},{t:"r",ph:"r"},{t:" "},
  {t:"p",ph:"p"},{t:"eo",ph:"i"},{t:"p",ph:"p"},{t:"l",ph:"l"},{t:"e",ph:"e"},{t:" "},
  {t:"s",ph:"s"},{t:"p",ph:"p"},{t:"ea",ph:"i"},{t:"k",ph:"k"},{t:"i",ph:"i"},{t:"n",ph:"n"},{t:"g",ph:"g"},{t:","},{t:" "},
  // "but sometimes the words just aren't clear "
  {t:"b",ph:"b"},{t:"u",ph:"u"},{t:"t",ph:"t"},{t:" "},
  {t:"s",ph:"s"},{t:"o",ph:"o"},{t:"m",ph:"m"},{t:"e",ph:"e"},{t:"t",ph:"t"},{t:"i",ph:"a"},{t:"m",ph:"m"},{t:"e",ph:"e"},{t:"s",ph:"z"},{t:" "},
  {t:"th",ph:"th"},{t:"e",ph:"e"},{t:" "},
  {t:"w",ph:"v"},{t:"or",ph:"r"},{t:"d",ph:"d"},{t:"s",ph:"z"},{t:" "},
  {t:"j",ph:"j"},{t:"u",ph:"u"},{t:"s",ph:"s"},{t:"t",ph:"t"},{t:" "},
  {t:"a",ph:"a"},{t:"r",ph:"r"},{t:"e",ph:"e"},{t:"n",ph:"n"},{t:"'t"},{t:" "},
  {t:"c",ph:"k"},{t:"l",ph:"l"},{t:"ea",ph:"i"},{t:"r",ph:"r"},{t:" "},
  // "— especially in a restaurant "
  {t:"\u2014"},{t:" "},
  {t:"e",ph:"e"},{t:"s",ph:"s"},{t:"p",ph:"p"},{t:"e",ph:"e"},{t:"ci",ph:"sh"},{t:"a",ph:"a"},{t:"ll",ph:"l"},{t:"y",ph:"i"},{t:" "},
  {t:"i",ph:"i"},{t:"n",ph:"n"},{t:" "},
  {t:"a",ph:"a"},{t:" "},
  {t:"r",ph:"r"},{t:"e",ph:"e"},{t:"s",ph:"s"},{t:"t",ph:"t"},{t:"au",ph:"o"},{t:"r",ph:"r"},{t:"a",ph:"a"},{t:"n",ph:"n"},{t:"t",ph:"t"},{t:" "},
  // "or when the kids are talking fast."
  {t:"or",ph:"r"},{t:" "},
  {t:"wh",ph:"v"},{t:"e",ph:"e"},{t:"n",ph:"n"},{t:" "},
  {t:"th",ph:"th"},{t:"e",ph:"e"},{t:" "},
  {t:"k",ph:"k"},{t:"i",ph:"i"},{t:"d",ph:"d"},{t:"s",ph:"z"},{t:" "},
  {t:"a",ph:"a"},{t:"r",ph:"r"},{t:"e"},{t:" "},
  {t:"t",ph:"t"},{t:"a",ph:"a"},{t:"l",ph:"l"},{t:"k",ph:"k"},{t:"i",ph:"i"},{t:"n",ph:"n"},{t:"g",ph:"g"},{t:" "},
  {t:"f",ph:"f"},{t:"a",ph:"a"},{t:"s",ph:"s"},{t:"t",ph:"t"},{t:"."},
];

// ── COUNSELING NARRATIVE GENERATOR ─────────────────────────────────────────
export function generateCounseling(aud){
  if(!aud)return null;
  // PTA4 drives the counseling degrees + loudness framing so a sloping
  // high-frequency loss reads at its true severity.
  const rPTA=getPTA4(aud.rightT), lPTA=getPTA4(aud.leftT);
  const rDeg=getDegreeName(rPTA), lDeg=getDegreeName(lPTA);
  const rSlope=getSlope(aud.rightT), lSlope=getSlope(aud.leftT);
  const hasPT=rPTA!=null||lPTA!=null;
  const hasCCT=aud.unaidedR!=null||aud.unaidedL!=null;
  const hasAided=aud.aidedR!=null||aud.aidedL!=null;
  const hasSIN=aud.sinBin!=null;
  if(!hasPT&&!hasCCT&&!hasSIN)return null;


  const slopeSentence=slope=>slope==="sloping"
    ?" The loss drops significantly toward the high frequencies — this affects the consonants that carry meaning (S, F, TH, SH, K), which is why speech often sounds muffled even when it's loud enough.":"";


  const ptaSection=()=>{
    if(!hasPT)return null;
    const both=rDeg&&lDeg;
    const desc=both&&rDeg===lDeg
      ?`a ${rDeg.toLowerCase()} hearing loss in both ears`
      :[rDeg&&`a ${rDeg.toLowerCase()} loss in the right ear`,lDeg&&`a ${lDeg.toLowerCase()} loss in the left ear`].filter(Boolean).join(" and ");
    const maxPTA=Math.max(rPTA??0,lPTA??0);
    return{
      heading:"What your audiogram shows",
      body:`Your results indicate ${desc}.${slopeSentence(rSlope)} Sounds need to be approximately ${maxPTA} dB louder than normal before they register clearly — that's not a small gap. What we're looking at here isn't just "needing the TV up a bit." This is the measurable reason conversations feel like work.`
    };
  };


  const cctSection=()=>{
    if(!hasCCT)return null;
    const r=aud.unaidedR, l=aud.unaidedL;
    const worst=Math.min(r??100,l??100);
    const gap=100-worst;
    const earStr=r!=null&&l!=null?`right (${r}%) and left (${l}%)`
      :r!=null?`right ear: ${r}%`:`left ear: ${l}%`;
    return{
      heading:"How your loss affects word clarity",
      body:`At 45 dB — the softest level at which someone with normal hearing scores 100% on this assessment — you scored ${earStr}. Think of this as the audiological equivalent of the 20/20 line at an eye exam. The ${gap}% gap${gap>25?" isn't subtle — it represents real, measurable difficulty with everyday speech clarity. Not volume, but clarity. Letters and words that sound similar become genuinely hard to separate.":gap>10?" shows meaningful impact on speech clarity, particularly in less-than-ideal conditions.":" reflects very good word recognition ability given the degree of loss."}`
    };
  };


  const aidedSection=()=>{
    if(!hasAided)return null;
    const r=aud.aidedR, l=aud.aidedL;
    const ur=aud.unaidedR, ul=aud.unaidedL;
    const rDelta=r!=null&&ur!=null?r-ur:null;
    const lDelta=l!=null&&ul!=null?l-ul:null;
    const bestDelta=Math.max(rDelta??0,lDelta??0);
    const earStr=r!=null&&l!=null?`right (${r}%) and left (${l}%)`
      :r!=null?`right ear: ${r}%`:`left ear: ${l}%`;
    return{
      heading:"Your potential with correction",
      body:`At your most comfortable listening level — with properly fitted amplification — you scored ${earStr} on speech recognition. ${(r??0)>=85||(l??0)>=85?"This is an excellent result. Your word recognition potential is strong, which means you'll adapt well and get substantial benefit from treatment.":((r??0)>=70||(l??0)>=70)?"This is a solid result and reflects good potential with hearing aids.":"This score, combined with your audiogram, helps us select technology that best suits your pattern of loss."}`
    };
  };


  const sinSection=()=>{
    if(!hasSIN)return null;
    const snr=aud.sinBin;
    if(snr==null)return null;
    const label=snr<=2?"near-normal":snr<=7?"mild":snr<=15?"moderate":"severe";
    const body=snr<=2
      ?`Your ability to separate speech from background noise is near-normal — you have a real advantage here compared to most patients I see. Noisy environments may still feel tiring, but technology will provide meaningful support.`
      :snr<=7
      ?`You need about ${snr} dB more signal-to-noise separation than someone with normal hearing. This quantifies exactly why restaurants, meetings, and group conversations feel like hard work — your auditory system is doing extra processing just to keep up. Modern hearing aids with directional processing and noise management can recover a meaningful portion of this gap.`
      :snr<=15
      ?`You need ${snr} dB more separation between speech and noise than normal — this is a significant deficit that explains why noisy environments feel genuinely exhausting, not just inconvenient. Most patients are relieved to have this validated. Premium technology with advanced noise management provides real improvement, though complex environments will remain the hardest situation regardless of technology.`
      :`With an SNR Loss of ${snr} dB, competing noise creates serious difficulty that goes well beyond what most people experience. Understanding this upfront is important — it sets honest expectations. What technology does here is reduce fatigue, extend your effective range, and make the best situations better. That's a meaningful quality-of-life change even if the hardest environments remain hard.`;
    return{heading:`Background noise: ${label} difficulty (${snr} dB SNR Loss)`,body};
  };


  return[ptaSection(),cctSection(),aidedSection(),sinSection()].filter(Boolean);
}
