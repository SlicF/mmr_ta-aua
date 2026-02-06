# -*- coding: utf-8 -*-
"""
Sistema de Backtest para Validação de Previsões ELO
Compara previsões feitas em momentos passados com resultados reais.
"""

import csv
import os
import json
import math
import numpy as np
from collections import defaultdict
from typing import Dict, List, Tuple, Optional
import argparse


class BacktestValidator:
    """Valida precisão das previsões comparando com resultados históricos."""

    def __init__(self, modalidade: str, course_mapping: Dict[str, str]):
        self.modalidade = modalidade
        self.course_mapping = course_mapping
        self.available_seasons = self._find_available_seasons()

    def _find_available_seasons(self) -> List[str]:
        """Encontra todas as épocas disponíveis para esta modalidade."""
        seasons = []
        modalidades_path = "../docs/output/csv_modalidades"

        if not os.path.exists(modalidades_path):
            return seasons

        for filename in os.listdir(modalidades_path):
            if not filename.startswith(self.modalidade):
                continue

            # Extrair padrão de época (ex: "23_24", "22_23")
            if "_" in filename:
                parts = filename.replace(".csv", "").split("_")
                if len(parts) >= 2:
                    # Últimos dois elementos devem ser os anos
                    season_pattern = f"{parts[-2]}_{parts[-1]}"
                    if season_pattern not in seasons:
                        seasons.append(season_pattern)

        return sorted(seasons)

    def _get_previous_season(self, season: str) -> Optional[str]:
        """Retorna a época anterior (ex.: '24_25' -> '23_24')."""
        try:
            year1, year2 = season.split("_")
            prev1 = int(year1) - 1
            prev2 = int(year2) - 1
            return f"{prev1:02d}_{prev2:02d}"
        except Exception:
            return None

    def split_season_by_cutoff(
        self, season: str, cutoff_jornada: int = 8
    ) -> Tuple[List[Dict], List[Dict], List[Dict]]:
        """
        Divide época em três partes:
        1. Jogos de treino (até cutoff_jornada) - para calibrar ELOs
        2. Jogos de teste (após cutoff_jornada) - para validar previsões
        3. Todos os jogos - para resultados finais reais

        Args:
            season: Padrão da época (ex: "23_24")
            cutoff_jornada: Jornada de corte (default: 8 = ~meio da época)

        Retorna (training_matches, test_matches, all_matches)
        """
        csv_file = f"../docs/output/csv_modalidades/{self.modalidade}_{season}.csv"

        if not os.path.exists(csv_file):
            return [], [], []

        training_matches = []
        test_matches = []
        all_matches = []

        try:
            with open(csv_file, newline="", encoding="utf-8-sig") as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    # Verificar se tem resultados (não é placeholder de playoff)
                    golos_1 = row.get("Golos 1", "").strip()
                    golos_2 = row.get("Golos 2", "").strip()

                    if not golos_1 or not golos_2:
                        continue

                    jornada_str = row.get("Jornada", "0").strip()

                    # Tentar extrair número da jornada
                    try:
                        # Remover letras (ex: "8A" -> "8")
                        jornada_num = int("".join(filter(str.isdigit, jornada_str)))
                    except (ValueError, TypeError):
                        # Se não conseguir extrair, assumir que é jornada alta (playoffs)
                        jornada_num = 99

                    all_matches.append(row)

                    if jornada_num <= cutoff_jornada:
                        training_matches.append(row)
                    else:
                        test_matches.append(row)

        except FileNotFoundError:
            pass

        return training_matches, test_matches, all_matches

    def calculate_real_final_standings(
        self, all_matches: List[Dict]
    ) -> Dict[str, Dict]:
        """
        Calcula classificação final real de uma época.

        Retorna: {team_name: {points: int, place: int, ...}}
        """

        # Usar funções locais para evitar importar preditor (evita efeitos colaterais)
        def normalize_team_name(name: str, mapping: Dict[str, str]) -> str:
            return mapping.get(name.strip(), name.strip())

        def is_valid_team(team_name: str) -> bool:
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
            return not any(k in team_name for k in invalid_keywords)

        points = defaultdict(int)
        teams = set()

        for row in all_matches:
            team_a_raw = row["Equipa 1"].strip()
            team_b_raw = row["Equipa 2"].strip()

            if not is_valid_team(team_a_raw) or not is_valid_team(team_b_raw):
                continue

            team_a = normalize_team_name(team_a_raw, self.course_mapping)
            team_b = normalize_team_name(team_b_raw, self.course_mapping)

            teams.add(team_a)
            teams.add(team_b)

            golos_1_str = row.get("Golos 1", "").strip()
            golos_2_str = row.get("Golos 2", "").strip()

            if not golos_1_str or not golos_2_str:
                continue

            try:
                golos_1 = int(float(golos_1_str))
                golos_2 = int(float(golos_2_str))
            except ValueError:
                continue

            # Distribuir pontos
            if golos_1 > golos_2:
                points[team_a] += 3
            elif golos_2 > golos_1:
                points[team_b] += 3
            else:
                points[team_a] += 1
                points[team_b] += 1

        # Criar ranking
        ranking = sorted(points.items(), key=lambda x: x[1], reverse=True)

        standings = {}
        for place, (team, pts) in enumerate(ranking, 1):
            standings[team] = {"points": pts, "place": place}

        # Adicionar equipas sem pontos
        for team in teams:
            if team not in standings:
                standings[team] = {"points": 0, "place": len(teams)}

        return standings

    def generate_historical_forecast(
        self, season: str, cutoff_jornada: int = 0
    ) -> Optional[Dict[str, Dict]]:
        """Gera previsões como se estivéssemos no passado (jornada cutoff)."""

        try:
            from preditor import (
                CompleteTacauaEloSystem,
                SportScoreSimulator,
                monte_carlo_forecast,
                Team,
                normalize_team_name,
                is_valid_team,
                calculate_real_points,
                parse_playoff_slots,
            )
        except Exception as e:
            print(f"❌ Falha ao importar preditor: {e}")
            return None

        csv_file = f"../docs/output/csv_modalidades/{self.modalidade}_{season}.csv"
        if not os.path.exists(csv_file):
            return None

        with open(csv_file, newline="", encoding="utf-8-sig") as f:
            all_rows = list(csv.DictReader(f))

        simulated_past = []
        simulated_future = []

        for row in all_rows:
            golos_1 = row.get("Golos 1", "").strip()
            golos_2 = row.get("Golos 2", "").strip()

            try:
                jornada_num = int("".join(filter(str.isdigit, row.get("Jornada", "0"))))
            except Exception:
                jornada_num = 99

            if golos_1 and golos_2 and jornada_num <= cutoff_jornada:
                simulated_past.append(row)
            else:
                # Tratar como jogo futuro (limpar resultados)
                future_row = row.copy()
                future_row["Golos 1"] = ""
                future_row["Golos 2"] = ""
                simulated_future.append(future_row)

        if not simulated_future:
            return None

        # Inicializar simuladores
        sport_simulators = {
            "FUTSAL MASCULINO": SportScoreSimulator("futsal"),
            "FUTSAL FEMININO": SportScoreSimulator("futsal"),
            "ANDEBOL MISTO": SportScoreSimulator("andebol"),
            "BASQUETEBOL MASCULINO": SportScoreSimulator("basquete"),
            "BASQUETEBOL FEMININO": SportScoreSimulator("basquete"),
            "VOLEIBOL MASCULINO": SportScoreSimulator("volei"),
            "VOLEIBOL FEMININO": SportScoreSimulator("volei"),
            "FUTEBOL DE 7 MASCULINO": SportScoreSimulator("futebol7"),
        }
        score_simulator = sport_simulators.get(
            self.modalidade, SportScoreSimulator("futsal")
        )
        elo_system = CompleteTacauaEloSystem(k_base=100)

        teams: Dict[str, Team] = {}

        # ELO inicial: época anterior se existir, senão 1500
        initial_elos: Dict[str, float] = {}
        previous_season = self._get_previous_season(season)
        if previous_season:
            prev_elo_file = f"../docs/output/elo_ratings/elo_{self.modalidade}_{previous_season}.csv"
            if os.path.exists(prev_elo_file):
                try:
                    with open(prev_elo_file, newline="", encoding="utf-8-sig") as f:
                        reader = csv.reader(f)
                        headers = next(reader)
                        rows = list(reader)
                        if rows:
                            last_row = rows[-1]
                            for i, team_name in enumerate(headers):
                                if i < len(last_row):
                                    try:
                                        normalized = normalize_team_name(
                                            team_name, self.course_mapping
                                        )
                                        initial_elos[normalized] = float(last_row[i])
                                    except Exception:
                                        continue
                except Exception:
                    pass

        # Calibrar ELOs com jogos até ao cutoff
        for row in simulated_past:
            team_a_raw = row["Equipa 1"].strip()
            team_b_raw = row["Equipa 2"].strip()

            if not is_valid_team(team_a_raw) or not is_valid_team(team_b_raw):
                continue

            team_a = normalize_team_name(team_a_raw, self.course_mapping)
            team_b = normalize_team_name(team_b_raw, self.course_mapping)

            if team_a not in teams:
                teams[team_a] = Team(team_a, initial_elos.get(team_a, 1500))
            if team_b not in teams:
                teams[team_b] = Team(team_b, initial_elos.get(team_b, 1500))

            try:
                golos_1 = int(float(row.get("Golos 1", 0)))
                golos_2 = int(float(row.get("Golos 2", 0)))

                delta_a, delta_b = elo_system.calculate_elo_change(
                    teams[team_a].elo,
                    teams[team_b].elo,
                    golos_1,
                    golos_2,
                    teams[team_a].games_played + 1,
                    teams[team_b].games_played + 1,
                    10,
                    10,
                )

                teams[team_a].elo += delta_a
                teams[team_b].elo += delta_b
                teams[team_a].games_played += 1
                teams[team_b].games_played += 1
            except Exception:
                continue

        fixtures = []
        for row in simulated_future:
            team_a_raw = row["Equipa 1"].strip()
            team_b_raw = row["Equipa 2"].strip()

            if not is_valid_team(team_a_raw) or not is_valid_team(team_b_raw):
                continue

            team_a = normalize_team_name(team_a_raw, self.course_mapping)
            team_b = normalize_team_name(team_b_raw, self.course_mapping)

            if team_a not in teams:
                teams[team_a] = Team(team_a, initial_elos.get(team_a, 1500))
            if team_b not in teams:
                teams[team_b] = Team(team_b, initial_elos.get(team_b, 1500))

            fixtures.append(
                {
                    "a": team_a,
                    "b": team_b,
                    "is_future": True,
                    "id": f"{self.modalidade}_{row.get('Jornada', '0')}_{team_a}_{team_b}",
                    "jornada": row.get("Jornada", ""),
                    "dia": row.get("Dia", ""),
                    "hora": row.get("Hora", ""),
                    "divisao": row.get("Divisão", ""),
                    "grupo": row.get("Grupo", ""),
                }
            )

        if not fixtures:
            return None

        real_points = calculate_real_points(simulated_past, self.course_mapping)

        team_division = {}
        for row in all_rows:
            t1 = normalize_team_name(row["Equipa 1"].strip(), self.course_mapping)
            t2 = normalize_team_name(row["Equipa 2"].strip(), self.course_mapping)
            div = row.get("Divisão", "") or "1"
            grp = (row.get("Grupo", "") or "").strip().upper()
            try:
                div_int = int(div)
            except Exception:
                div_int = 1
            team_division[t1] = (div_int, grp)
            team_division[t2] = (div_int, grp)

        playoff_slots, total_slots = parse_playoff_slots(all_rows)

        has_liguilla = any(
            str(r.get("Jornada", "")).upper().startswith(("LM", "PM")) for r in all_rows
        )

        results, _, _ = monte_carlo_forecast(
            teams,
            fixtures,
            elo_system,
            score_simulator,
            n_simulations=10000,
            team_division=team_division,
            has_liguilla=has_liguilla,
            real_points=real_points,
            playoff_slots=playoff_slots,
            total_playoff_slots=total_slots if total_slots > 0 else 8,
        )

        return results

    def calculate_brier_score(
        self, forecasts: Dict[str, Dict], real_standings: Dict[str, Dict]
    ) -> float:
        """
        Calcula Brier Score para probabilidades de campeão.

        Brier Score = média de (p_previsto - resultado_real)²
        - 0.0 = perfeito
        - 0.25 = aleatório
        - 1.0 = sempre errado

        Args:
            forecasts: {team: {p_champion: float, ...}}
            real_standings: {team: {place: int, ...}}

        Retorna Brier Score (0.0 a 1.0)
        """
        squared_errors = []

        for team in forecasts:
            p_champion = forecasts[team].get("p_champion", 0.0)
            was_champion = (
                1.0 if real_standings.get(team, {}).get("place") == 1 else 0.0
            )

            squared_error = (p_champion - was_champion) ** 2
            squared_errors.append(squared_error)

        if not squared_errors:
            return 1.0

        return np.mean(squared_errors)

    def calculate_rmse_expected_place(
        self, forecasts: Dict[str, Dict], real_standings: Dict[str, Dict]
    ) -> float:
        """
        Calcula RMSE (Root Mean Square Error) para expected_place.

        RMSE = sqrt(média de (lugar_previsto - lugar_real)²)

        Valores bons:
        - < 1.5: Excelente
        - 1.5-2.5: Bom
        - 2.5-4.0: Razoável
        - > 4.0: Fraco
        """
        squared_errors = []

        for team in forecasts:
            expected_place = forecasts[team].get("expected_place", 99)
            real_place = real_standings.get(team, {}).get("place", 99)

            squared_error = (expected_place - real_place) ** 2
            squared_errors.append(squared_error)

        if not squared_errors:
            return 999.0

        return math.sqrt(np.mean(squared_errors))

    def calculate_rmse_expected_points(
        self, forecasts: Dict[str, Dict], real_standings: Dict[str, Dict]
    ) -> float:
        """Calcula RMSE para expected_points vs pontos reais."""
        squared_errors = []

        for team in forecasts:
            expected_points = forecasts[team].get("expected_points", 0)
            real_points = real_standings.get(team, {}).get("points", 0)

            squared_error = (expected_points - real_points) ** 2
            squared_errors.append(squared_error)

        if not squared_errors:
            return 999.0

        return math.sqrt(np.mean(squared_errors))

    def check_probability_calibration(
        self,
        forecasts: Dict[str, Dict],
        real_standings: Dict[str, Dict],
        metric: str = "p_champion",
    ) -> Dict[str, Dict]:
        """
        Verifica se probabilidades estão calibradas.

        Exemplo: Se 10 equipas tinham 30% de chance de campeão,
                 ~3 delas deveriam ter sido campeãs.

        Args:
            metric: "p_champion", "p_playoffs", "p_finais", etc.

        Retorna: {bin: {predicted: float, observed: float, count: int}}
        """
        # Dividir em bins de 10%
        bins = defaultdict(lambda: {"predictions": [], "outcomes": []})

        for team in forecasts:
            p = forecasts[team].get(metric, 0.0)

            # Determinar resultado real baseado no métrico
            if metric == "p_champion":
                outcome = 1.0 if real_standings.get(team, {}).get("place") == 1 else 0.0
            elif metric == "p_playoffs":
                # Assumir top 8 vai para playoffs
                outcome = (
                    1.0 if real_standings.get(team, {}).get("place", 99) <= 8 else 0.0
                )
            else:
                continue

            # Colocar em bin (0-10%, 10-20%, etc.)
            bin_idx = min(int(p * 10), 9)  # 0-9
            bin_label = f"{bin_idx*10}-{(bin_idx+1)*10}%"

            bins[bin_label]["predictions"].append(p)
            bins[bin_label]["outcomes"].append(outcome)

        # Calcular estatísticas por bin
        calibration = {}
        for bin_label, data in bins.items():
            if not data["predictions"]:
                continue

            # Converter para tipos nativos de Python para evitar numpy.* no JSON
            predicted_avg = float(np.mean(data["predictions"]))
            observed_avg = float(np.mean(data["outcomes"]))
            count = int(len(data["predictions"]))

            calibration[bin_label] = {
                "predicted": predicted_avg,
                "observed": observed_avg,
                "count": count,
                "calibrated": bool(
                    abs(predicted_avg - observed_avg) < 0.15
                ),  # ±15% tolerância
            }

        return calibration

    def run_backtest_for_season(
        self, season: str, cutoff_jornada: int = 8, verbose: bool = True
    ) -> Optional[Dict]:
        """
        Executa backtest completo para uma época.

        Passos:
        1. Divide época em treino (até jornada X) e teste (após jornada X)
        2. Simula previsões como se estivéssemos na jornada X
        3. Compara previsões com resultados reais
        4. Calcula métricas de erro

        Args:
            season: "23_24", "22_23", etc.
            cutoff_jornada: Momento de fazer previsão (default: 8)
            verbose: Se True, mostra progresso

        Retorna dict com métricas ou None se falhar
        """
        if verbose:
            print(f"\n{'='*60}")
            print(f"BACKTEST: {self.modalidade} - Época {season}")
            print(f"Cutoff: Jornada {cutoff_jornada}")
            print(f"{'='*60}")

        # 1. Dividir época
        training_matches, test_matches, all_matches = self.split_season_by_cutoff(
            season, cutoff_jornada
        )

        if not all_matches:
            if verbose:
                print(f"❌ Época {season} não encontrada")
            return None

        if not test_matches:
            if verbose:
                print(
                    f"⚠️  Sem jogos de teste (todos antes da jornada {cutoff_jornada})"
                )
            return None

        if verbose:
            print(f"✓ Jogos de treino: {len(training_matches)}")
            print(f"✓ Jogos de teste: {len(test_matches)}")
            print(f"✓ Total de jogos: {len(all_matches)}")

        # 2. Calcular standings reais finais
        real_standings = self.calculate_real_final_standings(all_matches)

        if verbose:
            print(f"✓ Equipas na época: {len(real_standings)}")

        # 3. Gerar previsões "time-travel" usando apenas informação até ao cutoff
        if verbose:
            print(
                f"⏳ A gerar previsões time-travel (jornada {cutoff_jornada}) para {season}..."
            )

        forecasts = self.generate_historical_forecast(season, cutoff_jornada)

        if not forecasts:
            if verbose:
                print("❌ Falha ao gerar previsões time-travel")
            return None

        # 4. Calcular métricas
        # Garantir tipos nativos ao calcular métricas
        brier_champion = float(self.calculate_brier_score(forecasts, real_standings))
        rmse_place = float(
            self.calculate_rmse_expected_place(forecasts, real_standings)
        )
        rmse_points = float(
            self.calculate_rmse_expected_points(forecasts, real_standings)
        )
        calibration_champion = self.check_probability_calibration(
            forecasts, real_standings, "p_champion"
        )
        calibration_playoffs = self.check_probability_calibration(
            forecasts, real_standings, "p_playoffs"
        )

        metrics = {
            "season": season,
            "cutoff_jornada": cutoff_jornada,
            "num_teams": len(real_standings),
            "brier_score_champion": brier_champion,
            "rmse_expected_place": rmse_place,
            "rmse_expected_points": rmse_points,
            "calibration_champion": calibration_champion,
            "calibration_playoffs": calibration_playoffs,
        }

        # 5. Mostrar resultados
        if verbose:
            self._print_metrics(metrics, real_standings, forecasts)

        return metrics

    def _print_metrics(self, metrics: Dict, real_standings: Dict, forecasts: Dict):
        """Imprime métricas de forma legível."""
        print(f"\n📊 MÉTRICAS DE PRECISÃO:")
        print(f"─" * 60)

        # Brier Score
        brier = metrics["brier_score_champion"]
        brier_rating = (
            "EXCELENTE"
            if brier < 0.05
            else "BOM" if brier < 0.10 else "RAZOÁVEL" if brier < 0.20 else "FRACO"
        )
        print(f"Brier Score (Campeão):     {brier:.4f}  ({brier_rating})")

        # RMSE Place
        rmse_place = metrics["rmse_expected_place"]
        place_rating = (
            "EXCELENTE"
            if rmse_place < 1.5
            else (
                "BOM"
                if rmse_place < 2.5
                else "RAZOÁVEL" if rmse_place < 4.0 else "FRACO"
            )
        )
        print(f"RMSE Expected Place:       {rmse_place:.2f}  ({place_rating})")

        # RMSE Points
        rmse_pts = metrics["rmse_expected_points"]
        print(f"RMSE Expected Points:      {rmse_pts:.2f}")

        # Calibração
        print(f"\n📈 CALIBRAÇÃO DE PROBABILIDADES:")
        print(f"─" * 60)

        cal_champ = metrics["calibration_champion"]
        if cal_champ:
            print("Probabilidade de Campeão:")
            for bin_label, stats in sorted(cal_champ.items()):
                status = "✓" if stats["calibrated"] else "✗"
                print(
                    f"  {status} {bin_label:>10}: "
                    f"Previsto={stats['predicted']:.1%}, "
                    f"Observado={stats['observed']:.1%}, "
                    f"N={stats['count']}"
                )
        else:
            print("  (Sem dados suficientes)")

        # Top 3 previsões vs realidade
        print(f"\n🏆 TOP 3: PREVISTO vs REAL:")
        print(f"─" * 60)

        # Ordenar por p_champion
        top_forecast = sorted(
            forecasts.items(), key=lambda x: x[1]["p_champion"], reverse=True
        )[:3]

        for rank, (team, pred) in enumerate(top_forecast, 1):
            real_place = real_standings.get(team, {}).get("place", "?")
            p_champ = pred["p_champion"] * 100
            match = "✓" if real_place == 1 else "✗"
            print(
                f"  {match} {rank}º) {team:30} P(Campeão)={p_champ:5.1f}% → Real: {real_place}º"
            )

        # Campeão real
        real_champion = next(
            (t for t, s in real_standings.items() if s["place"] == 1), "?"
        )
        if real_champion in forecasts:
            p_real_champ = forecasts[real_champion]["p_champion"] * 100
            print(
                f"\n  🏆 Campeão Real: {real_champion} (previsto: {p_real_champ:.1f}%)"
            )

    def run_all_available_backtests(self, cutoff_jornada: int = 8) -> List[Dict]:
        """
        Executa backtest para todas as épocas disponíveis.

        Retorna lista de métricas por época.
        """
        print(f"\n{'='*60}")
        print(f"BACKTEST MULTI-ÉPOCA: {self.modalidade}")
        print(f"{'='*60}")
        print(f"Épocas disponíveis: {', '.join(self.available_seasons)}")

        all_metrics = []

        for season in self.available_seasons:
            metrics = self.run_backtest_for_season(season, cutoff_jornada, verbose=True)
            if metrics:
                all_metrics.append(metrics)

        # Resumo geral
        if all_metrics:
            self._print_summary(all_metrics)

        return all_metrics

    def _print_summary(self, all_metrics: List[Dict]):
        """Imprime resumo de todas as épocas."""
        print(f"\n{'='*60}")
        print(f"📊 RESUMO GERAL - {len(all_metrics)} ÉPOCAS")
        print(f"{'='*60}")

        # Calcular médias
        # Converter médias para float nativo
        avg_brier = float(np.mean([m["brier_score_champion"] for m in all_metrics]))
        avg_rmse_place = float(np.mean([m["rmse_expected_place"] for m in all_metrics]))
        avg_rmse_points = float(
            np.mean([m["rmse_expected_points"] for m in all_metrics])
        )

        print(f"Brier Score Médio:         {avg_brier:.4f}")
        print(f"RMSE Expected Place Médio: {avg_rmse_place:.2f}")
        print(f"RMSE Expected Points Médio:{avg_rmse_points:.2f}")

        # Interpretação final
        print(f"\n🎯 AVALIAÇÃO GERAL:")
        print(f"─" * 60)

        if avg_brier < 0.10 and avg_rmse_place < 2.5:
            print("✅ MODELO EXCELENTE - Previsões bem calibradas e precisas")
        elif avg_brier < 0.15 and avg_rmse_place < 3.5:
            print("✅ MODELO BOM - Previsões úteis com margem de erro aceitável")
        elif avg_brier < 0.20 and avg_rmse_place < 5.0:
            print("⚠️  MODELO RAZOÁVEL - Previsões indicativas mas com incerteza")
        else:
            print("❌ MODELO FRACO - Requer calibração ou mais dados")

        # Guardar resumo em JSON
        summary_file = f"../docs/output/elo_ratings/backtest_summary_{self.modalidade}.json"
        with open(summary_file, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "modalidade": self.modalidade,
                    "num_seasons": int(len(all_metrics)),
                    "avg_brier_score": avg_brier,
                    "avg_rmse_place": avg_rmse_place,
                    "avg_rmse_points": avg_rmse_points,
                    "seasons": [self._json_safe(m) for m in all_metrics],
                },
                f,
                indent=2,
                ensure_ascii=False,
            )
        print(f"\n💾 Resumo guardado em: {summary_file}")

    def _json_safe(self, obj):
        """Converte recursivamente tipos numpy para tipos nativos serializáveis em JSON."""
        # Numpy escalares
        if isinstance(obj, np.generic):
            return obj.item()
        # Numpy arrays
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        # Dict
        if isinstance(obj, dict):
            return {k: self._json_safe(v) for k, v in obj.items()}
        # Lista ou tuplo
        if isinstance(obj, (list, tuple)):
            return [self._json_safe(v) for v in obj]
        # Caso geral: devolver o próprio objeto
        return obj


# ============================================================================
# SCRIPT PRINCIPAL
# ============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Backtest de previsões ELO por modalidade"
    )
    parser.add_argument(
        "--modalidade",
        type=str,
        help="Modalidade específica a testar (ex.: 'FUTSAL MASCULINO')",
    )
    parser.add_argument(
        "--cutoff",
        type=int,
        default=8,
        help="Jornada de corte para treino/teste (default: 8)",
    )
    args = parser.parse_args()

    # Carregar mapeamento de cursos
    try:
        with open("../docs/config/config_cursos.json", encoding="utf-8-sig") as f:
            config = json.load(f)
            course_mapping = {}
            for course_key, course_info in config.get("courses", {}).items():
                display_name = course_info.get("displayName", course_key)
                course_mapping[course_key] = display_name
                course_mapping[display_name] = display_name
    except Exception as e:
        print(f"Erro ao carregar config_cursos.json: {e}")
        course_mapping = {}

    # Lista de modalidades para testar
    default_modalidades = [
        "FUTSAL MASCULINO",
        "FUTSAL FEMININO",
        "ANDEBOL MISTO",
        "BASQUETEBOL MASCULINO",
        "BASQUETEBOL FEMININO",
        "VOLEIBOL MASCULINO",
        "VOLEIBOL FEMININO",
        "FUTEBOL DE 7 MASCULINO",
    ]
    modalidades = [args.modalidade] if args.modalidade else default_modalidades

    # Rodar backtest para cada modalidade (ou apenas a especificada)
    for modalidade in modalidades:
        validator = BacktestValidator(modalidade, course_mapping)

        if not validator.available_seasons:
            print(f"\n⚠️  Sem dados para {modalidade}")
            continue

        # Rodar backtest para todas as épocas disponíveis
        validator.run_all_available_backtests(cutoff_jornada=args.cutoff)
