// ReSound RIE custom earmold order (MK604744) — flat PDF, overlay. Header +
// patient fill; the style/receiver/vent tick columns and audiogram grid stay
// with the pen (10 tight columns), with the full mold configuration printed
// in Special Instructions via earmold.summary.
export default {
  id: "resound-rie-custom-earmold-order",
  manufacturer: "resound",
  category: "earmold_order",
  title: "ReSound RIE Custom Earmold Order",
  pdf: "resound/resound-rie-custom-earmold-order.pdf",
  sha256: "d8cd5f84d67743a856fa6b6750390c92ca2f42ad116b59db88d65af7958b250e",
  mode: "overlay",
  fields: [
    { logical: "clinic.shipTo", page: 0, x: 82, y: 702, size: 8, maxWidth: 145 },
    { logical: "meta.today", page: 0, x: 258, y: 702, size: 8, maxWidth: 48 },
    { logical: "clinic.name", page: 0, x: 75, y: 687, size: 8, maxWidth: 225 },
    { logical: "clinic.street", page: 0, x: 75, y: 673, size: 8, maxWidth: 225 },
    { logical: "clinic.city", page: 0, x: 65, y: 658, size: 8, maxWidth: 85 },
    { logical: "clinic.state", page: 0, x: 180, y: 658, size: 8, maxWidth: 30 },
    { logical: "clinic.zip", page: 0, x: 232, y: 658, size: 8, maxWidth: 60 },
    { logical: "clinic.billTo", page: 0, x: 75, y: 643, size: 8, maxWidth: 225 },
    { logical: "po", page: 0, x: 65, y: 629, size: 8, maxWidth: 200 },
    { logical: "provider.name", page: 0, x: 105, y: 614, size: 8, maxWidth: 195 },
    { logical: "clinic.phone", page: 0, x: 108, y: 599, size: 8, maxWidth: 190 },
    { logical: "patient.lastName", page: 0, x: 75, y: 567, size: 8, maxWidth: 225 },
    { logical: "patient.firstName", page: 0, x: 75, y: 552, size: 8, maxWidth: 225 },
    { logical: "device.primary.model", page: 0, x: 355, y: 543, size: 7, maxWidth: 105 },
    { logical: "device.primary.color", page: 0, x: 500, y: 543, size: 7, maxWidth: 80 },
    { logical: "earmold.summary", page: 0, x: 320, y: 55, size: 7, maxWidth: 262 },
  ],
};
