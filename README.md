# Oslava FC · Web 3.0 · React con Create React App

Actualización basada en tus archivos `OslavaReact(1).zip` y `OslavaModerna(20261026-205545).zip`.

Usa React 18 y `react-scripts` 5. Sin Vite. Primero leé **ACTUALIZAR.md** para conservar tu `.env` y publicar la web.

## Cambios incorporados desde Android

### Torneo Oslava

- Diez fechas, clasificación individual: 3 puntos por victoria, 1 por empate, 0 por derrota o ausencia. Desempate por goles del campeonato.
- Los empates de puntos y goles en los cortes 5/6 o 10/11 requieren ordenar el grupo desde la cuenta administradora.
- Al completarse diez resultados con diez participantes distintos y cortes resueltos, se preparan puestos 1–5 contra 6–10 para la final.
- El administrador acuerda y publica la fecha/hora de esa final desde Crear partido. Se conservan sus diez clasificados; permite ordenar posiciones y elegir quién ataja.
- La final empatada queda pendiente sin copas. Un resultado ganador entrega la copa a los cinco integrantes del equipo por igual y cierra el campeonato.
- El admin inicia el siguiente torneo. Se conservan ediciones, resultados y copas anteriores. La final no se agrega a la clasificación del siguiente.
- Se mantiene la importación inicial del Campeonato 1 que trae Android: incorpora una sola vez resultados existentes entre 24 y 26/10/2026, excluyendo los asignados a otro torneo. Se actualiza el índice, sin duplicar partidos ni borrar historial.
- Las publicaciones y eliminaciones usan transacciones. No se puede reiniciar un partido en vivo/finalizado ni eliminar una final preparada. Eliminar una fecha programada libera su lugar del torneo.

### Reportajes

- Invitación únicamente a integrantes del partido cuya cuenta esté vinculada a su ficha del plantel.
- Dos preguntas: resultado y aporte individual, con preguntas específicas para arqueros, goleadores y registros incompletos.
- Borrador local por cuenta/partido, hasta 700 caracteres por respuesta, pasos para responder y revisar antes de publicar.
- “Prefiero no declarar” requiere confirmación y guarda esa decisión. Cerrar la página sin elegirlo conserva el borrador.
- El mensaje de confirmación se muestra después de que Firestore acepta la escritura. No se declara éxito por una escritura local pendiente.
- Mismos campos y subcolecciones que Android. Una decisión no se modifica después de guardada, según las reglas compartidas.
- Ventana versión 2 anclada al partido: abre al finalizar, cierra como máximo 23 h 59 min después y, en todo caso, antes de las 10:59 del domingo de publicación. Publicación a las 11, hora argentina. Respeta las fechas almacenadas por Android.

### La Gaceta

- Portada con crónica del último resultado, marcador y El Cronista del Potrero.
- Noticias individuales para goleadores (incluidos los que perdieron), arqueros y equipo ganador; tabla histórica, sociedades, ausencias, regresos y sequías.
- Noticias del torneo: punta, corte de clasificación, preparación de la final y campeones.
- No se afirma una sequía o un partido sin convertir cuando falta asignar parte de los goles del marcador. Los minutos solo se mencionan cuando existen y son válidos; se distinguen cronologías parciales y completas.
- Retratos del protagonista cuando hay foto, ilustraciones originales de Android y tratamiento visual de periódico.
- Vestuario con las entrevistas publicadas. El suplemento Domingo usa la semana y los resultados disponibles al corte de las 11 de ese domingo, sin anticipar partidos futuros.

### Otras mejoras

- Copa “Campeón del torneo” en las vitrinas, con evidencia por campeonato.
- Estadísticas con búsqueda, orden por nombre/goles/victorias y tarjetas de jugador.
- En Crear partido puede atajar cualquier integrante, sin exigir el rol de arquero del plantel. Se conserva ese rol para las selecciones mensuales.
- Intercambio de posiciones tocando dos jugadores del mismo equipo y compartir la formación como PNG.
- Íconos para las secciones nuevas. Se mantienen Google, autorización por correo, perfil, fotos, 66 avatares, historial, prode mensual, Oslava TV, PWA y el inicio definitivo sin exploración.

## Datos compartidos

Se reutilizan `usuarios`, `mails_autorizados`, `jugadores`, `partidos/proximo`, `historial`, `prode`, `prode_rankings` y `configuracion`.

Torneos: `configuracion/torneos_indice` y `configuracion/torneo_ID`. Reportajes: metadatos en `configuracion/reportaje_ID` y respuestas en `reportajes/ID/respuestas/JUGADOR`.

La web no es un backend nuevo ni exige migrar jugadores. La sincronización de admin replica las transiciones que realiza Android: preparar finales, cerrar torneos y habilitar preguntas. No ejecutamos esas acciones contra tu cuenta durante este trabajo.

## Reglas

Las reglas pertenecen a la base compartida: afectan a Android, web y tablero. Esta entrega conserva el archivo del React recibido y añade el bloque de reportajes del Android recibido. No reemplaza por un esquema que quite el rol tablero.

Si esos permisos de reportajes ya están publicados, no hay que volver a cambiarlos por usar React. Si falta el bloque, integralo conservando las reglas actuales. No se publicaron reglas durante la actualización.

El prode mantiene la consulta de apuestas propias y el ranking mensual publicado. Al enviar un pronóstico ya no se intenta leer previamente un documento inexistente: el servidor impide reemplazar una apuesta mediante su prohibición de actualizaciones. Esto evita exigir una lectura adicional para el primer pronóstico con las reglas originales de Android.

## Estructura y pruebas

- `src/App.jsx`: aplicación, acceso, perfil, plantel, vitrinas y editor de partidos.
- `src/competition.js` y `competitionService.js`: cálculos y transacciones del campeonato, horarios de reportajes.
- `src/ClubFeatures.jsx`: Torneo, Reportajes y sincronización compartida.
- `src/Newspaper.jsx`, `newsDomain.js`, `matchAnalysis.js`: periódico, redacción y precisión de datos.
- `src/Statistics.jsx`: búsqueda y tarjetas estadísticas.

```sh
npm install
npm start
npm run test:logic
npm test -- --watchAll=false --runInBand
npm run build
```

Node.js 22.12 o posterior. Se conserva `.env.example`. Para publicar hay que compilar con tu configuración WEB de Firebase, manteniendo los prefijos `REACT_APP_FIREBASE_`. No usar el appId Android.

## Validación y límites

35 pruebas de lógica y 16 de interfaz/transacciones simuladas: clasificación, cortes empatados, equipos de final, copas, horario argentino, ventanas de reportajes, precisión de goles/minutos, borradores, confirmación de guardado, búsqueda y protección de partidos en curso. Compilación de producción con Create React App.

Las transacciones de pruebas usan un almacén simulado y no sustituyen el emulador de seguridad de Firebase. No se verificaron las reglas en ese emulador, una sesión real de Google/Firestore ni Safari en un iPhone. Probá con tu Firebase antes de compartir la actualización.

La PWA guarda la interfaz visitada; los datos vivos, las publicaciones y el envío de reportajes requieren internet. El calendario de entrevistas y del suplemento no depende de cuándo instaló la app cada usuario.
