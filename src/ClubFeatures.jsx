import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";
import {
  rounds,
  tournamentStandings,
  unresolvedTies,
  finalTeams,
  finalResult,
  openEditions,
  editionWindow,
  reportPlayer,
  millis,
} from "./competition.js";
import {
  syncTournament,
  startTournament,
  saveTie,
  prepareInterviews,
} from "./competitionService.js";
import { interviewQuestion } from "./matchAnalysis.js";
const asset = (n) => `${process.env.PUBLIC_URL || ""}/assets/${n}.png`;
export function useClub({
  enabled,
  user,
  admin,
  history,
  current,
  players,
  roster,
  historyReady,
}) {
  const [docs, D] = useState({}),
    [ready, R] = useState(false),
    [error, E] = useState(""),
    [now, N] = useState(Date.now()),
    [own, O] = useState({}),
    [tick, T] = useState(0);
  const busy = useRef(false),
    queued = useRef(false);
  useEffect(() => {
    const id = setInterval(() => N(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    D({});
    R(false);
    O({});
    E("");
    if (!enabled) return;
    return onSnapshot(
      collection(db, "configuracion"),
      (s) => {
        D(Object.fromEntries(s.docs.map((d) => [d.id, d.data()])));
        R(true);
      },
      (e) => E("No se pudo leer la configuración del club: " + e.message),
    );
  }, [enabled, user?.uid]);
  const editions = Object.fromEntries(
    Object.entries(docs)
      .filter(([id]) => id.startsWith("reportaje_"))
      .map(([id, m]) => [id.slice(10), m]),
  );
  const open = openEditions(editions, roster, user?.uid, history, current, now);
  const ownKey = JSON.stringify(
    open.map((m) => [m.id, reportPlayer(m, roster, user?.uid)]).sort(),
  );
  useEffect(() => {
    O({});
    if (!enabled) return;
    const unsub = JSON.parse(ownKey).map(([id, player]) =>
      onSnapshot(
        doc(db, "reportajes", id, "respuestas", player),
        { includeMetadataChanges: true },
        (s) =>
          O((prev) => ({
            ...prev,
            [id]: s.exists() && !s.metadata.hasPendingWrites ? s.data() : null,
          })),
        (e) => E("No se pudo leer tu reportaje: " + e.message),
      ),
    );
    return () => unsub.forEach((f) => f());
  }, [enabled, user?.uid, ownKey]);
  useEffect(() => {
    if (!enabled || !admin || !ready || !historyReady) return;
    if (busy.current) {
      queued.current = true;
      return;
    }
    let stopped = false;
    busy.current = true;
    queued.current = false;
    (async () => {
      try {
        await syncTournament(docs, history, current);
        if (players.length)
          await prepareInterviews(
            editions,
            history,
            current,
            players,
            interviewQuestion,
          );
      } catch (e) {
        if (!stopped) E("Sincronización del club: " + e.message);
      } finally {
        busy.current = false;
        if (queued.current) {
          queued.current = false;
          T((x) => x + 1);
        }
      }
    })();
    return () => {
      stopped = true;
    };
  }, [
    enabled,
    admin,
    ready,
    historyReady,
    docs,
    history,
    current,
    roster,
    tick,
  ]);
  return {
    docs,
    ready,
    error,
    now,
    editions,
    open,
    own,
    activeId: docs.torneos_indice?.activo || "",
  };
}
export function Tournament({
  club,
  history,
  current,
  players,
  profiles,
  admin,
  act,
  go,
  Pitch,
}) {
  const [selected, S] = useState(""),
    id = selected || club.activeId,
    t = club.docs[id] || {},
    rows = tournamentStandings(t, history, current, players),
    results = rounds(t, history, current),
    ties = unresolvedTies(t, history, current),
    f = finalTeams(t, history, current),
    result = finalResult(t, history, current);
  return (
    <>
      <h1>Torneo Oslava</h1>
      <details className="card">
        <summary>Reglamento del torneo</summary>
        <ol>
          <li>
            Se disputan 10 fechas con clasificación individual: victoria 3
            puntos, empate 1, derrota o ausencia 0.
          </li>
          <li>
            A igualdad de puntos, se ordena por goles del campeonato. El
            administrador resuelve los empates de puntos y goles que afectan los
            puestos 5 y 10.
          </li>
          <li>
            Los puestos 1–5 forman el Verde y los puestos 6–10 el Blanco en la
            final.
          </li>
          <li>
            Los cinco integrantes del equipo ganador son campeones por igual.
            Una final empatada no entrega copas.
          </li>
          <li>
            El administrador inicia el siguiente campeonato. Se conserva el
            historial y la final no cuenta en el torneo siguiente.
          </li>
        </ol>
      </details>
      {!club.ready ? (
        <p>Cargando campeonato…</p>
      ) : !Object.keys(t).length ? (
        <p>Todavía no se inició el primer campeonato.</p>
      ) : (
        <>
          <h2>
            Campeonato {t.edicion} · {results.length}/10 fechas finalizadas
          </h2>
          <p>{t.estado?.replaceAll("_", " ")}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {["#", "Jugador", "PTS", "PJ", "PG", "PE", "PP", "G"].map(
                    (x) => (
                      <th key={x}>{x}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => (
                  <tr className={i < 10 ? "qualified" : ""} key={p.id}>
                    <td>{i + 1}</td>
                    <td>{p.nombre}</td>
                    <td>
                      <b>{p.points}</b>
                    </td>
                    {[p.played, p.won, p.drawn, p.lost, p.goals].map((n, i) => (
                      <td key={i}>{n}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {results.length === 10 && ties.length > 0 && !t.finalId && (
            <section className="card">
              <p>
                Hay empate en puntos y goles en el corte de equipos o
                clasificación.
              </p>
              {admin && id === club.activeId && (
                <>
                  <p>Tocá primero al mejor ubicado y continuá en orden:</p>
                  {ties.map((p) => (
                    <button
                      className="secondary"
                      key={p.id}
                      onClick={() =>
                        act(
                          () => saveTie(id, p.id),
                          "Orden de desempate guardado",
                        )
                      }
                    >
                      Ubicar a {p.nombre}
                    </button>
                  ))}
                </>
              )}
            </section>
          )}
          {results.length === 10 && rows.length < 10 && (
            <p>Se necesitan diez jugadores distintos para formar la final.</p>
          )}
          {t.finalId && (
            <>
              <h2>La gran final</h2>
              <p>
                VERDE: {f.verde.map((p) => p.nombre).join(", ")}
                <br />
                BLANCO: {f.blanco.map((p) => p.nombre).join(", ")}
              </p>
              <Pitch m={f} players={players} profiles={profiles} />
              <p>{t.fechaFinal || "Fecha a definir"}</p>
              {result ? (
                <>
                  <h2>
                    Verde {result.golesVerde} — {result.golesBlanco} Blanco
                  </h2>
                  <p>
                    {(t.campeones || []).length === 5
                      ? "🏆 Campeones: " +
                        t.campeones
                          .map(
                            (id) =>
                              players.find((p) => p.id === id)?.nombre ||
                              [...f.verde, ...f.blanco].find((p) => p.id === id)
                                ?.nombre ||
                              id,
                          )
                          .join(", ")
                      : "Final empatada o pendiente de cierre: todavía no se entregan copas."}
                  </p>
                </>
              ) : (
                admin &&
                id === club.activeId && (
                  <button onClick={() => go("Crear partido")}>
                    Fechar / publicar final
                  </button>
                )
              )}
            </>
          )}
        </>
      )}
      {admin &&
        !selected &&
        (!Object.keys(t).length || t.estado === "cerrado") && (
          <button
            onClick={() => {
              if (
                window.confirm(
                  "¿Iniciar un nuevo campeonato? Se conserva el anterior.",
                )
              )
                act(() => startTournament(), "Nuevo campeonato iniciado");
            }}
          >
            {Object.keys(t).length
              ? "Iniciar siguiente campeonato"
              : "Iniciar primer campeonato"}
          </button>
        )}
      {selected && (
        <button className="secondary" onClick={() => S("")}>
          Volver al campeonato actual
        </button>
      )}
      {Object.entries(club.docs)
        .filter(([key]) => key.startsWith("torneo_") && key !== id)
        .sort((a, b) => b[1].edicion - a[1].edicion)
        .map(([key, t]) => (
          <button className="secondary" key={key} onClick={() => S(key)}>
            Ver campeonato {t.edicion}
          </button>
        ))}
    </>
  );
}
function loadDraft(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}
export function Reports({ club, roster, uid, go }) {
  const [selected, S] = useState("");
  const m = club.open.find((m) => m.id === selected) || club.open.at(-1);
  return (
    <>
      <h1>Reportajes</h1>
      {!m ? (
        <p>
          No hay entrevistas abiertas para vos. Aparecen después de un partido
          que jugaste y cierran antes de la edición del domingo.
        </p>
      ) : (
        <>
          {club.open.length > 1 && (
            <select
              aria-label="Elegir reportaje"
              value={m.id}
              onChange={(e) => S(e.target.value)}
            >
              {club.open.map((m) => (
                <option key={m.id} value={m.id}>
                  Partido {m.fecha}
                </option>
              ))}
            </select>
          )}
          <InterviewForm
            key={uid + "_" + m.id}
            meta={m}
            playerId={reportPlayer(m, roster, uid)}
            uid={uid}
            already={club.own[m.id]}
            now={club.now}
            go={go}
          />
        </>
      )}
    </>
  );
}
export function InterviewForm({ meta, playerId, uid, already, now, go }) {
  const draftKey = `oslava-reportaje:${uid}:${meta.id}`,
    draft = useRef(loadDraft(draftKey)),
    [first, F] = useState(draft.current.first || ""),
    [second, S] = useState(draft.current.second || ""),
    [step, P] = useState(draft.current.first ? 1 : 0),
    [sending, B] = useState(false),
    [error, E] = useState(""),
    [sent, T] = useState(false);
  const participant = meta.participantes?.[playerId],
    window = editionWindow(meta);
  useEffect(() => {
    try {
      if (!sent)
        localStorage.setItem(draftKey, JSON.stringify({ first, second }));
    } catch {}
  }, [draftKey, first, second, sent]);
  const submit = async (declined) => {
    if (sending) return;
    B(true);
    E("");
    try {
      const currentNow = Date.now();
      if (currentNow < window.open || currentNow >= window.close)
        throw Error("El plazo para responder terminó.");
      if (!participant || !playerId)
        throw Error(
          "Tu cuenta debe estar vinculada al jugador de este partido.",
        );
      if (!declined && (!first.trim() || !second.trim()))
        throw Error("Completá ambas respuestas.");
      await setDoc(doc(db, "reportajes", meta.id, "respuestas", playerId), {
        usuarioUid: uid,
        jugadorId: playerId,
        partidoId: meta.id,
        nombre: participant.nombre,
        equipo: participant.equipo,
        preguntaResultado: participant.preguntaResultado,
        preguntaEstadistica: participant.preguntaEstadistica,
        respuestaResultado: declined ? "" : first.trim(),
        respuestaEstadistica: declined ? "" : second.trim(),
        estado: declined ? "declino" : "respondio",
        creadoEn: serverTimestamp(),
      });
      T(true);
      try {
        localStorage.removeItem(draftKey);
      } catch {}
    } catch (e) {
      E("No se pudo guardar: " + e.message);
    } finally {
      B(false);
    }
  };
  if (sent)
    return (
      <section className="card">
        <h2>Muchas gracias por tu tiempo.</h2>
        <p>
          Tu decisión quedó guardada. Las declaraciones salen en la edición del
          domingo.
        </p>
        <button onClick={() => go("Inicio")}>Volver al inicio</button>
      </section>
    );
  if (already && !sending)
    return <p>Ya guardaste tu decisión para este partido. ¡Gracias!</p>;
  if (already === undefined) return <p>Consultando si ya respondiste…</p>;
  if (!participant)
    return (
      <p>Tu cuenta no está vinculada a un participante de este reportaje.</p>
    );
  return (
    <section className="interview-form">
      <img src={asset("gaceta_periodista")} alt="El Cronista del Potrero" />
      <h2>El Cronista del Potrero</h2>
      <p>
        Hola, {participant.nombre}. Es opcional. Tus respuestas saldrán en La
        Gaceta del domingo. Tenés tiempo hasta{" "}
        {new Intl.DateTimeFormat("es-AR", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "America/Argentina/Buenos_Aires",
        }).format(window.close)}
        .
      </p>
      {error && <p role="alert">{error}</p>}
      <h3>{participant.preguntaResultado}</h3>
      {step === 0 ? (
        <>
          <textarea
            aria-label="Respuesta sobre el resultado"
            maxLength={700}
            rows={5}
            value={first}
            onChange={(e) => F(e.target.value)}
          />
          <button disabled={!first.trim() || sending} onClick={() => P(1)}>
            Continuar
          </button>
          <button
            className="secondary"
            disabled={sending}
            onClick={() => {
              if (
                globalThis.confirm(
                  "¿Preferís no declarar? Se indicará en la edición del domingo.",
                )
              )
                submit(true);
            }}
          >
            Prefiero no declarar
          </button>
        </>
      ) : (
        <>
          <p>{first}</p>
          <h3>{participant.preguntaEstadistica}</h3>
          <textarea
            aria-label="Respuesta sobre tus estadísticas"
            maxLength={700}
            rows={5}
            value={second}
            onChange={(e) => S(e.target.value)}
            disabled={sending || step === 2}
          />
          {step === 1 ? (
            <button disabled={!second.trim()} onClick={() => P(2)}>
              Revisar reportaje
            </button>
          ) : (
            <button
              disabled={sending || now >= window.close}
              onClick={() => submit(false)}
            >
              {sending ? "Guardando…" : "Publicar reportaje"}
            </button>
          )}
          <button className="secondary" disabled={sending} onClick={() => P(0)}>
            Editar respuestas
          </button>
        </>
      )}
    </section>
  );
}
export function PublishedInterviews({ meta, id, players, profiles }) {
  const [replies, R] = useState(null),
    [error, E] = useState("");
  useEffect(() => {
    R(null);
    E("");
    return onSnapshot(
      collection(db, "reportajes", id, "respuestas"),
      (s) => R(s.docs.map((d) => d.data())),
      (e) => E("No se pudieron cargar las declaraciones: " + e.message),
    );
  }, [id]);
  if (error) return <p role="alert">{error}</p>;
  if (!replies) return <p>Cargando reportajes…</p>;
  const cutoff = editionWindow(meta).close;
  return (
    <section className="published-interviews">
      <h2>Voces del vestuario · {meta.fecha}</h2>
      {["verde", "blanco"].map((t) => (
        <section key={t}>
          <h3>Equipo {t}</h3>
          {Object.entries(meta.participantes || {})
            .filter(([, p]) => p.equipo === t)
            .map(([id, p]) => {
              const answer = replies.find(
                (a) => a.jugadorId === id && millis(a.creadoEn) < cutoff,
              );
              return (
                <article key={id}>
                  <h3>{p.nombre}</h3>
                  {answer?.estado === "respondio" &&
                    (() => {
                      const current = players.find((x) => x.id === id),
                        pr = profiles[current?.usuarioUid] || {},
                        photo = pr.fotoData || pr.fotoUrl || current?.fotoUrl,
                        src = photo
                          ? photo.startsWith("http") ||
                            photo.startsWith("data:")
                            ? photo
                            : `data:image/jpeg;base64,${photo}`
                          : asset("gaceta_artillero");
                      return (
                        <img
                          className="interview-photo"
                          src={src}
                          alt={`Retrato de ${p.nombre}`}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = asset("gaceta_artillero");
                          }}
                        />
                      );
                    })()}
                  {answer?.estado === "respondio" ? (
                    <>
                      {[
                        ["preguntaResultado", "respuestaResultado"],
                        ["preguntaEstadistica", "respuestaEstadistica"],
                      ].map(([q, a]) => (
                        <div key={q}>
                          <b>{answer[q]}</b>
                          <blockquote>{answer[a]}</blockquote>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p>
                      {answer?.estado === "declino"
                        ? "Prefirió no dar declaraciones."
                        : "No se recibió declaración al cierre."}
                    </p>
                  )}
                </article>
              );
            })}
        </section>
      ))}
    </section>
  );
}
