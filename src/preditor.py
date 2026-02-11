# -*- coding: utf-8 -*-
"""
Sistema de Previsão de Competições Desportivas (Taçaua)

OTIMIZAÇÕES DE PERFORMANCE IMPLEMENTADAS:
==========================================
✓ ProcessPoolExecutor: Substitui ThreadPoolExecutor para superar o Python GIL
  - 5-10x speedup em operações CPU-bound (simulações Monte Carlo)
  - Utiliza todos os cores da CPU eficientemente

✓ Progress Tracking Simplificado: Otimizado para multiprocessing
  - Usa multiprocessing.Manager() para shared state entre processos
  - Progress bar limpa e atualizada in-place (reduz overhead de I/O)

✓ Serialização Adequada: Dados preparados como primitivos/tuplas
  - Objetos são reconstruídos em cada worker process
  - Evita problemas de pickling complexo

MELHORIAS FUTURAS SUGERIDAS:
============================
→ joblib: Biblioteca otimizada para ML pipelines
  - from joblib import Parallel, delayed
  - results = Parallel(n_jobs=-1)(delayed(worker)(args) for args in tasks)
  - Vantagens: caching inteligente, progress bar integrado, melhor gestão de memória

→ Benchmark: Comparar tempos antes/depois com timeit ou time.perf_counter()
→ Tuning: Ajustar max_workers baseado no tipo de CPU (P-cores vs E-cores)
"""
import math
import random
import json
import numpy as np
from dataclasses import dataclass
from collections import defaultdict
from typing import List, Tuple, Dict, Optional, Set
import csv
import os
from datetime import datetime
import sys
import io
import locale
import re
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, as_completed
import threading

# Configurar encoding UTF-8 para Windows
if sys.platform == "win32":
    # Forçar UTF-8 em stdout e stderr
    sys.stdout = io.TextIOWrapper(
        sys.stdout.buffer, encoding="utf-8", line_buffering=True
    )
    sys.stderr = io.TextIOWrapper(
        sys.stderr.buffer, encoding="utf-8", line_buffering=True
    )

    # Tentar configurar locale para português
    try:
        locale.setlocale(locale.LC_ALL, "pt_PT.UTF-8")
    except:
        try:
            locale.setlocale(locale.LC_ALL, "pt_PT")
        except:
            pass


@dataclass
class Team:
    name: str
    elo: float
    games_played: int = 0
    games_before_winter: int = 0


# ============================================================================
# SISTEMA ELO COMPLETO - Extraído de mmr_taçaua.py
# ============================================================================


class CompleteTacauaEloSystem:
    """
    Sistema ELO EXATO do mmr_taçaua.py com fórmula completa.

    FÓRMULA: ΔElo = K_factor × (Score_real - Score_esperado)

    Componentes:
    1. Score_esperado = 1/(1 + 10^((ELO_B - ELO_A)/250))
    2. K_factor = K_base × Season_Phase_Multiplier × Proportion_Multiplier
    3. Score_real = 1 (vitória), 0.5 (empate), 0 (derrota)
    """

    def __init__(self, k_base: float = 100):
        self.k_base = k_base

    def elo_win_probability(self, elo_a: float, elo_b: float) -> float:
        """P(A vence) = 1 / (1 + 10^((ELO_B - ELO_A) / 250))"""
        return 1.0 / (1.0 + 10 ** ((elo_b - elo_a) / 250))

    def calculate_season_phase_multiplier(
        self,
        game_number: int,
        total_group_games: int,
        game_number_before_winter: int = None,
        jornada: str = None,
    ) -> float:
        """
        Multiplier que varia ao longo da época.

        Casos:
        - Jogo do 3º lugar (E3L): 0.75
        - Playoffs: 1.5
        - Após pausa de inverno: 1 / log(4×(scaled - 4), 16)^(1/2)
        - Início (primeiros 1/3): 1 / log(4×scaled, 16)
        - Resto: 1.0
        """
        if jornada and str(jornada).upper() == "E3L":
            return 0.75

        game_number_scaled = (game_number / total_group_games) * 8

        if game_number_scaled > 8:
            return 1.5
        elif game_number_before_winter is not None:
            game_number_after = game_number - game_number_before_winter
            game_number_after_scaled = (
                5 + (game_number_after - 1) / total_group_games * 8
            )

            if game_number_after_scaled < 8 * (1 / 3) + 5:
                return (1 / math.log(4 * (game_number_after_scaled - 4), 16)) ** (1 / 2)
            return 1.0
        elif game_number_scaled < 8 * (1 / 3):
            game_number_start_scaled = 1 + (game_number - 1) / total_group_games * 8
            return 1 / math.log(4 * game_number_start_scaled, 16)
        else:
            return 1.0

    def calculate_score_proportion(self, score1: int, score2: int) -> float:
        """
        Multiplier baseado na proporção de golos.
        proportion_multiplier = max(score1/score2, score2/score1)^(1/10)
        """
        if score2 == 0:
            score2 = 0.5
        if score1 == 0:
            score1 = 0.5

        return max((score1 / score2), (score2 / score1)) ** (1 / 10)

    def calculate_elo_change(
        self,
        team1_elo: float,
        team2_elo: float,
        score1: int,
        score2: int,
        game_number_team1: int,
        game_number_team2: int,
        total_group_games_team1: int,
        total_group_games_team2: int,
        games_before_winter_team1: int = None,
        games_before_winter_team2: int = None,
        jornada: str = None,
        has_absence: bool = False,
    ) -> Tuple[float, float]:
        """
        Calcula mudança de ELO com sistema completo.
        """
        expected1 = self.elo_win_probability(team1_elo, team2_elo)
        expected2 = 1 - expected1

        if score1 > score2:
            score_real_1, score_real_2 = 1.0, 0.0
        elif score1 < score2:
            score_real_1, score_real_2 = 0.0, 1.0
        else:
            score_real_1, score_real_2 = 0.5, 0.5

        phase_mult_1 = self.calculate_season_phase_multiplier(
            game_number_team1,
            total_group_games_team1,
            games_before_winter_team1,
            jornada,
        )
        phase_mult_2 = self.calculate_season_phase_multiplier(
            game_number_team2,
            total_group_games_team2,
            games_before_winter_team2,
            jornada,
        )

        proportion_mult = self.calculate_score_proportion(score1, score2)

        k_factor_1 = self.k_base * phase_mult_1 * proportion_mult
        k_factor_2 = self.k_base * phase_mult_2 * proportion_mult

        elo_change_1 = k_factor_1 * (score_real_1 - expected1)
        elo_change_2 = k_factor_2 * (score_real_2 - expected2)

        elo_delta_1 = round(elo_change_1)
        elo_delta_2 = round(elo_change_2)

        if has_absence:
            elo_delta_1 = 0
            elo_delta_2 = 0

        return elo_delta_1, elo_delta_2


# ============================================================================
# HARDSET DE RESULTADOS - Sistema de cenários "What-If"
# ============================================================================


@dataclass
class FixedResult:
    """Representa um resultado fixado para simulação."""

    match_id: str
    score_a: int
    score_b: int

    def __str__(self):
        return f"{self.match_id}: {self.score_a}-{self.score_b}"


class HardsetManager:
    """
    Gere resultados fixados para simulações "what-if".

    Permite explorar cenários tipo:
    - "E se o jogo X acabar 5-4?"
    - "Como isso afeta os ELOs esperados?"
    - "Qual o efeito borboleta nos outros jogos?"

    NOTA: Suporta tanto match_id curtos (EGI) como longos (Eng. e Gestão Industrial).
    """

    def __init__(self, mapping_short: Dict[str, str] = None):
        self.fixed_results: Dict[str, FixedResult] = {}
        self.mapping_short = mapping_short or {}
        # Índice alternativo para busca por variações do match_id
        self.match_id_aliases: Dict[str, str] = {}

    def get_affected_modalidades(self) -> set:
        """Retorna o conjunto de modalidades afetadas pelos hardsets."""
        modalidades = set()
        for match_id in self.fixed_results:
            # match_id formato: "FUTSAL FEMININO_5_EGI_EI"
            parts = match_id.split("_")
            if len(parts) >= 2:
                # Primeira parte é a modalidade (pode ter espaços)
                # Procurar onde o número da jornada (inteiro) aparece
                for i, part in enumerate(parts):
                    if part and part[0].isdigit() and i > 0:
                        # Parte antes de i é a modalidade
                        modalidade = "_".join(parts[:i])
                        modalidades.add(modalidade)
                        break
        return modalidades

    def _normalize_match_id_for_lookup(self, match_id: str) -> str:
        """
        Normaliza match_id para lookup, tratando variações curtas/longas.

        Se o match_id não existir diretamente, tenta converter nomes curtos em longos.

        Exemplos:
        - "FUTSAL FEMININO_5_EGI_Direito" -> procura por "FUTSAL FEMININO_5_EGI_Direito"
        - Se não encontrar, tenta expandir "EGI" em "Eng. e Gestão Industrial"
        """
        # Primeiro, verificar se existe diretamente
        if match_id in self.fixed_results:
            return match_id

        # Se não, tentar expandir formas curtas em longas
        parts = match_id.split("_")
        if len(parts) >= 4:
            # Formato esperado: MODALIDADE_JORNADA_TEAM_A_TEAM_B
            # Mas TEAM_A e TEAM_B podem ter múltiplas partes por terem espaços

            # Reconstruir com lookup no mapping
            modalidade_jornada = "_".join(parts[:2])
            rest = "_".join(parts[2:])

            # Tentar encontrar no alias
            if match_id in self.match_id_aliases:
                return self.match_id_aliases[match_id]

        return match_id

    def add_fixed_result(self, match_id: str, score_a: int, score_b: int) -> None:
        """
        Adiciona um resultado fixado.

        Args:
            match_id: ID do jogo (ex: "FUTSAL MASCULINO_5_EGI_Gestão")
            score_a: Golos da equipa A
            score_b: Golos da equipa B
        """
        self.fixed_results[match_id] = FixedResult(match_id, score_a, score_b)
        print(f"✓ Resultado fixado: {match_id} → {score_a}-{score_b}")

    def add_from_dict(self, fixed_dict: Dict[str, Tuple[int, int]]) -> None:
        """
        Adiciona múltiplos resultados de um dicionário.

        Args:
            fixed_dict: {match_id: (score_a, score_b)}

        Exemplo:
            hardset.add_from_dict({
                "FUTSAL MASCULINO_5_Eng_Gestão": (5, 4),
                "FUTSAL MASCULINO_6_Direito_Medicina": (2, 2),
            })
        """
        for match_id, (score_a, score_b) in fixed_dict.items():
            self.add_fixed_result(match_id, score_a, score_b)

    def add_from_csv(self, csv_file: str) -> None:
        """
        Carrega resultados fixados de um CSV.

        Formato CSV:
        match_id,score_a,score_b
        FUTSAL MASCULINO_5_Eng_Gestão,5,4
        FUTSAL MASCULINO_6_Direito_Medicina,2,2

        NOTA: Normaliza nomes de equipas usando mapping_short para compatibilidade com
              nomes curtos gerados pelo sistema.
        """
        try:
            with open(csv_file, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    match_id = row["match_id"]
                    score_a = int(row["score_a"])
                    score_b = int(row["score_b"])

                    # Normalizar match_id: converter nomes de equipas longas em curtas
                    # Se mapping_short está disponível, tentar normalizar
                    if self.mapping_short:
                        parts = match_id.split("_")
                        if len(parts) >= 4:
                            # Tentar normalizar o team_a (partes a partir do índice 2)
                            # Procurar por nomes conhecidos no mapping_short
                            for long_name, short_name in self.mapping_short.items():
                                if "_" + long_name in match_id:
                                    match_id = match_id.replace(long_name, short_name)

                    self.add_fixed_result(match_id, score_a, score_b)
            print(f"✓ Carregados {len(self.fixed_results)} resultados de {csv_file}")
        except Exception as e:
            print(f"❌ Erro ao carregar hardset CSV: {e}")

    def get_fixed_result(self, match_id: str) -> Optional[FixedResult]:
        """Retorna resultado fixado para um jogo, se existir."""
        # Procurar com normalização
        normalized = self._normalize_match_id_for_lookup(match_id)
        return self.fixed_results.get(normalized)

    def has_fixed_result(self, match_id: str) -> bool:
        """Verifica se um jogo tem resultado fixado."""
        # Procurar com normalização
        normalized = self._normalize_match_id_for_lookup(match_id)
        return normalized in self.fixed_results

    def clear(self) -> None:
        """Remove todos os resultados fixados."""
        self.fixed_results.clear()
        self.match_id_aliases.clear()
        print("✓ Todos os resultados fixados foram removidos")

    def summary(self) -> str:
        """Retorna resumo dos resultados fixados."""
        if not self.fixed_results:
            return "Nenhum resultado fixado"

        lines = [f"Resultados fixados ({len(self.fixed_results)}):"]
        for fr in self.fixed_results.values():
            lines.append(f"  • {fr}")
        return "\n".join(lines)


class SportScoreSimulator:
    """
    Simula resultados realistas por modalidade.

    Modelos:
    - Voleibol: Binário (2-0 ou 2-1)
    - Basquete 3x3: Até 21 pontos, perdedor >= 2
    - Futsal/Andebol/Futebol7: Poisson híbrido
    """

    def __init__(self, sport_type: str = "futsal"):
        self.sport_type = sport_type
        # Baselines médios por modalidade (golos por equipa por jogo)
        self.baselines = {
            "futsal": {
                "base_goals": 4.5,
                "elo_scale": 600,
                "elo_scale_mult": 0.75,
                "dispersion_k": 5.0,
                "forced_draw_fraction": 0.98,  # 98% forçados - eliminar empates Poisson (1.1% histórico)
                "elo_adjustment_limit": 1.2,  # Permite surras bem maiores (725 ELO diff)
            },
            "andebol": {
                "base_goals": 18.0,
                "elo_scale": 500,
                "elo_scale_mult": 0.75,
                "dispersion_k": 12.0,
                "forced_draw_fraction": 0.55,  # 55% forçados - empates comuns (4.4% histórico)
                "elo_adjustment_limit": 0.7,  # Mais conservador para evitar zeros
            },
            "basquete": {
                "max_score": 21,
                "min_score": 2,
                "elo_scale": 400,
                "sigma": 5.5,  # Aumentado de 3.5 para mais variância, evita zeros
                "sigma_mult": 1.3,
                "elo_adjustment_limit": 0.5,  # Limita ajuste de ELO em basquete
            },
            "volei": {"elo_scale": 500},
            "futebol7": {
                "base_goals": 3.0,
                "elo_scale": 600,
                "elo_scale_mult": 0.75,
                "dispersion_k": 6.0,
                "forced_draw_fraction": 0.90,  # 90% forçados - reduzir empates Poisson (11.7% histórico)
                "elo_adjustment_limit": 1.0,  # Um meio termo
            },
        }
        self.params = self.baselines.get(sport_type, self.baselines["futsal"])
        self.division_baselines = {}
        self.division_draw_rates = {}

    def set_division_baselines(
        self, baselines: Dict[Optional[int], Dict[str, float]]
    ) -> None:
        self.division_baselines = baselines or {}

    def set_division_draw_rates(self, draw_rates: Dict[Optional[int], float]) -> None:
        self.division_draw_rates = draw_rates or {}

    def _get_division_baseline(
        self, division: Optional[int]
    ) -> Optional[Dict[str, float]]:
        if division in self.division_baselines:
            return self.division_baselines[division]
        return self.division_baselines.get(None)

    def _get_division_draw_rate(self, division: Optional[int]) -> float:
        if division in self.division_draw_rates:
            return self.division_draw_rates[division]
        return self.division_draw_rates.get(None, 0.0)

    def simulate_score(
        self,
        elo_a: float,
        elo_b: float,
        force_winner: bool = False,
        division: Optional[int] = None,
    ) -> Tuple[int, int]:
        """Simula resultado baseado no tipo de desporto e ELOs.

        Args:
            elo_a: ELO da equipa A
            elo_b: ELO da equipa B
            force_winner: Se True (playoffs), força desempate. Se False (época regular),
                         permite empates naturais (quando aplicável).

        Para Voleibol: Nunca tem empate (sempre força vencedor).
        Para Basquete: Permite empates em época regular, força vencedor em playoffs.
        Para Poisson (Futsal/Andebol/Futebol7): Permite empates em época regular,
                                                 força vencedor em playoffs.
        """
        division_baseline = self._get_division_baseline(division)
        target_draw_rate = self._get_division_draw_rate(division)

        if self.sport_type == "volei":
            # Voleibol nunca tem empates
            p_a = 1.0 / (1.0 + 10 ** ((elo_b - elo_a) / 250))
            winner_is_a = random.random() < p_a
            return self._simulate_volei(elo_a, elo_b, winner_is_a)

        elif self.sport_type == "basquete":
            # Basquete 3x3: NUNCA tem empates (sempre vai a prolongamento)
            base_score = (
                division_baseline["mean"]
                if division_baseline and "mean" in division_baseline
                else 15
            )
            sigma = (
                division_baseline.get("std")
                if division_baseline and "std" in division_baseline
                else self.params.get("sigma", 3.5)
            )
            sigma = max(2.0, sigma) * self.params.get("sigma_mult", 1.0)
            # SEMPRE força vencedor - basquete não tem empates
            return self._simulate_basquete(elo_a, elo_b, True, base_score, sigma)

        else:
            # Poisson (Futsal, Andebol, Futebol7)
            base_goals = (
                division_baseline["mean"]
                if division_baseline and "mean" in division_baseline
                else self.params.get("base_goals", 4.5)
            )
            elo_scale = self.params.get("elo_scale", 600) * self.params.get(
                "elo_scale_mult", 1.0
            )
            dispersion_k = self.params.get("dispersion_k", 6.0)
            forced_draw_fraction = self.params.get("forced_draw_fraction", 0.7)

            if force_winner:
                # Em playoffs, simular até ter vencedor
                while True:
                    score_a, score_b = self._simulate_poisson(
                        elo_a, elo_b, base_goals, elo_scale, dispersion_k
                    )
                    if score_a != score_b:
                        return (score_a, score_b)
            else:
                # Em época regular, combinar empates forçados com empates naturais
                if target_draw_rate > 0 and random.random() < (
                    target_draw_rate * forced_draw_fraction
                ):
                    # Empate forçado com placar realista
                    goals = max(0, int(np.random.poisson(base_goals)))
                    return (goals, goals)

                # Poisson normal - descartar empates se taxa histórica baixa (<20%)
                # Isto é necessário porque o Poisson gera ~50% empates em desportos de baixo scoring
                max_attempts = 50 if target_draw_rate < 0.20 else 1
                for attempt in range(max_attempts):
                    score_a, score_b = self._simulate_poisson(
                        elo_a, elo_b, base_goals, elo_scale, dispersion_k
                    )
                    # Se não é empate OU taxa alta permite empates naturais, aceitar
                    if score_a != score_b or target_draw_rate >= 0.20:
                        return (score_a, score_b)
                    # Taxa baixa (<20%): tentar novamente para evitar empate Poisson

                # Fallback após todas tentativas (improvável)
                return (score_a, score_b)

    def _simulate_volei(
        self, elo_a: float, elo_b: float, winner_is_a: bool
    ) -> Tuple[int, int]:
        """Voleibol: Apenas 2-0 ou 2-1. P(2-0) aumenta com diferença de ELO."""
        elo_diff = abs(elo_a - elo_b)
        p_sweep = 0.35 + min(elo_diff / 800, 0.4)

        if random.random() < p_sweep:
            return (2, 0) if winner_is_a else (0, 2)
        else:
            return (2, 1) if winner_is_a else (1, 2)

    def _simulate_basquete(
        self,
        elo_a: float,
        elo_b: float,
        force_winner: bool = False,
        base_score: float = 15.0,
        sigma: float = 3.5,
    ) -> Tuple[int, int]:
        """
        Basquete 3x3: Até 21 pontos no tempo regulamentar.
        Cestos: 1 ponto (normal) ou 2 pontos (longo).
        Prolongamento: primeira equipa a marcar 2 pontos vence.

        Args:
            elo_a: ELO da equipa A
            elo_b: ELO da equipa B
            force_winner: Se True (playoffs), força desempate até haver vencedor.
                         Se False (época regular), permite empate natural.

        Retorna (score_a, score_b)
        """
        # Tempo regulamentar
        # Ajuste de ELO mais conservador para basquete (dividir por 250 em vez de 150)
        elo_adjustment_limit = self.params.get("elo_adjustment_limit", 0.5)
        elo_diff = (elo_a - elo_b) / 250
        elo_diff = max(-elo_adjustment_limit, min(elo_adjustment_limit, elo_diff))

        sigma = self.params.get("sigma", 3.5)

        base_score_a = base_score + elo_diff
        base_score_b = base_score - elo_diff

        score_a = min(21, max(0, int(np.random.normal(base_score_a, sigma))))
        score_b = min(21, max(0, int(np.random.normal(base_score_b, sigma))))

        # Se não há empate ou não força vencedor, retornar
        if score_a != score_b or not force_winner:
            return (score_a, score_b)

        # PROLONGAMENTO: Sudden death até 2 pontos
        # Primeira equipa a marcar 2 pontos vence
        p_a = 1.0 / (1.0 + 10 ** ((elo_b - elo_a) / 250))

        if random.random() < p_a:
            # Equipa A vence prolongamento
            # 30% chance de vencer com cesto de 2 pontos direto
            # 70% chance de vencer com 2 cestos de 1 ponto
            if random.random() < 0.30:
                # Cesto de 2 pontos: jogo acaba imediatamente
                return (score_a + 2, score_b + 0)
            else:
                # Dois cestos de 1 ponto: B pode marcar 0 ou 1
                b_scored = 1 if random.random() < 0.4 else 0
                return (score_a + 2, score_b + b_scored)
        else:
            # Equipa B vence prolongamento
            if random.random() < 0.30:
                return (score_a + 0, score_b + 2)
            else:
                # Dois cestos de 1 ponto: A pode marcar 0 ou 1
                a_scored = 1 if random.random() < 0.4 else 0
                return (score_a + a_scored, score_b + 2)

    def _simulate_poisson(
        self,
        elo_a: float,
        elo_b: float,
        base_goals: float,
        elo_scale: float,
        dispersion_k: float,
    ) -> Tuple[int, int]:
        """Futsal/Andebol/Futebol7: Modelo Poisson independente (permite empates)."""
        base = base_goals

        # Ajuste baseado em ELO
        elo_adjustment = (elo_a - elo_b) / elo_scale
        # Limitar conforme o desporto para evitar valores absurdos
        # Futsal: 1.2 (permite surras) | Andebol: 0.7 (mais conservador) | Futebol7: 1.0
        elo_adjustment_limit = self.params.get("elo_adjustment_limit", 0.6)
        elo_adjustment = max(
            -elo_adjustment_limit, min(elo_adjustment_limit, elo_adjustment)
        )

        # base_goals e' media por equipa; ajustar diretamente
        lambda_a = base * (1.0 + elo_adjustment)
        lambda_b = base * (1.0 - elo_adjustment)

        # Overdispersion para resultados mais extremos
        if dispersion_k and dispersion_k > 0:
            lambda_a *= np.random.gamma(dispersion_k, 1.0 / dispersion_k)
            lambda_b *= np.random.gamma(dispersion_k, 1.0 / dispersion_k)

        # Garantir valores positivos e dentro de limites razoáveis
        max_lambda = max(15.0, base * 2.0)
        lambda_a = max(0.2, min(max_lambda, lambda_a))
        lambda_b = max(0.2, min(max_lambda, lambda_b))

        # Amostrar golos de forma independente
        try:
            goals_a = int(np.random.poisson(lambda_a))
            goals_b = int(np.random.poisson(lambda_b))
        except (ValueError, OverflowError):
            # Fallback em caso de erro com valores extremos
            goals_a = max(0, int(lambda_a + np.random.normal(0, 1)))
            goals_b = max(0, int(lambda_b + np.random.normal(0, 1)))

        return (max(0, goals_a), max(0, goals_b))

    def sample_margin(self, elo_diff: float) -> int:
        """Compatibilidade com código antigo - retorna margem estimada."""
        if self.sport_type == "volei":
            return 1  # Margem sempre 1 ou 2
        elif self.sport_type == "basquete":
            return min(19, max(1, int(5 + elo_diff / 100)))
        else:
            base = self.params.get("base_goals", 4.0) / 2
            return max(1, int(base + abs(elo_diff) / 300))


def load_course_mapping(docs_dir: str = None) -> Tuple[Dict[str, str], Dict[str, str]]:
    """
    Carrega o mapeamento de nomes de cursos do config_cursos.json.

    Args:
        docs_dir: Caminho para o diretório docs. Se None, usa caminho relativo.

    Retorna:
        (mapping_to_display, mapping_to_short)

    - mapping_to_display: {"EGI" -> "Eng. e Gestão Industrial", "Eng. e Gestão Industrial" -> "Eng. e Gestão Industrial"}
    - mapping_to_short: {"Eng. e Gestão Industrial" -> "EGI", "EGI" -> "EGI"}
    """
    try:
        if docs_dir:
            config_path = os.path.join(docs_dir, "config", "config_cursos.json")
        else:
            config_path = "../docs/config/config_cursos.json"

        with open(config_path, encoding="utf-8-sig") as f:
            config = json.load(f)
            mapping_display = {}
            mapping_short = {}

            # Primeiro pass: mapear course_key -> (display_name, course_key)
            # Manter track de qual é o "course_key preferido" para cada displayName (forma curta sem espaços)
            displayName_to_preferred_key = {}  # displayName -> course_key_preferido

            for course_key, course_info in config.get("courses", {}).items():
                display_name = course_info.get("displayName", course_key)

                # Mapeamento para forma display (longa)
                mapping_display[course_key] = display_name
                mapping_display[display_name] = display_name

                # Mapeamento para forma curta
                mapping_short[course_key] = course_key

                # Definir curso_key preferido para cada displayName
                # Preferir o que tem menos espaços (forma mais curta)
                if display_name not in displayName_to_preferred_key:
                    displayName_to_preferred_key[display_name] = course_key
                else:
                    # Se este course_key é mais curto (menos caracteres), usar este
                    current_key = displayName_to_preferred_key[display_name]
                    if len(course_key) < len(current_key):
                        displayName_to_preferred_key[display_name] = course_key

            # Segundo pass: atribuir o course_key preferido a cada displayName em mapping_short
            for display_name, course_key in displayName_to_preferred_key.items():
                mapping_short[display_name] = course_key

            # Adicionar aliases para formas expandidas comuns
            aliases = {
                "Engenharia Informática": "Eng. Informática",
                "Engenharia Civil": "Eng. Civil",
                "Engenharia Biomédica": "Eng. Biomédica",
                "Engenharia Mecânica": "Eng. Mecânica",
                "Engenharia Materiais": "Eng. Materiais",
                "Engenharia Gestão Industrial": "Eng. e Gestão Industrial",
                "Eng. e Gestão Industrial": "Eng. e Gestão Industrial",
            }

            for alias, canonical_display in aliases.items():
                # Encontrar o course_key para este displayName canonical
                if canonical_display in displayName_to_preferred_key:
                    course_key = displayName_to_preferred_key[canonical_display]
                    mapping_display[alias] = mapping_display.get(
                        canonical_display, canonical_display
                    )
                    mapping_short[alias] = course_key

            return mapping_display, mapping_short
    except Exception as e:
        print(f"Erro ao carregar config_cursos.json: {e}")
        return {}, {}


def parse_playoff_slots(csv_rows: List[Dict]) -> Tuple[Dict[Tuple[int, str], int], int]:
    """Inferir quantas vagas de playoffs existem por divisão/grupo.

    Baseia-se nas linhas de eliminatórias (jornadas que começam por "E")
    que usam placeholders como "1º Class. 1ª Div. Gr. A".
    Retorna (slots_por_grupo, total_slots).
    """

    slots = defaultdict(int)
    pattern = re.compile(
        r"(\d+)[ºo]?\s*Class\.\s*(\d+)[ªa]?\s*Div\.?(?:\s*Gr\.\s*([A-Za-z0-9]+))?",
        re.IGNORECASE,
    )

    for row in csv_rows:
        jornada_val = str(row.get("Jornada", "")).strip().upper()
        if not jornada_val.startswith("E"):
            continue

        for key in ("Equipa 1", "Equipa 2"):
            name = str(row.get(key, "")).strip()
            if not name:
                continue

            match = pattern.search(name)
            if match:
                div = int(match.group(2))
                grp = (match.group(3) or "").upper()
                slots[(div, grp)] += 1

    total_slots = sum(slots.values())
    return slots, total_slots


# Normalizar nome do curso usando o mapeamento
def normalize_team_name(team_name: str, mapping: Dict[str, str]) -> str:
    """
    Normaliza o nome do curso usando o mapeamento.
    Se não encontrar, retorna o nome original (trimmed).
    """
    normalized = team_name.strip()
    return mapping.get(normalized, normalized)


def get_team_short_name(team_name: str, mapping_short: Dict[str, str]) -> str:
    """
    Retorna o nome curto da equipa para usar em match_id.

    Exemplos:
    - "Eng. e Gestão Industrial" -> "EGI"
    - "EGI" -> "EGI"
    - "Direito" -> "Direito" (se não encontrar mapping)
    """
    normalized = team_name.strip()
    return mapping_short.get(normalized, normalized)


def is_valid_team(team_name: str) -> bool:
    """Verifica se o nome é de uma equipa válida."""
    invalid_keywords = [
        "Class.",
        "Vencedor",
        "Vencido",
        "QF",
        "MF",
        "QF1",
        "QF2",
        "QF3",
        "QF4",
        "PM1",
        "PM2",
        "LM1",
        "LM2",
        "LM3",
    ]
    for keyword in invalid_keywords:
        if keyword in team_name:
            return False
    return True


def is_b_team(name: str) -> bool:
    """Verifica se uma equipa é equipa B."""
    return name.strip().endswith(" B") or name.strip().endswith("B")


def base_team(name: str) -> str:
    """Retorna o nome base da equipa (sem o B)."""
    return name[:-2].strip() if is_b_team(name) else name


def calculate_real_points(
    past_matches_rows: List[Dict],
    course_mapping: Dict[str, str],
) -> Dict[str, int]:
    """
    Calcula os pontos reais já alcançados pelas equipas na época regular.

    Retorna dicionário: {team_name: real_points}
    """
    real_points = defaultdict(int)

    for row in past_matches_rows:
        team_a_raw = row["Equipa 1"].strip()
        team_b_raw = row["Equipa 2"].strip()

        if not is_valid_team(team_a_raw) or not is_valid_team(team_b_raw):
            continue

        team_a = normalize_team_name(team_a_raw, course_mapping)
        team_b = normalize_team_name(team_b_raw, course_mapping)

        golos_1_str = row.get("Golos 1", "").strip()
        golos_2_str = row.get("Golos 2", "").strip()

        if not golos_1_str or not golos_2_str:
            continue

        try:
            # Converter para float primeiro (CSV pode ter "4.0"), depois int
            golos_1 = int(float(golos_1_str))
            golos_2 = int(float(golos_2_str))
        except ValueError:
            continue

        # Distribuir pontos
        if golos_1 > golos_2:
            real_points[team_a] += 3
        elif golos_2 > golos_1:
            real_points[team_b] += 3
        else:
            # Empate
            real_points[team_a] += 1
            real_points[team_b] += 1

    return dict(real_points)


def separate_past_and_future_matches(
    csv_rows: List[Dict],
) -> Tuple[List[Dict], List[Dict]]:
    """
    Separa jogos passados (com resultados) de jogos futuros (sem resultados).

    Retorna (past_matches, future_matches)
    """
    past_matches = []
    future_matches = []

    for row in csv_rows:
        golos_1 = row.get("Golos 1", "").strip()
        golos_2 = row.get("Golos 2", "").strip()

        # Se ambos os scores estão preenchidos, é um jogo passado
        if golos_1 and golos_2:
            past_matches.append(row)
        else:
            future_matches.append(row)

    return past_matches, future_matches


def simulate_match(
    team_a: Team,
    team_b: Team,
    elo_system: CompleteTacauaEloSystem,
    score_simulator: SportScoreSimulator,
    total_group_games: int = 10,
    is_playoff: bool = False,
    division: Optional[int] = None,
) -> Tuple[str, int, int, int]:
    """
    Simula um jogo com sistema ELO completo.

    Args:
        team_a, team_b: Equipas
        elo_system: Sistema ELO
        score_simulator: Simulador de resultados
        total_group_games: Total de jogos para cálculo de K_factor
        is_playoff: Se True, força vencedor (sem empates em desportos que suportam prolongamento)

    Retorna (vencedor, margem, score_a, score_b)
    Atualiza ELOs das equipas.
    """

    # Simular resultado
    score1, score2 = score_simulator.simulate_score(
        team_a.elo,
        team_b.elo,
        force_winner=is_playoff,  # Força vencedor em playoffs
        division=division,
    )
    margin = abs(score1 - score2)

    # Determinar vencedor real
    if score1 > score2:
        winner_name = team_a.name
    elif score2 > score1:
        winner_name = team_b.name
    else:
        winner_name = "Draw"

    # Calcular mudança com sistema completo
    delta_a, delta_b = elo_system.calculate_elo_change(
        team_a.elo,
        team_b.elo,
        score1,
        score2,
        team_a.games_played + 1,
        team_b.games_played + 1,
        total_group_games,
        total_group_games,
    )

    team_a.elo += delta_a
    team_b.elo += delta_b
    team_a.games_played += 1
    team_b.games_played += 1

    return winner_name, margin, score1, score2


def simulate_match_with_hardset(
    team_a: Team,
    team_b: Team,
    elo_system: CompleteTacauaEloSystem,
    score_simulator: SportScoreSimulator,
    total_group_games: int = 10,
    is_playoff: bool = False,
    hardset_manager: Optional[HardsetManager] = None,
    match_id: Optional[str] = None,
    division: Optional[int] = None,
) -> Tuple[str, int, int, int]:
    """
    Simula um jogo COM suporte para resultados fixados.

    Se o jogo tiver resultado fixado no hardset_manager:
    - Usa o resultado fixado em vez de simular
    - Atualiza ELOs baseado no resultado fixado
    - Retorna vencedor, margem e placares do resultado fixado

    Caso contrário, comportamento normal.
    """

    # Verificar se há resultado fixado
    if hardset_manager and match_id and hardset_manager.has_fixed_result(match_id):
        fixed = hardset_manager.get_fixed_result(match_id)
        score1, score2 = fixed.score_a, fixed.score_b
        margin = abs(score1 - score2)

        # Determinar vencedor do resultado fixado
        if score1 > score2:
            winner_name = team_a.name
        elif score2 > score1:
            winner_name = team_b.name
        else:
            winner_name = "Draw"
    else:
        # Comportamento normal: simular resultado
        score1, score2 = score_simulator.simulate_score(
            team_a.elo,
            team_b.elo,
            force_winner=is_playoff,
            division=division,
        )
        margin = abs(score1 - score2)

        if score1 > score2:
            winner_name = team_a.name
        elif score2 > score1:
            winner_name = team_b.name
        else:
            winner_name = "Draw"

    # Calcular mudança de ELO (igual para ambos os casos)
    delta_a, delta_b = elo_system.calculate_elo_change(
        team_a.elo,
        team_b.elo,
        score1,
        score2,
        team_a.games_played + 1,
        team_b.games_played + 1,
        total_group_games,
        total_group_games,
    )

    team_a.elo += delta_a
    team_b.elo += delta_b
    team_a.games_played += 1
    team_b.games_played += 1

    return winner_name, margin, score1, score2


def simulate_season(
    teams: Dict[str, Team],
    fixtures: List[Dict],
    elo_system: CompleteTacauaEloSystem,
    score_simulator: SportScoreSimulator,
) -> Tuple[Dict[str, int], Dict[str, float], Dict[str, float], Dict[str, str]]:
    """Simula uma época completa com sistema ELO completo.
    Retorna (points, expected_points, final_elos, season_results).

    """
    points = defaultdict(int)
    expected_points = defaultdict(float)
    season_results = {}

    # Calcular total de jogos por equipa (apenas para cálculo de K_factor)
    total_games = {}
    for team_name in teams:
        count = sum(1 for match in fixtures if team_name in (match["a"], match["b"]))
        total_games[team_name] = count if count > 0 else 1

    for match in fixtures:
        a = match["a"]
        b = match["b"]
        match_id = match.get("id")
        division = None
        div_raw = str(match.get("divisao", "")).strip()
        if div_raw:
            try:
                division = int(div_raw)
            except ValueError:
                division = None

        # Guardar ELOs ANTES do jogo
        elo_a_before = teams[a].elo
        elo_b_before = teams[b].elo

        # Calcular expected points considerando probabilidade de empate por divisao
        p_a = elo_system.elo_win_probability(teams[a].elo, teams[b].elo)
        p_b = 1 - p_a
        p_draw = score_simulator._get_division_draw_rate(division)
        p_a = p_a * (1 - p_draw)
        p_b = p_b * (1 - p_draw)

        # Expected points: vitória=3, empate=1, derrota=0
        expected_points[a] += p_a * 3 + p_draw * 1
        expected_points[b] += p_b * 3 + p_draw * 1

        # Simular o jogo
        winner, margin, score_a, score_b = simulate_match(
            teams[a],
            teams[b],
            elo_system,
            score_simulator,
            total_games[a],
            division=division,
        )

        if match_id:
            season_results[match_id] = {
                "winner": winner,
                "margin": margin,
                "score_a": score_a,
                "score_b": score_b,
                "elo_a_before": elo_a_before,
                "elo_b_before": elo_b_before,
                "elo_a_after": teams[a].elo,
                "elo_b_after": teams[b].elo,
            }

        if winner == a:
            points[a] += 3
        elif winner == b:
            points[b] += 3
        # Em caso de 'Draw' (se implementado pontos por empate), adicionar lógica aqui
        # Por enquanto mantemos 3 pts vitória / 0 pts derrota/empate para simplificação
        # ou ajustar se o sistema de pontos tiver empates (ex: 1 ponto)
        elif winner == "Draw":
            points[a] += 1
            points[b] += 1

    # Guardar ELOs finais após a época regular
    final_elos = {team: teams[team].elo for team in teams}

    return points, dict(expected_points), final_elos, season_results


def simulate_season_with_hardset(
    teams: Dict[str, Team],
    fixtures: List[Dict],
    elo_system: CompleteTacauaEloSystem,
    score_simulator: SportScoreSimulator,
    hardset_manager: Optional[HardsetManager] = None,
) -> Tuple[Dict[str, int], Dict[str, float], Dict[str, float], Dict[str, str]]:
    """
    Simula época COM suporte para resultados fixados.

    IMPORTANTE: expected_points é calculado APÓS a simulação usando os resultados reais,
    não probabilidades pré-jogo. Isso garante que hardsets afetam visualmente os expected_points.
    """
    points = defaultdict(int)
    expected_points = defaultdict(float)
    season_results = {}

    total_games = {}
    for team_name in teams:
        count = sum(1 for match in fixtures if team_name in (match["a"], match["b"]))
        total_games[team_name] = count if count > 0 else 1

    for match in fixtures:
        a = match["a"]
        b = match["b"]
        match_id = match.get("id")
        division = None
        div_raw = str(match.get("divisao", "")).strip()
        if div_raw:
            try:
                division = int(div_raw)
            except ValueError:
                division = None

        elo_a_before = teams[a].elo
        elo_b_before = teams[b].elo

        # Simular jogo COM hardset PRIMEIRO
        winner, margin, score_a, score_b = simulate_match_with_hardset(
            teams[a],
            teams[b],
            elo_system,
            score_simulator,
            total_games[a],
            hardset_manager=hardset_manager,
            match_id=match_id,
            division=division,
        )

        if match_id:
            season_results[match_id] = {
                "winner": winner,
                "margin": margin,
                "score_a": score_a,
                "score_b": score_b,
                "elo_a_before": elo_a_before,
                "elo_b_before": elo_b_before,
                "elo_a_after": teams[a].elo,
                "elo_b_after": teams[b].elo,
            }

        # Depois CALCULAR expected_points baseado no resultado real
        if winner == a:
            points[a] += 3
            # Expected points é 3 (vitória confirmada)
            expected_points[a] += 3
            expected_points[b] += 0
        elif winner == b:
            points[b] += 3
            # Expected points é 3 (vitória confirmada)
            expected_points[b] += 3
            expected_points[a] += 0
        elif winner == "Draw":
            points[a] += 1
            points[b] += 1
            # Expected points é 1 para cada (empate confirmado)
            expected_points[a] += 1
            expected_points[b] += 1

    final_elos = {team: teams[team].elo for team in teams}

    return points, dict(expected_points), final_elos, season_results


def simulate_playoffs(
    teams: Dict[str, Team],
    ranking: List[Tuple[str, int]],
    elo_system: CompleteTacauaEloSystem,
    score_simulator: SportScoreSimulator,
) -> Tuple[str, List[str], List[str]]:
    """
    Simula playoffs com árvore de eliminatória.
    Top 8 entram nos playoffs (quartos, semifinais e final).
    Retorna (campeão, [semifinalistas], [finalistas]).

    IMPORTANTE: Os ELOs dos teams são MODIFICADOS durante os playoffs.
    Para não contaminar as simulações seguintes, este método deve ser chamado
    com uma CÓPIA profunda dos teams (não os teams originais).

    Todos os jogos de playoff usam force_winner=True para garantir vencedor,
    sem depender de sorteio em caso de empate.

    Equipas B não podem ir aos playoffs - se estiverem no top 8, a próxima
    equipa não-B ocupa a posição.
    """
    # Filtrar equipas B do ranking
    eligible_ranking = [(team, pts) for team, pts in ranking if not is_b_team(team)]

    if len(eligible_ranking) < 2:
        champion = eligible_ranking[0][0] if eligible_ranking else None
        return (champion, [], [champion] if champion else [])

    # Helper para simular jogo eliminatório com vencedor garantido
    def resolve_match(team_a_name: str, team_b_name: str) -> str:
        winner, _, _, _ = simulate_match(
            teams[team_a_name],
            teams[team_b_name],
            elo_system,
            score_simulator,
            is_playoff=True,  # CRUCIAL: força vencedor
            division=None,
        )
        return winner

    # Determinar quantas equipas estão disponíveis para playoffs (apenas não-B)
    num_teams_for_playoffs = min(8, len(eligible_ranking))

    if num_teams_for_playoffs < 4:
        # Se menos de 4, fazer semifinal entre 1º e 2º
        finalist_a = eligible_ranking[0][0]
        finalist_b = eligible_ranking[1][0]
        semifinalists = [finalist_a, finalist_b]
    elif num_teams_for_playoffs < 8:
        # Se 4-7 equipas, fazer top 4 tradicional
        semi1_a = eligible_ranking[0][0]
        semi1_b = eligible_ranking[3][0]

        semi2_a = eligible_ranking[1][0]
        semi2_b = eligible_ranking[2][0]

        semifinalists = [semi1_a, semi1_b, semi2_a, semi2_b]

        winner_sf1 = resolve_match(semi1_a, semi1_b)
        winner_sf2 = resolve_match(semi2_a, semi2_b)

        finalist_a = winner_sf1
        finalist_b = winner_sf2
    else:
        # 8 equipas: quartos (1v8, 2v7, 3v6, 4v5), depois semifinais
        qf1_a = eligible_ranking[0][0]  # 1º
        qf1_b = eligible_ranking[7][0]  # 8º

        qf2_a = eligible_ranking[1][0]  # 2º
        qf2_b = eligible_ranking[6][0]  # 7º

        qf3_a = eligible_ranking[2][0]  # 3º
        qf3_b = eligible_ranking[5][0]  # 6º

        qf4_a = eligible_ranking[3][0]  # 4º
        qf4_b = eligible_ranking[4][0]  # 5º

        # Simulação dos quartos
        winner_qf1 = resolve_match(qf1_a, qf1_b)
        winner_qf2 = resolve_match(qf2_a, qf2_b)
        winner_qf3 = resolve_match(qf3_a, qf3_b)
        winner_qf4 = resolve_match(qf4_a, qf4_b)

        semifinalists = [winner_qf1, winner_qf2, winner_qf3, winner_qf4]

        # Simulação das semifinais
        winner_sf1 = resolve_match(winner_qf1, winner_qf2)
        winner_sf2 = resolve_match(winner_qf3, winner_qf4)

        finalist_a = winner_sf1
        finalist_b = winner_sf2

    # Final
    finalists = [finalist_a, finalist_b]
    champion = resolve_match(finalist_a, finalist_b)
    return (champion, semifinalists, finalists)


def calculate_promotions_relegations(
    points: Dict[str, int],
    team_division: Dict[str, Tuple[int, str]],
    sim_teams: Dict[str, Team],
    has_liguilla: bool,
) -> Tuple[Set[str], Set[str]]:
    if not team_division:
        return set(), set()

    # Construir standings por divisão/grupo
    div_points: Dict[int, Dict[str, List[Tuple[str, int]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for team, pts in points.items():
        div, grp = team_division.get(team, (1, ""))
        div_points[div][grp].append((team, pts))

    # Ordenar standings
    for div in div_points:
        for grp in div_points[div]:
            div_points[div][grp] = sorted(
                div_points[div][grp], key=lambda x: x[1], reverse=True
            )

    # Detectar grupos na 2ª divisão
    div2_groups = div_points.get(2, {})
    num_groups_div2 = len(div2_groups)
    ranking_div1 = []
    for grp_list in div_points.get(1, {}).values():
        ranking_div1.extend(grp_list)
    ranking_div1 = sorted(ranking_div1, key=lambda x: x[1], reverse=True)

    protected_as = set()
    promoted = set()
    relegated = set()

    # Helper para escolher próximo não-B
    def next_non_b(lst):
        return next((t for t in lst if not is_b_team(t)), None)

    if num_groups_div2 == 0:
        pass
    elif num_groups_div2 == 1:
        group_key = next(iter(div2_groups))
        promo = []
        for t, _ in div2_groups[group_key][:]:
            if not is_b_team(t):
                promo.append(t)
            if len(promo) == 2:
                break
        promoted.update(promo)
        # proteção A
        for t in promo:
            if is_b_team(t):
                protected_as.add(base_team(t))
        # relegar 2 últimos não protegidos
        down_list = [t for t, _ in reversed(ranking_div1)]
        for t in down_list:
            if t in protected_as:
                continue
            if len(relegated) < 2:
                relegated.add(t)
        # Se B promove, protege A
    elif num_groups_div2 == 2:
        # Se há liguilha (LM presente) usa regra de 3 equipas: 2 ficam na 1ª, 1 desce
        if has_liguilla:
            down_list = [t for t, _ in reversed(ranking_div1)]
            # Descem diretos os 3 ultimos (4o a contar do fim vai a liguilha)
            for t in down_list:
                if t in protected_as:
                    continue
                if len(relegated) < 3:
                    relegated.add(t)

            grp_keys = list(div2_groups.keys())
            top_a = (
                next_non_b([t for t, _ in div2_groups[grp_keys[0]]])
                if grp_keys
                else None
            )
            top_b = (
                next_non_b([t for t, _ in div2_groups[grp_keys[1]]])
                if len(grp_keys) > 1
                else None
            )

            # Sobem diretos os 1os de cada grupo (2a divisao)
            if top_a:
                promoted.add(top_a)
            if top_b:
                promoted.add(top_b)

            # Liguillha: 2os de cada grupo + 4o a contar do fim da 1a divisao
            second_a = (
                next_non_b([t for t, _ in div2_groups[grp_keys[0]][1:]])
                if grp_keys and len(div2_groups[grp_keys[0]]) > 1
                else None
            )
            second_b = (
                next_non_b([t for t, _ in div2_groups[grp_keys[1]][1:]])
                if len(grp_keys) > 1 and len(div2_groups[grp_keys[1]]) > 1
                else None
            )
            fourth_worst = down_list[3] if len(down_list) >= 4 else None
            candidates = [c for c in [second_a, second_b, fourth_worst] if c]

            if candidates:
                # Escolhe vencedor por ELO (regra de desempate simplificada)
                winner = max(
                    candidates,
                    key=lambda t: sim_teams.get(t, Team(t, 1500)).elo,
                )
                # So ha promocao se o vencedor for da 2a divisao
                if winner != fourth_worst:
                    promoted.add(winner)
                    if fourth_worst:
                        relegated.add(fourth_worst)
                # Se o 4o a contar do fim vencer, mantém-se e nao ha promocao extra
        else:
            # Sem liguilha: sobem 2 por grupo, descem 4
            for grp_list in div2_groups.values():
                promo_grp = []
                for t, _ in grp_list:
                    if not is_b_team(t):
                        promo_grp.append(t)
                    if len(promo_grp) == 2:
                        break
                promoted.update(promo_grp)
            down_list = [t for t, _ in reversed(ranking_div1)]
            for t in down_list:
                if t in protected_as:
                    continue
                if len(relegated) < 4:
                    relegated.add(t)
    elif num_groups_div2 == 3:
        # 3 sobem diretos (1º de cada grupo)
        seconds = []
        for grp_list in div2_groups.values():
            # direct
            for t, _ in grp_list:
                if not is_b_team(t):
                    promoted.add(t)
                    break
            # collect second for playoff
            sec = (
                next_non_b([t for t, _ in grp_list[1:]]) if len(grp_list) > 1 else None
            )
            if sec:
                seconds.append(sec)
        # descem 3 diretos
        down_list = [t for t, _ in reversed(ranking_div1)]
        for t in down_list[:3]:
            if t in protected_as:
                continue
            relegated.add(t)
        # playoff dos segundos com 4º pior da 1ª
        if len(ranking_div1) >= 4:
            fourth_worst = down_list[3]
            candidates = seconds + [fourth_worst]
            # Escolhe melhor por ELO
            winner = max(candidates, key=lambda t: sim_teams.get(t, Team(t, 1500)).elo)
            if winner != fourth_worst:
                relegated.add(fourth_worst)
                promoted.add(winner)

    # Proteção de A se B promove: se equipa B sobe, a equipa A fica protegida
    for t in list(promoted):
        if is_b_team(t):
            a_team = base_team(t)
            protected_as.add(a_team)
    # Remove equipas protegidas da relegação
    relegated = {t for t in relegated if t not in protected_as}

    return promoted, relegated


# ============================================================================
# DETECÇÃO DE THREADS E FUNÇÕES PARALELAS
# ============================================================================


class ProgressTracker:
    """Rastreador simplificado para progresso (tracking no processo principal)."""

    def __init__(self, num_workers: int, n_simulations: int):
        self.num_workers = num_workers
        self.n_simulations = n_simulations
        self.completed = 0
        self.last_percent = 0

    def increment(self):
        """Incrementa o contador (chamado apenas no processo principal)."""
        self.completed += 1
        current_percent = int((self.completed / self.n_simulations) * 100)

        # Mostrar progresso a cada 5% ou na primeira/última simulação
        if (
            current_percent >= self.last_percent + 5
            or self.completed == 1
            or self.completed == self.n_simulations
        ):

            progress_bar = "▓" * (current_percent // 2)
            progress_bar = progress_bar.ljust(50, "░")
            print(
                f"\r  {progress_bar} {self.completed}/{self.n_simulations} ({current_percent}%)",
                end="",
                flush=True,
            )
            self.last_percent = current_percent

    def print_summary(self):
        """Imprime sumário final."""
        print(f"\n\n✓ CONCLUÍDO")
        print(f"  Workers usados: {self.num_workers}")
        print(f"  Simulações: {self.completed}/{self.n_simulations}")


def get_num_workers() -> int:
    """
    Detecta e retorna o número de workers/cores disponíveis.
    Usa cpu_count() para ProcessPoolExecutor (bypass do GIL).
    Fallback seguro para ambientes onde cpu_count() falha.
    """
    num_workers = None

    # Tentar multiprocessing.cpu_count() primeiro
    try:
        num_workers = multiprocessing.cpu_count()
    except (NotImplementedError, AttributeError):
        pass

    # Fallback para os.cpu_count() se necessário
    if num_workers is None:
        try:
            num_workers = os.cpu_count()
        except (NotImplementedError, AttributeError):
            pass

    # Garantir valor válido (mínimo 1 worker)
    if num_workers is None or num_workers < 1:
        num_workers = 1

    return num_workers


# Variável global para rastreamento de progresso (process-safe)
_progress_tracker: Optional[ProgressTracker] = None


def _run_single_simulation_worker(args_tuple):
    """
    Worker para executar uma simulação Monte Carlo.
    Recebe tupla com todos os args necessários e retorna os dados da simulação.
    """
    (
        sim_idx,
        worker_id,
        teams,
        fixtures,
        elo_system,
        score_simulator,
        n_simulations,
        team_division,
        has_liguilla,
        real_points,
        playoff_slots,
        total_playoff_slots,
    ) = args_tuple

    # Não precisamos mais rastrear progresso aqui - é feito no processo principal

    sim_teams = {
        name: Team(name, team.elo, team.games_played) for name, team in teams.items()
    }

    # Simular época regular
    points_future, sim_expected_points, final_elos, season_results = simulate_season(
        sim_teams,
        fixtures,
        elo_system,
        score_simulator,
    )

    points = {
        team: points_future.get(team, 0) + real_points.get(team, 0) for team in teams
    }

    ranking = sorted(points.items(), key=lambda x: x[1], reverse=True)
    playoff_teams = {name: Team(name, final_elos[name]) for name in final_elos}

    # Acumular estatísticas de jogos futuros
    match_stats_sim = defaultdict(lambda: {"1": 0, "X": 0, "2": 0, "total": 0})
    match_elo_stats_sim = defaultdict(lambda: {"team_a_elos": [], "team_b_elos": []})
    match_score_stats_sim = defaultdict(
        lambda: defaultdict(int)
    )  # {match_id: {"3-2": count, ...}}

    for match in fixtures:
        if match.get("is_future") and match.get("id"):
            mid = match["id"]
            res = season_results.get(mid)
            if res:
                winner = res["winner"]
                if winner == match["a"]:
                    match_stats_sim[mid]["1"] += 1
                elif winner == match["b"]:
                    match_stats_sim[mid]["2"] += 1
                else:
                    match_stats_sim[mid]["X"] += 1
                match_stats_sim[mid]["total"] += 1

                match_elo_stats_sim[mid]["team_a_elos"].append(res["elo_a_before"])
                match_elo_stats_sim[mid]["team_b_elos"].append(res["elo_b_before"])

                # Adicionar distribuição de placares
                score_key = f"{res['score_a']}-{res['score_b']}"
                match_score_stats_sim[mid][score_key] += 1

    # Armazenar expected points, posição na regular e ELO final
    expected_points_sim = {}
    final_elos_sim = {}
    regular_season_places_sim = {}

    for team in teams:
        real_pts = real_points.get(team, 0)
        future_xpts = sim_expected_points.get(team, 0.0)
        total_xpts = real_pts + future_xpts
        expected_points_sim[team] = total_xpts
        final_elos_sim[team] = final_elos.get(team, teams[team].elo)

    for place, (team, _) in enumerate(ranking, 1):
        regular_season_places_sim[team] = place

    # Contar playoffs
    playoff_count_sim = {}
    if playoff_slots:
        standings_by_group = defaultdict(list)
        for team, pts in ranking:
            div, grp = team_division.get(team, (1, "")) if team_division else (1, "")
            standings_by_group[(div, grp)].append((team, pts))

        for group_key, slots in playoff_slots.items():
            placed = 0
            for team, _ in standings_by_group.get(group_key, []):
                if is_b_team(team):
                    continue
                playoff_count_sim[team] = 1
                placed += 1
                if placed >= slots:
                    break
    else:
        playoff_qualifiers = 0
        for team, _ in ranking:
            if playoff_qualifiers >= total_playoff_slots:
                break
            if not is_b_team(team):
                playoff_count_sim[team] = 1
                playoff_qualifiers += 1

    # Simular playoffs
    champion, semifinalists, finalists = simulate_playoffs(
        playoff_teams, ranking, elo_system, score_simulator
    )

    semifinal_count_sim = {t: 1 for t in semifinalists}
    final_count_sim = {t: 1 for t in finalists}
    champion_count_sim = {champion: 1} if champion else {}

    # Calcular promoções/descidas
    promotion_count_sim = {}
    relegation_count_sim = {}
    if team_division:
        promoted, relegated = calculate_promotions_relegations(
            points, team_division, sim_teams, has_liguilla
        )
        for t in promoted:
            promotion_count_sim[t] = 1
        for t in relegated:
            relegation_count_sim[t] = 1

    return {
        "expected_points": expected_points_sim,
        "final_elos": final_elos_sim,
        "regular_season_places": regular_season_places_sim,
        "playoff_count": playoff_count_sim,
        "semifinal_count": semifinal_count_sim,
        "final_count": final_count_sim,
        "champion_count": champion_count_sim,
        "promotion_count": promotion_count_sim,
        "relegation_count": relegation_count_sim,
        "match_stats": dict(match_stats_sim),
        "match_elo_stats": {
            k: {
                "team_a_elos": list(v["team_a_elos"]),
                "team_b_elos": list(v["team_b_elos"]),
            }
            for k, v in match_elo_stats_sim.items()
        },
        "match_score_stats": {k: dict(v) for k, v in match_score_stats_sim.items()},
    }


def _run_single_simulation_with_hardset_worker(args_tuple):
    """
    Worker para executar uma simulação Monte Carlo com hardset.
    Recebe tupla com todos os args necessários e retorna os dados da simulação.
    """
    (
        sim_idx,
        worker_id,
        teams,
        fixtures,
        elo_system,
        score_simulator,
        n_simulations,
        team_division,
        has_liguilla,
        real_points,
        playoff_slots,
        total_playoff_slots,
        hardset_manager,
    ) = args_tuple

    # Não precisamos mais rastrear progresso aqui - é feito no processo principal

    sim_teams = {
        name: Team(name, team.elo, team.games_played) for name, team in teams.items()
    }

    # Simular época regular COM hardset
    points_future, sim_expected_points, final_elos, season_results = (
        simulate_season_with_hardset(
            sim_teams,
            fixtures,
            elo_system,
            score_simulator,
            hardset_manager=hardset_manager,
        )
    )

    points = {
        team: points_future.get(team, 0) + real_points.get(team, 0) for team in teams
    }

    ranking = sorted(points.items(), key=lambda x: x[1], reverse=True)
    playoff_teams = {name: Team(name, final_elos[name]) for name in final_elos}

    # Acumular estatísticas de jogos futuros
    match_stats_sim = defaultdict(lambda: {"1": 0, "X": 0, "2": 0, "total": 0})
    match_elo_stats_sim = defaultdict(lambda: {"team_a_elos": [], "team_b_elos": []})
    match_score_stats_sim = defaultdict(
        lambda: defaultdict(int)
    )  # {match_id: {"3-2": count, ...}}

    for match in fixtures:
        if match.get("is_future") and match.get("id"):
            mid = match["id"]
            res = season_results.get(mid)
            if res:
                winner = res["winner"]
                if winner == match["a"]:
                    match_stats_sim[mid]["1"] += 1
                elif winner == match["b"]:
                    match_stats_sim[mid]["2"] += 1
                else:
                    match_stats_sim[mid]["X"] += 1
                match_stats_sim[mid]["total"] += 1

                match_elo_stats_sim[mid]["team_a_elos"].append(res["elo_a_before"])
                match_elo_stats_sim[mid]["team_b_elos"].append(res["elo_b_before"])

                # Adicionar distribuição de placares
                score_key = f"{res['score_a']}-{res['score_b']}"
                match_score_stats_sim[mid][score_key] += 1

    # Armazenar expected points, posição na regular e ELO final
    expected_points_sim = {}
    final_elos_sim = {}
    regular_season_places_sim = {}

    for team in teams:
        real_pts = real_points.get(team, 0)
        future_xpts = sim_expected_points.get(team, 0.0)
        total_xpts = real_pts + future_xpts
        expected_points_sim[team] = total_xpts
        final_elos_sim[team] = final_elos.get(team, teams[team].elo)

    for place, (team, _) in enumerate(ranking, 1):
        regular_season_places_sim[team] = place

    # Contar playoffs
    playoff_count_sim = {}
    if playoff_slots:
        standings_by_group = defaultdict(list)
        for team, pts in ranking:
            div, grp = team_division.get(team, (1, "")) if team_division else (1, "")
            standings_by_group[(div, grp)].append((team, pts))

        for group_key, slots in playoff_slots.items():
            placed = 0
            for team, _ in standings_by_group.get(group_key, []):
                if is_b_team(team):
                    continue
                playoff_count_sim[team] = 1
                placed += 1
                if placed >= slots:
                    break
    else:
        playoff_qualifiers = 0
        for team, _ in ranking:
            if playoff_qualifiers >= total_playoff_slots:
                break
            if not is_b_team(team):
                playoff_count_sim[team] = 1
                playoff_qualifiers += 1

    # Simular playoffs
    champion, semifinalists, finalists = simulate_playoffs(
        playoff_teams, ranking, elo_system, score_simulator
    )

    semifinal_count_sim = {t: 1 for t in semifinalists}
    final_count_sim = {t: 1 for t in finalists}
    champion_count_sim = {champion: 1} if champion else {}

    # Calcular promoções/descidas
    promotion_count_sim = {}
    relegation_count_sim = {}
    if team_division:
        promoted, relegated = calculate_promotions_relegations(
            points, team_division, sim_teams, has_liguilla
        )
        for t in promoted:
            promotion_count_sim[t] = 1
        for t in relegated:
            relegation_count_sim[t] = 1

    return {
        "expected_points": expected_points_sim,
        "final_elos": final_elos_sim,
        "regular_season_places": regular_season_places_sim,
        "playoff_count": playoff_count_sim,
        "semifinal_count": semifinal_count_sim,
        "final_count": final_count_sim,
        "champion_count": champion_count_sim,
        "promotion_count": promotion_count_sim,
        "relegation_count": relegation_count_sim,
        "match_stats": dict(match_stats_sim),
        "match_elo_stats": {
            k: {
                "team_a_elos": list(v["team_a_elos"]),
                "team_b_elos": list(v["team_b_elos"]),
            }
            for k, v in match_elo_stats_sim.items()
        },
        "match_score_stats": {k: dict(v) for k, v in match_score_stats_sim.items()},
    }


def monte_carlo_forecast(
    teams: Dict[str, Team],
    fixtures: List[Dict],
    elo_system: CompleteTacauaEloSystem,
    score_simulator: SportScoreSimulator,
    n_simulations: int = 10000,
    team_division: Dict[str, Tuple[int, str]] = None,
    has_liguilla: bool = False,
    real_points: Dict[str, int] = None,
    playoff_slots: Dict[Tuple[int, str], int] = None,
    total_playoff_slots: int = 8,
) -> Tuple[
    Dict[str, Dict[str, float]],
    Dict[str, Dict[str, float]],
    Dict[str, Dict[str, float]],
]:
    """OTIMIZADO PARA LINUX - Batching + Chunking + Agregação Eficiente"""
    if real_points is None:
        real_points = {}

    playoff_count = defaultdict(int)
    semifinal_count = defaultdict(int)
    final_count = defaultdict(int)
    champion_count = defaultdict(int)
    promotion_count = defaultdict(int)
    relegation_count = defaultdict(int)

    # Agregação eficiente: somas em vez de listas
    expected_points_sum = defaultdict(float)
    expected_points_sq_sum = defaultdict(float)
    regular_places_sum = defaultdict(float)
    regular_places_sq_sum = defaultdict(float)
    final_elos_sum = defaultdict(float)
    final_elos_sq_sum = defaultdict(float)

    match_stats = defaultdict(lambda: {"1": 0, "X": 0, "2": 0, "total": 0})
    match_elo_sum = defaultdict(
        lambda: {"a_sum": 0.0, "a_sq": 0.0, "b_sum": 0.0, "b_sq": 0.0, "count": 0}
    )
    match_score_stats = defaultdict(lambda: defaultdict(int))

    num_workers = get_num_workers()
    print(f"\n✓ Detectados {num_workers} cores disponíveis")

    # Batching adaptativo
    if n_simulations >= 1000000:
        batch_size = 50000
        chunksize = 500
    elif n_simulations >= 100000:
        batch_size = 10000
        chunksize = 100
    else:
        batch_size = n_simulations
        chunksize = max(1, n_simulations // (num_workers * 4))

    num_batches = (n_simulations + batch_size - 1) // batch_size
    print(
        f"✓ {n_simulations} simulações em {num_batches} batch(es) | Chunksize: {chunksize}\n"
    )

    global _progress_tracker
    _progress_tracker = ProgressTracker(num_workers, n_simulations)

    for batch_num in range(num_batches):
        batch_start = batch_num * batch_size
        batch_end = min(batch_start + batch_size, n_simulations)

        simulation_args = []
        for sim_idx in range(batch_start, batch_end):
            worker_id = sim_idx % num_workers
            args_tuple = (
                sim_idx,
                worker_id,
                teams,
                fixtures,
                elo_system,
                score_simulator,
                n_simulations,
                team_division,
                has_liguilla,
                real_points,
                playoff_slots,
                total_playoff_slots,
            )
            simulation_args.append(args_tuple)

        with ProcessPoolExecutor(max_workers=num_workers) as executor:
            for sim_result in executor.map(
                _run_single_simulation_worker, simulation_args, chunksize=chunksize
            ):
                _progress_tracker.increment()

                for team in teams:
                    if team in sim_result["expected_points"]:
                        val = sim_result["expected_points"][team]
                        expected_points_sum[team] += val
                        expected_points_sq_sum[team] += val * val

                        elo_val = sim_result["final_elos"][team]
                        final_elos_sum[team] += elo_val
                        final_elos_sq_sum[team] += elo_val * elo_val

                        place_val = sim_result["regular_season_places"][team]
                        regular_places_sum[team] += place_val
                        regular_places_sq_sum[team] += place_val * place_val

                for team, count in sim_result["playoff_count"].items():
                    playoff_count[team] += count
                for team, count in sim_result["semifinal_count"].items():
                    semifinal_count[team] += count
                for team, count in sim_result["final_count"].items():
                    final_count[team] += count
                for team, count in sim_result["champion_count"].items():
                    champion_count[team] += count
                for team, count in sim_result["promotion_count"].items():
                    promotion_count[team] += count
                for team, count in sim_result["relegation_count"].items():
                    relegation_count[team] += count

                for mid, stats in sim_result["match_stats"].items():
                    for key in ["1", "X", "2", "total"]:
                        match_stats[mid][key] += stats[key]

                for mid, elo_data in sim_result["match_elo_stats"].items():
                    for elo_a in elo_data["team_a_elos"]:
                        match_elo_sum[mid]["a_sum"] += elo_a
                        match_elo_sum[mid]["a_sq"] += elo_a * elo_a
                        match_elo_sum[mid]["count"] += 1
                    for elo_b in elo_data["team_b_elos"]:
                        match_elo_sum[mid]["b_sum"] += elo_b
                        match_elo_sum[mid]["b_sq"] += elo_b * elo_b

                for mid, score_data in sim_result["match_score_stats"].items():
                    for score_key, count in score_data.items():
                        match_score_stats[mid][score_key] += count

        import gc

        gc.collect()

    results = {}
    for team in teams:
        n = n_simulations

        mean_xpts = (
            expected_points_sum[team] / n if team in expected_points_sum else 0.0
        )
        variance_xpts = (
            (expected_points_sq_sum[team] / n - mean_xpts**2)
            if team in expected_points_sq_sum
            else 0.0
        )
        std_xpts = variance_xpts**0.5 if variance_xpts > 0 else 0.0

        mean_place = (
            regular_places_sum[team] / n if team in regular_places_sum else len(teams)
        )
        variance_place = (
            (regular_places_sq_sum[team] / n - mean_place**2)
            if team in regular_places_sq_sum
            else 0.0
        )
        std_place = variance_place**0.5 if variance_place > 0 else 0.0

        mean_elo = (
            final_elos_sum[team] / n if team in final_elos_sum else teams[team].elo
        )
        variance_elo = (
            (final_elos_sq_sum[team] / n - mean_elo**2)
            if team in final_elos_sq_sum
            else 0.0
        )
        std_elo = variance_elo**0.5 if variance_elo > 0 else 0.0

        results[team] = {
            "p_playoffs": playoff_count[team] / n_simulations,
            "p_meias_finais": semifinal_count[team] / n_simulations,
            "p_finais": final_count[team] / n_simulations,
            "p_champion": champion_count[team] / n_simulations,
            "expected_points": mean_xpts,
            "expected_points_std": std_xpts,
            "expected_place": mean_place,
            "expected_place_std": std_place,
            "avg_final_elo": mean_elo,
            "avg_final_elo_std": std_elo,
            "p_promocao": promotion_count[team] / n_simulations,
            "p_descida": relegation_count[team] / n_simulations,
        }

    match_forecasts = {}
    for mid, stats in match_stats.items():
        total = stats["total"]
        if total > 0:
            match_forecasts[mid] = {
                "p_win_a": stats["1"] / total,
                "p_draw": stats["X"] / total,
                "p_win_b": stats["2"] / total,
            }

    match_elo_forecast = {}
    for mid, elo_sums in match_elo_sum.items():
        count = elo_sums["count"]
        if count > 0:
            mean_a = elo_sums["a_sum"] / count
            variance_a = elo_sums["a_sq"] / count - mean_a**2
            std_a = variance_a**0.5 if variance_a > 0 else 0.0

            mean_b = elo_sums["b_sum"] / count
            variance_b = elo_sums["b_sq"] / count - mean_b**2
            std_b = variance_b**0.5 if variance_b > 0 else 0.0

            match_elo_forecast[mid] = {
                "elo_a_mean": mean_a,
                "elo_a_std": std_a,
                "elo_b_mean": mean_b,
                "elo_b_std": std_b,
            }

    if _progress_tracker:
        _progress_tracker.print_summary()

    return results, match_forecasts, match_elo_forecast, match_score_stats


def monte_carlo_forecast_with_hardset(
    teams: Dict[str, Team],
    fixtures: List[Dict],
    elo_system: CompleteTacauaEloSystem,
    score_simulator: SportScoreSimulator,
    n_simulations: int = 10000,
    team_division: Dict[str, Tuple[int, str]] = None,
    has_liguilla: bool = False,
    real_points: Dict[str, int] = None,
    playoff_slots: Dict[Tuple[int, str], int] = None,
    total_playoff_slots: int = 8,
    hardset_manager: Optional[HardsetManager] = None,
) -> Tuple[
    Dict[str, Dict[str, float]],
    Dict[str, Dict[str, float]],
    Dict[str, Dict[str, float]],
]:
    """OTIMIZADO PARA LINUX - Batching + Chunking + Agregação Eficiente (COM HARDSET)"""
    if real_points is None:
        real_points = {}

    # Mostrar resumo de hardsets se existirem
    if hardset_manager and hardset_manager.fixed_results:
        print(f"\n{'='*60}")
        print(hardset_manager.summary())
        print(f"{'='*60}\n")

    playoff_count = defaultdict(int)
    semifinal_count = defaultdict(int)
    final_count = defaultdict(int)
    champion_count = defaultdict(int)
    promotion_count = defaultdict(int)
    relegation_count = defaultdict(int)

    # Agregação eficiente: somas em vez de listas
    expected_points_sum = defaultdict(float)
    expected_points_sq_sum = defaultdict(float)
    regular_places_sum = defaultdict(float)
    regular_places_sq_sum = defaultdict(float)
    final_elos_sum = defaultdict(float)
    final_elos_sq_sum = defaultdict(float)

    match_stats = defaultdict(lambda: {"1": 0, "X": 0, "2": 0, "total": 0})
    match_elo_sum = defaultdict(
        lambda: {"a_sum": 0.0, "a_sq": 0.0, "b_sum": 0.0, "b_sq": 0.0, "count": 0}
    )
    match_score_stats = defaultdict(lambda: defaultdict(int))

    num_workers = get_num_workers()
    print(f"\n✓ Detectados {num_workers} cores disponíveis")

    # Batching adaptativo
    if n_simulations >= 1000000:
        batch_size = 50000
        chunksize = 500
    elif n_simulations >= 100000:
        batch_size = 10000
        chunksize = 100
    else:
        batch_size = n_simulations
        chunksize = max(1, n_simulations // (num_workers * 4))

    num_batches = (n_simulations + batch_size - 1) // batch_size
    print(
        f"✓ {n_simulations} simulações em {num_batches} batch(es) | Chunksize: {chunksize}\n"
    )

    global _progress_tracker
    _progress_tracker = ProgressTracker(num_workers, n_simulations)

    for batch_num in range(num_batches):
        batch_start = batch_num * batch_size
        batch_end = min(batch_start + batch_size, n_simulations)

        simulation_args = []
        for sim_idx in range(batch_start, batch_end):
            worker_id = sim_idx % num_workers
            args_tuple = (
                sim_idx,
                worker_id,
                teams,
                fixtures,
                elo_system,
                score_simulator,
                n_simulations,
                team_division,
                has_liguilla,
                real_points,
                playoff_slots,
                total_playoff_slots,
                hardset_manager,
            )
            simulation_args.append(args_tuple)

        with ProcessPoolExecutor(max_workers=num_workers) as executor:
            for sim_result in executor.map(
                _run_single_simulation_with_hardset_worker,
                simulation_args,
                chunksize=chunksize,
            ):
                _progress_tracker.increment()

                for team in teams:
                    if team in sim_result["expected_points"]:
                        val = sim_result["expected_points"][team]
                        expected_points_sum[team] += val
                        expected_points_sq_sum[team] += val * val

                        elo_val = sim_result["final_elos"][team]
                        final_elos_sum[team] += elo_val
                        final_elos_sq_sum[team] += elo_val * elo_val

                        place_val = sim_result["regular_season_places"][team]
                        regular_places_sum[team] += place_val
                        regular_places_sq_sum[team] += place_val * place_val

                for team, count in sim_result["playoff_count"].items():
                    playoff_count[team] += count
                for team, count in sim_result["semifinal_count"].items():
                    semifinal_count[team] += count
                for team, count in sim_result["final_count"].items():
                    final_count[team] += count
                for team, count in sim_result["champion_count"].items():
                    champion_count[team] += count
                for team, count in sim_result["promotion_count"].items():
                    promotion_count[team] += count
                for team, count in sim_result["relegation_count"].items():
                    relegation_count[team] += count

                for mid, stats in sim_result["match_stats"].items():
                    for key in ["1", "X", "2", "total"]:
                        match_stats[mid][key] += stats[key]

                for mid, elo_data in sim_result["match_elo_stats"].items():
                    for elo_a in elo_data["team_a_elos"]:
                        match_elo_sum[mid]["a_sum"] += elo_a
                        match_elo_sum[mid]["a_sq"] += elo_a * elo_a
                        match_elo_sum[mid]["count"] += 1
                    for elo_b in elo_data["team_b_elos"]:
                        match_elo_sum[mid]["b_sum"] += elo_b
                        match_elo_sum[mid]["b_sq"] += elo_b * elo_b

                for mid, score_data in sim_result["match_score_stats"].items():
                    for score_key, count in score_data.items():
                        match_score_stats[mid][score_key] += count

        import gc

        gc.collect()

    results = {}
    for team in teams:
        n = n_simulations

        mean_xpts = (
            expected_points_sum[team] / n if team in expected_points_sum else 0.0
        )
        variance_xpts = (
            (expected_points_sq_sum[team] / n - mean_xpts**2)
            if team in expected_points_sq_sum
            else 0.0
        )
        std_xpts = variance_xpts**0.5 if variance_xpts > 0 else 0.0

        mean_place = (
            regular_places_sum[team] / n if team in regular_places_sum else len(teams)
        )
        variance_place = (
            (regular_places_sq_sum[team] / n - mean_place**2)
            if team in regular_places_sq_sum
            else 0.0
        )
        std_place = variance_place**0.5 if variance_place > 0 else 0.0

        mean_elo = (
            final_elos_sum[team] / n if team in final_elos_sum else teams[team].elo
        )
        variance_elo = (
            (final_elos_sq_sum[team] / n - mean_elo**2)
            if team in final_elos_sq_sum
            else 0.0
        )
        std_elo = variance_elo**0.5 if variance_elo > 0 else 0.0

        results[team] = {
            "p_playoffs": playoff_count[team] / n_simulations,
            "p_meias_finais": semifinal_count[team] / n_simulations,
            "p_finais": final_count[team] / n_simulations,
            "p_champion": champion_count[team] / n_simulations,
            "expected_points": mean_xpts,
            "expected_points_std": std_xpts,
            "expected_place": mean_place,
            "expected_place_std": std_place,
            "avg_final_elo": mean_elo,
            "avg_final_elo_std": std_elo,
            "p_promocao": promotion_count[team] / n_simulations,
            "p_descida": relegation_count[team] / n_simulations,
        }

    match_forecasts = {}
    for mid, stats in match_stats.items():
        total = stats["total"]
        if total > 0:
            match_forecasts[mid] = {
                "p_win_a": stats["1"] / total,
                "p_draw": stats["X"] / total,
                "p_win_b": stats["2"] / total,
            }

    match_elo_forecast = {}
    for mid, elo_sums in match_elo_sum.items():
        count = elo_sums["count"]
        if count > 0:
            mean_a = elo_sums["a_sum"] / count
            variance_a = elo_sums["a_sq"] / count - mean_a**2
            std_a = variance_a**0.5 if variance_a > 0 else 0.0

            mean_b = elo_sums["b_sum"] / count
            variance_b = elo_sums["b_sq"] / count - mean_b**2
            std_b = variance_b**0.5 if variance_b > 0 else 0.0

            match_elo_forecast[mid] = {
                "elo_a_mean": mean_a,
                "elo_a_std": std_a,
                "elo_b_mean": mean_b,
                "elo_b_std": std_b,
            }

    if _progress_tracker:
        _progress_tracker.print_summary()

    return results, match_forecasts, match_elo_forecast, match_score_stats


# ============================================================================
# VALIDAÇÃO E BACKTEST - Avaliar precisão das previsões
# ============================================================================


def calculate_historical_draw_rate(
    modalidade: str, past_seasons: List[str], docs_dir: str = None
) -> float:
    """
    Analisa épocas anteriores para calcular taxa real de empates.

    Args:
        modalidade: Nome da modalidade (ex: "FUTSAL MASCULINO")
        past_seasons: Lista de padrões de época (ex: ["23_24", "22_23"])
        docs_dir: Caminho para o diretório docs. Se None, usa caminho relativo.

    Retorna taxa de empates (0.0 a 1.0)
    """
    total_games = 0
    total_draws = 0

    for season_pattern in past_seasons:
        if docs_dir:
            csv_file = os.path.join(
                docs_dir,
                "output",
                "csv_modalidades",
                f"{modalidade}_{season_pattern}.csv",
            )
        else:
            csv_file = (
                f"../docs/output/csv_modalidades/{modalidade}_{season_pattern}.csv"
            )
        if not os.path.exists(csv_file):
            continue

        try:
            with open(csv_file, newline="", encoding="utf-8-sig") as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    golos_1_str = row.get("Golos 1", "").strip()
                    golos_2_str = row.get("Golos 2", "").strip()

                    if not golos_1_str or not golos_2_str:
                        continue

                    try:
                        golos_1 = int(float(golos_1_str))
                        golos_2 = int(float(golos_2_str))
                        total_games += 1
                        if golos_1 == golos_2:
                            total_draws += 1
                    except ValueError:
                        continue
        except FileNotFoundError:
            continue

    if total_games == 0:
        return 0.0

    return total_draws / total_games


def calculate_division_baselines(
    modalidade: str,
    past_seasons: List[str],
    current_rows: List[Dict],
    docs_dir: str = None,
) -> Dict[Optional[int], Dict[str, float]]:
    """
    Calcula médias e desvios padrão de golos/pontos por divisão.

    Retorna dict: {divisao: {"mean": x, "std": y}, None: {"mean": x, "std": y}}
    """
    score_data: Dict[Optional[int], List[int]] = defaultdict(list)

    def add_row(row: Dict) -> None:
        golos_1_str = row.get("Golos 1", "").strip()
        golos_2_str = row.get("Golos 2", "").strip()
        if not golos_1_str or not golos_2_str:
            return

        try:
            score_1 = int(float(golos_1_str))
            score_2 = int(float(golos_2_str))
        except ValueError:
            return

        div_raw = str(row.get("Divisão", "")).strip()
        div_key = None
        if div_raw:
            try:
                div_key = int(div_raw)
            except ValueError:
                div_key = None

        score_data[div_key].extend([score_1, score_2])
        score_data[None].extend([score_1, score_2])

    for season_pattern in past_seasons:
        if docs_dir:
            csv_file = os.path.join(
                docs_dir,
                "output",
                "csv_modalidades",
                f"{modalidade}_{season_pattern}.csv",
            )
        else:
            csv_file = (
                f"../docs/output/csv_modalidades/{modalidade}_{season_pattern}.csv"
            )
        if not os.path.exists(csv_file):
            continue

        try:
            with open(csv_file, newline="", encoding="utf-8-sig") as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    add_row(row)
        except FileNotFoundError:
            continue

    for row in current_rows:
        add_row(row)

    baselines: Dict[Optional[int], Dict[str, float]] = {}
    for div_key, scores in score_data.items():
        if scores:
            baselines[div_key] = {
                "mean": float(np.mean(scores)),
                "std": float(np.std(scores)),
            }

    return baselines


def calculate_division_draw_rates(
    modalidade: str,
    past_seasons: List[str],
    current_rows: List[Dict],
    docs_dir: str = None,
) -> Dict[Optional[int], float]:
    """
    Calcula taxa de empates por divisao.

    Retorna dict: {divisao: rate, None: rate}
    """
    totals = defaultdict(int)
    draws = defaultdict(int)

    def add_row(row: Dict) -> None:
        golos_1_str = row.get("Golos 1", "").strip()
        golos_2_str = row.get("Golos 2", "").strip()
        if not golos_1_str or not golos_2_str:
            return

        try:
            score_1 = int(float(golos_1_str))
            score_2 = int(float(golos_2_str))
        except ValueError:
            return

        div_raw = str(row.get("Divisao", row.get("Divisão", ""))).strip()
        div_key = None
        if div_raw:
            try:
                div_key = int(div_raw)
            except ValueError:
                div_key = None

        totals[div_key] += 1
        totals[None] += 1
        if score_1 == score_2:
            draws[div_key] += 1
            draws[None] += 1

    for season_pattern in past_seasons:
        if docs_dir:
            csv_file = os.path.join(
                docs_dir,
                "output",
                "csv_modalidades",
                f"{modalidade}_{season_pattern}.csv",
            )
        else:
            csv_file = (
                f"../docs/output/csv_modalidades/{modalidade}_{season_pattern}.csv"
            )
        if not os.path.exists(csv_file):
            continue

        try:
            with open(csv_file, newline="", encoding="utf-8-sig") as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    add_row(row)
        except FileNotFoundError:
            continue

    for row in current_rows:
        add_row(row)

    rates: Dict[Optional[int], float] = {}
    for div_key, total in totals.items():
        if total > 0:
            rates[div_key] = draws[div_key] / total

    return rates


def calculate_predicted_division_stats(
    fixtures: List[Dict],
    match_score_stats: Dict[str, Dict[str, int]],
) -> Dict[Optional[int], Dict[str, float]]:
    """
    Calcula medias previstas e taxa de empates por divisao.

    Retorna dict: {divisao: {"mean": x, "draw_rate": y, "matches": n}, None: {...}}
    """
    agg = defaultdict(lambda: {"sum_goals": 0.0, "sum_draw": 0.0, "matches": 0})

    for match in fixtures:
        if not match.get("is_future") or not match.get("id"):
            continue

        mid = match["id"]
        score_dist = match_score_stats.get(mid)
        if not score_dist:
            continue

        total = sum(score_dist.values())
        if total <= 0:
            continue

        exp_goals_a = 0.0
        exp_goals_b = 0.0
        exp_draw = 0.0
        for score_key, count in score_dist.items():
            try:
                score_a_str, score_b_str = score_key.split("-")
                score_a = int(score_a_str)
                score_b = int(score_b_str)
            except ValueError:
                continue
            prob = count / total
            exp_goals_a += score_a * prob
            exp_goals_b += score_b * prob
            if score_a == score_b:
                exp_draw += prob

        div_raw = str(match.get("divisao", "")).strip()
        div_key = None
        if div_raw:
            try:
                div_key = int(div_raw)
            except ValueError:
                div_key = None

        total_goals = exp_goals_a + exp_goals_b
        agg[div_key]["sum_goals"] += total_goals
        agg[div_key]["sum_draw"] += exp_draw
        agg[div_key]["matches"] += 1

        agg[None]["sum_goals"] += total_goals
        agg[None]["sum_draw"] += exp_draw
        agg[None]["matches"] += 1

    stats: Dict[Optional[int], Dict[str, float]] = {}
    for div_key, data in agg.items():
        if data["matches"] > 0:
            mean_per_team = (data["sum_goals"] / data["matches"]) / 2.0
            draw_rate = data["sum_draw"] / data["matches"]
            stats[div_key] = {
                "mean": mean_per_team,
                "draw_rate": draw_rate,
                "matches": data["matches"],
            }

    return stats


# ============================================================================
# FUNÇÃO AUXILIAR: Comparar Cenários
# ============================================================================


def compare_scenarios(
    baseline_results: Dict[str, Dict[str, float]],
    hardset_results: Dict[str, Dict[str, float]],
    top_n: int = 10,
) -> None:
    """
    Compara dois cenários (baseline vs hardset) e mostra diferenças.

    Args:
        baseline_results: Resultados sem hardset
        hardset_results: Resultados com hardset
        top_n: Mostrar top N equipas mais afetadas
    """
    print(f"\n{'='*80}")
    print("📊 COMPARAÇÃO DE CENÁRIOS: Baseline vs Hardset")
    print(f"{'='*80}\n")

    # Calcular diferenças
    diffs = []
    for team in baseline_results:
        if team not in hardset_results:
            continue

        diff_champion = (
            hardset_results[team]["p_champion"] - baseline_results[team]["p_champion"]
        ) * 100
        diff_playoffs = (
            hardset_results[team]["p_playoffs"] - baseline_results[team]["p_playoffs"]
        ) * 100
        diff_place = (
            hardset_results[team]["expected_place"]
            - baseline_results[team]["expected_place"]
        )
        diff_points = (
            hardset_results[team]["expected_points"]
            - baseline_results[team]["expected_points"]
        )
        diff_elo = (
            hardset_results[team]["avg_final_elo"]
            - baseline_results[team]["avg_final_elo"]
        )

        # Magnitude total de mudança
        magnitude = (
            abs(diff_champion)
            + abs(diff_playoffs) * 0.5
            + abs(diff_place) * 2
            + abs(diff_points)
        )

        diffs.append(
            {
                "team": team,
                "diff_champion": diff_champion,
                "diff_playoffs": diff_playoffs,
                "diff_place": diff_place,
                "diff_points": diff_points,
                "diff_elo": diff_elo,
                "magnitude": magnitude,
            }
        )

    # Ordenar por magnitude de mudança
    diffs_sorted = sorted(diffs, key=lambda x: x["magnitude"], reverse=True)

    print(f"🔝 TOP {top_n} EQUIPAS MAIS AFETADAS:\n")
    print(
        f"{'Equipa':<30} {'ΔCampeão':>12} {'ΔPlayoffs':>12} {'ΔLugar':>10} {'ΔPontos':>10} {'ΔELO':>8}"
    )
    print(f"{'-'*92}")

    for i, diff in enumerate(diffs_sorted[:top_n], 1):
        team = diff["team"]
        champion_arrow = (
            "↑"
            if diff["diff_champion"] > 0
            else "↓" if diff["diff_champion"] < 0 else "→"
        )
        playoffs_arrow = (
            "↑"
            if diff["diff_playoffs"] > 0
            else "↓" if diff["diff_playoffs"] < 0 else "→"
        )
        place_arrow = (
            "↑" if diff["diff_place"] < 0 else "↓" if diff["diff_place"] > 0 else "→"
        )

        print(
            f"{i:2}. {team:<27} "
            f"{champion_arrow} {diff['diff_champion']:>9.2f}%  "
            f"{playoffs_arrow} {diff['diff_playoffs']:>9.2f}%  "
            f"{place_arrow} {diff['diff_place']:>7.2f}  "
            f"{diff['diff_points']:>9.2f}  "
            f"{diff['diff_elo']:>7.1f}"
        )

    print(f"\n{'='*80}\n")


def example_hardset_usage():
    """Exemplo de como usar o sistema de hardset."""

    # Criar hardset manager
    hardset = HardsetManager()

    # OPÇÃO 1: Adicionar resultados manualmente
    # Nota: Usar nomes curtos (ex: "EGI" em vez de "Engenharia Informática")
    hardset.add_fixed_result("FUTSAL MASCULINO_5_EGI_Gestão", 5, 4)
    hardset.add_fixed_result("FUTSAL MASCULINO_6_Direito_Medicina", 2, 2)

    # OPÇÃO 2: Adicionar de dicionário
    hardset.add_from_dict(
        {
            "FUTSAL MASCULINO_7_Economia_Letras": (3, 1),
            "FUTSAL MASCULINO_8_Arquitetura_Ciências": (4, 4),
        }
    )

    # OPÇÃO 3: Carregar de CSV
    # hardset.add_from_csv("cenarios/upset_engenharia.csv")

    # Mostrar resumo
    print(hardset.summary())


# Carregar mapeamento de cursos
def main(
    hardset_args: Optional[Tuple] = None,
    hardset_csv: Optional[str] = None,
    filter_modalidade: Optional[str] = None,
    deep_simulation: bool = False,
    deeper_simulation: bool = False,
):
    """
    Função principal que simula futuras épocas e gera previsões.

    Args:
        hardset_args: Lista de tuplas (match_id, score) do argparse (opcional).
        hardset_csv: Caminho para CSV com resultados fixados (opcional).
        filter_modalidade: Processar apenas uma modalidade específica (opcional).
        deep_simulation: Usar 100k iterações em vez de 10k (opcional).
        deeper_simulation: Usar 1M iterações em vez de 10k (opcional).
    """
    # Definir diretório base do projeto (baseado na localização deste script)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)  # Diretório pai de 'src'
    docs_dir = os.path.join(project_dir, "docs")

    # Criar diretórios de output se não existirem
    os.makedirs(os.path.join(docs_dir, "output", "previsoes"), exist_ok=True)
    os.makedirs(os.path.join(docs_dir, "output", "cenarios"), exist_ok=True)

    course_mapping, course_mapping_short = load_course_mapping(docs_dir)
    print(
        f"Carregado mapeamento de {len(course_mapping)} variações de nomes de cursos\n"
    )

    # Inicializar hardset manager com course_mapping_short
    hardset_manager = None
    if hardset_args or hardset_csv:
        hardset_manager = HardsetManager(mapping_short=course_mapping_short)

        # Processar argumentos --hardset
        if hardset_args:
            print("\n🎯 HARDSET CARREGADO VIA ARGUMENTOS:\n")
            for match_id, score in hardset_args:
                try:
                    parts = score.split("-")
                    if len(parts) != 2:
                        print(f"❌ Formato inválido para score: {score}. Use 'A-B'")
                        continue
                    score_a, score_b = int(parts[0]), int(parts[1])
                    hardset_manager.add_fixed_result(match_id, score_a, score_b)
                except ValueError:
                    print(f"❌ Erro ao processar score: {score}")

        # Processar arquivo CSV
        if hardset_csv:
            hardset_manager.add_from_csv(hardset_csv)

        print()

    # Inicializar sistemas ELO
    elo_system = CompleteTacauaEloSystem(k_base=100)
    score_sim_futsal = SportScoreSimulator("futsal")
    score_sim_andebol = SportScoreSimulator("andebol")
    score_sim_basquete = SportScoreSimulator("basquete")
    score_sim_volei = SportScoreSimulator("volei")
    score_sim_futebol7 = SportScoreSimulator("futebol7")

    # Mapear modalidades aos simuladores apropriados
    sport_simulators = {
        "FUTSAL FEMININO": score_sim_futsal,
        "FUTSAL MASCULINO": score_sim_futsal,
        "ANDEBOL MISTO": score_sim_andebol,
        "BASQUETEBOL FEMININO": score_sim_basquete,
        "BASQUETEBOL MASCULINO": score_sim_basquete,
        "VOLEIBOL FEMININO": score_sim_volei,
        "VOLEIBOL MASCULINO": score_sim_volei,
        "FUTEBOL DE 7 MASCULINO": score_sim_futebol7,
    }

    # Processar cada modalidade
    ano_atual = datetime.now().year

    # Se há hardset, detectar modalidades afetadas e filtrar
    hardset_modalidades = set()
    if hardset_manager and hardset_manager.fixed_results:
        hardset_modalidades = hardset_manager.get_affected_modalidades()
        if hardset_modalidades:
            print(
                f"\n🎯 Hardset afeta modalidades: {', '.join(sorted(hardset_modalidades))}"
            )
            print("ℹ️ Processando APENAS essas modalidades...\n")
        else:
            print("\n⚠️ Aviso: Hardset carregado mas nenhuma modalidade foi detectada")
            print("ℹ️ Processando TODAS as modalidades...\n")

    modalidades_path = os.path.join(docs_dir, "output", "csv_modalidades")
    for modalidade_file in os.listdir(modalidades_path):
        # Filtro de ficheiros por épocas
        ano_passado_2d = str(ano_atual - 2)[2:]
        ano_passado_1d = str(ano_atual - 1)[2:]
        ano_atual_2d = str(ano_atual)[2:]

        # Processar apenas a epoca mais recente (ex: 25_26)
        if not modalidade_file.endswith(f"_{ano_passado_1d}_{ano_atual_2d}.csv"):
            continue

        # Extrair nome da modalidade e padrao de data (epoca mais recente)
        date_pattern = f"_{ano_passado_1d}_{ano_atual_2d}"
        modalidade = modalidade_file.replace(
            f"_{ano_passado_1d}_{ano_atual_2d}.csv", ""
        )

        # Filtrar modalidades se houver hardset ou filtro específico
        if hardset_modalidades and modalidade not in hardset_modalidades:
            continue

        # Filtrar por modalidade específica se solicitado
        if filter_modalidade and modalidade != filter_modalidade:
            continue

        print(f"Simulando modalidade: {modalidade}")

        # Selecionar simulador de resultados apropriado
        score_simulator = sport_simulators.get(modalidade, score_sim_futsal)

        past_seasons = [
            f"{ano_passado_2d}_{ano_passado_1d}",
            f"{ano_passado_1d}_{ano_atual_2d}",
        ]

        # Calcular taxa histórica de empates para esta modalidade (múltiplas épocas anteriores)
        historical_draw_rate = calculate_historical_draw_rate(
            modalidade,
            past_seasons,
            docs_dir,
        )
        if historical_draw_rate > 0:
            print(f"  Taxa histórica de empates: {historical_draw_rate:.1%}")

        # Carregar dados
        teams = {}
        fixtures = []
        all_teams_in_epoch = set()

        # Carregar ELOs mais recentes do ficheiro de ELO
        elo_file = os.path.join(
            docs_dir, "output", "elo_ratings", f"elo_{modalidade}{date_pattern}.csv"
        )
        initial_elos = {}
        if os.path.exists(elo_file):
            with open(elo_file, newline="", encoding="utf-8-sig") as csvfile:
                reader = csv.reader(csvfile)
                headers = next(reader)
                rows = list(reader)
                if rows:
                    last_row = rows[-1]
                    for i, team_name in enumerate(headers):
                        if i < len(last_row):
                            try:
                                normalized_name = normalize_team_name(
                                    team_name, course_mapping
                                )
                                initial_elos[normalized_name] = float(last_row[i])
                            except ValueError:
                                normalized_name = normalize_team_name(
                                    team_name, course_mapping
                                )
                                initial_elos[normalized_name] = 1500

        # Processar resultados de jogos (carregar TODOS os jogos)
        all_csv_rows = []
        with open(
            os.path.join(modalidades_path, modalidade_file),
            newline="",
            encoding="utf-8-sig",
        ) as csvfile:
            reader = csv.DictReader(csvfile)
            all_csv_rows = list(reader)

        # Separar jogos passados de futuros
        past_matches_rows, future_matches_rows = separate_past_and_future_matches(
            all_csv_rows
        )

        # Ajustar baselines por divisão com dados históricos + época atual
        division_baselines = calculate_division_baselines(
            modalidade,
            past_seasons,
            past_matches_rows,
            docs_dir,
        )
        division_draw_rates = calculate_division_draw_rates(
            modalidade,
            past_seasons,
            past_matches_rows,
            docs_dir,
        )
        score_simulator.set_division_baselines(division_baselines)
        score_simulator.set_division_draw_rates(division_draw_rates)

        # Processar APENAS jogos futuros para as fixtures (a simulação)
        # Jogos passados são usados apenas para histórico de ELO
        for row in future_matches_rows:
            team_a_raw = row["Equipa 1"].strip()
            team_b_raw = row["Equipa 2"].strip()

            if not is_valid_team(team_a_raw) or not is_valid_team(team_b_raw):
                continue

            team_a = normalize_team_name(team_a_raw, course_mapping)
            team_b = normalize_team_name(team_b_raw, course_mapping)

            all_teams_in_epoch.add(team_a)
            all_teams_in_epoch.add(team_b)

            if team_a not in teams:
                elo_a = initial_elos.get(team_a, 1500)
                teams[team_a] = Team(team_a, elo_a)
            if team_b not in teams:
                elo_b = initial_elos.get(team_b, 1500)
                teams[team_b] = Team(team_b, elo_b)

            # Usar nomes curtos para match_id (compatível com CSV)
            team_a_short = get_team_short_name(team_a, course_mapping_short)
            team_b_short = get_team_short_name(team_b, course_mapping_short)
            match_id = (
                f"{modalidade}_{row.get('Jornada', '0')}_{team_a_short}_{team_b_short}"
            )

            fixtures.append(
                {
                    "a": team_a,
                    "b": team_b,
                    "is_future": True,  # Sempre true nesta lista
                    "id": match_id,
                    "jornada": row.get("Jornada", ""),
                    "dia": row.get("Dia", ""),
                    "hora": row.get("Hora", ""),
                    "divisao": row.get("Divisão", ""),
                    "grupo": row.get("Grupo", ""),
                }
            )

        # Adicionar equipas dos jogos passados (para histórico)
        for row in past_matches_rows:
            team_a_raw = row["Equipa 1"].strip()
            team_b_raw = row["Equipa 2"].strip()

            if not is_valid_team(team_a_raw) or not is_valid_team(team_b_raw):
                continue

            team_a = normalize_team_name(team_a_raw, course_mapping)
            team_b = normalize_team_name(team_b_raw, course_mapping)

            all_teams_in_epoch.add(team_a)
            all_teams_in_epoch.add(team_b)

            if team_a not in teams:
                elo_a = initial_elos.get(team_a, 1500)
                teams[team_a] = Team(team_a, elo_a)
            if team_b not in teams:
                elo_b = initial_elos.get(team_b, 1500)
                teams[team_b] = Team(team_b, elo_b)

        # Simular
        if fixtures:
            # Apenas usar equipas que têm fixtures
            teams_with_fixtures = {
                team: teams[team] for team in all_teams_in_epoch if team in teams
            }

            # Mapear divisão/grupo das equipas (default 1ª divisão quando vazio)
            team_division = {}
            with open(
                os.path.join(modalidades_path, modalidade_file),
                newline="",
                encoding="utf-8-sig",
            ) as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    t1 = normalize_team_name(row["Equipa 1"].strip(), course_mapping)
                    t2 = normalize_team_name(row["Equipa 2"].strip(), course_mapping)
                    div = row.get("Divisão", "") or "1"
                    grp = (row.get("Grupo", "") or "").strip().upper()
                    try:
                        div_int = int(div)
                    except ValueError:
                        div_int = 1
                    if t1 in teams_with_fixtures:
                        team_division[t1] = (div_int, grp)
                    if t2 in teams_with_fixtures:
                        team_division[t2] = (div_int, grp)

            # Detectar se há liguilha (LM/PM) no CSV
            has_liguilla = False
            with open(
                os.path.join(modalidades_path, modalidade_file),
                newline="",
                encoding="utf-8-sig",
            ) as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    jornada_val = str(row.get("Jornada", "")).upper()
                    if jornada_val.startswith("LM") or jornada_val.startswith("PM"):
                        has_liguilla = True
                        break

            # Inferir slots de playoffs por divisão/grupo a partir dos placeholders das eliminatórias
            playoff_slots, total_playoff_slots = parse_playoff_slots(all_csv_rows)

            # Calcular pontos reais já alcançados na época regular
            real_points = calculate_real_points(past_matches_rows, course_mapping)

            results, match_forecasts, match_elo_forecast, match_score_stats = (
                monte_carlo_forecast_with_hardset(
                    teams_with_fixtures,
                    fixtures,
                    elo_system,
                    score_simulator,
                    n_simulations=(
                        10000
                        if not deep_simulation and not deeper_simulation
                        else (1000000 if deeper_simulation else 100000)
                    ),
                    team_division=team_division,
                    has_liguilla=has_liguilla,
                    real_points=real_points,
                    playoff_slots=playoff_slots,
                    total_playoff_slots=(
                        total_playoff_slots if total_playoff_slots > 0 else 8
                    ),
                    hardset_manager=hardset_manager,  # Passar hardset manager
                )
            )

            predicted_stats = calculate_predicted_division_stats(
                fixtures,
                match_score_stats,
            )

            print("Medias historicas e previstas (golos por equipa) e taxa de empates:")
            all_divs = set(division_baselines.keys()) | set(predicted_stats.keys())
            all_divs.add(None)
            for div_key in sorted([d for d in all_divs if d is not None]) + [None]:
                hist_base = division_baselines.get(div_key)
                hist_draw = division_draw_rates.get(div_key, 0.0)
                pred = predicted_stats.get(div_key)

                div_label = f"Div {div_key}" if div_key is not None else "Geral"
                hist_mean = hist_base["mean"] if hist_base else 0.0
                hist_std = hist_base["std"] if hist_base else 0.0
                pred_mean = pred["mean"] if pred else 0.0
                pred_draw = pred["draw_rate"] if pred else 0.0
                pred_matches = pred["matches"] if pred else 0

                print(
                    f"  {div_label}: historico={hist_mean:.2f} +/- {hist_std:.2f}, "
                    f"empates={hist_draw:.1%} | previsto={pred_mean:.2f}, "
                    f"empates={pred_draw:.1%} (jogos={pred_matches})"
                )

            # Debug info
            print(f"Equipas com fixtures: {len(all_teams_in_epoch)}")

            # Verificação: soma das probabilidades de playoffs por grupo/divisão
            if playoff_slots:
                print("Somas de p_playoffs por grupo (devem bater com vagas x 100%):")
                for (div, grp), slots in sorted(playoff_slots.items()):
                    group_key = (div, grp)
                    expected_sum = slots * 100.0
                    group_teams = [
                        team for team, tg in team_division.items() if tg == group_key
                    ]
                    prob_sum = sum(
                        results.get(team, {}).get("p_playoffs", 0.0) * 100.0
                        for team in group_teams
                    )
                    print(
                        f"  Div {div} Grupo {grp or '-'}: vagas={slots}, soma={prob_sum:.2f}, esperado={expected_sum:.2f}, diff={prob_sum - expected_sum:.2f}"
                    )
                print()

            # Guardar resultados (APENAS equipas com fixtures)
            # Se há hardset, guardar na pasta cenarios com sufixo _hardset
            if hardset_manager and hardset_manager.fixed_results:
                output_file = os.path.join(
                    docs_dir,
                    "output",
                    "cenarios",
                    f"forecast_{modalidade}_{ano_atual}_hardset.csv",
                )
            else:
                output_file = os.path.join(
                    docs_dir,
                    "output",
                    "previsoes",
                    f"forecast_{modalidade}_{ano_atual}.csv",
                )

            with open(output_file, "w", newline="", encoding="utf-8-sig") as csvfile:
                fieldnames = [
                    "team",
                    "p_playoffs",
                    "p_meias_finais",
                    "p_finais",
                    "p_champion",
                    "p_promocao",
                    "p_descida",
                    "expected_points",
                    "expected_points_std",
                    "expected_place",
                    "expected_place_std",
                    "avg_final_elo",
                    "avg_final_elo_std",
                ]
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()

                for team in sorted(all_teams_in_epoch):
                    if team in results:
                        p_playoffs = results[team]["p_playoffs"] * 100
                        p_meias_finais = results[team]["p_meias_finais"] * 100
                        p_finais = results[team]["p_finais"] * 100
                        p_champion = results[team]["p_champion"] * 100
                        p_promocao = results[team]["p_promocao"] * 100
                        p_descida = results[team]["p_descida"] * 100
                        expected_points = results[team]["expected_points"]
                        expected_points_std = results[team]["expected_points_std"]
                        expected_place = results[team]["expected_place"]
                        expected_place_std = results[team]["expected_place_std"]
                        avg_final_elo = results[team]["avg_final_elo"]
                        avg_final_elo_std = results[team]["avg_final_elo_std"]
                    else:
                        p_playoffs = 0.0
                        p_meias_finais = 0.0
                        p_finais = 0.0
                        p_champion = 0.0
                        p_promocao = 0.0
                        p_descida = 0.0
                        # Equipas sem jogos futuros: expected_points = pontos reais já conquistados
                        expected_points = real_points.get(team, 0.0)
                        expected_points_std = 0.0
                        expected_place = len(all_teams_in_epoch)
                        expected_place_std = 0.0
                        avg_final_elo = 1500.0
                        avg_final_elo_std = 0.0

                    writer.writerow(
                        {
                            "team": team,
                            "p_playoffs": f"{p_playoffs:.4f}",
                            "p_meias_finais": f"{p_meias_finais:.4f}",
                            "p_finais": f"{p_finais:.4f}",
                            "p_champion": f"{p_champion:.4f}",
                            "p_promocao": f"{p_promocao:.4f}",
                            "p_descida": f"{p_descida:.4f}",
                            "expected_points": f"{expected_points:.2f}",
                            "expected_points_std": f"{expected_points_std:.2f}",
                            "expected_place": f"{expected_place:.2f}",
                            "expected_place_std": f"{expected_place_std:.2f}",
                            "avg_final_elo": f"{avg_final_elo:.1f}",
                            "avg_final_elo_std": f"{avg_final_elo_std:.1f}",
                        }
                    )

            print(f"Resultados guardados em {output_file}")

            # Guardar previsões para jogos futuros
            # Se há hardset, guardar na pasta cenarios com sufixo _hardset
            if hardset_manager and hardset_manager.fixed_results:
                predictions_file = os.path.join(
                    docs_dir,
                    "output",
                    "cenarios",
                    f"previsoes_{modalidade}_{ano_atual}_hardset.csv",
                )
            else:
                predictions_file = os.path.join(
                    docs_dir,
                    "output",
                    "previsoes",
                    f"previsoes_{modalidade}_{ano_atual}.csv",
                )

            future_count = 0

            with open(
                predictions_file, "w", newline="", encoding="utf-8-sig"
            ) as csvfile:
                fieldnames = [
                    "jornada",
                    "dia",
                    "hora",
                    "team_a",
                    "team_b",
                    "expected_elo_a",
                    "expected_elo_a_std",
                    "expected_elo_b",
                    "expected_elo_b_std",
                    "prob_vitoria_a",
                    "prob_empate",
                    "prob_vitoria_b",
                    "distribuicao_placares",
                    "divisao",
                    "grupo",
                ]
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()

                for match in fixtures:
                    if match.get("is_future") and match.get("id") in match_forecasts:
                        mid = match["id"]
                        stats_a = match_forecasts[mid].get("p_win_a", 0) * 100
                        stats_draw = match_forecasts[mid].get("p_draw", 0) * 100
                        stats_b = match_forecasts[mid].get("p_win_b", 0) * 100

                        # Usar ELOs esperados NO MOMENTO DO JOGO (médias das simulações naquele ponto)
                        elo_forecast = match_elo_forecast.get(mid, {})
                        elo_a_expected = elo_forecast.get(
                            "elo_a_mean", teams[match["a"]].elo
                        )
                        elo_a_std = elo_forecast.get("elo_a_std", 0.0)
                        elo_b_expected = elo_forecast.get(
                            "elo_b_mean", teams[match["b"]].elo
                        )
                        elo_b_std = elo_forecast.get("elo_b_std", 0.0)

                        # Obter distribuição completa de placares
                        score_dist = match_score_stats.get(mid, {})
                        if score_dist:
                            # Ordenar por frequência (probabilidade)
                            sorted_scores = sorted(
                                score_dist.items(), key=lambda x: x[1], reverse=True
                            )

                            # Calcular total para converter em percentagens
                            total_sims = sum(score_dist.values())

                            # Criar string com TODOS os placares e suas probabilidades
                            distribuicao_str = "|".join(
                                [
                                    f"{score}:{(count / total_sims) * 100:.4f}%"
                                    for score, count in sorted_scores
                                ]
                            )
                        else:
                            distribuicao_str = ""

                        writer.writerow(
                            {
                                "jornada": match.get("jornada", ""),
                                "dia": match.get("dia", ""),
                                "hora": match.get("hora", ""),
                                "team_a": match["a"],
                                "team_b": match["b"],
                                "expected_elo_a": f"{elo_a_expected:.1f}",
                                "expected_elo_a_std": f"{elo_a_std:.1f}",
                                "expected_elo_b": f"{elo_b_expected:.1f}",
                                "expected_elo_b_std": f"{elo_b_std:.1f}",
                                "prob_vitoria_a": f"{stats_a:.4f}",
                                "prob_empate": f"{stats_draw:.4f}",
                                "prob_vitoria_b": f"{stats_b:.4f}",
                                "distribuicao_placares": distribuicao_str,
                                "divisao": match.get("divisao", ""),
                                "grupo": match.get("grupo", ""),
                            }
                        )
                        future_count += 1

            if future_count > 0:
                print(
                    f"Previsões de {future_count} jogos futuros guardadas em {predictions_file}\n"
                )
            else:
                print(
                    f"Nenhum jogo futuro encontrado para {modalidade} (ou sem previsões disponíveis)\n"
                )
                # Apagar ficheiro vazio se não houver previsões
                # (Opcional, mas mantém comportamento limpo)

        else:
            print(f"Nenhum fixture encontrado para {modalidade}\n")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Simula futuras épocas e gera previsões com suporte a cenários hardset",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EXEMPLOS DE USO:

1. Simulação baseline (sem hardset):
   python preditor.py

2. Com um resultado fixado via argumentos:
   python preditor.py --hardset "FUTSAL MASCULINO_5_Engenharia_Gestão" "5-4"

3. Com múltiplos resultados fixados:
   python preditor.py \\
     --hardset "FUTSAL MASCULINO_5_Engenharia_Gestão" "5-4" \\
     --hardset "FUTSAL MASCULINO_6_Direito_Medicina" "2-2"

4. Carregando hardset de um CSV:
   python preditor.py --hardset-csv "cenarios/upset_engenharia.csv"

5. Combinando argumentos e CSV:
   python preditor.py \\
     --hardset "FUTSAL MASCULINO_5_Engenharia_Gestão" "5-4" \\
     --hardset-csv "cenarios/outros_jogos.csv"

6. Modo Deep Simulation (simular 100 000 de vezes em vez de 10 000):

Formato do CSV (match_id,score_a,score_b):
FUTSAL MASCULINO_5_Engenharia_Gestão,5,4
FUTSAL MASCULINO_6_Direito_Medicina,2,2
        """,
    )

    parser.add_argument(
        "--hardset",
        nargs=2,
        action="append",
        metavar=("MATCH_ID", "SCORE"),
        help="Fixar resultado: match_id e score (ex: 'FUTSAL MASCULINO_5_Eng_Gestão' '5-4')",
    )

    parser.add_argument(
        "--hardset-csv",
        type=str,
        help="Carregar resultados fixados de um CSV (formato: match_id,score_a,score_b)",
    )

    parser.add_argument(
        "--compare",
        action="store_true",
        help="Correr simulação baseline E com hardset, mostrando comparação",
    )

    parser.add_argument(
        "--modalidade",
        type=str,
        help="Processar apenas uma modalidade específica (ex: 'FUTSAL FEMININO')",
    )

    parser.add_argument(
        "--example",
        action="store_true",
        help="Mostrar exemplo de uso do sistema de hardset",
    )

    parser.add_argument(
        "--deep-simulation",
        action="store_true",
        help="Usar simulação profunda (100 000 de iterações em vez de 10 000)",
    )

    parser.add_argument(
        "--deeper-simulation",
        action="store_true",
        help="Usar simulação ainda mais profunda (1 000 000 de iterações em vez de 10 000)",
    )

    args = parser.parse_args()

    # Se --example, mostrar exemplo e sair
    if args.example:
        print("\n" + "=" * 80)
        print("EXEMPLO DE USO DO SISTEMA DE HARDSET")
        print("=" * 80 + "\n")
        example_hardset_usage()
        sys.exit(0)

    # Inicializar hardset manager se houver argumentos ou CSV
    hardset_args = args.hardset if args.hardset else None
    hardset_csv = args.hardset_csv if args.hardset_csv else None
    deep_simulation = args.deep_simulation
    deeper_simulation = (
        args.deeper_simulation if hasattr(args, "deeper_simulation") else False
    )
    filter_modalidade = (
        args.modalidade if hasattr(args, "modalidade") and args.modalidade else None
    )

    # Se --compare, rodar simulação baseline E com hardset
    if args.compare and (hardset_args or hardset_csv):
        print("\n" + "=" * 80)
        print("MODO COMPARAÇÃO: Baseline vs Hardset")
        print("=" * 80 + "\n")

        print("🔄 Rodando simulação BASELINE (sem hardset)...\n")
        main(
            hardset_args=None,
            hardset_csv=None,
            filter_modalidade=filter_modalidade,
            deep_simulation=deep_simulation,
            deeper_simulation=deeper_simulation,
        )

        # Guardar resultados baseline
        # TODO: Implementar se necessário para comparação completa

        print("\n🔄 Rodando simulação COM HARDSET...\n")
        main(
            hardset_args=hardset_args,
            hardset_csv=hardset_csv,
            filter_modalidade=filter_modalidade,
            deep_simulation=deep_simulation,
            deeper_simulation=deeper_simulation,
        )
    else:
        # Simulação normal (com ou sem hardset)
        main(
            hardset_args=hardset_args,
            hardset_csv=hardset_csv,
            filter_modalidade=filter_modalidade,
            deep_simulation=deep_simulation,
            deeper_simulation=deeper_simulation,
        )
