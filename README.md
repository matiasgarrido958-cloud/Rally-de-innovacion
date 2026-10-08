# Rally de Innovación 2026 — Workspace del equipo

Workspace colaborativo del equipo para el **Rally Latinoamericano de Innovación 2026** (sede UDLA, Santiago).
Los datos se guardan en **Supabase** y se sincronizan entre integrantes cada 3 segundos.

Usa la misma base que *Fast Check INNEXA — Workspace*: sitio estático (HTML + CSS + JS, sin dependencias
ni build), API REST de Supabase con RLS, una cuenta compartida del equipo y un flujo por etapas que
muestra qué falta para avanzar.

**Fechas clave (hora Chile):** apertura 16/10 ~12:00 (H0) · cierre de entregables 17/10 16:00 (H28) ·
nada se sube después de H27.

## Secciones

| Sección | Qué tiene |
|---|---|
| **Inicio** | Cuenta regresiva a H0 y luego la H actual, la etapa en curso, un resumen y las próximas tareas. Línea de tiempo de las 28 h. Ajustes: nombre del equipo y hora H0. |
| **Preparación** | Decisiones iniciales D1–D5 (se pueden agregar más), requisitos obligatorios y pendientes antes del 16/10. |
| **Equipo** | Integrantes, carrera, tipo (estudiante / graduado / docente), ingeniería, mujer, líder, roles, disponibilidad e inscripción. Los **requisitos de las bases se calculan solos** (4–10 integrantes, ≥1 estudiante de ingeniería, ≥1 mujer, máx. 1 graduado y 1 docente, líder estudiante, todos inscritos). |
| **Ideas** | Flujo por etapas (ver abajo), con ID automático I-01, I-02… |
| **Temas** | Tablero por temas: las ideas agrupadas por tema, con observaciones para detectar duplicados o combinaciones. |
| **Tareas** | T-01…T-12 con responsable, estado y hora límite en H; la hora Chile se calcula desde H0 y se marcan las vencidas o las que vencen en menos de 2 h. |
| **Pitch** | Guion de 2 minutos en 5 bloques. Cuenta palabras y estima la duración de cada bloque (150 palabras/min, ajustable). |
| **Entrega** | Checklist de la hora 27, enlaces de YouTube, TikTok y PDF, duraciones (alerta si el video pasa de 2:00 o el TikTok de 1:00) y **revisión cruzada**: quien revisa el checklist no puede ser quien cierra el video. Firma del checklist (T-11). |
| **Bitácora** | Reuniones: fecha, participantes, decisiones y tareas nuevas. |

Las casillas de los checklists guardan quién las marcó y cuándo. Como la cuenta es compartida,
cada persona escribe su nombre con el botón de usuario (arriba a la derecha) y ese navegador lo recuerda.

## Flujo de ideas

Igual que en Fast Check: cada idea avanza de a una etapa cumpliendo los requisitos (la página muestra
qué falta). Retroceder siempre se puede.

| Etapa | Qué se completa | Requisito para avanzar |
|---|---|---|
| 1. Banco de ideas | Idea en 1 línea, nombre, tema, beneficiario directo, responsable, notas | Idea, tema y beneficiario |
| 2. Filtro rápido | Las 4 preguntas del filtro (beneficiario, prototipo a tiempo, factibilidad económica, cabe en el reporte) | Todas en "Sí". Si alguna es "No", hay que descartarla |
| 3. Ficha de idea | Campos a–k de la ficha | a, b, c, d, e, costo inicial, quién paga, g y h |
| 4. Validación | Validaciones (entrevista, encuesta, mentor…) con hallazgo y puntaje 1–5 en los criterios del jurado | ≥1 validación con hallazgo y todos los criterios puntuados |
| 5. Elegida | — | — |

Las ideas que no siguen se **descartan** con un motivo (no se borran) y se pueden restaurar. Solo
desde *Descartadas* se pueden eliminar definitivamente. La página también avisa si una idea es de
reciclaje (ya ganaron Hojabeta y The Last Resort), si faltan fuentes APA o si hay más de una idea elegida.

Temas, preguntas del filtro, criterios, motivos de descarte, tareas, checklists y bloques del pitch se
editan en `js/lineamientos.js`.

## Estructura

```
index.html            Página principal
css/styles.css        Diseño (claro y oscuro)
js/config.js          URL y publishable key de Supabase
js/lineamientos.js    Contenido base: temas, tareas, checklists, pitch, requisitos
js/supabase.js        Cliente mínimo de la API REST de Supabase (el mismo de Fast Check)
js/app.js             Datos, sincronización, edición en línea y utilidades
js/ideas.js           Flujo de ideas y su ventana de edición
js/vistas.js          Inicio, Preparación, Equipo, Temas, Tareas, Pitch, Entrega y Bitácora
js/main.js            Inicio de sesión y arranque
supabase/schema.sql   Tabla rally_items + políticas RLS
```

Al cambiar CSS o JS, actualiza el número `?v=` de los `<link>`/`<script>` en `index.html`
para que los navegadores no mezclen archivos nuevos con versiones en caché.

### Datos: una sola tabla

A diferencia de Fast Check (una columna por campo), aquí todo va en la tabla `rally_items`:
cada fila es un elemento (`idea`, `task`, `member`, `decision`, `meeting`, `check` o `setting`) y sus
campos van en la columna `data` (jsonb). Así se pueden agregar campos durante el Rally sin migraciones,
y la sincronización es una sola consulta. Si dos personas editan el mismo elemento a la vez, queda el
último cambio guardado (igual que en Fast Check).

La primera vez que alguien entra con la tabla vacía, la página carga las tareas T-01…T-12, las
decisiones D1–D5 y los roles del equipo.

## Probar sin Supabase

Con `SUPABASE_URL: ''` en `js/config.js` la página funciona en **modo local**: no pide contraseña y
guarda todo solo en ese navegador. Sirve para probarla antes de configurar Supabase.

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Configurar Supabase

1. Crea un proyecto en Supabase (o usa el mismo de Fast Check: la tabla tiene otro nombre).
2. En **SQL Editor** ejecuta `supabase/schema.sql`.
3. En **Project Settings → API Keys** copia la URL y la *publishable key* y ponlas en `js/config.js`.
   Nunca uses la *secret key* (service_role) en el frontend.

### Inicio de sesión

El equipo comparte una sola cuenta y la página solo pide la contraseña
(el correo está fijo en `TEAM_EMAIL` dentro de `js/config.js`):

1. **Authentication → Users → Add user → Create new user**: correo `equipo@rally-udla.com`,
   la contraseña del equipo (mínimo 6 caracteres) y *Auto Confirm User* marcado.
2. **Authentication → Sign In / Providers → Email**: desactiva *Allow new users to sign up*.

Para usar cuentas individuales, deja `TEAM_EMAIL: ''` y la página pedirá correo y contraseña.
Las políticas RLS solo permiten leer y escribir a usuarios con sesión, así que sin sesión la API no
entrega nada aunque alguien tenga la publishable key.

## Publicar en GitHub Pages

1. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
2. Elige la rama `main` y la carpeta `/ (root)`, y guarda.
3. En un par de minutos el sitio queda en `https://<usuario>.github.io/Rally-de-innovacion/`.
   Cada push a `main` lo actualiza.
