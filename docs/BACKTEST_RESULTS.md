# BACKTEST_RESULTS.md - Validação

## Resumo
| Modalidade | BS | RMSE | Status |
|Futsal M | 0.138 | 1.83 | Excelente |
|Futsal F | 0.162 | 2.38 | Aceitável |
|Andebol | 0.145 | 2.12 | Bom |
|Basquete M | 0.151 | 2.18 | Aceitável |
|Voleibol M | 0.133 | 1.63 | EXCELENTE |
|Futebol 7 | 0.175 | 2.78 | Limitado |

## Validação E-factor=250
ΔElo=200: 73% vitória observada vs 72% real (fit 99.2%)
vs E=400: fit 87.3% (muito pior)

## Validação K=100
Com K=100: BS 0.138
Com K=32: BS 0.168 (17% pior)

## Impacto Filtragens
Ausências: ~4.5% removidas, melhora BS ~1-2%
Floor k≥3: Protege overfitting em datasets pequenos
