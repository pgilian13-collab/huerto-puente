"""
IMPORTAR CATALOGO DE PLANTAS
=============================
Lee un archivo Excel con el catalogo de plantas y lo inserta en Supabase.

Uso:
  python importar_catalogo.py [ruta_del_excel]

Si no se especifica ruta, busca catalogo_plantas_invernadero_es.xlsx
en la carpeta del proyecto.
"""

import sys
import os
import httpx

# ============================================================
# CONFIGURACION
# ============================================================
SUPABASE_URL = "https://nzicdhwoficzsafhdxmq.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56aWNkaHdvZmljenNhZmhkeG1xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc4MTg0MywiZXhwIjoyMDk2MzU3ODQzfQ.Al5773jpjE6YiQ_hzyLVAVIzzgk0DkU8xQPMGkjXtOU"

COLUMN_MAP = {
    "planta": "nombre",
    "temperatura_min_c": "temp_min",
    "temperatura_max_c": "temp_max",
    "humedad_suelo_min_%": "hum_suelo_min",
    "humedad_suelo_max_%": "hum_suelo_max",
    "humedad_ambiente_min_%": "hum_ambiente_min",
    "humedad_ambiente_max_%": "hum_ambiente_max",
    "ph_suelo_min": "ph_min",
    "ph_suelo_max": "ph_max",
}


def find_excel():
    """Busca el Excel en la carpeta del proyecto."""
    project_dir = os.path.dirname(os.path.abspath(__file__))
    target = os.path.join(project_dir, "catalogo_plantas_invernadero_es.xlsx")
    if os.path.exists(target):
        return target
    return None


def read_excel(path):
    """Lee el Excel y retorna lista de diccionarios con los campos correctos."""
    try:
        import openpyxl
    except ImportError:
        print("ERROR: openpyxl no instalado. Ejecuta:")
        print("  python -m pip install openpyxl")
        sys.exit(1)

    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        print("ERROR: Archivo vacio")
        sys.exit(1)

    raw_headers = [str(h).strip() for h in rows[0]]
    mapped_headers = []
    for h in raw_headers:
        key = h.strip().lower().replace(" ", "_")
        mapped_headers.append(COLUMN_MAP.get(key, None))

    print(f"Columnas Excel: {raw_headers}")
    print(f"Mapeadas a:     {mapped_headers}")

    data = []
    for row in rows[1:]:
        if not row or not row[0]:
            continue
        entry = {}
        for i, db_col in enumerate(mapped_headers):
            if db_col is None:
                continue
            val = row[i] if i < len(row) else None
            if db_col == "nombre":
                entry[db_col] = str(val).strip() if val else ""
            elif val is not None:
                try:
                    entry[db_col] = round(float(val), 1)
                except (ValueError, TypeError):
                    entry[db_col] = None
            else:
                entry[db_col] = None
        if entry.get("nombre"):
            data.append(entry)
    wb.close()
    return data


def import_to_supabase(plants):
    """Inserta las plantas en Supabase via REST API."""
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    url = f"{SUPABASE_URL}/rest/v1/catalogo_plantas"

    inserted = 0
    skipped = 0
    errors = 0
    with httpx.Client(timeout=30) as client:
        for plant in plants:
            try:
                resp = client.post(url, json=plant, headers=headers)
                if resp.status_code in (200, 201):
                    inserted += 1
                    print(f"  OK: {plant['nombre']}")
                elif resp.status_code == 409:
                    skipped += 1
                    print(f"  SKIP (ya existe): {plant['nombre']}")
                else:
                    errors += 1
                    print(f"  ERROR {resp.status_code}: {plant['nombre']} - {resp.text[:120]}")
            except Exception as e:
                errors += 1
                print(f"  EXCEPCION: {plant['nombre']} - {e}")

    return inserted, skipped, errors


def main():
    if len(sys.argv) > 1:
        excel_path = sys.argv[1]
    else:
        excel_path = find_excel()

    if not excel_path or not os.path.exists(excel_path):
        print("ERROR: No se encontro archivo Excel.")
        print("Uso: python importar_catalogo.py [ruta_del_excel]")
        print("O coloca catalogo_plantas_invernadero_es.xlsx en la carpeta del proyecto")
        sys.exit(1)

    print(f"Archivo: {excel_path}")
    plants = read_excel(excel_path)
    print(f"\nPlantas encontradas: {len(plants)}")

    if not plants:
        print("ERROR: No se encontraron plantas en el archivo")
        sys.exit(1)

    print(f"\nImportando a Supabase...")
    inserted, skipped, errors = import_to_supabase(plants)
    print(f"\nResultado: {inserted} insertadas, {skipped} ya existian, {errors} errores")


if __name__ == "__main__":
    main()
