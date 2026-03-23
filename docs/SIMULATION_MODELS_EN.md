# SIMULATION_MODELS.md - Mathematical Sports Simulation Frameworks

[🇵🇹 Ver Versão em Português](SIMULATION_MODELS.md)

## Table of Contents

1. [Architectural Overview](#overview)
2. [MODEL A: Gamma-Poisson Matrices (Futsal, 7-A-Side Football)](#model-a)
3. [MODEL B: Forced-Draw Gamma-Poisson (Handball)](#model-b)
4. [MODEL C: Truncated Gaussian Approximations (3x3 Basketball)](#model-c)
5. [MODEL D: Stochastic Binary Sets (Volleyball)](#model-d)
6. [Dynamic Draw Resolution System](#draw-system)
7. [System Validation & Metrics](#validation)
8. [Design Trade-offs](#tradeoffs)

---

## <a name="overview"></a> 1. Architectural Overview

### Model Taxonomy

| Mathematical Model | Standard Application | Baseline Distribution Core | Admits Draw States? | Scaling Complexity |
|--------------------|----------------------|----------------------------|---------------------|--------------------|
| **A** | Futsal, 7-A-Side Football | Gamma-Poisson Regression | ✓ (Dynamic constraints) | O(1) |
| **B** | Handball variations | Gamma-Poisson Regression | ✓ (Fixed 55% constraint)| O(1) |
| **C** | 3x3 Basketball | Gaussian N(μ,σ) Truncated | ✗ (Forces Overtime rules) | O(1) |
| **D** | Volleyball | Stochastic binomial sets | ✗ (Structurally impossible) | O(1) |

### Functional Design Principles

1. **Empirical Calibration Grounding:** Systemic parameters dynamically learn solely from historic matrices (rejecting fixed theoretic arrays).
2. **Systemic ELO-driven Mappings:** Continuous rating transformations inherently manipulate internal distributions (`lambda`, `mu`, `p` nodes).
3. **Structured Overdispersion Rendering:** Actively embraces Gamma-Poisson logic handling volatile collegiate matrices where operational variance significantly exceeds baseline averages.
4. **Architectural Simplicity:** Parameter-driven linear processes (purposely bypassing Blackbox AI logic) supporting verifiable deterministic interpretations.

---

## <a name="model-a"></a> 2. MODEL A: Gamma-Poisson Matrices (Futsal, 7-A-Side Football)

### Baseline Application

- **Men's & Women's Futsal Modules**
- **Men's 7-A-Side Football Iterations**

Definitive Triggers:
- Low-ceiling aggregate scoring ($μ \approx 2-4$ goals/side)
- Draw ratios historically exist but occur infrequently ($<10\%$)
- Aggressive systemic overdispersion: $σ²/μ \approx 3-4$

### Complete Algorithmic Logic

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
    Executes standard Futsal/Football 7 simulation loops tracking dynamic draw mappings.
    """
    # ── PHASE 1: Dynamic Parity Resolution ─────────────────────────────
    elo_diff = abs(elo_a - elo_b)
    
    if has_calibrated_logit_model():
        z = intercept + coef_linear*elo_diff + coef_quad*(elo_diff**2)
        p_draw_base = 1 / (1 + exp(-z))
        p_draw = min(1.0, p_draw_base * draw_multiplier)
    else:
        # Fallback Operational Gaussian 
        sigma_draw = 180.0
        peak_rate = base_draw_rate * 2.5
        p_draw = peak_rate * exp(-(elo_diff**2) / (2*sigma_draw**2))
    
    # ── PHASE 2: Forced Draw Extraction ──────────────────────────────
    if random() < p_draw:
        goals = max(0, int(np.random.poisson(base_goals))) # Render realistic identical scores
        return (goals, goals)
    
    # ── PHASE 3: Dependant Goal Simulation Matrix ────────────────────
    elo_diff_scaled = (elo_a - elo_b) / elo_scale
    elo_diff_clamped = np.clip(elo_diff_scaled, -elo_adjustment_limit, elo_adjustment_limit)
    
    lambda_a = base_goals * (1 + elo_diff_clamped)
    lambda_b = base_goals * (1 - elo_diff_clamped)
    
    # Gamma-Poisson dependent sampling resolving:
    # Team A Output
    theta_a = lambda_a / dispersion_k
    mult_a = np.random.gamma(dispersion_k, theta_a)
    score_a = np.random.poisson(mult_a)
    
    # Team B Output
    theta_b = lambda_b / dispersion_k
    mult_b = np.random.gamma(dispersion_k, theta_b)
    score_b = np.random.poisson(mult_b)
    
    return (score_a, score_b)
```

---

## <a name="model-b"></a> 3. MODEL B: Forced-Draw Gamma-Poisson (Handball)

### Technical Branching Against Model A

1. __High Scoring Parameter Outputs:__ Absolute `base_goals` scales dramatically ($\approx 20-23$ occurrences per node)
2. **Elevated Draw Trajectories:** Calibrated $\approx 5.5\%$ structural draw rates 
3. **Heavy Forced-Draw Application:** 55% fractional constraint directly stopping runaway parity Poisson outputs.
4. __Restricting ELO Adjustment Scaling:__ Enforces ceiling cap at `elo_adjustment_limit = 0.45` inherently suppressing unrealistic blowout scenarios (e.g. 6-35 margins).

---

## <a name="model-c"></a> 4. MODEL C: Truncated Gaussian Approximations (3x3 Basketball)

### Unique Architecture Traits

- **Hard Match Point Ceiling:** Execution completely aborts once arbitrary nodes pass `21` total points.
- **Strictly Bans Draws:** Automatic overtime execution logic forces sudden-death mapping extensions.
- **Categorical Gaussian Outputs:** Utilizes exclusively Continuous Normal models removing traditional Poisson logic.

### Computational Simulation Sequence

```python
def simulate_basquete_3x3(elo_a, elo_b, base_score=9.51, sigma=5.2, elo_adjustment_limit=0.5):
    """
    Simulates 3x3 Basketball mapping sudden-death matrices explicitly.
    """
    # ── PHASE 1: REGULATION TRUNCATION ────────────────────────────
    elo_diff_scaled = (elo_a - elo_b) / 250
    elo_diff_clamped = np.clip(elo_diff_scaled, -elo_adjustment_limit, elo_adjustment_limit)
    
    mu_a = base_score + elo_diff_clamped
    mu_b = base_score - elo_diff_clamped
    
    score_a = np.clip(int(np.random.normal(mu_a, sigma)), 0, 21)
    score_b = np.clip(int(np.random.normal(mu_b, sigma)), 0, 21)
    
    if score_a != score_b: # Clear Winner
        return (score_a, score_b)
    
    # ── PHASE 2: SUDDEN DEATH RESOLUTION ──────────────────────────
    p_a_wins = 1 / (1 + 10**((elo_b - elo_a)/250))
    if random() < p_a_wins:
        return (score_a + 2, score_b) if random() < 0.30 else (score_a + 2, score_b + (1 if random() < 0.4 else 0))
    else:
        return (score_a, score_b + 2) if random() < 0.30 else (score_a + (1 if random() < 0.4 else 0), score_b + 2)
```

---

## <a name="model-d"></a> 5. MODEL D: Stochastic Binary Sets (Volleyball)

### Functional Set Mechanics

- **Mapping Format:** Absolute Best-of-3 output execution logic (Resulting strictly as: `2-0`, `2-1`).
- **P(Sweep) Probabilistic Sweeps:** `2-0` execution chance geometrically increases alongside relative `ΔElo` disparity margins.

### Stochastic Resolution Engine

```python
def simulate_voleibol(elo_a, elo_b, p_sweep_base=0.512, elo_scale=500):
    # ── 1: Absolute Winner Designation ──────────────────────────────
    p_a_wins = 1 / (1 + 10**((elo_b - elo_a)/elo_scale))
    winner_is_a = random() < p_a_wins
    
    # ── 2: Clean Sweep Resolution Generator ─────────────────────────
    elo_diff = abs(elo_a - elo_b)
    p_sweep = p_sweep_base + min(elo_diff / 800, 0.4) 
    is_sweep = random() < p_sweep
    
    # ── 3: Boolean Outcome Combinator ───────────────────────────────
    if winner_is_a:
        return (2, 0) if is_sweep else (2, 1)
    return (0, 2) if is_sweep else (1, 2)
```

---

## <a name="tradeoffs"></a> 6. System Design Trade-offs & Decisions

### 1. Pure Poisson vs Gamma-Poisson Hierarchies

| Decision Criteria | Pure Poisson | Structured Gamma-Poisson |
|-------------------|--------------|--------------------------|
| **Matrix Simplicity** | ✓ Minimal parameters | ✗ Demands extensive processing values |
| **Volatile Tracking** | ✗ Fails collegiate scaling | ✓ Overdispersion properly maps data spikes |
| **Brier Score Return**| Degrading (0.162) | **Highly Validated Accuracies (0.138)** ✓ |

**Core Conclusion:** Gamma-Poisson perfectly validates computational processing overhead strictly returning a $+14\%$ overall accuracy efficiency.

### 2. Multi-Processing Framework Parameters (GIL Override)

Implementing execution bypass through structured `ProcessPoolExecutor` directly resolves Python's internal **GIL** structural locking limits natively allocating intense multi-threaded simulations strictly scaling up $5\times \rightarrow 10\times$ calculation speeds executing continuous $1.000.000$ (Deep Monte Carlo) testing ranges effectively.
