import { test } from "node:test";
import assert from "node:assert/strict";
import {
  monthlyTeam,
  monthKey,
  generateGaceta,
  monthlyProde,
  keeperId,
} from "../src/updates.js";
import { available } from "../src/domain.js";
const a = { id: "a", nombre: "Ángel", arquero: false },
  b = { id: "b", nombre: "B", arquero: false },
  k = { id: "k", nombre: "K", arquero: true },
  j = { id: "j", nombre: "J", arquero: true };
const make = (
  id,
  verde = [k, a],
  blanco = [j, b],
  events = [],
  vg = 2,
  vb = 1,
) => ({
  id,
  estado: "finalizado",
  fecha: `2026-10-${String(Number(id) || 1).padStart(2, "0")}`,
  verde,
  blanco,
  eventosGol: events.map((id) => ({ jugadorId: id })),
  golesVerde: vg,
  golesBlanco: vb,
  arqueroVerdeId: k.id,
  arqueroBlancoId: j.id,
});
test("month selector respects Argentina date at UTC boundary and year rollover", () => {
  assert.equal(monthKey(0, new Date("2026-11-01T01:00:00Z")), "2026-10");
  assert.equal(monthKey(-1, new Date("2026-01-10T12:00:00Z")), "2025-12");
});
test("registered accounts never create ghost players; dedupe prefers permanent ID and nickname", () => {
  const result = available(
    [
      { ...a, usuarioUid: "u" },
      { id: "user_u", nombre: "Dup", usuarioUid: "u" },
    ],
    { u: { apodo: "Nuevo apodo" }, v: { apodo: "Sin ficha" } },
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "a");
  assert.equal(result[0].nombre, "Nuevo apodo");
});
test("monthly ideal contains one eligible keeper and four field players at most", () => {
  const ms = [make("1", [k, a], [j, b], ["a", "a"])];
  const result = monthlyTeam([a, b, k, j], ms, "2026-10", true);
  assert.equal(result.selected[0].player.id, "k");
  assert.equal(result.selected.filter((p) => p.player.arquero).length, 1);
  assert.equal(result.selected.find((p) => p.player.id === "k").conceded, 1);
});
test("missing eligible keeper is not replaced with a field player", () => {
  const result = monthlyTeam([a, b], [make("1", [a], [b])], "2026-10", true);
  assert.equal(
    result.selected.some((s) => s.player.arquero),
    false,
  );
});
test("ideal orders field players by wins then goals; winners mode prioritizes appearances", () => {
  const c = { id: "c", nombre: "C" };
  const ms = [make("1", [a, c], [b], ["c"]), make("2", [a], [b], [], 0, 0)];
  assert.equal(
    monthlyTeam([a, b, c], ms, "2026-10", false).selected[0].player.id,
    "a",
  );
  assert.equal(
    monthlyTeam([a, b, c], ms, "2026-10", true).selected[0].player.id,
    "c",
  );
});
test("explicit keeper ID overrides old first-player fallback", () => {
  const m = make("1", [a, k]);
  assert.equal(keeperId(m, "verde"), "k");
  delete m.arqueroVerdeId;
  assert.equal(keeperId(m, "verde"), "a");
});
test("gaceta does not count missed matches as scoring drought", () => {
  const ms = [
    make("1", [a], [b], ["a"]),
    make("2", [k], [b]),
    make("3", [k], [b]),
    make("4", [a], [b]),
  ];
  const stories = generateGaceta(ms, [a, b, k]);
  assert.equal(
    stories.some(
      (s) => s.category === "LA PÓLVORA MOJADA" && s.headline.includes("Ángel"),
    ),
    false,
  );
});
test("gaceta distinguishes three absences from three appearances without scoring", () => {
  const ms = [
    make("1", [a], [b]),
    make("2", [k], [b]),
    make("3", [k], [b]),
    make("4", [k], [b]),
  ];
  const stories = generateGaceta(ms, [a, b, k]);
  assert(
    stories.some(
      (s) => s.category === "LOS DESAPARECIDOS" && s.headline.includes("Ángel"),
    ),
  );
  assert(
    !stories.some(
      (s) => s.category === "LA PÓLVORA MOJADA" && s.headline.includes("Ángel"),
    ),
  );
});
test("gaceta publishes return and end of drought only after three relevant matches", () => {
  const ms = [
    make("1", [a], [b], ["b", "b", "b"]),
    make("2", [a], [b], ["b", "b", "b"]),
    make("3", [a], [b], ["b", "b", "b"]),
    make("4", [a], [b], ["a"]),
  ];
  assert(
    generateGaceta(ms, [a, b]).some(
      (s) =>
        s.category === "SE TERMINÓ LA SEQUÍA" && s.headline.includes("Ángel"),
    ),
  );
  const ret = [
    make("1", [a], [b]),
    make("2", [k], [b]),
    make("3", [k], [b]),
    make("4", [k], [b]),
    make("5", [a], [b]),
  ];
  assert(
    generateGaceta(ret, [a, b, k]).some(
      (s) => s.category === "EL REGRESO" && s.headline.includes("Ángel"),
    ),
  );
});
test("gaceta excludes live games and unassigned goals", () => {
  const live = { ...make("1", [a], [b], ["a"]), estado: "en vivo" };
  assert.deepEqual(generateGaceta([live], [a, b]), []);
  assert(
    !generateGaceta([make("1", [a], [b], [""])], [a, b]).some(
      (s) => s.category === "EL ARTILLERO",
    ),
  );
});
test("monthly prode joins bets by match ID, accumulates 8 max and excludes other months", () => {
  const ms = [make("1"), make("2"), { ...make("3"), fecha: "2026-09-04" }];
  const bets = [
    {
      partidoId: "1",
      usuarioUid: "u",
      ganador: "verde",
      golesVerde: 2,
      golesBlanco: 1,
    },
    {
      partidoId: "2",
      usuarioUid: "u",
      ganador: "verde",
      golesVerde: 3,
      golesBlanco: 1,
    },
    {
      partidoId: "3",
      usuarioUid: "v",
      ganador: "verde",
      golesVerde: 2,
      golesBlanco: 1,
    },
  ];
  assert.deepEqual(monthlyProde(bets, ms, "2026-10"), [["u", 11]]);
});
