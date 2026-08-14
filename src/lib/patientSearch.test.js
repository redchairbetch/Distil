import { describe, it, expect } from "vitest";
import { patientMatchesSearch, sortPatients } from "./patientSearch.js";

const p = (over = {}) => ({
  name: "Gerald Maxfield",
  phone: "(435) 555-1234",
  payType: "insurance",
  insurance: { carrier: "TruHearing" },
  carePlan: "complete",
  createdAt: "2026-01-05T10:00:00Z",
  devices: { manufacturer: "Signia", warrantyExpiry: "2029-06-01", fittingDate: "2026-06-01" },
  ...over,
});

describe("patientMatchesSearch", () => {
  it("matches name case-insensitively", () => {
    expect(patientMatchesSearch(p(), "gerald")).toBe(true);
    expect(patientMatchesSearch(p(), "MAXFIELD")).toBe(true);
  });

  it("matches device manufacturer", () => {
    expect(patientMatchesSearch(p(), "signia")).toBe(true);
  });

  it("matches phone regardless of formatting", () => {
    expect(patientMatchesSearch(p(), "4355551234")).toBe(true);
    expect(patientMatchesSearch(p(), "555-1234")).toBe(true);
    expect(patientMatchesSearch(p(), "(435) 555")).toBe(true);
  });

  it("does not phone-match on short or lettered terms", () => {
    expect(patientMatchesSearch(p(), "55")).toBe(false); // <3 digits
    expect(patientMatchesSearch(p(), "ger5551234")).toBe(false); // mostly letters
  });

  it("empty term matches everything", () => {
    expect(patientMatchesSearch(p(), "")).toBe(true);
    expect(patientMatchesSearch(p(), "   ")).toBe(true);
  });

  it("survives missing fields", () => {
    expect(patientMatchesSearch({ name: null, devices: null, phone: null }, "x")).toBe(false);
  });
});

describe("sortPatients", () => {
  const list = [
    p({ name: "Zed Alpha", devices: { manufacturer: "Widex", warrantyExpiry: "2027-01-01" } }),
    p({ name: "Ann Brown", devices: { manufacturer: "Signia", warrantyExpiry: null } }),
    p({ name: "Mia Cole", devices: { manufacturer: "Oticon", warrantyExpiry: "2030-01-01" } }),
  ];

  it("sorts by name asc/desc", () => {
    expect(sortPatients(list, "name", "asc").map(x => x.name)).toEqual(["Ann Brown", "Mia Cole", "Zed Alpha"]);
    expect(sortPatients(list, "name", "desc").map(x => x.name)).toEqual(["Zed Alpha", "Mia Cole", "Ann Brown"]);
  });

  it("sorts warranty dates with missing values last in both directions", () => {
    expect(sortPatients(list, "warranty", "asc").map(x => x.name)).toEqual(["Zed Alpha", "Mia Cole", "Ann Brown"]);
    expect(sortPatients(list, "warranty", "desc").map(x => x.name)).toEqual(["Mia Cole", "Zed Alpha", "Ann Brown"]);
  });

  it("returns list unchanged for unknown key and does not mutate input", () => {
    expect(sortPatients(list, "nope")).toBe(list);
    const before = list.map(x => x.name);
    sortPatients(list, "name", "desc");
    expect(list.map(x => x.name)).toEqual(before);
  });

  it("private pay sorts under its own coverage label", () => {
    const mixed = [p(), p({ payType: "private", insurance: null, name: "Priv Pay" })];
    expect(sortPatients(mixed, "coverage", "asc")[0].name).toBe("Priv Pay");
  });
});
