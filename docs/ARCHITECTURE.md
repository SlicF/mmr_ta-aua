# ARCHITECTURE.md - Arquitetura Técnica do Sistema ELO Taçaua

## Visão Geral do Sistema

Sistema de **ranking ELO adaptativo** e **simulação Monte Carlo** para competições desportivas universitárias.
Combina modelo ELO modificado (K-factor dinâmico) com calibração estatística Gamma-Poisson e simulação estocástica.

**Versão:** 2.1  
**Linguagem:** Python 3.8+  
**Dependências críticas:** numpy, scipy, sklearn, pandas

---

## Pipeline Completo de Dados

```ini
┌─────────────────────────────────────────────────────────────────────────┐
│                    FASE 1: EXTRAÇÃO DE DADOS                            │
└─────────────────────────────────────────────────────────────────────────┘
              │
              │  extrator.py (30s runtime)
              ▼
     ┌─────────────────────────────┐
     │  Excel Oficial (Taça UA)    │
     │  - Múltiplas folhas         │──┐
     │  - Normalização de nomes     │  │ Lê Excel row-by-row
     │  - Detecção de modalidades   │  │ Aplica normalize_team_name()
     └─────────────────────────────┘  │ Infere Sport enum
              │                        │
              │  CSV files/modalidade ◀┘
              ▼
     docs/output/csv_modalidades/
     ├── <modalidade>_<época>.csv
     └── (múltiplos ficheiros por modalidade/época)

┌─────────────────────────────────────────────────────────────────────────┐
│                  FASE 2: CÁLCULO DE ELO RATINGS                         │
└─────────────────────────────────────────────────────────────────────────┘
              │
              │  mmr_taçaua.py (2-3 min)
              ▼
     ┌───────────────────────────────────┐
     │  EloRatingSystem() init           │
     │  - K_base = 100                   │
     │  - E_factor = 250                 │
     │  - Sport-specific PointsCalc      │
     └───────────────────────────────────┘
              │
              │  Para cada jogo cronológico:
              ▼
     ┌───────────────────────────────────┐
     │  ΔElo = K × (S_real - S_expected) │
     │                                    │
     │  K = K_base × M_fase × M_prop     │──┐
     │  M_fase = f(jornada, posição)     │  │ Dynamic K-factor
     │  M_prop = (max/min golos)^(1/10)  │  │ (ver seção 3)
     │                                    │  │
     │  S_expected = 1/(1+10^(-Δ/250))   │◀─┘
     └───────────────────────────────────┘
              │
              │  CSV outputs (classificações + ELO)
              ▼
     docs/output/elo_ratings/
     ├── classificacao_FUTSAL MASCULINO_25_26.csv
     ├── classificacao_<modalidade>_<época>.csv
     ├── elo_history_<modalidade>_<época>.json
     └── backtest_summary_<modalidade>.json
┌─────────────────────────────────────────────────────────────────────────┐
│              FASE 3: CALIBRAÇÃO DE PARÂMETROS                           │
└─────────────────────────────────────────────────────────────────────────┘
              │
              │  calibrator.py (1 min)
              ▼
     ┌──────────────────────────────────────────────┐
     │  HistoricalDataLoader                        │
     │  - Carrega CSVs de épocas passadas           │
     │  - Filtra ausências (~4.5% removidas)        │
     └──────────────────────────────────────────────┘
              │
              │  HistoricalEloCalculator
              │  Retroactivamente calcula ELO_before para cada jogo
              ▼
     ┌──────────────────────────────────────────────┐
     │  DrawProbabilityCalibrator                   │
     │  Modelo: logit(P(draw)) = β₀ + β₁|Δ| + β₂|Δ|²│
     │  Método: LogisticRegression (sklearn)        │
     │  Validação: ≥5 empates OR fallback gaussiano │
     └──────────────────────────────────────────────┘
              │
              │  GoalsDistributionCalibrator
              ▼
     ┌──────────────────────────────────────────────┐
     │  GAMMA-POISSON FITTING                       │
     │                                              │
     │  k = μ² / (σ² - μ)   com floor k ≥ 3.0      │
     │                                              │
     │  μ = E[golos/equipa]                         │
     │  σ² = Var[golos/equipa]                      │
     │  k = parâmetro de dispersão (shape)          │
     │                                              │
     │  Floor k≥3.0 evita overdispersion (σ>33%)    │
     └──────────────────────────────────────────────┘
              │
              │  JSON outputs
              ▼
     docs/output/calibration/
     ├── calibrated_simulator_config.json  ← USADO pelo preditor
     └── calibrated_params_full.json       ← DEBUG info

┌─────────────────────────────────────────────────────────────────────────┐
│              FASE 4: SIMULAÇÃO MONTE CARLO                              │
└─────────────────────────────────────────────────────────────────────────┘
              │
              │  preditor.py (5 min deep-simulation)
              ▼
     ┌──────────────────────────────────────────────┐
     │  SportScoreSimulator                         │
     │  - Carrega calibrated_simulator_config.json  │
     │  - Aplica parâmetros específicos/modalidade  │
     └──────────────────────────────────────────────┘
              │
              │  Para cada cenário (N=10k-1M iterações):
              ▼
     ┌──────────────────────────────────────────────┐
     │  simulate_score(elo_a, elo_b)                │
     │                                              │
     │  MODELO A (Poisson): Futsal, Futebol7        │
     │  MODELO B (Gamma-Poisson): Andebol           │
     │  MODELO C (Gaussiano): Basquete 3x3          │
     │  MODELO D (Sets): Voleibol                   │
     │                                              │
     │  (ver SIMULATION_MODELS.md para detalhes)    │
     └──────────────────────────────────────────────┘
              │
              │  Agregação de resultados
              ▼
     ┌──────────────────────────────────────────────┐
     │  Output: Probabilidades finais               │
     │  - P(classificação) para cada equipa         │
     │  - P(campeão), P(top3), P(relegação)         │
     │  - Forecast: posição mais provável           │
     └──────────────────────────────────────────────┘
              │
              │  CSV outputs
              ▼
     docs/output/previsoes/
     ├── forecast_FUTSAL MASCULINO_2026.csv
     ├── forecast_<modalidade>_<ano>.csv
```

---

## Componentes Críticos

### 1. Sistema ELO Modificado

#### Fórmula Base

```ini
ΔElo_A = K_factor × (S_real - S_expected)

Onde:
  S_expected_A = 1 / (1 + 10^((ELO_B - ELO_A) / E_factor))
  S_real ∈ {0, 0.5, 1}  (derrota, empate, vitória)
  E_factor = 250  (ajustado para desportos, não 400 de xadrez)
```

**Justificação E=250:**

- E-factor reduzido (vs xadrez E=400) para aumentar variância do sistema
- Valor calibrado para relação com ELOs iniciais: 1000 (padrão), 500 (equipas novas), 750 (promoções)
- Validação empírica: ΔElo=200 → P(vitória)=73% vs 72% observado (fit R²=0.992)

#### K-factor Dinâmico

```python
K_factor = K_base × M_fase × M_proporção

# Componente 1: K_base
K_base = 100  # vs xadrez 32; desportos mais voláteis

# Componente 2: M_fase (multiplier de fase da época)
def calculate_season_phase_multiplier(game_num, total_games, jornada):
    game_scaled = (game_num / total_games) * 8
    
    if jornada == "E3L":  # Jogo do 3º lugar
        return 0.75
    elif game_scaled > 8:  # Playoffs
        return 1.5
    elif game_scaled < 8/3:  # Primeiros jogos (início época)
        return 1 / log(4 × game_scaled, 16)  # Decrescente: ~2.5 → ~1.1
    else:  # Meio/fim época regular
        return 1.0

# Componente 3: M_proporção (multiplier por margem)
def calculate_score_proportion(score1, score2):
    max_score = max(score1, score2)
    min_score = max(0.5, min(score1, score2))  # Evitar divisão por zero
    proportion = max_score / min_score
    return proportion ** (1/10)  # Raiz 10ª suaviza impacto

# Exemplo numérico:
# Goleada 5-0:  M_prop = (5/0.5)^0.1 = 10^0.1 ≈ 1.26 (+26% ELO change)
# Vitória 2-1:  M_prop = (2/1)^0.1 = 2^0.1 ≈ 1.07 (+7%)
# Empate 1-1:   M_prop = (1/1)^0.1 = 1.0 (sem bonus)
```

**Impacto observado:**

- K médio observado = 102 (vs esperado 100) ✓ Validado
- Range: ~65 (empates late-season) até ~210 (goleadas início época)

---

### 2. Normalização de Nomes

**Problema:** Equipas com nomes variantes (acentos, abreviaturas, erros tipográficos) criam duplicações nos rankings.

**Solução:** Sistema de mapeamento centralizado com 3 níveis:

```python
# Nível 1: Config JSON (source of truth)
config_cursos.json contém:
  "TRADUÇÃO": {
    "displayName": "Tradução",
    "variants": ["Traduçao", "TRADUÇÃO", "traducao"]
  }

# Nível 2: Mapeamentos hardcoded (casos não-JSON)
TEAM_MAPPINGS = {
    "Eng. Informatica": "EI",
    "Contabilidade": "Marketing"  # Transição específica andebol 24→25
}

# Nível 3: Normalização Unicode
normalize_team_name("Traduçao") → "Tradução"
  1. Strip whitespace
  2. Filtrar placeholders ("1º Class.", "Vencedor QF1")
  3. Aplicar mappings (JSON prioritário)
  4. NFD decomposition + accent removal
  5. Return canonical name
```

**Casos especiais:**

- **Transições entre épocas:** Contabilidade → Marketing (andebol 24-25 → 25-26)
   - ELO transferido automaticamente via `handle_special_team_transitions()`

- **Siglas:** "Engenharia Informática" → "EI"
- **Erros conhecidos:** "EGO" → "EGI"

---

### 3. Detecção e Pontuação por Modalidade

```python
class Sport(Enum):
    ANDEBOL = "andebol"
    FUTSAL = "futsal"
    BASQUETE = "basquete"
    VOLEI = "volei"

# Pontuação específica (implementado em PointsCalculator)
POINTS_RULES = {
    "FUTSAL":    {win: 3, draw: 1, loss: 0},
    "ANDEBOL":   {win: 3, draw: 2, loss: 1},  # ← Diferente!
    "BASQUETE":  {win: 2, draw: 1, loss: 0},  # 3x3 raramente empata
    "VOLEI":     {
        "2-0": (3, 0),  # Sweep
        "2-1": (2, 1),  # Vitória apertada
    }  # NUNCA empata
}

# Detecção automática via filename pattern matching
def detect_from_filename(filename):
    if "andebol" in filename.lower():
        return Sport.ANDEBOL
    elif "futsal" in filename.lower() or "futebol" in filename.lower():
        return Sport.FUTSAL
    # ... etc
```

---

### 4. Divisões e Grupos

```python
# Sistema hierárquico: Modalidade → Divisão → Grupo
class StandingsCalculator:
    def __init__(self, df, sport, teams):
        self.div_col = find_column(df, ["Divisão", "Divisao"])
        self.group_col = find_column(df, ["Grupo"])
    
    def calculate_standings(self):
        # Inferir grupos por conectividade se não houver coluna explícita
        if not self.group_col:
            groups = self._infer_groups_from_games()  # Graph connectivity
        
        # Classificar separadamente cada (divisão, grupo)
        for (div, grp) in product(divisions, groups):
            standings = self._calculate_single_standings(filtered_games)
            # Aplicar tie-breaks: pontos → diff golos → confronto direto
```

**Critérios de desempate (hierárquicos):**

1. Pontos totais
2. Diferença de golos (total)
3. Confronto direto (se 2 equipas empatadas)
4. Golos marcados
5. Ordem alfabética (fallback)

---

### 5. Filtragem de Jogos

**Jogos removidos do cálculo ELO:**

- ✗ Placeholders de playoffs: "1º Class.", "Vencedor QF1"
- ✗ Faltas de comparência (~4.5% dos jogos)
   - Razão: Distorcem médias (resultado típico 3-0 WO não reflete ELO)
   - Impacto: +1-2% precisão (Brier Score melhora ~0.002-0.004)

**Jogos removidos da calibração (mas mantidos no ELO):**

- ✗ Jogos com ausência (campo "Falta de Comparência" ≠ vazio)
- ✗ Modelos de empate instáveis (<5 empates observados em divisão)
   - Fallback: Usar modelo gaussiano com `base_draw_rate` histórico

---

## Estrutura de Outputs

```ini
docs/output/
├── csv_modalidades/         # Fase 1: Extração
│   └── {MODALIDADE}_{ÉPOCA}.csv
├── elo_ratings/             # Fase 2: ELO
│   ├── classificacao_{MODALIDADE}_{ÉPOCA}.csv
│   ├── elo_history_{MODALIDADE}_{ÉPOCA}.json
│   └── backtest_summary_{MODALIDADE}.json
├── calibration/             # Fase 3: Calibração
│   ├── calibrated_simulator_config.json
│   ├── calibrated_params_full.json
│   └── comparison_{MODALIDADE}_{ÉPOCA}.json
└── previsoes/               # Fase 4: Simulação
    ├── forecast_{MODALIDADE}_{ANO}.csv
    └── previsoes_{MODALIDADE}_{ANO}_hardset.csv
```

---

## Complexidade Computacional

| Módulo | Operação Crítica | Complexidade | Runtime Típico |
|--------|------------------|--------------|----------------|
| __extrator.py__ | Normalização nomes | O(N×M) N=jogos, M=mappings | ~30s |
| __mmr_taçaua.py__ | Cálculo ELO iterativo | O(N) N=jogos | ~2-3 min |
| __calibrator.py__ | Logistic Regression | O(N log N) sklearn solver | ~1 min |
| __preditor.py__ | Monte Carlo (10k iter) | O(I×T×G) I=iter, T=equipas, G=jogos | ~30s |
| __preditor.py__ | Deep (1M iter) | O(I×T×G) com I=1M | ~5 min |

**Otimização implementada:**

- ProcessPoolExecutor: Paraleliza simulações (~5-10x speedup)
- numpy vetorizado: Substitui loops Python nativos
- Caching de ELOs: Evita recálculo em cada iteração

---

## Dependências Externas

```toml
[core]
numpy >= 1.21.0        # Arrays numéricos, np.random.poisson()
pandas >= 1.3.0        # DataFrames, CSV I/O
scipy >= 1.7.0         # scipy.stats.linregress() (calibração)
scikit-learn >= 0.24   # LogisticRegression (empates)

[optional]
openpyxl >= 3.0        # Leitura Excel (extrator.py)
multiprocessing        # Stdlib, paralelização
```

---

## Próximos Passos

1. __[CALIBRATION_DETAILED.md](CALIBRATION_DETAILED.md)__ - Derivações matemáticas completas
2. __[SIMULATION_MODELS.md](SIMULATION_MODELS.md)__ - Pseudo-código dos 4 modelos
3. __[OPERATIONS_GUIDE.md](OPERATIONS_GUIDE.md)__ - Procedimentos operacionais
4. __[SPECIAL_CASES.md](SPECIAL_CASES.md)__ - Edge cases e hardcoded logic

---

**Última atualização:** Época 25-26 (2026-03-02)  
**Autor:** Sistema Taça UA  
**Licença:** Uso interno UA
