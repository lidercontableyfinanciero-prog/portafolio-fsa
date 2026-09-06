# Diccionario de datos

Fuente: hoja **`Base Datos`** / **`Base de Datos`** (tabla `Tabla1`, rango `A1:AO551`)
presente en ambos libros. 41 columnas útiles, ~550 filas = *snapshots* mensuales de
posiciones (dic-2025 → ago-2026).

> Las columnas `Unnamed: 41+` / `Unnamed: 52+` que aparecen al leer con pandas son
> celdas con formato pero sin datos más allá de `AO`. El ETL descarta toda columna
> cuyo encabezado sea vacío o empiece por `Unnamed` y toda columna 100 % nula.

## Mapeo columna Excel → campo

| Excel | Encabezado (ES) | Campo | Tipo | Tabla |
|---|---|---|---|---|
| A | Año del Extracto | `statement_year` | int | snapshot (PK) |
| B | Mes del Extracto | `statement_month` | str (Enero…Diciembre) | snapshot (PK) |
| C | Clasificación | `classification` | str | instrument |
| D | Tipo | `type` | str | instrument |
| E | Descripción | `description` | str | instrument |
| F | Sector | `sector` | str | instrument |
| G | Acquired Date | `acquired_date` | date | snapshot (por lote) |
| H | Cantidad | `quantity` | numeric(18,4) | snapshot |
| I | Base de Costo Total | `total_cost_basis` | numeric(18,4) | snapshot |
| J | Precio de Mercado | `market_price` | numeric(18,6) | snapshot |
| K | Valor de Mercado Estimado | `estimated_market_value` | numeric(18,4) | snapshot |
| L | Ganancia/(Pérdida) No Realizada | `unrealized_gain_loss` | numeric(18,4) | snapshot* |
| M | Interés Acumulado Estimado | `accrued_interest` | numeric(18,4) | snapshot |
| N | Ingreso Anual Estimado | `annual_income` | numeric(18,4) | snapshot |
| O | Rendimiento Actual | `current_yield` | numeric(12,6) | snapshot |
| P | Calificación Moody's | `moodys_rating` | str | instrument |
| Q | Calificación S&P | `sp_rating` | str | instrument |
| R | Tasa de Cupón | `coupon_rate` | numeric(12,6) | instrument |
| S | Fecha de Vencimiento | `maturity_date` | date | instrument |
| T | Call Date | `call_date` | date | instrument |
| U | Identificador (CUSIP/CINS) | `identifier` | str | instrument (PK) |
| V | Intereses/Dividendos Pagados | `dividends_paid` | numeric(18,4) | snapshot |
| W | Impuesto | `tax` | numeric(18,4) | snapshot |
| X–AO | *(18 columnas calculadas)* | — | — | **recalculadas en backend** |

`*` `unrealized_gain_loss` se importa pero el backend lo recalcula como
`estimated_market_value - total_cost_basis` (Mark-to-Market, según el prompt) y usa el
valor calculado como fuente de verdad. **Excepción:** para Efectivo / Money Accounts
(sin base de costo) la G/(P) es 0 — así el total del dashboard coincide con el SUMIFS
del Excel (col L = 0 para caja).

> **Lotes del mismo CUSIP.** Un extracto puede traer varias filas con el mismo
> `identifier` en el mismo mes (distinta `acquired_date`, p. ej. dos tramos de un bono).
> Cada fila es un *snapshot* independiente; la clave única es
> `(statement_year, statement_month, instrument_id, acquired_date)`. Agosto-2026:
> 63 filas / 61 CUSIP únicos → `N° Posiciones = 63` (coincide con el Excel).

## Columnas calculadas (X–AO) — se reimplementan en `app/services/valuation.py`

| Excel | Nombre | Regla |
|---|---|---|
| X | Tasa Impositiva | `tax / dividends_paid` (0 si div=0) |
| Y | Interés Causado | `Bond → total_cost_basis * coupon_rate`, si no 0 |
| Z | Rentabilidad Costo | `Renta Variable → (dividends_paid - tax) / total_cost_basis` |
| AA | Rentabilidad Valor de Mercado | `Renta Variable → (Z + unrealized_gl) / total_cost_basis` |
| AB | Valor Unidad (Costo) | `total_cost_basis / quantity` |
| AC | Valor Unidad (Mercado) | `estimated_market_value / quantity` |
| AD | Valor Objetivo | dato manual (parámetro por instrumento, opcional) |
| AE | Indicador de Venta | `AC > AD → "Objetivo Esperado" : "No alcanzado"` |
| AF | Valor Informe | `Bond → estimated_market_value + accrued_interest`, si no `estimated_market_value` |
| AG | Fecha Informe | `date(year, mes, 1)` formateada `mmm yyyy` → `report_date` |
| AH | Indicador Stop Loss | ver FINANCIAL_LOGIC §1 |
| AI | KPI Riesgo Moody's | grado de inversión si rating ≥ `Baa3` |
| AJ | KPI Riesgo S&P | grado de inversión si rating ≥ `BBB-` |
| AK | Plazo Inicial de Compra | `(maturity_date - acquired_date) / 365` |
| AL | Alerta Tiempo | `AK > 15 → "Revisar" : "OK"` |
| AM | Plazo al Vencimiento | `(hoy - acquired_date) / 360` |
| AN | Alerta Emisor | `total_cost_basis > 500000 → "Revisar" : "OK"` |
| AO | Límite de Cash | `market_value < 150000 o > 200000 → "Revision" : "OK"` |

## Dominios

- `classification`: `Money Accounts`, `Renta Fija`, `Renta Variable`
- `type`: `Cash`, `Bond`, `Equity`, `Mutual Fund`, `Alternative Investment`
- `statement_month`: nombres en español, enero=1 … diciembre=12

## Esquema relacional

```
users(id, email, hashed_password, full_name, role, is_active, created_at)

instruments(identifier PK, description, classification, type, sector,
            moodys_rating, sp_rating, coupon_rate,
            maturity_date, call_date, target_unit_value NULL,
            created_at, updated_at)

position_snapshots(id PK,
            instrument_id FK -> instruments.identifier,
            statement_year, statement_month, report_date, acquired_date,
            quantity, total_cost_basis, market_price, estimated_market_value,
            unrealized_gain_loss, accrued_interest, annual_income, current_yield,
            dividends_paid, tax,
            UNIQUE(statement_year, statement_month, instrument_id, acquired_date))

parameters(key PK, value_numeric, value_text, description)      -- límites PIF
rating_scale(id PK, fitch, sp, moodys, grade, description, scale_1_7)
sector_limits(sector PK, limit_value)

cash_flows(id PK, flow_date, amount, description, period_start, period_end)
benchmarks(id PK, period_year, period_month, composite_rate, institutional_rate)
monthly_returns(id PK, period_year, period_month, dietz_return, benchmark_return,
                created_at)
fx_scenarios(id PK, name, trm_purchase, trm_sale, trm_close, ...)  -- simulador

ingestion_logs(id PK, created_at (= fecha de subida), filename, content_sha256,
               uploaded_by_id FK -> users.id (SET NULL), uploaded_by_email,
               status ∈ {success, partial, conflict, error, dry_run},
               dry_run, replace_mode,
               total_rows, valid_rows, error_count,
               instruments_upserted, snapshots_inserted, snapshots_updated,
               snapshots_deleted, periods (JSON: ["2026-Agosto", ...]), message)
```

## Histórico de cargas y regla anti-duplicado

Cada `POST /api/etl/upload` (solo `admin`) deja una fila en `ingestion_logs`
—incluida la previsualización (`dry_run`) y los rechazos—. `GET /api/etl/history`
(solo `admin`) lo expone: fecha, archivo, usuario, estado, filas y períodos.

**Regla:** antes de escribir, el ETL calcula los períodos `(año, mes)` del archivo
y consulta cuáles ya tienen snapshots.
- Si alguno ya existe y **no** se envía `?replace=true` → **HTTP 409**, no se
  escribe nada y se registra `status = conflict`.
- Con `?replace=true` → se **borran** los snapshots de esos meses y se insertan
  los del archivo (`snapshots_deleted` queda registrado). Nunca se duplican filas.
- El `content_sha256` permite detectar la resubida del mismo archivo idéntico.
