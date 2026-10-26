import React from "react";
const paths = {
  Torneo: (
    <>
      <path d="M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v5m-4 3h8" />
    </>
  ),
  Reportajes: (
    <>
      <rect x="9" y="2" width="6" height="13" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" />
    </>
  ),
  Inicio: (
    <>
      <path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" />
    </>
  ),
  "Próximo partido": (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 11h18m-13 5h3" />
    </>
  ),
  "Partido en vivo": (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M6.3 6.3a8 8 0 0 0 0 11.4m11.4-11.4a8 8 0 0 1 0 11.4M3.5 3.5a12 12 0 0 0 0 17m17-17a12 12 0 0 1 0 17" />
    </>
  ),
  Historial: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  "Jugadores y estadísticas": (
    <>
      <path d="M4 20V10m8 10V4m8 16v-7M2 21h20" />
    </>
  ),
  "Vitrina de trofeos": (
    <>
      <path d="M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v5m-4 3h8m-8-3h8v3H8Z" />
    </>
  ),
  "Equipos del mes": (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 12h18m-9-9v18" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "La Gaceta": (
    <>
      <path d="M5 3h16v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7h2Zm0 0v16m4-12h8m-8 4h8m-8 4h3m3 0h2" />
    </>
  ),
  PRODE: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="m8 9 2 2 5-5m-7 10h3m3 0h2" />
    </>
  ),
  "Oslava TV": (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="m10 9 5 3-5 3Zm-3 13h10" />
    </>
  ),
  "Mi perfil": (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  Administración: (
    <>
      <path d="m12 2 2 3 3 .3 1 3 3 1-.5 3 1 3-3 2-1 3-3-.3-2.5 2-2.5-2-3 .3-1-3-3-2 1-3-.5-3 3-1 1-3 3-.3Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "Mails autorizados": (
    <>
      <rect x="2" y="4" width="20" height="15" rx="2" />
      <path d="m2 6 10 7L22 6m-8 14 2 2 5-5" />
    </>
  ),
  Plantel: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 21v-3a7 7 0 0 1 14 0v3m1-16a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5v2" />
    </>
  ),
  "Crear partido": (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4m-5 6v6m-3-3h6" />
    </>
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  cerrar: <path d="m6 6 12 12M6 18 18 6" />,
};
export default function MenuIcon({ name, size = 22 }) {
  return (
    <svg
      className="menu-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name] || paths["Inicio"]}
    </svg>
  );
}
export function MenuItems({ entries, page, onNavigate }) {
  return entries.map((name) => (
    <button
      key={name}
      className={`menu-item ${page === name ? "" : "secondary"}`}
      aria-current={page === name ? "page" : undefined}
      onClick={() => onNavigate(name)}
    >
      <MenuIcon name={name} />
      <span>{name}</span>
      <span className="menu-chevron" aria-hidden="true">
        ›
      </span>
    </button>
  ));
}
