import test from "node:test";
import assert from "node:assert/strict";
import { homeSchedule } from "../src/homeSchedule.js";

const monday = new Date("2026-10-26T21:00:00Z");
const played = {
  id: "oct24",
  fecha: "2026-10-24",
  hora: "17:00",
  estado: "finalizado",
  golesVerde: 4,
  golesBlanco: 2,
};

test("played October 24 supplies the result and advances to October 31", () => {
  const s = homeSchedule([], played, monday);
  assert.equal(s.result, "2026-10-24 · Verde 4 - 2 Blanco");
  assert.equal(s.fecha, "2026-10-31");
  assert.equal(s.upcoming, null);
});
test("history supplies the result even if current fixture is missing or stale", () => {
  for (const current of [null, { ...played, estado: "programado" }]) {
    const s = homeSchedule([played], current, monday);
    assert.equal(s.latest.id, played.id);
    assert.equal(s.fecha, "2026-10-31");
    assert.equal(s.upcoming, null);
  }
});
test("latest finished match wins regardless of history ordering; legacy history supported", () => {
  const s = homeSchedule(
    [played, { id: "older", fecha: "2026-10-17", golesVerde: 1 }],
    null,
    monday,
  );
  assert.equal(s.latest.id, "oct24");
});
test("newly published fixture keeps its actual date, time and formations", () => {
  const current = {
    id: "new",
    fecha: "2026-11-01",
    hora: "18:30",
    estado: "programado",
    verde: [{ id: "p" }],
  };
  const s = homeSchedule([played], current, monday);
  assert.equal(s.fecha, "2026-11-01");
  assert.equal(s.hora, "18:30");
  assert.equal(s.upcoming, current);
  assert.equal(s.latest.id, played.id);
});
test("programmed and live scores never become final results", () => {
  const live = {
    ...played,
    id: "live",
    fecha: "2026-10-31",
    estado: "en vivo",
  };
  const s = homeSchedule([live], live, monday);
  assert.equal(s.result, "");
  assert.equal(s.upcoming, live);
});
test("Saturday advances only after a finished match that day", () => {
  const now = new Date("2026-10-24T18:00:00Z");
  assert.equal(homeSchedule([], null, now).fecha, "2026-10-24");
  assert.equal(homeSchedule([], played, now).fecha, "2026-10-31");
});
test("calendar uses Argentina date around UTC midnight and year rollover", () => {
  assert.equal(
    homeSchedule([], null, new Date("2026-10-25T01:00:00Z")).fecha,
    "2026-10-24",
  );
  assert.equal(
    homeSchedule([], null, new Date("2026-12-31T20:00:00Z")).fecha,
    "2027-01-02",
  );
});
test("outdated unfinished fixture is not represented as the next fixture or a final result", () => {
  const s = homeSchedule([], { ...played, estado: "programado" }, monday);
  assert.equal(s.result, "");
  assert.equal(s.upcoming, null);
  assert.equal(s.fecha, "2026-10-31");
});
