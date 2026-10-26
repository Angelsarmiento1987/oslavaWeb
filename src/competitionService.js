import {
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";
import {
  completedMatches,
  competitionPatch,
  rounds,
  reportWindow,
  finalTeams,
} from "./competition.js";
import { team } from "./domain.js";
const ref = (...parts) => doc(db, ...parts);
export async function startTournament() {
  const id = `torneo_${crypto.randomUUID()}`;
  await runTransaction(db, async (tx) => {
    const indexRef = ref("configuracion", "torneos_indice"),
      idx = await tx.get(indexRef),
      old = idx.data()?.activo,
      previous = old ? await tx.get(ref("configuracion", old)) : null;
    if (previous?.exists() && previous.data().estado !== "cerrado")
      throw Error("Primero debe finalizar el campeonato actual.");
    const edicion = (idx.data()?.edicion || 0) + 1;
    tx.set(ref("configuracion", id), {
      edicion,
      estado: "clasificacion",
      partidos: [],
      creadoEn: serverTimestamp(),
    });
    tx.set(indexRef, { activo: id, edicion });
  });
}
export async function syncTournament(docs, history, current) {
  const id = docs.torneos_indice?.activo;
  if (!id || !docs[id]) return;
  await runTransaction(db, async (tx) => {
    const idx = await tx.get(ref("configuracion", "torneos_indice"));
    if (idx.data()?.activo !== id) return;
    const tr = ref("configuracion", id),
      snap = await tx.get(tr);
    if (!snap.exists()) return;
    const t = snap.data(),
      live = await tx.get(ref("partidos", "proximo"));
    let all = completedMatches(history, live.data());
    const ids = [
      ...new Set([...(t.partidos || []), ...(t.finalId ? [t.finalId] : [])]),
    ];
    const actual = await Promise.all(
      ids.map((k) => tx.get(ref("historial", k))),
    );
    const byId = new Map(all.map((m) => [m.id, m]));
    actual.forEach((s, i) => {
      if (s.exists()) byId.set(ids[i], { ...s.data(), id: ids[i] });
      else if (
        live.data()?.id !== ids[i] ||
        live.data()?.estado !== "finalizado"
      )
        byId.delete(ids[i]);
    });
    all = [...byId.values()];
    if (
      t.edicion === 1 &&
      !t.historialInicialImportado &&
      !t.finalId &&
      t.estado !== "cerrado"
    ) {
      const elsewhere = new Set(
        Object.entries(docs)
          .filter(([key]) => key.startsWith("torneo_") && key !== id)
          .flatMap(([, d]) => d.partidos || []),
      );
      const additions = all
        .filter(
          (m) =>
            !elsewhere.has(m.id) &&
            m.fecha >= "2026-10-24" &&
            m.fecha <= "2026-10-26" &&
            m.tipoPartido !== "final" &&
            typeof m.golesVerde === "number" &&
            typeof m.golesBlanco === "number" &&
            team(m.verde).length &&
            team(m.blanco).length &&
            !(t.partidos || []).includes(m.id),
        )
        .sort(
          (a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id),
        )
        .slice(0, Math.max(0, 10 - (t.partidos || []).length));
      if (additions.length) {
        const next = [
          ...new Set([...(t.partidos || []), ...additions.map((m) => m.id)]),
        ]
          .sort((a, b) =>
            (byId.get(a)?.fecha || "9999").localeCompare(
              byId.get(b)?.fecha || "9999",
            ),
          )
          .slice(0, 10);
        tx.update(tr, { partidos: next, historialInicialImportado: true });
        return;
      }
    }
    const patch = competitionPatch(id, t, all, live.data());
    if (patch)
      tx.update(tr, {
        ...patch,
        ...(patch.estado === "cerrado" ? { cerradoEn: serverTimestamp() } : {}),
      });
  });
}
export async function saveTie(id, playerId) {
  await runTransaction(db, async (tx) => {
    const tr = ref("configuracion", id),
      s = await tx.get(tr);
    if (s.data()?.finalId) throw Error("La final ya está preparada.");
    tx.update(tr, {
      desempate: [
        ...(s.data()?.desempate || []).filter((x) => x !== playerId),
        playerId,
      ],
    });
  });
}
export async function publishMatch(data, expectedId) {
  await runTransaction(db, async (tx) => {
    const mr = ref("partidos", "proximo"),
      idx = await tx.get(ref("configuracion", "torneos_indice")),
      snap = await tx.get(mr),
      current = snap.data(),
      id = idx.data()?.activo,
      tr = id ? ref("configuracion", id) : null,
      ts = tr ? await tx.get(tr) : null,
      t = ts?.data() || {};
    if (current?.id !== expectedId)
      throw Error("El partido cambió. Volvé a abrir el editor.");
    if (current && current.estado !== "finalizado" && current.id !== data.id)
      throw Error("Hay otro partido pendiente.");
    if (
      current?.id === data.id &&
      ["en vivo", "finalizado"].includes(current.estado)
    )
      throw Error("El partido ya empezó o terminó. No se puede reiniciar.");
    let payload = data;
    if (id) {
      if (t.estado === "cerrado")
        throw Error("Iniciá el siguiente campeonato desde Torneo.");
      const finalMode = !!t.finalId;
      if (finalMode) {
        if (t.finalId !== data.id)
          throw Error("La final cambió. Reabrí el editor.");
        const equal = (a, b) =>
          JSON.stringify(
            team(a)
              .map((p) => p.id)
              .sort(),
          ) ===
          JSON.stringify(
            team(b)
              .map((p) => p.id)
              .sort(),
          );
        if (
          !equal(data.verde, t.finalVerde) ||
          !equal(data.blanco, t.finalBlanco)
        )
          throw Error("Los equipos deben coincidir con los diez clasificados.");
        payload = { ...data, torneoId: id, tipoPartido: "final" };
        tx.update(tr, {
          estado: "final_programada",
          fechaFinal: `${data.fecha} · ${data.hora}`,
        });
      } else {
        const ids = t.partidos || [];
        if (ids.length >= 10 && !ids.includes(data.id))
          throw Error("Las diez fechas están completas.");
        const other = ids.filter((k) => k !== data.id);
        const results = await Promise.all(
          other.map((k) => tx.get(ref("historial", k))),
        );
        if (
          results.some(
            (s) =>
              !s.exists() ||
              (s.data().estado && s.data().estado !== "finalizado"),
          )
        )
          throw Error("Hay una fecha sin finalizar.");
        const next = ids.includes(data.id) ? ids : [...ids, data.id];
        payload = {
          ...data,
          torneoId: id,
          tipoPartido: "clasificacion",
          fechaTorneo: next.indexOf(data.id) + 1,
        };
        tx.update(tr, { partidos: next });
      }
    }
    tx.set(mr, payload);
  });
}
export async function deleteMatch(expectedId) {
  await runTransaction(db, async (tx) => {
    const mr = ref("partidos", "proximo"),
      current = await tx.get(mr),
      idx = await tx.get(ref("configuracion", "torneos_indice")),
      id = idx.data()?.activo,
      tr = id ? ref("configuracion", id) : null,
      t = tr ? (await tx.get(tr)).data() : null,
      m = current.data();
    if (!m || m.id !== expectedId) throw Error("El partido cambió.");
    if (m.estado !== "programado")
      throw Error("Solo se puede eliminar un partido programado.");
    if (m.id === t?.finalId)
      throw Error("La final debe conservar sus clasificados.");
    if (t?.partidos?.includes(m.id))
      tx.update(tr, { partidos: t.partidos.filter((k) => k !== m.id) });
    tx.delete(mr);
  });
}
export async function prepareInterviews(
  editions,
  history,
  current,
  players,
  question,
) {
  const matches = completedMatches(history, current),
    newest = matches.at(-1);
  const m = [...matches]
    .reverse()
    .find(
      (m) =>
        (editions[m.id] && editions[m.id].ventanaVersion !== 2) ||
        (m.id === newest?.id && !editions[m.id]),
    );
  if (!m?.id || m.id.includes("/")) return;
  const w = reportWindow(m.fecha, m.hora || "17:00", m.finalizadoEn);
  if (!w) return;
  const participantes = {};
  for (const t of ["verde", "blanco"])
    for (const p of team(m[t]))
      participantes[p.id] = {
        nombre: players.find((x) => x.id === p.id)?.nombre || p.nombre,
        equipo: t,
        preguntaResultado: `El partido terminó Verde ${m.golesVerde}–${m.golesBlanco} Blanco. ¿Qué opinión te dejó el resultado?`,
        preguntaEstadistica: question(m, p, t, matches, players),
      };
  if (!Object.keys(participantes).length) return;
  const data = {
    partidoId: m.id,
    fecha: m.fecha,
    hora: m.hora || "17:00",
    participantes,
    estadoPartido: "finalizado",
    ventanaVersion: 2,
    aperturaEn: Timestamp.fromMillis(w.open),
    finPartidoEn: Timestamp.fromMillis(w.open),
    cierreEn: Timestamp.fromMillis(w.close),
    publicacionEn: Timestamp.fromMillis(w.publish),
    creadoEn: serverTimestamp(),
  };
  await runTransaction(db, async (tx) => {
    const r = ref("configuracion", `reportaje_${m.id}`),
      s = await tx.get(r);
    if (!s.exists()) tx.set(r, data);
    else if ((s.data().ventanaVersion || 0) < 2) {
      const { participantes, creadoEn, ...migration } = data;
      tx.update(r, migration);
    }
  });
}
