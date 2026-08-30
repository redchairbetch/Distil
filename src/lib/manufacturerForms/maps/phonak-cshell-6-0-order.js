// Phonak cShell 6.0 order — AcroForm (Infinio-and-newer). Same header layout
// as the SlimTip 6.0 form with shifted audiogram numbering. Faceplate/shell
// color pickers and receiver options stay with the pen; summary in Special
// Instructions.
export default {
  id: "phonak-cshell-6-0-order",
  manufacturer: "phonak",
  category: "earmold_order",
  title: "Phonak cShell 6.0 Order",
  pdf: "phonak/phonak-cshell-6-0-order.pdf",
  sha256: "39d75bede2feee52e50290bab507ea800708e03afe671fa50ed8eb5774710dc0",
  mode: "acroform",
  fields: [
    { logical: "clinic.shipTo", target: "1" },
    { logical: "clinic.street", target: "2" },
    { logical: "clinic.city", target: "3" },
    { logical: "clinic.state", target: "4" },
    { logical: "clinic.zip", target: "5" },
    { logical: "clinic.billTo", target: "6" },
    { logical: "fitting.date", target: "8" },
    { logical: "po", target: "9" },
    { logical: "provider.name", target: "10" },
    { logical: "clinic.phone", target: "11" },
    { logical: "patient.lastName", target: "13" },
    { logical: "patient.firstName", target: "14" },
    { logical: "patient.age", target: "15" },
    ...[250, 500, 1000, 2000, 3000, 4000].flatMap((f, i) => [
      { logical: `audiogram.left.${f}`, target: String(19 + i) },
      { logical: `audiogram.right.${f}`, target: String(25 + i) },
    ]),
    { logical: "earmold.left.style", type: "checkbox", target: "42", equalsAll: { "earmold.left.style": "cshell-acrylic" } },
    { logical: "earmold.right.style", type: "checkbox", target: "43", equalsAll: { "earmold.right.style": "cshell-acrylic" } },
    { logical: "earmold.left.style", type: "checkbox", target: "89", equalsAll: { "earmold.left.style": "cshell-titanium" } },
    { logical: "earmold.right.style", type: "checkbox", target: "90", equalsAll: { "earmold.right.style": "cshell-titanium" } },
    { logical: "earmold.summary", target: "59" },
  ],
};
