import { completedMatches } from "./competition.js";
import { label } from "./domain.js";

const argentinaDate = (now) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export function homeSchedule(history, current, now = new Date()) {
  const finished = completedMatches(history, current);
  const latest = finished.at(-1) || null;
  const today = argentinaDate(now);
  const finishedCurrent =
    current &&
    (current.estado === "finalizado" ||
      finished.some(
        (m) =>
          (current.id && m.id === current.id) ||
          (m.fecha === current.fecha &&
            (m.hora || "17:00") === (current.hora || "17:00")),
      ));
  // Only a published, unfinished fixture may supply formations for the next date.
  const upcoming =
    current &&
    !finishedCurrent &&
    (current.estado === "en vivo" || current.fecha >= today)
      ? current
      : null;
  if (upcoming)
    return {
      latest,
      result: latest ? label(latest) : "",
      upcoming,
      fecha: upcoming.fecha,
      hora: upcoming.hora || "17:00",
    };

  // Calendar arithmetic uses Argentina's date, independently of the phone's timezone.
  const base = latest?.fecha > today ? latest.fecha : today;
  const date = new Date(`${base}T12:00:00Z`);
  let days = (6 - date.getUTCDay() + 7) % 7;
  if (days === 0 && latest?.fecha >= base) days = 7;
  date.setUTCDate(date.getUTCDate() + days);
  return {
    latest,
    result: latest ? label(latest) : "",
    upcoming: null,
    fecha: date.toISOString().slice(0, 10),
    hora: current?.hora || latest?.hora || "17:00",
  };
}
