import React from "react";

export default function HomeMatchCards({
  schedule,
  ready,
  legacyResult,
  onOpen,
}) {
  return (
    <>
      <section className="card">
        <span className="eyebrow">ÚLTIMO RESULTADO</span>
        <h2>
          {schedule.result ||
            (!ready
              ? "Cargando resultado…"
              : legacyResult || "Todavía no se publicó un resultado")}
        </h2>
      </section>
      <section className="card">
        <span className="eyebrow">LA PRÓXIMA FECHA</span>
        <h2>
          {schedule.fecha} · {schedule.hora} hs
        </h2>
        {schedule.upcoming ? (
          <button onClick={onOpen}>Ver formaciones →</button>
        ) : (
          <p>Fecha estimada · Formaciones pendientes de publicación.</p>
        )}
      </section>
    </>
  );
}
