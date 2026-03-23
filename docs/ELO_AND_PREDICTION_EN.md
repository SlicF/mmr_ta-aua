# Technical Documentation: ELO System and Prediction Engine

[🇵🇹 Ver Versão em Português](ELO_AND_PREDICTION.md)

Technical documentation outlining the computational ELO algorithms, statistical parameter calibration frameworks, and the scalable Monte Carlo simulation engine fundamentally integrated within the `mmr_taçaua` project.

---

## 1. System Architecture (`CompleteTacauaEloSystem`)

The core engine class `CompleteTacauaEloSystem` (deployed across `src/preditor.py` and `src/mmr_taçaua.py`) processes a uniquely altered continuous ELO mapping logic directly calibrated against collegiate parameters.

### 1.1 Fundamental Equation Target

Diverging from pure standard binary ELO states (win/loss ratios), the system enforces a fractional margin of victory:

$$ \Delta ELO = K \times (Score_{actual} - Score_{expected}) $$

**Global Variable Parameters:**
- **K (Volatility Parameter):** Governs exact numerical impact per recorded individual game sequence.
- **Expected Score Status:** A priori mathematical probability mapped functionally against opponent strength discrepancies.
- **Actual Score Status:** Purged and fully normalized match outputs.

### 1.2 Win Probability Function (Logarithmic)

Probabilistic forecasting calculating Team A's potential against Team B operates heavily alongside a standard base-10 logistic progression:

$$ P(A) = \frac{1}{1 + 10^{(ELO_B - ELO_A)/250}} $$

> **Technical Insight:** Reducing the scaling threshold coefficient explicitly down toward **250** (opposing conventional structures relying upon 400 for classical implementations like chess) profoundly accelerates variance responsiveness. Thus validating: isolated 250 point ELO separations reflect hard 90% dominance thresholds naturally aligned against unstable performance deviations inherently seen throughout collegiate sports environments.

### 1.3 K-Factor Dynamics ($K_{factor}$)

The critical computational hallmark stems extensively from its uniquely adaptable recalculator engine executing match-by-match operations:

$$ K = K_{base} \times M_{phase} \times M_{proportion} $$

Given fixed baseline constraints where $K_{base} = 100$.

#### A. Temporal Trajectory (Phase Multiplier - $M_{phase}$)

Relative fixture weighting oscillates contingent upon macro competition phases:
1. **Calibration Entry (Early Phase Rotation):**
   Aggressively amplifying values throughout the primary 33% event thresholds securing rapidly accelerated accurate rating placements.
   $$ M_{phase} = \frac{1}{\log_{16}(4 \times scaled\_progress)} $$
2. **Post-Winter Transition Phase (Re-calibration Matrix):**
   Mirroring structural adjustments accommodating form momentum deviations normally experienced after extensive semantic mid-season gaps.
3. **Elimination Modules (Playoffs):** Fixed $M_{phase} = 1.5$ ceiling (+50% weight).
4. **Third/Fourth Decisive Round:** Restrictive $M_{phase} = 0.75$ baseline (-25% dampening effect).

#### B. Score Margin (Proportional Multiplier - $M_{proportion}$)

Bypassing restrictive singular thresholds (differentiating naturally 1-0 victories against absolute 10-0 anomalies), soft logarithmic scalars handle raw results dynamically:

$$ M_{proportion} = \left( \frac{\max(Goals_A, Goals_B)}{\min(Goals_A, Goals_B)} \right)^{1/10} $$

> **Functional Result:** Executing victories such as 10-1 produces direct multipliers scaling toward $10^{0.1} \approx 1.26$. Ultimately securing an aggregate 26% bonus over generic victories while avoiding catastrophic inflation logic generally typical across high-scoring disciplines through rigorous Tenth-root fractional bindings.

---

## 2. Automated Statistical Calibration Engine (`FullCalibrator`)

The external utility application `calibrator.py` dynamically infers parameter conditions directly mapped over accumulated empirical histories per targeted modality. Operating strictly compartmentalized by division constraints.

### 2.1 Complete Algorithmic Calibration Steps

1. **Extraction Loader Module** (`HistoricalDataLoader`):
   - Safely interprets all pre-processed normalized archival grids
   - **Absence Constraints Filtration:** Strips invalid node sequences (defined exclusively under missing/forfeit tags matching `has_absence`)
   - Statistical Logic: Inconsistent external "paper" score outcomes explicitly fabricate false trends artificially inflating core `base_goals` parameters.

2. **Scoring Dispersion Regimes** (`GoalsDistributionCalibrator`):
   - Resolves underlying standard average targets (`base_goals`)
   - Evaluates Gamma-shape parameters representing standard dispersion shapes (`dispersion_k`)
   - **Internal Control Condition:** Solid floor binding locking `dispersion_k ≥ 3.0` (defensively prevents erratic behaviors across minuscule isolated variables)
   - Method Execution: $k = \frac{\mu^2}{\sigma^2 - \mu}$ mapped directly alongside mean $(\mu)$ and variance limits $(\sigma^2)$.

3. **Draw Event Probability Regressions** (`DrawProbabilityCalibrator`):
   - Constructs linear equations matching: $P(draw) = \frac{1}{1 + e^{-(a + b \times diff\_elo)}}$
   - **Dataset Viability Threshold Restrictions:** Requires $n\_draws ≥ 5$ absolutely shielding against dangerous overfitting parameters
   - **Logical Model Sanity Testing:** Fully denies processes generating intercepted constraints exceeding $|t| > 100$ or active linear coefficients spanning values beyond $|c| > 10$.
   - Failing Criteria Operations: Redirects operational bounds utilizing Gaussian alternative configurations.

### 2.2 Functional Calibrated Node Arrays

Generated system variables target unique output references directed exclusively into overarching configurations files (`calibrated_simulator_config.json`):

**Global Core Operations Elements:**
- `base_goals`: Structural generic goals/points expected performance averages
- `dispersion_k`: Active Poisson configuration scalar tracking inherent deviations
- `elo_adjustment_limit`: Total ceiling blocking excess variable scaling
- `draw_model`: Output intercepts and constraints controlling logistic equations
- `draw_multiplier`: Amplification/normalization fine-tuning indices evaluating global draw values

**Basketball Specific Parameters:**
- `base_score`: Baseline points expectation substituting simple objective values driving Gaussian probability states
- `sigma`: Absolute point spread variance matrix mappings

**Volleyball Matrix Sets:**
- `p_sweep_base`: Baseline unconditional likelihood predicting clean 2-0 match sweeps
- Calculated strictly mirroring raw historical percentages $\frac{\text{sum 2-0 outputs}}{\text{total matches}}$

### 2.3 Verified Practical Demonstrations

**Female Futsal Limited Sample Resolution Evaluation:**
- Exclusively mapped 1 single categorical draw output against 66 documented encounters
- Internal System Action: Intentionally aborted and bypassed standard `draw_model` creation logic (Insufficient Data Traps)
- Underlying tracked `dispersion_k` values output parameters at 1.38 → System intentionally blocked operations actively enforcing rigid 3.0 floor safety constraints.
- Structural Verdict: Effectively preventing chaotic statistical overfitting events while eliminating artificial simulation distortions.

---

## 3. Core Simulation Matrix (`SportScoreSimulator`)

Embedded predictive processes natively structured into `preditor.py` execute large-scale Monte Carlo engines mapping directly toward calibrated system distributions. Providing pinpoint accurate result distributions mapped correctly instead of standard simplified W/L/D abstractions.

### 3.1 Distinct Operative Paradigms

Unique computational operations define individual tracking models controlling dynamically modified conditions evaluating $\lambda$, $\mu$, and $\sigma$ parameters mapped conditionally according to relative hierarchical scaling. 

#### System Type A: Futsal/7-A-Side (Gamma-Poisson Multipliers)
Targets intrinsically low-score modalities tracking robust variance limits.

**Core Trajectory Iteration:**
1. Tracks preliminary constraints reflecting the standard mapped baseline limits matching `base_goals`.
2. Augments matrices dynamically applying competitive ranges calculated alongside limits restricting excess expansion scopes.
3. Produces multiplier effects generated probabilistically matching target thresholds operating off `dispersion_k` parameter ranges.
4. Generates definitive output scores simulating $Poisson(\lambda_{final})$.

**Architectural Benefit:** Allows naturally occurring parity/draw events effectively capturing deeply accurate chaotic variance conditions typically found within unpredictable sports environments.

#### System Type B: Basketball/Handball (Continuous Gaussian Mappings)
Functions exclusively structured handling higher scalar ranges tracking specific performance behaviors properly replicating Normal Standard tracking protocols heavily mapping baseline outputs over corresponding internal variables $\sigma$ thresholds limiting volatile fluctuations safely mitigating chaotic blowout situations.

#### System Type C: Volleyball (Direct Set Matrix Simulator)
Disengages classical probabilistic mappings explicitly mirroring standard independent discrete rounds modeled across binary sequence generators. Matches calculate outcomes directly applying hierarchical configurations controlling probabilities against custom baseline configurations.

### 3.2 High-Dimensional Output Rendering

Generated output logs systematically list detailed matrix sequences across predictive data points rendering the probability calculations and their corresponding exact scores distributions generating explicit values indicating specific scenarios probability frequencies.  Calculations natively factor average weights matching each exact outcome simulating real statistical events consistently maintaining functional precision mappings.

---

## 4. Execution Pipeline & Structural Dependencies

Procedural logic mapping strict cascading executions executing automated extraction mapping.

### Critical Processing Commands

```bash
cd src
python extrator.py      # [Action 1] Generates formatted standardized arrays
python mmr_taçaua.py    # [Action 2] Generates dynamic active internal ELO mappings
python calibrator.py    # [Action 3] Interprets arrays configuring probabilistic simulations
python preditor.py      # [Action 4] Executes massive statistical probabilities
```

- Target dependency trees strictly define sequences ensuring `calibrator.py` correctly absorbs up-to-date variables produced explicitly by active tracking engines directly linked alongside operations managing internal data updates successfully configuring precise system behaviors maintaining robust tracking pipelines securely.
