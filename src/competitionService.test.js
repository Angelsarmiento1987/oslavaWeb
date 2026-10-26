import {
  publishMatch,
  deleteMatch,
  syncTournament,
} from "./competitionService.js";
import { doc, runTransaction } from "firebase/firestore";
jest.mock("./firebase.js", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: () => ({ server: true }),
  Timestamp: { fromMillis: (n) => n },
}));
let records, writes;
const snapshot = (value) => ({
  exists: () => value !== undefined,
  data: () => value,
});
beforeEach(() => {
  records = new Map();
  writes = [];
  doc.mockImplementation((db, ...parts) => ({ path: parts.join("/") }));
  runTransaction.mockImplementation(async (db, fn) => {
    const staged = [];
    const tx = {
      get: async (r) => {
        if (staged.length) throw Error("Read after write in transaction");
        return snapshot(records.get(r.path));
      },
      set: (r, d) => staged.push(["set", r.path, d]),
      update: (r, d) => staged.push(["update", r.path, d]),
      delete: (r) => staged.push(["delete", r.path]),
    };
    await fn(tx);
    writes.push(...staged);
    for (const [op, path, d] of staged) {
      if (op === "delete") records.delete(path);
      else
        records.set(path, op === "update" ? { ...records.get(path), ...d } : d);
    }
  });
});
const ps = Array.from({ length: 10 }, (_, i) => ({
  id: String(i),
  nombre: String(i),
}));
const match = {
  id: "m1",
  fecha: "2026-10-31",
  hora: "17:00",
  verde: ps.slice(0, 5),
  blanco: ps.slice(5),
  estado: "programado",
  golesVerde: 0,
  golesBlanco: 0,
  eventosGol: [],
};
function active(t = {}) {
  records.set("configuracion/torneos_indice", { activo: "torneo_1" });
  records.set("configuracion/torneo_1", {
    edicion: 1,
    estado: "clasificacion",
    partidos: [],
    ...t,
  });
}
test("publishing a round atomically reserves one slot and annotates tablero payload", async () => {
  active();
  await publishMatch(match);
  expect(records.get("configuracion/torneo_1").partidos).toEqual(["m1"]);
  expect(records.get("partidos/proximo")).toEqual({
    ...match,
    torneoId: "torneo_1",
    tipoPartido: "clasificacion",
    fechaTorneo: 1,
  });
  expect(writes).toHaveLength(2);
});
test("publishing cannot reset a running or completed match", async () => {
  active();
  records.set("partidos/proximo", {
    ...match,
    estado: "en vivo",
    golesVerde: 8,
  });
  await expect(publishMatch(match, "m1")).rejects.toThrow(
    "No se puede reiniciar",
  );
  expect(writes).toHaveLength(0);
  expect(records.get("partidos/proximo").golesVerde).toBe(8);
});
test("publishing cannot displace an unfinished round", async () => {
  active({ partidos: ["previous"] });
  await expect(publishMatch(match)).rejects.toThrow("sin finalizar");
  expect(writes).toHaveLength(0);
});
test("closed tournament and full ten-round tournament cannot accept a new round", async () => {
  active({ estado: "cerrado" });
  await expect(publishMatch(match)).rejects.toThrow("siguiente campeonato");
  active({ partidos: Array.from({ length: 10 }, (_, i) => "old" + i) });
  await expect(publishMatch(match)).rejects.toThrow("diez fechas");
  expect(writes).toHaveLength(0);
});
test("final teams locked by IDs; reordering allowed but substituting player rejected", async () => {
  active({
    finalId: "final_1",
    finalVerde: ps.slice(0, 5),
    finalBlanco: ps.slice(5),
    estado: "final_pendiente",
  });
  const final = {
    ...match,
    id: "final_1",
    verde: [{ id: "intruso" }, ...ps.slice(1, 5)],
  };
  await expect(publishMatch(final)).rejects.toThrow("diez clasificados");
  expect(writes).toHaveLength(0);
  await publishMatch({
    ...match,
    id: "final_1",
    verde: [...match.verde].reverse(),
  });
  expect(records.get("partidos/proximo").tipoPartido).toBe("final");
  expect(records.get("configuracion/torneo_1").estado).toBe("final_programada");
});
test("deleting scheduled round frees its slot and preserves historical results", async () => {
  active({ partidos: ["old", "m1"] });
  records.set("partidos/proximo", match);
  records.set("historial/old", { id: "old", golesVerde: 15 });
  await deleteMatch("m1");
  expect(records.has("partidos/proximo")).toBe(false);
  expect(records.get("configuracion/torneo_1").partidos).toEqual(["old"]);
  expect(records.get("historial/old").golesVerde).toBe(15);
});
test("live match and prepared final cannot be deleted", async () => {
  active();
  records.set("partidos/proximo", { ...match, estado: "en vivo" });
  await expect(deleteMatch("m1")).rejects.toThrow("programado");
  active({ finalId: "m1" });
  records.set("partidos/proximo", match);
  await expect(deleteMatch("m1")).rejects.toThrow("clasificados");
  expect(writes).toHaveLength(0);
});
test("one-time historical import excludes matches assigned to another tournament", async () => {
  const t = { edicion: 1, estado: "clasificacion", partidos: [] };
  active(t);
  const m = {
      ...match,
      fecha: "2026-10-24",
      estado: "finalizado",
      golesVerde: 15,
      golesBlanco: 14,
    },
    other = { ...m, id: "used" };
  const docs = {
    torneos_indice: { activo: "torneo_1" },
    torneo_1: t,
    torneo_old: { partidos: ["used"] },
  };
  await syncTournament(docs, [m, other]);
  expect(records.get("configuracion/torneo_1").partidos).toEqual(["m1"]);
  expect(records.get("configuracion/torneo_1").historialInicialImportado).toBe(
    true,
  );
});
