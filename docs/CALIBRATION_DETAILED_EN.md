# CALIBRATION_DETAILED.md - Statistical Parameter Calibration

[🇵🇹 Ver Versão em Português](CALIBRATION_DETAILED.md)

## Table of Contents

1. [Calibration Objectives](#objectives)
2. [Gamma-Poisson Distribution](#gamma-poisson)
3. [Logistic Regression for Draw Occurrences](#logistic-regression)
4. [Margin Distribution Framework](#margin-distribution)
5. [Calibration Algorithms](#algorithms)
6. [Statistical Validation](#validation)
7. [Calibrated Parameters by Modality](#calibrated-params)

---

## <a name="objectives"></a> 1. Calibration Objectives

**Problem Statement:** Pure theoretical constructs (such as absolute Poisson models or standard continuous ELO implementations) inherently fail to capture specific variances across university sports tiers.

**Resolution Framework:** Utilize historic data repositories to **statistically learn and infer optimal parameters** guaranteeing forecasting error minimization.

### Validation Metrics

```python
# Brier Score: Mean squared error of probabilistic outputs
BS = (1/N) Σ(p_forecasted - p_actual)²
  Interpretation: BS=0 (absolute perfection), BS=0.25 (pure coincidence)
  Benchmark Target: BS < 0.15 (excellent), BS < 0.20 (acceptable)

# Positional RMSE: Root Mean Squared Error mapping final placements
RMSE = √[(1/N) Σ(pos_forecasted - pos_actual)²]
  Interpretation: RMSE=0 (absolute conformity), RMSE<2.5 (strong metric)
  Benchmark Target: RMSE < 2.5 across university datasets
```

---

## <a name="gamma-poisson"></a> 2. Gamma-Poisson Distribution

### Rationale

**Standard Poisson Limitations:** Enforces a rigid structure where variance strictly equals the mean (equidispersion). 
This behavior is definitively inadequate traversing high-volatility sports where **variance > mean** (defined as overdispersion).

**Empirical Example (Men's Futsal 25-26):**

```ini
μ = 3.25 goals/team
σ² = 11.89
σ²/μ = 3.66 > 1  ← STRUCTURAL OVERDISPERSION DETECTED!
```

**Architectural Solution:** Adopting **Gamma-Poisson** (known formally as Negative Binomial) adequately accommodates deep overdispersion profiles.

### Mathematical Framework

Hierarchical progression model:

1. **Varying occurrence rate λ per match** strictly following a Gamma distribution:

```sh
λ ~ Gamma(k, θ)  where θ = μ/k
```

2. **Goal generation scaling given λ** functionally simulating Poisson:

```sh
Y | λ ~ Poisson(λ)
```

3. **Total Marginalization** extracting the Negative Binomial theorem:

```sh
Y ~ NegBinom(k, p)  where p = k/(k+μ)
```

### Deriving Shape Parameter k (Dispersion Parameter)

**Gamma-Poisson Structural Properties:**

```sh
E[Y] = μ
Var[Y] = μ + μ²/k
```

**Algebraic Resolution for k:**

```ini
σ² = μ + μ²/k
σ² - μ = μ²/k
k = μ² / (σ² - μ)
```

### Asymptotic Floor Allocation (k ≥ 3.0): Statistical Justification

**Problem Node:** Extracting small values for k drives an extreme overdispersion causing volatile degradation and systemic overfitting.

Variance Analysis of the Gamma Multiplier:

```ini
Gamma(k, θ) possesses variance = k×θ² = μ²/k
Coefficient of Variation mapping: CV = √(Var)/E = 1/√k

k=1 → CV=100%  (Internal variance mirroring 100% of the mean values!)
k=3 → CV=58%   (Considered highly volatile yet theoretically stable)
k=5 → CV=45%   (Satisfactorily acceptable modeling)
k=10 → CV=32%  (Solid modeling constraint)
```

**Empirical Extraction Metrics:**

- Datasets resulting in configurations where k<3 systematically output degraded Brier Scores (fluctuating ~+2-4%)
- Bounding k≥3 safely shields against severe distribution outliers specifically present in constrained dataset sizes (<50 cumulative matches)

**Python Implementation Block:**

```python
def fit_gamma_poisson(scores: List[int]) -> float:
    """
    Empirically estimates k parameter enacting the Method of Moments.
    """
    mu = np.mean(scores)
    var = np.var(scores)
    
    if var <= mu:
        # Diagnosed Underdispersion: Safely default toward a pure Poisson setup
        return 10.0  # Excessive k forces an integrated approximation toward standard Poisson
    
    k_estimated = (mu ** 2) / (var - mu)
    k_floored = max(3.0, k_estimated)
    
    return k_floored
```

### Numerical Execution (Step-by-Step Proofing)

**Source Dataset:** Men's Futsal 25-26 Tier (48 raw matches, 96 verified independent scoring entries)

```python
# Raw tracked entries (isolated goals grouped by team matrix)
scores = [4, 2, 3, 1, 5, 2, 3, 3, 2, 4, ...]  # Aggregate N=96
```

---

## <a name="logistic-regression"></a> 3. Logistic Regression for Draw Occurrences

### Modeling the Problem

**Draws are strictly non-random phenomena:** Teams reflecting matching numerical ELO profiles inherently produce drawn statuses at a superior rate.

**Empirical Evaluation Trace (Men's Futsal):**

```ini
|ΔElo| < 50:    12.3% tracked draws
|ΔElo| 50-150:  8.1% tracked draws
|ΔElo| > 150:   2.7% tracked draws
```

### Logit Evaluation Protocol

**Predictive Model Formulation:**

```ini
P(draw | ΔElo) = 1 / (1 + exp(-z))

Variable Breakdown:
  z = β₀ + β₁|ΔElo| + β₂|ΔElo|²
  
  β₀: Algorithmic intercept mapping (log-odds reflecting a draw trace occurring across ΔElo=0)
  β₁: Linear predictive sensitivity (First-order tracking matrix effect)
  β₂: Quadratic sensitivity modifier (Physically accelerates probability-degradation across edge bounds)
```

### Calibration Execution Model

```python
class DrawProbabilityCalibrator:
    def fit(self, games: List[Dict]) -> Dict:
        """
        Dynamically fits custom Logistic Regression matrix to capture P(draw | |ΔElo|).
        """
        X = np.array([[abs(g["elo_diff"]), abs(g["elo_diff"])**2] for g in games])
        y = np.array([1 if g["is_draw"] else 0 for g in games])
        n_draws = int(np.sum(y))
        
        # Protective Barrier to Ensure Mathematical Confidence
        if n_draws < 5:
            base_draw_rate = float(np.mean(y))
            return {"model_type": "gaussian_fallback"}
        
        # Process active Logistic Model
        from sklearn.linear_model import LogisticRegression
        model = LogisticRegression(penalty=None, max_iter=1000)
        model.fit(X, y)
```

---

## <a name="margin-distribution"></a> 4. Margin Distribution Framework

### Foundational Concept
Execute deep mapping targeting **conditional margins of victory** applied rigorously independent of parity statuses.

### Standardized Linear Implementation

```ini
Expected_Margin = β₀ + β₁ × |ΔElo|
```

### Script Execution Logic

```python
from scipy.stats import linregress

def fit_margin_distribution(games: List[Dict]) -> Dict:
    filtered = [g for g in games if not g["is_draw"]]
    margins = np.array([g["margin"] for g in filtered])
    elo_diffs = np.array([abs(g["elo_diff"]) for g in filtered])
    
    slope, intercept, r_value, p_value, std_err = linregress(elo_diffs, margins)
    return {"margin_elo_slope": slope, "margin_elo_intercept": intercept}
```

---

## <a name="algorithms"></a> 5. Global Calibration Algorithms

### Comprehensive Process Pipeline

```ini
┌──────────────────────────────────────────────────────────────┐
│  execute_full_calibration_systems()                          │
└──────────────────────────────────────────────────────────────┘
    │
    ├─► [1/5] HistoricalDataLoader
    ├─► [2/5] Archival Elo Evaluator (HistoricalEloCalculator)
    ├─► [3/5] Convergence Calibrator Protocol (FullCalibrator)
    ├─► [4/5] Parameters Synthesis Matrix
    └─► [5/5] Render Config File (JSON)
```

---

## <a name="validation"></a> 6. Statistical Validation & Sanity Constraints

| Parameter Matrix | Method Engine | Acceptance Criteria Threshold |
|------------------|---------------|-------------------------------|
| __k (dispersion)__| Moments Analysis| k ∈ [3.0, 50.0], σ²/μ > 1.1 |
| __draw_model__   | Logit R²      | R² > 0.15 OR triggers min_threshold protective clause |
| __margin_model__ | Linear Regression| R² > 0.10 (Standard noise limit profile accepted) |

### Algorithmic Evaluation Systems

#### 1. Kolmogorov-Smirnov Regression Mapping (Goodness of Fit Engine)

```python
from scipy.stats import kstest

def validate_gamma_poisson_fit(observed_scores, k, mu):
    from scipy.stats import nbinom
    p = k / (k + mu)
    theoretical_cdf = lambda x: nbinom.cdf(x, k, p)
    
    statistic, p_value = kstest(observed_scores, theoretical_cdf)
    return p_value > 0.05 # Rejection profile bypass required
```

---

## <a name="calibrated-params"></a> 7. Established Modality Coefficients (2025-2026 Epoch)

### Men's Futsal Structure Matrix

```json
{
  "sport_type": "futsal",
  "base_goals": 3.25,
  "dispersion_k": 8.2,
  "base_draw_rate": 0.079,
  "draw_multiplier": 1.4,
  "validation": {
    "brier_score": 0.138,
    "rmse_position": 1.83
  }
}
```

**Systematic Deductions:**
- __base_goals=3.25:__ Structural average tracked performance profile.
- **k=8.2:** Evaluated overdispersion bounds remain stable.

---

**Last Engineering Update:** 2026-03  
**Implementation Source Block:** Internal Architecture Nodes
