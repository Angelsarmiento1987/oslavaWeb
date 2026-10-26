import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import App, { Profile } from "./App.jsx";
import HomeMatchCards from "./HomeMatchCards.jsx";
import { homeSchedule } from "./homeSchedule.js";
import { MenuItems } from "./MenuIcon.jsx";
import { InterviewForm } from "./ClubFeatures.jsx";
import Statistics from "./Statistics.jsx";
import { Newspaper } from "./Newspaper.jsx";
import { updateDoc, doc, setDoc } from "firebase/firestore";
jest.mock("./firebase.js", () => ({ auth: null, db: null, configured: false }));
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  doc: jest.fn(() => ({})),
  updateDoc: jest.fn(),
  setDoc: jest.fn(),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container, root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  window.scrollTo = jest.fn();
  updateDoc.mockReset();
  setDoc.mockReset();
  localStorage.clear();
  doc.mockReturnValue({});
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
function button(text) {
  return [...container.querySelectorAll("button")].find(
    (b) => b.textContent === text,
  );
}
test("home shows the recorded result and October 31 without old formations or stale cover text", () => {
  const schedule = homeSchedule(
    [],
    {
      id: "played",
      fecha: "2026-10-24",
      hora: "17:00",
      estado: "finalizado",
      golesVerde: 4,
      golesBlanco: 2,
    },
    new Date("2026-10-26T21:00:00Z"),
  );
  act(() =>
    root.render(
      <HomeMatchCards
        schedule={schedule}
        ready
        legacyResult="Texto viejo"
        onOpen={jest.fn()}
      />,
    ),
  );
  expect(container.textContent).toContain("Verde 4 - 2 Blanco");
  expect(container.textContent).toContain("2026-10-31 · 17:00 hs");
  expect(container.textContent).toContain("Formaciones pendientes");
  expect(container.textContent).not.toMatch(
    /Texto viejo|Todavía no se publicó/,
  );
  expect(button("Ver formaciones →")).toBeUndefined();
});
test("home formations button opens the published upcoming fixture", () => {
  const open = jest.fn();
  const schedule = homeSchedule(
    [],
    { id: "next", fecha: "2026-10-31", hora: "18:00", estado: "programado" },
    new Date("2026-10-26T21:00:00Z"),
  );
  act(() =>
    root.render(<HomeMatchCards schedule={schedule} ready onOpen={open} />),
  );
  act(() => button("Ver formaciones →").click());
  expect(open).toHaveBeenCalledTimes(1);
  expect(container.textContent).not.toContain("Fecha estimada");
});
test("final login has no demo entry or developer configuration instructions", () => {
  act(() => root.render(<App />));
  expect(container.textContent).toContain("Servicio no disponible");
  expect(container.textContent).not.toMatch(
    /explorar|demostración|\.env|README/i,
  );
  expect(container.querySelector("main")).toBeNull();
});
test("profile keeps focus and confirms success only after Firestore resolves", async () => {
  let resolve;
  updateDoc.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  act(() =>
    root.render(
      <Profile
        profile={{ apodo: "Ángel" }}
        uid="u"
        act={jest.fn()}
        logout={jest.fn()}
      />,
    ),
  );
  const input = container.querySelector('input[maxlength="50"]');
  input.focus();
  for (const value of ["A", "An", "Ang", "Angel de prueba"])
    act(() => Simulate.change(input, { target: { value } }));
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe("Angel de prueba");
  act(() => button("Guardar mis datos").click());
  expect(button("Guardando…").disabled).toBe(true);
  expect(container.textContent).not.toContain("Datos guardados correctamente");
  await act(async () => resolve());
  expect(container.textContent).toContain("Datos guardados correctamente");
  expect(updateDoc).toHaveBeenCalledWith(
    {},
    { apodo: "Angel de prueba", fechaNacimiento: "" },
  );
});
test("failed save displays Firestore error instead of success", async () => {
  updateDoc.mockRejectedValue(new Error("Permiso denegado"));
  act(() =>
    root.render(
      <Profile
        profile={{ apodo: "Ángel" }}
        uid="u"
        act={jest.fn()}
        logout={jest.fn()}
      />,
    ),
  );
  await act(async () => button("Guardar mis datos").click());
  expect(container.textContent).toContain("Error al guardar: Permiso denegado");
  expect(container.textContent).not.toContain("Datos guardados correctamente");
});
test("menu icons keep readable accessible labels and route on click", () => {
  const go = jest.fn(),
    entries = [
      "Inicio",
      "Próximo partido",
      "Partido en vivo",
      "Historial",
      "Jugadores y estadísticas",
      "Vitrina de trofeos",
      "Equipos del mes",
      "La Gaceta",
      "PRODE",
      "Oslava TV",
      "Mi perfil",
      "Administración",
      "Mails autorizados",
      "Plantel",
      "Crear partido",
      "Torneo",
      "Reportajes",
    ];
  act(() =>
    root.render(<MenuItems entries={entries} page="Inicio" onNavigate={go} />),
  );
  const buttons = [...container.querySelectorAll("button")];
  expect(buttons).toHaveLength(entries.length);
  buttons.forEach((b, i) => {
    expect(b.textContent).toContain(entries[i]);
    expect(b.querySelector("svg").getAttribute("aria-hidden")).toBe("true");
    expect(b.querySelector("svg").children.length).toBeGreaterThan(0);
  });
  expect(buttons[0].getAttribute("aria-current")).toBe("page");
  act(() => buttons[7].click());
  expect(go).toHaveBeenCalledWith("La Gaceta");
});
test("newspaper displays actual history-derived headline and illustration", () => {
  const p = { id: "a", nombre: "Jugador real" },
    q = { id: "b", nombre: "Rival" },
    m = {
      id: "m",
      estado: "finalizado",
      fecha: "2026-10-24",
      verde: [p],
      blanco: [q],
      golesVerde: 1,
      golesBlanco: 0,
      eventosGol: [{ jugadorId: "a" }],
    };
  act(() => root.render(<Newspaper players={[p, q]} history={[m]} />));
  expect(container.textContent).toContain("Jugador real manda en la tabla");
  expect(
    [...container.querySelectorAll("img")].some((im) =>
      im.getAttribute("src").includes("gaceta_artillero.png"),
    ),
  ).toBe(true);
});
function reportMeta() {
  const now = Date.now();
  return {
    id: "m",
    partidoId: "m",
    fecha: "2026-10-26",
    ventanaVersion: 2,
    aperturaEn: now - 3600000,
    cierreEn: now + 3600000,
    publicacionEn: now + 7200000,
    participantes: {
      p: {
        nombre: "Protagonista",
        equipo: "verde",
        preguntaResultado: "¿Qué opinión te dejó el resultado?",
        preguntaEstadistica: "¿Qué destacás de tu aporte?",
      },
    },
  };
}
test("interview keeps drafts, requires review and confirms only after server save", async () => {
  let resolve;
  setDoc.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  act(() =>
    root.render(
      <InterviewForm
        meta={reportMeta()}
        playerId="p"
        uid="u"
        already={null}
        now={Date.now()}
        go={jest.fn()}
      />,
    ),
  );
  const change = (label, value) =>
    act(() =>
      Simulate.change(
        container.querySelector(`textarea[aria-label="${label}"]`),
        { target: { value } },
      ),
    );
  change("Respuesta sobre el resultado", "Buen partido");
  act(() => button("Continuar").click());
  change("Respuesta sobre tus estadísticas", "Ayudé al equipo");
  expect(JSON.parse(localStorage.getItem("oslava-reportaje:u:m"))).toEqual({
    first: "Buen partido",
    second: "Ayudé al equipo",
  });
  act(() => button("Revisar reportaje").click());
  expect(setDoc).not.toHaveBeenCalled();
  act(() => button("Publicar reportaje").click());
  expect(button("Guardando…").disabled).toBe(true);
  expect(container.textContent).not.toContain("Muchas gracias");
  await act(async () => resolve());
  expect(container.textContent).toContain("Muchas gracias por tu tiempo.");
  expect(localStorage.getItem("oslava-reportaje:u:m")).toBeNull();
  expect(setDoc.mock.calls[0][1]).toEqual(
    expect.objectContaining({
      partidoId: "m",
      jugadorId: "p",
      usuarioUid: "u",
      estado: "respondio",
      respuestaResultado: "Buen partido",
      respuestaEstadistica: "Ayudé al equipo",
    }),
  );
});
test("interview decline requires confirmation and saves no invented answers", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  setDoc.mockResolvedValue();
  act(() =>
    root.render(
      <InterviewForm
        meta={reportMeta()}
        playerId="p"
        uid="u"
        already={null}
        now={Date.now()}
        go={jest.fn()}
      />,
    ),
  );
  act(() => button("Prefiero no declarar").click());
  expect(setDoc).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  await act(async () => button("Prefiero no declarar").click());
  expect(setDoc.mock.calls[0][1]).toEqual(
    expect.objectContaining({
      estado: "declino",
      respuestaResultado: "",
      respuestaEstadistica: "",
    }),
  );
  confirm.mockRestore();
});
test("statistics search and sorting use actual player history", () => {
  const a = { id: "a", nombre: "Ángel" },
    b = { id: "b", nombre: "Nico" },
    m = {
      id: "m",
      verde: [a],
      blanco: [b],
      golesVerde: 0,
      golesBlanco: 1,
      eventosGol: [{ jugadorId: "b" }],
    };
  const Avatar = () => null;
  act(() =>
    root.render(
      <Statistics
        players={[a, b]}
        history={[m]}
        profiles={{}}
        Avatar={Avatar}
      />,
    ),
  );
  act(() => button("Goles").click());
  expect(container.querySelector(".player-stat h2").textContent).toBe("Nico");
  const field = container.querySelector('input[type="search"]');
  act(() => Simulate.change(field, { target: { value: "Án" } }));
  expect(container.querySelectorAll(".player-stat")).toHaveLength(1);
  expect(container.querySelector(".player-stat h2").textContent).toBe("Ángel");
});
