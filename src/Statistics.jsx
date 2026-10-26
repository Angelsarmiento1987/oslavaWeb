import React, { useState } from "react";
import { stats, team } from "./domain.js";
export default function Statistics({ players, history, profiles, Avatar }) {
  const [query, Q] = useState(""),
    [sort, S] = useState("Nombre");
  const list = players
    .filter((p) =>
      p.nombre
        .toLocaleLowerCase("es")
        .includes(query.trim().toLocaleLowerCase("es")),
    )
    .map((p) => ({
      p,
      ...stats(
        p,
        history.filter((m) =>
          [...team(m.verde), ...team(m.blanco)].some((x) => x.id === p.id),
        ),
      ),
    }))
    .sort(
      (a, b) =>
        (sort === "Goles"
          ? b.goals - a.goals
          : sort === "Victorias"
            ? b.won - a.won
            : 0) || a.p.nombre.localeCompare(b.p.nombre, "es"),
    );
  return (
    <>
      <section className="card stats-hero">
        <div className="eyebrow">EL PLANTEL</div>
        <h1>Jugadores y estadísticas</h1>
        <p>
          {players.length} jugadores · {history.length} partidos registrados
        </p>
      </section>
      <label className="field">
        Buscar jugador
        <input
          type="search"
          value={query}
          onChange={(e) => Q(e.target.value)}
        />
      </label>
      <div className="row">
        {["Nombre", "Goles", "Victorias"].map((s) => (
          <button
            key={s}
            className={sort === s ? "" : "secondary"}
            onClick={() => S(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {!list.length && <p>No se encontraron jugadores.</p>}
      {list.map((s) => (
        <section className="card player-stat" key={s.p.id}>
          <div className="row">
            <Avatar p={s.p} profiles={profiles} size={52} />
            <div>
              <h2>{s.p.nombre}</h2>
              <small>{s.p.arquero ? "ARQUERO" : "PLANTEL"} · OSLAVA FC</small>
            </div>
            <div className="goals-stat">
              <b>{s.goals}</b>
              <small>GOLES</small>
            </div>
          </div>
          <div className="stat-grid">
            {[
              ["JUGADOS", s.played],
              ["GANADOS", s.won],
              ["EMPATES", s.tied],
              ["PERDIDOS", s.lost],
            ].map(([label, n]) => (
              <div key={label}>
                <b>{n}</b>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
