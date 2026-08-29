// Manufacturer form registry (backlog #42). One map module per PDF in
// docs/manufacturer-forms/; each map is version-stamped (sha256) against the
// exact bytes of its blank. registry.test.js walks this list and fails loudly
// on a missing PDF, a stale hash, or a bad AcroForm target.
//
// Known gap: signia/signia-return-for-credit.pdf is a corrupt file (bad flate
// stream — renders blank); it is excluded until a clean copy is sourced.

import oticonRepair from "./maps/oticon-repair.js";
import oticonReturnForCredit from "./maps/oticon-return-for-credit.js";
import oticonLossDamage from "./maps/oticon-loss-damage.js";
import phonakRepair from "./maps/phonak-repair.js";
import phonakServiceForm from "./maps/phonak-service-form.js";
import phonakLossDamage from "./maps/phonak-loss-damage.js";
import phonakReturnForCredit from "./maps/phonak-return-for-credit.js";
import phonakReturnForCreditLdClaim from "./maps/phonak-return-for-credit-ld-claim.js";
import phonakFmReturnForCredit from "./maps/phonak-fm-return-for-credit.js";
import signiaRepair from "./maps/signia-repair.js";
import signiaLossDamage from "./maps/signia-loss-damage.js";
import rextonRepair from "./maps/rexton-repair.js";
import rextonLossDamage from "./maps/rexton-loss-damage.js";
import rextonReturnForCredit from "./maps/rexton-return-for-credit.js";
import resoundRepair from "./maps/resound-repair.js";
import resoundLossDamage from "./maps/resound-loss-damage.js";
import starkeyRepair from "./maps/starkey-repair.js";
import starkeyLossDamage from "./maps/starkey-loss-damage.js";
import starkeyReturnForCredit from "./maps/starkey-return-for-credit.js";
import widexRepair from "./maps/widex-repair.js";
import widexLossDamage from "./maps/widex-loss-damage.js";
import widexReturnForCredit from "./maps/widex-return-for-credit.js";
import unitronRepairLdRfc from "./maps/unitron-repair-ld-rfc.js";

export const FORM_CATEGORIES = {
  repair: "Repair",
  loss_damage: "Loss & Damage",
  return_credit: "Return for Credit",
  earmold_order: "Earmold Order",
  custom_order: "Custom Order",
};

export const FORM_REGISTRY = [
  oticonRepair,
  oticonReturnForCredit,
  oticonLossDamage,
  phonakRepair,
  phonakServiceForm,
  phonakLossDamage,
  phonakReturnForCredit,
  phonakReturnForCreditLdClaim,
  phonakFmReturnForCredit,
  signiaRepair,
  signiaLossDamage,
  rextonRepair,
  rextonLossDamage,
  rextonReturnForCredit,
  resoundRepair,
  resoundLossDamage,
  starkeyRepair,
  starkeyLossDamage,
  starkeyReturnForCredit,
  widexRepair,
  widexLossDamage,
  widexReturnForCredit,
  unitronRepairLdRfc,
];

export function getFormsFor(mfrKey, category) {
  return FORM_REGISTRY.filter(
    (m) => m.manufacturer === mfrKey && (!category || m.category === category)
  );
}

export function getFormById(id) {
  return FORM_REGISTRY.find((m) => m.id === id) || null;
}
