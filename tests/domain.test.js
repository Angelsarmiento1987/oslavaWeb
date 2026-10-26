import { test } from "node:test";
import assert from "node:assert/strict";
import {
  available,
  stats,
  formation,
  awards,
  predictionPoints,
  scorers,
} from "../src/domain.js";
const players = [
  { id: "a", nombre: "A", usuarioUid: "u" },
  { id: "b", nombre: "B" },
];
const match = {
  fecha: "2026-09-04",
  verde: [players[0]],
  blanco: [players[1]],
  golesVerde: 2,
  golesBlanco: 1,
  eventosGol: [{ jugadorId: "a" }, { jugadorId: "a" }, { jugadorId: "b" }],
};
test("Google UID remains linked to existing Android player ID", () => {
  const a = available(players, { u: { apodo: "A" }, v: { apodo: "C" } });
  assert.equal(a.length, 2);
  assert.equal(a.find((x) => x.usuarioUid === "u").id, "a");
  assert.equal(
    a.find((x) => x.usuarioUid === "v"),
    undefined,
  );
});
test("statistics derive wins and assigned goals, not UID", () =>
  assert.deepEqual(stats(players[0], [match]), {
    played: 1,
    won: 1,
    tied: 0,
    lost: 0,
    goals: 2,
  }));
test("tied top scorers share award; anonymous goals do not count", () =>
  assert.deepEqual(
    scorers({
      ...match,
      eventosGol: [{ jugadorId: "a" }, { jugadorId: "b" }, { jugadorId: "" }],
    }),
    ["a", "b"],
  ));
test("closed month prize and evidence match Android; current month excluded", () => {
  const a = awards("a", players, [match], new Date("2026-10-21T12:00:00Z"));
  assert.equal(a[0].evidence.length, 1);
  assert.equal(a[1].evidence.length, 1);
  assert.equal(a[2].evidence.length, 1);
  assert.equal(a[3].evidence.length, 0);
  assert.equal(
    awards(
      "a",
      players,
      [{ ...match, fecha: "2026-10-04" }],
      new Date("2026-10-21T12:00:00Z"),
    )[2].evidence.length,
    0,
  );
});
test("January uses December of previous year", () =>
  assert.equal(
    awards(
      "a",
      players,
      [{ ...match, fecha: "2025-12-04" }],
      new Date("2026-01-21T12:00:00Z"),
    )[2].evidence.length,
    1,
  ));
test("formations position first player as keeper, without mutating input", () => {
  assert.equal(formation(players, true)[0].y, 0.085);
  assert.equal(formation(players, false)[0].y, 0.915);
  assert.equal(players[0].x, undefined);
});
test("prode adds 3 winner + 5 exact score, without scorer bonus", () =>
  assert.equal(
    predictionPoints(
      { ganador: "verde", golesVerde: 2, golesBlanco: 1, goleadorId: "a" },
      match,
    ),
    8,
  ));
