# Actualizar Oslava Web · 26/10/2026

## Instalar en tu PC

1. Guardá tu `.env` actual. Esta entrega conserva el formato `REACT_APP_FIREBASE_`.
2. Descomprimí el ZIP en una carpeta nueva y copiá tu `.env` junto a `package.json`.
3. Abrí esa carpeta en VS Code y ejecutá:

```sh
npm install
npm start
```

La web sigue usando Create React App, React 18 y `react-scripts`. Puerto 3000. Ingreso Google y mails autorizados. Sin demostración ni jugadores ficticios. El tablero es una aplicación separada.

## Publicar

```sh
npm run build
```

Subí el contenido de `build` al hosting habitual. Si usás Firebase Hosting con la CLI ya configurada:

```sh
firebase deploy --only hosting
```

Este comando publica solo la web. No modifica las reglas de Firestore. El dominio HTTPS debe estar autorizado en Firebase Authentication para ingresar con Google desde el iPhone.

## Firebase y reglas

No se publicó ni modificó tu Firebase durante la preparación del ZIP.

- Torneo: usa documentos dentro de `configuracion`, que tu Android ya utiliza. No requiere una colección nueva de torneos ni cambiar los permisos del tablero.
- Reportajes: usa `configuracion/reportaje_ID` para preguntas y horarios, y `reportajes/ID/respuestas/JUGADOR` para las respuestas.
- Si los reportajes ya funcionan en tu Android con este Firebase, mantené las reglas publicadas.
- Si todavía no habilitaste reportajes, el archivo `REPORTAJES_BLOQUE.rules` contiene el mismo bloque que trajiste en Android. Se agrega dentro de `match /databases/{database}/documents`, antes del cierre general. Conservá una copia de tus reglas actuales y no borres bloques de otras funciones.
- `firestore.rules` conserva las reglas compatibles del React recibido (incluidos los permisos del tablero) y agrega ese bloque de reportajes. No se desplegó automáticamente.

No hace falta volver a cargar jugadores, partidos, torneos o entrevistas. Ambos clientes leen los mismos IDs y documentos.

## Verificación antes de compartir

Entrá con tu admin y luego con una cuenta autorizada. Revisá Torneo, Gaceta y estadísticas. Si hay un reportaje abierto de un partido que jugó la cuenta, aparecerá el aviso para responder. Las declaraciones ajenas recién se leen desde su publicación dominical, según las reglas del servidor.

La copia no incluye `node_modules`, `build` ni tu `.env` personal. Las imágenes nuevas de Android sí están incluidas.

## Corrección de inicio

El último resultado se obtiene de los partidos finalizados del historial o del partido actual finalizado, priorizando el más reciente sobre el texto antiguo de portada. La próxima fecha respeta un partido nuevo publicado; si todavía no existe, muestra el próximo sábado como fecha estimada, sin reutilizar las formaciones del partido anterior. El cálculo usa la fecha de Argentina y se actualiza mientras la web está abierta. No crea partidos ni cambia datos o reglas en Firebase.
