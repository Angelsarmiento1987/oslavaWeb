import React, { useState } from "react";
import {
  completedMatches,
  sundayEdition,
  editionWindow,
} from "./competition.js";
import { newsStories, chronicle, tournamentNews } from "./newsDomain.js";
import { PublishedInterviews } from "./ClubFeatures.jsx";
const asset = (n) => `${process.env.PUBLIC_URL || ""}/assets/${n}.png`;
const display = (ms) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(ms);
function Byline() {
  return (
    <div className="paper-byline">
      <img src={asset("gaceta_periodista")} alt="El Cronista del Potrero" />
      <div>
        <b>EL CRONISTA DEL POTRERO</b>
        <p>
          La pluma de Oslava
          <br />
          <small>Fútbol, nombres e historias del potrero</small>
        </p>
      </div>
    </div>
  );
}
function Masthead({ subtitle }) {
  return (
    <>
      <div className="paper-kicker">AÑO I · OSLAVA FC · DIARIO DEL POTRERO</div>
      <h1>
        La Gaceta <small>DE OSLAVA</small>
      </h1>
      <div className="paper-motto">{subtitle}</div>
    </>
  );
}
export function Story({ story, players, profiles, index = 0 }) {
  const [expanded, E] = useState(false),
    p = players.find((p) => p.id === story.playerId),
    profile = profiles[p?.usuarioUid],
    photo = profile?.fotoData || profile?.fotoUrl || p?.fotoUrl;
  const src = photo
    ? photo.startsWith("http") || photo.startsWith("data:")
      ? photo
      : `data:image/jpeg;base64,${photo}`
    : asset(
        `gaceta_${story.image || ["artillero", "remate", "cabeza"][index % 3]}`,
      );
  return (
    <article className={expanded ? "featured" : ""}>
      <div className="paper-kicker">{story.category}</div>
      <h2>
        <button aria-expanded={expanded} onClick={() => E(!expanded)}>
          {story.headline}
        </button>
      </h2>
      <img
        src={src}
        alt={
          photo
            ? "Foto del protagonista"
            : `Ilustración de ${story.category.toLowerCase()}`
        }
        loading="lazy"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = asset("gaceta_artillero");
        }}
      />
      <p className={expanded ? "" : "paper-excerpt"}>{story.body}</p>
      {story.goalMinutes && <p className="goal-minutes">{story.goalMinutes}</p>}
      <small>
        EDICIÓN {story.date} ·{" "}
        <button className="paper-text-button" onClick={() => E(!expanded)}>
          {expanded ? "Cerrar nota" : "Leer noticia ›"}
        </button>
      </small>
    </article>
  );
}
export function Newspaper({
  players,
  history,
  current,
  profiles = {},
  club,
  preview = false,
  onOpen,
  onReport,
}) {
  const [tab, T] = useState("Portada"),
    matches = completedMatches(history, current),
    latest = matches.at(-1),
    now = club?.now || Date.now(),
    edition = sundayEdition(now),
    docs = club?.docs || {},
    editions = club?.editions || {},
    stories = [
      ...tournamentNews(docs, history, current, players),
      ...newsStories(matches, players),
    ].sort((a, b) => b.weight - a.weight),
    weekly = matches.filter((m) => {
      const start = new Date(
        `${m.fecha}T${m.hora || "17:00"}:00-03:00`,
      ).getTime();
      return start >= edition.previous && start < edition.publication;
    }),
    atPublication = matches.filter(
      (m) =>
        new Date(`${m.fecha}T${m.hora || "17:00"}:00-03:00`).getTime() <
        edition.publication,
    ),
    published = Object.entries(editions)
      .filter(([, m]) => editionWindow(m).publish <= now)
      .sort(
        (a, b) => editionWindow(b[1]).publish - editionWindow(a[1]).publish,
      );
  const cover = latest ? chronicle(latest, players) : null;
  if (preview)
    return (
      <section className="newspaper newspaper-preview">
        <Masthead
          subtitle={
            latest ? `EDICIÓN ${latest.fecha}` : "EL DIARIO DEL POTRERO"
          }
        />
        {cover ? (
          <>
            <h2>{cover.headline}</h2>
            <div className="paper-score">
              VERDE{" "}
              <b>
                {latest.golesVerde} – {latest.golesBlanco}
              </b>{" "}
              BLANCO
            </div>
            <p>{cover.body}</p>
          </>
        ) : (
          <p>El diario se estrena con el primer partido finalizado.</p>
        )}
        <button className="paper-link" onClick={onOpen}>
          Ver todas las noticias →
        </button>
      </section>
    );
  const sundayStories = [
    ...newsStories(weekly, players).filter((s) =>
      ["EL ARTILLERO", "DUELO DE COLORES", "LA SOCIEDAD"].includes(s.category),
    ),
    ...newsStories(atPublication, players).filter((s) =>
      [
        "LA PÓLVORA MOJADA",
        "SE TERMINÓ LA SEQUÍA",
        "A LA ESPERA DEL GOL",
      ].includes(s.category),
    ),
    ...tournamentNews(docs, history, current, players, edition.publication),
  ];
  return (
    <>
      <div className="row paper-tabs">
        {["Portada", "Vestuario", "Domingo"].map((t) => (
          <button
            key={t}
            className={tab === t ? "" : "secondary"}
            onClick={() => T(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <section className="newspaper">
        <Masthead
          subtitle={
            tab === "Domingo"
              ? `SUPLEMENTO DOMINICAL · ${display(edition.publication)} · 11:00`
              : tab === "Vestuario"
                ? "VOCES DEL VESTUARIO · DECLARACIONES POSPARTIDO"
                : `EDICIÓN ${latest?.fecha || "SIN PARTIDOS"}`
          }
        />
        {tab === "Portada" ? (
          <>
            {cover ? (
              <>
                <div className="paper-kicker">LA GRAN NOTICIA</div>
                <h2 className="cover-headline">{cover.headline}</h2>
                <div className="paper-score">
                  VERDE{" "}
                  <b>
                    {latest.golesVerde} – {latest.golesBlanco}
                  </b>{" "}
                  BLANCO
                </div>
                <Byline />
                <p>{cover.body}</p>
                <h3>La fecha y el campeonato</h3>
                {stories.map((s, i) => (
                  <Story
                    key={s.category + s.headline}
                    story={s}
                    players={players}
                    profiles={profiles}
                    index={i}
                  />
                ))}
              </>
            ) : (
              <p>El diario se estrena con el primer partido finalizado.</p>
            )}
          </>
        ) : tab === "Vestuario" ? (
          <>
            <h2>El micrófono del potrero</h2>
            <Byline />
            <p>
              Después de cada partido, sus protagonistas pueden responder desde
              Reportajes. Las declaraciones salen el domingo a las 11, hora
              argentina.
            </p>
            {club?.open.some((m) => club.own[m.id] === null) && (
              <button onClick={onReport}>Dar mi reportaje</button>
            )}
            {published.length ? (
              <PublishedInterviews
                id={published[0][0]}
                meta={published[0][1]}
                players={players}
                profiles={profiles}
              />
            ) : (
              <p>
                Las entrevistas todavía están en preparación. El domingo se abre
                el vestuario.
              </p>
            )}
          </>
        ) : (
          <>
            <h2>El potrero del domingo</h2>
            <p>
              Una semana de fútbol, para leer con el mate. Edición disponible
              desde las 11, hora argentina.
            </p>
            <Byline />
            {!weekly.length ? (
              <p>Esta edición no tiene partidos en su semana.</p>
            ) : (
              <>
                <h3>
                  {weekly.length} partidos ·{" "}
                  {weekly.reduce(
                    (n, m) => n + (m.golesVerde || 0) + (m.golesBlanco || 0),
                    0,
                  )}{" "}
                  goles
                </h3>
                <p>
                  La semana dejó{" "}
                  {weekly.filter((m) => m.golesVerde > m.golesBlanco).length}{" "}
                  victorias del Verde,{" "}
                  {weekly.filter((m) => m.golesBlanco > m.golesVerde).length}{" "}
                  del Blanco y{" "}
                  {weekly.filter((m) => m.golesVerde === m.golesBlanco).length}{" "}
                  empates.
                </p>
              </>
            )}
            {sundayStories.map((s, i) => (
              <Story
                key={s.category + s.headline}
                story={s}
                players={players}
                profiles={profiles}
                index={i}
              />
            ))}
            {published
              .filter(
                ([, m]) => editionWindow(m).publish === edition.publication,
              )
              .map(([id, m]) => (
                <PublishedInterviews
                  key={id}
                  id={id}
                  meta={m}
                  players={players}
                  profiles={profiles}
                />
              ))}
            <p>Próxima edición: {display(edition.next)} · 11:00</p>
          </>
        )}
        <footer>OSLAVA FC · EL FÚTBOL SE JUEGA ENTRE AMIGOS</footer>
      </section>
    </>
  );
}
