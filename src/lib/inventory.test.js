import { describe, it, expect } from "vitest";
import {
  ALLOWED_TRANSITIONS, UNIT_STATUSES, TERMINAL, canTransition,
  rfcDaysFor, rfcDeadline, inventoryAlerts, unitLabel, unitMatchesSide, RFC_DAYS_DEFAULT,
} from "./inventory.js";

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

describe("state machine", () => {
  it("covers every status and every target is a real status", () => {
    const ids = UNIT_STATUSES.map(s => s.id);
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...ids].sort());
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) for (const t of targets) expect(ids).toContain(t);
  });

  it("terminal statuses go nowhere", () => {
    for (const t of TERMINAL) expect(ALLOWED_TRANSITIONS[t]).toEqual([]);
  });

  it("allows the real-world paths", () => {
    expect(canTransition("on_order", "reserved")).toBe(true);
    expect(canTransition("reserved", "fitted")).toBe(true);
    expect(canTransition("in_stock", "fitted")).toBe(true);      // same-day fit
    expect(canTransition("fitted", "in_repair")).toBe(true);
    expect(canTransition("in_repair", "fitted")).toBe(true);
    expect(canTransition("fitted", "rfc_pending")).toBe(true);   // returned in adaptation period
    expect(canTransition("rfc_pending", "returned_for_credit")).toBe(true);
    expect(canTransition("in_stock", "loaned_out")).toBe(true);
    expect(canTransition("loaned_out", "in_stock")).toBe(true);
  });

  it("refuses skips", () => {
    expect(canTransition("on_order", "fitted")).toBe(false);     // must be received first
    expect(canTransition("on_order", "in_repair")).toBe(false);
    expect(canTransition("returned_for_credit", "in_stock")).toBe(false);
    expect(canTransition("loaned_out", "fitted")).toBe(false);
    expect(canTransition("bogus", "in_stock")).toBe(false);
  });
});

describe("RFC window", () => {
  it("defaults to 60 days from receipt", () => {
    expect(RFC_DAYS_DEFAULT).toBe(60);
    expect(rfcDeadline("2026-01-01", "Phonak")).toBe("2026-03-02");
    expect(rfcDeadline(null, "Phonak")).toBeNull();
  });

  it("honors a per-manufacturer override", () => {
    const accts = { phonak: { rfc_days: 90 }, signia: { rfc_days: "bad" } };
    expect(rfcDaysFor("Phonak", accts)).toBe(90);
    expect(rfcDaysFor("Signia", accts)).toBe(60);
    expect(rfcDeadline("2026-01-01", "phonak", accts)).toBe("2026-04-01");
  });
});

describe("alerts", () => {
  it("flags overdue orders, closing RFC windows, long repairs and loaners", () => {
    const units = [
      { id: "1", status: "on_order", ordered_at: day(-12) },
      { id: "2", status: "on_order", ordered_at: day(-3) },
      { id: "3", status: "fitted", rfc_deadline: day(5) },
      { id: "4", status: "fitted", rfc_deadline: day(40) },
      { id: "5", status: "returned_for_credit", rfc_deadline: day(2) },
      { id: "6", status: "in_repair", updated_at: new Date(Date.now() - 25 * 86400000).toISOString() },
      { id: "7", status: "loaned_out", updated_at: new Date(Date.now() - 10 * 86400000).toISOString() },
    ];
    const kinds = inventoryAlerts(units).map(a => `${a.unit.id}:${a.kind}`);
    expect(kinds).toEqual(["1:order_overdue", "3:rfc_closing", "6:repair_overdue"]);
  });

  it("uses the last event time when provided", () => {
    const u = { id: "9", status: "loaned_out", updated_at: new Date().toISOString() };
    expect(inventoryAlerts([u], { 9: new Date(Date.now() - 40 * 86400000).toISOString() })[0].kind).toBe("loaner_overdue");
  });
});

describe("labels and matching", () => {
  it("builds a readable unit label", () => {
    expect(unitLabel({ manufacturer: "Signia", family: "Pure C&G IX", tech_level: "7IX", style: "RIC", ear: "left", serial_number: "AB12" }))
      .toBe("Signia Pure C&G IX 7IX · RIC · L · SN AB12");
    expect(unitLabel({ manufacturer: "Phonak" })).toBe("Phonak · no serial");
  });

  it("matches stock to a fitting side by manufacturer, family, level and ear", () => {
    const u = { manufacturer: "ReSound", family: "Vivia", tech_level: "9", ear: "left" };
    expect(unitMatchesSide(u, { manufacturer: "Resound", family: "vivia", techLevel: "9", ear: "left" })).toBe(true);
    expect(unitMatchesSide(u, { manufacturer: "Resound", family: "Vivia", techLevel: "9", ear: "right" })).toBe(false);
    expect(unitMatchesSide(u, { manufacturer: "Phonak", family: "Vivia" })).toBe(false);
    expect(unitMatchesSide({ ...u, ear: null }, { manufacturer: "ReSound", family: "Vivia", ear: "right" })).toBe(true);
  });
});
