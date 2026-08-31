// Manufacturer form registry (backlog #42). One map module per PDF in
// docs/manufacturer-forms/; each map is version-stamped (sha256) against the
// exact bytes of its blank. registry.test.js walks this list and fails loudly
// on a missing PDF, a stale hash, or a bad AcroForm target.
//
// 2026-08-30: the corrupt signia-return-for-credit.pdf was replaced with a
// clean fillable copy (SI-22269) and mapped; the Additional-forms import
// added Phonak/Unitron/Widex earmold order forms.

import oticonRepair from "./maps/oticon-repair.js";
import oticonReturnForCredit from "./maps/oticon-return-for-credit.js";
import oticonLossDamage from "./maps/oticon-loss-damage.js";
import oticonSiriusEarmoldOrder from "./maps/oticon-sirius-earmold-order.js";
import oticonRiteEarmoldOrderUpdated from "./maps/oticon-rite-earmold-order-updated.js";
import oticonRiteCordaEarmoldOrder from "./maps/oticon-rite-corda-earmold-order.js";
import phonakRepair from "./maps/phonak-repair.js";
import phonakServiceForm from "./maps/phonak-service-form.js";
import phonakLossDamage from "./maps/phonak-loss-damage.js";
import phonakReturnForCredit from "./maps/phonak-return-for-credit.js";
import phonakReturnForCreditLdClaim from "./maps/phonak-return-for-credit-ld-claim.js";
import phonakFmReturnForCredit from "./maps/phonak-fm-return-for-credit.js";
import phonakEarmoldOrder from "./maps/phonak-earmold-order.js";
import phonakSlimTipCrosTip60Order from "./maps/phonak-slim-tip-cros-tip-6-0-order.js";
import phonakCshell60Order from "./maps/phonak-cshell-6-0-order.js";
import signiaRepair from "./maps/signia-repair.js";
import signiaLossDamage from "./maps/signia-loss-damage.js";
import signiaRic30CustomEarmoldOrder from "./maps/signia-ric-3-0-custom-earmold-order.js";
import signiaReturnForCredit from "./maps/signia-return-for-credit.js";
import rextonRepair from "./maps/rexton-repair.js";
import rextonLossDamage from "./maps/rexton-loss-damage.js";
import rextonReturnForCredit from "./maps/rexton-return-for-credit.js";
import resoundRepair from "./maps/resound-repair.js";
import resoundLossDamage from "./maps/resound-loss-damage.js";
import resoundRieCustomEarmoldOrder from "./maps/resound-rie-custom-earmold-order.js";
import resoundBteCustomEarmoldOrder from "./maps/resound-bte-custom-earmold-order.js";
import starkeyRepair from "./maps/starkey-repair.js";
import starkeyLossDamage from "./maps/starkey-loss-damage.js";
import starkeyReturnForCredit from "./maps/starkey-return-for-credit.js";
import starkeyEarmoldOrder from "./maps/starkey-earmold-order.js";
import starkeyEarmoldCustomOrder from "./maps/starkey-earmold-custom-order.js";
import widexRepair from "./maps/widex-repair.js";
import widexLossDamage from "./maps/widex-loss-damage.js";
import widexReturnForCredit from "./maps/widex-return-for-credit.js";
import widexMomentRicBteOrder from "./maps/widex-moment-ric-bte-order.js";
import unitronRepairLdRfc from "./maps/unitron-repair-ld-rfc.js";
import unitronVivanteMoxiRicOrder from "./maps/unitron-vivante-moxi-ric-order.js";
import unitronVivanteStrideBteOrder from "./maps/unitron-vivante-stride-bte-order.js";
import relate40BteEarmoldOrder from "./maps/relate-4-0-bte-earmold-order.js";
import relate40RicCustomEarPieceOrder from "./maps/relate-4-0-ric-custom-ear-piece-order.js";
import relate50IteRCustomOrder from "./maps/relate-5-0-ite-r-custom-order.js";
import relate5010NwOmniOrder from "./maps/relate-5-0-10-nw-omni-order.js";
import relateOneTimeCourtesyReplacement from "./maps/relate-one-time-courtesy-replacement.js";

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
  oticonSiriusEarmoldOrder,
  oticonRiteEarmoldOrderUpdated,
  oticonRiteCordaEarmoldOrder,
  phonakRepair,
  phonakServiceForm,
  phonakLossDamage,
  phonakReturnForCredit,
  phonakReturnForCreditLdClaim,
  phonakFmReturnForCredit,
  phonakEarmoldOrder,
  phonakSlimTipCrosTip60Order,
  phonakCshell60Order,
  signiaRepair,
  signiaLossDamage,
  signiaRic30CustomEarmoldOrder,
  signiaReturnForCredit,
  rextonRepair,
  rextonLossDamage,
  rextonReturnForCredit,
  resoundRepair,
  resoundLossDamage,
  resoundRieCustomEarmoldOrder,
  resoundBteCustomEarmoldOrder,
  starkeyRepair,
  starkeyLossDamage,
  starkeyReturnForCredit,
  starkeyEarmoldOrder,
  starkeyEarmoldCustomOrder,
  widexRepair,
  widexLossDamage,
  widexReturnForCredit,
  widexMomentRicBteOrder,
  unitronRepairLdRfc,
  unitronVivanteMoxiRicOrder,
  unitronVivanteStrideBteOrder,
  relate40BteEarmoldOrder,
  relate40RicCustomEarPieceOrder,
  relate50IteRCustomOrder,
  relate5010NwOmniOrder,
  relateOneTimeCourtesyReplacement,
];

export function getFormsFor(mfrKey, category) {
  return FORM_REGISTRY.filter(
    (m) => m.manufacturer === mfrKey && (!category || m.category === category)
  );
}

export function getFormById(id) {
  return FORM_REGISTRY.find((m) => m.id === id) || null;
}
