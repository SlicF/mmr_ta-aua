# SPECIAL_CASES.md - Special Implementations and Edge Cases Engine

[🇵🇹 Ver Versão em Português](SPECIAL_CASES.md)

## Table of Contents

1. [Cross-Epoch Team Naming Transitions](#team-transitions)
2. [Variable Playoff Bracket Formats](#playoff-formats)
3. [Forfeiture and Gross Absence Handlers](#absence-handling)
4. [Complex Phonetic/Typographical Normalizations](#name-normalization)
5. [Dynamic Divisions and Component Clustering](#divisions-groups)
6. [Topological Sport Recognition Detection](#sport-detection)
7. [Atypical Internal Scoring Architectures](#scoring-edge-cases)
8. [Data Validation Matrix](#data-validation)

---

## <a name="team-transitions"></a> 1. Cross-Epoch Team Naming Transitions

### Execution Node 1.1: Functional Renaming Sequences

**Contextual Problem Analysis:**  
During the epoch transitions (24-25 directly moving into 25-26), institutional bodies altered nomenclature (e.g. "Contabilidade" formally becoming "Marketing"). 
Without formal instruction, ELO algorithms interpret these migrations as independent node additions forcing hard $1500$ ELO resets resulting in an absolute collapse of structural ranking integrity.

**Systemic Override Integration (`handle_special_team_transitions`):**

The algorithm executes explicit path routing preserving active legacy evaluations traversing identical subsets without disruption.

1. Identifies modal contexts activating overriding protocol constraints.
2. Identifies legacy variables locating the respective ELO values.
3. Formally re-indexes variables transferring entire active ELO profiles across.
4. Suppresses legacy tags concluding seamless transitions validated via automated `mmr_tacaua.log` trackers capturing verification parameters.

---

## <a name="playoff-formats"></a> 2. Variable Playoff Bracket Formats

### Execution Node 2.1: Bracket Node Filtering (Placeholders)

**Contextual Problem Analysis:**  
Organizers routinely append raw future bracket assignments (e.g., "1st Rank Group 1" vs "Winner QF1") inside extraction matrices. Without filtering, normalization protocols encode these tags generating fictitious, corrupted team arrays.

**Execution Engine Filtering (`normalize_team_name`):**

System utilizes aggressive internal RegEx filtering actively purging placeholder entities immediately:
- `"^\d+º\s+Class\."`: Intercepts and denies dynamic placeholders.
- `"^Vencedor|Vencido\s+"`: Binds and blocks conditional tournament progression nodes.
The node triggers hard `None` return statuses instead of empty strings actively blocking cascading corruption mapping inside the arrays.

---

## <a name="absence-handling"></a> 3. Forfeiture and Gross Absence Handlers

### Execution Node 3.1: Explicit Fail-to-Appear Handlers (WO)

**Systematic Complication Variables:**
1. **Model Baseline Distortions:** Unplayed $3-0$ technical forfeiture mappings completely distort empirical `base_goals` parameters escalating non-representative performance inflations.
2. **Predictive Degradation:** Calibration routines attempting mapping outputs inevitably structure regressions against fictitious arrays generating deep dataset contamination structures.

**Defensive Architecture Response:**
- Inside Extraction Calibration Matrices (`calibrator.py`): Absolutely purges documented presence-failure matrices ensuring Gamma-Poisson parameters scale against pure athletic performances.
- Inside ELO Updating Sequences (`mmr_taçaua.py`): Evaluates consequences adjusting hierarchical values actively accommodating victory thresholds (System ensures unplayed nodes accurately yield ELO penalties adjusting standing structures but preventing distribution degradation).

---

## <a name="name-normalization"></a> 4. Complex Phonetic/Typographical Normalizations

### Processing Abstraction Layers

To bypass natural language inconsistency, array pipelines utilize a rigorous 3-tiered sanitization approach:

**Layer 1: Accent and Unicode Decompositions (NFD)**
Executes native canonical mapping decoding formats translating structures completely mapping non-standard combinations into flat comparable keys strictly purging anomalies prior to array injection.

**Layer 2: Dictionaries and JSON Configuration Routines**
Implements definitive overrides enforcing strict standardization translating abbreviations against central truth maps `config_cursos.json`.

**Layer 3: Typographical Failsafe Matrices**
Intercepts legacy or known typographical variances not governed directly by procedural abstraction explicitly linking targets against known internal deviations mapping elements correctly directly ensuring data persistence remains perfectly structured.

---

## <a name="divisions-groups"></a> 5. Dynamic Divisions and Component Clustering

### Connectivity-based Graphing Inferences

System detects absent structural tags analyzing relational nodes mathematically. Unlocking connectivity configurations generating internal logic components translating independent graph nodes compiling inferred clusters without manual configuration inputs enabling dynamic evaluations processing standalone round-robin distributions explicitly executing array classification mappings cleanly executing tie-breaker algorithms autonomously.

---

**Protocol Maintenance Date:** 2026-03
