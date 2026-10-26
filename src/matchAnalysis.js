import { team, events } from "./domain.js";
export const playerGoals = (m, id) =>
  events(m).filter((e) => e.jugadorId === id).length;
export const goalsComplete = (m) =>
  events(m).filter((e) => typeof e.jugadorId === "string" && e.jugadorId.trim())
    .length ===
  (m.golesVerde || 0) + (m.golesBlanco || 0);
export function drought(matches, id) {
  let n = 0;
  const played = matches.filter((m) =>
    [...team(m.verde), ...team(m.blanco)].some((p) => p.id === id),
  );
  for (let i = played.length - 1; i >= 0; i--) {
    if (playerGoals(played[i], id) > 0 || !goalsComplete(played[i])) break;
    n++;
  }
  return n;
}
export function goalMinutes(m, id) {
  const total = playerGoals(m, id),
    minutes = events(m)
      .filter(
        (e) =>
          e.jugadorId === id &&
          Number.isInteger(e.minuto) &&
          e.minuto >= 0 &&
          e.minuto <= 999,
      )
      .map((e) => e.minuto)
      .sort((a, b) => a - b);
  if (!minutes.length) return "";
  const list = minutes
    .map((n) => `${n}′`)
    .join(", ")
    .replace(/, ([^,]+)$/, " y $1");
  if (minutes.length < total)
    return (
      (minutes.length === 1
        ? "Uno de sus goles llegó a los "
        : "Entre sus festejos estuvieron los de ") +
      list +
      "."
    );
  return (
    (minutes.length === 1 ? "Su gol llegó a los " : "Convirtió a los ") +
    list +
    "."
  );
}
export function interviewQuestion(m, p, t, history, players) {
  const conceded = m[t === "verde" ? "golesBlanco" : "golesVerde"] || 0,
    goals = playerGoals(m, p.id);
  if (m[t === "verde" ? "arqueroVerdeId" : "arqueroBlancoId"] === p.id)
    return conceded === 0
      ? "Tu equipo terminó sin goles en contra y figurás como arquero del partido. ¿Cómo viviste el encuentro desde el arco?"
      : `Figurás como arquero del partido y tu equipo recibió ${conceded} goles. ¿Cómo viste el trabajo del equipo para defender y qué mejorarías?`;
  if (players.find((x) => x.id === p.id)?.arquero)
    return `Estás marcado como arquero en el plantel y tu equipo recibió ${conceded} goles. ¿Cómo viste la defensa en este partido?`;
  if (goals === 0 && !goalsComplete(m))
    return "El registro no tiene goles asignados a tu nombre. ¿Qué destacás de tu aporte y del equipo en este encuentro?";
  const totals = {};
  history.forEach((m) =>
    events(m).forEach((e) => {
      if (e.jugadorId) totals[e.jugadorId] = (totals[e.jugadorId] || 0) + 1;
    }),
  );
  const total = totals[p.id] || 0,
    leader = Math.max(0, ...Object.values(totals));
  if (total > 0 && total === leader)
    return `Compartís o liderás la tabla histórica con ${total} goles. Hoy marcaste ${goals}. ¿Cómo vivís la pelea por ser el artillero?`;
  if (total > 0 && leader - total >= 1 && leader - total <= 2)
    return `Llevás ${total} goles y estás a ${leader - total} de la cima histórica. ¿Te motiva acercarte a los goleadores?`;
  if (goals > 0)
    return `Hoy marcaste ${goals} ${goals === 1 ? "gol" : "goles"}. ¿Con cuál te quedás y qué significó para vos?`;
  const d = drought(history, p.id);
  return d >= 3
    ? `Llevás ${d} partidos jugados sin convertir. ¿Cómo te sentís y qué buscás aportar al equipo mientras vuelve el gol?`
    : "Hoy no te tocó convertir. ¿Qué destacás de tu aporte y del trabajo de tus compañeros?";
}
