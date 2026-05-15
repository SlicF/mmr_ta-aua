import csv
import glob
import os


def expected_multiplier(jornada):
    if not jornada:
        return None
    j = str(jornada).upper()
    if j == "E3L":
        return 0.75
    for prefix in ("E", "PM", "LM", "MP", "LP"):
        if j.startswith(prefix):
            return 1.5
    return None


files = glob.glob(r"d:\\mmr_ta\xc7aua\\docs\\output\\elo_ratings\\detalhe_*.csv")
# fallback if encoding issues with folder name
if not files:
    files = glob.glob(r"d:\\mmr_taçaua\\docs\\output\\elo_ratings\\detalhe_*.csv")

mismatches = []
for f in files:
    try:
        with open(f, newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for i, row in enumerate(reader, start=2):
                jornada = row.get("Jornada", "").strip()
                exp = expected_multiplier(jornada)
                if exp is None:
                    continue
                try:
                    s1 = float(row.get("Season Phase 1", "") or 0)
                    s2 = float(row.get("Season Phase 2", "") or 0)
                except Exception:
                    mismatches.append((f, i, jornada, "parse_error", row))
                    continue
                if abs(s1 - exp) > 1e-6 or abs(s2 - exp) > 1e-6:
                    mismatches.append((f, i, jornada, (s1, s2), exp, row))
    except Exception as e:
        print("ERR", f, e)

print("Files checked:", len(files))
print("Mismatches found:", len(mismatches))
for idx, m in enumerate(mismatches[:20], start=1):
    f, i, j, found, exp, row = m
    print(f"{idx}. {os.path.basename(f)}:{i} Jornada={j} expected={exp} found={found}")
    print("   ", row)

if mismatches:
    exit(2)
else:
    exit(0)
