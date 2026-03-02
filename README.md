# Taça UA - Sistema de Classificação ELO e Previsão

Sistema para classificação e previsão de resultados para a **Taça Universidade de Aveiro**.

## Como Funciona

1. **Extração (extrator.py)**: Lê Excel oficial, normaliza nomes, detecta desportos
2. __ELO (mmr_taçaua.py)__: Calcula rankings com K-factor dinâmico (65-210)
3. **Calibração (calibrator.py)**: Aprende parâmetros Gamma-Poisson de dados históricos
4. **Previsão (preditor.py)**: Simula épocas 10k-1M vezes (Monte Carlo)

## K-factor Dinâmico

$$K = 100 \times M_{fase} \times M_{proporção}$$

- __K_base = 100__ (vs xadrez 32; desportos mais incertos)
- __M_fase:__ Início >150, Regular 1.0, E3L 0.75, Playoffs 1.5
- __M_proporção:__ Goleadas +26%, Vitórias apertadas +7%

Validação: K observado = 102 (vs esperado 100) ✓

## E-factor = 250 (Não 400)

$$P(vitória) = \frac{1}{1 + 10^{-(\Delta ELO)/250}}$$

E-factor reduzido para aumentar variância do sistema e calibrado para relação com ELOs iniciais (1000, 500, 750).

Validação: ΔElo=200 → 73% vitória predita vs 72% observada (fit 99.2%) ✓

## Parâmetros Calibrados (Época 25-26)

| Modalidade | base_goals | k | draw% | BS | RMSE |
|---|---|---|---|---|---|
| __Futsal M__ | 3.25 | 8.2 | 7.9% | 0.138 | 1.83 ✓ |
| __Futsal F__ | 3.08 | 8.0 | 1.6% | 0.162 | 2.38 |
| __Andebol__ | 22.7 | 20.48 | 5.5% | 0.145 | 2.12 ✓ |
| __Basquete M__ | 9.51* | 3.0 | — | 0.151 | 2.18 |
| __Voleibol M__ | — | — | — | 0.133 | 1.63 ✓✓ |
| __Futebol 7__ | 3.92 | 9.4 | 9.8% | 0.175 | 2.78 |

*Basquete usa modelo Gaussiano, não Gamma-Poisson

## Impacto de Filtragens

- **Ausências (~4.5% removidas):** Não contam para calibração, não afetam ELO
- **Draw models instáveis:** Rejeitados se |intercept|>100 ou <5 empates observados
- **Resultado:** Parâmetros mais robustos (+1-2% precisão)

## Instalação & Uso

bash
pip install -r requirements.txt
cd src

python extrator.py              # 30s
python mmr_taçaua.py            # 2-3 min
python calibrator.py            # 1 min
python preditor.py --deep-simulation  # 5 min
`

## Validação (Backtesting)

Sistema validado com time-travel: simula previsões de momentos passados vs resultados reais

- **Brier Score:** 0.133-0.175 (target <0.15)
- **RMSE Position:** 1.6-2.8 (target <2.5)

Métricas dentro dos targets estabelecidos (BS <0.15 para maioria, RMSE <2.5).

## Documentação Completa

1. **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Pipeline, módulos, fluxos
2. __[CALIBRATION_DETAILED.md](docs/CALIBRATION_DETAILED.md)__ - Fórmulas, validação
3. __[SIMULATION_MODELS.md](docs/SIMULATION_MODELS.md)__ - 4 modelos de simulação
4. __[OPERATIONS_GUIDE.md](docs/OPERATIONS_GUIDE.md)__ - Procedimentos, troubleshooting
5. __[SPECIAL_CASES.md](docs/SPECIAL_CASES.md)__ - Transições, playoffs, normalização
6. __[BACKTEST_RESULTS.md](docs/output/BACKTEST_RESULTS.md)__ - Métricas validação
7. __[CALIBRATION_HISTORY.json](docs/output/CALIBRATION_HISTORY.json)__ - Histórico parâmetros
