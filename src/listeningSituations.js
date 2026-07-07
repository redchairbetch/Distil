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

// ── Listening situations — shared data for the patient journey ───────────────
// Extracted from views/TierSelection.jsx so both the Technology Tier step
// (Step 1 — "what we found") and the Pricing Reveal (Step 2) can reflect the
// patient's flagged situations and show tier coverage against them.
// (context.md Distil #25: "Reuse the environment data from TierSelection.jsx".)

// Listening environments shown in the coverage chart. Order is fixed —
// roughly an "easy → hardest" ramp.
export const ENVIRONMENTS = [
  { id: "home",       label: "Quiet home / private conversation" },
  { id: "tv",         label: "TV / movies" },
  { id: "phone",      label: "Phone calls" },
  { id: "religious",  label: "Religious services" },
  { id: "car",        label: "Car (road noise)" },
  { id: "restaurant", label: "Restaurant" },
  { id: "groups",     label: "Group conversations / meetings" },
  { id: "outdoors",   label: "Outdoors / wind" },
  { id: "crowds",     label: "Crowds / cocktail / concerts" },
];

// Shorter, warmer labels for the "here's what you told us" reflection chips.
export const SITUATION_LABEL = {
  home:       "Quiet conversation",
  tv:         "Television",
  phone:      "Phone calls",
  religious:  "Religious services",
  car:        "In the car",
  restaurant: "Restaurants",
  groups:     "Group conversations",
  outdoors:   "Outdoors",
  crowds:     "Crowds & gatherings",
};

// Tier × environment coverage, 0–100. Top tier caps at 95% on cocktail-class
// environments — honest, no chart pretends to fully solve those. Levels 0/-1
// (Signia "2"/"1") sit below the three-tier matrix (value tiers shown behind
// the "Show all options" accordion). Engine never picks from these
// (pickRecommendedTier floors at rank ≥ 1).
export const COVERAGE_BY_RANK = {
  5: { home:100, tv:100, phone:100, religious:100, car:100, restaurant:100, groups:100, outdoors:100, crowds: 95 }, // Premium / Select
  3: { home:100, tv:100, phone:100, religious: 80, car: 85, restaurant: 80, groups: 80, outdoors: 75, crowds: 65 }, // Advanced
  1: { home:100, tv: 90, phone: 90, religious: 60, car: 60, restaurant: 50, groups: 50, outdoors: 40, crowds: 30 }, // Standard / entry
  0: { home:100, tv: 80, phone: 80, religious: 50, car: 50, restaurant: 40, groups: 40, outdoors: 30, crowds: 28 }, // Level 2
 '-1': { home: 95, tv: 70, phone: 70, religious: 40, car: 40, restaurant: 30, groups: 30, outdoors: 25, crowds: 25 }, // Level 1
};

// Intake answer (true) → environment IDs the patient struggles with.
// Multiple flags can map to the same environment; de-duplicated in
// flaggedEnvironments(). Drawn from #56 backlog comment + the structured
// signals shipped in #62.
export const INTAKE_TO_ENVS = {
  hear_tv:                ["tv"],
  hear_noisy:             ["restaurant", "crowds", "groups"],
  hear_understand:        ["groups", "restaurant"],
  hear_kids:              ["religious", "groups"],
  hear_repeat:            ["groups"],
  hear_mumble:            ["home", "groups"],
  hear_loud:              ["home"],
  med_noise_recreational: ["outdoors"],
  med_noise_occupational: ["groups", "outdoors"],
};

// Compute the set of environments this patient flagged in their intake.
// Empty set if no intake / nothing flagged.
export function flaggedEnvironments(intakeAnswers) {
  if (!intakeAnswers) return new Set();
  const envs = new Set();
  for (const [key, envList] of Object.entries(INTAKE_TO_ENVS)) {
    if (intakeAnswers[key] === true) {
      for (const e of envList) envs.add(e);
    }
  }
  return envs;
}
