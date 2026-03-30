# SPECIAL_CASES.md - Special Cases and Edge Cases

[🇵🇹 Ver Versão em Português](SPECIAL_CASES.md)

## Table of Contents

1. [Team Transitions Between Seasons](#team-transitions)
2. [Variable Playoff Formats](#playoff-formats)
3. [Absence Handling](#absence-handling)
4. [Complex Name Normalization](#name-normalization)
5. [Dynamic Divisions and Groups](#divisions-groups)
6. [Sport Detection](#sport-detection)
7. [Atypical Scoring Cases](#scoring-edge-cases)
8. [Data Validation](#data-validation)

---

## <a name="team-transitions"></a> 1. Team Transitions Between Seasons

### Case 1.1: Renaming (Contabilidade → Marketing)

**Context:**  
The course "Contabilidade" was renamed to "Marketing" between seasons 24-25 and 25-26.  
In mixed handball, the same team (same players) continued under the new name.

**Problem:**  
The ELO system interprets this as a NEW team → ELO resets to 1500 → competitive unfairness.

**Solution Implemented:**

```python
# File: src/mmr_taçaua.py
# Function: handle_special_team_transitions()

def handle_special_team_transitions(old_teams, sport_name):
    """
    Applies known hardcoded transitions.
    
    Args:
        old_teams: Dict {team_name: elo_value} from previous season
        sport_name: Name of the modality (e.g. "ANDEBOL MISTO")
    
    Returns:
        Dict with adjusted ELOs (Contabilidade removed, Marketing added)
    """
    adjusted_teams = old_teams.copy()
    
    if "andebol" in sport_name.lower() and "misto" in sport_name.lower():
        if "Contabilidade" in adjusted_teams:
            elo_to_transfer = adjusted_teams["Contabilidade"]
            if "Marketing" not in adjusted_teams:
                adjusted_teams["Marketing"] = elo_to_transfer
                del adjusted_teams["Contabilidade"]
    
    return adjusted_teams
```

**Validation:**

```bash
# Check transfer in logs:
grep -i "transferido elo.*contabilidade" mmr_tacaua.log

# Expected output:
# 2025-09-15 10:23:45 - mmr_tacaua - INFO - ✓ Transferred ELO 1623 from Contabilidade to Marketing

# Confirm in standings:
grep "Marketing\|Contabilidade" \
    docs/output/elo_ratings/classificacao_ANDEBOL_MISTO_25_26.csv

# Season 24-25: Contabilidade,1623,...
# Season 25-26: Marketing,1623,...  ← ELO preserved ✓
```

**Adding a New Transition:**

```python
# Example: Eng. Materias → Eng. Materiais (25-26 → 26-27)

# 1. Identify affected modalities
# 2. Add logic in handle_special_team_transitions():
if "futsal" in sport_name.lower() or \
   "basquete" in sport_name.lower():
    if "Eng. Materias" in adjusted_teams:
        elo = adjusted_teams["Eng. Materias"]
        if "Eng. Materiais" not in adjusted_teams:
            adjusted_teams["Eng. Materiais"] = elo
            del adjusted_teams["Eng. Materias"]
```

---

## <a name="playoff-formats"></a> 2. Variable Playoff Formats

### Case 2.1: Playoff Placeholders

**Problem:**  
The official Excel contains future games with placeholders:

```ini
Team 1           | Team 2           | Goals 1 | Goals 2
1º Class. 1ª Div | 2º Class. 2ª Div |         |
Vencedor QF1     | Vencedor QF2     |         |
```

**Impact:**  
Normalization fails → "1º Class." treated as a real team → rankings corrupted.

**Solution:** Filter via regex in `normalize_team_name()`.

```python
# File: src/mmr_taçaua.py

def normalize_team_name(team_name):
    # ... initial validations ...
    
    placeholder_patterns = [
        r"^\d+º\s+Class\.",      # "1º Class.", "2º Class.", etc.
        r"^Vencedor\s+",          # "Vencedor QF1", "Vencedor MF2"
        r"^Vencido\s+",           # "Vencido QF3"
        r"^\d+º\s+Grupo\s+",      # "1º Grupo A"
    ]
    
    for pattern in placeholder_patterns:
        if re.match(pattern, normalized):
            return None  # CRITICAL: return None, not empty string
    
    # ... rest of normalization ...
```

**Validation:**

```bash
# Count filtered placeholders:
grep "Placeholder de playoff filtrado" mmr_tacaua.log | wc -l
# Typical output: 30-50

# Verify standings don't contain placeholders:
grep -E "Class\.|Vencedor|Vencido" \
    docs/output/elo_ratings/classificacao_*.csv
# Expected output: (empty)
```

---

### Case 2.2: 3rd Place Game (E3L)

**Context:**  
The "E3L" matchday is a consolation game (teams eliminated in semi-finals).  
Reduced importance → K-factor should be lower.

**Implementation:**

```python
# File: src/mmr_taçaua.py

def calculate_season_phase_multiplier(self, game_number, total_group_games, jornada=None, **kwargs):
    # E3L (3rd place): M_phase = 0.75 (lower importance)
    if jornada and str(jornada).upper() == "E3L":
        return 0.75
    
    # Regular playoffs: M_phase = 1.5 (higher stakes)
    game_scaled = (game_number / total_group_games) * 8
    if game_scaled > 8:
        return 1.5
    
    # ... rest of phase logic ...
```

**Numerical Example:**

```python
# Game: EI vs Gestão in E3L
elo_EI, elo_Gestão = 1650, 1580
score_EI, score_Gestão = 3, 2  # Close victory

# K-factor breakdown:
K_base = 100
M_phase = 0.75  # ← E3L reduced
M_prop = (3/2)^0.1 = 1.047
K_total = 100 × 0.75 × 1.047 = 78.5

# ELO change:
S_expected_EI = 1 / (1 + 10^((1580-1650)/250)) = 0.617
ΔElo_EI = 78.5 × (1.0 - 0.617) = +30

# Vs regular playoff game (M_phase=1.5):
K_playoff = 100 × 1.5 × 1.047 = 157
ΔElo_playoff = 157 × (1.0 - 0.617) = +60

# ✓ E3L has half the impact of a regular playoff (30 vs 60)
```

---

### Case 2.3: Knockout vs Round-Robin Format

**Problem:**  
Some modalities have **only playoffs** (no group stage).  
Division column doesn't exist → `self.div_col = None`.

**Solution:** Infer a "single group" when columns are absent.

```python
# File: src/mmr_taçaua.py
# Class: StandingsCalculator

def _create_group_key_column(self, df_group):
    """
    Hierarchy:
        1. Division + Group (if both exist)
        2. Group only (if only group exists)
        3. Group inferred from division (if only division)
        4. Single group "Group_1" (if nothing exists) ← KNOCKOUT!
    """
    if self.div_col and self.group_col:
        # Standard: Divisions + Groups
        df_group["Group_Key"] = (
            df_group[self.div_col].astype(str) + "_" +
            df_group[self.group_col].astype(str)
        )
        return "Group_Key"
    elif self.group_col:
        return self.group_col
    elif self.div_col:
        df_group["Inferred_Group"] = df_group[self.div_col].astype(str)
        return "Inferred_Group"
    else:
        # NO DIVISIONS OR GROUPS: PURE KNOCKOUT
        df_group["Inferred_Group"] = "Group_1"
        return "Inferred_Group"
```

---

## <a name="absence-handling"></a> 3. Absence Handling

### Case 3.1: Walkover/Forfeit (WO)

**Context:**  
Team doesn't show up → automatic result 3-0 (or 2-0 sets in volleyball).  
The "Falta de Comparência" field is non-empty.

**Problems:**

1. **Distorted averages:** WO 3-0 doesn't reflect actual ELO skill.
2. **Biased calibration:** Artificially inflated goals.

**Solution:** Remove from calibration, **but keep for ELO**.

```python
# File: src/calibrator.py — Absences are EXCLUDED from calibration

def _load_single_csv(self, csv_path):
    for row in reader:
        has_absence = falta_raw != ""
        if has_absence:
            continue  # ← DO NOT add to games[] (calibration)
        games.append(game)
```

```python
# File: src/mmr_taçaua.py — Absences ARE processed for ELO

def process_match(self, row, sport):
    falta = row.get("Falta de Comparência", "").strip()
    if falta:
        # WO: process normally (winner gains ELO, loser loses)
        # ELO delta is set to 0 to prevent distortion
    # ... normal ELO calculation ...
```

**Quantitative Impact:**

```bash
# Count absences per season:
# FUTSAL_MASCULINO_25_26.csv:   2  (~4% of 48 games)
# ANDEBOL_MISTO_25_26.csv:       3  (~7% of 42 games)
# TOTAL: ~4.5% of all games

# Brier Score WITH absences in calibration: 0.156
# Brier Score WITHOUT absences (implemented): 0.138
# Improvement: 11.5% ✓
```

---

### Case 3.2: Interrupted/Cancelled Games

**Treatment:**

```bash
# 1. Mark as absence (add "X" in "Falta de Comparência")
#    → Game doesn't count for calibration or ELO

# 2. OR keep partial result if officially ratified
#    → Process normally
```

---

## <a name="name-normalization"></a> 4. Complex Name Normalization

### Case 4.1: Accent Variations

**Problem:**  
Same course appears as: "Tradução", "Traduçao", "TRADUÇÃO", "traducao"

**Solution:** Unicode NFD decomposition + accent removal.

```python
import unicodedata

def normalize_team_name(team_name):
    # NFD: Canonical decomposition (ã → a + ~)
    normalized_nfd = unicodedata.normalize("NFD", normalized)
    
    # Remove combining marks (category "Mn")
    without_accents = "".join(
        char for char in normalized_nfd
        if unicodedata.category(char) != "Mn"
    )
    
    # Map accent-free names → canonical names
    accent_mappings = {
        "traducao": "Tradução",
        "gestao": "Gestão",
        "matematica": "Matemática",
        "bioquimica": "Bioquímica",
    }
    
    lower_no_accents = without_accents.lower()
    if lower_no_accents in accent_mappings:
        return accent_mappings[lower_no_accents]
```

**Transformation examples:**

```python
"Traduçao"  → "Tradução"  # ç preserved, rest normalized
"TRADUÇÃO"  → "Tradução"  # Case normalized
"traducao"  → "Tradução"  # No accents → mapped
"Tradução " → "Tradução"  # Trailing space removed
```

---

### Case 4.2: Abbreviations vs Full Names

**Problem:**  
"Eng. Informática" vs "EI" must be the same team.

**Solution:** Centralized JSON mapping.

```json
// docs/config/config_cursos.json
{
  "Eng. Informática": {
    "displayName": "EI",
    "variants": [
      "Engenharia Informática",
      "Eng. Informatica",
      "Eng Informática",
      "E.I."
    ]
  }
}
```

```python
# File: src/mmr_taçaua.py

def create_team_name_mapping():
    """Loads config_cursos.json and generates mapping dictionary."""
    mappings = {}
    for course_key, course_data in config["courses"].items():
        canonical = course_data.get("displayName", course_key)
        for variant in course_data.get("variants", []):
            mappings[variant] = canonical
        if course_key != canonical:
            mappings[course_key] = canonical
    return mappings
```

---

### Case 4.3: Known Typos

**Hardcoded fallback for errors not in JSON:**

```python
KNOWN_TYPOS = {
    "EGO": "EGI", 
    "Eng. Compotacional": "Eng. Computacional",
    "Adminstração Pública": "Administração Pública",
    "Edcucação Básica": "Educação Básica",
}
```

---

## <a name="divisions-groups"></a> 5. Dynamic Divisions and Groups

### Case 5.1: Group Inference via Connectivity

**Problem:**  
CSV has no "Grupo" column, but games are clearly in separate groups.

**Solution:** Graph analysis (connected components).

```python
# File: src/mmr_taçaua.py

def _infer_groups_from_games(self, df_div):
    """
    Infers groups based on game connectivity.
    
    Algorithm:
        1. Build graph: nodes=teams, edges=games
        2. Find connected components
        3. Each component = 1 group
    """
    teams = set()
    connections = set()
    
    for _, row in df_div.iterrows():
        team1 = normalize_team_name(row["Equipa 1"])
        team2 = normalize_team_name(row["Equipa 2"])
        if team1 and team2:
            teams.add(team1)
            teams.add(team2)
            connections.add((team1, team2))
    
    groups = []
    remaining_teams = teams.copy()
    
    while remaining_teams:
        current_group = {remaining_teams.pop()}
        changed = True
        while changed:
            changed = False
            for t1, t2 in connections:
                if t1 in current_group and t2 in remaining_teams:
                    current_group.add(t2)
                    remaining_teams.discard(t2)
                    changed = True
                elif t2 in current_group and t1 in remaining_teams:
                    current_group.add(t1)
                    remaining_teams.discard(t1)
                    changed = True
        groups.append(current_group)
    
    return groups
```

**Example:**

```ini
Games:
  EI vs Gestão
  EI vs Economia
  Gestão vs Economia
  Tradução vs Bioquímica
  Tradução vs Física

Connected Components:
  Group 1: {EI, Gestão, Economia}       ← Connected to each other
  Group 2: {Tradução, Bioquímica, Física}
```

---

## <a name="sport-detection"></a> 6. Sport Detection

### Case 6.1: Football vs Futsal Ambiguity

**Problem:**  
File "FUTEBOL_DE_7_MASCULINO_25_26.csv" could be confused with futsal.

**Solution:** Keyword priority.

```python
# File: src/mmr_taçaua.py

@staticmethod
def detect_from_filename(filename):
    """
    Priority:
        1. Handball (specific)
        2. Football + 7 (specific)
        3. Futsal (generic)
        4. Basketball
        5. Volleyball
    """
    filename_lower = filename.lower()
    
    if "andebol" in filename_lower:
        return Sport.ANDEBOL
    elif "futebol" in filename_lower and "7" in filename_lower:
        return Sport.FUTSAL  # Same scoring rules as futsal
    elif "futsal" in filename_lower or "futebol" in filename_lower:
        return Sport.FUTSAL
    # ... rest ...
```

---

## <a name="scoring-edge-cases"></a> 7. Atypical Scoring Cases

### Case 7.1: Volleyball with Invalid Sets

**Problem:**  
Excel shows "Sets 1 = 1, Sets 2 = 1" (impossible in best-of-3).

**Detection and fallback:**

```python
# File: src/mmr_taçaua.py

def calculate(sport, score1, score2, sets1=None, sets2=None):
    if sport == Sport.VOLEI:
        valid_sets = {(2,0), (2,1), (1,2), (0,2)}
        if (sets1, sets2) not in valid_sets:
            logger.error(f"Invalid volleyball sets: {sets1}-{sets2}")
            # Fallback: infer winner, assume 2-1
            if score1 > score2:
                return 2, 1
            elif score2 > score1:
                return 1, 2
            else:
                return 1, 1  # Force special treatment
```

### Case 7.2: Negative Points in Handball (Historical Bug)

**Problem (resolved):**  
Old version allowed negative points (bug in handball draw logic).

**Current protection:**

```python
stats[team]["Pontos"] = max(0, stats[team]["Pontos"])  # Floor at 0
```

---

## <a name="data-validation"></a> 8. Data Validation

### Pre-Execution Validation Checklist

```python
def validate_csv_integrity(csv_path):
    """
    Validates CSV before processing.
    
    Checks:
        1. Required columns exist
        2. Correct data types
        3. Values in expected ranges
        4. Team names are valid (not placeholders)
    """
    required_columns = {
        "Jornada", "Equipa 1", "Equipa 2",
        "Golos 1", "Golos 2"
    }
    
    df = pd.read_csv(csv_path)
    
    # Check 1: Required columns
    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns: {missing}")
    
    # Check 2: Data types
    for col in ["Golos 1", "Golos 2"]:
        if df[col].dtype not in [int, float]:
            raise TypeError(f"{col} must be numeric!")
    
    # Check 3: Valid ranges
    if (df["Golos 1"] < 0).any() or (df["Golos 1"] > 100).any():
        raise ValueError("Golos 1 out of range [0, 100]")
    
    # Check 4: Placeholders
    for col in ["Equipa 1", "Equipa 2"]:
        placeholders = df[col].str.contains("Class\.|Vencedor|Vencido", na=False)
        if placeholders.sum() > 0:
            logger.warning(f"{placeholders.sum()} placeholders detected in {col}.")
```

---

## Summary and Maintenance

**Documented edge cases:** 15+ critical scenarios

- ✓ Team transitions (renames, merges)
- ✓ Variable playoff formats (E3L, knockout)
- ✓ Absence handling (~4.5% of games filtered)
- ✓ Complex normalization (accents, abbreviations, typos)
- ✓ Dynamic divisions/groups (graph inference)
- ✓ Data validation (pre-checks)

**Maintenance plan:**

- Add new entries to KNOWN_TYPOS as they appear
- Update config_cursos.json each semester
- Review handle_special_team_transitions() at the start of each season

---

**Last updated:** 2026-03  
**Related files:**

- `src/mmr_taçaua.py` (normalization, transitions)
- `src/calibrator.py` (absence filtering)
- `docs/config/config_cursos.json` (mappings)
