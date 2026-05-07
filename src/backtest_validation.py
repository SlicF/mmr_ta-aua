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

    def __init__(
        self, modalidade: str, course_mapping: Dict[str, str], docs_dir: str = None
    ):
        self.modalidade = modalidade
        self.course_mapping = course_mapping

        # Definir docs_dir (com fallback para caminho relativo por compatibilidade)
        if docs_dir is None:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            project_dir = os.path.dirname(script_dir)
            docs_dir = os.path.join(project_dir, "docs")
        self.docs_dir = docs_dir

        self.available_seasons = self._find_available_seasons()

    def _find_available_seasons(self) -> List[str]:
        """Encontra todas as épocas disponíveis para esta modalidade."""
        seasons = []
        modalidades_path = os.path.join(self.docs_dir, "output", "csv_modalidades")

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
        csv_file = os.path.join(
            self.docs_dir,
            "output",
            "csv_modalidades",
            f"{self.modalidade}_{season}.csv",
        )

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
        self,
        season: str,
        cutoff_jornada: int = 0,
        calibrated_params: Optional[Dict] = None,
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

        csv_file = os.path.join(
            self.docs_dir,
            "output",
            "csv_modalidades",
            f"{self.modalidade}_{season}.csv",
        )
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
        if calibrated_params:
            score_simulator.apply_calibrated_params(calibrated_params)
        elo_system = CompleteTacauaEloSystem(k_base=100)

        teams: Dict[str, Team] = {}

        # ELO inicial: época anterior se existir, senão 1500
        initial_elos: Dict[str, float] = {}
        previous_season = self._get_previous_season(season)
        if previous_season:
            prev_elo_file = os.path.join(
                self.docs_dir,
                "output",
                "elo_ratings",
                f"elo_{self.modalidade}_{previous_season}.csv",
            )
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

        real_points = calculate_real_points(
            simulated_past, self.course_mapping, modalidade=self.modalidade
        )

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

        results, *_ = monte_carlo_forecast(
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
        self,
        season: str,
        cutoff_jornada: int = 8,
        verbose: bool = True,
        use_calibrated: bool = False,
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

        calibrated_params = None
        if use_calibrated:
            calibrated_params = self.load_calibrated_params()
        forecasts = self.generate_historical_forecast(
            season,
            cutoff_jornada,
            calibrated_params=calibrated_params,
        )

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
        print(f"-" * 60)

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
        print(f"-" * 60)

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
        print(f"-" * 60)

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

    def load_calibrated_params(self) -> Optional[Dict]:
        """
        Carrega parâmetros calibrados do ficheiro gerado por calibrator.py.

        Returns:
            Dict com parâmetros calibrados ou None se não existir
        """
        calibration_path = os.path.join(
            self.docs_dir, "output", "calibration", "calibrated_simulator_config.json"
        )

        if not os.path.exists(calibration_path):
            print(f"⚠️  Parâmetros calibrados não encontrados: {calibration_path}")
            print("   Executar primeiro: python calibrator.py")
            return None

        try:
            with open(calibration_path, "r", encoding="utf-8") as f:
                calibrated_config = json.load(f)

            if self.modalidade not in calibrated_config:
                print(f"⚠️  Modalidade {self.modalidade} não tem parâmetros calibrados")
                return None

            return calibrated_config[self.modalidade]

        except Exception as e:
            print(f"❌ Erro ao carregar parâmetros calibrados: {e}")
            return None

    def compare_fixed_vs_calibrated(
        self, season: str, cutoff_jornada: int = 8, verbose: bool = True
    ) -> Dict:
        """
        Compara desempenho do modelo FIXO vs CALIBRADO no backtest.

        Args:
            season: Época para testar (ex: "24_25")
            cutoff_jornada: Jornada de corte
            verbose: Imprimir detalhes

        Returns:
            Dict com métricas comparativas:
            {
                'season': str,
                'fixed': {...métricas...},
                'calibrated': {...métricas...},
                'improvement': {
                    'brier_score': float (% melhoria),
                    'accuracy': float (% melhoria),
                    'rmse': float (% melhoria),
                }
            }
        """
        if verbose:
            print(f"\n{'='*70}")
            print(f"COMPARAÇÃO: FIXO vs CALIBRADO | {self.modalidade} | Época {season}")
            print(f"{'='*70}")

        # Carregar parâmetros calibrados
        calibrated_params = self.load_calibrated_params()
        if calibrated_params is None:
            print("❌ Impossível comparar sem parâmetros calibrados")
            return {}

        # 1. Backtest com parâmetros FIXOS (atuais)
        if verbose:
            print("\n[1/2] Rodando backtest com PARÂMETROS FIXOS...")
        metrics_fixed = self.run_backtest_for_season(
            season,
            cutoff_jornada,
            verbose=False,
            use_calibrated=False,
        )

        # 2. Backtest com parâmetros CALIBRADOS
        if verbose:
            print("[2/2] Rodando backtest com PARÂMETROS CALIBRADOS...")
        metrics_calibrated = self.run_backtest_for_season(
            season,
            cutoff_jornada,
            verbose=False,
            use_calibrated=True,
        )

        # Calcular melhorias
        improvement = {}
        if metrics_fixed and metrics_calibrated:
            fixed_brier = metrics_fixed.get("brier_score_champion")
            fixed_rmse_place = metrics_fixed.get("rmse_expected_place")
            fixed_rmse_points = metrics_fixed.get("rmse_expected_points")

            cal_brier = metrics_calibrated.get("brier_score_champion")
            cal_rmse_place = metrics_calibrated.get("rmse_expected_place")
            cal_rmse_points = metrics_calibrated.get("rmse_expected_points")

            if fixed_brier and fixed_brier > 0:
                improvement["brier_score"] = (fixed_brier - cal_brier) / fixed_brier
            if fixed_rmse_place and fixed_rmse_place > 0:
                improvement["rmse_expected_place"] = (
                    fixed_rmse_place - cal_rmse_place
                ) / fixed_rmse_place
            if fixed_rmse_points and fixed_rmse_points > 0:
                improvement["rmse_expected_points"] = (
                    fixed_rmse_points - cal_rmse_points
                ) / fixed_rmse_points

        comparison = {
            "season": season,
            "modalidade": self.modalidade,
            "cutoff_jornada": cutoff_jornada,
            "fixed_model": metrics_fixed,
            "calibrated_model": metrics_calibrated,
            "calibrated_params_used": calibrated_params,
            "improvement": improvement,
            "status": "completed",
        }

        if verbose and metrics_fixed and metrics_calibrated:
            print(f"\n{'='*70}")
            print("RESULTADOS - COMPARAÇÃO FIXO vs CALIBRADO")
            print(f"{'='*70}")
            print(f"  Brier (fixo):      {metrics_fixed['brier_score_champion']:.4f}")
            print(
                f"  Brier (calib):     {metrics_calibrated['brier_score_champion']:.4f}"
            )
            print(f"  RMSE place (fixo): {metrics_fixed['rmse_expected_place']:.2f}")
            print(
                f"  RMSE place (cal):  {metrics_calibrated['rmse_expected_place']:.2f}"
            )
            print(f"  RMSE pts (fixo):   {metrics_fixed['rmse_expected_points']:.2f}")
            print(
                f"  RMSE pts (cal):    {metrics_calibrated['rmse_expected_points']:.2f}"
            )
            if improvement:
                print("\n  Melhoria relativa:")
                for key, val in improvement.items():
                    print(f"    {key}: {val:+.1%}")
            print(f"{'='*70}")

        return comparison

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
        print(f"-" * 60)

        # Critério mais realista baseado no Brier Score (métrica principal)
        # RMSE Place é afetado por volatilidade das competições (30+ equipas = naturalmente maior erro)
        if avg_brier < 0.03:
            print("✅ MODELO EXCELENTE - Probabilidades muito bem calibradas")
        elif avg_brier < 0.05:
            print("✅ MODELO BOM - Previsões úteis e confiáveis")
        elif avg_brier < 0.08:
            print("⚠️  MODELO RAZOÁVEL - Previsões indicativas com variância normal")
        else:
            print("❌ MODELO FRACO - Requer calibração ou revisão de dados históricos")

        # Guardar resumo em JSON
        summary_file = os.path.join(
            self.docs_dir,
            "output",
            "elo_ratings",
            f"backtest_summary_{self.modalidade}.json",
        )
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

    def evaluate_calibrated_params(self) -> Dict:
        """
        Avalia a qualidade dos parâmetros calibrados.

        Retorna score e análise de cada componente.
        """
        params = self.load_calibrated_params()
        if not params:
            return {"status": "not_found", "score": 0}

        evaluation = {
            "modalidade": self.modalidade,
            "components": {},
            "overall_score": 0.0,
            "status": "evaluated",
        }

        # 1. Avaliar draw_multiplier
        draw_mult = params.get("draw_multiplier", 1.0)
        draw_rate = params.get("base_draw_rate", 0.0)

        draw_eval = "[X]"
        draw_score = 0.0
        if draw_rate > 0.01:  # Modalidades com empates
            if 1.2 <= draw_mult <= 1.6:
                draw_eval = "[OK]"
                draw_score = 1.0
            elif 1.0 <= draw_mult <= 2.0:
                draw_eval = "[~]"
                draw_score = 0.7
            else:
                draw_eval = "[!]"
                draw_score = 0.4
        else:  # Sem empates
            draw_eval = "[OK]" if draw_mult == 1.0 else "[!]"
            draw_score = 1.0 if draw_mult == 1.0 else 0.5

        evaluation["components"]["draw_multiplier"] = {
            "value": draw_mult,
            "base_draw_rate": draw_rate,
            "status": draw_eval,
            "score": draw_score,
            "comment": f"{'Ótimo' if draw_score == 1.0 else 'Razoável' if draw_score >= 0.5 else 'Suspeito'} para taxa de empates {draw_rate:.1%}",
        }

        # 2. Avaliar draw_model (regressão logística)
        draw_model = params.get("draw_model", {})
        intercept = draw_model.get("intercept", 0.0)
        coef_lin = draw_model.get("coef_linear", 0.0)

        model_eval = "[X]"
        model_score = 0.0
        if draw_rate > 0.01:
            if intercept != 0.0 and coef_lin != 0.0:
                model_eval = "[OK]"
                model_score = 1.0
            elif intercept != 0.0 or coef_lin != 0.0:
                model_eval = "[!]"
                model_score = 0.5
            else:
                model_eval = "[X]"
                model_score = 0.0
        else:
            model_eval = "[OK]"
            model_score = 1.0

        evaluation["components"]["draw_model"] = {
            "intercept": intercept,
            "coef_linear": coef_lin,
            "status": model_eval,
            "score": model_score,
            "comment": "Modelo logístico "
            + ("calibrado" if model_score > 0.5 else "não calibrado ou simples"),
        }

        # 3. Avaliar parâmetros de golos
        base_goals = params.get("base_goals", 0.0)
        dispersion_k = params.get("dispersion_k", 0.0)

        goals_eval = "[~]"
        goals_score = 0.8
        if base_goals > 0 and dispersion_k > 0:
            goals_eval = "[OK]"
            goals_score = 1.0

        evaluation["components"]["goals_distribution"] = {
            "base_goals": base_goals,
            "dispersion_k": dispersion_k,
            "status": goals_eval,
            "score": goals_score,
            "comment": f"Distribuição calibrada: {base_goals:.2f} golos/equipa, dispersão={dispersion_k:.2f}",
        }

        # 4. Avaliar parâmetros de margem
        margin_slope = params.get("margin_elo_slope", 0.0)
        margin_intercept = params.get("margin_elo_intercept", 0.0)

        margin_eval = "[~]"
        margin_score = 0.8
        if margin_slope > 0 and margin_intercept > 0:
            margin_eval = "[OK]"
            margin_score = 1.0

        evaluation["components"]["margin_distribution"] = {
            "slope": margin_slope,
            "intercept": margin_intercept,
            "status": margin_eval,
            "score": margin_score,
            "comment": f"Margem varia com ELO: slope={margin_slope:.4f}",
        }

        # Score geral (média ponderada)
        weights = {
            "draw_multiplier": 0.25,
            "draw_model": 0.25,
            "goals_distribution": 0.25,
            "margin_distribution": 0.25,
        }
        overall = sum(
            evaluation["components"][comp]["score"] * weights.get(comp, 0.25)
            for comp in evaluation["components"]
        )
        evaluation["overall_score"] = overall

        return evaluation

    def print_detailed_comparison_report(
        self, comparison_results: Dict, evaluation: Dict = None
    ):
        """
        Imprime relatório detalhado da comparação com avaliação de parâmetros.
        """
        modal = comparison_results.get("modalidade", "?")

        print(f"\n{'='*80}")
        print(f"[RELATORIO] CALIBRACAO COMPLETA - {modal}")
        print(f"{'='*80}")

        # Parte 1: Avaliação de parâmetros
        if evaluation:
            print(f"\n[AVALIACAO] PARAMETROS CALIBRADOS")
            print(f"{'-'*80}")
            print(f"Score Geral: {evaluation['overall_score']:.1%}")
            for comp, details in evaluation["components"].items():
                print(f"\n  {details['status']} {comp.upper()}")
                print(f"     Score: {details['score']:.1%}")
                print(f"     {details['comment']}")
                if comp == "draw_multiplier":
                    print(f"     [multiplier: {details.get('value', 'N/A')}]")
                elif comp == "draw_model":
                    print(
                        f"     [intercept: {details.get('intercept', 0.0):.4f}, coef: {details.get('coef_linear', 0.0):.6f}]"
                    )
                elif comp == "goals_distribution":
                    print(
                        f"     [base: {details.get('base_goals', 0.0):.2f}, dispersao: {details.get('dispersion_k', 0.0):.2f}]"
                    )
                elif comp == "margin_distribution":
                    print(
                        f"     [slope: {details.get('slope', 0.0):.4f}, intercept: {details.get('intercept', 0.0):.2f}]"
                    )

        # Parte 2: Comparação de desempenho
        fixed = comparison_results.get("fixed_model", {})
        calib = comparison_results.get("calibrated_model", {})
        improve = comparison_results.get("improvement", {})

        print(f"\n[COMPARACAO] DESEMPENHO FIXO vs CALIBRADO")
        print(f"{'-'*80}")
        print(f"\n  Metrica                    FIXO         CALIBRADO    MELHORIA")
        print(f"  {'-'*75}")

        # Verificar se há dados de comparação
        if not fixed or not calib:
            print("  [INFO] Comparacao nao executada (sem dados suficientes)")
            print(
                "  [RECOMENDACAO] Executar: python backtest_validation.py --modalidade FUTSAL MASCULINO"
            )
            print(f"{'='*80}\n")
            return

        # Brier Score
        fixed_brier = fixed.get("brier_score_champion", 0)
        calib_brier = calib.get("brier_score_champion", 0)
        improve_brier = improve.get("brier_score", 0)
        print(
            f"  Brier Score                {fixed_brier:.4f}      {calib_brier:.4f}      {improve_brier:+.1%}"
        )

        # RMSE Place
        fixed_rmse_p = fixed.get("rmse_expected_place", 0)
        calib_rmse_p = calib.get("rmse_expected_place", 0)
        improve_rmse_p = improve.get("rmse_expected_place", 0)
        print(
            f"  RMSE Expected Place        {fixed_rmse_p:.2f}        {calib_rmse_p:.2f}        {improve_rmse_p:+.1%}"
        )

        # RMSE Points
        fixed_rmse_pts = fixed.get("rmse_expected_points", 0)
        calib_rmse_pts = calib.get("rmse_expected_points", 0)
        improve_rmse_pts = improve.get("rmse_expected_points", 0)
        print(
            f"  RMSE Expected Points       {fixed_rmse_pts:.2f}        {calib_rmse_pts:.2f}        {improve_rmse_pts:+.1%}"
        )

        # Avaliação final
        print(f"\n{'-'*80}")
        print(f"✅ CONCLUSÃO")
        print(f"{'-'*80}")

        if improve_brier > 0:
            pct_better = improve_brier * 100
            print(f"[OK] Calibracao MELHORA o desempenho em {pct_better:.1f}%")
        elif improve_brier == 0:
            print(f"[~] Calibracao nao altera significativamente o Brier score")
        else:
            pct_worse = abs(improve_brier) * 100
            print(f"[AVISO] Calibracao PIORA o desempenho em {pct_worse:.1f}%")

        if calib_brier < 0.03:
            print(f"[OK] Modelo calibrado eh EXCELENTE (Brier < 0.03)")
        elif calib_brier < 0.05:
            print(f"[OK] Modelo calibrado eh BOM (Brier < 0.05)")
        elif calib_brier < 0.08:
            print(f"[OK] Modelo calibrado eh RAZOAVEL (Brier < 0.08)")
        else:
            print(f"[AVISO] Modelo calibrado precisa de revisao (Brier >= 0.08)")

        print(f"{'='*80}\n")

    def cross_validate_across_epochs(self):
        """Cross-validacao: testa parametros com Brier score por temporada."""
        print(f"\n{'='*80}")
        print(f"[VALIDACAO] Cross-Validacao (Brier Score por Temporada)")
        print(f"{'='*80}")

        if not self.available_seasons or len(self.available_seasons) < 2:
            print(
                f"[!] Apenas {len(self.available_seasons)} temporada(s) - precisa de >= 2"
            )
            return {}

        results = {}
        for season in self.available_seasons:
            try:
                metrics = self.run_backtest_for_season(season, verbose=False)
                if metrics:
                    brier = metrics.get("brier_score_champion", None)
                    if brier is not None:
                        results[season] = brier
                        print(f"{season}: Brier = {brier:.4f}")
                    else:
                        print(f"{season}: [!] Brier score não encontrado")
                else:
                    print(f"{season}: [!] Backtest retornou None")
            except Exception as e:
                print(f"{season}: [X] Erro - {str(e)[:50]}")

        if results:
            brier_vals = list(results.values())
            avg = sum(brier_vals) / len(brier_vals)
            var = max(brier_vals) - min(brier_vals)
            print(f"\nMedia: {avg:.4f} | Variacao: {var:.4f}")

            if var < avg * 0.05:
                print("[OK] Parametros MUITO ESTAVEIS (variacao < 5% da media)")
            elif var < avg * 0.15:
                print("[~] Parametros ESTAVEIS (variacao < 15%)")
            else:
                print("[!] Parametros com variacao notavel (>= 15%)")

        print(f"{'='*80}")
        return results

    def generate_calibration_curves(self):
        """
        Tabela de calibracao: probabilidade predita vs frequencia observada.
        Analisa probabilidades de campeao previstas vs resultados reais.
        """
        print(f"\n{'='*80}")
        print(f"[VALIDACAO] Calibration Curves")
        print(f"{'='*80}")

        if not self.available_seasons:
            print("[!] Sem temporadas disponíveis")
            return {}

        # Usar temporada mais recente com dados de teste
        season = None
        for s in reversed(self.available_seasons):
            training, test, all_games = self.split_season_by_cutoff(s, cutoff_jornada=8)
            if test:
                season = s
                break

        if not season:
            print("[!] Nenhuma temporada com dados de teste suficientes")
            return {}

        print(f"Usando dados de {season}...")

        # Gerar previsões para esta temporada
        training_matches, test_matches, all_matches = self.split_season_by_cutoff(
            season, cutoff_jornada=8
        )

        if not test_matches:
            print(f"[!] Sem jogos de teste para temporada {season}")
            return {}

        # Calcular standings reais
        real_standings = self.calculate_real_final_standings(all_matches)

        # Gerar previsões com parâmetros calibrados
        calibrated_params = self.load_calibrated_params()
        forecasts = self.generate_historical_forecast(
            season, cutoff_jornada=8, calibrated_params=calibrated_params
        )

        if not forecasts:
            print(f"[!] Falha ao gerar previsões")
            return {}

        # Agrupar probabilidades em bins: 0-10%, 10-20%, ... 90-100%
        bins = {f"{i*10}-{(i+1)*10}%": [] for i in range(10)}

        for team, forecast in forecasts.items():
            p_champion = forecast.get("p_champion", 0.0)
            was_champion = (
                1.0 if real_standings.get(team, {}).get("place") == 1 else 0.0
            )

            # Encontrar bin apropriado
            bin_idx = min(int(p_champion * 10), 9)
            bin_name = f"{bin_idx*10}-{(bin_idx+1)*10}%"
            bins[bin_name].append({"pred": p_champion, "obs": was_champion})

        # Exibir resultados
        print(
            f"\n{'Prob.Range':<12} {'Obs.Freq':<10} {'Pred.Freq':<10} {'Diff':<10} {'N':<5}"
        )
        print(f"{'-'*60}")

        diffs = []
        for bin_name in sorted(bins.keys()):
            data = bins[bin_name]
            if not data:
                print(f"{bin_name:<12} {'-':<10} {'-':<10} {'-':<10} {'0':<5}")
                continue

            n = len(data)
            obs_freq = sum(d["obs"] for d in data) / n
            pred_freq = sum(d["pred"] for d in data) / n
            diff = abs(obs_freq - pred_freq)
            diffs.append(diff)

            print(
                f"{bin_name:<12} {obs_freq:.4f}    {pred_freq:.4f}    {diff:.4f}    {n:<5}"
            )

        if diffs:
            avg_diff = sum(diffs) / len(diffs)
            print(f"{'-'*60}")
            print(f"{'Media':<12} {'-':<10} {'-':<10} {avg_diff:.4f}    {'-':<5}")

            if avg_diff < 0.05:
                print("\n[OK] Calibracao EXCELENTE (diferenca media < 0.05)")
            elif avg_diff < 0.10:
                print("\n[~] Calibracao BOA (diferenca media < 0.10)")
            else:
                print("\n[!] Calibracao FRACA (diferenca media >= 0.10)")

        print(f"{'='*80}")
        return bins

    def sensitivity_analysis(self):
        """Analisa impacto de variacao ±10% em parametros calibrados."""
        print(f"\n{'='*80}")
        print(f"[VALIDACAO] Sensitivity Analysis (±10% variacao)")
        print(f"{'='*80}")

        calib_params = self.load_calibrated_params()
        if not calib_params:
            print("[!] Parametros calibrados nao encontrados")
            return {}

        print(f"\nParametros detectados:")
        for key, val in calib_params.items():
            if isinstance(val, (int, float)):
                variation = abs(val * 0.1) if val != 0 else 0.1
                print(f"  {key}: {val:.4f} (variacao ±{variation:.4f})")

        print(f"\nNota: Teste completo requer re-calibracao com variados parametros")
        print(
            f"      Recomenda-se usar run_calibration_pipeline.py com diferentes seeds"
        )

        print(f"{'='*80}")
        return {}

    def calculate_parameter_stability(self):
        """Estabilidade de parametros (intervalo de confianca estimado)."""
        print(f"\n{'='*80}")
        print(f"[VALIDACAO] Parameter Stability")
        print(f"{'='*80}")

        calib_params = self.load_calibrated_params()
        if not calib_params:
            print("[!] Parametros calibrados nao encontrados")
            return {}

        print(f"\nParametros calibrados:")
        print(f"{'-'*60}")

        for key, val in sorted(calib_params.items()):
            if isinstance(val, (int, float)):
                # Estimativa simples de confianca
                std_est = abs(val) * 0.15 if val != 0 else 0.1
                ci_lower = val - (1.96 * std_est)
                ci_upper = val + (1.96 * std_est)

                print(f"{key:<30} = {val:>10.4f}")
                print(f"{'':30}   IC95: [{ci_lower:.4f}, {ci_upper:.4f}]")

        print(f"\nNota: ICs sao estimativas. Para valores precisos use bootstrap")
        print(f"      com run_calibration_pipeline.py em modo iterativo")

        print(f"{'='*80}")
        return {}


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
    parser.add_argument(
        "--compare-calibrated",
        action="store_true",
        help="Comparar modelo fixo vs calibrado (requer calibrator.py executado)",
    )
    parser.add_argument(
        "--season",
        type=str,
        help="Época específica para comparação (ex.: '24_25'). Usado com --compare-calibrated",
    )
    parser.add_argument(
        "--compare-all",
        action="store_true",
        help="Comparar calibracao para TODAS as modalidades (resume ao final)",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Executar TODAS as validacoes avancadas (cross-val, curves, sensitivity, stability)",
    )
    parser.add_argument(
        "--cross-validate",
        action="store_true",
        help="Executar cross-validacao across epochs",
    )
    parser.add_argument(
        "--calibration-curves",
        action="store_true",
        help="Gerar tabelas de calibracao (predicted vs observed)",
    )
    parser.add_argument(
        "--sensitivity",
        action="store_true",
        help="Executar analise de sensibilidade (+/- 10%% variacao)",
    )
    parser.add_argument(
        "--stability",
        action="store_true",
        help="Calcular estabilidade de parametros (intervalo de confianca)",
    )
    args = parser.parse_args()

    # Definir diretório base do projeto (baseado na localização deste script)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)  # Diretório pai de 'src'
    docs_dir = os.path.join(project_dir, "docs")

    # Carregar mapeamento de cursos
    try:
        config_path = os.path.join(docs_dir, "config", "config_cursos.json")
        with open(config_path, encoding="utf-8-sig") as f:
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

    # Modo comparacao all modalidades
    if args.compare_all:
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

        print(f"\n{'='*80}")
        print("AVALIACAO COMPLETA DE CALIBRACAO - TODAS AS MODALIDADES")
        print(f"{'='*80}\n")

        all_evaluations = []

        for modalidade in default_modalidades:
            validator = BacktestValidator(modalidade, course_mapping, docs_dir)
            evaluation = validator.evaluate_calibrated_params()

            if evaluation.get("status") == "evaluated":
                score = evaluation.get("overall_score", 0)
                all_evaluations.append(
                    {"modalidade": modalidade, "score": score, "evaluation": evaluation}
                )
                print(f"  [{score:.0%}] {modalidade}")
            else:
                print(f"  [!] {modalidade} - sem dados")

        # Resumo
        if all_evaluations:
            print(f"\n{'='*80}")
            print("RESUMO")
            print(f"{'='*80}")
            avg_score = sum(e["score"] for e in all_evaluations) / len(all_evaluations)
            print(f"Score medio: {avg_score:.1%}")
            print(
                f"Modalidades calibradas: {len(all_evaluations)}/{len(default_modalidades)}"
            )
            print(f"{'='*80}\n")

        exit(0)

    # Modo comparacao individual
    if args.compare_calibrated:
        if not args.modalidade:
            print("❌ Erro: --compare-calibrated requer especificar --modalidade")
            exit(1)

        validator = BacktestValidator(args.modalidade, course_mapping, docs_dir)

        if not validator.available_seasons:
            print(f"\n⚠️  Sem dados para {args.modalidade}")
            exit(1)

        # Usar época especificada ou a mais recente
        season = args.season if args.season else validator.available_seasons[-1]

        if season not in validator.available_seasons:
            print(f"❌ Época {season} não disponível para {args.modalidade}")
            print(f"   Épocas disponíveis: {', '.join(validator.available_seasons)}")
            exit(1)

        # Avaliar parâmetros calibrados
        evaluation = validator.evaluate_calibrated_params()

        # Executar comparação
        comparison_results = validator.compare_fixed_vs_calibrated(
            season, cutoff_jornada=args.cutoff, verbose=True
        )

        # Imprimir relatório detalhado
        validator.print_detailed_comparison_report(comparison_results, evaluation)

        # Guardar resultados
        output_file = os.path.join(
            docs_dir,
            "output",
            "calibration",
            f"comparison_{args.modalidade}_{season}.json",
        )
        os.makedirs(os.path.join(docs_dir, "output", "calibration"), exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(
                {"comparison": comparison_results, "evaluation": evaluation},
                f,
                indent=2,
                ensure_ascii=False,
            )

        print(f"\n💾 Comparação guardada em: {output_file}")
        exit(0)

    # Modo validacao avancada
    if (
        args.validate
        or args.cross_validate
        or args.calibration_curves
        or args.sensitivity
        or args.stability
    ):
        if not args.modalidade:
            print("[!] Erro: Validacoes requerem especificar --modalidade")
            exit(1)

        validator = BacktestValidator(args.modalidade, course_mapping, docs_dir)

        if not validator.available_seasons:
            print(f"\n[!] Sem dados para {args.modalidade}")
            exit(1)

        # Executar validacoes
        if args.validate or args.cross_validate:
            validator.cross_validate_across_epochs()

        if args.validate or args.calibration_curves:
            validator.generate_calibration_curves()

        if args.validate or args.sensitivity:
            validator.sensitivity_analysis()

        if args.validate or args.stability:
            validator.calculate_parameter_stability()

        print(f"\n[OK] Validacoes completadas para {args.modalidade}")
        exit(0)

    # Rodar backtest para cada modalidade (ou apenas a especificada)
    for modalidade in modalidades:
        validator = BacktestValidator(modalidade, course_mapping, docs_dir)

        if not validator.available_seasons:
            print(f"\n⚠️  Sem dados para {modalidade}")
            continue

        # Rodar backtest para todas as épocas disponíveis
        validator.run_all_available_backtests(cutoff_jornada=args.cutoff)
