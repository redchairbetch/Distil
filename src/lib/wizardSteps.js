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

// Wizard step + Narrative Thread chapter constants. Extracted verbatim from
// Distil.jsx (backlog #40a — monolith decomposition).
// ── WIZARD STEPS ──────────────────────────────────────────────────────────────
// Care Plan leads the treatment conversation: the ongoing care relationship is
// presented first, so the hearing aids arrive as a foregone conclusion once the
// patient understands how success works. Devices are chosen after the plan.
export const STEPS = ["Patient","Health History","Testing","Results","Care Plan","Technology Tier","Device Selection","Commitment"];

// Narrative Thread (backlog #8) — each wizard step belongs to one of five
// chapters. Used to key the provider prompter sidebar to the current chapter.
// Investment (care plan) now precedes Recommendation (tier + devices).
export const STEP_TO_CHAPTER = [1, 1, 2, 2, 3, 4, 4, 5];
export const CHAPTER_TITLES = ["Patient story", "Evidence", "Investment", "Recommendation", "Commitment"];
