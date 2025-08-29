import math
import pandas as pd
import os
import re

def season_phase(game_number, total_group_games, game_number_before_winter=None):
    # Normalizar o número do jogo para uma escala de 0 a 8
    game_number_scaled = game_number/total_group_games * 8
    # Se o número do jogo for maior que o total de jogos da fase de grupos, a equipa está na fase a eliminar
    if game_number_scaled > 8:
        return 1.5
    elif game_number_before_winter is not None:
        # Escalar o número de jogos para o bonus após a paragem de inverno ser máximo
        game_number_after_winter_break = game_number - game_number_before_winter
        game_number_after_winter_break_scaled = 5 + (game_number_after_winter_break - 1) / total_group_games * 8
        if game_number_after_winter_break_scaled < 8 * (1/3) + 5:
            return (1 / math.log(4 * (game_number_after_winter_break_scaled - 4), 16))  ** (1/2)
        return 1
    #inicio da temporada
    elif game_number_scaled < 8 * (1/3):
        # Escalar o número de jogos para o bonus no início da temporada ser máximo
        game_number_start_scaled = 1 + (game_number - 1) / total_group_games * 8
        return (1 / math.log(4 * game_number_start_scaled, 16))
    else:
        return 1

def score_proportion(score1, score2):
    if score2 == 0:
        score2 = 0.5
    if score1 == 0:
        score1 = 0.5
    return max((score1 / score2), (score2 / score1)) ** (1/10)

def elo_change(team1_elo, team2_elo, outcome):
    expected1 = 1 / (1 + 10 ** ((team2_elo - team1_elo) / 250))
    expected2 = 1 / (1 + 10 ** ((team1_elo - team2_elo) / 250))

    if outcome == 1:
        score1, score2 = 1, 0
    elif outcome == 2:
        score1, score2 = 0, 1
    else:
        score1, score2 = 0.5, 0.5
    elo_change1 = (score1 - expected1)
    elo_change2 = (score2 - expected2)
    return elo_change1, elo_change2

__main__ = "__main__"

if __name__ == "__main__":
    #ler os ficheiros csv da pasta csv_modalidades
    input_dir = "csv_modalidades"
    output_dir = "elo_ratings"
    os.makedirs(output_dir, exist_ok=True)
    for filename in os.listdir(input_dir):
        if filename.endswith(".csv"):
            filepath = os.path.join(input_dir, filename)
            df = pd.read_csv(filepath)
            teams = {}
            # identificar coluna de divisão
            div_col = None
            for col in df.columns:
                if "Divisão" in col:
                    div_col = col
                    break

            if div_col:
                # Inicializar equipas apenas nas linhas da fase de grupos
                group_phase_mask = ~df["Jornada"].astype(str).str.upper().str.startswith("E")
                df_group = df[group_phase_mask]
                for team in df_group["Equipa 1"].unique():
                    if team not in teams:
                        divs = df_group[df_group["Equipa 1"] == team][div_col].values
                        if len(divs) > 0:
                            div = divs[0]
                            if div == 1:
                                teams[team] = 1000
                            elif div == 2:
                                teams[team] = 500
                            else:
                                teams[team] = 750
                        else:
                            teams[team] = 750
                for team in df_group["Equipa 2"].unique():
                    if team not in teams:
                        divs = df_group[df_group["Equipa 2"] == team][div_col].values
                        if len(divs) > 0:
                            div = divs[0]
                            if div == 1:
                                teams[team] = 1000
                            elif div == 2:
                                teams[team] = 500
                            else:
                                teams[team] = 750
                        else:
                            teams[team] = 750
            else:
                for team in df["Equipa 1"].unique():
                    if team not in teams:
                        teams[team] = 750
                for team in df["Equipa 2"].unique():
                    if team not in teams:
                        teams[team] = 750

            
            #calcular elo para cada jogo
            elo_history = {team: [elo] for team, elo in teams.items()}
            # contador de jogos por equipa
            game_count = {team: 0 for team in teams}
            # considerar apenas jornadas da fase de grupos para o total de jogos
            is_group_phase = ~df["Jornada"].astype(str).str.upper().str.startswith("E")
            total_group_games_per_team = {}
            for team in teams:
                jogos1 = ((df["Equipa 1"] == team) & is_group_phase).sum()
                jogos2 = ((df["Equipa 2"] == team) & is_group_phase).sum()
                total_group_games_per_team[team] = jogos1 + jogos2
            # identificar paragem de inverno
            anos = pd.to_datetime(df["Dia"], errors="coerce").dt.year
            winter_break_index = None
            for i in range(1, len(anos)):
                if pd.notna(anos[i]) and pd.notna(anos[i-1]) and anos[i] > anos[i-1]:
                    winter_break_index = i
                    break

            # dicionário para guardar número de jogos antes da pausa de inverno por equipa
            games_before_winter = {team: 0 for team in teams}
            # primeiro, contar jogos antes da pausa para cada equipa
            if winter_break_index is not None:
                for team in teams:
                    jogos1 = ((df["Equipa 1"] == team) & (df.index < winter_break_index)).sum()
                    jogos2 = ((df["Equipa 2"] == team) & (df.index < winter_break_index)).sum()
                    games_before_winter[team] = jogos1 + jogos2

            # lista para guardar dados detalhados dos jogos
            detailed_rows = []
            for index, row in df.iterrows():
                # só processa se tiver equipas e golos válidos
                team1 = row.get("Equipa 1", None)
                team2 = row.get("Equipa 2", None)
                score1 = row.get("Golos 1", None)
                score2 = row.get("Golos 2", None)
                if pd.isna(team1) or pd.isna(team2) or pd.isna(score1) or pd.isna(score2):
                    continue
                try:
                    score1 = int(score1)
                    score2 = int(score2)
                except ValueError:
                    continue
                if team1 not in teams or team2 not in teams:
                    continue
                if score1 > score2:
                    outcome = 1
                elif score2 > score1:
                    outcome = 2
                else:
                    outcome = 0
                # elo antes do jogo
                elo_before1 = teams[team1]
                elo_before2 = teams[team2]
                # atualizar contador de jogos individual
                game_count[team1] += 1
                game_count[team2] += 1
                # identificar se o jogo é da fase a eliminar
                jornada = str(row.get("Jornada", ""))
                is_elimination = jornada.upper().startswith("E")
                # identificar se o jogo é depois da paragem de inverno
                after_winter_break1 = winter_break_index is not None and game_count[team1] > games_before_winter[team1]
                after_winter_break2 = winter_break_index is not None and game_count[team2] > games_before_winter[team2]
                # passar número de jogos antes da pausa individualmente
                if is_elimination:
                    phase_multiplier1 = season_phase(game_count[team1], total_group_games_per_team[team1], None)
                    phase_multiplier2 = season_phase(game_count[team2], total_group_games_per_team[team2], None)
                else:
                    phase_multiplier1 = season_phase(game_count[team1], total_group_games_per_team[team1], games_before_winter[team1] if after_winter_break1 else None)
                    phase_multiplier2 = season_phase(game_count[team2], total_group_games_per_team[team2], games_before_winter[team2] if after_winter_break2 else None)
                proportion_multiplier = score_proportion(score1, score2)
                k_factor1 = 100 * phase_multiplier1 * proportion_multiplier
                k_factor2 = 100 * phase_multiplier2 * proportion_multiplier
                elo_change1, elo_change2 = elo_change(elo_before1, elo_before2, outcome)
                elo_delta1 = round(k_factor1 * elo_change1)
                elo_delta2 = round(k_factor2 * elo_change2)
                # salvar dados detalhados
                detailed_rows.append({
                    **row,
                    "Elo Antes 1": elo_before1,
                    "Elo Antes 2": elo_before2,
                    "Season Phase 1": phase_multiplier1,
                    "Season Phase 2": phase_multiplier2,
                    "Proportional Multiplier": proportion_multiplier,
                    "K Factor 1": k_factor1,
                    "K Factor 2": k_factor2,
                    "Elo Change 1": elo_change1,
                    "Elo Change 2": elo_change2,
                    "Elo Delta 1": elo_delta1,
                    "Elo Delta 2": elo_delta2,
                    "Elo Depois 1": elo_before1 + elo_delta1,
                    "Elo Depois 2": elo_before2 + elo_delta2
                })
                teams[team1] += elo_delta1
                teams[team2] += elo_delta2
                elo_history[team1].append(teams[team1])
                elo_history[team2].append(teams[team2])
            # garantir que todas as listas tenham o mesmo tamanho
            max_len = max(len(v) for v in elo_history.values())
            for team in elo_history:
                while len(elo_history[team]) < max_len:
                    elo_history[team].append(elo_history[team][-1])  # repete o último valor

            elo_df = pd.DataFrame(elo_history)
            # Ordenar por pontos finais (última linha de cada equipa)
            last_row = elo_df.tail(1)
            sorted_columns = last_row.T.iloc[:, 0].sort_values(ascending=False).index.tolist()
            elo_df = elo_df[sorted_columns]
            elo_df.to_csv(os.path.join(output_dir, f"elo_{filename}"), index=False)
            # Salvar folha detalhada dos jogos
            detailed_df = pd.DataFrame(detailed_rows)
            detailed_df.to_csv(os.path.join(output_dir, f"detalhe_{filename}"), index=False)