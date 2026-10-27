-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Activate the Beltone catalog seeded inactive by 20261025204835.
--
-- APPLY ONLY AFTER the proprietary-software gate (lib/catalogVisibility) is
-- deployed. Earlier code filters on `active` + `tpa` alone and would offer
-- Beltone to every clinic. Once live, Beltone shows only at clinics whose
-- proprietary_software_auth includes 'beltone'.
update product_catalog
   set active = true
 where manufacturer = 'Beltone'
   and requires_proprietary_software = true;
