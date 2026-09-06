# Sistema de diseño — Portafolio FSA (resultado UI/UX Pro Max)

Búsqueda: `financial portfolio analytics dashboard nonprofit` · densidad alta · movimiento bajo.

## Dirección visual

**Estilo:** `Data-Dense Dashboard` + `Minimalism & Swiss Style` + `Accessible & Ethical`.
Cuadrícula de 12 columnas, jerarquía tipográfica clara, sin ornamento; bordes
redondeados suaves (concesión del manual de marca FSA sobre el 0px de Swiss).

**Tipografía:** pairing *Modern Professional* → **Poppins** (títulos 500/600/700) +
**Open Sans** (cuerpo 400/600). Números con `tabular-nums`.

**Tokens de densidad (dashboard):**
`--grid-gap: 8px · --card-padding: 16px · --font-size-small: 12px ·
--table-row-height: 38px · --sidebar-width: 240px · --header-height: 60px`

## Paleta (light) — ver `DESIGN_TOKENS.md`

Navy `#0E2841` · Azul `#156082` · Teal `#3FB5AA` · Naranja CTA `#E97132` ·
Verde `#1E7B34` · Rojo `#C0392B` · Ámbar `#E0A100`.
Fondo `#FFFFFF` · superficie `#F6F7F9` · borde `#E2E5EA` · texto `#333333`.

## Mapa de gráficas (Recharts) — guía charts.csv

| Panel | Tipo | Reglas |
|---|---|---|
| Composición por Clasificación | **Donut** | ≤6 segmentos, mayor a las 12 h, etiqueta con %, tabla de respaldo |
| Valor de Mercado por Tipo | **Barras verticales** | orden descendente, etiqueta de valor |
| Exposición por Sector | **Barras horizontales** | >15 categorías → orden desc, scroll |
| Evolución Valor vs Costo | **Línea** | 2 series, costo en trazo discontinuo, etiquetas directas |
| G/(P) No Realizada por Mes | **Barras +/−** | verde/rojo **+ signo + icono** (no solo color) |
| Rentabilidad vs Benchmark (TWR) | **Línea** | benchmark discontinuo, banda de referencia |

**Accesibilidad de datos:** nunca comunicar estado solo por color — badges con
texto+icono; cada gráfica tiene su tabla/serie numérica accesible; foco revela
tooltip; `prefers-reduced-motion` respetado.

## Layout

- **Shell** tipo landing corporativa: barra superior fija (logo FSA + periodo +
  usuario), barra lateral de navegación (Dashboard · Rentabilidad · Escenarios ·
  Simulador FX · Datos), contenido `max-w-[1400px]`.
- **SlicerBar** pegajosa bajo el header: Año · Mes · Tipo de activo · Calificación
  (Moody's/S&P). Cambia estado → refetch (SWR) → todas las gráficas y tablas.
- **Control de acceso:** `RoleGate` oculta la carga de CSV y la sección Datos/carga
  a los usuarios `lector`.
- **KPI cards:** fila de 8, `--card-padding 16px`, número grande tabular, delta
  coloreado con icono ▲/▼, subtítulo de contexto.

## Interacción / movimiento (bajo)

- Entrada de secciones: `opacity/y` 300–400 ms `ease-out`, stagger 60 ms en KPIs.
- Hover de fila de tabla: fondo `--fsa-surface-2`, 120 ms.
- Sin animar `width/height`; usar `transform`.
- Foco visible 3 px `--fsa-blue`; objetivos táctiles ≥ 44 px; `:focus-visible`.
