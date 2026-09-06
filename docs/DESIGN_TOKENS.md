# Tokens de diseño — FSA (modo light)

Derivado de: **Manual de Identidad Visual Fundación San Antonio** + logo FSA +
tema corporativo de los libros Excel.

## Principios (del manual)

- Tono: cercano, institucional, esperanzador, solidario.
- Estética: minimalista, carga rápida, transiciones fluidas, tipo *landing* corporativa.
- Botones con **bordes redondeados** y color de alto contraste para acciones clave.
- **Modo light** obligatorio: fondo blanco puro, texto gris oscuro.

## Paleta

| Token | HEX | Uso |
|---|---|---|
| `--fsa-navy` | `#0E2841` | Barra lateral, encabezados, texto de titulares |
| `--fsa-blue` (primary) | `#156082` | Enlaces, foco, estados activos, serie primaria de gráficos |
| `--fsa-teal` | `#3FB5AA` | Acento (logo), chips, serie secundaria |
| `--fsa-orange` (CTA) | `#E97132` | Botón "Cargar archivo", llamados a la acción |
| `--fsa-magenta` | `#C0287E` | Realces puntuales (sonrisa del logo) |
| `--fsa-green` | `#1E7B34` | Ganancias, "Grado de Inversión" |
| `--fsa-red` | `#C0392B` | Pérdidas, "Ejecutar Venta" |
| `--fsa-amber` | `#E0A100` | "Monitoreo", alertas |
| `--fsa-bg` | `#FFFFFF` | Fondo de página |
| `--fsa-surface` | `#F6F7F9` | Tarjetas, paneles |
| `--fsa-surface-2` | `#EEF1F4` | Encabezados de tabla, hover |
| `--fsa-border` | `#E2E5EA` | Bordes, divisores |
| `--fsa-text` | `#333333` | Cuerpo |
| `--fsa-text-muted` | `#6B7280` | Texto secundario, ejes |

### Semántica financiera (gráficos y badges)

| Concepto | Color |
|---|---|
| Ganancia / positivo | `--fsa-green` |
| Pérdida / negativo | `--fsa-red` |
| Valor de mercado | `--fsa-blue` |
| Costo | `--fsa-navy` (50 % opacidad) / `#8DA2B5` |
| Benchmark | `--fsa-text-muted` (línea discontinua) |
| Serie categórica (dona/barras) | `#156082 · #E97132 · #3FB5AA · #C0287E · #1E7B34 · #E0A100 · #0F9ED5 · #8DA2B5` |

## Tipografía

| Rol | Fuente | Fallback |
|---|---|---|
| Titulares (`--font-display`) | **Poppins** (600/700) | `Montserrat, system-ui, sans-serif` |
| Cuerpo (`--font-sans`) | **Open Sans** (400/500/600) | `Roboto, system-ui, sans-serif` |
| Numérico / tabular | Open Sans con `font-variant-numeric: tabular-nums` | |

Escala: `12 · 14 · 16 · 18 · 20 · 24 · 30 · 36 · 48` px. Interlineado cuerpo 1.5.

## Forma y elevación

- Radios: `--radius-sm 6px`, `--radius 10px`, `--radius-lg 16px`, botones `9999px` (pill) o `10px`.
- Sombra tarjeta: `0 1px 2px rgba(14,40,65,.06), 0 4px 16px rgba(14,40,65,.06)`.
- Espaciado base 4 px; contenedores `max-w-7xl`, gutter 24–32 px.

## Movimiento (Framer Motion)

- Entrada de secciones: `opacity 0→1`, `y 12→0`, `duration .4s`, `ease [0.22,1,0.36,1]`.
- Stagger de KPIs: `0.06s`.
- Hover de tarjetas: `y -2px`, sombra +.
- Respetar `prefers-reduced-motion`.

## Accesibilidad

- Contraste AA mínimo (texto `#333` sobre `#FFF` = 12.6:1).
- No comunicar estado solo por color: badges con texto + icono.
- Foco visible: anillo `2px` `--fsa-blue` + offset `2px`.
