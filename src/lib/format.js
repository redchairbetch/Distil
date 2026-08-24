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

// Money display helper shared by the pricing editors: show the raw value while
// the field is focused, format to 2 decimals when blurred. Extracted from
// Distil.jsx (backlog #40 — monolith decomposition).
export const formatMoney = (v) => (v == null || v === "" ? "" : Number(v).toFixed(2));
