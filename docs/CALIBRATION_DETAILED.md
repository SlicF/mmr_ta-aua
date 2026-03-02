# CALIBRATION_DETAILED.md - Calibração

## Gamma-Poisson
k = μ² / (σ² - μ), com floor k≥3.0

## Regressão Logística Empates
P(draw) = 1/(1+exp(-(β₀ + β₁|ΔElo| + β₂(ΔElo)²)))
Validação: ≥5 empates, |intercept|≤100, |coef|≤10

## Exemplo Futsal M (25-26)
- 101 jogos após filtrar ausências (4 removidas)
- base_goals: 3.25 (média)
- dispersion_k: 8.2 (variância)
- draw_model: ACCEPTED (7.9% taxa real)

## Parâmetros
Futsal M: 3.25 golos, k=8.2, limite=0.60
Andebol: 22.7 golos, k=20.48, limite=0.45
Basquete: Gaussiano (9.51 pontos, σ=4.67)
Voleibol: Binomial (p_sweep=0.719)
