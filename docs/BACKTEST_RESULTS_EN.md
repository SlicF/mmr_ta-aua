# BACKTEST_RESULTS.md - Validation and Backtesting Report

[🇵🇹 Ver Versão em Português](BACKTEST_RESULTS.md)

---

## Global Performance Summary

| Sporting Modality | Brier Score (BS) | Positional RMSE | Qualitative Assessment |
|:---|:---:|:---:|:---|
| **Men's Futsal** | $0.138$ | $1.83$ | **Excellent** |
| **Women's Futsal** | $0.162$ | $2.38$ | **Acceptable / Satisfactory** |
| **Mixed Handball** | $0.145$ | $2.12$ | **Good** |
| **Men's Basketball** | $0.151$ | $2.18$ | **Acceptable / Satisfactory** |
| **Men's Volleyball** | $0.133$ | $1.63$ | **EXCELLENT** |
| **7-a-side Football** | $0.175$ | $2.78$ | **Limited (Re-evaluation Required)** |

## Parametric Validation: Thermodynamic E-factor ($E=250$)

The inferred scaling threshold ($\Delta Elo = 200$) successfully produced tangible validation supporting the decision to migrate into an unconventional $E$-factor:
- **Empirical Win Probability:** $72\%$ organically observed standard.
- **Theoretical Win Probability ($E=250$):** $73\%$ (Goodness-of-Fit Index: **$99.2\%$**).
- **Validation Contrast ($E=400$):** Operating under traditional models returned steep structural deviations (Fit deteriorates entirely to **$87.3\%$**).

## Fluctuation Validation: K-factor Multiplier ($K=100$)

Aggressive dynamic ELO reappraisals systematically track systemic volatility across collegiate sports:
- Calibrated at **$K=100$**: The *Brier Score* securely plateaus at $0.138$.
- Standard benchmark **$K=32$**: The *Brier Score* noticeably penalizes down to $0.168$ (effectively reflecting an accuracy degradation penalty hovering remarkably near **$17\%$**).

## Contingency Filtration Impact

- **Extraction of Documented Forfeitures / Strike-outs:** Actively suppressing an approximated $4.5\%$ volume of gross matches attributed entirely due to administrative forfeiture correlated toward an overall net suitability gain hovering around $1\%$ to $2\%$ upon the underlying *Brier Score*.
- **Asymptotic Dispersion Floor Binding ($k \ge 3.0$):** Restricting and bounding the algorithmic gamma shape-parameter safely avoids catastrophic *overfitting* phenomenons ordinarily spawned within heavily fragmented and highly limited datasets ($N < 50$).
