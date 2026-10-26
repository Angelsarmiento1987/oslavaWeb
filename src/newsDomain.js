import { team, events, winners, scorers } from "./domain.js";
import { generateGaceta } from "./updates.js";
import {
  completedMatches,
  tournamentStandings,
  rounds,
  unresolvedTies,
  finalTeams,
  finalResult,
} from "./competition.js";
import {
  playerGoals,
  goalMinutes,
  goalsComplete,
  drought,
} from "./matchAnalysis.js";
export function chronicle(m, players = []) {
  const g = m.golesVerde || 0,
    w = m.golesBlanco || 0,
    margin = Math.abs(g - w),
    color = g > w ? "Verde" : "Blanco",
    top = scorers(m).map(
      (id) =>
        `${players.find((p) => p.id === id)?.nombre || [...team(m.verde), ...team(m.blanco)].find((p) => p.id === id)?.nombre || "Jugador"} (${playerGoals(m, id)} goles)`,
    );
  return {
    category: "CRÓNICA DE LA FECHA",
    headline:
      g === w
        ? "¡Un empate que dejó todo abierto!"
        : margin === 1
          ? `¡${color} lo ganó por la mínima!`
          : margin >= 5
            ? `¡${color} impuso su ley en el potrero!`
            : `¡${color} se quedó con la jornada!`,
    body: `El ${m.fecha}, Verde y Blanco firmaron un ${g}–${w}${g === w ? " sin dueño. Los dos equipos sumaron un empate." : `. La victoria fue para el ${color}.`}${margin === 1 ? " Un solo gol separó a los equipos: alcanzó para inclinar la balanza." : ""}${top.length ? ` En la cuenta individual, ${top.length === 1 ? "el goleador del encuentro fue" : "compartieron el premio de goleador"} ${top.join(" y ")}.` : ""} El marcador dejó ${g + w} goles entre los dos equipos. La historia sigue en la próxima fecha.`,
    date: m.fecha,
    weight: 110,
    image: "duelo",
  };
}
export function newsStories(history, players) {
  const sorted = completedMatches(history),
    last = sorted.at(-1);
  if (!last) return [];
  const legacy = generateGaceta(sorted, players),
    name = (id) =>
      players.find((p) => p.id === id)?.nombre ||
      [...team(last.verde), ...team(last.blanco)].find((p) => p.id === id)
        ?.nombre ||
      "Un jugador",
    keepers = [last.arqueroVerdeId, last.arqueroBlancoId].filter(Boolean),
    stories = [...legacy],
    goals = {};
  events(last).forEach((e) => {
    if (e.jugadorId) goals[e.jugadorId] = (goals[e.jugadorId] || 0) + 1;
  });
  const add = (category, headline, body, weight, id, image = "artillero") =>
    stories.push({
      category,
      headline,
      body,
      date: last.fecha,
      weight,
      playerId: id,
      goalMinutes: id ? goalMinutes(last, id) : "",
      image,
    });
  Object.entries(goals)
    .filter(([id]) => !keepers.includes(id))
    .sort((a, b) => b[1] - a[1] || name(a[0]).localeCompare(name(b[0])))
    .forEach(([id, n], i) => {
      const green = team(last.verde).some((p) => p.id === id),
        t = green ? "Verde" : "Blanco",
        own = green ? last.golesVerde : last.golesBlanco,
        against = green ? last.golesBlanco : last.golesVerde,
        result =
          own > against
            ? "la victoria"
            : own < against
              ? "la derrota"
              : "el empate";
      const titles = [
        `${name(id)} gritó ${n} veces`,
        `La cuenta de ${name(id)}: ${n} goles`,
        `${n} aportes a la red llevan el nombre de ${name(id)}`,
        `${name(id)} encontró el arco en ${n} ocasiones`,
        `${name(id)} sumó ${n} a la cosecha de la fecha`,
      ];
      add(
        n === 1 ? "EL GOL TAMBIÉN CUENTA" : "APORTE GOLEADOR",
        titles[i] ||
          `${name(id)}: ${n} goles en el ${last.golesVerde}–${last.golesBlanco}`,
        `${name(id)} convirtió ${n} de los ${own} goles del ${t}. Un aporte concreto en ${result} por ${last.golesVerde}–${last.golesBlanco}.`,
        78 + Math.min(n, 8),
        id,
        ["artillero", "remate", "cabeza"][i % 3],
      );
    });
  for (const t of ["verde", "blanco"]) {
    const id = last[t === "verde" ? "arqueroVerdeId" : "arqueroBlancoId"];
    if (!id || !team(last[t]).some((p) => p.id === id)) continue;
    const conceded = last[t === "verde" ? "golesBlanco" : "golesVerde"] || 0,
      own = last[t === "verde" ? "golesVerde" : "golesBlanco"] || 0,
      n = goals[id] || 0,
      color = t === "verde" ? "Verde" : "Blanco";
    const title =
      n > 0
        ? `${name(id)}, arquero y autor de ${n} ${n === 1 ? "gol" : "goles"}`
        : conceded === 0
          ? `El ${color} dejó su arco en cero con ${name(id)}`
          : own < conceded
            ? `${name(id)} y el arco del ${color} en una fecha sin premio`
            : own > conceded
              ? `El triunfo del ${color} también se vivió desde el arco`
              : `${name(id)}, el arco y un empate para el ${color}`;
    add(
      "BAJO LOS TRES PALOS",
      title,
      `${name(id)} arrancó en el arco del ${color} en el ${last.golesVerde}–${last.golesBlanco} de la fecha. ${n > 0 ? `También sumó ${n} goles a los ${own} de su equipo. ` : ""}${conceded === 0 ? "El equipo terminó con la valla invicta." : `El ${color} cerró el encuentro con ${conceded} goles en contra.`}`,
      88,
      id,
      "arquero",
    );
  }
  if (goalsComplete(last)) {
    const waiting = [...team(last.verde), ...team(last.blanco)].filter(
      (p) =>
        !keepers.includes(p.id) && !goals[p.id] && drought(sorted, p.id) < 3,
    );
    if (waiting.length)
      add(
        "A LA ESPERA DEL GOL",
        waiting.length === 1
          ? `${name(waiting[0].id)} buscará su grito en la próxima`
          : `El próximo grito también espera por ${waiting.map((p) => name(p.id)).join(", ")}`,
        `${waiting.map((p) => name(p.id)).join(", ")} ${waiting.length === 1 ? "jugó y no pudo" : "jugaron y no pudieron"} convertir en esta fecha. La próxima jornada traerá otra oportunidad para encontrarse con la red.`,
        73,
        null,
        "sequia",
      );
  }
  const win = winners(last);
  if (win.length)
    add(
      "EL EQUIPO GANADOR",
      `El ${last.golesVerde > last.golesBlanco ? "Verde" : "Blanco"} ganó entre todos`,
      `${win.map(name).join(", ")} integraron el equipo ganador del último encuentro. El ${last.golesVerde}–${last.golesBlanco} es una victoria compartida por todo el equipo, hayan convertido o no.`,
      89,
      null,
      "sociedad",
    );
  return stories.sort(
    (a, b) => b.weight - a.weight || a.headline.localeCompare(b.headline, "es"),
  );
}
export function tournamentNews(
  docs,
  history,
  current,
  players,
  cutoff = Infinity,
) {
  const matches = completedMatches(history, current),
    before = (m) =>
      new Date(`${m.fecha}T${m.hora || "17:00"}:00-03:00`).getTime() < cutoff;
  let t;
  if (cutoff === Infinity) t = docs[docs.torneos_indice?.activo];
  else
    t = Object.entries(docs)
      .filter(([id]) => id.startsWith("torneo_"))
      .map(([, t]) => ({
        ...t,
        partidos: (t.partidos || []).filter((id) =>
          matches.some((m) => m.id === id && before(m)),
        ),
      }))
      .filter((t) => t.partidos.length)
      .sort((a, b) => b.edicion - a.edicion)[0];
  if (!t) return [];
  const r = rounds(t, history, current).filter(before),
    rows = tournamentStandings(
      { ...t, partidos: r.map((m) => m.id) },
      history,
      current,
      players,
    );
  if (!rows.length) return [];
  const date = r.at(-1).fecha,
    result = finalResult(t, history, current),
    stories = [];
  const add = (category, headline, body, weight) =>
    stories.push({ category, headline, body, weight, date, image: "duelo" });
  if (result && before(result)) {
    const champions = winners(result);
    add(
      champions.length === 5 ? "LOS CAMPEONES" : "LA GRAN FINAL",
      champions.length === 5
        ? "¡Cinco campeones para la historia de Oslava!"
        : "La copa todavía busca dueño",
      champions.length === 5
        ? `${champions.map((id) => players.find((p) => p.id === id)?.nombre || id).join(", ")} ganaron la final del Campeonato ${t.edicion}. La copa es del equipo completo.`
        : `La final del Campeonato ${t.edicion} terminó ${result.golesVerde}–${result.golesBlanco}. La definición sigue pendiente y todavía no hay equipo campeón.`,
      108,
    );
    return stories;
  }
  const leaders = rows.filter((p) => p.points === rows[0].points);
  add(
    "ASÍ VA EL TORNEO",
    leaders.length === 1
      ? `${rows[0].nombre} toma la punta de la clasificación`
      : `La punta del campeonato se reparte entre ${leaders.length} jugadores`,
    `El Campeonato ${t.edicion} lleva ${r.length} de sus 10 fechas. ${leaders.map((p) => p.nombre).join(", ")} ${leaders.length === 1 ? "encabeza" : "comparten"} la mayor cantidad de puntos: ${rows[0].points}. El orden comienza con ${rows
      .slice(0, 3)
      .map((p) => `${p.nombre} (${p.points} pts, ${p.goals} goles)`)
      .join(", ")}.`,
    99,
  );
  if (r.length < 10 && rows.length > 10)
    add(
      "LA PELEA POR ENTRAR",
      `${rows[9].nombre} ocupa el último lugar de acceso a la final`,
      `${rows[9].nombre} marcha décimo con ${rows[9].points} puntos y ${rows[9].goals} goles. Detrás aparece ${rows[10].nombre}, con ${rows[10].points} puntos y ${rows[10].goals} goles. Los lugares todavía son provisionales.`,
      94,
    );
  if (r.length === 10) {
    if (rows.length < 10)
      add(
        "RUMBO A LA FINAL",
        "Diez fechas cumplidas, una final por organizar",
        "Todavía hacen falta diez participantes distintos para formar los dos equipos.",
        102,
      );
    else if (!t.finalId && unresolvedTies(t, history, current).length)
      add(
        "RUMBO A LA FINAL",
        "La clasificación cerró con un desempate pendiente",
        "Hay igualdad en puntos y goles en el corte de equipos o clasificación. El administrador debe resolver el orden.",
        102,
      );
    else {
      const f = finalTeams(t, history, current);
      add(
        "LA GRAN FINAL",
        "¡Los diez nombres que van por la copa!",
        `Verde: ${f.verde.map((p) => p.nombre).join(", ")}. Blanco: ${f.blanco.map((p) => p.nombre).join(", ")}. ${cutoff === Infinity && t.fechaFinal ? "La cita está fijada para " + t.fechaFinal : "La fecha se acordará para que puedan estar los diez"}. Los cinco integrantes del equipo ganador serán campeones por igual.`,
        104,
      );
    }
  }
  return stories;
}
