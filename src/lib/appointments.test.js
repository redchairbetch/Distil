import { describe, it, expect } from "vitest";
import { apptDay, apptDaysUntil, partitionAppointments, dueAppointments, dueCareVisit } from "./appointments.js";

// Build a bare YYYY-MM-DD string offset from today in *local* time, matching
// how the wizard's <input type="date"> produces values.
const dayFromToday = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

describe("apptDay", () => {
  it("passes bare dates through and strips timestamp tails", () => {
    expect(apptDay("2026-08-14")).toBe("2026-08-14");
    expect(apptDay("2026-08-14T00:00:00+00:00")).toBe("2026-08-14");
    expect(apptDay(null)).toBe("");
  });
});

describe("apptDaysUntil", () => {
  it("treats a UTC-midnight timestamp as its calendar day, not a local shift", () => {
    // Native new Date() would render this a day early in negative-offset TZs.
    expect(apptDaysUntil(`${dayFromToday(0)}T00:00:00+00:00`)).toBe(0);
    expect(apptDaysUntil(dayFromToday(3))).toBe(3);
    expect(apptDaysUntil(dayFromToday(-2))).toBe(-2);
  });
});

describe("partitionAppointments", () => {
  const appts = [
    { id: "a", date: dayFromToday(-10), type: "2-Week Follow-Up", status: "completed" },
    { id: "b", date: dayFromToday(-5), type: "4-Week Follow-Up", status: "scheduled" },
    { id: "c", date: dayFromToday(2), type: "Quarterly Clean & Check" }, // no status = scheduled
    { id: "d", date: dayFromToday(30), type: "Annual Exam", status: "scheduled" },
    { id: "e", date: dayFromToday(1), type: "Repair Appointment", status: "cancelled" },
    { id: "f", date: null },
  ];
  const parts = partitionAppointments(appts);

  it("routes past scheduled rows to overdue, not history", () => {
    expect(parts.overdue.map(a => a.id)).toEqual(["b"]);
  });

  it("picks the earliest scheduled future row as next", () => {
    expect(parts.next.id).toBe("c");
    expect(parts.upcoming.map(a => a.id)).toEqual(["c", "d"]);
  });

  it("history holds completed + cancelled, newest first, and drops dateless rows", () => {
    expect(parts.history.map(a => a.id)).toEqual(["e", "a"]);
  });

  it("handles empty input", () => {
    expect(partitionAppointments()).toEqual({ overdue: [], next: null, upcoming: [], history: [] });
  });
});

describe("dueAppointments", () => {
  it("returns overdue plus within-window scheduled visits only", () => {
    const appts = [
      { id: "over", date: dayFromToday(-3), status: "scheduled" },
      { id: "soon", date: dayFromToday(5), status: "scheduled" },
      { id: "far", date: dayFromToday(20), status: "scheduled" },
      { id: "done", date: dayFromToday(2), status: "completed" },
    ];
    expect(dueAppointments(appts, 7).map(a => a.id)).toEqual(["over", "soon"]);
  });
});

describe("dueCareVisit", () => {
  it("prefers the oldest recent-overdue visit, ignores stale overdue rows", () => {
    expect(dueCareVisit([
      { id: "stale", date: dayFromToday(-90), status: "scheduled" },
      { id: "recent", date: dayFromToday(-4), status: "scheduled" },
      { id: "soon", date: dayFromToday(3), status: "scheduled" },
    ]).id).toBe("recent");
  });

  it("falls back to the earliest upcoming visit inside the window", () => {
    expect(dueCareVisit([
      { id: "soon", date: dayFromToday(6), status: "scheduled" },
      { id: "far", date: dayFromToday(45), status: "scheduled" },
    ]).id).toBe("soon");
    expect(dueCareVisit([{ id: "far", date: dayFromToday(45), status: "scheduled" }])).toBe(null);
  });
});
