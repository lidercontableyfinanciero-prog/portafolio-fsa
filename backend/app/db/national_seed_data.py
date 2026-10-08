"""Datos de referencia del Portafolio Nacional, transcritos del libro
`2. INFORME INVERSIONES NACIONALES FSA 2026.xlsx` (no se inventa ninguno):

- NATIONAL_ASSETS  <- hoja `Valoracion`, columnas A:G (tblVal) + Administrador (tblFIC).
- NATIONAL_IPC     <- hoja `Parametros`, tblIPC (E16:H25), fuente DANE.
- NATIONAL_PARAMETERS <- hoja `Parametros`, B8:B38 (umbrales del Reglamento y
  supuestos de calidad de datos).

Todos son editables desde la app (Portafolio Nacional → Parámetros, solo admin).
"""

RF = "Renta Fija (CDT + Bono)"
FIC = "Cartera Colectiva (FIC)"
FCP = "Futuro Inmobiliario / FCP"

# (nombre, tipo, grupo, emisor, entidad, baja liquidez, benchmark)
NATIONAL_ASSETS: list[tuple[str, str, str, str, str, bool, str]] = [
    ("CDT Banco de Bogotá", "CDT", RF, "Banco de Bogotá", "Credicorp Capital", False, "IPC + 2"),
    ("CDTs Banco Popular", "CDT", RF, "Banco Popular", "Credicorp Capital", False, "IPC + 2"),
    ("CDT Bancolombia", "CDT", RF, "Bancolombia", "Credicorp Capital", False, "IPC + 2"),
    ("CDT BBVA Colombia S.A.", "CDT", RF, "BBVA Colombia", "Credicorp Capital", False, "IPC + 2"),
    ("CDT BBVA Colombia S.A. (TIR)", "CDT", RF, "BBVA Colombia", "Credicorp Capital", False, "IPC + 2"),
    ("CDT Banco Caja Social", "CDT", RF, "Banco Caja Social", "Credicorp Capital", False, "IPC + 2"),
    ("CDT Davivienda 1", "CDT", RF, "Davivienda", "Credicorp Capital", False, "IPC + 2"),
    ("CDT Davivienda 2", "CDT", RF, "Davivienda", "Credicorp Capital", False, "IPC + 2"),
    ("Bonos Sostenibles itau corpbanca", "Bono", RF, "Itaú Corpbanca", "Credicorp Capital", False, "IPC + 2"),
    ("Credicorp Capital Alta Liquidez", "FIC", FIC, "FIC Credicorp Capital Alta Liquidez", "Credicorp Capital", False, "IPC"),
    ("Deuda Corporativa", "FIC", FIC, "FIC Deuda Corporativa", "Credicorp Capital", False, "IPC"),
    ("Inmoval", "FIC", FIC, "FIC Inmoval", "Credicorp Capital", True, "IPC + 2"),
    ("FIC Accival Vista", "FIC", FIC, "FIC Accival Vista", "Acciones & Valores", False, "IPC"),
    ("FIC Davivienda", "FIC", FIC, "FIC Davivienda", "Davivienda Corredores", False, "IPC"),
    ("FCP Futuro Inmobiliario Com II Vivienda", "FCP", FCP, "FCP Futuro Inmobiliario Com II Vivienda", "Alianza Fiduciaria", True, "IPC + 2"),
]

# (año, mes, IPC año corrido, IPC anual 12m, fuente)
NATIONAL_IPC: list[tuple[int, int, float | None, float | None, str]] = [
    (2025, 12, 0.0, 0.051, "DANE, comunicado IPC dic-2025 (08/01/2026)"),
    (2026, 1, 0.0118, 0.0535, "DANE, comunicado IPC ene-2026 (06/02/2026)"),
    (2026, 2, 0.0227, None, "DANE, comunicado IPC feb-2026 (06/03/2026); anual no verificado en fuente oficial"),
    (2026, 3, 0.0307, 0.0556, "DANE, comunicado IPC mar-2026 (09/04/2026)"),
    (2026, 4, 0.0387, 0.0568, "DANE, comunicado IPC abr-2026 (08/05/2026)"),
    (2026, 5, 0.0436, 0.0584, "DANE, comunicado IPC may-2026 (05/06/2026)"),
    (2026, 6, 0.0477, 0.0614, "DANE, boletín técnico IPC jun-2026 (07/07/2026)"),
    (2026, 7, 0.0494, 0.0603, "DANE, comunicado IPC jul-2026 (10/08/2026)"),
    (2026, 8, 0.0535, 0.0624, "DANE, boletín IPC ago-2026 (07/09/2026)"),
]

NATIONAL_PARAMETERS: list[dict] = [
    {"key": "nal_spread_benchmark", "value_numeric": 0.02,
     "description": "Spread sobre IPC – portafolio total (Anexo 6: IPC 12m + 2 pp)"},
    {"key": "nal_limite_emisor", "value_numeric": 0.20,
     "description": "Límite por emisor, % del portafolio en COP (Anexo 5)"},
    {"key": "nal_limite_tes", "value_numeric": 0.30,
     "description": "Límite TES / títulos con aval de la Nación (Anexo 5)"},
    {"key": "nal_limite_baja_liquidez", "value_numeric": 0.20,
     "description": "Límite inversiones de baja liquidez (Portafolio total, literal b)"},
    {"key": "nal_plazo_max_deuda", "value_numeric": 3,
     "description": "Plazo máximo deuda privada, años (Anexo 4)"},
    {"key": "nal_alerta_amarilla", "value_numeric": 0.9,
     "description": "% del límite para alerta amarilla (criterio de gestión)"},
    {"key": "nal_dias_critico", "value_numeric": 90,
     "description": "Días a vencimiento – alerta crítica (criterio de gestión)"},
    {"key": "nal_dias_atencion", "value_numeric": 180,
     "description": "Días a vencimiento – atención (criterio de gestión)"},
    {"key": "nal_stop_loss", "value_numeric": -0.10,
     "description": "Rentabilidad del periodo – monitoreo reforzado (Stop-loss > 10 %)"},
    {"key": "nal_margen_sobresaliente", "value_numeric": 0.01,
     "description": "Margen para 'sobresaliente' sobre el benchmark E.A."},
    # Supuestos de calidad de datos (Parametros!B8:B13 y notas 1 y 4)
    {"key": "nal_cupon_rendimientos_desde", "value_text": "2026-07",
     "description": "Desde este mes los cupones de CDT/Bono se registran como 'Rendimientos'"},
    {"key": "nal_reparto_matriz", "value_text": "CDT Davivienda 1",
     "description": "CDT cuyo valor de mercado viene consolidado (mismo nemo)"},
    {"key": "nal_reparto_hijo", "value_text": "CDT Davivienda 2",
     "description": "CDT que se reparte desde el consolidado"},
    {"key": "nal_reparto_hasta", "value_text": "2026-06",
     "description": "Último mes con valor de mercado consolidado (matriz + hijo)"},
]
