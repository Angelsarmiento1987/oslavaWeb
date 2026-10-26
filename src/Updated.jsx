import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { winner } from "./domain.js";
import {
  monthKey,
  monthTitle,
  monthlyTeam,
  generateGaceta,
  monthlyProde,
} from "./updates.js";
const asset = (n) => `${process.env.PUBLIC_URL || ""}/assets/${n}.png`;
function MonthPicker({ offset, setOffset }) {
  const key = monthKey(offset);
  return (
    <div className="month-picker">
      <button className="secondary" onClick={() => setOffset(offset - 1)}>
        ‹ Anterior
      </button>
      <strong>{monthTitle(key)}</strong>
      <button
        className="secondary"
        disabled={offset >= 0}
        onClick={() => setOffset(offset + 1)}
      >
        Siguiente ›
      </button>
    </div>
  );
}
export function MonthlyTeams({ players, history, profiles, Pitch }) {
  const [offset, O] = useState(0),
    [ideal, I] = useState(false);
  const result = monthlyTeam(players, history, monthKey(offset), ideal);
  const selected = result.selected.map((s) => s.player);
  return (
    <>
      <h1>Equipos del mes</h1>
      <p>Los destacados según los partidos finalizados.</p>
      <MonthPicker offset={offset} setOffset={O} />
      <div className="row">
        <button className={!ideal ? "" : "secondary"} onClick={() => I(false)}>
          Más ganadores
        </button>
        <button className={ideal ? "" : "secondary"} onClick={() => I(true)}>
          Equipo ideal
        </button>
      </div>
      <p>
        {ideal
          ? "Un arquero y cuatro de campo. Arqueros por victorias, promedio de goles recibidos y vallas invictas; campo por victorias y goles."
          : "Se priorizan las victorias y luego los partidos jugados."}
      </p>
      {!result.matches.length ? (
        <p>Todavía no hay partidos finalizados en este mes.</p>
      ) : !selected.length ? (
        <p>No hay jugadores con participaciones registradas.</p>
      ) : (
        <>
          {ideal && !selected.some((p) => p.arquero) && (
            <p role="status">
              No hay un arquero habilitado con participaciones este mes. El
              administrador debe revisar los puestos del plantel.
            </p>
          )}
          <Pitch
            m={{ verde: selected, blanco: [] }}
            profiles={profiles}
            players={players}
          />
          <h2>Clasificación · {result.matches.length} partidos</h2>
          {result.selected.map((s, i) => (
            <div className="card row" key={s.player.id}>
              <b>
                {i + 1}. {s.player.nombre}
              </b>
              <span>
                {ideal && s.player.arquero
                  ? `🧤 PG ${s.won} · GC ${s.conceded} · VI ${s.cleanSheets}`
                  : `PG ${s.won} · PJ ${s.played} · ⚽ ${s.goals}`}
              </span>
            </div>
          ))}
        </>
      )}
    </>
  );
}
export function Gaceta({ players, history, preview = false, onOpen }) {
  const stories = useMemo(
    () => generateGaceta(history, players),
    [history, players],
  );
  return (
    <section className={`newspaper ${preview ? "newspaper-preview" : ""}`}>
      <div className="paper-kicker">OSLAVA FC · SUPLEMENTO DEPORTIVO</div>
      <h1>LA GACETA DE OSLAVA</h1>
      <div className="paper-motto">EL POTRERO TAMBIÉN HACE HISTORIA</div>
      {!stories.length ? (
        <p>La portada se estrenará con los primeros partidos finalizados.</p>
      ) : (
        <>
          <div className="paper-edition">
            EDICIÓN {stories[0].date} · {stories.length} NOTAS
          </div>
          {stories.slice(0, preview ? 3 : 12).map((s, i) => (
            <article
              key={s.category + s.headline}
              className={i === 0 ? "featured" : ""}
            >
              <div className="paper-kicker">{s.category}</div>
              {preview ? (
                <h2>
                  <button onClick={onOpen}>{s.headline}</button>
                </h2>
              ) : (
                <h2>{s.headline}</h2>
              )}
              <img
                src={asset(`gaceta_${s.image}`)}
                alt={`Ilustración de ${s.category.toLowerCase()}`}
                loading="lazy"
              />
              <p>{s.body}</p>
            </article>
          ))}
        </>
      )}
      {preview ? (
        <button className="paper-link" onClick={onOpen}>
          Ver todas las noticias →
        </button>
      ) : (
        <small>
          Noticias calculadas con partidos finalizados. Las ausencias no cuentan
          como partidos sin convertir.
        </small>
      )}
    </section>
  );
}
export function AuthorizedMails({ act }) {
  const [email, E] = useState(""),
    [mails, M] = useState([]),
    [error, F] = useState("");
  useEffect(
    () =>
      onSnapshot(
        collection(db, "mails_autorizados"),
        (s) =>
          M(
            s.docs
              .map((d) => ({ ...d.data(), id: d.id }))
              .sort((a, b) => a.id.localeCompare(b.id)),
          ),
        (e) => F(e.message),
      ),
    [],
  );
  return (
    <>
      <h1>Mails autorizados</h1>
      <p>
        Autorizá el correo de la cuenta Google. Después vinculá la cuenta
        registrada con su ficha existente del plantel.
      </p>
      <label className="field">
        Correo de Google
        <input
          type="email"
          value={email}
          onChange={(e) => E(e.target.value)}
          autoCapitalize="none"
          autoComplete="off"
        />
      </label>
      <button
        onClick={() =>
          act(async () => {
            const e = email.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
              throw Error("Ingresá un correo válido.");
            await setDoc(doc(db, "mails_autorizados", e), {
              email: e,
              activo: true,
            });
            E("");
          }, "Correo autorizado")
        }
      >
        Autorizar correo
      </button>
      {error && <p role="alert">{error}</p>}
      <h2>Autorizados ({mails.filter((m) => m.activo).length})</h2>
      {mails.map((m) => (
        <section className="card" key={m.id}>
          <b className="email">{m.id}</b>
          <p>{m.activo ? "✓ AUTORIZADO" : "ACCESO REVOCADO"}</p>
          <button
            className="secondary"
            onClick={() => {
              if (m.activo && !window.confirm(`¿Revocar el acceso de ${m.id}?`))
                return;
              act(
                () =>
                  updateDoc(doc(db, "mails_autorizados", m.id), {
                    activo: !m.activo,
                  }),
                "Acceso actualizado",
              );
            }}
          >
            {m.activo ? "Revocar" : "Activar"}
          </button>
        </section>
      ))}
      <p>Revocar el acceso no borra estadísticas ni elimina su ficha.</p>
    </>
  );
}
export function ProdeUpdated({ match, history, profiles, uid, admin, act }) {
  const [bets, B] = useState([]),
    [rankings, R] = useState({}),
    [error, E] = useState(""),
    [offset, O] = useState(0),
    [choice, C] = useState(""),
    [green, G] = useState(""),
    [white, W] = useState(""),
    [rules, S] = useState(false),
    [saving, V] = useState(false),
    [tick, T] = useState(Date.now());
  useEffect(() => {
    B([]);
    R({});
    const betsQuery = admin
      ? collection(db, "prode")
      : query(collection(db, "prode"), where("usuarioUid", "==", uid));
    const unsubs = [
      onSnapshot(
        betsQuery,
        (s) => B(s.docs.map((d) => d.data())),
        (e) => E(e.message),
      ),
      onSnapshot(
        collection(db, "prode_rankings"),
        (s) => R(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))),
        (e) => E(e.message),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid, admin]);
  useEffect(() => {
    C("");
    G("");
    W("");
  }, [match?.id]);
  useEffect(() => {
    const t = setInterval(() => T(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const start = match
    ? new Date(`${match.fecha}T${match.hora}:00-03:00`).getTime()
    : NaN;
  const closed =
    !match ||
    match.estado !== "programado" ||
    !Number.isFinite(start) ||
    tick >= start;
  const bet = bets.find(
    (p) => p.partidoId === match?.id && p.usuarioUid === uid,
  );
  const key = monthKey(offset),
    published = rankings[key],
    preview = monthlyProde(bets, history, key);
  const standings = published
    ? Object.entries(published.scores || {})
        .filter(([, p]) => typeof p === "number")
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    : admin
      ? preview
      : [];
  const submit = async () => {
    V(true);
    try {
      const a = Number(green),
        b = Number(white);
      if (!choice) throw Error("Marcá una cruz: 1, X o 2.");
      if (
        green === "" ||
        white === "" ||
        ![a, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 99)
      )
        throw Error("Ingresá ambos resultados entre 0 y 99.");
      if (winner({ golesVerde: a, golesBlanco: b }) !== choice)
        throw Error("El resultado no coincide con la cruz elegida.");
      const id = match.id;
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "prode", `${id}_${uid}`),
          current = await tx.get(doc(db, "partidos", "proximo")),
          m = current.data();
        if (
          !m ||
          m.id !== id ||
          m.estado !== "programado" ||
          Date.now() >= new Date(`${m.fecha}T${m.hora}:00-03:00`).getTime()
        )
          throw Error("El prode está cerrado.");
        tx.set(ref, {
          partidoId: id,
          usuarioUid: uid,
          ganador: choice,
          golesVerde: a,
          golesBlanco: b,
          fechaPartido: m.fecha,
          creadoEn: Date.now(),
        });
      });
      E("Pronóstico registrado");
    } catch (e) {
      E(e.message);
    } finally {
      V(false);
    }
  };
  return (
    <>
      <h1>Prode Oslava</h1>
      <p>Pronosticá 1 / X / 2 y el resultado exacto. Recreativo, sin dinero.</p>
      <button
        className="secondary"
        onClick={() => S(!rules)}
        aria-expanded={rules}
      >
        Reglas del prode
      </button>
      {rules && (
        <section className="card">
          <h2>Reglamento</h2>
          <p>1: gana Verde. X: empate. 2: gana Blanco.</p>
          <p>
            3 puntos por acertar ganador o empate y 5 adicionales por el
            resultado exacto: máximo 8 puntos.
          </p>
          <p>
            Una apuesta por jugador y partido, sin modificaciones. Cierra al
            comenzar el partido. Los puntos se acumulan por mes y los empates en
            el primer puesto comparten el campeonato. El administrador publica
            el ranking una vez cerrado el mes.
          </p>
        </section>
      )}
      {error && <p role="status">{error}</p>}
      {!match ? (
        <p>Todavía no hay próximo partido publicado.</p>
      ) : (
        <>
          <h2>
            {match.fecha} · {match.hora}
          </h2>
          {bet ? (
            <section className="card">
              <h3>Tu apuesta registrada</h3>
              <p>
                {bet.ganador} · {bet.golesVerde} - {bet.golesBlanco}
              </p>
              <small>
                Tu pronóstico ya está guardado y no se puede modificar.
              </small>
            </section>
          ) : closed ? (
            <p>Las apuestas para este partido están cerradas.</p>
          ) : (
            <>
              <div className="row prode-choices">
                {[
                  ["verde", "1 · VERDE"],
                  ["empate", "X · EMPATE"],
                  ["blanco", "2 · BLANCO"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    className={choice === v ? "" : "secondary"}
                    onClick={() => C(v)}
                  >
                    {choice === v ? "✕ " : ""}
                    {label}
                  </button>
                ))}
              </div>
              <div className="row">
                <label className="field">
                  Goles verde
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={green}
                    onChange={(e) => G(e.target.value)}
                  />
                </label>
                <label className="field">
                  Goles blanco
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={white}
                    onChange={(e) => W(e.target.value)}
                  />
                </label>
              </div>
              <button disabled={saving} onClick={submit}>
                {saving ? "Guardando…" : "Confirmar pronóstico"}
              </button>
            </>
          )}
        </>
      )}
      <h2>Campeonato mensual del prode</h2>
      <MonthPicker offset={offset} setOffset={O} />
      {admin && offset < 0 && (
        <button
          onClick={() =>
            act(async () => {
              const scores = Object.fromEntries(preview),
                names = Object.fromEntries(
                  preview.map(([id]) => [id, profiles[id]?.apodo || "Jugador"]),
                );
              await setDoc(doc(db, "prode_rankings", key), {
                scores,
                names,
                publicadoPor: uid,
                publicadoEn: Date.now(),
              });
            }, `Clasificación de ${key} publicada`)
          }
        >
          Publicar / actualizar ranking del mes
        </button>
      )}
      {standings.length > 0 ? (
        <>
          {published && offset < 0 ? (
            <h3>
              🏆{" "}
              {standings
                .filter(([, p]) => p === standings[0][1])
                .map(
                  ([id]) =>
                    published.names?.[id] || profiles[id]?.apodo || "Jugador",
                )
                .join(", ")}{" "}
              · Campeón del mes
            </h3>
          ) : (
            <p>
              {published
                ? "Clasificación publicada"
                : "Vista previa del administrador"}
            </p>
          )}
          {standings.map(([id, points], i) => (
            <div className="card row" key={id}>
              <b>
                {i + 1}.{" "}
                {published?.names?.[id] || profiles[id]?.apodo || "Jugador"}
              </b>
              <span>{points} pts</span>
            </div>
          ))}
        </>
      ) : (
        <p>
          {admin
            ? "Todavía no hay pronósticos puntuados."
            : "El ranking de este mes todavía no fue publicado."}
        </p>
      )}
    </>
  );
}
