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

## Flujo lineal: 1 · Desafíos → 2 · Problemas → 3 · Soluciones

El proceso parte por el problema, no por la solución, y la IA hace el trabajo pesado:

1. **Desafíos** (pestaña *1 · Desafíos*): el día de la apertura se ingresan los desafíos (basta el
   nombre; el texto de las bases es opcional). 🤖 *Resumir* pide a Gemini un resumen breve: de qué
   trata, qué incluye, qué queda fuera, actores clave y palabras clave (`CHALLENGE_SUMMARY`).
2. **Problemas** (pestaña *2 · Problemas*): en fases, igual que Soluciones (`PROBLEM_STAGES`):
   1. **Lluvia de problemas**: cada uno anota problemas, sin solución, y quién lo sufre. Al salir del
      campo, Gemini lo **clasifica** en el desafío que calza (`PROBLEM_CLASSIFY`; si se cambia a mano,
      ya no lo pisa). *Mandar a Ordenar* los pasa todos.
   2. **Ordenar**: 🔗 *Similitud* compara los problemas (% de similitud, si conviene fusionar o no, y
      *Fusionar* crea uno nuevo y descarta los originales). 🤖 *Priorizar* da el **primer puntaje,
      1–5** (`PROBLEM_PRIORITY`): 5 sí · 4 probable · 3 tal vez · 2 o menos no. Sin máximo: cada uno
      pasa con *Benchmark →*, o todos los ≥4 con un botón. En todas las fases los problemas se ven como tarjetas compactas (problema como título, desafío y el estado o puntaje de la fase arriba); clic para abrir y editar.
   3. **Benchmark**: delimitación (alcance, qué abordaremos, qué queda fuera, quién pagaría,
      evidencia) → *Copiar prompt* → IA investigadora → pegar informe → 🤖 matriz (`PROBLEM_BENCHMARK`).
   4. **Decisión**: 🤖 *Puntuar* da el **segundo puntaje**, con el benchmark (`PROBLEM_DECISION`):
      magnitud, alineación, alcance en Latinoamérica, oportunidad y acceso a validar, 1–5 cada uno,
      total sobre 100. El equipo elige con *Elegir ✓*.
   5. **Elegidos**: 🤖 preguntas «¿Cómo podríamos…?» y *+ Idea de solución* (pestaña 3).
   Los descartados guardan su motivo y se pueden restaurar.
3. **Soluciones** (pestaña *3 · Soluciones*), en 5 etapas:
   1. **Lluvia de ideas**: todas las soluciones, sin evaluar.
   2. **Ordenar**: 🔗 *Buscar correlaciones* da el **% de similitud** y si conviene **fusionar**; 🤖 el
      filtro eliminatorio (`AI_TRIAGE`) marca Pasa / Dudosa / No pasa; *Pasar finalistas* lleva al
      Benchmark las mejores hasta **4** (o las marcadas con *Seleccionar*).
   3. **Benchmark de la solución**: prompt → IA investigadora → informe → 🤖 **matriz de innovación**
      con el Manual de Oslo 2018: tipo (producto o proceso de negocio), grado de novedad, soluciones
      parecidas, diferenciación, ajustes, valor agregado, adaptable a Latinoamérica, TRL alcanzable
      en 28 h, riesgos y fuentes (`SOLUTION_BENCHMARK`).
   4. **Decisión**: el equipo responde 4 preguntas (sabemos construirla, a quién validar, datos,
      prototipo en 15 h → semáforo) y 🤖 Gemini puntúa 1–5 cada criterio del jurado con los puntos de
      la sede (`CRITERIA`: 30/20/20/20/10), más horas, encaje con el equipo (carreras de *Equipo*),
      escalabilidad en Latinoamérica y qué la haría ganar (`DECISION_MATRIX`). La pestaña ordena por
      puntaje; el líder elige con *Construir →*.
   5. **Construir**: 🤖 *Prellenar la ficha* (solo campos vacíos, `FICHA_PREFILL`), validación con
      personas, plan de trabajo y tareas.

El botón **❔ ¿Cómo funciona?** de las pestañas 1, 2 y 3 muestra este flujo en una pantalla. La vista
*Temas* se reemplazó por la agrupación por desafío de la pestaña 2. Las matrices piensan en Chile
(`SEDE_COUNTRY`) y en el resto de Latinoamérica: el jurado valora soluciones adaptables a la región.

Desafíos y problemas se guardan en `rally_items` con kind `setting` e ids `set:des:DS-01` y
`set:pro:P-01` (la tabla no admite otros tipos sin migración). Los resúmenes, la clasificación y la
matriz usan el modo `extraer` de la Edge Function: si la página avisa que la función es «la versión
anterior», hay que volver a pegar `supabase/functions/filtrar-idea/index.ts` en Supabase y desplegar.

## Flujo de ideas

Igual que en Fast Check: cada idea avanza de a una etapa cumpliendo los requisitos (la página muestra
qué falta). Retroceder siempre se puede.

| Etapa | Qué se completa | Requisito para avanzar |
|---|---|---|
| 1. Banco de ideas | Lluvia de ideas: idea en 1 línea, nombre, tema, beneficiario directo, responsable, notas | Idea, tema y beneficiario |
| 2. Filtro rápido (fase 1) | Capa IA (Gemini llena tipo, beneficiario, quién paga, reporte y demo) y capa equipo (sabemos construirla, a quién validarla, datos públicos, prototipo en 15 h); semáforo de factibilidad en 15 h | Tipo elegido, semáforo verde o amarillo y el filtro todo en "Sí". Rojo o un "No": descartarla |
| 3. Benchmark (fase 2) | Qué se hace en el mundo, investigado por el equipo (fuentes propias e IA gratuita con el prompt que arma la página): referentes con país, enlace y diferencia; tendencia; diferenciación; decisión | ≥2 referentes con nombre y diferencia, diferenciación escrita y decisión "Seguir" |
| 4. Ficha de idea | Campos a–k de la ficha; cada campo indica a qué criterio de la rúbrica aporta | a, b (con alcance y abordaje), c, d, e, costo inicial, quién paga, g (efecto, aceptación social, implicancias ambientales, sostenibilidad) y h (funcionamiento e implementación) |
| 5. Validación | Validaciones (entrevista, encuesta, mentor…) con hallazgo y puntaje 1–5 por criterio de la rúbrica, llevado a 100 | ≥1 validación con hallazgo y todos los criterios puntuados |
| 6. Elegida | — | — |

Según el tipo, la idea muestra su **plan de trabajo**: maqueta 3D, materiales, fabricación, precio y
prueba de usuario si es producto; flujo del servicio, modelo de ingresos, costos, análisis financiero
y mockup si es servicio (ambos si es mixto). Con un botón se pasa al tablero de Tareas con su hora
sugerida, sin duplicar. Las tarjetas muestran el tipo y el semáforo, y en Filtro y Benchmark se
ordenan de la más factible a la menos.

### Rúbrica del jurado

La sede mostró la rúbrica del video de 2 minutos: **innovación 30**, **impacto 20**, **prefactibilidad 20**
y **viabilidad técnica 20** puntos, cada uno con lo que hay que demostrar. La foto no mostraba la calidad
de la presentación: se dejó en 10 (lo que falta para 100) y hay que confirmarlo. En Validación cada
criterio se puntúa 1–5 y se lleva a sus puntos; debajo aparecen los campos de la idea que lo respaldan
(✓ completo, ✗ falta). Las tarjetas muestran el puntaje como ★ 86/100. Puntos, descripciones y campos se
editan en `CRITERIA` de `js/lineamientos.js`.

Las ideas que no siguen se **descartan** con un motivo (no se borran) y se pueden restaurar. Solo
desde *Descartadas* se pueden eliminar definitivamente. La página también avisa si una idea es de
reciclaje (ya ganaron Hojabeta y The Last Resort), si faltan fuentes APA o si hay más de una idea elegida.

Temas, preguntas del filtro y del semáforo, horas de trabajo (`WORK_HOURS`), planes por tipo, criterios, motivos de descarte, tareas, checklists y bloques del pitch se
editan en `js/lineamientos.js`.

## Filtro rápido con IA (Gemini)

El proceso es: **Banco** (lluvia de ideas, sin evaluar) → *Mandar al Filtro* → **Filtro rápido** en dos
capas → **Benchmark** solo con las que pasan.

1. **Capa IA.** *Evaluar con Gemini* revisa una por una las ideas del Filtro que son nuevas o cambiaron.
   Gemini responde solo lo que se deduce del texto (tipo, beneficiario específico, problema claro, quién
   paga, qué mostrar en el video, si cabe en el reporte) y **llena esos campos del filtro**, marcados
   con 🤖. El equipo puede corregirlos; lo que el equipo respondió o corrigió no se pisa al volver a
   evaluar, y "sin datos" queda vacío para que lo responda el equipo. La página calcula el veredicto
   con una regla fija: un "no" en una pregunta clave = **No pasa**; un "sin datos" u otro "no" =
   **Dudosa**; el resto **Pasa**. *Descartar «No pasa»* las descarta de una vez con el motivo de la
   pregunta que falló (quedan en *Descartadas* y se pueden restaurar).
2. **Capa equipo.** El equipo responde solo lo que la IA no puede saber (si saben construirla, a quién
   validarla, si hay datos públicos, si se prototipa en 15 h). Con eso sale el semáforo.

Las preguntas de Gemini, sus reglas, qué campo llenan y el motivo de descarte se editan en `AI_TRIAGE`
dentro de `js/lineamientos.js`.

La evaluación en lote sigue aunque una idea falle (se reintenta al volver a apretar) y se detiene tras
3 fallos seguidos. El botón muestra el avance, el tiempo y una estimación de lo que falta. Con Google
normal, 20 ideas toman ~3 min; con Google saturado, ~10 min.

**Modo de prueba:** abre la página con `?prueba` al final de la dirección
(`…/Rally-de-innovacion/?prueba`). En *Banco* aparecen *+ Datos de prueba* (4 desafíos, 8 problemas y 19
ideas marcadas `[PRUEBA]`; algunos problemas mal planteados y algunas soluciones que no atacan su
problema, a propósito) y *Borrar datos de prueba*, para probar los dos puntos de IA con Gemini real.

La clave de Gemini nunca va en la página: la llamada pasa por la Edge Function
`supabase/functions/filtrar-idea`, que solo responde a usuarios con sesión.

1. Saca una API key gratuita en [Google AI Studio](https://aistudio.google.com/apikey).
2. En Supabase: **Edge Functions → Deploy a new function → Via Editor**, nombre `filtrar-idea`, pega
   el contenido de `supabase/functions/filtrar-idea/index.ts` y despliega (deja *Verify JWT* activado).
   La página llama a la función por su dirección (el final de su URL, `…/functions/v1/<dirección>`),
   que puede no coincidir con el nombre visible: ponla en `AI_TRIAGE.FUNCTION` de `js/lineamientos.js`
   (hoy `rapid-action`).
3. **Edge Functions → Secrets**: agrega `GEMINI_API_KEY` con tu clave. Nada más: la función detecta
   sola los modelos Gemini disponibles para la clave y los ordena (flash, luego lite, luego pro; la
   versión más nueva primero). Si uno está saturado, sin cuota o falla, usa el siguiente; la cuota
   gratuita es por modelo. Opcional: `GEMINI_MODELS`, modelos preferidos separados por comas, que se
   prueban antes que los detectados. Si todos fallan, la página reintenta tras 5, 15 y 30 s.

En el nivel gratuito Google limita las consultas por minuto (la página espera 6 s entre ideas,
`DELAY_MS`) y puede usar lo enviado para mejorar sus modelos. En modo local el botón queda deshabilitado.

## Correlaciones entre ideas

Solo en **Ficha de idea** hay dos botones que usan la misma Edge Function
(`mode: 'correlacionar'`, una sola consulta a Gemini por búsqueda):

- **🔗 Buscar correlaciones**: manda todas las ideas de la etapa abierta. Gemini devuelve grupos de
  ideas duplicadas, complementarias, del mismo problema o del mismo beneficiario, y para cada grupo
  una idea combinada (título, beneficiario, problema, descripción y por qué juntas son más fuertes).
- **🔗 Correlacionar N** (en *☑ Seleccionar*): solo las ideas marcadas que están en Ficha, a voluntad.

Las propuestas aparecen en un panel; **nada se crea solo**. *Crear bloque combinado* agrega una idea
nueva en la misma etapa con lo de las originales: el problema (si es el mismo), los campos de la
ficha (si discrepan, cada versión con su id para editarla), las respuestas del filtro y del semáforo
en que todas coinciden, todos los referentes del benchmark y las validaciones. La decisión del
benchmark y la evaluación con Gemini quedan pendientes para el bloque nuevo. Las ideas originales no
se modifican; el bloque muestra 🔗 con sus ids. El panel vive en el navegador de quien buscó hasta
recargar.

**Al actualizar desde una versión anterior hay que volver a desplegar la función**: pegar de nuevo
`supabase/functions/filtrar-idea/index.ts` en la función de Supabase (la de dirección `rapid-action`)
y desplegar. El filtro sigue funcionando igual.

## Benchmark con IA investigadora

El benchmark no usa la API: cada integrante usa el modo investigador de su IA (Claude, ChatGPT, Gemini,
Perplexity). En la ventana de la idea: (1) *Copiar prompt de investigación*; (2) pegar la respuesta de
cada IA; (3) *Copiar prompt para depurar*, que junta todas las respuestas para depurarlas en Claude o
ChatGPT Pro, pegar el resultado e *Importar referentes*. Los prompts piden terminar con un bloque
`REFERENTES` (`Nombre | País | Enlace | Qué hace | Diferencia`) que la página lee; lo marcado
"(verificar)" queda marcado en el nombre.

## Estructura

```
index.html            Página principal
css/styles.css        Diseño (claro y oscuro)
js/config.js          URL y publishable key de Supabase
js/lineamientos.js    Contenido base: temas, tareas, checklists, pitch, requisitos
js/supabase.js        Cliente mínimo de la API REST de Supabase (el mismo de Fast Check)
js/app.js             Datos, sincronización, edición en línea y utilidades
js/desafios.js        Desafíos y problemas (punto 1 de IA)
js/correlaciones.js   Correlaciones entre ideas y bloques combinados
js/ideas.js           Flujo de ideas y su ventana de edición
js/vistas.js          Inicio, Preparación, Equipo, Temas, Tareas, Pitch, Entrega y Bitácora
js/main.js            Inicio de sesión y arranque
supabase/schema.sql   Tabla rally_items + políticas RLS
supabase/functions/filtrar-idea/index.ts   Edge Function del primer filtro con Gemini
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
