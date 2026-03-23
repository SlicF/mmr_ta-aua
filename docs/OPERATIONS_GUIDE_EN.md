# OPERATIONS_GUIDE.md - Complete Operations Guide

[🇵🇹 Ver Versão em Português](OPERATIONS_GUIDE.md)

## Table of Contents

1. [Execution Pipeline](#pipeline)
2. [Operational Procedures](#procedures)
3. [Troubleshooting Guidelines](#troubleshooting)
4. [System Maintenance & Upgrades](#maintenance)
5. [New Modality Implementation Checklist](#new-sport)
6. [Data Automation via GitHub Actions](#github-actions)
7. [System Monitoring & Logging](#monitoring)

---

## <a name="pipeline"></a> 1. Execution Pipeline

### Full Sequence Workflow (Season Launch Stage)

```bash
# =========================================================================
# COMPLETE WORKFLOW EXAMPLE: 26-27 EPOCH
# Estimated Execution Time: ~9 total minutes
# =========================================================================

cd D:\mmr_taçaua\src

# ── PHASE 1: EXTRACTION ──────────────────────────────────────────────
# Architecture Input:  Standardized Official Taça UA Excel Record
# Systemic Output: Normalized CSV Arrays mapped into docs/output/csv_modalidades/
# Execution Time:  ~30 seconds

python extrator.py

# Internal Validation Checks:
#   ✓ Nominal standardization execution (mapped via config_cursos.json)
#   ✓ Modality pattern recognition 
#   ✓ Internal elimination of playoff placeholder nodes
#   ✓ Formal documentation of documented absences/forfeitures

# ── PHASE 2: ELO EVALUATION ENGINE ──────────────────────────────────
# Architecture Input:  Normalized CSV files + Legacy data (carry-over parameters)
# Systemic Output: Ranking Tables + Current ELO values + JSON historical backups
# Execution Time:  ~2-3 minutes

python mmr_taçaua.py

# Internal Validation Checks:
#   ✓ Successful cross-season carry-over execution 
#   ✓ Application of manual semantic transitions (e.g. Accounting→Marketing)
#   ✓ Application of dynamic non-linear K-factors (typically 65-210 ranges)

# ── PHASE 3: CALIBRATION ENGINE ──────────────────────────────────────
# Architecture Input:  Compiled historical arrays 
# Systemic Output: Actively Calibrated Parameters (Gamma-Poisson, logit arrays)
# Execution Time:  ~1 minute

python calibrator.py

# Core Security Checks:
#   ✓ Validates n_draws ≥ 5 strictly preventing logistic regression failure
#   ✓ Asserts dispersion floors bounding k ≥ 3.0 safely
#   ✓ Enforces overfitting blockers maintaining |intercept| < 100

# ── PHASE 4: PREDICTIVE ENGINE ───────────────────────────────────────
# Architecture Input:  Current structured ELO states + Active optimized parameters
# Systemic Output: Final placement probabilities mapped as predictive datasets
# Execution Time:  ~30s (10k Quick execution) | ~5 min (1M Deep Execution)

# Rapid Validation Protocol (10k iterations):
python preditor.py --season 26_27

# High Precision Output (Deep Monte Carlo Simulation):
python preditor.py --season 26_27 --deep-simulation
```

### Advanced Individual Execution Flags

#### 1.1 Extractor Framework (`extrator.py`)
```bash
python src/extrator.py --verbose       # Output extended normalization logs
python src/extrator.py --force-refresh # Hard override ignoring persistent cache logs
```

#### 1.2 Evaluation Computations (`mmr_taçaua.py`)
```bash
python src/mmr_taçaua.py --season 26_27
python src/mmr_taçaua.py --reset-elos  # Zero-state evaluation initialization parameter
python src/mmr_taçaua.py --backtest    # Trigger formal blind-test performance metrics
```

#### 1.3 Parametric Calibration (`calibrator.py`)
```bash
python src/calibrator.py --cv-folds 5 --verbose  # Deep K-fold Cross Variable validation
```

#### 1.4 Predictor Network (`preditor.py`)
```bash
python src/preditor.py --no-calibrated # Enforce baseline structural estimations
python src/preditor.py --workers 4     # Manually override automatic multiprocessing limits
python src/preditor.py --force-winner  # Structurally prevents draws (used for playoffs)
```

---

## <a name="procedures"></a> 2. Standard Operational Procedures

### 2.1 Initiating a Blank Database Epoch
**Execution Trigger:** Upon official commencement of the 26-27 Tournament phase.

1. Ensure the raw structural Official Excel reflects expected column names perfectly aligning towards previous datasets.
2. Edit `docs/config/config_cursos.json` directly identifying any newly registered organizational team entities.
3. Rapidly enact full-stack commands executing sequentially extracting mappings and pushing simulations.
4. Finalize database adjustments via Git Commits updating downstream visualization architectures inherently linked.

### 2.2 Mid-Season Parameter Recalibration
**Execution Trigger:** Activating specifically around Matchday 8-10 intervals securing mathematically adequate predictive variance maps.

1. Inject new temporal data parameters using `--override-historical` protocols enforcing real-time statistical modeling logic exclusively.
2. Formulate immediate comparative validations contrasting newly produced Brier Accuracy Scores explicitly checking against degraded former outputs. If the threshold records a net $2\%$ improvement: merge configs immediately.

---

## <a name="troubleshooting"></a> 3. Advanced Troubleshooting Matrices

### 3.1 Unresolved Duplicate Team Entities

**Categorical Symptom:**
```csv
Position,Team,ELO
1,Engineering,1627
2,Engneering,1582   ← Failed normalization node!
```

**Architectural Root:** Non-matching node string failed completely generating duplicate parallel paths internally.
**Resolution Schema:** Force absolute alignment mapping by creating strict manual paths executing inside `config_cursos.json` and activating `--reset-elos`.

### 3.2 Explosive Computational Runtime Overloads (> 10min)

**Categorical Symptom:** Simulation freezes drastically predicting outputs exceeding severe temporal margins estimating computational failures.

**Resolution Constraints:**
- Confirm execution via Python's structural `ProcessPoolExecutor` utilizing multi-threading bypass routines (Avoid internal thread blocking Python GIL).
- Ensure machine allocation possesses adequate physical operative ram. If restricted actively scale background processes reducing down toward 2 manual `workers`.

### 3.3 Overfitted Draw Predictive Matrix Failures

**Categorical Symptom:** Internal logging explicitly states "Absurd coefficients" terminating calibration operations defaulting outputs toward non-optimal Gaussian replacements.

**Resolution Steps:** Safely elevate minimum constraint triggers dynamically checking within dataset logic demanding higher percentages (typically demanding 10-15 absolute isolated draws across complete arrays before safely opening linear regressions computations).

---

## <a name="maintenance"></a> 4. Upgrades and Maintenance Systems

It is strictly recommended maintaining core `scikit-learn`, `numpy`, and `scipy` dependencies updated actively assuring execution algorithms operate at peak hardware translation capacities securing maximum calculation throughput. Executing mass cleanup removing degraded historical datasets (>2 trailing Epochs) prevents memory stack issues and improves iteration search operations internally.

---

**Protocol Active Update Date:** 2026-03
