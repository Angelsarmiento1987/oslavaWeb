export const team = (m) =>
  Array.isArray(m) ? m.filter((p) => p && typeof p.id === "string") : [];
export const events = (m) => (Array.isArray(m?.eventosGol) ? m.eventosGol : []);
export const winner = (m) =>
  (m.golesVerde || 0) > (m.golesBlanco || 0)
    ? "verde"
    : (m.golesBlanco || 0) > (m.golesVerde || 0)
      ? "blanco"
      : "empate";
export const winners = (m) =>
  winner(m) === "empate" ? [] : team(m[winner(m)]).map((p) => p.id);
export function scorers(m) {
  const counts = {};
  events(m).forEach((e) => {
    if (e.jugadorId) counts[e.jugadorId] = (counts[e.jugadorId] || 0) + 1;
  });
  const max = Math.max(0, ...Object.values(counts));
  return Object.keys(counts).filter((k) => counts[k] === max);
}
export function available(roster, profiles) {
  const linked = new Set();
  return [...roster]
    .sort(
      (a, b) =>
        Number(a.id.startsWith("user_")) - Number(b.id.startsWith("user_")) ||
        a.id.localeCompare(b.id),
    )
    .filter((p) => {
      if (!p.usuarioUid) return true;
      if (linked.has(p.usuarioUid)) return false;
      linked.add(p.usuarioUid);
      return true;
    })
    .map((p) => ({
      ...p,
      nombre: profiles[p.usuarioUid]?.apodo?.trim() || p.nombre,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
export function formation(players, green) {
  const n = players.length - 1,
    d = n <= 2 ? n : Math.ceil(n / 2),
    a = n - d;
  const x = (i, c) => (c <= 1 ? 0.5 : 0.18 + (0.64 * i) / (c - 1));
  return players.map((p, i) => ({
    ...p,
    x: i === 0 ? 0.5 : i <= d ? x(i - 1, d) : x(i - d - 1, a),
    y:
      i === 0
        ? green
          ? 0.085
          : 0.915
        : i <= d
          ? green
            ? 0.265
            : 0.735
          : green
            ? 0.405
            : 0.595,
  }));
}
export function stats(p, matches) {
  let played = 0,
    won = 0,
    tied = 0,
    goals = 0;
  matches.forEach((m) => {
    if ([...team(m.verde), ...team(m.blanco)].some((x) => x.id === p.id)) {
      played++;
      if (winner(m) === "empate") tied++;
      else if (winners(m).includes(p.id)) won++;
    }
    goals += events(m).filter((e) => e.jugadorId === p.id).length;
  });
  return { played, won, tied, lost: played - won - tied, goals };
}
export const label = (m) =>
  `${m.fecha || ""} · Verde ${m.golesVerde || 0} - ${m.golesBlanco || 0} Blanco`;
export function awards(id, players, matches, now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, mo] = date.split("-").map(Number);
  const py = mo === 1 ? y - 1 : y,
    pm = mo === 1 ? 12 : mo - 1,
    sy = mo <= 6 ? y - 1 : y;
  const v = matches.filter((m) => id && winners(m).includes(id)),
    s = matches.filter((m) => id && scorers(m).includes(id));
  const period = (name, image, description, ms, periodLabel) => {
    const count = (pid) => ms.filter((m) => winners(m).includes(pid)).length;
    const n = count(id);
    const ok =
      id && n > 0 && n === Math.max(0, ...players.map((p) => count(p.id)));
    return {
      name,
      image,
      description,
      evidence: ok
        ? [`${periodLabel}: ${n} victorias, máximo del plantel en el período`]
        : [],
    };
  };
  return [
    {
      name: "Partidos ganados",
      image: "victoria",
      description: "Ganá un partido oficial con el equipo verde o blanco.",
      evidence: v.map(label),
    },
    {
      name: "Goleador del partido",
      image: "goleador",
      description:
        "Registrá más goles que cualquier otro jugador en un partido. Los empates comparten premio.",
      evidence: s.map(label),
    },
    period(
      "Ganador del mes",
      "mes",
      "Conseguí la mayor cantidad de victorias del plantel en el último mes cerrado.",
      matches.filter((m) =>
        m.fecha?.startsWith(`${py}-${String(pm).padStart(2, "0")}`),
      ),
      `${py}-${pm}`,
    ),
    period(
      "Ganador del semestre",
      "semestre",
      "Conseguí más victorias en el último semestre cerrado: enero a junio o julio a diciembre.",
      matches.filter(
        (m) =>
          Number(m.fecha?.slice(0, 4)) === sy &&
          (mo <= 6
            ? Number(m.fecha?.slice(5, 7)) >= 7
            : Number(m.fecha?.slice(5, 7)) <= 6),
      ),
      `${sy} · semestre cerrado`,
    ),
    period(
      "Ganador del año",
      "anual",
      "Conseguí más victorias en el último año calendario cerrado.",
      matches.filter((m) => m.fecha?.startsWith(`${y - 1}-`)),
      `Año ${y - 1}`,
    ),
  ];
}
export function predictionPoints(p, m) {
  return (
    (p.ganador === winner(m) ? 3 : 0) +
    (p.golesVerde === (m.golesVerde || 0) &&
    p.golesBlanco === (m.golesBlanco || 0)
      ? 5
      : 0)
  );
}
