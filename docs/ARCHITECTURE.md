# ARCHITECTURE.md - Pipeline e Módulos

## Pipeline
Excel → extrator.py → CSV → mmr_taçaua.py (ELO) → calibrator.py (Parâmetros) → preditor.py (Simulação) → Website

## K-factor Dinâmico
K = 100 × M_fase × M_proporção
- Início: >150 (muita incerteza)
- Regular: 1.0
- E3L: 0.75
- Playoffs: 1.5
- Proporção M = (max_goals/min_goals)^0.1

## E-factor = 250 (não 400)
Desportos=60% skill + 40% sorte. Validado com dados reais.

## Dados Época 25-26
Futsal M: base=3.25, k=8.2, draw=7.9%, BS=0.138
Andebol: base=22.7, k=20.48, BS=0.145
Voleibol M: p_sweep=0.719, BS=0.133 (excelente)
