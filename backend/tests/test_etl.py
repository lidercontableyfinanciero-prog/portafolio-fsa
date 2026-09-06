from app.services.etl import map_headers, parse_percent, parse_upload


def test_map_headers_bilingual_and_ignores_unnamed():
    cols = [
        "Statement Year /\nAño del Extracto",
        "Statement Month /\nMes del Extracto",
        "Description /\nDescripción",
        "Total Cost Basis /\nBase de Costo Total",
        "Estimated Market Value /\nValor de Mercado Estimado",
        "Identifier /\nIdentificador (CUSIP/CINS)",
        "Unnamed: 52",
        "Unnamed: 53",
    ]
    m = map_headers(cols)
    assert m["Statement Year /\nAño del Extracto"] == "statement_year"
    assert m["Total Cost Basis /\nBase de Costo Total"] == "total_cost_basis"
    assert m["Identifier /\nIdentificador (CUSIP/CINS)"] == "identifier"
    assert "Unnamed: 52" not in m


def test_parse_percent_normalises():
    assert abs(parse_percent(0.085) - 0.085) < 1e-12
    assert abs(parse_percent("8.5%") - 0.085) < 1e-12
    assert abs(parse_percent("9.5") - 0.095) < 1e-12


def test_parse_upload_csv_roundtrip():
    csv = (
        "Statement Year,Statement Month,Classification,Type,Description,Sector,"
        "Total Cost Basis,Estimated Market Value,Estimated Accrued Interest,"
        "Identifier / Identificador (CUSIP/CINS),Unnamed: 52\n"
        "2026,Agosto,Renta Fija,Bond,USD METINVEST BV,MINERIA,"
        "201840,178858,3163.89,N5657TAJ5,\n"
        "2026,Agosto,Money Accounts,Cash,Money Account,,0,565840.09,0,CASH-1,\n"
    )
    res = parse_upload(csv.encode(), "extracto.csv")
    assert res.total_rows == 2
    assert res.ok_rows == 2
    assert "Unnamed: 52" in res.ignored_columns
    first = res.rows[0]
    assert first.instrument["identifier"] == "N5657TAJ5"
    assert first.snapshot["statement_month"] == "Agosto"
    # Mark-to-Market recalculado en el ETL
    assert round(first.snapshot["unrealized_gain_loss"], 2) == -22982.00
    assert str(first.snapshot["report_date"]) == "2026-08-01"
