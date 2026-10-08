# Lógica financiera — Portafolio Nacional (COP)

Reimplementa `Referencias/2. INFORME INVERSIONES NACIONALES FSA 2026.xlsx` sobre la base
`Base de Datos Portafolio Inversiones Nacionales.xlsx` (hoja `Data_Nal`). Motor puro en
`backend/app/services/national.py`; pruebas en `backend/tests/test_national.py` cotejando
contra el corte agosto‑2026 (valor total 8 710 191 750,48 · rent. E.A. 8,8426 % ·
benchmark 10,294 %).

## Fuentes
| Dato | Origen | Tabla |
|---|---|---|
| Movimientos (saldo, depósitos, retiros, rendimientos, valorización, valor de mercado, composición) | Base `Data_Nal` (importable) | `national_movements` |
| Tipo, grupo, emisor, baja liquidez, benchmark de cada inversión | `Valoracion!A:G` del informe (no está en la base) | `national_assets` |
| IPC DANE año corrido / 12 meses | `Parametros!tblIPC` | `national_ipc` |
| Límites y umbrales | `Parametros!B18:B38` + Reglamento | `parameters` (`nal_*`) |

Las columnas calculadas de `Data_Nal` (Valor Depurado, 20 % Renta, Años Rest., CAL…) se
ignoran al importar y se recalculan. Inversiones nuevas se crean en el catálogo con
atributos deducidos y `needs_review = true` (Parámetros → Catálogo).

## Periodo
- Corte = mes seleccionado (por defecto el último cargado). Fecha de corte = fin de mes.
- Base = cierre de diciembre del año anterior al corte (si no existe, el primer mes).
- `meses = corte − base`; `idx(base) = 1`.

## Valoración mensual (`Valoracion!H6:P20`)
- FIC / FCP: Σ signo × valor por concepto — Saldo mes anterior, Depósitos, Rendimientos,
  Valorización (+1); Retiros, Retiros‑Redención, GMF, Redención (−1).
- CDT / Bono: «Valor de Mercado». Reparto matriz/hijo (Davivienda 1/2, mismo nemo) hasta
  `nal_reparto_hasta`: VM(matriz) × Giro de Venta propio / Σ Giros.

## Cupones y retorno (`tblCup`, `tblRet`)
- Cupones CDT/Bono = «Rendimientos Pagados» + «Rendimientos» desde `nal_cupon_rendimientos_desde`.
- Retorno del mes: FIC = Rendimientos; FCP = Valorización; renta fija = (VMₜ − VMₜ₋₁ si
  ambos > 0) + cupones; el mes base = 0.

## Rentabilidad (`Rentabilidad`)
```
saldo_promedio_activo = Σ valor-meses / nº cierres con valor
rent_periodo = retorno(idx ≥ 2) / saldo_promedio
rent_EA      = (1 + rent_periodo)^(12 / meses_con_valor) − 1
grupo/total: saldo_promedio = Σ valor-meses / idx(corte); EA con `meses`
benchmark_periodo = (1 + IPC año corrido)(1 + spread)^(meses/12) − 1 ; EA anualizado
benchmark líquidas (IPC) = IPC año corrido anualizado
benchmark de grupo = Σ(valor-meses × bench EA activo) / Σ valor-meses
```
Con filtros activos el total se llama «Selección filtrada» y usa el benchmark ponderado.

## KPIs del Dashboard
Rendimientos e intereses pagados = Σ liquidados (FIC: retorno dic→corte; CDT/Bono:
cupones; FCP: 0) · Valor total · MoM · Rentabilidad general E.A. · Benchmark E.A.

## Límites y alertas (`Alertas`) — siempre sobre el portafolio total
- Baja liquidez ≤ 20 % · Emisor ≤ 20 % (Anexo 5) · Plazo deuda privada ≤ 3 años (Anexo 4).
- Estado: uso ≥ 1 «Excede límite»; ≥ 90 % «Cerca del límite».
- Semáforo por activo: emisor, baja liquidez, plazo, vencimiento (≤ 90 / 180 días),
  tasa vs IPC 12m (+ spread), rentabilidad vs benchmark (≤ −10 % crítico; Sobresaliente ≥ +1 pp).
- Clasificación: crítico o ≥ 2 atenciones → En riesgo; 1 atención → En seguimiento;
  sin valor → Cerrado.

## No calculable con la base
Calificación AAA (Reglamento) y rentabilidad neta de comisiones/impuestos: se informan
como pendientes de revisión manual; nunca se inventan.
