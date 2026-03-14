import argparse
import csv
import shutil
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def starts_with_playoff(jornada: str | None) -> bool:
    if jornada is None:
        return False
    value = str(jornada).strip().upper()
    return value.startswith("E") or value.startswith("MP") or value.startswith("LP")


def backup_season(season: str) -> Path:
    csv_dir = REPO_ROOT / "docs" / "output" / "csv_modalidades"
    elo_dir = REPO_ROOT / "docs" / "output" / "elo_ratings"

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_root = (
        REPO_ROOT / "docs" / "output" / "backups" / f"pre_reprocess_{season}_{ts}"
    )
    csv_backup_dir = backup_root / f"csv_modalidades_{season}"
    elo_backup_dir = backup_root / f"elo_ratings_{season}"

    csv_backup_dir.mkdir(parents=True, exist_ok=True)
    elo_backup_dir.mkdir(parents=True, exist_ok=True)

    csv_files = sorted(csv_dir.glob(f"*_{season}.csv"))
    elo_files = sorted(elo_dir.glob(f"*_{season}.csv"))

    for f in csv_files:
        shutil.copy2(f, csv_backup_dir / f.name)
    for f in elo_files:
        shutil.copy2(f, elo_backup_dir / f.name)

    snapshot_path = backup_root / f"playoffs_snapshot_{season}.csv"
    rows_written = 0

    all_fieldnames: list[str] = []
    for src_file in csv_files:
        with src_file.open("r", newline="", encoding="utf-8") as in_f:
            reader = csv.DictReader(in_f)
            for field in reader.fieldnames or []:
                if field not in all_fieldnames:
                    all_fieldnames.append(field)

    headers = ["SourceFile"] + all_fieldnames

    with snapshot_path.open("w", newline="", encoding="utf-8") as out_f:
        writer = csv.DictWriter(out_f, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()

        for src_file in csv_files:
            with src_file.open("r", newline="", encoding="utf-8") as in_f:
                reader = csv.DictReader(in_f)
                for row in reader:
                    if starts_with_playoff(row.get("Jornada")):
                        out_row = {"SourceFile": src_file.name}
                        out_row.update(row)
                        writer.writerow(out_row)
                        rows_written += 1

    print(f"BACKUP_ROOT={backup_root}")
    print(f"CSV_FILES={len(csv_files)}")
    print(f"ELO_FILES={len(elo_files)}")
    print(f"PLAYOFF_ROWS={rows_written}")

    return backup_root


def main():
    parser = argparse.ArgumentParser(
        description="Backup de época e snapshot de eliminatórias (E/MP/LP)."
    )
    parser.add_argument(
        "--season",
        required=True,
        help="Época no formato YY_YY (ex: 24_25)",
    )
    args = parser.parse_args()

    backup_season(args.season)


if __name__ == "__main__":
    main()
