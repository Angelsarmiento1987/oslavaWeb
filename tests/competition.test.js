import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tournamentStandings,
  unresolvedTies,
  finalTeams,
  competitionPatch,
  tournamentAwards,
  reportWindow,
  editionWindow,
  openEditions,
  sundayEdition,
  completedMatches,
} from "../src/competition.js";
import {
  drought,
  goalsComplete,
  goalMinutes,
  interviewQuestion,
} from "../src/matchAnalysis.js";
import { newsStories, chronicle, tournamentNews } from "../src/newsDomain.js";
const ps = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  nombre: `Jugador ${i}`,
  usuarioUid: `u${i}`,
}));
const make = (
  i,
  {
    g = 2,
    b = 1,
    events = [
      { jugadorId: "0", minuto: 2 },
      { jugadorId: "1", minuto: 6 },
      { jugadorId: "5", minuto: 9 },
    ],
    green = ps.slice(0, 5),
    white = ps.slice(5, 10),
  } = {},
) => ({
  id: `m${i}`,
  fecha: `2026-10-${String(i + 1).padStart(2, "0")}`,
  hora: "17:00",
  estado: "finalizado",
  verde: green,
  blanco: white,
  golesVerde: g,
  golesBlanco: b,
  eventosGol: events,
  arqueroVerdeId: green[0]?.id,
  arqueroBlancoId: white[0]?.id,
});
const games = Array.from({ length: 10 }, (_, i) => make(i));
const t = {
  edicion: 1,
  estado: "clasificacion",
  partidos: games.map((m) => m.id),
};
test("tournament gives 3 for win, 1 draw, zero for loss/absence, then goals", () => {
  const ms = [
    make(0),
    make(1, { g: 1, b: 1 }),
    make(2, { green: ps.slice(1, 6), white: ps.slice(6, 11) }),
  ];
  const rows = tournamentStandings(
    { ...t, partidos: ms.map((m) => m.id) },
    ms,
    null,
    ps,
  );
  assert.equal(rows.find((p) => p.id === "0").points, 4);
  assert.equal(rows.find((p) => p.id === "0").played, 2);
  assert.equal(rows.find((p) => p.id === "1").points, 7);
});
test("points and goals tied at fifth place block final, explicit complete order resolves", () => {
  const draw = games.map((m) => ({
    ...m,
    golesVerde: 0,
    golesBlanco: 0,
    eventosGol: [],
  }));
  assert.equal(unresolvedTies(t, draw).length, 10);
  assert.equal(competitionPatch("t", t, draw), null);
  const resolved = { ...t, desempate: ps.slice(0, 10).map((p) => p.id) };
  assert.equal(unresolvedTies(resolved, draw).length, 0);
  assert.equal(competitionPatch("t", resolved, draw).estado, "final_pendiente");
});
test("eleventh player tied with tenth also blocks cutoff", () => {
  const ms = [
    make(0, {
      green: ps.slice(0, 6),
      white: ps.slice(6, 11),
      g: 0,
      b: 0,
      events: [],
    }),
  ];
  const rows = unresolvedTies({ ...t, partidos: ["m0"] }, ms);
  assert.equal(rows.length, 11);
});
test("no final after nine rounds or fewer than ten distinct players", () => {
  assert.equal(
    competitionPatch(
      "t",
      { ...t, partidos: games.slice(0, 9).map((m) => m.id) },
      games,
    ),
    null,
  );
  assert.equal(
    competitionPatch(
      "t",
      t,
      games.map((m) => ({
        ...m,
        verde: ps.slice(0, 4),
        blanco: ps.slice(4, 8),
      })),
    ),
    null,
  );
});
test("ten rounds prepare immutable five vs five finalists; absent players do not appear", () => {
  const patch = competitionPatch("t", t, games);
  assert.equal(patch.finalId, "final_t");
  assert.equal(patch.finalVerde.length, 5);
  assert.equal(patch.finalBlanco.length, 5);
  assert.equal(
    new Set([...patch.finalVerde, ...patch.finalBlanco].map((p) => p.id)).size,
    10,
  );
  const fixed = { ...t, ...patch };
  assert.deepEqual(finalTeams(fixed, []), {
    verde: patch.finalVerde,
    blanco: patch.finalBlanco,
  });
  assert.equal(competitionPatch("t", fixed, games), null);
});
test("a tied final never closes or awards cups; a win awards exactly five", () => {
  const teams = finalTeams(t, games),
    draw = {
      ...make(11),
      id: "final_t",
      ...teams,
      golesVerde: 5,
      golesBlanco: 5,
    };
  const final = {
    ...t,
    finalId: "final_t",
    finalVerde: teams.verde,
    finalBlanco: teams.blanco,
    estado: "final_programada",
  };
  assert.equal(competitionPatch("t", final, [...games, draw]), null);
  assert.deepEqual(
    tournamentAwards("0", { torneo_t: final }, [...games, draw]),
    [],
  );
  const win = { ...draw, golesVerde: 6 };
  const patch = competitionPatch("t", final, games, win);
  assert.equal(patch.estado, "cerrado");
  assert.equal(patch.campeones.length, 5);
  const docs = { torneo_t: { ...final, ...patch } };
  assert.equal(tournamentAwards(teams.verde[0].id, docs, []).length, 1);
  assert.equal(tournamentAwards(teams.blanco[0].id, docs, []).length, 0);
});
test("current finalized match merges by ID without duplicating statistics", () =>
  assert.equal(
    completedMatches(games, { ...games[0], golesVerde: 9 }).length,
    10,
  ));
test("report window anchored to Saturday, closes 10:59 Sunday, publishes 11 Argentina", () => {
  const w = reportWindow(
    "2026-10-24",
    "17:00",
    Date.parse("2026-10-24T18:00:00-03:00"),
  );
  assert.equal(w.open, Date.parse("2026-10-24T18:00:00-03:00"));
  assert.equal(w.close, Date.parse("2026-10-25T10:59:00-03:00"));
  assert.equal(w.publish, Date.parse("2026-10-25T11:00:00-03:00"));
});
test("weekday interviews last at most 23h59, Sunday after 11 targets following Sunday", () => {
  const w = reportWindow("2026-10-26", "17:00");
  assert.equal(w.close - w.open, 86340000);
  assert.equal(
    reportWindow("2026-10-25", "17:00").publish,
    Date.parse("2026-11-01T11:00:00-03:00"),
  );
  assert.equal(reportWindow("2026-02-30", "17:00"), null);
  assert.equal(reportWindow("bad", "17:00"), null);
});
test("only participants linked to UID, v2 metadata and finalized match can answer within half-open window", () => {
  const m = make(0),
    w = reportWindow(m.fecha, m.hora),
    meta = {
      partidoId: m.id,
      ventanaVersion: 2,
      estadoPartido: "finalizado",
      participantes: { 0: {} },
      aperturaEn: w.open,
      cierreEn: w.close,
      publicacionEn: w.publish,
    },
    ed = { m0: meta };
  assert.equal(openEditions(ed, ps, "u0", [m], null, w.open).length, 1);
  assert.equal(openEditions(ed, ps, "u0", [m], null, w.close).length, 0);
  assert.equal(openEditions(ed, ps, "u1", [m], null, w.open).length, 0);
  assert.equal(openEditions(ed, ps, "u0", [], null, w.open).length, 0);
  assert.equal(
    openEditions(
      { m0: { ...meta, ventanaVersion: 1 } },
      ps,
      "u0",
      [m],
      null,
      w.open,
    ).length,
    0,
  );
});
test("legacy interview window remains anchored to its match, never install time", () => {
  const m = make(0),
    meta = { partidoId: m.id, fecha: m.fecha, hora: m.hora };
  assert.deepEqual(editionWindow(meta, [m]), reportWindow(m.fecha, m.hora));
});
test("Sunday supplement before and after 11 has correct weekly boundaries", () => {
  const before = sundayEdition(Date.parse("2026-10-25T10:59:59-03:00")),
    after = sundayEdition(Date.parse("2026-10-25T11:00:00-03:00"));
  assert.equal(after.publication - before.publication, 604800000);
  assert.equal(after.next - after.publication, 604800000);
});
test("unknown scoring breaks drought; missed games do not contribute", () => {
  const zero = make(0, {
      events: [{ jugadorId: "5" }, { jugadorId: "5" }, { jugadorId: "5" }],
    }),
    unknown = make(1, { events: [] });
  assert(goalsComplete(zero));
  assert(!goalsComplete(unknown));
  assert.equal(drought([zero, unknown, zero], "0"), 1);
  assert.equal(
    drought([zero, { ...zero, verde: ps.slice(1, 5) }, zero], "0"),
    2,
  );
});
test("goal minute strings distinguish complete, partial, unknown and invalid timelines", () => {
  const m = make(0, {
    events: [
      { jugadorId: "0", minuto: 5 },
      { jugadorId: "0" },
      { jugadorId: "0", minuto: 20.5 },
    ],
  });
  assert.equal(goalMinutes(m, "0"), "Uno de sus goles llegó a los 5′.");
  assert.equal(
    goalMinutes(
      make(0, {
        events: [
          { jugadorId: "0", minuto: 4 },
          { jugadorId: "0", minuto: 8 },
        ],
      }),
      "0",
    ),
    "Convirtió a los 4′ y 8′.",
  );
  assert.equal(
    goalMinutes(make(0, { events: [{ jugadorId: "0", minuto: -1 }] }), "0"),
    "",
  );
});
test("news features keeper and losing top scorer; no false zero-goal story for incomplete records", () => {
  const m = make(0, {
    g: 15,
    b: 14,
    events: Array.from({ length: 8 }, () => ({ jugadorId: "6" })),
  });
  const stories = newsStories([m], ps);
  assert(stories.some((s) => s.playerId === "6" && s.body.includes("derrota")));
  assert(
    stories.some(
      (s) => s.category === "BAJO LOS TRES PALOS" && s.playerId === "0",
    ),
  );
  assert(!stories.some((s) => s.category === "A LA ESPERA DEL GOL"));
  assert(chronicle(m, ps).body.includes("Jugador 6 (8 goles)"));
});
test("keeper interview uses explicit match keeper, incomplete score avoids claiming no goals", () => {
  const m = make(0, { events: [] });
  assert(interviewQuestion(m, ps[0], "verde", [m], ps).includes("arquero"));
  assert(
    interviewQuestion(m, ps[1], "verde", [m], ps).includes(
      "El registro no tiene goles asignados",
    ),
  );
});
test("Sunday tournament articles never expose results played after publication", () => {
  const docs = { torneos_indice: { activo: "torneo_1" }, torneo_1: { ...t } };
  assert.equal(
    tournamentNews(
      docs,
      games,
      null,
      ps,
      Date.parse("2026-09-01T11:00:00-03:00"),
    ).length,
    0,
  );
  assert(tournamentNews(docs, games, null, ps).length > 0);
});
