# OPERATIONS_GUIDE.md - Complete Operations Guide

[🇵🇹 Ver Versão em Português](OPERATIONS_GUIDE.md)

## Table of Contents

1. [Execution Pipeline](#pipeline)
2. [Operational Procedures](#procedures)
3. [Troubleshooting](#troubleshooting)
4. [Maintenance and Updates](#maintenance)
5. [New Modality Checklist](#new-sport)
6. [GitHub Actions Automation](#github-actions)
7. [Monitoring and Logs](#monitoring)

---

## <a name="pipeline"></a> 1. Execution Pipeline

### Full Sequence (Season Start)

```bash
# ═══════════════════════════════════════════════════════════════════
# COMPLETE WORKFLOW: SEASON 26-27 (Example)
# Total time: ~9 minutes
# ═══════════════════════════════════════════════════════════════════

cd D:\mmr_taçaua\src

# ── STEP 1: EXTRACTION ──────────────────────────────────────────────
# Input:  Official Taça UA Excel
# Output: Normalized CSVs in docs/output/csv_modalidades/
# Time:   ~30 seconds

python extrator.py

# Automatic validations:
#   ✓ Names normalized (displayName from config_cursos.json)
#   ✓ Modalities detected (8 expected)
#   ✓ Playoff placeholders removed
#   ✓ Absences marked ("Falta de Comparência" field)

# ── STEP 2: ELO CALCULATION ──────────────────────────────────────────
# Input:  Normalized CSVs + previous seasons (for carry-over)
# Output: Standings + ELO ratings + JSON history
# Time:   ~2-3 minutes

python mmr_taçaua.py

# Automatic validations:
#   ✓ ELOs loaded from previous season (if available)
#   ✓ Special transitions applied (e.g. Contabilidade→Marketing)
#   ✓ Dynamic K-factor applied (range 65-210 observed)
#   ✓ Divisions and groups correctly detected

# ── STEP 3: CALIBRATION ──────────────────────────────────────────
# Input:  Historical CSVs (25_26, 24_25)
# Output: Calibrated parameters (Gamma-Poisson, draw logit)
# Time:   ~1 minute

python calibrator.py

# Critical validations:
#   ✓ n_draws ≥ 5 for logit model (otherwise gaussian fallback)
#   ✓ k ≥ 3.0 (dispersion floor)
#   ✓ |intercept| < 100 (overfitting sanity check)

# ── STEP 4: PREDICTIONS ───────────────────────────────────────────
# Input:  Current ELOs + calibrated parameters
# Output: Final standings probabilities
# Time:   ~30s (10k iter) | ~5 min (1M iter deep)

python preditor.py

# Validations:
#   ✓ Probability sums = 100% for each team
#   ✓ Positions 1-N all assigned
#   ✓ Forecast consistent with probabilities

# ═══════════════════════════════════════════════════════════════════
# END OF PIPELINE
# ═══════════════════════════════════════════════════════════════════
```

### Commands per Phase

> **Note:** Currently, none of the main scripts accept command-line flags.
> Configuration is done directly in the source files or via programmatic import.

#### 1.1 Extraction (extrator.py)

```bash
# Standard mode (uses default Excel path)
python src/extrator.py

# Programmatic mode (to process specific sheets):
python -c "
from src.extrator import ExcelProcessor
processor = ExcelProcessor('src/Resultados Taça UA 25_26.xlsx',
                           sheets_to_process=['FUTSAL MASCULINO'])
processor.process_all_sheets()
"
```

#### 1.2 ELO Calculation (mmr_taçaua.py)

```bash
# Standard execution (auto-detects season from CSVs)
python src/mmr_taçaua.py

# The script automatically loads ELOs from previous seasons (carry-over).
# For debugging, check the generated log file: mmr_tacaua.log
```

#### 1.3 Calibration (calibrator.py)

```bash
# Full calibration (all modalities with available data)
python src/calibrator.py

# Outputs generated in docs/output/calibration/:
#   - calibrated_params_full.json
#   - calibrated_simulator_config.json
```

#### 1.4 Prediction (preditor.py)

```bash
# Standard prediction (uses calibrated parameters if available)
python src/preditor.py

# For advanced configuration, edit constants at the top
# of preditor.py (N_SIMULATIONS, USE_CALIBRATED, etc.)
```

---

## <a name="procedures"></a> 2. Operational Procedures

### 2.1 New Season Start

**Trigger:** First matchday of season 26-27 played.

```bash
# 1. Update official Excel
#    - Check correct sheet names (Futsal M, Andebol, etc.)
#    - Validate formulas (goals, sets, points)

# 2. Update course configuration (if changes)
vi docs/config/config_cursos.json
# Add new courses, update displayNames

# 3. Run FULL pipeline
cd src
python extrator.py && \
python mmr_taçaua.py && \
python calibrator.py && \
python preditor.py

# 4. Commit changes
cd ..
git add docs/output/
git commit -m "feat(25-26): Add matchday 1 results"
git push origin master

# 5. Website auto-updates via GitHub Pages webhook
```

### 2.2 Weekly Update (During Season)

**Trigger:** After each matchday (~1x week).

```bash
# 1. Update Excel with new results
#    (add new rows only, don't edit previous ones!)

# 2. PARTIAL pipeline (no recalibration needed):
cd src
python extrator.py
python mmr_taçaua.py  # Uses existing ELOs + new games
python preditor.py    # Uses calibrated parameters automatically

# 3. Quick validation:
#    - Do ELOs make sense? (winners +15-50, losers -15-50)
#    - Do probabilities sum to 100%?

# 4. Commit + Push
git add -A
git commit -m "chore(26-27): Update after matchday X"
git push
```

### 2.3 Mid-Season Recalibration

**Trigger:** ~Matchday 8-10 (mid-season), enough data accumulated.

```bash
cd src

# 1. Recalibrate (automatically uses all available data)
python calibrator.py

# 2. Compare parameters (check diffs in output JSON):
git diff ../docs/output/calibration/calibrated_simulator_config.json

# 3. Re-run predictions with new parameters:
python preditor.py

# 4. Commit with explanatory message:
git commit -m "calibration(26-27): Mid-season recalibration (Brier 0.145→0.138)"
```

---

## <a name="troubleshooting"></a> 3. Troubleshooting

### 3.1 Problem: Duplicate Teams in Standings

**Symptom:**

```csv
Position,Team,ELO
1,Gestão,1627
2,Gestao,1582   ← Duplicate!
3,GESTÃO,1544   ← Triplicate!
```

**Cause:** Incomplete normalization (`normalize_team_name()` failed).

**Solution:**

```bash
# 1. Add mapping in config_cursos.json:
{
  "GESTÃO": {
    "displayName": "Gestão",
    "variants": ["Gestao", "GESTÃO", "gestão"]
  }
}

# 2. Re-run extractor:
python src/extrator.py

# 3. Re-run ELO:
python src/mmr_taçaua.py
```

---

### 3.2 Problem: Abnormally High Brier Score (>0.20)

**Symptom:**

```json
{
  "FUTSAL MASCULINO": {
    "brier_score": 0.247,
    "rmse_position": 3.82
  }
}
```

**Probable Causes:**

1. Uncalibrated parameters (using defaults)
2. Overfitted draw model (absurd intercept)
3. Very small dataset (<20 games)

**Diagnosis:**

```bash
# Check parameters used:
cat docs/output/calibration/calibrated_simulator_config.json | \
    jq '."FUTSAL MASCULINO"'
```

**Solutions:**

**Case 1: Overfitting** — Increase minimum threshold in calibrator.py.

**Case 2: Small Dataset:**

```bash
# To use defaults without calibration, edit the USE_CALIBRATED
# variable at the top of preditor.py to False
python src/preditor.py
```

---

### 3.3 Problem: Excessive Simulation Time (>10 min)

**Probable Causes:**

1. ProcessPoolExecutor not activated (fallback ThreadPool → GIL)
2. Insufficient swap/memory
3. I/O bottleneck (slow disk)

**Solutions:**

```bash
# 1. Reduce workers if RAM is low (<8GB):
#    Edit N_WORKERS at the top of preditor.py (e.g. N_WORKERS = 2)

# 2. Reduce iterations for quick tests:
#    Edit N_SIMULATIONS at the top of preditor.py (e.g. N_SIMULATIONS = 10000)

# 3. Re-run:
python src/preditor.py
```

---

### 3.4 Problem: Team Transition Not Applied

**Symptom:**

```sh
Season 25-26: Contabilidade (ELO=1623)
Season 26-27: Marketing (ELO=1500) ← Should be 1623!
```

**Cause:** `handle_special_team_transitions()` didn't execute.

**Diagnosis:**

```bash
grep -i "transição" mmr_tacaua.log
# Expected: "Transferido ELO de Contabilidade para Marketing no andebol misto: 1623"
```

**Solution:** Verify in `mmr_taçaua.py` that the sport detection condition matches correctly (e.g. `"andebol" in sport_name.lower() and "misto" in sport_name.lower()`).

---

### 3.5 Problem: Volleyball Draws

**Symptom:**

```csv
Jornada,Team 1,Team 2,Sets 1,Sets 2
8,Gestão,Economia,1,1  ← IMPOSSIBLE! (volleyball is best-of-3)
```

**Cause:** Incorrectly entered data in Excel (interrupted game?).

**Solution:**

```bash
# 1. Fix Excel manually (sets must be 2-0, 2-1, 1-2, 0-2)
# 2. Or mark as absence (if game didn't finish):
#    Add "X" in "Falta de Comparência" column
# 3. Re-run extractor:
python src/extrator.py
```

---

## <a name="maintenance"></a> 4. Maintenance and Updates

### 4.1 Dependency Updates

**Frequency:** ~6 months or when security advisory issued.

```bash
# 1. Backup current environment:
pip freeze > requirements_backup.txt

# 2. Update critical dependencies:
pip install --upgrade numpy scipy scikit-learn pandas

# 3. Test full pipeline:
cd src
python extrator.py && \
python mmr_taçaua.py && \
python calibrator.py && \
python preditor.py

# 4. If OK, update requirements.txt:
pip freeze > ../requirements.txt
```

### 4.2 Old File Cleanup

**Frequency:** Start of new season (free space).

```bash
# Archive old seasons (>2 years):
cd docs/output
tar -czf archive_23_24.tar.gz \
    csv_modalidades/*_23_24.csv \
    elo_ratings/*_23_24.*
mv archive_23_24.tar.gz ../../backups/
```

---

## <a name="github-actions"></a> 6. GitHub Actions Automation

### Current Workflow (.github/workflows/update_predictions.yml)

```yaml
name: Update Predictions Daily

on:
  schedule:
    - cron: '0 1 * * *'  # 01:00 UTC daily
  workflow_dispatch:      # Manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Python 3.10
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
          cache: 'pip'
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Run pipeline
        run: |
          cd src
          python extrator.py
          python mmr_taçaua.py
          python preditor.py
      
      - name: Commit results
        run: |
          git config user.name "GitHub Actions Bot"
          git config user.email "<>"
          git add docs/output/
          git diff --staged --quiet || \
            git commit -m "auto: Daily update $(date +%F)"
          git push
```

---

## <a name="monitoring"></a> 7. Monitoring and Logs

### Log Structure

```bash
# Automatically created logs:
mmr_tacaua.log         # ELO calculation logs (generated automatically)
calibration.log        # Calibration (if configured in code)
simulation.log         # Predictor (if configured in code)
```

### Log Levels

```python
# Configuration in each module:
logging.basicConfig(
    level=logging.INFO,  # DEBUG | INFO | WARNING | ERROR
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    filename="mmr_tacaua.log"
)
```

### Analyzing Logs

```bash
# View recent errors:
grep ERROR mmr_tacaua.log | tail -n 20

# Count normalization warnings:
grep "Placeholder de playoff" mmr_tacaua.log | wc -l

# K-factor timeline:
grep "K_factor aplicado" mmr_tacaua.log | \
    awk '{print $1, $2, $NF}' | \
    tail -n 50
```

### Performance Metrics

```bash
# Execution time per phase:
time python src/extrator.py        # ~30s
time python src/mmr_taçaua.py      # ~2-3 min
time python src/calibrator.py      # ~1 min
time python src/preditor.py        # ~5 min (1M iter)
```

---

## Resources and References

**Fully documented pipeline:**

- Automation via GitHub Actions
- Documented troubleshooting (5 common scenarios)
- Detailed operational procedures
- New modality checklist (12 steps)

**Quality parameters:**

- Weekly update: <10 min (manual) | <5 min (automatic)
- Brier Score target: <0.15 for main modalities
- RMSE Position target: <2.5

---

**Last updated:** 2026-03  
**Author:** Taça UA System
