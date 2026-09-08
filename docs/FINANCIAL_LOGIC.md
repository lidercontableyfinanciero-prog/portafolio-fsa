# Lógica financiera

Reimplementación de las fórmulas del libro `INFORME INVERSIONES INTERNACIONALES FSA 2026`.
Todos los cálculos viven en `backend/app/services/` y están cubiertos por `pytest`
cotejando contra los valores del Excel.

## 1. Valoración por posición — `valuation.py`

### Mark-to-Market
```
unrealized_gain_loss = estimated_market_value - total_cost_basis
return_on_cost        = unrealized_gain_loss / total_cost_basis        (si costo != 0)
```

### Valor Informe (columna AF)
```
valor_informe = estimated_market_value + accrued_interest   si type == "Bond"
              = estimated_market_value                        en otro caso
```

### Indicador Stop-Loss (columna AH) — sobre `ratio = unrealized_gl / total_cost_basis`
| Condición | Estado |
|---|---|
| `unrealized_gl >= 0` | Inversión Estable / Pérdida tolerable |
| `ratio <= -0.50` | Ejecutar Venta - Previa Revisión |
| `ratio <= -0.20` | Evaluar Venta |
| `ratio <= -0.10` | Monitoreo |
| resto | Inversión Estable / Pérdida tolerable |

### KPI de riesgo crediticio (columnas AI / AJ)
Grado de Inversión si:
- Moody's ∈ {Aaa, Aa1, Aa2, Aa3, A1, A2, A3, Baa1, Baa2, Baa3}
- S&P ∈ {AAA, AA+, AA, AA-, A+, A, A-, BBB+, BBB, BBB-}

En otro caso: **Grado Especulativo** (incluye ratings faltantes / `***`).

### Plazos y alertas
```
plazo_inicial_anios   = (maturity_date - acquired_date) / 365
plazo_al_vencimiento  = (hoy - acquired_date) / 360
alerta_tiempo   = "Revisar" si plazo_inicial_anios > 15
alerta_emisor   = "Revisar" si total_cost_basis > 500_000
limite_cash     = "Revision" si market_value < 150_000 o > 200_000
                  — SOLO aplica a posiciones de tipo Cash; el resto -> "N/A".
```

### Rentabilidad de Renta Variable (columnas Z y AA)
```
rentab_costo (Z)         = (dividends_paid - tax) / total_cost_basis   (solo Renta Variable)
rentab_valor_mercado (AA)= (rentab_costo + unrealized_gain_loss) / total_cost_basis
tasa_impositiva (X)      = tax / dividends_paid   (0 si dividends_paid == 0)
```

### Límites de concentración por política (ANEXO 2 · hoja Parámetros/Resumen)
```
Renta Fija     ≤ 70 % del portafolio   (parámetro peso_max_renta_fija)
Renta Variable ≤ 30 % del portafolio   (parámetro peso_max_renta_variable)
```
El dashboard compara la participación real (valor de mercado por clasificación /
valor de mercado total) contra el límite y marca "Excede" cuando lo supera.

### Variación mes a mes
El "total del portafolio" es el **Valor Informe** (`Resumen!` "Suma de Valor Informe":
agosto-2026 = 13 975 106,05). El dashboard muestra la variación vs. el mes anterior
—absoluta y % — a nivel de portafolio y por tipo de activo. Con `F = 0` la variación %
coincide con la rentabilidad Dietz del mes.

### Rendimiento de Renta Variable
```
rentab_costo   = (dividends_paid - tax) / total_cost_basis        (solo Renta Variable)
tasa_impositiva = tax / dividends_paid                            (0 si div == 0)
interes_causado = total_cost_basis * coupon_rate                  (solo Bond)
```

## 2. Agregados del dashboard — `aggregations.py`

Filtros disponibles: `year`, `month`, `type`, `classification`, `sector`,
`rating_grade` (Moody's / S&P). Equivale a los `SUMIFS`/`COUNTIFS` de la hoja `Dashboard`.

**KPIs del período**
```
costo_total          = Σ total_cost_basis
valor_mercado        = Σ estimated_market_value
gp_no_realizada      = Σ unrealized_gain_loss
rentab_sobre_costo   = gp_no_realizada / costo_total
ingreso_anual_est    = Σ annual_income
interes_acumulado    = Σ accrued_interest
yield_prom_ponderado = ingreso_anual_est / valor_mercado
n_posiciones         = count(estimated_market_value > 0)
```

**Cortes**: por `classification`, por `type`, por `sector`, por grado crediticio
(Moody's y S&P), por `Indicador Stop Loss`, por `Alerta Tiempo`.
Cada corte devuelve `costo`, `valor_mercado`, `gp_no_realizada`,
`pct_participacion` (sobre valor_mercado total), `ingreso_anual_est`, `posiciones`.

**Serie de evolución mensual**: para cada `(year, month)` con datos,
`costo`, `valor_mercado`, `gp_no_realizada`, `ingreso_anual_est`,
`rentab_sobre_costo = gp_no_realizada / costo`.

## 3. Rentabilidad del período — Dietz Modificado — `dietz.py`

Hoja `Rentabilidad`.

```
R = (Vf - Vi - F) / (Vi + Σ(Fj * wj))

Vi = valor de mercado del portafolio al inicio del período
Vf = valor de mercado del portafolio al final del período
F  = Σ Fj  (suma de flujos EXTERNOS de caja: aportes (+) / retiros (-))
     NO incluye dividendos, intereses ni compras/ventas internas
wj = (dias_totales - (fecha_flujo_j - fecha_inicio)) / dias_totales
     = días que el flujo j permanece en la cartera / días del período
```

- La rentabilidad se reporta **neta de comisiones**.
- `Vi` y `Vf` provienen de la serie mensual del portafolio (`monthly_returns`
  se alimenta de los snapshots: `Σ valor_informe` por mes).
- Comparación con benchmark: `benchmark_mensual = benchmark_anual / 12`;
  `alfa = R - benchmark_mensual` (compuesto e institucional).

Validación: agosto-2026 → `Vi = 13_773_343.30`, `Vf = 13_975_106.05`, `F = 0`
→ `R ≈ 0.014648` (1,4648 %).

## 4. Rentabilidad Acumulada — TWR — `twr.py`

Hoja `Rentabilidad Acumulada`. Encadenamiento geométrico de las rentabilidades
mensuales (Dietz) del año:

```
factor_m      = 1 + R_m
TWR_acumulado = Π(factor_m para m in meses_transcurridos) - 1
TWR_benchmark = Π(1 + benchmark_m) - 1
```

Meses sin dato quedan fuera del producto (no cuentan como 0).

## 5. Matriz de Escenarios (What-If) — `scenarios.py`

Hoja `Escenarios`. Entrada: `identifier` (o descripción) + `month` + lista de
escenarios, cada uno con `pct_venta` ∈ (0, 1].

Constantes: `COMISION_BROKER = 0.011` (1,1 % sobre valor bruto), `FEE_TRANSACCION = 3` USD.

```
cantidad_total     = quantity (del snapshot del activo/mes)
valor_compra       = total_cost_basis
valor_mercado      = estimated_market_value
precio_unit_mercado = valor_mercado / cantidad_total

cantidad_venta     = cantidad_total * pct_venta
valor_bruto_venta  = cantidad_venta * precio_unit_mercado
comision_broker    = valor_bruto_venta * 0.011
valor_neto_venta   = valor_bruto_venta - comision_broker - 3

utilidad           = valor_neto_venta - valor_compra          # como en la hoja (col C27)
utilidad_por_accion = utilidad / cantidad_venta
t_anios            = (hoy - fecha_compra) / 360
tir                = XIRR([-valor_compra, valor_mercado], [fecha_compra, hoy])
roi                = (valor_neto_venta - valor_compra * pct_venta) / (valor_compra * pct_venta)
```

`XIRR` se calcula con `numpy_financial`/búsqueda de raíz (Newton + bisección de respaldo).

## 6. Simulador de impacto cambiario — `fx_simulator.py`

Hoja `Simulador`. Moneda funcional COP. TRM paramétricas.

Entradas: `cantidad`, `valor_bruto_venta_usd`, `comision_venta_usd`,
`valor_compra_usd` (costo histórico), `fecha_compra`, `fecha_venta`,
`trm_compra`, `trm_venta`, `trm_cierre` (referencia).

```
valor_bruto_venta_cop = valor_bruto_venta_usd * trm_venta
comision_venta_cop    = comision_venta_usd    * trm_venta
valor_neto_banco_cop  = valor_bruto_venta_cop - comision_venta_cop
costo_historico_cop   = valor_compra_usd * trm_compra

dif_trm               = trm_venta - trm_compra
diferencia_en_cambio  = valor_compra_usd * dif_trm

utilidad_negociacion_cop  = valor_bruto_venta_cop - costo_historico_cop - diferencia_en_cambio
utilidad_bruta_total_cop  = diferencia_en_cambio + utilidad_negociacion_cop
utilidad_neta_venta_cop   = utilidad_bruta_total_cop - comision_venta_cop

# control cruzado (debe dar 0):
control = round((valor_neto_banco_cop - costo_historico_cop) - utilidad_neta_venta_cop, 2)
```

El simulador acepta un rango de TRM de venta para proyectar sensibilidad
(gráfico utilidad neta vs TRM).
