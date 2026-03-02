# SIMULATION_MODELS.md - 4 Modelos

## Modelo A: Futsal & Futebol 7
Gamma-Poisson com ajuste ELO e clipping dinâmico

## Modelo B: Andebol
Gamma-Poisson + draw model (4.3% if empate)

## Modelo C: Basquetebol
Gaussiano com prolongamento (raro, 3.4%)

## Modelo D: Voleibol
Binomial por sets (2-0=51.7%, 2-1=20.4%)

## Validação
- Futsal: Golos preditos vs reais +1.2%
- Voleibol: P(2-0) predito 51.2% vs observado 50.7%
