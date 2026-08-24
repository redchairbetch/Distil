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

// ── Rebate editor option sets (Admin → Rebates) ──────────────────────────────
// Values mirror the rebate_promo CHECK constraints exactly — changing a value
// here without the DB constraint (and vice versa) will bounce the save.
export const REBATE_TYPE_OPTS = [
  ["seasonal_promo", "Seasonal promotion"],
  ["manufacturer_rebate", "Manufacturer rebate"],
  ["qualifying_program", "Qualifying program"],
];
export const REBATE_DISCOUNT_OPTS = [
  ["flat_amount", "$ off (flat amount)"],
  ["percentage", "% off"],
  ["override_price", "Set promo price ($)"],
];
export const REBATE_MFR_OPTS = ["signia","phonak","oticon","starkey","resound","widex","rexton","truhearing","other"];
export const REBATE_ATTR_OPTS = ["veteran","hardship","loyalty","other"];
export const REBATE_TIER_OPTS = [[5,"Premium (5)"],[4,"Advanced (4)"],[3,"Standard (3)"],[2,"Level 2 (2)"],[1,"Level 1 (1)"]];
