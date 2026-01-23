# -*- coding: utf-8 -*-
import math
import random
import json
import numpy as np
from dataclasses import dataclass
from collections import defaultdict
from typing import List, Tuple, Dict
import csv
import os
from datetime import datetime
import sys
import io
import locale
import re

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
            "futsal": {"base_goals": 4.5, "elo_scale": 600},
            "andebol": {"base_goals": 18.0, "elo_scale": 500},
            "basquete": {"max_score": 21, "min_score": 2, "elo_scale": 400},
            "volei": {"elo_scale": 500},
            "futebol7": {"base_goals": 3.0, "elo_scale": 600},
        }
        self.params = self.baselines.get(sport_type, self.baselines["futsal"])

    def simulate_score(
        self, elo_a: float, elo_b: float, force_winner: bool = False
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
        if self.sport_type == "volei":
            # Voleibol nunca tem empates
            p_a = 1.0 / (1.0 + 10 ** ((elo_b - elo_a) / 250))
            winner_is_a = random.random() < p_a
            return self._simulate_volei(elo_a, elo_b, winner_is_a)

        elif self.sport_type == "basquete":
            # Basquete: permite empates em época regular, força vencedor em playoffs
            return self._simulate_basquete(elo_a, elo_b, force_winner)

        else:
            # Poisson (Futsal, Andebol, Futebol7)
            if force_winner:
                # Em playoffs, simular até ter vencedor
                while True:
                    score_a, score_b = self._simulate_poisson(elo_a, elo_b)
                    if score_a != score_b:
                        return (score_a, score_b)
            else:
                # Em época regular, permitir empates naturais
                return self._simulate_poisson(elo_a, elo_b)

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
        self, elo_a: float, elo_b: float, force_winner: bool = False
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
        base_score_a = 15 + (elo_a - elo_b) / 200
        base_score_b = 15 + (elo_b - elo_a) / 200

        score_a = min(21, max(0, int(np.random.normal(base_score_a, 3.5))))
        score_b = min(21, max(0, int(np.random.normal(base_score_b, 3.5))))

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

    def _simulate_poisson(self, elo_a: float, elo_b: float) -> Tuple[int, int]:
        """Futsal/Andebol/Futebol7: Modelo Poisson independente (permite empates)."""
        p = self.params
        base = p["base_goals"]
        elo_scale = p["elo_scale"]

        # Ajuste baseado em ELO
        elo_adjustment = (elo_a - elo_b) / elo_scale
        elo_adjustment = max(-0.4, min(0.4, elo_adjustment))

        lambda_a = base * (0.5 + elo_adjustment)
        lambda_b = base * (0.5 - elo_adjustment)

        # Garantir valores positivos
        lambda_a = max(0.2, lambda_a)
        lambda_b = max(0.2, lambda_b)

        # Amostrar golos de forma independente
        goals_a = np.random.poisson(lambda_a)
        goals_b = np.random.poisson(lambda_b)

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


def load_course_mapping() -> Dict[str, str]:
    """Carrega o mapeamento de nomes de cursos do config_cursos.json"""
    try:
        with open("config_cursos.json", encoding="utf-8-sig") as f:
            config = json.load(f)
            # Criar mapeamento: qualquer variação do nome -> nome padronizado
            mapping = {}
            for course_key, course_info in config.get("courses", {}).items():
                display_name = course_info.get("displayName", course_key)
                # Adicionar o display name e todas as variações de keys
                mapping[course_key] = display_name
                mapping[display_name] = display_name
            return mapping
    except Exception as e:
        print(f"Erro ao carregar config_cursos.json: {e}")
        return {}


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
) -> Tuple[str, int]:
    """
    Simula um jogo com sistema ELO completo.

    Args:
        team_a, team_b: Equipas
        elo_system: Sistema ELO
        score_simulator: Simulador de resultados
        total_group_games: Total de jogos para cálculo de K_factor
        is_playoff: Se True, força vencedor (sem empates em desportos que suportam prolongamento)

    Retorna (vencedor, margem)
    Atualiza ELOs das equipas.
    """

    # Simular resultado
    score1, score2 = score_simulator.simulate_score(
        team_a.elo, team_b.elo, force_winner=is_playoff  # Força vencedor em playoffs
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

    return winner_name, margin


def simulate_season(
    teams: Dict[str, Team],
    fixtures: List[Dict],
    elo_system: CompleteTacauaEloSystem,
    score_simulator: SportScoreSimulator,
    sport_draw_prob: float = 0.05,
) -> Tuple[Dict[str, int], Dict[str, float], Dict[str, float], Dict[str, str]]:
    """Simula uma época completa com sistema ELO completo.
    Retorna (points, expected_points, final_elos, season_results).

    Args:
        sport_draw_prob: Probabilidade média de empate (variar por modalidade).
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

        # Guardar ELOs ANTES do jogo
        elo_a_before = teams[a].elo
        elo_b_before = teams[b].elo

        # Calcular expected points considerando probabilidade de empate
        p_a = elo_system.elo_win_probability(teams[a].elo, teams[b].elo)
        p_b = 1 - p_a
        # Reduzir ligeiramente as probabilidades de vitória para criar espaço para empate
        p_draw = sport_draw_prob
        p_a = p_a * (1 - p_draw)
        p_b = p_b * (1 - p_draw)

        # Expected points: vitória=3, empate=1, derrota=0
        expected_points[a] += p_a * 3 + p_draw * 1
        expected_points[b] += p_b * 3 + p_draw * 1

        # Simular o jogo
        winner, margin = simulate_match(
            teams[a], teams[b], elo_system, score_simulator, total_games[a]
        )

        if match_id:
            season_results[match_id] = {
                "winner": winner,
                "margin": margin,
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
        winner, _ = simulate_match(
            teams[team_a_name],
            teams[team_b_name],
            elo_system,
            score_simulator,
            is_playoff=True,  # CRUCIAL: força vencedor
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
    """
    Simula futuros possíveis com playoffs e estima probabilidades.

    Args:
        real_points: Dicionário com pontos reais já alcançados ({team: points})

    Retorna (results, match_forecasts).
    """
    if real_points is None:
        real_points = {}
    playoff_count = defaultdict(int)
    semifinal_count = defaultdict(int)
    final_count = defaultdict(int)
    champion_count = defaultdict(int)
    expected_points_all = defaultdict(list)
    regular_season_places = defaultdict(list)
    final_elos_list = defaultdict(list)
    promotion_count = defaultdict(int)
    relegation_count = defaultdict(int)

    # Estatísticas de jogos futuros: match_id -> {1: count, X: count, 2: count}
    match_stats = defaultdict(lambda: {"1": 0, "X": 0, "2": 0, "total": 0})

    # Rastrear ELOs de cada equipa em cada jogo: match_id -> {team_a_elos: [], team_b_elos: []}
    match_elo_stats = defaultdict(lambda: {"team_a_elos": [], "team_b_elos": []})

    # Determinar probabilidade de empate por modalidade
    sport_draw_prob = 0.05  # Default 5%
    if score_simulator.sport_type == "futsal":
        sport_draw_prob = 0.10  # 10% de empates em futsal
    elif score_simulator.sport_type == "andebol":
        sport_draw_prob = 0.08  # 8% em andebol
    elif score_simulator.sport_type == "basquete":
        sport_draw_prob = 0.03  # 3% em basquete (prolongamento frequente reduz empates)
    elif score_simulator.sport_type == "volei":
        sport_draw_prob = 0.0  # 0% em voleibol (nunca tem empate)
    elif score_simulator.sport_type == "futebol7":
        sport_draw_prob = 0.12  # 12% em futebol

    for _ in range(n_simulations):
        # Clonar estado inicial (com games_played para cálculo correto de K_factor)
        sim_teams = {
            name: Team(name, team.elo, team.games_played)
            for name, team in teams.items()
        }

        # Simular época regular
        points_future, sim_expected_points, final_elos, season_results = (
            simulate_season(
                sim_teams,
                fixtures,
                elo_system,
                score_simulator,
                sport_draw_prob=sport_draw_prob,
            )
        )
        # Somar pontos reais já conquistados com os pontos simulados dos jogos futuros
        points = {
            team: points_future.get(team, 0) + real_points.get(team, 0)
            for team in teams
        }

        ranking = sorted(points.items(), key=lambda x: x[1], reverse=True)

        # CRUCIAL: Clonar novamente antes dos playoffs para não contaminar o estado
        # Os playoffs vão modificar os ELOs, não queremos que afetem a próxima simulação
        playoff_teams = {name: Team(name, final_elos[name]) for name in final_elos}

        # Acumular estatísticas de jogos futuros
        for match in fixtures:
            if match.get("is_future") and match.get("id"):
                mid = match["id"]
                res = season_results.get(mid)
                if res:
                    winner = res["winner"]
                    if winner == match["a"]:
                        match_stats[mid]["1"] += 1
                    elif winner == match["b"]:
                        match_stats[mid]["2"] += 1
                    else:
                        match_stats[mid]["X"] += 1
                    match_stats[mid]["total"] += 1

                    # Rastrear ELOs antes do jogo
                    match_elo_stats[mid]["team_a_elos"].append(res["elo_a_before"])
                    match_elo_stats[mid]["team_b_elos"].append(res["elo_b_before"])

        # Armazenar expected points (REAL + esperado dos futuros), posição na regular e ELO final
        for team in teams:
            # xpts = pontos reais já conseguidos + expected points dos jogos futuros
            real_pts = real_points.get(team, 0)
            future_xpts = sim_expected_points.get(team, 0.0)
            total_xpts = real_pts + future_xpts
            expected_points_all[team].append(total_xpts)
            final_elos_list[team].append(final_elos.get(team, teams[team].elo))

        # Registar posição na época regular
        for place, (team, _) in enumerate(ranking, 1):
            regular_season_places[team].append(place)

        # Contar qualificações para playoffs por divisão/grupo, respeitando slots inferidos
        if playoff_slots:
            standings_by_group: Dict[Tuple[int, str], List[Tuple[str, int]]] = (
                defaultdict(list)
            )
            for team, pts in ranking:
                div, grp = (
                    team_division.get(team, (1, "")) if team_division else (1, "")
                )
                standings_by_group[(div, grp)].append((team, pts))

            for group_key, slots in playoff_slots.items():
                placed = 0
                for team, _ in standings_by_group.get(group_key, []):
                    if is_b_team(team):
                        continue
                    playoff_count[team] += 1
                    placed += 1
                    if placed >= slots:
                        break
        else:
            # Fallback: top 8 geral (excluindo equipas B)
            playoff_qualifiers = 0
            for team, _ in ranking:
                if playoff_qualifiers >= total_playoff_slots:
                    break
                if not is_b_team(team):
                    playoff_count[team] += 1
                    playoff_qualifiers += 1

        # Simular playoffs (usando cópia profunda playoff_teams para não contaminar)
        champion, semifinalists, finalists = simulate_playoffs(
            playoff_teams, ranking, elo_system, score_simulator
        )
        if champion:
            champion_count[champion] += 1
        for team in semifinalists:
            semifinal_count[team] += 1
        for team in finalists:
            final_count[team] += 1

        # Calcular promoções/descidas por divisão (se informação disponível)
        if team_division:
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
                g = [t for t, _ in div2_groups[group_key]]
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
                    grp_keys = list(div2_groups.keys())
                    top_a = (
                        div2_groups[grp_keys[0]][0][0]
                        if div2_groups[grp_keys[0]]
                        else None
                    )
                    top_b = (
                        div2_groups[grp_keys[1]][0][0]
                        if div2_groups[grp_keys[1]]
                        else None
                    )
                    ninth = ranking_div1[8][0] if len(ranking_div1) >= 9 else None
                    candidates = [c for c in [top_a, top_b, ninth] if c]
                    # Sort by ELO expected strength
                    candidates_sorted = sorted(
                        candidates,
                        key=lambda t: sim_teams[t].elo if t in sim_teams else 1500,
                        reverse=True,
                    )
                    keep = candidates_sorted[:2]
                    drop = candidates_sorted[2:] if len(candidates_sorted) > 2 else []
                    promoted.update(keep)
                    for t in drop:
                        if t == ninth:
                            relegated.add(t)
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
                        next_non_b([t for t, _ in grp_list[1:]])
                        if len(grp_list) > 1
                        else None
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
                    winner = max(
                        candidates, key=lambda t: sim_teams.get(t, Team(t, 1500)).elo
                    )
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

            for t in promoted:
                promotion_count[t] += 1
            for t in relegated:
                relegation_count[t] += 1

    # Calcular estatísticas
    results = {}
    for team in teams:
        xpts_values = expected_points_all.get(team, [0.0])
        rs_places = regular_season_places.get(team, [len(teams)])
        elos_team = final_elos_list.get(team, [teams[team].elo])

        results[team] = {
            "p_playoffs": playoff_count[team] / n_simulations,
            "p_meias_finais": semifinal_count[team] / n_simulations,
            "p_finais": final_count[team] / n_simulations,
            "p_champion": champion_count[team] / n_simulations,
            "expected_points": np.mean(xpts_values),
            "expected_points_std": np.std(xpts_values),
            "expected_place": np.mean(rs_places),
            "expected_place_std": np.std(rs_places),
            "avg_final_elo": np.mean(elos_team),
            "avg_final_elo_std": np.std(elos_team),
            "p_promocao": promotion_count[team] / n_simulations,
            "p_descida": relegation_count[team] / n_simulations,
        }

    # Calcular probabilidades de jogos futuros
    match_forecasts = {}
    for mid, stats in match_stats.items():
        total = stats["total"]
        if total > 0:
            match_forecasts[mid] = {
                "p_win_a": stats["1"] / total,
                "p_draw": stats["X"] / total,
                "p_win_b": stats["2"] / total,
            }

    # Calcular médias e std dos ELOs por jogo
    match_elo_forecast = {}
    for mid, elo_data in match_elo_stats.items():
        team_a_elos = elo_data["team_a_elos"]
        team_b_elos = elo_data["team_b_elos"]
        if team_a_elos and team_b_elos:
            match_elo_forecast[mid] = {
                "elo_a_mean": np.mean(team_a_elos),
                "elo_a_std": np.std(team_a_elos),
                "elo_b_mean": np.mean(team_b_elos),
                "elo_b_std": np.std(team_b_elos),
            }

    return results, match_forecasts, match_elo_forecast


# ============================================================================
# VALIDAÇÃO E BACKTEST - Avaliar precisão das previsões
# ============================================================================


def calculate_historical_draw_rate(modalidade: str, past_seasons: List[str]) -> float:
    """
    Analisa épocas anteriores para calcular taxa real de empates.

    Args:
        modalidade: Nome da modalidade (ex: "FUTSAL MASCULINO")
        past_seasons: Lista de padrões de época (ex: ["23_24", "22_23"])

    Retorna taxa de empates (0.0 a 1.0)
    """
    total_games = 0
    total_draws = 0

    for season_pattern in past_seasons:
        csv_file = f"csv_modalidades/{modalidade}_{season_pattern}.csv"
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


# Carregar mapeamento de cursos
def main():
    course_mapping = load_course_mapping()
    print(
        f"Carregado mapeamento de {len(course_mapping)} variações de nomes de cursos\n"
    )

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

    modalidades_path = "csv_modalidades"
    for modalidade_file in os.listdir(modalidades_path):
        # Filtro de ficheiros por épocas
        ano_passado_2d = str(ano_atual - 2)[2:]
        ano_passado_1d = str(ano_atual - 1)[2:]
        ano_atual_2d = str(ano_atual)[2:]

        if not (
            modalidade_file.endswith(f"_{ano_passado_2d}_{ano_passado_1d}.csv")
            or modalidade_file.endswith(f"_{ano_passado_1d}_{ano_atual_2d}.csv")
        ):
            continue

        # Extrair nome da modalidade e padrão de data
        if modalidade_file.endswith(f"_{ano_passado_1d}_{ano_atual_2d}.csv"):
            date_pattern = f"_{ano_passado_1d}_{ano_atual_2d}"
            modalidade = modalidade_file.replace(
                f"_{ano_passado_1d}_{ano_atual_2d}.csv", ""
            )
        else:
            date_pattern = f"_{ano_passado_2d}_{ano_passado_1d}"
            modalidade = modalidade_file.replace(
                f"_{ano_passado_2d}_{ano_passado_1d}.csv", ""
            )

        print(f"Simulando modalidade: {modalidade}")

        # Selecionar simulador de resultados apropriado
        score_simulator = sport_simulators.get(modalidade, score_sim_futsal)

        # Calcular taxa histórica de empates para esta modalidade (múltiplas épocas anteriores)
        historical_draw_rate = calculate_historical_draw_rate(
            modalidade,
            [
                f"{ano_passado_2d}_{ano_passado_1d}",
                f"{ano_passado_1d}_{ano_atual_2d}",
            ],
        )
        if historical_draw_rate > 0:
            print(f"  Taxa histórica de empates: {historical_draw_rate:.1%}")

        # Carregar dados
        teams = {}
        fixtures = []
        all_teams_in_epoch = set()

        # Carregar ELOs mais recentes do ficheiro de ELO
        elo_file = f"elo_ratings/elo_{modalidade}{date_pattern}.csv"
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

            match_id = f"{modalidade}_{row.get('Jornada', '0')}_{team_a}_{team_b}"

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

            results, match_forecasts, match_elo_forecast = monte_carlo_forecast(
                teams_with_fixtures,
                fixtures,
                elo_system,
                score_simulator,
                n_simulations=10000,
                team_division=team_division,
                has_liguilla=has_liguilla,
                real_points=real_points,
                playoff_slots=playoff_slots,
                total_playoff_slots=(
                    total_playoff_slots if total_playoff_slots > 0 else 8
                ),
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
            output_file = f"elo_ratings/forecast_{modalidade}_{ano_atual}.csv"
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
                            "p_playoffs": f"{p_playoffs:.2f}",
                            "p_meias_finais": f"{p_meias_finais:.2f}",
                            "p_finais": f"{p_finais:.2f}",
                            "p_champion": f"{p_champion:.2f}",
                            "p_promocao": f"{p_promocao:.2f}",
                            "p_descida": f"{p_descida:.2f}",
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
            predictions_file = f"elo_ratings/previsoes_{modalidade}_{ano_atual}.csv"
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
                                "prob_vitoria_a": f"{stats_a:.2f}",
                                "prob_empate": f"{stats_draw:.2f}",
                                "prob_vitoria_b": f"{stats_b:.2f}",
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
    main()
