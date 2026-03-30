# ARCHITECTURE.md - Arquitetura Técnica do Sistema ELO Taça UA

[🇬🇧 View English Version](ARCHITECTURE_EN.md)

---

## Visão Geral

Sistema de **ranking ELO adaptativo** e **simulação Monte Carlo** para competições desportivas universitárias. Combina um método ELO com $K$-factor dinâmico, calibração estatística Gamma-Poisson e simulações estocásticas em massa.

**Versão:** 2.1  
**Ambiente:** Python 3.8+  
**Dependências:** `numpy`, `scipy`, `scikit-learn`, `pandas`

---

## Pipeline de Dados

```ini
┌─────────────────────────────────────────────────────────────────────────┐
│                    FASE 1: EXTRAÇÃO E NORMALIZAÇÃO                      │
└─────────────────────────────────────────────────────────────────────────┘
              │
              │  extrator.py (~30s)
              ▼
     ┌─────────────────────────────┐
     │  Excel Oficial              │
     │  - Extração multi-folha    │──┐
     │  - Normalização de nomes   │  │ Parsing linha-a-linha
     │  - Deteção de modalidade   │  │ normalize_team_name()
     └─────────────────────────────┘  │ Enum Sport inferido
              │                        │
              │  Ficheiros CSV particionados ◀┘
              ▼
     docs/output/csv_modalidades/
     ├── <modalidade>_<época>.csv

┌─────────────────────────────────────────────────────────────────────────┐
│                  FASE 2: CÁLCULO ELO                                    │
└─────────────────────────────────────────────────────────────────────────┘
              │
              │  mmr_taçaua.py (~2-3 min)
              ▼
     ┌───────────────────────────────────┐
     │  EloRatingSystem()               │
     │  - K_base: 100                   │
     │  - E_factor: 250                 │
     │  - Calculador de pontos          │
     └───────────────────────────────────┘
              │
              │  Para cada jogo cronologicamente:
              ▼
     ┌───────────────────────────────────┐
     │  ΔElo = K × (S_real - S_esperado)│
     │                                   │
     │  K = K_base × M_fase × M_prop    │──┐
     │  M_fase = f(jornada, momento)    │  │ K-factor dinâmico
     │  M_prop = log_scale(diferencial) │  │ (ver Secção 3)
     │                                   │  │
     │  S_esperado = 1/(1+10^(-Δ/250))  │◀─┘
     └───────────────────────────────────┘
              │
              │  CSVs + JSONs de output
              ▼
     docs/output/elo_ratings/
     ├── classificacao_<modalidade>_<época>.csv
     ├── elo_history_<modalidade>_<época>.json

┌─────────────────────────────────────────────────────────────────────────┐
│              FASE 3: CALIBRAÇÃO                                          │
└─────────────────────────────────────────────────────────────────────────┘
              │
              │  calibrator.py (~1 min)
              ▼
     ┌──────────────────────────────────────────────┐
     │  HistoricalDataLoader                        │
     │  - Carrega e valida dataframes               │
     │  - Remove ausências e dados anómalos         │
     └──────────────────────────────────────────────┘
              │
              │  Calibração de empates
              ▼
     ┌──────────────────────────────────────────────┐
     │  Probabilidade de empate                     │
     │  P_draw: logit(P) = β₀ + β₁|Δ| + β₂|Δ|²     │
     │  Otimizador: Regressão Logística (sklearn)   │
     └──────────────────────────────────────────────┘
              │
              │  Calibração de distribuição de golos
              ▼
     ┌──────────────────────────────────────────────┐
     │  GAMMA-POISSON                               │
     │  k = μ² / (σ² - μ)   com floor k ≥ 3.0      │
     │  Controla a overdispersion                   │
     └──────────────────────────────────────────────┘
              │
              │  JSON de parâmetros
              ▼
     docs/output/calibration/
     ├── calibrated_simulator_config.json

┌─────────────────────────────────────────────────────────────────────────┐
│              FASE 4: SIMULAÇÃO MONTE CARLO                               │
└─────────────────────────────────────────────────────────────────────────┘
              │
              │  preditor.py (~5 min)
              ▼
     ┌──────────────────────────────────────────────┐
     │  SportScoreSimulator                         │
     │  - Carrega parâmetros calibrados             │
     └──────────────────────────────────────────────┘
              │
              │  Para cada simulação (N = 10⁴ a 10⁶):
              ▼
     ┌──────────────────────────────────────────────┐
     │  Simular todos os jogos restantes            │
     │  Modelo escolhido por modalidade             │
     │  (ver: SIMULATION_MODELS.md)                 │
     └──────────────────────────────────────────────┘
              │
              │  Agregar resultados
              ▼
     ┌──────────────────────────────────────────────┐
     │  Probabilidades de classificação final       │
     │  P(top 3), P(campeão), etc.                  │
     └──────────────────────────────────────────────┘
              │
              │  Output final
              ▼
     docs/output/previsoes/
     ├── forecast_<modalidade>_<ano>.csv
```

---

## Módulos Principais

### 1. Motor ELO Dinâmico

#### Fator de Escala (E-factor) = 250

O standard no xadrez é $E=400$. Usamos $E=250$ para aumentar a sensibilidade a diferenças de rating, refletindo a maior volatilidade do desporto universitário.

**Resultado:** Com $\Delta ELO = 200$, o modelo prevê 73% de vitórias — corresponde aos 72% observados empiricamente ($R² = 0.992$).

#### K-Factor Dinâmico

O multiplicador de atualização varia com o contexto:

$$K_{factor} = K_{base} \times M_{fase} \times M_{proporção}$$

- **$K_{base} = 100$**: Valor alto para permitir ajustes rápidos nos ratings face à volatilidade universitária.
- **$M_{fase}$**: Adapta o impacto conforme a fase — mais peso no início da época (maior incerteza) e nos playoffs (maior importância), menos peso nas ligas inferiores.
- **$M_{proporção}$**: Pondera a margem de vitória usando escala logarítmica, evitando que resultados atípicos distorçam os ratings.

### 2. Normalização de Nomes

**Problema:** Nomes de equipas aparecem com variações (acentos, siglas, typos) que criam entidades duplicadas no sistema ELO.

**Solução em 3 camadas:**

1. **JSON centralizado (`config_cursos.json`)**: Mapeamento de variantes para o nome canónico oficial.
2. **Transições hardcoded**: Liga equipas renomeadas entre épocas (ex: Contabilidade → Marketing).
3. **Decomposição Unicode (NFD)**: Remove acentos para comparação, depois restaura a forma canónica.

### 3. Deteção de Modalidade

O sistema reconhece a modalidade a partir do nome do ficheiro CSV usando padrões regex:

```python
# Tabela de pontuação por modalidade
POINTS_RULES = {
    "FUTSAL":    (3, 1, 0),  # Vitória, Empate, Derrota
    "ANDEBOL":   (3, 2, 1),  # Derrota vale 1 ponto
    "BASQUETE":  (2, 1, 0),  # Basquete 3x3
    "VOLEI":     # Sistema de sets (2-0, 2-1)
}
```

### 4. Gestão de Ausências (Forfaits)

Cerca de 4.5% dos jogos são por falta de comparência, com resultado automático (ex: 3-0).

- **No ELO**: O resultado é registado mas não gera alteração de rating (ΔElo = 0).
- **Na calibração**: Jogos com ausência são excluídos para não distorcer os parâmetros estatísticos (base_goals, dispersão, etc.).

---

## Complexidade e Tempos de Execução

| Módulo | Operação | Complexidade | Tempo |
|--------|----------|-------------|-------|
| Extrator | Parsing e normalização | $\mathcal{O}(N \times M)$ | ~30s |
| ELO | Processamento sequencial | $\mathcal{O}(N)$ | ~2-3 min |
| Calibração | Regressão logística (L-BFGS) | $\mathcal{O}(N \log N)$ | ~1 min |
| Previsão (standard) | Monte Carlo paralelo ($10^4$ iter) | $\mathcal{O}(I \times T \times G)$ | ~30s |
| Previsão (deep) | Monte Carlo paralelo ($10^6$ iter) | $\mathcal{O}(I \times T \times G)$ | ~5 min |

O paralelismo via `ProcessPoolExecutor` proporciona speedups de 5× a 10× nas simulações Monte Carlo.

---

**Última atualização:** 2026-03  
**Domínio:** Taça da Universidade de Aveiro
