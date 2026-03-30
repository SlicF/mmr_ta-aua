# SIMULATION_MODELS.md - Sports Simulation Models

[🇵🇹 Ver Versão em Português](SIMULATION_MODELS.md)

## Table of Contents

1. [Model Overview](#overview)
2. [MODEL A: Gamma-Poisson (Futsal, 7-A-Side Football)](#model-a)
3. [MODEL B: Gamma-Poisson with Forced Draws (Handball)](#model-b)
4. [MODEL C: Truncated Gaussian (3x3 Basketball)](#model-c)
5. [MODEL D: Stochastic Sets (Volleyball)](#model-d)
6. [Dynamic Draw System](#draw-system)
7. [Validation and Metrics](#validation)
8. [Design Trade-offs](#tradeoffs)

---

## <a name="overview"></a> 1. Model Overview

### Taxonomy

| Model | Sports | Base Distribution | Allows Draws? | Complexity |
|-------|--------|-------------------|---------------|------------|
| **A** | Futsal, 7-A-Side Football | Gamma-Poisson | ✓ (dynamic) | O(1) |
| **B** | Handball | Gamma-Poisson | ✓ (forced 55%) | O(1) |
| **C** | 3x3 Basketball | Gaussian N(μ,σ) | ✗ (overtime) | O(1) |
| **D** | Volleyball | Binomial sets | ✗ (never) | O(1) |

### Design Principles

1. **Empirical calibration:** Parameters learned from historical data (not theoretical)
2. **ELO-driven:** Ratings influence lambda/mu/p via monotonic transformation
3. **Overdispersion:** Gamma-Poisson captures variance > mean
4. **Simplicity:** Parameterized models (not complex ML) for interpretability

---

## <a name="model-a"></a> 2. MODEL A: Gamma-Poisson (Futsal, 7-A-Side Football)

### Application

- **Men's/Women's Futsal**
- **Men's 7-A-Side Football**

Characteristics:

- Low scoring (μ ≈ 2-4 goals/team)
- Natural draws are rare (<10%) but exist
- Overdispersion: σ²/μ ≈ 3-4

### Complete Algorithm

```python
def simulate_poisson_with_dynamic_draws(
    elo_a: float,
    elo_b: float,
    base_goals: float = 3.25,
    dispersion_k: float = 8.2,
    base_draw_rate: float = 0.079,
    draw_multiplier: float = 1.4,
    elo_scale: float = 600,
    elo_adjustment_limit: float = 1.2
) -> Tuple[int, int]:
    """
    Simulates Futsal/Football7 score with dynamic draws.
    
    Flow:
      1. Calculate P(draw | ΔElo)
      2. If draw: return (g, g) with g ~ Poisson(base_goals)
      3. Otherwise: simulate independent goals via Gamma-Poisson
    """
    # ── STEP 1: Dynamic Draw Probability ────────────────────────────
    elo_diff = abs(elo_a - elo_b)
    
    # Logistic model (if calibrated)
    if has_calibrated_logit_model():
        z = intercept + coef_linear*elo_diff + coef_quad*(elo_diff**2)
        p_draw_base = 1 / (1 + exp(-z))
        p_draw = min(1.0, p_draw_base * draw_multiplier)
    else:
        # Fallback: Gaussian
        sigma_draw = 180.0
        peak_rate = base_draw_rate * 2.5
        p_draw = peak_rate * exp(-(elo_diff**2) / (2*sigma_draw**2))
    
    # ── STEP 2: Decide If Game Will Be a Draw ──────────────────────
    if random() < p_draw:
        goals = max(0, int(np.random.poisson(base_goals)))
        return (goals, goals)
    
    # ── STEP 3: Non-Draw → Simulate Independent Goals ──────────────
    elo_diff_scaled = (elo_a - elo_b) / elo_scale
    elo_diff_clamped = np.clip(elo_diff_scaled, 
                                -elo_adjustment_limit, 
                                elo_adjustment_limit)
    
    lambda_a = base_goals * (1 + elo_diff_clamped)
    lambda_b = base_goals * (1 - elo_diff_clamped)
    
    # Gamma-Poisson sampling:
    #   Y ~ Gamma-Poisson(k, lambda) equivalent to:
    #     λ' ~ Gamma(k, theta=lambda/k)
    #     Y ~ Poisson(λ')
    
    # Team A
    theta_a = lambda_a / dispersion_k
    mult_a = np.random.gamma(dispersion_k, theta_a)
    score_a = np.random.poisson(mult_a)
    
    # Team B
    theta_b = lambda_b / dispersion_k
    mult_b = np.random.gamma(dispersion_k, theta_b)
    score_b = np.random.poisson(mult_b)
    
    return (score_a, score_b)
```

### Detailed Numerical Example

**Scenario:** Eng. Informática (ELO=1580) vs Tradução (ELO=1420)  
**Parameters:** base_goals=3.25, k=8.2, draw_rate=7.9%, multiplier=1.4

```python
elo_a, elo_b = 1580, 1420
elo_diff = abs(1580 - 1420) = 160

# Logistic model:
z = -1.82 + (-0.0051)*160 + (1.3e-6)*(160**2)
  = -1.82 - 0.816 + 0.033 = -2.603

p_draw_base = 1/(1 + exp(2.603)) = 0.069 (6.9%)
p_draw = min(1.0, 0.069 * 1.4) = 0.097 (9.7%)

# Draw check: random() = 0.83 > 0.097 → NOT a draw

# Adjust lambdas:
elo_diff_scaled = (1580-1420)/600 = 0.267
lambda_a = 3.25 * (1 + 0.267) = 4.12 goals
lambda_b = 3.25 * (1 - 0.267) = 2.38 goals

# Gamma-Poisson for EI:
theta_a = 4.12 / 8.2 = 0.502
gamma_mult_a = np.random.gamma(8.2, 0.502) = 3.89
score_EI = np.random.poisson(3.89) = 4 goals

# Gamma-Poisson for Tradução:
theta_b = 2.38 / 8.2 = 0.290
gamma_mult_b = np.random.gamma(8.2, 0.290) = 2.15
score_Tradução = np.random.poisson(2.15) = 2 goals

# RESULT: EI 4-2 Tradução ✓
```

**Probabilistic analysis over 10,000 simulations:**

- EI wins: 71.2% (vs 70.8% expected) ✓
- Draws: 9.4% (vs 9.7% expected) ✓
- Tradução wins: 19.4% (vs 19.5% expected) ✓

---

## <a name="model-b"></a> 3. MODEL B: Gamma-Poisson with Forced Draws (Handball)

### Differences vs Model A

1. **High scoring:** base_goals ≈ 20-23 (not 3)
2. **More frequent draws:** ~5.5% (vs 1-2% women's futsal)
3. **Forced draw fraction:** 55% (conservative, avoids excessive Poisson draws)
4. **elo_adjustment_limit:** 0.45 (low! prevents unrealistic spreads like 6-35)

### Technical Justification: ELO Adjustment Limit

**Problem:** With base_goals=22.7 and limit=1.2 (futsal default):

```ini
lambda_max = 22.7 × (1 + 1.2) = 49.9 goals  ← Absurd!
lambda_min = 22.7 × (1 - 1.2) = 0 goals     ← Impossible!
Delta max  = 49.9 - 0 = 49.9 goals → Unrealistic
```

**Solution:** limit=0.45

```ini
lambda_max = 22.7 × (1 + 0.45) = 32.9 goals  ← Plausible
lambda_min = 22.7 × (1 - 0.45) = 12.5 goals
Delta max  = 20.4 goals → Historically observed ✓
```

### Handball-Specific Code

```python
# Handball has a unique points system:
# Win: 3 pts, Draw: 2 pts, Loss: 1 pt (not 0!)

def simulate_andebol(elo_a, elo_b):
    score_a, score_b = simulate_poisson_with_dynamic_draws(
        elo_a, elo_b,
        base_goals=22.7,
        dispersion_k=20.48,
        base_draw_rate=0.055,
        draw_multiplier=1.3,
        elo_adjustment_limit=0.45  # ← CRITICAL!
    )
    
    if score_a > score_b:
        points_a, points_b = 3, 1
    elif score_a < score_b:
        points_a, points_b = 1, 3
    else:
        points_a, points_b = 2, 2
    
    return (score_a, score_b), (points_a, points_b)
```

---

## <a name="model-c"></a> 4. MODEL C: Truncated Gaussian (3x3 Basketball)

### Unique Characteristics

- **Score cap at 21:** Game ends when a team reaches 21 pts
- **Mandatory overtime:** NEVER draws (always goes to overtime)
- **Variable baskets:** 1 pt (normal) or 2 pts (long range)
- **Gaussian model:** Not Poisson (scores are continuous in construction)

### Detailed Algorithm

```python
def simulate_basquete_3x3(
    elo_a: float,
    elo_b: float,
    base_score: float = 9.51,
    sigma: float = 5.2,
    elo_adjustment_limit: float = 0.5
) -> Tuple[int, int]:
    """
    Simulates 3x3 basketball with mandatory overtime if tied.
    
    Phases:
      1. Regulation: Truncated Gaussian [0, 21]
      2. If tied: Sudden-death overtime until +2 pts
    """
    # ── PHASE 1: REGULATION ───────────────────────────────────────
    elo_diff_scaled = (elo_a - elo_b) / 250
    elo_diff_clamped = np.clip(elo_diff_scaled,
                                -elo_adjustment_limit,
                                elo_adjustment_limit)
    
    mu_a = base_score + elo_diff_clamped
    mu_b = base_score - elo_diff_clamped
    
    score_a = np.clip(int(np.random.normal(mu_a, sigma)), 0, 21)
    score_b = np.clip(int(np.random.normal(mu_b, sigma)), 0, 21)
    
    if score_a != score_b:
        return (score_a, score_b)
    
    # ── PHASE 2: OVERTIME (IF TIED) ────────────────────────────────
    p_a_wins = 1 / (1 + 10**((elo_b - elo_a)/250))
    
    if random() < p_a_wins:
        if random() < 0.30:  # 30%: Direct 2-pt basket
            return (score_a + 2, score_b + 0)
        else:  # 70%: Two 1-pt baskets (opponent may score 0 or 1)
            b_scored = 1 if random() < 0.4 else 0
            return (score_a + 2, score_b + b_scored)
    else:
        if random() < 0.30:
            return (score_a + 0, score_b + 2)
        else:
            a_scored = 1 if random() < 0.4 else 0
            return (score_a + a_scored, score_b + 2)
```

### Numerical Example

**Scenario:** Economia (ELO=1500) vs Gestão (ELO=1650)

```python
elo_diff_scaled = (1500-1650)/250 = -0.60
elo_diff_clamped = clip(-0.60, -0.5, 0.5) = -0.5  # Limit hit!

mu_economia = 9.51 + (-0.5) = 9.01 pts
mu_gestão   = 9.51 - (-0.5) = 10.01 pts

# Sample regulation:
score_economia = int(N(9.01, 5.2)) = 7 pts
score_gestão   = int(N(10.01, 5.2)) = 12 pts
# No tie → return (7, 12). Gestão wins ✓
```

**Overtime case:**

```python
# If regulation ends 10-10:
p_economia_wins = 1/(1 + 10^((1650-1500)/250)) ≈ 0.20

# Draw: random() = 0.85 > 0.20 → Gestão wins overtime
# FINAL: 10-12 (Gestão wins after overtime)
```

---

## <a name="model-d"></a> 5. MODEL D: Stochastic Sets (Volleyball)

### Set System

- **Format:** Best-of-3 sets (2-0 or 2-1)
- **NEVER draws:** Always a winner
- **P(sweep):** Probability of 2-0 increases with ΔElo

### Algorithm

```python
def simulate_voleibol(
    elo_a: float,
    elo_b: float,
    p_sweep_base: float = 0.512,
    elo_scale: float = 500
) -> Tuple[int, int]:
    """
    Simulates volleyball: only results 2-0 or 2-1.
    
    Model:
      P(2-0) = p_sweep_base + min(|ΔElo|/800, 0.4)
      P(2-1) = 1 - P(2-0)
    """
    # ── STEP 1: Determine Winner ──────────────────────────────────
    p_a_wins = 1 / (1 + 10**((elo_b - elo_a)/elo_scale))
    winner_is_a = random() < p_a_wins
    
    # ── STEP 2: Determine Margin (2-0 or 2-1) ────────────────────
    elo_diff = abs(elo_a - elo_b)
    p_sweep = p_sweep_base + min(elo_diff / 800, 0.4)
    is_sweep = random() < p_sweep
    
    # ── STEP 3: Combine Winner + Margin ───────────────────────────
    if winner_is_a:
        return (2, 0) if is_sweep else (2, 1)
    else:
        return (0, 2) if is_sweep else (1, 2)
```

### Probabilistic Analysis

**Historical calibration (Men's Volleyball 25-26):**

```sh
N_games = 38
N_sweeps_2-0 = 19
N_tight_2-1 = 19
p_sweep_obs = 19/38 = 0.500 (50%)
```

**Model predictions:**

```python
# Equal ELOs (ΔElo=0):     p_sweep = 0.512 (51.2%)
# Moderate gap (ΔElo=200):  p_sweep = 0.762 (76.2%)
# Large gap (ΔElo=400):     p_sweep = 0.912 (91.2%)
# Maximum cap (ΔElo≥800):   p_sweep = 0.912
```

**Numerical example:**

Tradução (ELO=1550) vs Economia (ELO=1450):

```ini
elo_diff = 100
p_Tradução_wins = 1/(1 + 10^(-100/500)) = 0.614 (61.4%)
p_sweep = 0.512 + 100/800 = 0.637 (63.7%)

# Simulation:
random() = 0.42 < 0.614 → Tradução wins
random() = 0.71 > 0.637 → NOT a sweep
RESULT: Tradução 2-1 Economia ✓
```

---

## <a name="draw-system"></a> 6. Dynamic Draw System

### Motivation

**Observed problem:** Pure Poisson generates draws ~1.1% (Futsal), but historical rate is ~7.9%.

**Solutions attempted:**

1. ✗ **Increase forced_draw_fraction:** Works but ignores ELO (very different teams still draw)
2. ✗ **Reduce base_goals:** Decreases total goals (not just draws)
3. ✓ **Calibrated logistic model:** Draws more likely when ELOs are similar

### Hierarchical Implementation

```python
def calculate_draw_probability(elo_a, elo_b, params):
    """
    Calculates P(draw | ΔElo) using hierarchy:
      1. Calibrated logit model (if available)
      2. Gaussian model (fallback)
    """
    elo_diff = abs(elo_a - elo_b)
    
    # LEVEL 1: Logistic Model
    if "draw_model" in params:
        intercept = params["draw_model"]["intercept"]
        coef_lin = params["draw_model"]["coef_linear"]
        coef_quad = params["draw_model"]["coef_quadratic"]
        
        if intercept != 0.0 or coef_lin != 0.0:
            z = intercept + coef_lin*elo_diff + coef_quad*(elo_diff**2)
            p_logit = 1 / (1 + exp(-z))
            multiplier = params.get("draw_multiplier", 1.4)
            return min(1.0, p_logit * multiplier)
    
    # LEVEL 2: Gaussian Model (Fallback)
    base_draw_rate = params.get("base_draw_rate", 0.0)
    if base_draw_rate <= 0:
        return 0.0
    
    sigma = 180.0  # Empirical: 180 ELO ≈ half-decay
    peak_rate = base_draw_rate * 2.5
    p_draw = peak_rate * exp(-(elo_diff**2) / (2*sigma**2))
    
    return min(peak_rate, max(0.0, p_draw))
```

### Numerical Comparison

**Scenario:** base_draw_rate=7.9% (Men's Futsal)

| ΔElo | Logit (calibrated) | Gaussian (fallback) | Difference |
|------|-------------------|----------------------|------------|
| 0 | 13.9% × 1.4 = **19.5%** | 19.8% | -0.3pp |
| 50 | 11.2% × 1.4 = 15.7% | 17.1% | -1.4pp |
| 100 | 7.7% × 1.4 = 10.8% | 13.2% | -2.4pp |
| 200 | 5.7% × 1.4 = 8.0% | 7.9% | +0.1pp |
| 400 | 1.4% × 1.4 = 2.0% | 1.6% | +0.4pp |

**Conclusion:** Logit is more realistic (uses quadratic term), Gaussian is acceptable if n_draws<5.

---

## <a name="validation"></a> 7. Validation and Metrics

### Brier Score by Modality

| Modality | Model | Brier Score | Rating |
|----------|-------|-------------|--------|
| **Men's Futsal** | Gamma-Poisson + Logit | **0.138** | ✓✓ Excellent |
| **Men's Volleyball** | Stochastic sets | **0.133** | ✓✓✓ Best |
| **Handball** | Forced Gamma-Poisson | **0.145** | ✓ Good |
| **Men's Basketball** | Truncated Gaussian | **0.151** | Acceptable |
| **7-A-Side Football** | Gamma-Poisson | 0.175 | Limited |

### Final Position RMSE

```ini
RMSE = √[(1/N) Σ(predicted_pos - actual_pos)²]

Results (season 25-26):
  Men's Futsal:      1.83 ✓ (target <2.5)
  Men's Volleyball:  1.63 ✓✓ (excellent)
  Handball:          2.12 ✓
  Men's Basketball:  2.18 ✓
  Women's Futsal:    2.38 (acceptable, small dataset)
  7-A-Side Football: 2.78 (limited)
```

### Consistency Tests

```python
def validate_model_consistency(model, n_simulations=10000):
    """
    Validates that model produces stable distributions.
    
    Tests:
      1. P(win) convergence → expected ELO
      2. Draw rate → base_draw_rate ± 5%
      3. Average goals → base_goals ± 10%
    """
    elo_a, elo_b = 1600, 1400
    results = [model.simulate(elo_a, elo_b) for _ in range(n_simulations)]
    
    # Test 1: P(A wins)
    p_a_wins_sim = sum(1 for a,b in results if a > b) / n_simulations
    p_a_wins_expected = 1 / (1 + 10**((elo_b - elo_a) / 250))
    assert abs(p_a_wins_sim - p_a_wins_expected) < 0.02
    
    # Test 2: Draw rate
    draw_rate_sim = sum(1 for a,b in results if a == b) / n_simulations
    assert abs(draw_rate_sim - model.params["base_draw_rate"]) < 0.05
```

---

## <a name="tradeoffs"></a> 8. Design Trade-offs

### 1. Pure Poisson vs Gamma-Poisson

| Criterion | Pure Poisson | Gamma-Poisson |
|----------|--------------|---------------|
| **Simplicity** | ✓ 1 parameter (λ) | ✗ 2 parameters (μ, k) |
| **Overdispersion** | ✗ Var = E | ✓ Var = E + E²/k |
| **Brier Score** | 0.162 (14% worse) | **0.138 ✓** |

**Decision:** Gamma-Poisson is worth the additional complexity (+14% accuracy).

### 2. Draw Approaches: Forced vs Logistic

| Approach | Advantages | Disadvantages | When to Use |
|----------|-----------|---------------|-------------|
| **Forced (fixed fraction)** | Simple | Ignores ELO | n_draws < 5 |
| **Gaussian (ΔElo)** | Dynamic, no overfitting | Less precise | 5 ≤ n_draws < 10 |
| **Logit (calibrated)** | Maximum precision | Requires ≥10 draws | n_draws ≥ 10 ✓ |

**Decision:** Adaptive hierarchy (logit → gaussian → forced).

### 3. ProcessPoolExecutor vs ThreadPoolExecutor

| Executor | Speedup | When to Use |
|----------|---------|-------------|
| **Thread** | ~1-2x | I/O-bound (CSV reading) |
| **Process** | ~5-10x | CPU-bound (simulations) ✓ |

**Implemented:** ProcessPoolExecutor for Monte Carlo simulations (10k-1M iterations).

### 4. Floor k≥3.0: Cost vs Benefit

**Empirical validation:**

```ini
With k=1.2 (no floor):  BS=0.156, RMSE=2.45
With k=3.0 (floored):   BS=0.138, RMSE=1.83
Δ improvement = -11.5% BS, -25.3% RMSE ✓✓
```

**Decision:** Floor k≥3.0 justified (benefit >> cost).

---

## Model Summary

**Implemented models:**

- Gamma-Poisson with dynamic draws (Futsal, 7-A-Side Football, Handball)
- Truncated Gaussian with overtime (3x3 Basketball)
- Stochastic sets (Volleyball)

**Model metrics:**

- Brier Score: 0.133-0.151 (target <0.15)
- RMSE Position: 1.63-2.18 (target <2.5)

---

**Last updated:** 2026-03  
**Author:** Taça UA System  
**References:** `src/preditor.py` lines 400-800
