import math
import pandas as pd
import os
from enum import Enum
import logging

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    filename="mmr_tacaua.log",
)
logger = logging.getLogger("mmr_tacaua")


class Sport(Enum):
    """Enumeração dos desportos suportados"""

    ANDEBOL = "andebol"
    FUTSAL = "futsal"
    BASQUETE = "basquete"
    VOLEI = "volei"


class SportDetector:
    """Classe para detectar o desporto baseado no nome do arquivo"""

    @staticmethod
    def detect_from_filename(filename):
        """Determina o desporto baseado no nome do arquivo"""
        filename_lower = filename.lower()

        if "andebol" in filename_lower:
            return Sport.ANDEBOL
        elif "futsal" in filename_lower or "futebol" in filename_lower:
            return Sport.FUTSAL
        elif "basquete" in filename_lower:
            return Sport.BASQUETE
        elif "volei" in filename_lower:
            return Sport.VOLEI
        else:
            logger.warning(
                f"Desporto não identificado para arquivo: {filename}. A usar futsal como padrão."
            )
            return Sport.FUTSAL  # default


class PointsCalculator:
    """Calcula pontos baseado no desporto e resultado"""

    @staticmethod
    def calculate(sport, score1, score2, sets1=None, sets2=None):
        """
        Calcula pontos baseado na modalidade esportiva

        Args:
            sport: Enum Sport, representa o desporto
            score1: Pontuação da equipa 1
            score2: Pontuação da equipa 2
            sets1: Sets vencidos pela equipa 1 (para vôlei)
            sets2: Sets vencidos pela equipa 2 (para vôlei)

        Returns:
            Tupla (pontos_equipa1, pontos_equipa2)
        """
        if sport == Sport.ANDEBOL:
            if score1 > score2:
                return 3, 1  # vitória, derrota
            elif score1 < score2:
                return 1, 3  # derrota, vitória
            else:
                return 2, 2  # empate

        elif sport == Sport.FUTSAL:
            if score1 > score2:
                return 3, 0  # vitória, derrota
            elif score1 < score2:
                return 0, 3  # derrota, vitória
            else:
                return 1, 1  # empate

        elif sport == Sport.BASQUETE:
            if score1 > score2:
                return 2, 0  # vitória, derrota
            elif score1 < score2:
                return 0, 2  # derrota, vitória
            else:
                return 1, 1  # empate

        elif sport == Sport.VOLEI:
            # Precisa dos sets para vôlei
            if sets1 is None or sets2 is None:
                # Se não tiver sets, assume baseado no score
                if score1 > score2:
                    return 3, 0  # assume 2-0
                else:
                    return 0, 3  # assume 0-2
            else:
                if sets1 == 2 and sets2 == 0:
                    return 3, 0
                elif sets1 == 2 and sets2 == 1:
                    return 2, 1
                elif sets1 == 1 and sets2 == 2:
                    return 1, 2
                elif sets1 == 0 and sets2 == 2:
                    return 0, 3
                else:
                    logger.warning(f"Combinação de sets não prevista: {sets1}-{sets2}")
                    return 0, 0  # caso não previsto


class StandingsCalculator:
    """Calcula tabelas de classificação para competições esportivas"""

    def __init__(self, df, sport, teams):
        """
        Inicializa o calculador de classificação

        Args:
            df: DataFrame com os jogos
            sport: Desporto da competição (enum Sport)
            teams: Dicionário com as equipas e seus ratings
        """
        self.df = df.copy()
        self.sport = sport
        self.teams = teams

        # Identificar colunas de divisão e grupo - corrigido para ser mais robusto
        self.div_col = next(
            (col for col in df.columns if "divis" in col.lower().replace("ã", "a")),
            None,
        )
        self.group_col = next(
            (col for col in df.columns if "grupo" in col.lower().replace("ã", "a")),
            None,
        )

        # Log para depuração
        logger.info(
            f"Colunas detectadas - Divisão: {self.div_col}, Grupo: {self.group_col}"
        )

    def calculate_standings(self):
        """Calcula classificação considerando divisões e grupos"""
        # Filtrar apenas jogos da fase de grupos
        group_phase_mask = (
            ~self.df["Jornada"].astype(str).str.upper().str.startswith("E")
        )
        df_group = self.df[group_phase_mask].copy()

        # Se não houver divisões nem grupos, criar uma classificação única
        if not self.div_col and not self.group_col:
            return self._calculate_single_standings(df_group, self.teams)

        # Determinar como agrupar as equipas
        group_key_col = self._create_group_key_column(df_group)

        # Calcular classificações por grupo
        return self._calculate_group_standings(df_group, group_key_col)

    def _create_group_key_column(self, df_group):
        """Cria uma coluna-chave para agrupar as equipas"""
        if self.div_col and self.group_col:
            # Usar combinação divisão + grupo
            df_group["Group_Key"] = (
                df_group[self.div_col].astype(int).astype(str)
                + "_"
                + df_group[self.group_col].astype(str)
            )
            return "Group_Key"
        elif self.group_col:
            # Usar apenas grupo
            return self.group_col
        else:
            # Caso tenha divisão, mas não tenha grupos explícitos
            if self.div_col:
                # Criar grupos inferidos por divisão
                df_group["Inferred_Group"] = (
                    df_group[self.div_col].astype(int).astype(str)
                )
                logger.info(
                    f"Grupos inferidos a partir da coluna de divisão: {self.div_col}"
                )
                logger.info(
                    f"Valores únicos: {df_group[self.div_col].dropna().unique().tolist()}"
                )
                return "Inferred_Group"
            else:
                # Sem divisões nem grupos, usar grupo único
                df_group["Inferred_Group"] = "Group_1"
                return "Inferred_Group"

    def _calculate_group_standings(self, df_group, group_key_col):
        """Calcula classificações separadas por grupo"""
        # Verificar se group_key_col existe como coluna
        if group_key_col not in df_group.columns:
            logger.warning(
                f"Coluna de agrupamento '{group_key_col}' não encontrada. A usar classificação única."
            )
            return self._calculate_single_standings(df_group, self.teams)

        # Obter grupos únicos
        groups = df_group[group_key_col].dropna().unique()

        if not len(groups):
            logger.info("Nenhum grupo encontrado. A calcular classificação única.")
            return self._calculate_single_standings(df_group, self.teams)

        all_standings = []

        for group in sorted(groups):
            # Filtrar jogos do grupo atual
            df_grp = df_group[df_group[group_key_col] == group]

            # Obter equipas deste grupo
            teams_grp = set()
            for col in ["Equipa 1", "Equipa 2"]:
                teams_grp.update(df_grp[col].dropna().unique())

            # Calcular classificação para este grupo
            grp_standings = self._calculate_single_standings(df_grp, teams_grp)

            # Adicionar informações do grupo
            if self.div_col and group_key_col == "Inferred_Group":
                # Para grupos inferidos a partir da divisão
                try:
                    # Tentar converter para inteiro se for número
                    div_value = int(float(group))
                    grp_standings["Divisao"] = div_value
                except ValueError:
                    # Se não for conversível para número, manter como string
                    grp_standings["Divisao"] = group
            elif self.div_col and group_key_col == "Group_Key":
                # Extrair divisão e grupo da chave combinada
                div_num, grp_num = str(group).split("_")
                try:
                    grp_standings["Divisao"] = int(float(div_num))
                except ValueError:
                    grp_standings["Divisao"] = div_num
                grp_standings["Grupo"] = grp_num
            elif self.group_col:
                grp_standings["Grupo"] = group

            all_standings.append(grp_standings)

        # Combinar todos os grupos
        if all_standings:
            result = pd.concat(all_standings, ignore_index=True)

            # Reordenar colunas
            cols = self._get_columns_order(result)
            return result[cols]
        else:
            return self._calculate_single_standings(df_group, self.teams)

    def _get_columns_order(self, result):
        """Determina a ordem correta das colunas baseada nas colunas disponíveis"""
        cols = []

        # Garantir que Divisao sempre venha primeiro quando existir
        if "Divisao" in result.columns:
            cols.append("Divisao")

        # Adicionar Grupo se existir
        if "Grupo" in result.columns:
            cols.append("Grupo")

        # Posição e Equipa sempre estarão presentes
        cols.extend(["Posicao", "Equipa"])

        # Adicionar as demais colunas
        remaining_cols = [col for col in result.columns if col not in cols]
        return cols + remaining_cols

    def _calculate_standings_with_inferred_groups(self, df_group):
        """Calcula classificações inferindo grupos pela conectividade dos jogos"""
        divisions = df_group[self.div_col].dropna().unique()

        all_standings = []

        # Criar coluna para grupos inferidos
        df_group["Inferred_Group"] = None

        for division in sorted(divisions):
            # Filtrar jogos da divisão atual
            df_div = df_group[df_group[self.div_col] == division]

            # Inferir grupos pela conectividade dos jogos
            groups = self._infer_groups_from_games(df_div)

            # Atribuir números de grupo às equipas
            for group_idx, teams_in_group in enumerate(groups, 1):
                # Atualizar coluna de grupo inferido para estas equipas
                for team in teams_in_group:
                    mask = (df_group["Equipa 1"] == team) | (
                        df_group["Equipa 2"] == team
                    )
                    df_group.loc[mask, "Inferred_Group"] = f"{division}_{group_idx}"

        # Garantir que todas as linhas tenham um valor de grupo
        df_group["Inferred_Group"].fillna("Unknown", inplace=True)

        return "Inferred_Group"  # Retornar nome da coluna

    def _infer_groups_from_games(self, df_div):
        """Infere grupos baseado na conectividade dos jogos"""
        # Criar grafo de conectividade
        teams = set()
        connections = set()

        # Coletar equipas e conexões
        for _, row in df_div.iterrows():
            team1, team2 = row.get("Equipa 1"), row.get("Equipa 2")

            if pd.notna(team1) and pd.notna(team2):
                teams.add(team1)
                teams.add(team2)
                connections.add((team1, team2))

        # Encontrar componentes conectados (grupos)
        groups = []
        remaining_teams = teams.copy()

        while remaining_teams:
            # Começar novo grupo com uma equipa
            current_group = {remaining_teams.pop()}
            changed = True

            # Expandir grupo até não haver mais conexões
            while changed:
                changed = False
                for team1, team2 in connections:
                    if team1 in current_group and team2 in remaining_teams:
                        current_group.add(team2)
                        remaining_teams.discard(team2)
                        changed = True
                    elif team2 in current_group and team1 in remaining_teams:
                        current_group.add(team1)
                        remaining_teams.discard(team1)
                        changed = True

            groups.append(current_group)

        return groups

    def _calculate_single_standings(self, df_group, teams):
        """Calcula classificação para um único grupo/divisão"""
        # Inicializar estatísticas para cada equipa
        stats = self._initialize_team_stats(teams)

        # Processar cada jogo para atualizar as estatísticas
        self._process_games_for_stats(df_group, stats)

        # Calcular diferenças de gols e sets
        self._calculate_differences(stats)

        # Converter para DataFrame
        standings_df = pd.DataFrame.from_dict(stats, orient="index").reset_index()
        standings_df.rename(columns={"index": "Equipa"}, inplace=True)

        # Aplicar critérios de desempate
        standings_df = self._apply_tiebreaking_criteria(standings_df, df_group)

        # Reordenar colunas
        cols = self._get_standings_columns()

        return standings_df[cols]

    def _initialize_team_stats(self, teams):
        """Inicializa estatísticas para cada equipa"""
        stats = {}
        for team in teams:
            stats[team] = {
                "pontos": 0,
                "jogos": 0,
                "vitorias": 0,
                "empates": 0,
                "derrotas": 0,
                "golos_marcados": 0,
                "golos_sofridos": 0,
                "sets_ganhos": 0,
                "sets_perdidos": 0,
                "faltas_comparencia": 0,
            }
        return stats

    def _process_games_for_stats(self, df_group, stats):
        """Processa os jogos para atualizar as estatísticas das equipas"""
        for _, row in df_group.iterrows():
            team1 = row.get("Equipa 1")
            team2 = row.get("Equipa 2")

            # Verificar dados válidos
            if (
                pd.isna(team1)
                or pd.isna(team2)
                or team1 not in stats
                or team2 not in stats
            ):
                continue

            try:
                score1 = int(row.get("Golos 1"))
                score2 = int(row.get("Golos 2"))
                sets1 = int(row.get("Sets 1")) if pd.notna(row.get("Sets 1")) else None
                sets2 = int(row.get("Sets 2")) if pd.notna(row.get("Sets 2")) else None
            except (ValueError, TypeError):
                logger.warning(
                    f"Dados inválidos: {row.get('Golos 1')}-{row.get('Golos 2')}"
                )
                continue

            # Verificar falta de comparência
            falta_comparencia = row.get("Falta de Comparência", "")
            has_absence = (
                pd.notna(falta_comparencia) and str(falta_comparencia).strip() != ""
            )

            if has_absence:
                absent_team = str(falta_comparencia).strip()
                if absent_team in stats:
                    stats[absent_team]["faltas_comparencia"] += 1

            # Calcular pontos
            points1, points2 = PointsCalculator.calculate(
                self.sport, score1, score2, sets1, sets2
            )

            # Atualizar estatísticas básicas
            self._update_basic_stats(
                stats, team1, team2, points1, points2, score1, score2
            )

            # Atualizar estatísticas de sets se aplicável
            if sets1 is not None and sets2 is not None:
                stats[team1]["sets_ganhos"] += sets1
                stats[team1]["sets_perdidos"] += sets2
                stats[team2]["sets_ganhos"] += sets2
                stats[team2]["sets_perdidos"] += sets1

            # Atualizar vitórias/empates/derrotas
            self._update_win_draw_loss(stats, team1, team2, score1, score2)

    def _update_basic_stats(
        self, stats, team1, team2, points1, points2, score1, score2
    ):
        """Atualiza estatísticas básicas das equipas"""
        # Pontos e jogos
        stats[team1]["pontos"] += points1
        stats[team2]["pontos"] += points2
        stats[team1]["jogos"] += 1
        stats[team2]["jogos"] += 1

        # Gols
        stats[team1]["golos_marcados"] += score1
        stats[team1]["golos_sofridos"] += score2
        stats[team2]["golos_marcados"] += score2
        stats[team2]["golos_sofridos"] += score1

    def _update_win_draw_loss(self, stats, team1, team2, score1, score2):
        """Atualiza contagem de vitórias, empates e derrotas"""
        if score1 > score2:
            stats[team1]["vitorias"] += 1
            stats[team2]["derrotas"] += 1
        elif score1 < score2:
            stats[team1]["derrotas"] += 1
            stats[team2]["vitorias"] += 1
        else:
            stats[team1]["empates"] += 1
            stats[team2]["empates"] += 1

    def _calculate_differences(self, stats):
        """Calcula diferenças de gols e sets para todas as equipas"""
        for team in stats:
            stats[team]["diferenca_golos"] = (
                stats[team]["golos_marcados"] - stats[team]["golos_sofridos"]
            )
            stats[team]["diferenca_sets"] = (
                stats[team]["sets_ganhos"] - stats[team]["sets_perdidos"]
            )

    def _apply_tiebreaking_criteria(self, standings_df, df_games):
        """Aplica critérios de desempate sequenciais conforme regulamento"""
        # Ordenação inicial por pontos e faltas
        standings_df = standings_df.sort_values(
            ["pontos", "faltas_comparencia"], ascending=[False, True]
        )

        # Encontrar grupos de equipas empatadas em pontos
        tied_groups = self._find_tied_groups(standings_df)

        # Resolver empates para cada grupo
        final_standings = self._resolve_all_ties(standings_df, tied_groups, df_games)

        # Adicionar posições
        final_standings["Posicao"] = range(1, len(final_standings) + 1)

        return final_standings

    def _find_tied_groups(self, standings_df):
        """Encontra grupos de equipas empatadas em pontos"""
        tied_groups = []
        current_group = []
        current_points = None

        for idx, row in standings_df.iterrows():
            if current_points is None or row["pontos"] == current_points:
                current_group.append(row["Equipa"])
                current_points = row["pontos"]
            else:
                if len(current_group) > 1:
                    tied_groups.append(current_group.copy())
                current_group = [row["Equipa"]]
                current_points = row["pontos"]

        # Adicionar último grupo se tiver mais de 1 equipa
        if len(current_group) > 1:
            tied_groups.append(current_group)

        return tied_groups

    def _resolve_all_ties(self, standings_df, tied_groups, df_games):
        """Resolve todos os empates identificados"""
        final_standings = []
        processed_teams = set()

        for idx, row in standings_df.iterrows():
            team = row["Equipa"]
            if team in processed_teams:
                continue

            # Verificar se esta equipa está num grupo empatado
            tied_group = next((group for group in tied_groups if team in group), None)

            if tied_group:
                # Resolver empate usando confrontos diretos
                resolved_group = self._resolve_head_to_head_tiebreak(
                    tied_group, df_games, standings_df
                )
                final_standings.extend(resolved_group)
                processed_teams.update(tied_group)
            else:
                # equipa não empatada, adicionar diretamente
                final_standings.append(row)

        # Recriar DataFrame com ordem correta
        return pd.DataFrame(final_standings)

    def _resolve_head_to_head_tiebreak(self, tied_teams, df_games, original_standings):
        """Resolve empate usando confrontos diretos entre equipas empatadas"""
        # Filtrar apenas jogos entre equipas empatadas
        head_to_head_games = df_games[
            (df_games["Equipa 1"].isin(tied_teams))
            & (df_games["Equipa 2"].isin(tied_teams))
        ]

        # Inicializar estatísticas do confronto direto
        h2h_stats = self._initialize_h2h_stats(tied_teams)

        # Processar jogos do confronto direto
        self._process_h2h_games(h2h_stats, head_to_head_games)

        # Calcular diferenças para desempate
        self._calculate_h2h_differences(h2h_stats)

        # Criar tabela de classificação do confronto direto
        h2h_df = self._create_h2h_standings(h2h_stats)

        # Criar resultado final com dados originais e critérios completos
        return self._create_final_h2h_result(h2h_df, original_standings)

    def _initialize_h2h_stats(self, tied_teams):
        """Inicializa estatísticas para confronto direto"""
        h2h_stats = {}
        for team in tied_teams:
            h2h_stats[team] = {
                "pontos_h2h": 0,
                "faltas_h2h": 0,
                "golos_marcados_h2h": 0,
                "golos_sofridos_h2h": 0,
                "sets_ganhos_h2h": 0,
                "sets_perdidos_h2h": 0,
            }
        return h2h_stats

    def _process_h2h_games(self, h2h_stats, head_to_head_games):
        """Processa jogos do confronto direto para estatísticas"""
        for _, game in head_to_head_games.iterrows():
            team1 = game["Equipa 1"]
            team2 = game["Equipa 2"]

            # Validar dados do jogo
            try:
                score1 = int(game.get("Golos 1"))
                score2 = int(game.get("Golos 2"))
            except (ValueError, TypeError):
                continue

            sets1 = game.get("Sets 1")
            sets2 = game.get("Sets 2")
            if pd.notna(sets1) and pd.notna(sets2):
                try:
                    sets1 = int(sets1)
                    sets2 = int(sets2)
                except (ValueError, TypeError):
                    sets1 = sets2 = None
            else:
                sets1 = sets2 = None

            # Verificar falta de comparência
            falta = game.get("Falta de Comparência", "")
            if pd.notna(falta) and str(falta).strip():
                absent_team = str(falta).strip()
                if absent_team in h2h_stats:
                    h2h_stats[absent_team]["faltas_h2h"] += 1

            # Calcular e atualizar pontos
            points1, points2 = PointsCalculator.calculate(
                self.sport, score1, score2, sets1, sets2
            )
            h2h_stats[team1]["pontos_h2h"] += points1
            h2h_stats[team2]["pontos_h2h"] += points2

            # Atualizar gols
            h2h_stats[team1]["golos_marcados_h2h"] += score1
            h2h_stats[team1]["golos_sofridos_h2h"] += score2
            h2h_stats[team2]["golos_marcados_h2h"] += score2
            h2h_stats[team2]["golos_sofridos_h2h"] += score1

            # Atualizar sets se disponíveis
            if sets1 is not None and sets2 is not None:
                h2h_stats[team1]["sets_ganhos_h2h"] += sets1
                h2h_stats[team1]["sets_perdidos_h2h"] += sets2
                h2h_stats[team2]["sets_ganhos_h2h"] += sets2
                h2h_stats[team2]["sets_perdidos_h2h"] += sets1

    def _calculate_h2h_differences(self, h2h_stats):
        """Calcula diferenças para critérios de desempate"""
        for team in h2h_stats:
            h2h_stats[team]["diferenca_golos_h2h"] = (
                h2h_stats[team]["golos_marcados_h2h"]
                - h2h_stats[team]["golos_sofridos_h2h"]
            )
            h2h_stats[team]["diferenca_sets_h2h"] = (
                h2h_stats[team]["sets_ganhos_h2h"]
                - h2h_stats[team]["sets_perdidos_h2h"]
            )

    def _create_h2h_standings(self, h2h_stats):
        """Cria tabela de classificação do confronto direto"""
        h2h_df = pd.DataFrame.from_dict(h2h_stats, orient="index").reset_index()
        h2h_df.rename(columns={"index": "Equipa"}, inplace=True)

        # Ordenar por critérios de confronto direto
        return h2h_df.sort_values(
            [
                "pontos_h2h",
                "faltas_h2h",
                "diferenca_sets_h2h",
                "diferenca_golos_h2h",
                "golos_marcados_h2h",
            ],
            ascending=[False, True, False, False, False],
        )

    def _create_final_h2h_result(self, h2h_df, original_standings):
        """Cria resultado final do desempate usando os dados originais e aplicando critérios adicionais quando necessário"""
        # Mesclar dados de h2h com os dados originais para ter todos os critérios disponíveis
        merged_df = pd.merge(
            h2h_df, original_standings, on="Equipa", suffixes=("_h2h", "")
        )

        # Aplicar todos os critérios de desempate na ordem correta:
        # 1. Pontos no confronto direto
        # 2. Faltas de comparência no confronto direto
        # 3. Diferença de sets no confronto direto (para vôlei)
        # 4. Diferença de gols no confronto direto
        # 5. Gols marcados no confronto direto
        # 6. Diferença de sets total (para vôlei)
        # 7. Diferença de gols total
        # 8. Gols marcados total
        sort_columns = [
            "pontos_h2h",
            "faltas_h2h",
            "diferenca_sets_h2h",
            "diferenca_golos_h2h",
            "golos_marcados_h2h",
            "diferenca_sets",
            "diferenca_golos",
            "golos_marcados",
        ]

        # Filtrar apenas colunas que existem
        valid_columns = [col for col in sort_columns if col in merged_df.columns]
        # Define ascending (False para pontos e stats positivas, True para faltas)
        ascending_values = []
        for col in valid_columns:
            if "faltas" in col:
                ascending_values.append(True)  # Menor é melhor
            else:
                ascending_values.append(False)  # Maior é melhor

        # Ordenar com algoritmo estável para garantir consistência
        sorted_df = merged_df.sort_values(
            by=valid_columns,
            ascending=ascending_values,
            kind="stable",  # Usa algoritmo estável de ordenação
        )

        # Criar lista final
        result_teams = []
        for _, row in sorted_df.iterrows():
            team = row["Equipa"]
            # Usar os dados originais da equipa para o resultado final
            original_row = (
                original_standings[original_standings["Equipa"] == team].iloc[0].copy()
            )
            result_teams.append(original_row)

        return result_teams

    def _get_standings_columns(self):
        """Retorna as colunas a serem usadas na classificação"""
        cols = [
            "Posicao",
            "Equipa",
            "pontos",
            "jogos",
            "vitorias",
            "empates",
            "derrotas",
            "golos_marcados",
            "golos_sofridos",
            "diferenca_golos",
            "faltas_comparencia",
        ]

        if self.sport == Sport.VOLEI:
            cols.extend(["sets_ganhos", "sets_perdidos", "diferenca_sets"])

        return cols


class InterGroupAdjuster:
    """Calcula ajustes de ELO baseados em confrontos entre grupos"""

    def __init__(self, df, teams, sport):
        """Inicializa o ajustador inter-grupos"""
        self.df = df
        self.teams = teams
        self.sport = sport

    def calculate_adjustments(self):
        """Calcula ajustes de ELO baseados em confrontos inter-grupos nos playoffs"""
        # Identificar coluna de grupo
        group_col = next((col for col in self.df.columns if "Grupo" in col), None)

        if not group_col:
            return {}  # Sem grupos, sem ajustes

        # Filtrar jogos de playoffs e fase de grupos
        playoffs_mask = self.df["Jornada"].astype(str).str.upper().str.startswith("E")
        df_playoffs = self.df[playoffs_mask]

        if len(df_playoffs) == 0:
            return {}  # Sem playoffs, sem ajustes

        group_phase_mask = ~playoffs_mask
        df_groups = self.df[group_phase_mask]

        # Identificar grupos e criar mapeamento equipa->grupo
        groups, team_to_group = self._get_groups_and_mapping(df_groups, group_col)

        if len(groups) < 2:
            return {}  # Precisa de pelo menos 2 grupos

        # Identificar equipas dos playoffs
        playoff_teams = self._get_playoff_teams(df_playoffs)

        # Contar vitórias entre grupos nos playoffs
        inter_group_results = self._count_inter_group_wins(df_playoffs, team_to_group)

        # Calcular classificações finais por grupo
        group_standings = self._get_group_standings(team_to_group, playoff_teams)

        # Calcular ajustes ELO
        return self._calculate_elo_adjustments(
            groups, group_standings, inter_group_results
        )

    def _get_groups_and_mapping(self, df_groups, group_col):
        """Obtém grupos únicos e mapeamento equipa->grupo"""
        groups = df_groups[group_col].dropna().unique()

        # Criar mapeamento equipa -> grupo
        team_to_group = {}
        team_cols = ["Equipa 1", "Equipa 2"]

        # Usar vetorização para melhorar performance
        for team_col in team_cols:
            valid_rows = df_groups[[team_col, group_col]].dropna()
            team_group_dict = dict(zip(valid_rows[team_col], valid_rows[group_col]))
            team_to_group.update(team_group_dict)

        return groups, team_to_group

    def _get_playoff_teams(self, df_playoffs):
        """Identifica equipas que participaram dos playoffs"""
        playoff_teams = set()
        for team_col in ["Equipa 1", "Equipa 2"]:
            playoff_teams.update(df_playoffs[team_col].dropna().unique())
        return playoff_teams

    def _count_inter_group_wins(self, df_playoffs, team_to_group):
        """Conta vitórias entre grupos nos playoffs"""
        inter_group_results = {}

        # Inicializar contadores para cada grupo
        for group in set(team_to_group.values()):
            inter_group_results[group] = {"wins": 0, "total": 0}

        # Processar cada jogo
        for _, row in df_playoffs.iterrows():
            team1 = row.get("Equipa 1")
            team2 = row.get("Equipa 2")

            if (
                pd.isna(team1)
                or pd.isna(team2)
                or team1 not in team_to_group
                or team2 not in team_to_group
            ):
                continue

            group1 = team_to_group[team1]
            group2 = team_to_group[team2]

            # Só contar se forem grupos diferentes
            if group1 != group2:
                try:
                    score1 = int(row.get("Golos 1"))
                    score2 = int(row.get("Golos 2"))

                    # Incrementar contadores de jogos
                    inter_group_results[group1]["total"] += 1
                    inter_group_results[group2]["total"] += 1

                    # Contar vitórias
                    if score1 > score2:
                        inter_group_results[group1]["wins"] += 1
                    elif score2 > score1:
                        inter_group_results[group2]["wins"] += 1
                except (ValueError, TypeError):
                    continue

        return inter_group_results

    def _get_group_standings(self, team_to_group, playoff_teams):
        """Obtém classificações por grupo excluindo equipas dos playoffs"""
        calculator = StandingsCalculator(self.df, self.sport, self.teams)
        real_standings = calculator.calculate_standings()

        # Agrupar por grupo (apenas equipas que NÃO foram aos playoffs)
        group_standings = {}

        for _, row in real_standings.iterrows():
            team = row["Equipa"]
            if team in team_to_group and team not in playoff_teams:
                grupo = team_to_group[team]
                if grupo not in group_standings:
                    group_standings[grupo] = []
                group_standings[grupo].append(
                    {"team": team, "position": row["Posicao"]}
                )

        # Ordenar equipas por posição dentro de cada grupo
        for grupo in group_standings:
            group_standings[grupo].sort(key=lambda x: x["position"])

        return group_standings

    def _calculate_elo_adjustments(self, groups, group_standings, inter_group_results):
        """Calcula ajustes ELO entre equipas de mesma posição"""
        elo_adjustments = {}

        # Só aplicar se houver jogos inter-grupos
        total_inter_group_games = (
            sum(result["total"] for result in inter_group_results.values()) // 2
        )
        if total_inter_group_games == 0:
            return {}

        # Calcular proporções de vitórias para cada grupo
        group_proportions = {
            grupo: (
                inter_group_results[grupo]["wins"] / inter_group_results[grupo]["total"]
                if inter_group_results[grupo]["total"] > 0
                else 0.5
            )
            for grupo in inter_group_results
        }

        # Para cada posição, simular jogo entre grupos
        group_list = sorted(groups)
        max_positions = max(len(group_standings.get(g, [])) for g in group_list)

        for pos in range(max_positions):
            teams_at_position = {}

            # Coletar equipas nesta posição de cada grupo
            for grupo in group_list:
                if grupo in group_standings and pos < len(group_standings[grupo]):
                    team = group_standings[grupo][pos]["team"]
                    teams_at_position[grupo] = team

            # Simular jogos entre todas as combinações de grupos
            self._simulate_inter_group_matches(
                group_list, teams_at_position, group_proportions, elo_adjustments
            )

        return elo_adjustments

    def _simulate_inter_group_matches(
        self, group_list, teams_at_position, group_proportions, elo_adjustments
    ):
        """Simula confrontos entre equipas de diferentes grupos para ajuste de ELO"""
        if len(teams_at_position) < 2:
            return

        # Iterar por todas as combinações de grupos
        for i, grupo1 in enumerate(group_list):
            if grupo1 not in teams_at_position:
                continue

            for grupo2 in group_list[i + 1 :]:
                if grupo2 not in teams_at_position:
                    continue

                team1 = teams_at_position[grupo1]
                team2 = teams_at_position[grupo2]

                if team1 not in self.teams or team2 not in self.teams:
                    continue

                # Usar proporções como scores
                score1 = group_proportions.get(grupo1, 0.5)
                score2 = group_proportions.get(grupo2, 0.5)

                # Calcular ajuste de ELO
                self._apply_elo_adjustment(
                    team1, team2, score1, score2, elo_adjustments
                )

    def _apply_elo_adjustment(self, team1, team2, score1, score2, elo_adjustments):
        """Aplica ajuste de ELO entre duas equipas"""
        team1_elo = self.teams[team1]
        team2_elo = self.teams[team2]

        # Calcular expectativas
        expected1 = 1 / (1 + 10 ** ((team2_elo - team1_elo) / 250))
        expected2 = 1 / (1 + 10 ** ((team1_elo - team2_elo) / 250))

        # Calcular mudanças de ELO
        elo_change1 = score1 - expected1
        elo_change2 = score2 - expected2

        # Aplicar fator K fixo para ajustes inter-grupos
        k_factor = 100
        elo_delta1 = round(k_factor * elo_change1)
        elo_delta2 = round(k_factor * elo_change2)

        # Armazenar ajustes
        if team1 not in elo_adjustments:
            elo_adjustments[team1] = 0
        if team2 not in elo_adjustments:
            elo_adjustments[team2] = 0

        elo_adjustments[team1] += elo_delta1
        elo_adjustments[team2] += elo_delta2


class EloRatingSystem:
    """Sistema de cálculo de ratings ELO para competições esportivas"""

    def __init__(self):
        """Inicializa o sistema de ratings ELO"""
        self.k_base = 100  # Fator K base

    def calculate_season_phase_multiplier(
        self,
        game_number,
        total_group_games,
        game_number_before_winter=None,
        jornada=None,
    ):
        """
        Calcula o multiplicador de fase da temporada

        Args:
            game_number: Número do jogo na temporada para a equipa
            total_group_games: Total de jogos na fase de grupos
            game_number_before_winter: Número de jogos antes da parada de inverno
            jornada: Identificador da jornada (rodada)

        Returns:
            Multiplicador para o fator K
        """
        # Verificar se é jogo do terceiro lugar
        if jornada and str(jornada).upper() == "E3L":
            return 0.75

        # Normalizar o número do jogo para uma escala de 0 a 8
        game_number_scaled = game_number / total_group_games * 8

        # Se o número do jogo for maior que o total de jogos da fase de grupos, a equipa está na fase a eliminar
        if game_number_scaled > 8:
            return 1.5
        elif game_number_before_winter is not None:
            # Escalar o número de jogos para o bonus após a paragem de inverno ser máximo
            game_number_after_winter_break = game_number - game_number_before_winter
            game_number_after_winter_break_scaled = (
                5 + (game_number_after_winter_break - 1) / total_group_games * 8
            )
            if game_number_after_winter_break_scaled < 8 * (1 / 3) + 5:
                return (
                    1 / math.log(4 * (game_number_after_winter_break_scaled - 4), 16)
                ) ** (1 / 2)
            return 1
        # Início da temporada
        elif game_number_scaled < 8 * (1 / 3):
            # Escalar o número de jogos para o bonus no início da temporada ser máximo
            game_number_start_scaled = 1 + (game_number - 1) / total_group_games * 8
            return 1 / math.log(4 * game_number_start_scaled, 16)
        else:
            return 1

    def calculate_score_proportion(self, score1, score2):
        """
        Calcula o multiplicador baseado na diferença de pontuação

        Args:
            score1: Pontuação da equipa 1
            score2: Pontuação da equipa 2

        Returns:
            Multiplicador de proporção de pontuação
        """
        if score2 == 0:
            score2 = 0.5
        if score1 == 0:
            score1 = 0.5
        return max((score1 / score2), (score2 / score1)) ** (1 / 10)

    def calculate_elo_change(self, team1_elo, team2_elo, outcome):
        """
        Calcula a mudança de ELO baseada no resultado

        Args:
            team1_elo: Rating ELO da equipa 1
            team2_elo: Rating ELO da equipa 2
            outcome: Resultado do jogo (1=vitória time1, 2=vitória time2, 0=empate)

        Returns:
            Tupla com (mudança_elo_time1, mudança_elo_time2)
        """
        expected1 = 1 / (1 + 10 ** ((team2_elo - team1_elo) / 250))
        expected2 = 1 / (1 + 10 ** ((team1_elo - team2_elo) / 250))

        if outcome == 1:
            score1, score2 = 1, 0
        elif outcome == 2:
            score1, score2 = 0, 1
        else:
            score1, score2 = 0.5, 0.5

        elo_change1 = score1 - expected1
        elo_change2 = score2 - expected2

        return elo_change1, elo_change2

    def process_tournament(self, df, filename):
        """
        Processa um torneio completo calculando ratings ELO

        Args:
            df: DataFrame com os jogos do torneio
            filename: Nome do arquivo para determinar o desporto

        Returns:
            Tuple com (teams_elo, elo_history, detailed_rows)
        """
        # Determinar o desporto
        sport = SportDetector.detect_from_filename(filename)

        # Inicializar ratings das equipas
        teams = self._initialize_team_ratings(df)

        # Calcular classificação real
        standings_calculator = StandingsCalculator(df, sport, teams)
        real_standings = standings_calculator.calculate_standings()

        # Processar jogos e calcular ELO
        elo_history, detailed_rows = self._process_games(df, teams, sport)

        # Aplicar ajustes inter-grupos
        self._apply_inter_group_adjustments(
            df, teams, sport, elo_history, detailed_rows
        )

        return teams, elo_history, detailed_rows, real_standings

    def _initialize_team_ratings(self, df):
        """Inicializa os ratings ELO para todas as equipas"""
        teams = {}

        # Identificar coluna de divisão
        div_col = next((col for col in df.columns if "Divisão" in col), None)

        if div_col:
            # Inicializar equipas apenas nas linhas da fase de grupos
            group_phase_mask = (
                ~df["Jornada"].astype(str).str.upper().str.startswith("E")
            )
            df_group = df[group_phase_mask]

            # Processar equipa 1
            teams1 = df_group.dropna(subset=["Equipa 1"])
            for _, row in teams1.iterrows():
                team = row["Equipa 1"]
                if team not in teams:
                    div = row.get(div_col)
                    teams[team] = self._get_initial_rating(div)

            # Processar equipa 2
            teams2 = df_group.dropna(subset=["Equipa 2"])
            for _, row in teams2.iterrows():
                team = row["Equipa 2"]
                if team not in teams:
                    div = row.get(div_col)
                    teams[team] = self._get_initial_rating(div)
        else:
            # Sem divisões, inicializar todas as equipas com rating 750
            for team_col in ["Equipa 1", "Equipa 2"]:
                unique_teams = df[team_col].dropna().unique()
                for team in unique_teams:
                    if team not in teams:
                        teams[team] = 750

        return teams

    def _get_initial_rating(self, division):
        """Determina o rating inicial baseado na divisão"""
        if division == 1:
            return 1000
        elif division == 2:
            return 500
        else:
            return 750

    def _process_games(self, df, teams, sport):
        """Processa os jogos e calcula as mudanças de ELO"""
        # Inicializar histórico de ELO
        elo_history = {team: [elo] for team, elo in teams.items()}

        # Contadores por equipa
        game_count = {team: 0 for team in teams}
        absence_count = {team: 0 for team in teams}

        # Calcular total de jogos da fase de grupos por equipa
        is_group_phase = ~df["Jornada"].astype(str).str.upper().str.startswith("E")
        total_group_games_per_team = self._count_team_games(df, teams, is_group_phase)

        # Identificar parada de inverno
        winter_break_index, games_before_winter = self._identify_winter_break(df, teams)

        # Lista para dados detalhados
        detailed_rows = []

        # Processar cada jogo
        for index, row in df.iterrows():
            team1, team2 = row.get("Equipa 1"), row.get("Equipa 2")

            # Validar dados
            if not self._is_valid_game(row, teams):
                continue

            try:
                score1 = int(row.get("Golos 1"))
                score2 = int(row.get("Golos 2"))
            except (ValueError, TypeError):
                continue

            # Verificar falta de comparência
            falta_comparencia = row.get("Falta de Comparência", "")
            has_absence = (
                pd.notna(falta_comparencia) and str(falta_comparencia).strip() != ""
            )

            if has_absence:
                absent_team = str(falta_comparencia).strip()
                if absent_team in absence_count:
                    absence_count[absent_team] += 1

            # Determinar resultado
            if score1 > score2:
                outcome = 1
            elif score2 > score1:
                outcome = 2
            else:
                outcome = 0

            # ELO antes do jogo
            elo_before1 = teams[team1]
            elo_before2 = teams[team2]

            # Atualizar contadores de jogos
            game_count[team1] += 1
            game_count[team2] += 1

            # Calcular multiplicadores
            phase_multipliers = self._calculate_phase_multipliers(
                row,
                game_count,
                total_group_games_per_team,
                winter_break_index,
                games_before_winter,
            )

            proportion_multiplier = self.calculate_score_proportion(score1, score2)

            # Calcular fatores K e mudanças de ELO
            k_factors, elo_changes, elo_deltas = self._calculate_elo_factors(
                elo_before1,
                elo_before2,
                outcome,
                phase_multipliers,
                proportion_multiplier,
                has_absence,
            )

            # Registrar dados detalhados
            detailed_row = self._create_detailed_row(
                row,
                elo_before1,
                elo_before2,
                phase_multipliers,
                proportion_multiplier,
                k_factors,
                elo_changes,
                elo_deltas,
                has_absence,
            )
            detailed_rows.append(detailed_row)

            # Atualizar ratings ELO
            teams[team1] += elo_deltas[0]
            teams[team2] += elo_deltas[1]

            # Atualizar histórico
            elo_history[team1].append(teams[team1])
            elo_history[team2].append(teams[team2])

        # Garantir que todas as listas tenham o mesmo tamanho
        self._equalize_history_length(elo_history)

        return elo_history, detailed_rows

    def _count_team_games(self, df, teams, is_group_phase):
        """Conta o total de jogos por equipa na fase de grupos"""
        total_games = {}
        for team in teams:
            jogos1 = ((df["Equipa 1"] == team) & is_group_phase).sum()
            jogos2 = ((df["Equipa 2"] == team) & is_group_phase).sum()
            total_games[team] = jogos1 + jogos2
        return total_games

    def _identify_winter_break(self, df, teams):
        """Identifica a parada de inverno baseada na mudança de ano"""
        winter_break_index = None
        games_before_winter = {team: 0 for team in teams}

        # Tentar converter coluna de data
        try:
            anos = pd.to_datetime(df["Dia"], errors="coerce").dt.year

            # Buscar mudança de ano
            for i in range(1, len(anos)):
                if (
                    pd.notna(anos[i])
                    and pd.notna(anos[i - 1])
                    and anos[i] > anos[i - 1]
                ):
                    winter_break_index = i
                    break

            # Se encontrou parada, contar jogos antes da pausa
            if winter_break_index is not None:
                for team in teams:
                    jogos1 = (
                        (df["Equipa 1"] == team) & (df.index < winter_break_index)
                    ).sum()
                    jogos2 = (
                        (df["Equipa 2"] == team) & (df.index < winter_break_index)
                    ).sum()
                    games_before_winter[team] = jogos1 + jogos2
        except Exception as e:
            logger.warning(f"Erro ao identificar parada de inverno: {e}")

        return winter_break_index, games_before_winter

    def _is_valid_game(self, row, teams):
        """Verifica se um jogo tem dados válidos para cálculo de ELO"""
        team1 = row.get("Equipa 1")
        team2 = row.get("Equipa 2")
        score1 = row.get("Golos 1")
        score2 = row.get("Golos 2")

        return (
            pd.notna(team1)
            and pd.notna(team2)
            and pd.notna(score1)
            and pd.notna(score2)
            and team1 in teams
            and team2 in teams
        )

    def _calculate_phase_multipliers(
        self,
        row,
        game_count,
        total_group_games,
        winter_break_index,
        games_before_winter,
    ):
        """Calcula os multiplicadores de fase da temporada para ambas equipas"""
        team1 = row["Equipa 1"]
        team2 = row["Equipa 2"]
        jornada = str(row.get("Jornada", ""))
        is_elimination = jornada.upper().startswith("E")

        # Verificar se está após a parada de inverno
        after_winter_break1 = (
            winter_break_index is not None
            and game_count[team1] > games_before_winter[team1]
        )
        after_winter_break2 = (
            winter_break_index is not None
            and game_count[team2] > games_before_winter[team2]
        )

        # Calcular multiplicadores
        if is_elimination:
            phase_multiplier1 = self.calculate_season_phase_multiplier(
                game_count[team1], total_group_games[team1], None, jornada
            )
            phase_multiplier2 = self.calculate_season_phase_multiplier(
                game_count[team2], total_group_games[team2], None, jornada
            )
        else:
            phase_multiplier1 = self.calculate_season_phase_multiplier(
                game_count[team1],
                total_group_games[team1],
                games_before_winter[team1] if after_winter_break1 else None,
                jornada,
            )
            phase_multiplier2 = self.calculate_season_phase_multiplier(
                game_count[team2],
                total_group_games[team2],
                games_before_winter[team2] if after_winter_break2 else None,
                jornada,
            )

        return (phase_multiplier1, phase_multiplier2)

    def _calculate_elo_factors(
        self,
        elo_before1,
        elo_before2,
        outcome,
        phase_multipliers,
        proportion_multiplier,
        has_absence,
    ):
        """Calcula os fatores para mudança de ELO"""
        phase_multiplier1, phase_multiplier2 = phase_multipliers

        # Calcular fatores K
        k_factor1 = self.k_base * phase_multiplier1 * proportion_multiplier
        k_factor2 = self.k_base * phase_multiplier2 * proportion_multiplier

        # Calcular mudanças de ELO
        elo_change1, elo_change2 = self.calculate_elo_change(
            elo_before1, elo_before2, outcome
        )

        # Calcular deltas finais
        elo_delta1 = round(k_factor1 * elo_change1)
        elo_delta2 = round(k_factor2 * elo_change2)

        # Zerar se houver falta de comparência
        if has_absence:
            elo_delta1 = elo_delta2 = 0

        return (
            (k_factor1, k_factor2),
            (elo_change1, elo_change2),
            (elo_delta1, elo_delta2),
        )

    def _create_detailed_row(
        self,
        row,
        elo_before1,
        elo_before2,
        phase_multipliers,
        proportion_multiplier,
        k_factors,
        elo_changes,
        elo_deltas,
        has_absence,
    ):
        """Cria uma linha detalhada com informações do cálculo de ELO"""
        phase_multiplier1, phase_multiplier2 = phase_multipliers
        k_factor1, k_factor2 = k_factors
        elo_change1, elo_change2 = elo_changes
        elo_delta1, elo_delta2 = elo_deltas

        return {
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
            "Elo Depois 2": elo_before2 + elo_delta2,
            "Has Absence": has_absence,
            "Inter Group Adjustment 1": 0,  # Inicializar como 0
            "Inter Group Adjustment 2": 0,  # Inicializar como 0
            "Final Elo 1": elo_before1
            + elo_delta1,  # Será atualizado se houver ajustes
            "Final Elo 2": elo_before2
            + elo_delta2,  # Será atualizado se houver ajustes
        }

    def _equalize_history_length(self, elo_history):
        """Garante que todas as listas de histórico tenham o mesmo tamanho"""
        max_len = max(len(v) for v in elo_history.values())
        for team in elo_history:
            while len(elo_history[team]) < max_len:
                elo_history[team].append(elo_history[team][-1])

    def _apply_inter_group_adjustments(
        self, df, teams, sport, elo_history, detailed_rows
    ):
        """Aplica ajustes inter-grupos se necessário"""
        # Verificar se tem divisões
        div_col = next((col for col in df.columns if "Divisão" in col), None)

        if div_col:
            return  # Não aplicar ajustes se houver divisões

        # Calcular ajustes
        adjuster = InterGroupAdjuster(df, teams, sport)
        inter_group_adjustments = adjuster.calculate_adjustments()

        if not inter_group_adjustments:
            return

        # Aplicar ajustes e registrar na história
        for team, adjustment in inter_group_adjustments.items():
            if team in teams and adjustment != 0:
                teams[team] += adjustment
                elo_history[team].append(teams[team])

        # Equalizar tamanhos novamente após ajustes
        self._equalize_history_length(elo_history)

        # Adicionar linhas especiais para os ajustes inter-grupos
        self._add_adjustment_rows(inter_group_adjustments, teams, detailed_rows)

    def _add_adjustment_rows(self, inter_group_adjustments, teams, detailed_rows):
        """Adiciona linhas nos detalhes para os ajustes inter-grupos"""
        # Adicionar cabeçalho
        adjustment_header = {
            "Jornada": "Inter-Group Adjustments",
            "Dia": "",
            "Hora": "",
            "Local": "",
            "Equipa 1": "",
            "Golos 1": "",
            "Golos 2": "",
            "Equipa 2": "",
            "Grupo": "",
            "Falta de Comparência": "",
            "Elo Antes 1": "",
            "Elo Antes 2": "",
            "Season Phase 1": "",
            "Season Phase 2": "",
            "Proportional Multiplier": "",
            "K Factor 1": "",
            "K Factor 2": "",
            "Elo Change 1": "",
            "Elo Change 2": "",
            "Elo Delta 1": "",
            "Elo Delta 2": "",
            "Elo Depois 1": "",
            "Elo Depois 2": "",
            "Has Absence": "",
            "Inter Group Adjustment 1": "",
            "Inter Group Adjustment 2": "",
            "Final Elo 1": "",
            "Final Elo 2": "",
        }
        detailed_rows.append(adjustment_header)

        # Adicionar uma linha para cada equipa com ajuste
        for team, adjustment in inter_group_adjustments.items():
            if adjustment != 0:
                elo_before_adjustment = teams[team] - adjustment
                adjustment_detail_row = {
                    "Jornada": "Inter-Group",
                    "Dia": "",
                    "Hora": "",
                    "Local": "",
                    "Equipa 1": team,
                    "Golos 1": "",
                    "Golos 2": "",
                    "Equipa 2": "",
                    "Grupo": "",
                    "Falta de Comparência": "",
                    "Elo Antes 1": elo_before_adjustment,
                    "Elo Antes 2": "",
                    "Season Phase 1": 1.0,
                    "Season Phase 2": "",
                    "Proportional Multiplier": 1.0,
                    "K Factor 1": 100.0,
                    "K Factor 2": "",
                    "Elo Change 1": adjustment / 100.0,
                    "Elo Change 2": "",
                    "Elo Delta 1": adjustment,
                    "Elo Delta 2": "",
                    "Elo Depois 1": teams[team],
                    "Elo Depois 2": "",
                    "Has Absence": False,
                    "Inter Group Adjustment 1": adjustment,
                    "Inter Group Adjustment 2": "",
                    "Final Elo 1": teams[team],
                    "Final Elo 2": "",
                }
                detailed_rows.append(adjustment_detail_row)


class TournamentProcessor:
    """Processa todos os torneios na pasta especificada"""

    def __init__(self, input_dir="csv_modalidades", output_dir="elo_ratings"):
        """
        Inicializa o processador de torneios

        Args:
            input_dir: Diretório de entrada contendo arquivos CSV
            output_dir: Diretório de saída para os resultados
        """
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.elo_system = EloRatingSystem()

        # Criar diretório de saída se não existir
        os.makedirs(output_dir, exist_ok=True)

    def process_all_tournaments(self):
        """Processa todos os arquivos CSV na pasta de entrada"""
        processed_files = []
        failed_files = []

        for filename in sorted(os.listdir(self.input_dir)):
            if not filename.endswith(".csv"):
                continue

            filepath = os.path.join(self.input_dir, filename)
            logger.info(f"A processar arquivo: {filename}")

            try:
                # Tentar diferentes codificações
                encodings = ["utf-8", "latin1", "cp1252", "iso-8859-1"]
                df = None

                for encoding in encodings:
                    try:
                        df = pd.read_csv(filepath, encoding=encoding)
                        logger.info(
                            f"Arquivo carregado com sucesso usando codificação {encoding}. Shape: {df.shape}"
                        )
                        break
                    except UnicodeDecodeError:
                        continue

                if df is None:
                    logger.error(
                        f"Não foi possível decodificar o arquivo {filename} com nenhuma codificação."
                    )
                    failed_files.append((filename, "Problema de codificação"))
                    continue

                # Limpar nomes de colunas para remover caracteres especiais
                df.columns = [
                    col.replace("ç", "c").replace("ã", "a").replace("é", "e")
                    for col in df.columns
                ]

                # Processar o torneio
                teams, elo_history, detailed_rows, real_standings = (
                    self.elo_system.process_tournament(df, filename)
                )

                # Salvar resultados
                self._save_tournament_results(
                    filename, teams, elo_history, detailed_rows, real_standings
                )

                logger.info(f"Arquivo {filename} processado com sucesso")
                processed_files.append(filename)

            except Exception as e:
                logger.exception(f"Erro ao processar {filename}: {str(e)}")
                failed_files.append((filename, str(e)))

        # Resumo final
        logger.info(
            f"Processamento concluído. Arquivos processados: {len(processed_files)}"
        )
        if failed_files:
            logger.warning(f"Arquivos com falha: {len(failed_files)}")
            for failed_file, error in failed_files:
                logger.warning(f"  - {failed_file}: {error}")

        return processed_files, failed_files

    def _save_tournament_results(
        self, filename, teams, elo_history, detailed_rows, real_standings
    ):
        """Salva os resultados do processamento de um torneio"""
        base_name = os.path.splitext(filename)[0]

        try:
            # Salvar classificação real
            if isinstance(real_standings, pd.DataFrame):
                # Converter a coluna Divisao para inteiro quando existir
                if "Divisao" in real_standings.columns:
                    real_standings["Divisao"] = real_standings["Divisao"].astype(int)

                real_standings.to_csv(
                    os.path.join(self.output_dir, f"classificacao_{filename}"),
                    index=False,
                )
            else:
                logger.warning(f"Classificação não disponível para {filename}")

            # Salvar histórico de ELO
            elo_df = self._format_elo_history(elo_history)
            elo_df.to_csv(os.path.join(self.output_dir, f"elo_{filename}"), index=False)

            # Salvar detalhes dos jogos
            detailed_df = pd.DataFrame(detailed_rows)
            detailed_df.to_csv(
                os.path.join(self.output_dir, f"detalhe_{filename}"), index=False
            )

            logger.info(f"Resultados salvos para {filename}")
        except Exception as e:
            logger.error(
                f"Erro ao salvar resultados para {filename}: {e}", exc_info=True
            )

    def _format_elo_history(self, elo_history):
        """Formata o histórico de ELO para salvar em CSV"""
        # Criar DataFrame
        elo_df = pd.DataFrame(elo_history)

        # Ordenar colunas pelo rating ELO final (última linha)
        last_row = elo_df.tail(1)
        sorted_columns = (
            last_row.T.iloc[:, 0].sort_values(ascending=False).index.tolist()
        )

        # Reordenar colunas
        return elo_df[sorted_columns]


def main():
    """Função principal do programa"""
    try:
        logger.info("A iniciar processamento de torneios")
        processor = TournamentProcessor()
        processor.process_all_tournaments()
        logger.info("Processamento concluído com sucesso")
    except Exception as e:
        logger.error(f"Erro no processamento: {str(e)}", exc_info=True)


if __name__ == "__main__":
    main()
