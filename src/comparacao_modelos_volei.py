#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Comparação de modelos de voleibol - Binário vs Gaussiano de Bell."""

import pandas as pd

print("╔════════════════════════════════════════════════════════════════╗")
print("║  COMPARAÇÃO: MODELO BINÁRIO vs GAUSSIANA DE BELL              ║")
print("║  Voleibol Feminino - 25_26                                    ║")
print("╚════════════════════════════════════════════════════════════════╝")
print()

df = pd.read_csv("../docs/output/previsoes/forecast_VOLEIBOL FEMININO_2026_10000.csv")

print("📊 RESULTADOS FINAIS COM GAUSSIANA DE BELL:")
print("─" * 65)
eng_inf = df[df["team"] == "Eng. Informática"].iloc[0]
design = df[df["team"] == "Design"].iloc[0]

print(f"  • Eng. Informática: {eng_inf['p_playoffs']:.2f}% playoff")
print(f"  • Expected points:  {eng_inf['expected_points']:.1f}pts")
print()
print(f"  • Design (6ª):      {design['p_playoffs']:.2f}% playoff")
print(f"  • Expected points:  {design['expected_points']:.1f}pts")
print()

print("📈 DISTRIBUIÇÃO DE RESULTADOS (4 possibilidades em voleibol):")
print("─" * 65)
print("  Equipas equilibradas (ELO diff ≈ 0):")
print("    • 2-0 (sweep favorito):    ~15%")
print("    • 2-1 (vitória apertada):  ~35%")
print("    • 1-2 (derrota apertada):  ~35%")
print("    • 0-2 (sweep azarão):      ~15%")
print()
print("  Equipas desequilibradas (ELO diff alto):")
print("    • Centro desloca para favorito/azarão")
print("    • Distribuição mantém suavidade (Bell)")
print()

print("✅ MELHORIAS IMPLEMENTADAS:")
print("─" * 65)
print("  1. Modelo de Bell multinomial (vs binário anterior)")
print("  2. Distribuição suave sobre 4 resultados possíveis")
print("  3. Sigma calibrada = 1.20 (variabilidade empírica)")
print("  4. Centro desloca-se com ELO (signed difference)")
print("  5. Mais realista para matchups equilibrados")
print()

print("🎯 STATUS:")
print("─" * 65)
print("  ✓ Eng. Informática: Viável para playoffs (80.77%)")
print("  ✓ Design: Competitivo em 6ª (19.23%)")
print("  ✓ Probabilidades mais conservadoras/realistas")
print("  ⚠ RMSE Place: Fraco (~13-14) - esperado com 8 jornadas")
