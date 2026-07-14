"""
IMPORTAR CATALOGO DE PLANTAS
=============================
Lee un archivo Excel con el catalogo de plantas y lo inserta en Supabase.

Uso:
  py -3.12 importar_catalogo.py [ruta_del_excel]

Si no se especifica ruta, busca el archivo mas reciente en Downloads.
El Excel debe tener columnas: nombre, temp_min, temp_max, hum_suelo_min,
hum_suelo_max, hum_ambiente_min, hum_ambiente_max, ph_min, ph_max
"""

import sys
import os
import glob
import httpx

# ============================================================
# CONFIGURACION - Actualizar si es necesario
# ============================================================
SUPABASE_URL = "https://nzicdhwoficzsafhdxmq.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56aWNkaHdvZmljenNhZmhkeG1xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc4MTg0MywiZXhwIjoyMDk2MzU3ODQzfQ.Al5773jpjE6YiQ_hzyLVAVIzzgk0DkU8xQPMGkjXtOU"


def find_excel():
    """Busca el archivo Excel mas reciente en Downloads."""
    downloads = os.path.join(os.path.expanduser("~"), "Downloads")
    patterns = glob.glob(os.path.join(downloads, "*.xlsx"))
    if not patterns:
        return None
    return max(patterns, key=os.path.getmtime)


def read_excel(path):
    """Lee el Excel y retorna lista de diccionarios."""
    try:
        import openpyxl
    except ImportError:
        print("ERROR: openpyxl no instalado. Ejecuta:")
        print("  py -3.12 -m pip install openpyxl")
        sys.exit(1)

    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        print("ERROR: Archivo vacio")
        sys.exit(1)

    headers = [str(h).strip().lower().replace(" ", "_") for h in rows[0]]
    data = []
    for row in rows[1:]:
        if not row or not row[0]:
            continue
        entry = {}
        for i, h in enumerate(headers):
            val = row[i] if i < len(row) else None
            if h == "nombre":
                entry[h] = str(val).strip() if val else ""
            elif val is not None:
                try:
                    entry[h] = float(val)
                except (ValueError, TypeError):
                    entry[h] = None
            else:
                entry[h] = None
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
    errors = 0
    with httpx.Client(timeout=30) as client:
        for plant in plants:
            try:
                resp = client.post(url, json=plant, headers=headers)
                if resp.status_code in (200, 201):
                    inserted += 1
                    print(f"  OK: {plant['nombre']}")
                elif resp.status_code == 409:
                    print(f"  SKIP (ya existe): {plant['nombre']}")
                else:
                    errors += 1
                    print(f"  ERROR {resp.status_code}: {plant['nombre']} - {resp.text[:100]}")
            except Exception as e:
                errors += 1
                print(f"  EXCEPCION: {plant['nombre']} - {e}")

    return inserted, errors


def main():
    if len(sys.argv) > 1:
        excel_path = sys.argv[1]
    else:
        excel_path = find_excel()

    if not excel_path or not os.path.exists(excel_path):
        print("ERROR: No se encontro archivo Excel.")
        print("Uso: py -3.12 importar_catalogo.py [ruta_del_excel]")
        print("O coloca el archivo .xlsx en Downloads/")
        sys.exit(1)

    print(f"Archivo: {excel_path}")
    plants = read_excel(excel_path)
    print(f"Plantas encontradas: {len(plants)}")

    if not plants:
        print("ERROR: No se encontraron plantas en el archivo")
        sys.exit(1)

    print(f"\nImportando a Supabase...")
    inserted, errors = import_to_supabase(plants)
    print(f"\nResultado: {inserted} insertadas, {errors} errores")


if __name__ == "__main__":
    main()
