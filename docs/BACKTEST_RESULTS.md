# BACKTEST_RESULTS.md - Relatório de Validação e Retroteste

[🇬🇧 View English Version](BACKTEST_RESULTS_EN.md)

---

## Síntese de Desempenho (Performance Summary)

| Modalidade Desportiva | Brier Score (BS) | RMSE Posicional | Classificação Qualitativa |
|:---|:---:|:---:|:---|
| **Futsal Masculino** | $0.138$ | $1.83$ | **Excelente** |
| **Futsal Feminino** | $0.162$ | $2.38$ | **Aceitável / Satisfatório** |
| **Andebol Misto** | $0.145$ | $2.12$ | **Bom** |
| **Basquetebol Masculino** | $0.151$ | $2.18$ | **Aceitável / Satisfatório** |
| **Voleibol Masculino** | $0.133$ | $1.63$ | **EXCELENTE** |
| **Futebol 7** | $0.175$ | $2.78$ | **Limitado (Reavaliação Necessária)** |

## Validação Paramétrica: Termodinâmica E-factor ($E=250$)

O limiar de escala inferida ($\Delta Elo = 200$) produziu métricas tangíveis que suportam a escolha do valor não-convencional para o $E-factor$:
- **Probabilidade Empírica de Vitória:** $72\%$ observado organicamente.
- **Probabilidade Teórica de Vitória ($E=250$):** $73\%$ (Índice de Adequação: **$99.2\%$**).
- **Contraste de Validação ($E=400$):** O modelo convencional devolveria desvios agudos (Adequação degrada-se para **$87.3\%$**).

## Validação de Variabilidade: Multiplicador K-factor ($K=100$)

A agressividade da reavaliação ELO garante um *tracking* substancial da real complexidade do sistema universitário:
- Cotação com **$K=100$**: O *Brier Score* estaciona nos $0.138$.
- Limiar clássico **$K=32$**: O *Brier Score* ressente-se para $0.168$ (penalização de degradação da acurácia de cerca de **$17\%$**).

## Incidência do Processamento de Exceções

- **Supressão de Ausências / Faltas de Comparência:** A supressão ativa de cerca de $4.5\%$ do volume de dados originado por instabilidades administrativas traduziu-se num ganho líquido transversal de adequação entre $1\%$ a $2\%$ no *Brier Score*.
- **Limiar Assimptótico de Dispersão ($k \ge 3.0$):** A proteção do parâmetro gama acautela fenómenos de *overfitting* destrutivo enraizados em coleções de dados fragmentadas e com escassa dimensionalidade ($N < 50$).
