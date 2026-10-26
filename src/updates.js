import { drought as safeDrought, goalsComplete } from "./matchAnalysis.js";
import { team, events, stats, winner } from "./domain.js";
export function monthKey(offset = 0, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year").value),
    month = Number(parts.find((p) => p.type === "month").value);
  const d = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export const monthTitle = (key) =>
  new Intl.DateTimeFormat("es-AR", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${key}-01T12:00:00Z`));
export const keeperId = (m, t) =>
  m[t === "verde" ? "arqueroVerdeId" : "arqueroBlancoId"] ||
  team(m[t])[0]?.id ||
  "";
export function monthlyTeam(players, history, key, ideal = false) {
  const matches = history.filter((m) => m.fecha?.startsWith(`${key}-`));
  const standings = players
    .map((player) => {
      const s = stats(player, matches);
      const kept = matches.filter((m) =>
        ["verde", "blanco"].some((t) => keeperId(m, t) === player.id),
      );
      const conceded = kept.reduce(
        (n, m) =>
          n +
          (keeperId(m, "verde") === player.id
            ? m.golesBlanco || 0
            : m.golesVerde || 0),
        0,
      );
      const cleanSheets = kept.filter(
        (m) =>
          (keeperId(m, "verde") === player.id
            ? m.golesBlanco || 0
            : m.golesVerde || 0) === 0,
      ).length;
      return { player, ...s, conceded, cleanSheets };
    })
    .filter((s) => s.played > 0);
  const name = (a, b) => a.player.nombre.localeCompare(b.player.nombre, "es");
  const ranked = [...standings].sort(
    (a, b) =>
      b.won - a.won ||
      (ideal
        ? b.goals - a.goals || b.played - a.played
        : b.played - a.played || b.goals - a.goals) ||
      name(a, b),
  );
  const keepers = standings
    .filter((s) => s.player.arquero)
    .sort(
      (a, b) =>
        b.won - a.won ||
        a.conceded / a.played - b.conceded / b.played ||
        b.cleanSheets - a.cleanSheets ||
        name(a, b),
    );
  return {
    matches,
    standings: ranked,
    selected: ideal
      ? [
          ...keepers.slice(0, 1),
          ...ranked.filter((s) => !s.player.arquero).slice(0, 4),
        ]
      : ranked.slice(0, 5),
  };
}
export const prodePoints = (p, m) =>
  (p.ganador === winner(m) ? 3 : 0) +
  (p.golesVerde === m.golesVerde && p.golesBlanco === m.golesBlanco ? 5 : 0);
export function monthlyProde(predictions, history, key) {
  const results = new Map(
    history.filter((m) => m.fecha?.startsWith(`${key}-`)).map((m) => [m.id, m]),
  );
  const scores = {};
  for (const p of predictions) {
    const m = results.get(p.partidoId);
    if (m && p.usuarioUid)
      scores[p.usuarioUid] = (scores[p.usuarioUid] || 0) + prodePoints(p, m);
  }
  return Object.entries(scores).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
}
export function generateGaceta(history, players) {
  const sorted = history
    .filter((m) => m.fecha && (!m.estado || m.estado === "finalizado"))
    .slice()
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        (a.hora || "17:00").localeCompare(b.hora || "17:00"),
    );
  if (!sorted.length) return [];
  const latest = sorted.at(-1).fecha,
    stories = [],
    names = new Map(players.map((p) => [p.id, p.nombre]));
  const name = (id) => names.get(id) || "Un jugador";
  const people = sorted.map(
    (m) =>
      new Set(
        [...team(m.verde), ...team(m.blanco)].map((p) => p.id).filter(Boolean),
      ),
  );
  const goals = sorted.map((m) =>
    events(m).reduce((g, e) => {
      if (e.jugadorId) g[e.jugadorId] = (g[e.jugadorId] || 0) + 1;
      return g;
    }, {}),
  );
  const add = (category, headline, body, weight, image) =>
    stories.push({ category, headline, body, weight, image, date: latest });
  const totals = {};
  goals.forEach((g) =>
    Object.entries(g).forEach(
      ([id, n]) => (totals[id] = (totals[id] || 0) + n),
    ),
  );
  const max = Math.max(0, ...Object.values(totals));
  if (max) {
    const ids = Object.keys(totals).filter((id) => totals[id] === max),
      who = ids.map(name).join(" y ");
    add(
      "EL ARTILLERO",
      ids.length > 1
        ? "¡La cima de los goleadores está compartida!"
        : `¡${who} manda en la tabla de goleadores!`,
      `${who} ${ids.length > 1 ? "acumulan" : "acumula"} ${max} goles en ${sorted.length} partidos registrados. La pelea por el gol sigue abierta.`,
      90,
      "artillero",
    );
  }
  const playedIds = new Set(people.flatMap((p) => [...p]));
  for (const id of playedIds) {
    const appearances = people.flatMap((p, i) => (p.has(id) ? [i] : [])),
      lastGoal = appearances.findLastIndex((i) => (goals[i][id] || 0) > 0),
      drought = safeDrought(sorted, id),
      present = people.at(-1).has(id);
    if (present && appearances.length >= 3 && drought >= 3)
      add(
        "LA PÓLVORA MOJADA",
        `¿Dónde quedó el olfato goleador de ${name(id)}?`,
        `Lleva ${drought} partidos jugados consecutivos sin convertir. Las fechas en las que no participó no cuentan para esta racha.`,
        62 + Math.min(drought, 12),
        "sequia",
      );
    if (
      present &&
      appearances.length >= 4 &&
      lastGoal === appearances.length - 1
    ) {
      let before = 0;
      for (let i = appearances.length - 2; i >= 0; i--) {
        if (goals[appearances[i]][id] || !goalsComplete(sorted[appearances[i]]))
          break;
        before++;
      }
      if (before >= 3)
        add(
          "SE TERMINÓ LA SEQUÍA",
          `¡${name(id)} volvió a gritar un gol!`,
          `Después de ${before} partidos jugados sin convertir, volvió a marcar.`,
          96,
          "regreso",
        );
    }
    const last = people.findLastIndex((p) => p.has(id)),
      absent = sorted.length - 1 - last;
    if (absent >= 3)
      add(
        "LOS DESAPARECIDOS",
        `¿Dónde anda ${name(id)}?`,
        `Hace ${absent} partidos que no aparece en las formaciones. Su racha goleadora no cambia mientras no juegue.`,
        56 + Math.min(absent, 10),
        "ausencias",
      );
    if (present && sorted.length >= 4) {
      const prev = people.slice(0, -1).findLastIndex((p) => p.has(id)),
        missed = sorted.length - 2 - prev;
      if (prev >= 0 && missed >= 3)
        add(
          "EL REGRESO",
          `¡Volvió ${name(id)}!`,
          `Regresó a la cancha después de faltar a ${missed} partidos consecutivos.`,
          92,
          "regreso",
        );
    }
  }
  const wins = { verde: 0, blanco: 0 };
  sorted.forEach((m) => {
    if (winner(m) !== "empate") wins[winner(m)]++;
  });
  if (sorted.length >= 2)
    add(
      "DUELO DE COLORES",
      wins.verde > wins.blanco
        ? "¡El Verde domina el historial!"
        : wins.blanco > wins.verde
          ? "¡El Blanco manda en Oslava!"
          : "Verde y Blanco, ¡mano a mano!",
      `Victorias registradas: Verde ${wins.verde}, Blanco ${wins.blanco}. Empates: ${sorted.length - wins.verde - wins.blanco}.`,
      72,
      "duelo",
    );
  const pairs = new Map();
  sorted.forEach((m) =>
    ["verde", "blanco"].forEach((t) => {
      const ids = [
        ...new Set(
          team(m[t])
            .map((p) => p.id)
            .filter(Boolean),
        ),
      ].sort();
      ids.forEach((a, i) =>
        ids.slice(i + 1).forEach((b) => {
          const key = JSON.stringify([a, b]),
            old = pairs.get(key) || { ids: [a, b], played: 0, won: 0 };
          old.played++;
          if (winner(m) === t) old.won++;
          pairs.set(key, old);
        }),
      );
    }),
  );
  const pair = [...pairs.values()]
    .filter((p) => p.played >= 3)
    .sort((a, b) => b.played - a.played || b.won - a.won)[0];
  if (pair)
    add(
      "LA SOCIEDAD",
      `${name(pair.ids[0])} y ${name(pair.ids[1])}, compañeros de batalla`,
      `Compartieron equipo ${pair.played} veces y ganaron ${pair.won} de esos encuentros.`,
      58,
      "sociedad",
    );
  return stories.sort(
    (a, b) => b.weight - a.weight || a.headline.localeCompare(b.headline, "es"),
  );
}
