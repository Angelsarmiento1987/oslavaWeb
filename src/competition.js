import { team, events, winners, formation } from "./domain.js";
export const millis = (value) =>
  typeof value === "number"
    ? value
    : (value?.toMillis?.() ??
      (value?.seconds
        ? value.seconds * 1000 + (value.nanoseconds || 0) / 1e6
        : NaN));
export const completedMatches = (history, current) => {
  const map = new Map(history.map((m) => [m.id, m]));
  if (current?.estado === "finalizado" && current.id)
    map.set(current.id, current);
  return [...map.values()]
    .filter((m) => m.fecha && (!m.estado || m.estado === "finalizado"))
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        (a.hora || "").localeCompare(b.hora || ""),
    );
};
export const rounds = (t, history, current) => {
  const byId = new Map(
    completedMatches(history, current).map((m) => [m.id, m]),
  );
  return (t?.partidos || []).map((id) => byId.get(id)).filter(Boolean);
};
export function tournamentStandings(t, history, current, players = []) {
  const matches = rounds(t, history, current),
    members = new Map(
      matches
        .flatMap((m) => [...team(m.verde), ...team(m.blanco)])
        .map((p) => [p.id, p]),
    );
  const order = t?.desempate || [];
  return [...members.values()]
    .map((p) => {
      const played = matches.filter((m) =>
          [...team(m.verde), ...team(m.blanco)].some((x) => x.id === p.id),
        ),
        won = played.filter((m) => winners(m).includes(p.id)).length,
        drawn = played.filter(
          (m) => (m.golesVerde || 0) === (m.golesBlanco || 0),
        ).length;
      return {
        id: p.id,
        nombre: players.find((x) => x.id === p.id)?.nombre || p.nombre,
        played: played.length,
        won,
        drawn,
        lost: played.length - won - drawn,
        goals: played.reduce(
          (n, m) => n + events(m).filter((e) => e.jugadorId === p.id).length,
          0,
        ),
        points: won * 3 + drawn,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goals - a.goals ||
        (order.includes(a.id) ? order.indexOf(a.id) : Infinity) -
          (order.includes(b.id) ? order.indexOf(b.id) : Infinity) ||
        a.id.localeCompare(b.id),
    );
}
export function unresolvedTies(t, history, current) {
  const rows = tournamentStandings(t, history, current),
    ties = new Map();
  for (const cut of [5, 10]) {
    if (rows.length <= cut) continue;
    const a = rows[cut - 1],
      b = rows[cut];
    if (a.points === b.points && a.goals === b.goals) {
      const group = rows.filter(
        (p) => p.points === a.points && p.goals === a.goals,
      );
      if (!group.every((p) => (t.desempate || []).includes(p.id)))
        group.forEach((p) => ties.set(p.id, p));
    }
  }
  return [...ties.values()];
}
export function finalTeams(t, history, current) {
  if (Array.isArray(t?.finalVerde))
    return { verde: team(t.finalVerde), blanco: team(t.finalBlanco) };
  const byId = new Map(
    rounds(t, history, current)
      .flatMap((m) => [...team(m.verde), ...team(m.blanco)])
      .map((p) => [p.id, p]),
  );
  const rows = tournamentStandings(t, history, current).slice(0, 10);
  return {
    verde: formation(
      rows.slice(0, 5).map((p) => byId.get(p.id)),
      true,
    ),
    blanco: formation(
      rows.slice(5).map((p) => byId.get(p.id)),
      false,
    ),
  };
}
export const finalResult = (t, history, current) =>
  t?.resultadoFinal ||
  completedMatches(history, current).find((m) => m.id === t?.finalId);
export function competitionPatch(id, t, history, current) {
  const result = finalResult(t, history, current);
  if (result && t.estado !== "cerrado" && winners(result).length === 5)
    return {
      estado: "cerrado",
      resultadoFinal: result,
      campeones: winners(result),
    };
  if (
    rounds(t, history, current).length === 10 &&
    !t.finalId &&
    tournamentStandings(t, history, current).length >= 10 &&
    !unresolvedTies(t, history, current).length
  ) {
    const f = finalTeams(t, history, current);
    return {
      finalId: `final_${id}`,
      finalVerde: f.verde,
      finalBlanco: f.blanco,
      estado: "final_pendiente",
    };
  }
  return null;
}
export function tournamentAwards(playerId, docs, history, current) {
  return Object.entries(docs)
    .filter(([id]) => id.startsWith("torneo_"))
    .map(([, t]) => t)
    .filter((t) => {
      const r = finalResult(t, history, current);
      return (
        playerId &&
        r &&
        winners(r).length === 5 &&
        winners(r).includes(playerId)
      );
    })
    .map(
      (t) =>
        `Campeonato ${t.edicion} · ${finalResult(t, history, current)?.fecha || ""}`,
    );
}
export function reportWindow(day, hour = "17:00", finishedAt) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(hour)
  )
    return null;
  const start = new Date(`${day}T${hour}:00-03:00`).getTime();
  if (
    !Number.isFinite(start) ||
    new Date(start - 3 * 3600000).toISOString().slice(0, 10) !== day
  )
    return null;
  const d = new Date(`${day}T11:00:00-03:00`);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  d.setUTCDate(d.getUTCDate() + ((7 - weekday) % 7));
  if (d.getTime() <= start) d.setUTCDate(d.getUTCDate() + 7);
  const fin = millis(finishedAt),
    open = Number.isFinite(fin) && fin >= start ? fin : start,
    publish = d.getTime(),
    close = Math.min(publish - 60000, open + 86340000);
  return { open, close, publish };
}
export function editionWindow(meta, history = [], current = null) {
  if (meta.ventanaVersion === 2)
    return {
      open: millis(meta.aperturaEn),
      close: millis(meta.cierreEn),
      publish: millis(meta.publicacionEn),
    };
  const match = completedMatches(history, current).find(
    (m) => m.id === meta.partidoId,
  );
  return reportWindow(
    match?.fecha || meta.fecha,
    match?.hora || meta.hora || "17:00",
    match?.finalizadoEn || meta.finPartidoEn,
  );
}
export const reportPlayer = (meta, roster, uid) =>
  roster.find((p) => p.usuarioUid === uid && meta.participantes?.[p.id])?.id;
export function openEditions(
  editions,
  roster,
  uid,
  history,
  current,
  now = Date.now(),
) {
  const ids = new Set(completedMatches(history, current).map((m) => m.id));
  return Object.entries(editions)
    .filter(([id, m]) => {
      const w = editionWindow(m);
      return (
        m.ventanaVersion === 2 &&
        m.estadoPartido === "finalizado" &&
        ids.has(id) &&
        reportPlayer(m, roster, uid) &&
        now >= w.open &&
        now < w.close
      );
    })
    .map(([id, m]) => ({ id, ...m }));
}
export function sundayEdition(now = Date.now()) {
  const local = new Date(now - 3 * 3600000);
  const date = local.toISOString().slice(0, 10),
    d = new Date(`${date}T11:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() - local.getUTCDay());
  if (d.getTime() > now) d.setUTCDate(d.getUTCDate() - 7);
  return {
    publication: d.getTime(),
    previous: d.getTime() - 604800000,
    next: d.getTime() + 604800000,
  };
}
