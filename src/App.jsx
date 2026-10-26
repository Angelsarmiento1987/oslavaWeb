import React, { useState, useEffect, useRef } from "react";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { auth, db, configured } from "./firebase.js";
import {
  team,
  events,
  available,
  formation,
  stats,
  scorers,
  awards,
  label,
  winner,
} from "./domain.js";
import "./style.css";
import { clubs } from "./clubs.js";
import { useClub, Tournament, Reports } from "./ClubFeatures.jsx";
import { Newspaper } from "./Newspaper.jsx";
import Statistics from "./Statistics.jsx";
import HomeMatchCards from "./HomeMatchCards.jsx";
import { homeSchedule } from "./homeSchedule.js";
import { finalTeams, tournamentAwards } from "./competition.js";
import { publishMatch, deleteMatch } from "./competitionService.js";
import MenuIcon, { MenuItems } from "./MenuIcon.jsx";
import { shareFormation } from "./shareFormation.js";
import { MonthlyTeams, AuthorizedMails, ProdeUpdated } from "./Updated.jsx";
const asset = (n) => `${process.env.PUBLIC_URL || ""}/assets/${n}.png`;
function Avatar({ p = {}, profiles = {}, size = 44 }) {
  const profile = profiles[p.usuarioUid] || p;
  const photo = profile.fotoData || profile.fotoUrl || p.fotoUrl;
  const code = profile.avatar || p.emoji || "AV01";
  const src = photo
    ? photo.startsWith("http") || photo.startsWith("data:")
      ? photo
      : `data:image/jpeg;base64,${photo}`
    : /^AV\d{2}$/.test(code)
      ? asset(`oslava_avatar_${code.slice(2)}`)
      : code.startsWith("CLUB:") && clubs.includes(code.slice(5))
        ? asset(
            `oslava_escudo_${String(clubs.indexOf(code.slice(5)) + 1).padStart(2, "0")}`,
          )
        : "";
  return src ? (
    <img
      className="avatar"
      width={size}
      height={size}
      src={src}
      alt={p.nombre || "Avatar"}
      referrerPolicy="no-referrer"
    />
  ) : (
    <span className="avatar" style={{ fontSize: size / 2 }}>
      {code}
    </span>
  );
}
function Pitch({ m, profiles, onPlayer, players = [] }) {
  return (
    <div className="pitch">
      <div className="circle" />
      <div className="midline" />
      <div className="area top" />
      <div className="area bottom" />
      {["verde", "blanco"].flatMap((t) =>
        formation(
          [...team(m?.[t])].sort(
            (a, b) =>
              Number(
                b.id ===
                  m?.[t === "verde" ? "arqueroVerdeId" : "arqueroBlancoId"],
              ) -
              Number(
                a.id ===
                  m?.[t === "verde" ? "arqueroVerdeId" : "arqueroBlancoId"],
              ),
          ),
          t === "verde",
        ).map((p) => (
          <button
            key={p.id}
            className={`field-player ${t}`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            onClick={() => onPlayer?.(p, t)}
            disabled={!onPlayer}
          >
            <span className="shirt">{t === "verde" ? "" : "◢"}</span>
            <Avatar
              p={{
                ...p,
                usuarioUid:
                  players.find((x) => x.id === p.id)?.usuarioUid ||
                  p.usuarioUid ||
                  "",
              }}
              profiles={profiles}
              size={27}
            />
            <small>
              {players.find((x) => x.id === p.id)?.nombre || p.nombre}
            </small>
          </button>
        )),
      )}
    </div>
  );
}
function Score({ m }) {
  return (
    <div className="score">
      <span>VERDE</span>
      <strong>
        {m?.golesVerde || 0} <i>:</i> {m?.golesBlanco || 0}
      </strong>
      <span>BLANCO</span>
    </div>
  );
}
function Field({ label, ...props }) {
  return (
    <label className="field">
      {label}
      <input {...props} />
    </label>
  );
}
export default function App() {
  const [user, U] = useState(null),
    [ready, R] = useState(!configured),
    [profiles, P] = useState({}),
    [roster, S] = useState([]),
    [match, M] = useState(null),
    [home, H] = useState({}),
    [history, Y] = useState([]),
    [historyReady, HR] = useState(false),
    [page, G] = useState("Inicio"),
    [menu, D] = useState(false),
    [error, E] = useState(""),
    [busy, B] = useState(false),
    [access, AX] = useState("checking");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const schedule = homeSchedule(history, match, now);
  const profile = profiles[user?.uid] || {},
    admin = profile.rol === "admin",
    players = available(roster, profiles);
  const club = useClub({
    enabled: !!user && access === "granted",
    user,
    admin,
    history,
    current: match,
    players,
    roster,
    historyReady,
  });
  const fail = (e) => E(e?.message || String(e));
  const act = async (fn, msg) => {
    B(true);
    try {
      await fn();
      if (msg) E(msg);
    } catch (e) {
      fail(e);
    } finally {
      B(false);
    }
  };
  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(auth, (u) => {
      U(u);
      AX("checking");
      P({});
      S([]);
      M(null);
      H({});
      Y([]);
      HR(false);
      G("Inicio");
      R(true);
    });
  }, []);
  useEffect(() => {
    if (!user) return;
    let stopped = false,
      own = null,
      ownReady = false,
      permit = false,
      permitReady = false,
      creating = false;
    AX("checking");
    const evaluate = async () => {
      if (stopped) return;
      const allowed = own?.rol === "admin" || (permitReady && permit);
      if (!allowed) {
        if (ownReady && permitReady) {
          AX("denied");
          P({});
          S([]);
          M(null);
          H({});
          Y([]);
        }
        return;
      }
      if (!ownReady) return;
      if (!own && !creating) {
        creating = true;
        try {
          await runTransaction(db, async (tx) => {
            const ref = doc(db, "usuarios", user.uid),
              snap = await tx.get(ref);
            if (!snap.exists())
              tx.set(ref, {
                email: user.email || "",
                apodo: user.displayName || "Jugador",
                rol: "jugador",
              });
          });
        } catch (e) {
          if (!stopped) {
            AX("denied");
            fail(e);
          }
        }
        return;
      }
      if (own) AX("granted");
    };
    const unsubOwn = onSnapshot(
      doc(db, "usuarios", user.uid),
      (snap) => {
        own = snap.data() || null;
        ownReady = true;
        evaluate();
      },
      (e) => {
        if (!stopped) {
          AX("denied");
          fail(e);
        }
      },
    );
    const email = (user.email || "").trim().toLowerCase();
    const unsubPermit = email
      ? onSnapshot(
          doc(db, "mails_autorizados", email),
          (snap) => {
            permit = snap.data()?.activo === true;
            permitReady = true;
            evaluate();
          },
          (e) => {
            permitReady = true;
            permit = false;
            evaluate();
            if (!stopped && own?.rol !== "admin") fail(e);
          },
        )
      : () => {};
    if (!email) {
      permitReady = true;
      evaluate();
    }
    return () => {
      stopped = true;
      unsubOwn();
      unsubPermit();
    };
  }, [user?.uid]);
  useEffect(() => {
    if (!user || access !== "granted") return;
    const unsub = [
      onSnapshot(
        collection(db, "usuarios"),
        (s) => P(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))),
        fail,
      ),
      onSnapshot(
        collection(db, "jugadores"),
        (s) => S(s.docs.map((d) => ({ ...d.data(), id: d.id }))),
        fail,
      ),
      onSnapshot(
        doc(db, "partidos", "proximo"),
        (s) => M(s.exists() ? s.data() : null),
        fail,
      ),
      onSnapshot(
        doc(db, "configuracion", "portada"),
        (s) => H(s.data() || {}),
        fail,
      ),
      onSnapshot(
        collection(db, "historial"),
        (s) => {
          Y(s.docs.map((d) => ({ ...d.data(), id: d.id })));
          HR(true);
        },
        fail,
      ),
    ];
    return () => unsub.forEach((f) => f());
  }, [user?.uid, access]);
  const go = (p) => {
    G(p);
    D(false);
    window.scrollTo({ top: 0 });
  };
  if (!ready)
    return (
      <div className="login">
        <img src={asset("oslava_escudo")} alt="Oslava FC" />
        <p>Cargando el club…</p>
      </div>
    );
  if (!user)
    return (
      <div className="login">
        <div className="eyebrow">BIENVENIDO AL CLUB</div>
        <img src={asset("oslava_escudo")} alt="Escudo Oslava FC" />
        <h1>OSLAVA FC</h1>
        <p className="gold">EL POTRERO TIENE SU APP</p>
        <h2>Viví cada partido desde adentro.</h2>
        <p>
          Formaciones, resultados, estadísticas y toda la historia del club.
        </p>
        {configured ? (
          <button
            disabled={busy}
            onClick={() =>
              act(() => signInWithPopup(auth, new GoogleAuthProvider()))
            }
          >
            Continuar con Google
          </button>
        ) : (
          <div className="card">
            <b>Servicio no disponible</b>
            <p>No pudimos conectar con el club. Intentá de nuevo más tarde.</p>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <small>En iPhone: Safari → Compartir → Agregar a inicio.</small>
      </div>
    );
  if (access !== "granted")
    return (
      <div className="login">
        <img src={asset("oslava_escudo")} alt="Oslava FC" />
        <h1>
          {access === "checking" ? "Verificando acceso…" : "Acceso pendiente"}
        </h1>
        <p>{user.email}</p>
        <p>
          {access === "checking"
            ? "Estamos comprobando tu autorización."
            : "Tu correo debe estar autorizado por un administrador de Oslava FC."}
        </p>
        {error && <p role="alert">{error}</p>}
        <button className="secondary" onClick={() => act(() => signOut(auth))}>
          Cerrar sesión
        </button>
      </div>
    );
  const nav = [
    "Inicio",
    "Próximo partido",
    "Partido en vivo",
    "Historial",
    "Jugadores y estadísticas",
    "Vitrina de trofeos",
    "Equipos del mes",
    "Torneo",
    ...(club.open.some((m) => club.own[m.id] === null) ? ["Reportajes"] : []),
    "La Gaceta",
    "PRODE",
    "Oslava TV",
    "Mi perfil",
    ...(admin
      ? ["Administración", "Mails autorizados", "Plantel", "Crear partido"]
      : []),
  ];
  return (
    <>
      <header>
        <button
          className="icon"
          aria-label={menu ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menu}
          aria-controls="club-menu"
          onClick={() => D(!menu)}
        >
          <MenuIcon name={menu ? "cerrar" : "menu"} />
        </button>
        <img src={asset("oslava_escudo")} alt="" />
        <div>
          <b>OSLAVA FC</b>
          <small>EL POTRERO TIENE SU APP</small>
        </div>
        <button className="profile" onClick={() => go("Mi perfil")}>
          <Avatar p={profile} size={34} />
        </button>
      </header>
      {menu && (
        <aside id="club-menu" aria-label="Menú del club">
          <h2>Hola, {profile.apodo || user.displayName}</h2>
          <MenuItems entries={nav} page={page} onNavigate={go} />
        </aside>
      )}
      <main>
        {club.error && <p role="alert">{club.error}</p>}
        {page === "Inicio" &&
          club.open.some((m) => club.own[m.id] === null) && (
            <button
              className="interview-invite"
              onClick={() => go("Reportajes")}
            >
              El Cronista del Potrero quiere escucharte · Dar mi reportaje →
            </button>
          )}
        <div className="eyebrow">● {page.toUpperCase()}</div>
        {page === "Inicio" && (
          <>
            <section className="hero">
              <div className="eyebrow">SOMOS EQUIPO. SOMOS OSLAVA.</div>
              <h1>
                El potrero
                <br />
                <em>se vive acá.</em>
              </h1>
              <p>
                Hola, {profile.apodo || user.displayName || "Jugador"}.
                Bienvenido al club.
              </p>
              <img src={asset("oslava_escudo")} alt="" />
            </section>
            <HomeMatchCards
              schedule={schedule}
              ready={historyReady}
              legacyResult={home.ultimoResultado}
              onOpen={() => go("Próximo partido")}
            />
            <div className="tiles">
              {[
                "Partido en vivo",
                "Vitrina de trofeos",
                "Jugadores y estadísticas",
                "PRODE",
              ].map((n) => (
                <button
                  className="card secondary"
                  key={n}
                  onClick={() => go(n)}
                >
                  {n} ↗
                </button>
              ))}
            </div>
          </>
        )}
        {page === "Inicio" && (
          <>
            <button className="secondary" onClick={() => go("Equipos del mes")}>
              Equipos del mes →
            </button>
            <Newspaper
              players={players}
              history={history}
              current={match}
              profiles={profiles}
              club={club}
              preview
              onOpen={() => go("La Gaceta")}
            />
          </>
        )}
        {["Próximo partido", "Partido en vivo"].includes(page) &&
          ((page === "Partido en vivo" ? match : schedule.upcoming) ? (
            <>
              <h1>
                {page === "Partido en vivo"
                  ? "El partido en vivo"
                  : "La próxima fecha"}
              </h1>
              <p>
                {match.fecha} · {match.hora} hs · {match.estado}
              </p>
              <Score m={match} />
              <Pitch m={match} profiles={profiles} players={players} />
              <button
                onClick={() =>
                  act(() => shareFormation(match, players, profiles))
                }
              >
                Compartir formación
              </button>
              {events(match).map((e) => (
                <p key={e.id}>
                  ⚽ {e.minuto}′ · {e.jugador} ({e.equipo})
                </p>
              ))}
            </>
          ) : (
            <section className="card">
              <h1>La próxima fecha</h1>
              <h2>
                {schedule.fecha} · {schedule.hora} hs
              </h2>
              <p>Fecha estimada · Formaciones pendientes de publicación.</p>
            </section>
          ))}
        {page === "Historial" && (
          <>
            <h1>Historia del potrero</h1>
            {!history.length && <p>Todavía no hay partidos finalizados.</p>}
            {[...history]
              .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
              .map((m) => (
                <details className="card" key={m.id}>
                  <summary>{label(m)}</summary>
                  <p>
                    {winner(m) === "empate" ? "Empate" : `Ganó ${winner(m)}`}
                  </p>
                  <Pitch m={m} profiles={profiles} players={players} />
                  {events(m).map((e, i) => (
                    <p key={e.id || i}>
                      {e.minuto}′ · {e.jugador} ({e.equipo})
                    </p>
                  ))}
                </details>
              ))}
          </>
        )}
        {page === "Jugadores y estadísticas" && (
          <Statistics
            players={players}
            history={history}
            profiles={profiles}
            Avatar={Avatar}
          />
        )}
        {page === "Vitrina de trofeos" && (
          <Trophies
            players={players}
            profiles={profiles}
            history={history}
            uid={user.uid}
            club={club}
            current={match}
          />
        )}
        {page === "PRODE" && (
          <ProdeUpdated
            match={match}
            history={history}
            profiles={profiles}
            uid={user.uid}
            admin={admin}
            act={act}
          />
        )}
        {page === "Equipos del mes" && (
          <MonthlyTeams
            players={players}
            history={history}
            profiles={profiles}
            Pitch={Pitch}
          />
        )}
        {page === "La Gaceta" && (
          <Newspaper
            players={players}
            history={history}
            current={match}
            profiles={profiles}
            club={club}
            onReport={() => go("Reportajes")}
          />
        )}
        {page === "Torneo" && (
          <Tournament
            club={club}
            history={history}
            current={match}
            players={players}
            profiles={profiles}
            admin={admin}
            act={act}
            go={go}
            Pitch={Pitch}
          />
        )}
        {page === "Reportajes" && (
          <Reports club={club} roster={roster} uid={user.uid} go={go} />
        )}
        {admin && page === "Mails autorizados" && <AuthorizedMails act={act} />}
        {page === "Oslava TV" && (
          <>
            <h1>Reviví el partido</h1>
            <p>Beelup · Container Ramos Mejía · Cancha 1</p>
            <a
              className="button"
              href={tvUrl()}
              target="_blank"
              rel="noreferrer"
            >
              ▶ Abrir Beelup
            </a>
          </>
        )}
        {page === "Mi perfil" && (
          <Profile
            key={user.uid}
            profile={profile}
            uid={user.uid}
            act={act}
            logout={() => act(() => signOut(auth))}
          />
        )}
        {admin && page === "Administración" && (
          <>
            <h1>Centro de control</h1>
            {[
              "Plantel",
              "Crear partido",
              "Mails autorizados",
              "Torneo",
              "Historial",
            ].map((n) => (
              <button key={n} onClick={() => go(n)}>
                <MenuIcon name={n} /> {n} →
              </button>
            ))}
          </>
        )}
        {admin && page === "Plantel" && (
          <Roster
            players={players}
            roster={roster}
            profiles={profiles}
            act={act}
          />
        )}
        {admin && page === "Crear partido" && (
          <MatchEditor
            key={club.docs[club.activeId]?.finalId || match?.id || "new"}
            match={match}
            players={players}
            profiles={profiles}
            act={act}
            go={go}
            club={club}
            history={history}
          />
        )}
      </main>
      {error && (
        <div className="toast" role="status">
          {error}
          <button
            className="icon"
            aria-label="Cerrar aviso"
            onClick={() => E("")}
          >
            ×
          </button>
        </div>
      )}
      <nav>
        {["Inicio", "Próximo partido", "PRODE", "Oslava TV"].map((n) => (
          <button
            className={page === n ? "active" : ""}
            aria-current={page === n ? "page" : undefined}
            onClick={() => go(n)}
            key={n}
          >
            <MenuIcon name={n} size={24} />
            <span className="nav-label">
              {n === "Próximo partido"
                ? "Partidos"
                : n === "Oslava TV"
                  ? "TV"
                  : n}
            </span>
          </button>
        ))}
      </nav>
      {busy && (
        <div className="saving" role="status">
          Guardando…
        </div>
      )}
    </>
  );
}
function tvUrl() {
  const d = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
    }),
  );
  const back = (d.getDay() + 1) % 7;
  d.setDate(d.getDate() - (back === 0 && d.getHours() < 17 ? 7 : back));
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `https://beelup.com/ar/?complejo=CONTAINER%20RAMOS%20MEJIA&cancha=container01&fecha=${date}&hora=17%3A00`;
}
function Trophies({ players, profiles, history, uid, club, current }) {
  const [selected, S] = useState(""),
    [award, A] = useState(null);
  const mine = players.find((p) => p.usuarioUid === uid);
  const player = players.find((p) => p.id === selected) || mine;
  const list = awards(player?.id || "", players, history);
  list[1].evidence = history
    .filter((m) => player?.id && scorers(m).includes(player.id))
    .map(
      (m) =>
        `${m.fecha} · Marcó ${events(m).filter((e) => e.jugadorId === player.id).length} goles · ${scorers(m).length > 1 ? "Goleador compartido" : "Goleador del partido"}`,
    );
  list.splice(3, 0, {
    name: "Campeón del torneo",
    image: "torneo_limpio",
    description:
      "Se desbloquea para los cinco integrantes del equipo que gana la final del Torneo Oslava.",
    evidence: tournamentAwards(player?.id, club?.docs || {}, history, current),
  });
  return (
    <>
      <h1>
        {selected
          ? "Vitrina de " + (player?.nombre || "jugador")
          : "Mi vitrina"}
      </h1>
      <p>Los premios del club, partido a partido.</p>
      <select
        aria-label="Elegir vitrina"
        value={selected}
        onChange={(e) => {
          S(e.target.value);
          A(null);
        }}
      >
        <option value="">Mi vitrina</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
      {!player && (
        <p>
          El administrador debe vincular tu cuenta con un jugador del plantel.
        </p>
      )}
      <div className="cabinet">
        <h2>✦ {player?.nombre || "OSLAVA FC"} ✦</h2>
        <div className="awards">
          {list.map((a) => (
            <button
              className={`award ${a.evidence.length ? "" : "locked"}`}
              key={a.image}
              onClick={() => A(a)}
            >
              <img src={asset(`trofeo_${a.image}`)} alt={a.name} />
              <b>{a.name}</b>
              <small>
                {a.evidence.length
                  ? "×" + a.evidence.length
                  : "POR DESBLOQUEAR"}
              </small>
            </button>
          ))}
        </div>
        <small>TOCÁ UN TROFEO PARA VER SUS DETALLES</small>
      </div>
      <h2>Vitrinas de otros jugadores</h2>
      {players
        .filter((p) => p.id !== mine?.id)
        .map((p) => (
          <button
            className="row secondary"
            key={p.id}
            onClick={() => {
              S(p.id);
              window.scrollTo({ top: 0 });
            }}
          >
            <Avatar p={p} profiles={profiles} />
            {p.nombre}
            <span>→</span>
          </button>
        ))}
      <p>
        Los premios por período consideran el último mes, semestre y año
        cerrados, igual que en Android. Los empates comparten premio.
      </p>
      {award && (
        <div className="modal-back" onClick={() => A(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={award.name}
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{award.name}</h2>
            <img src={asset(`trofeo_${award.image}`)} alt="" />
            <b>
              {award.evidence.length ? "DESBLOQUEADO" : "TODAVÍA BLOQUEADO"}
            </b>
            <p>{award.description}</p>
            {award.evidence.length > 0 && (
              <>
                <h3>Cómo lo consiguió {player?.nombre}</h3>
                {award.evidence.map((e, i) => (
                  <p key={i}>• {e}</p>
                ))}
              </>
            )}
            <button autoFocus onClick={() => A(null)}>
              Cerrar
            </button>
          </section>
        </div>
      )}
    </>
  );
}
export function Profile({ profile, uid, act, logout }) {
  const [name, N] = useState(profile.apodo || ""),
    [birth, B] = useState(
      (profile.fechaNacimiento || "").split("-").reverse().join("-"),
    );
  const [savingProfile, SP] = useState(false),
    [feedback, FB] = useState("");
  const loaded = useRef(false),
    dirty = useRef(false);
  useEffect(() => {
    if (!loaded.current && profile.apodo !== undefined && !dirty.current) {
      N(profile.apodo || "");
      B((profile.fechaNacimiento || "").split("-").reverse().join("-"));
      loaded.current = true;
    }
  }, [profile.apodo, profile.fechaNacimiento]);
  const save = async (data) => {
    await updateDoc(doc(db, "usuarios", uid), data);
  };
  const photo = async (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const side = Math.min(image.width, image.height);
      canvas
        .getContext("2d")
        .drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          128,
          128,
        );
      let data;
      for (const quality of [0.75, 0.6, 0.45, 0.3]) {
        data = canvas.toDataURL("image/jpeg", quality).split(",")[1];
        if (data.length <= 35000) break;
      }
      if (data.length > 35000) throw Error("No se pudo reducir la imagen.");
      await save({ fotoData: data, fotoUrl: "" });
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  return (
    <>
      <h1>Mi perfil</h1>
      <Avatar p={profile} size={100} />
      <Field
        label="Nombre visible"
        value={name}
        maxLength={50}
        onChange={(e) => {
          dirty.current = true;
          N(e.target.value);
          FB("");
        }}
      />
      <Field
        label="Fecha de nacimiento (opcional)"
        type="date"
        value={birth}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => {
          dirty.current = true;
          B(e.target.value);
          FB("");
        }}
      />
      <button
        disabled={savingProfile}
        onClick={async () => {
          SP(true);
          FB("");
          try {
            if (!name.trim()) throw Error("Escribí un nombre visible.");
            if (name.trim().length > 50)
              throw Error("El nombre es demasiado largo.");
            if (
              birth &&
              (!Number.isFinite(new Date(birth).getTime()) ||
                new Date(birth) > new Date())
            )
              throw Error("Fecha no válida.");
            await save({
              apodo: name.trim(),
              fechaNacimiento: birth
                ? birth.split("-").reverse().join("-")
                : "",
            });
            dirty.current = false;
            FB("✓ Datos guardados correctamente");
          } catch (e) {
            FB("Error al guardar: " + e.message);
          } finally {
            SP(false);
          }
        }}
      >
        {savingProfile ? "Guardando…" : "Guardar mis datos"}
      </button>
      {feedback && <p role="status">{feedback}</p>}
      <label className="button secondary">
        Subir foto
        <input
          className="file"
          type="file"
          accept="image/*"
          onChange={(e) => act(() => photo(e.target.files[0]), "Foto guardada")}
        />
      </label>
      <h2>Elegí tu camiseta</h2>
      <div className="avatar-grid">
        {Array.from(
          { length: 66 },
          (_, i) => `AV${String(i + 1).padStart(2, "0")}`,
        ).map((a) => (
          <button
            className={profile.avatar === a ? "selected" : ""}
            key={a}
            aria-label={`Elegir avatar ${a}`}
            onClick={() =>
              act(
                () => save({ avatar: a, fotoData: "", fotoUrl: "" }),
                "Avatar guardado",
              )
            }
          >
            <Avatar p={{ avatar: a }} size={64} />
          </button>
        ))}
      </div>
      <button className="secondary" onClick={logout}>
        Cerrar sesión
      </button>
    </>
  );
}
function Roster({ players, roster, profiles, act }) {
  const [name, N] = useState(""),
    [avatar, A] = useState("AV01");
  const link = async (p, uid) => {
    if (uid && roster.some((x) => x.id !== p.id && x.usuarioUid === uid))
      throw Error("Esa cuenta ya está vinculada a otro jugador.");
    await updateDoc(doc(db, "jugadores", p.id), { usuarioUid: uid });
  };
  return (
    <>
      <h1>Plantel Oslava FC</h1>
      <p>Cargá a todos, aunque todavía no tengan cuenta.</p>
      <Field
        label="Nombre y apellido"
        value={name}
        maxLength={50}
        onChange={(e) => N(e.target.value)}
      />
      <label>
        Avatar
        <select value={avatar} onChange={(e) => A(e.target.value)}>
          {Array.from(
            { length: 66 },
            (_, i) => `AV${String(i + 1).padStart(2, "0")}`,
          ).map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <Avatar p={{ avatar }} />
      <button
        onClick={() =>
          act(async () => {
            if (!name.trim()) throw Error("Escribí un nombre.");
            if (
              roster.some(
                (p) =>
                  p.nombre.trim().toLowerCase() === name.trim().toLowerCase(),
              )
            )
              throw Error(
                "Ya existe un jugador con ese nombre. Vinculá su ficha existente.",
              );
            await addDoc(collection(db, "jugadores"), {
              nombre: name.trim(),
              emoji: avatar,
              fotoUrl: "",
              usuarioUid: "",
              arquero: false,
            });
            N("");
          }, "Jugador agregado")
        }
      >
        Agregar jugador
      </button>
      <details className="card">
        <summary>Cuentas registradas para vincular</summary>
        {Object.entries(profiles)
          .filter(([uid]) => !roster.some((p) => p.usuarioUid === uid))
          .map(([uid, u]) => (
            <p key={uid}>
              {u.apodo || "Jugador"} · {u.email} — elegí su cuenta en una ficha
              existente o creá su ficha con «Agregar jugador».
            </p>
          ))}
      </details>
      {roster.filter((p) => p.usuarioUid).length >
        new Set(roster.map((p) => p.usuarioUid).filter(Boolean)).size && (
        <p role="alert">
          Hay fichas duplicadas vinculadas a una misma cuenta. Se muestra una
          sola; el historial no se borra.
        </p>
      )}
      {players.map((p) => (
        <section className="card" key={p.id}>
          <div className="row">
            <Avatar p={p} profiles={profiles} />
            <b>{p.nombre}</b>
          </div>
          <label className="keeper-toggle">
            <input
              type="checkbox"
              checked={!!p.arquero}
              onChange={(e) =>
                act(
                  () =>
                    updateDoc(doc(db, "jugadores", p.id), {
                      arquero: e.target.checked,
                    }),
                  "Puesto actualizado",
                )
              }
            />{" "}
            Habilitado como arquero
          </label>
          {p.id.startsWith("user_") && !roster.some((r) => r.id === p.id) ? (
            <button
              className="secondary"
              onClick={() =>
                act(
                  () =>
                    setDoc(doc(db, "jugadores", p.id), {
                      nombre: p.nombre,
                      emoji: p.emoji || "AV01",
                      fotoUrl: "",
                      usuarioUid: p.usuarioUid,
                    }),
                  "Incorporado al plantel",
                )
              }
            >
              Incorporar al plantel permanente
            </button>
          ) : (
            <>
              <label>
                Cuenta vinculada
                <select
                  value={p.usuarioUid || ""}
                  onChange={(e) =>
                    act(
                      () => link(p, e.target.value),
                      "Vinculación actualizada",
                    )
                  }
                >
                  <option value="">Sin vincular</option>
                  {Object.entries(profiles).map(([uid, u]) => (
                    <option key={uid} value={uid}>
                      {u.apodo || u.email || uid}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="danger secondary"
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Eliminar a ${p.nombre} del plantel y del partido vigente? El historial se conserva.`,
                    )
                  )
                    act(async () => {
                      await runTransaction(db, async (tx) => {
                        const ref = doc(db, "partidos", "proximo"),
                          s = await tx.get(ref);
                        if (s.exists())
                          tx.update(ref, {
                            verde: team(s.data().verde).filter(
                              (x) => x.id !== p.id,
                            ),
                            blanco: team(s.data().blanco).filter(
                              (x) => x.id !== p.id,
                            ),
                          });
                        tx.delete(doc(db, "jugadores", p.id));
                      });
                    }, "Jugador eliminado");
                }}
              >
                Eliminar jugador
              </button>
            </>
          )}
        </section>
      ))}
    </>
  );
}
function MatchEditor({ match, players, profiles, act, go, club, history }) {
  const tournament = club.docs[club.activeId] || {},
    finalMode = !!tournament.finalId && tournament.estado !== "cerrado",
    prepared = finalMode ? finalTeams(tournament, history, match) : match || {},
    sameMatch = !finalMode || match?.id === tournament.finalId;
  const [date, D] = useState(sameMatch ? match?.fecha || "" : ""),
    [time, T] = useState(sameMatch ? match?.hora || "17:00" : "17:00"),
    [green, G] = useState(team(prepared.verde)),
    [white, W] = useState(team(prepared.blanco)),
    [side, S] = useState("verde"),
    [kg, KG] = useState(
      sameMatch
        ? match?.arqueroVerdeId || team(prepared.verde)[0]?.id || ""
        : team(prepared.verde)[0]?.id || "",
    ),
    [kw, KW] = useState(
      sameMatch
        ? match?.arqueroBlancoId || team(prepared.blanco)[0]?.id || ""
        : team(prepared.blanco)[0]?.id || "",
    ),
    [selected, SEL] = useState(null),
    [feedback, FB] = useState(""),
    [saving, SV] = useState(false);
  const blocked = match && match.estado === "en vivo";
  const toggle = (p) => {
    if (finalMode) return;
    if (green.some((x) => x.id === p.id)) {
      G(green.filter((x) => x.id !== p.id));
      if (kg === p.id) KG("");
      return;
    }
    if (white.some((x) => x.id === p.id)) {
      W(white.filter((x) => x.id !== p.id));
      if (kw === p.id) KW("");
      return;
    }
    const pr = profiles[p.usuarioUid] || {},
      item = {
        id: p.id,
        nombre: p.nombre,
        emoji: pr.avatar || p.emoji || "AV01",
        fotoUrl: p.fotoUrl || "",
        usuarioUid: p.usuarioUid || "",
        x: 0.5,
        y: 0.5,
      };
    side === "verde" ? G([...green, item]) : W([...white, item]);
  };
  const m = {
    verde: green,
    blanco: white,
    fecha: date,
    hora: time,
    arqueroVerdeId: kg,
    arqueroBlancoId: kw,
  };
  const swap = (p, t) => {
    if (!selected || selected.t !== t) {
      SEL({ id: p.id, t });
      FB(`Elegiste a ${p.nombre}. Tocá otro jugador del mismo equipo.`);
      return;
    }
    const list = [...(t === "verde" ? green : white)],
      a = list.findIndex((x) => x.id === selected.id),
      b = list.findIndex((x) => x.id === p.id);
    if (a >= 0 && b >= 0) {
      [list[a], list[b]] = [list[b], list[a]];
      t === "verde" ? G(list) : W(list);
    }
    SEL(null);
    FB("Posiciones intercambiadas.");
  };
  const order = (ps, set) =>
    ps.map((p, i) => (
      <div className="row card compact" key={p.id}>
        <span>
          {p.id === kg || p.id === kw ? "🧤" : "⚽"} {p.nombre}
        </span>
        {[-1, 1].map((d) => (
          <button
            className="icon"
            key={d}
            aria-label={`${d < 0 ? "Subir" : "Bajar"} ${p.nombre}`}
            disabled={i + d < 0 || i + d >= ps.length}
            onClick={() => {
              const next = [...ps];
              [next[i], next[i + d]] = [next[i + d], next[i]];
              set(next);
            }}
          >
            {d < 0 ? "↑" : "↓"}
          </button>
        ))}
      </div>
    ));
  const publish = async () => {
    SV(true);
    try {
      await act(async () => {
        const start = new Date(`${date}T${time}:00-03:00`);
        if (
          !date ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
          !Number.isFinite(start.getTime())
        )
          throw Error("Fecha u hora inválidas.");
        if (!green.length || !white.length)
          throw Error("Asigná jugadores a ambos equipos.");
        if (!green.some((p) => p.id === kg) || !white.some((p) => p.id === kw))
          throw Error(
            "Elegí quién ataja en cada equipo. Puede ser cualquier jugador.",
          );
        if (
          !finalMode &&
          [...green, ...white].some((p) => !players.some((x) => x.id === p.id))
        )
          throw Error("Hay jugadores que ya no están en el plantel.");
        const id = finalMode
          ? tournament.finalId
          : match?.estado === "programado"
            ? match.id
            : crypto.randomUUID();
        const data = {
          id,
          fecha: date,
          hora: time,
          verde: formation(
            [...green].sort(
              (a, b) => Number(b.id === kg) - Number(a.id === kg),
            ),
            true,
          ),
          blanco: formation(
            [...white].sort(
              (a, b) => Number(b.id === kw) - Number(a.id === kw),
            ),
            false,
          ),
          estado: "programado",
          golesVerde: 0,
          golesBlanco: 0,
          eventosGol: [],
          arqueroVerdeId: kg,
          arqueroBlancoId: kw,
          inicioEn: Timestamp.fromDate(start),
        };
        await publishMatch(data, match?.id);
        go("Próximo partido");
      }, "Partido publicado para el tablero");
    } finally {
      SV(false);
    }
  };
  if (!club.ready) return <p>Cargando torneo…</p>;
  return (
    <>
      <h1>{finalMode ? "Final del torneo" : "Armar partido"}</h1>
      <p>
        Designá quién ataja en cada equipo, aunque no esté marcado como arquero
        en el plantel.{" "}
        {finalMode
          ? "Los diez clasificados y sus equipos se conservan."
          : "Elegí los jugadores y sus posiciones."}
      </p>
      {blocked && (
        <p className="banner">
          El partido está en vivo. No se puede reiniciar.
        </p>
      )}
      <Field
        label="Fecha"
        type="date"
        value={date}
        onChange={(e) => D(e.target.value)}
      />
      <Field
        label="Hora"
        type="time"
        value={time}
        onChange={(e) => T(e.target.value)}
      />
      {!finalMode && (
        <>
          <div className="row">
            <button
              className={side === "verde" ? "" : "secondary"}
              onClick={() => S("verde")}
            >
              Verde
            </button>
            <button
              className={side === "blanco" ? "" : "secondary"}
              onClick={() => S("blanco")}
            >
              Blanco
            </button>
          </div>
          {players.map((p) => (
            <button
              className="row secondary"
              key={p.id}
              onClick={() => toggle(p)}
            >
              <Avatar p={p} profiles={profiles} />
              {p.nombre}
              <span>
                {green.some((x) => x.id === p.id)
                  ? "VERDE ✓"
                  : white.some((x) => x.id === p.id)
                    ? "BLANCO ✓"
                    : "+"}
              </span>
            </button>
          ))}
        </>
      )}
      {[
        ["Verde", green, G, kg, KG],
        ["Blanco", white, W, kw, KW],
      ].map(([title, ps, set, keeper, kset]) => (
        <section key={title}>
          <h2>{title}</h2>
          <label>
            Arquero {title.toLowerCase()}
            <select value={keeper} onChange={(e) => kset(e.target.value)}>
              <option value="">Elegir quién ataja</option>
              {ps.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          {order(ps, set)}
        </section>
      ))}
      <h2>Posiciones en la cancha</h2>
      <p>Tocá un jugador y luego otro del mismo equipo para intercambiarlos.</p>
      {feedback && <p role="status">{feedback}</p>}
      <Pitch m={m} profiles={profiles} players={players} onPlayer={swap} />
      <button
        className="secondary"
        onClick={() => act(() => shareFormation(m, players, profiles))}
      >
        Compartir formación
      </button>
      <button disabled={blocked || saving} onClick={publish}>
        {saving ? "Publicando…" : "Publicar partido para todos"}
      </button>
      {!finalMode && (
        <>
          <button
            className="secondary"
            onClick={() => {
              G([]);
              W([]);
              KG("");
              KW("");
              D("");
              T("17:00");
            }}
          >
            Limpiar formulario
          </button>
          {match && (
            <button
              className="secondary danger"
              onClick={() => {
                if (
                  window.confirm(
                    "¿Eliminar el partido programado? La fecha del torneo quedará disponible.",
                  )
                )
                  act(async () => {
                    await deleteMatch(match.id);
                    go("Inicio");
                  }, "Partido eliminado");
              }}
            >
              Eliminar partido creado
            </button>
          )}
        </>
      )}
    </>
  );
}
