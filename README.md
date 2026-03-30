# Taça UA - ELO Rating and Prediction System | Sistema de Classificação ELO e Previsão

[![en](https://img.shields.io/badge/lang-en-red.svg)](#english) [![pt](https://img.shields.io/badge/lang-pt-green.svg)](#português)

---

<a id="português"></a>

## 🇵🇹 Português

### Visão Geral

Sistema de classificação ELO e previsão de resultados para a **Taça da Universidade de Aveiro**. Utiliza modelação probabilística e simulação de Monte Carlo para calcular ratings das equipas e projetar classificações finais com probabilidades associadas.

### Arquitetura

O pipeline é composto por quatro módulos sequenciais:

1. **Extração (`extrator.py`)**: Extrai dados das grelhas oficiais (Excel), normaliza nomes de equipas e identifica modalidades desportivas automaticamente.
2. __Cálculo ELO (`mmr_taçaua.py`)__: Processa os resultados cronologicamente para calcular o rating de cada equipa, usando um $K$-factor dinâmico (entre 65 e 210) ajustado à volatilidade do desporto universitário.
3. **Calibração (`calibrator.py`)**: Estima parâmetros ótimos a partir do histórico de jogos — calibra distribuições Gamma-Poisson (e Gaussianas noutras modalidades) para maximizar a precisão das previsões.
4. **Previsão (`preditor.py`)**: Executa simulações de Monte Carlo ($10^4$ a $10^6$ iterações) para calcular probabilidades de classificação final e cenários de progressão até às finais.

### K-Factor

A atualização dos ratings usa um multiplicador composto:

$$K = 100 \times M_{fase} \times M_{proporção}$$

- **$K_{base} = 100$**: Valor base alto (vs 32 no xadrez) para capturar a incerteza natural do desporto universitário.
- **$M_{fase}$**: Varia com a fase da competição — início de época $>1.5$, época regular $1.0$, ligas inferiores $0.75$, playoffs $1.5$.
- **$M_{proporção}$**: Bónus pela margem de vitória — vitórias expressivas $+26\%$, vitórias tangenciais $+7\%$.

*Validação: o $K$-factor médio observado é 102, face ao valor teórico de 100.*

### Fator de Escala (E-factor) = 250

A probabilidade de vitória é calculada com $E = 250$ (em vez do standard $E = 400$ do xadrez):

$$P(vitória) = \frac{1}{1 + 10^{-(\Delta ELO)/250}}$$

Este valor foi calibrado para lidar com a alta variância do desporto universitário. Calibrado com ELOs iniciais de 1000, 500 e 750.

*Validação: com $\Delta Elo = 200$, o modelo prevê $73\%$ de vitórias vs $72\%$ observados historicamente. Goodness of Fit: $99.2\%$.*

### Instalação e Execução

```bash
pip install -r requirements.txt
cd src

python extrator.py                    # ~30s
python mmr_taçaua.py                  # ~2-3 min
python calibrator.py                  # ~1 min
python preditor.py                    # ~5 min
```

### Validação (Backtesting)

O sistema inclui testes de backtesting (previsão retrospetiva sobre dados históricos):

- **Brier Score:** $0.133$–$0.175$ (objetivo: $<0.150$)
- **RMSE de Posição:** $1.6$ a $2.8$ posições de erro

### Documentação

1. [ARCHITECTURE.md](docs/ARCHITECTURE.md) – Visão geral da arquitetura e pipeline de dados.
2. [CALIBRATION_DETAILED.md](docs/CALIBRATION_DETAILED.md) – Formalismo estatístico e equações de calibração.
3. [SIMULATION_MODELS.md](docs/SIMULATION_MODELS.md) – Os 4 modelos de simulação (Gamma-Poisson, Gaussiano, Sets).
4. [OPERATIONS_GUIDE.md](docs/OPERATIONS_GUIDE.md) – Guia operacional e troubleshooting.
5. [SPECIAL_CASES.md](docs/SPECIAL_CASES.md) – Edge cases: playoffs, ausências, normalização de nomes.
6. [BACKTEST_RESULTS](docs/BACKTEST_RESULTS.md) – Resultados de backtesting e métricas preditivas.
7. [FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md) – Arquitetura da interface web e fluxo de dados no frontend.
8. [DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) – Dicionário de dados dos CSVs e JSONs produzidos.

---

<a id="english"></a>

## 🇬🇧 English

### Overview

ELO rating system and match prediction engine for the **University of Aveiro Cup (Taça UA)**. Uses probabilistic modeling and Monte Carlo simulation to compute team ratings and project final standings with associated probabilities.

### Architecture

The pipeline consists of four sequential modules:

1. **Extraction (`extrator.py`)**: Extracts data from official spreadsheets (Excel), normalizes team names, and auto-detects sport modalities.
2. __ELO Calculation (`mmr_taçaua.py`)__: Processes match results chronologically to compute team ratings using a dynamic $K$-factor (ranging 65–210), tuned for the higher volatility of collegiate sports.
3. **Calibration (`calibrator.py`)**: Estimates optimal parameters from historical match data — calibrates Gamma-Poisson distributions (and Gaussian models for other sports) to maximize prediction accuracy.
4. **Prediction (`preditor.py`)**: Runs Monte Carlo simulations ($10^4$ to $10^6$ iterations) to compute final standings probabilities and progression scenarios through to the finals.

### K-Factor

Rating updates use a compound multiplier:

$$K = 100 \times M_{phase} \times M_{proportion}$$

- **$K_{base} = 100$**: High base value (vs 32 in chess) to capture the inherent uncertainty of collegiate sports.
- **$M_{phase}$**: Varies by competition phase — early season $>1.5$, regular season $1.0$, lower tiers $0.75$, playoffs $1.5$.
- **$M_{proportion}$**: Margin-of-victory bonus — dominant wins $+26\%$, narrow wins $+7\%$.

*Validation: observed average $K$-factor is 102, against a theoretical value of 100.*

### Scaling Factor (E-factor) = 250

Win probability uses $E = 250$ (instead of the standard chess $E = 400$):

$$P(victory) = \frac{1}{1 + 10^{-(\Delta ELO)/250}}$$

Calibrated for high-variance collegiate sports. Tested with starting ELOs of 1000, 500, and 750.

*Validation: at $\Delta Elo = 200$, the model predicts $73\%$ wins vs $72\%$ actually observed. Goodness of Fit: $99.2\%$.*

### Installation and Usage

```bash
pip install -r requirements.txt
cd src

python extrator.py                    # ~30s
python mmr_taçaua.py                  # ~2-3 min
python calibrator.py                  # ~1 min
python preditor.py                    # ~5 min
```

### Validation (Backtesting)

The system includes backtesting (retrospective prediction on historical data):

- **Brier Score:** $0.133$–$0.175$ (target: $<0.150$)
- **Position RMSE:** $1.6$ to $2.8$ positions of error

### Documentation

1. [ARCHITECTURE.md](docs/ARCHITECTURE.md) – Architecture overview and data pipeline.
2. [CALIBRATION_DETAILED.md](docs/CALIBRATION_DETAILED.md) – Statistical formalism and calibration equations.
3. [SIMULATION_MODELS.md](docs/SIMULATION_MODELS.md) – The 4 simulation models (Gamma-Poisson, Gaussian, Sets).
4. [OPERATIONS_GUIDE.md](docs/OPERATIONS_GUIDE.md) – Operational guide and troubleshooting.
5. [SPECIAL_CASES.md](docs/SPECIAL_CASES.md) – Edge cases: playoffs, absences, name normalization.
6. [BACKTEST_RESULTS](docs/BACKTEST_RESULTS.md) – Backtesting results and predictive metrics.
7. [FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md) – Web interface architecture and frontend data flow.
8. [DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) – Data dictionary for generated CSV and JSON outputs.
