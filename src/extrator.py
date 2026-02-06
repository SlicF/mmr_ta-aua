import pandas as pd
import warnings
import os
import re
import shutil
import hashlib
import json
import logging
from datetime import datetime
import requests
from openpyxl import load_workbook
from pathlib import Path
from typing import Dict, Tuple, Optional, List

warnings.simplefilter(action="ignore", category=FutureWarning)


def get_file_hash(filepath: str) -> Optional[str]:
    """Calcula o hash MD5 de um arquivo"""
    hash_md5 = hashlib.md5()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except FileNotFoundError:
        return None


def files_are_identical(file1: str, file2: str) -> bool:
    """Verifica se dois arquivos são idênticos comparando seus hashes"""
    return get_file_hash(file1) == get_file_hash(file2)


def extract_season_from_filename(filename: str) -> str:
    """Extrai a época/temporada do nome do arquivo Excel"""
    # Procura padrões como "24_25", "2024_25", "24-25", "2024-25", etc.
    import re

    # Padrão para capturar anos no formato XX_XX ou XXXX_XX
    pattern = r"(\d{2,4})[_-](\d{2})"
    match = re.search(pattern, filename)

    if match:
        year1, year2 = match.groups()
        # Se o primeiro ano tem 4 dígitos, usa os últimos 2
        if len(year1) == 4:
            year1 = year1[-2:]
        return f"{year1}_{year2}"

    # Se não encontrar o padrão, tenta extrair apenas o ano
    year_pattern = r"(\d{4})"
    year_match = re.search(year_pattern, filename)
    if year_match:
        year = year_match.group(1)
        return year[-2:]  # Retorna os últimos 2 dígitos

    return ""  # Retorna string vazia se não encontrar nada


def normalize_results_url(url: str) -> str:
    """Normaliza links comuns (Google Sheets/Drive, OneDrive/SharePoint) para download direto em XLSX quando possível."""
    if not url:
        return url

    try:
        lower = url.lower()

        # Google Sheets -> exportar como xlsx
        if "docs.google.com/spreadsheets" in lower:
            # Formato: https://docs.google.com/spreadsheets/d/<ID>/edit#... -> export?format=xlsx
            m = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
            if m:
                file_id = m.group(1)
                return f"https://docs.google.com/spreadsheets/d/{file_id}/export?format=xlsx"

        # Google Drive file -> uc?export=download
        if "drive.google.com" in lower:
            m = re.search(r"/file/d/([a-zA-Z0-9-_]+)/", url)
            if m:
                file_id = m.group(1)
                return f"https://drive.google.com/uc?export=download&id={file_id}"
            m = re.search(r"[?&]id=([a-zA-Z0-9-_]+)", url)
            if m:
                file_id = m.group(1)
                return f"https://drive.google.com/uc?export=download&id={file_id}"

        # OneDrive curto 1drv.ms -> ?download=1
        if "1drv.ms" in lower:
            return url + ("&download=1" if "?" in url else "?download=1")

        # OneDrive/SharePoint -> adicionar download=1
        if "sharepoint.com" in lower or "onedrive.live.com" in lower:
            return url + ("&download=1" if "?" in url else "?download=1")

    except Exception as e:
        logging.error(f"Erro ao normalizar URL '{url}': {e}", exc_info=True)

    return url


def download_results_excel(url: str, dest_dir: Optional[Path] = None) -> Path:
    """Descarrega o ficheiro de resultados para o diretório atual (ou dado) e devolve o caminho."""
    dest_dir = dest_dir or Path(".")
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Nome base a partir do URL
    basename = Path(re.sub(r"[?#].*$", "", url)).name or "Resultados_Taca_UA.xlsx"
    # Garantir extensão .xlsx
    if not basename.lower().endswith(".xlsx"):
        basename += ".xlsx"

    target = dest_dir / basename

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    with requests.get(url, headers=headers, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(target, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

    return target


def _parse_season_tokens(text: str) -> Optional[Tuple[int, int]]:
    """Extrai tokens de época do texto, devolvendo (ano_inicial, ano_final) em forma completa (ex.: 2024, 2025)."""
    if not text:
        return None
    m = re.search(r"(\d{2,4})[_-](\d{2})", text)
    if not m:
        return None
    y1, y2 = m.groups()
    try:
        y1i = int(y1[-2:])  # usar últimos 2 dígitos se vier 4
        y2i = int(y2)
        # Normalizar para base 2000 para ordenação consistente
        start = 2000 + y1i if y1i < 100 else y1i
        end = 2000 + y2i if y2i < 100 else y2i
        # Se o intervalo de dois dígitos cruza o século (ex.: 99_00), somar 100 ao ano final
        # Regra clara: quando end < start, end += 100
        if end < start:
            end += 100
        return (start, end)
    except Exception:
        return None


def detect_latest_season_from_sheet_names(sheet_names: List[str]) -> Optional[str]:
    """Deteta a época mais recente com base nos nomes das folhas (ex.: '... 24_25')."""
    best: Optional[Tuple[int, int]] = None
    for name in sheet_names:
        tokens = _parse_season_tokens(str(name))
        if tokens:
            if best is None or tokens > best:
                best = tokens
    if not best:
        return None
    # Voltar a formato curto 24_25
    y1_short = str(best[0])[-2:]
    y2_short = str(best[1])[-2:]
    return f"{y1_short}_{y2_short}"


def choose_sheets_for_season(
    sheet_names: List[str], season: Optional[str]
) -> List[str]:
    """Filtra folhas a processar pela época. Se nenhuma época for encontrada, devolve todas."""
    if not season:
        # Ver se pelo menos alguma folha tem época; se sim, escolher a mais recente
        detected = detect_latest_season_from_sheet_names(sheet_names)
        if not detected:
            return list(sheet_names)
        season = detected

    # Usar regex com word boundaries para evitar falsos positivos
    pattern = re.compile(r"\b" + re.escape(season) + r"\b", re.IGNORECASE)
    selected = [s for s in sheet_names if pattern.search(str(s))]
    # Se não encontrar nenhuma com a época explícita, processar todas (compatibilidade)
    return selected if selected else list(sheet_names)


def current_season_token(today: Optional[datetime] = None) -> str:
    """Calcula a época atual no formato 'YY_YY' com base na data atual.

    Regra: épocas começam em agosto. De ago a dez -> ano_atual_ano+1; de jan a jul -> ano-1_ano.
    """
    d = today or datetime.today()
    year = d.year
    month = d.month
    if month >= 8:
        y1 = year % 100
        y2 = (year + 1) % 100
    else:
        y1 = (year - 1) % 100
        y2 = year % 100
    return f"{y1:02d}_{y2:02d}"


def validate_and_fix_date_for_season(date_val, season: str) -> datetime:
    """Valida e corrige datas que estão fora do intervalo esperado para a época.

    Época desportiva: setembro do primeiro ano até junho do segundo ano.
    Se a data estiver fora deste intervalo, tenta corrigir trocando mês 01 por 10.

    Args:
        date_val: Data a validar (datetime ou Timestamp)
        season: Época no formato 'YY_YY' (ex: '25_26')

    Returns:
        Data corrigida se necessário, ou a data original se estiver válida
    """
    if not isinstance(date_val, (datetime, pd.Timestamp)):
        return date_val

    if not season or "_" not in season:
        return date_val

    try:
        # Extrair anos da época
        parts = season.split("_")
        year1 = 2000 + int(parts[0])  # Ex: 25 -> 2025
        year2 = 2000 + int(parts[1])  # Ex: 26 -> 2026

        # Definir intervalo válido: setembro do year1 até junho do year2
        start_date = datetime(year1, 9, 1)  # 1 de setembro
        end_date = datetime(year2, 6, 30)  # 30 de junho

        # Verificar se a data está no intervalo válido
        if start_date <= date_val <= end_date:
            return date_val  # Data válida, não precisa correção

        # Data fora do intervalo - tentar corrigir
        # Caso 1: mês 01 (janeiro) do year1 em vez de 10 (outubro) do year1
        # Ex: 2025-01-27 deveria ser 2025-10-27 para época 25_26
        if date_val.month == 1 and date_val.year == year1:
            corrected = date_val.replace(month=10)
            print(
                f"  ⚠️  Data corrigida: {date_val.strftime('%Y-%m-%d')} → {corrected.strftime('%Y-%m-%d')} (janeiro → outubro)"
            )
            return corrected

        # Caso 2: mês 01 (janeiro) do year2 em vez de 10 (outubro) do year1
        # (menos provável, mas possível se o ano também estiver errado)
        if date_val.month == 1 and date_val.year == year2:
            # Trocar janeiro do year2 por outubro do year1
            corrected = date_val.replace(year=year1, month=10)
            print(
                f"  ⚠️  Data corrigida: {date_val.strftime('%Y-%m-%d')} → {corrected.strftime('%Y-%m-%d')} (janeiro year2 → outubro year1)"
            )
            return corrected

        # Caso 3: mês 10 (outubro) em vez de 01 (janeiro) - verificar se faz sentido
        if date_val.month == 10 and date_val.year == year1:
            # Verificar se deveria ser janeiro do year2
            candidate = date_val.replace(year=year2, month=1)
            if candidate <= end_date:
                # Só corrige se a data resultante ainda estiver no intervalo
                print(
                    f"  ⚠️  Data corrigida: {date_val.strftime('%Y-%m-%d')} → {candidate.strftime('%Y-%m-%d')} (outubro year1 → janeiro year2)"
                )
                return candidate

        # Outros casos: apenas avisar mas não corrigir automaticamente
        print(
            f"  ⚠️  Data fora do intervalo esperado ({start_date.strftime('%Y-%m-%d')} a {end_date.strftime('%Y-%m-%d')}): {date_val.strftime('%Y-%m-%d')}"
        )
        return date_val

    except Exception as e:
        print(f"  ⚠️  Erro ao validar data: {e}")
        return date_val


class ExcelProcessor:
    """Classe para processar ficheiros Excel de resultados desportivos."""

    def __init__(
        self,
        file_path: str,
        output_dir: str = "../docs/output/csv_modalidades",
        season_override: Optional[str] = None,
        sheets_to_process: Optional[List[str]] = None,
    ):
        self.file_path = Path(file_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.xls = pd.ExcelFile(file_path)

        # Extrai a época do nome do arquivo
        self.season = season_override or extract_season_from_filename(
            str(self.file_path)
        )
        # Fallback: tentar detetar pelas folhas; se ainda assim vazio, usar época corrente
        if not self.season:
            try:
                detected = detect_latest_season_from_sheet_names(
                    list(map(str, self.xls.sheet_names))
                )
            except Exception:
                detected = None
            self.season = detected or current_season_token()

        # Lista de folhas alvo (opcional)
        self._sheets_to_process = sheets_to_process

        # Padrões regex compilados para melhor performance
        self.divisao_pattern = re.compile(r"(\d)ª DIVISÃO")
        self.grupo_pattern = re.compile(r"GRUPO [A-Z]")

        # Cabeçalhos padrão
        self.base_headers = [
            "Jornada",
            "Dia",
            "Hora",
            "Local",
            "Equipa 1",
            "Golos 1",
            "Golos 2",
            "Equipa 2",
            "Falta de Comparência",
        ]

    def is_red_cell(self, cell) -> bool:
        """Verifica se uma célula tem fonte vermelha."""
        if not (cell.font.color and cell.value is not None):
            return False

        if hasattr(cell.font.color, "rgb") and cell.font.color.rgb:
            color = str(cell.font.color.rgb).upper()
            return color in ["FFFF0000", "FF0000", "FFCC0000", "CC0000"]
        return False

    def extract_red_cells(self, sheet_name: str) -> Dict[int, str]:
        """Extrai células vermelhas de uma folha."""
        wb = load_workbook(self.file_path, data_only=True)
        ws = wb[sheet_name]
        linhas_faltas = {}

        for row in ws.iter_rows():
            for cell in row:
                # Procura apenas nas colunas E e I (colunas 5 e 9, das equipas)
                # Verifica se não é uma célula mesclada e se está nas colunas corretas
                if (
                    hasattr(cell, "column")
                    and cell.column in [5, 9]
                    and self.is_red_cell(cell)
                ):
                    row_num = cell.row
                    if row_num in linhas_faltas:
                        linhas_faltas[row_num] += f", {cell.value}"
                    else:
                        linhas_faltas[row_num] = str(cell.value)

        return linhas_faltas

    def is_playoff_jornada(self, jornada_value) -> bool:
        """Verifica se uma jornada é de playoff (qualquer tipo)."""
        if not isinstance(jornada_value, str):
            return False

        jornada_upper = jornada_value.upper().strip()

        # Playoffs dos vencedores: E1, E2, E3L, E3
        if jornada_upper.startswith("E") and jornada_upper[1:] in ["1", "2", "3L", "3"]:
            return True

        # Playoffs de manutenção/promoção: PM1, PM2 (compat: MP1, MP2)
        if (
            jornada_upper.startswith("PM") or jornada_upper.startswith("MP")
        ) and re.match(r"^\d+$", jornada_upper[2:]):
            return True

        # Liguilhas: LM1, LM2, LM3, ... (compat: LP1, LP2, LP3, ...)
        # Aceita qualquer número de jornadas
        if (
            jornada_upper.startswith("LM") or jornada_upper.startswith("LP")
        ) and re.match(r"^\d+$", jornada_upper[2:]):
            return True

        return False

    def is_playoff_team_name(self, team_name: str) -> bool:
        """Verifica se o nome da equipa é uma legenda de playoff que deve ser removida."""
        if not isinstance(team_name, str):
            return False

        team_upper = team_name.upper().strip()

        # Padrões de legendas de playoffs que devem ser removidas
        # (indicam que os jogos ainda não foram definidos)
        playoff_patterns = [
            r"^\d+º CLASS\.",  # "1º Class.", "2º Class.", etc.
            r"^VENCEDOR",  # "Vencedor QF1", "Vencedor SF1", etc.
            r"^VENCIDO",  # "Vencido QF1", etc.
            r"^FINALISTA",  # "Finalista A", etc.
            r"^MELHOR",  # "Melhor 3º", etc.
            r"^PIOR",  # "Pior classificado", etc.
        ]

        for pattern in playoff_patterns:
            if re.search(pattern, team_upper):
                return True

        return False

    def filter_playoff_games(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove apenas jogos que contêm legendas de playoffs nas equipas (jogos não definidos)
        e que NÃO sejam linhas de playoff (E*/MP*/LP*). Mantém placeholders quando a jornada é de playoff.
        """
        if df.empty:
            return df

        # Identifica linhas com legendas de playoffs (jogos não definidos)
        placeholder_mask = df["Equipa 1"].apply(self.is_playoff_team_name) | df[
            "Equipa 2"
        ].apply(self.is_playoff_team_name)

        # Identifica linhas cujas jornadas já são playoffs (E*, MP*, LP*)
        jornada_is_playoff = df["Jornada"].apply(self.is_playoff_jornada)

        # Remover apenas placeholders que NÃO pertençam a linhas de playoff
        remove_mask = placeholder_mask & ~jornada_is_playoff
        filtered_df = df[~remove_mask].copy()

        # Log das linhas removidas para debug
        if remove_mask.any():
            removed_count = remove_mask.sum()
            print(
                f"  - Removidos {removed_count} jogos de playoffs com legendas não definidas"
            )

        # Log dos jogos de playoffs preservados
        if not filtered_df.empty:
            playoff_games = filtered_df[
                filtered_df["Jornada"].apply(self.is_playoff_jornada)
            ]
            if not playoff_games.empty:
                playoff_count = len(playoff_games)
                playoff_types = playoff_games["Jornada"].unique()
                print(
                    f"  - Preservados {playoff_count} jogos de playoffs definidos: {list(playoff_types)}"
                )

        return filtered_df

    def _detect_base_modality_for_playoffs(self, sheet_name: str) -> Optional[str]:
        """Dada uma folha '* | PLAYOFFS', tenta descobrir a modalidade base (ex.: 'ANDEBOL MISTO')."""
        if "|" not in sheet_name:
            return None
        prefix = sheet_name.split("|")[0].strip()  # ex: 'ANDEBOL'

        # Procurar nas folhas desta workbook por nomes que comecem por este prefixo e tenham um sufixo mais específico
        candidates: List[str] = []
        for name in map(str, self.xls.sheet_names):
            if name == sheet_name:
                continue
            if name.upper().startswith(prefix.upper() + " ") and "|" in name:
                # Ex.: 'ANDEBOL MISTO | 1ª DIVISÃO' -> base 'ANDEBOL MISTO'
                base = name.split("|")[0].strip()
                candidates.append(base)

        if not candidates:
            # fallback: usa o próprio prefixo (menos desejável)
            return prefix

        # Escolher o mais longo (maior especificidade), ex.: 'ANDEBOL MISTO' em vez de 'ANDEBOL'
        candidates.sort(key=len, reverse=True)
        return candidates[0]

    def _parse_playoffs_sheet(self, sheet_name: str) -> Optional[pd.DataFrame]:
        """Transforma a folha de PLAYOFFS num DataFrame normalizado com jornadas E1/E2/E3L/E3, PM*, LM*."""
        try:
            df_raw = pd.read_excel(self.xls, sheet_name=sheet_name)
        except Exception as e:
            print(
                f"Aviso: Não foi possível ler a folha de playoffs '{sheet_name}': {e}"
            )
            return None

        if df_raw.empty:
            return None

        # Detetar o contexto inicial a partir do nome da folha
        sheet_lower = sheet_name.lower()
        initial_context = None
        if any(
            k in sheet_lower for k in ["manuten", "manutençao", "manutenção", "promo"]
        ):
            initial_context = "PM"
        elif any(k in sheet_lower for k in ["ligu", "ligui"]):
            initial_context = "LM"
        else:
            initial_context = "E"  # Playoffs de vencedores por defeito

        # Mapear colunas prováveis
        cols_lower = {c: str(c).lower() for c in df_raw.columns}
        col_first = df_raw.columns[0]

        def find_col(substrs: List[str]) -> Optional[str]:
            for c in df_raw.columns:
                cl = str(c).lower()
                if any(s in cl for s in substrs):
                    return c
            return None

        col_dia = find_col(["dia"])  # opcional
        col_hora = find_col(["hora"])  # opcional
        col_local = find_col(["local"])  # opcional
        col_home = (
            find_col(["visitad"])
            or find_col(["equipa visit"])
            or find_col(["equipa 1"])
        )  # equipa visitada
        col_away = (
            find_col(["visitant"])
            or find_col(["equipa visitan"])
            or find_col(["equipa 2"])
        )  # equipa visitante

        if not col_home or not col_away:
            # tentar heurística por posições usuais
            try:
                col_home = df_raw.columns[4]
                col_away = (
                    df_raw.columns[8] if len(df_raw.columns) > 8 else df_raw.columns[7]
                )
            except Exception:
                pass

        # Helpers de mapeamento de estágios com contexto (principal E, manutenção PM, liguilha LM)
        bracket_context = (
            initial_context  # Usar contexto inicial detectado do nome da folha
        )

        def map_stage_to_jornada(stage: str) -> Optional[str]:
            s = (stage or "").strip().lower()
            if not s:
                return None
            nonlocal bracket_context

            # Detetar contexto de bracket pelo nome da folha ou cabeçalho
            # Manutenção/Promoção tem prioridade sobre outros contextos
            if any(k in s for k in ["manuten", "manutençao", "promo"]):
                bracket_context = "PM"
            # Liguilha tem segunda prioridade
            elif any(k in s for k in ["ligu", "ligui"]):
                bracket_context = "LM"
            # PLAYOFFS sem menção de manutenção/liguilha = playoffs de vencedores
            elif "playoff" in s and bracket_context is None:
                bracket_context = "E"

            # Mapeamento de estágios baseado no contexto
            if bracket_context == "PM":
                # Playoff de Manutenção: PM1 = Meias Finais, PM2 = Final
                if s.startswith("meias") or "semi" in s:
                    return "PM1"
                if s.startswith("final"):
                    return "PM2"
            elif bracket_context == "LM":
                # Liguilha: LM + número da jornada (será extraído depois)
                return "LM"
            elif bracket_context == "E":
                # Playoffs de vencedores: E1, E2, E3L, E3
                if s.startswith("quartos"):
                    return "E1"
                if s.startswith("meias") or "semi" in s:
                    return "E2"
                if ("3" in s and "4" in s) or "3º" in s or "3o" in s:
                    return "E3L"
                if s.startswith("final"):
                    return "E3"

            # Fallback: tentar detetar pelo padrão do texto
            if s.startswith("quartos") and bracket_context != "PM":
                bracket_context = "E"
                return "E1"
            if s.startswith("meias") or "semi" in s:
                if bracket_context == "PM":
                    return "PM1"
                elif bracket_context == "E":
                    return "E2"
            if ("3" in s and "4" in s) or "3º" in s or "3o" in s:
                bracket_context = "E"
                return "E3L"
            if s.startswith("final"):
                if bracket_context == "PM":
                    return "PM2"
                elif bracket_context == "E":
                    return "E3"

            return None

        def extract_teams_from_row(row: pd.Series) -> Tuple[str, str]:
            # Tenta pelos nomes de coluna mapeados
            t1 = (
                str(row.get(col_home)).strip()
                if col_home and pd.notna(row.get(col_home))
                else ""
            )
            t2 = (
                str(row.get(col_away)).strip()
                if col_away and pd.notna(row.get(col_away))
                else ""
            )
            # Fallback robusto: procurar os dois primeiros textos relevantes na linha
            if not t1 or not t2:
                texts: List[str] = []
                banned_tokens = {
                    "vs",
                    "v s",
                    "v.s.",
                    "x",
                    "jornada",
                    "resultado",
                    "equipa visitada",
                    "equipa visitante",
                    "playoffs",
                    "playoff",
                    "dia",
                    "hora",
                    "local",
                }
                # Adicionar também o nome da modalidade aos banned tokens
                sheet_tokens = sheet_name.lower().split()
                for token in sheet_tokens:
                    if len(token) > 3:  # Ignorar palavras muito curtas como "de"
                        banned_tokens.add(token.strip())

                colnames_lower = {str(c).lower() for c in df_raw.columns}
                for c in df_raw.columns:
                    val = row.get(c)
                    if pd.isna(val):
                        continue
                    s = str(val).strip()
                    if not s:
                        continue
                    s_low = s.lower()
                    c_low = str(c).lower()
                    if c_low.startswith(("jornada", "dia", "hora", "local")):
                        continue
                    if "result" in c_low or s_low in banned_tokens:
                        continue
                    # Ignorar números simples (números de jornada)
                    if s.isdigit() and len(s) <= 2:
                        continue
                    # Ignorar se o texto contém o nome da modalidade ou pipeline
                    if any(token in s_low for token in banned_tokens) or "|" in s:
                        continue
                    if s_low.startswith(("quartos", "meias", "final")) or (
                        "3" in s_low and "4" in s_low
                    ):
                        continue
                    if s_low in {cn.lower() for cn in map(str, df_raw.columns)}:
                        continue
                    texts.append(s)
                if len(texts) >= 2:
                    t1 = texts[0] or t1
                    t2 = texts[-1] or t2
                elif len(texts) == 1:
                    t1 = t1 or texts[0]
            return t1, t2

        rows: List[dict] = []
        current_stage = None  # guarda código (E1/E2/E3L/E3/MP1/MP2/LP)

        for _, row in df_raw.iterrows():
            header_cell = row.get(col_first)
            header_text = str(header_cell).strip() if pd.notna(header_cell) else ""

            # Troca de bloco/estágio
            maybe_stage = map_stage_to_jornada(header_text)
            if maybe_stage:
                current_stage = maybe_stage
                # não dar continue aqui; a mesma linha pode já conter equipas (ex.: "Quartos de Final" + par)

            # Para liguilha: 'Jornada 1' ou apenas '1' etc. no primeiro campo
            lp_number = None
            if (current_stage == "LM") and header_text:
                # Tentar extrair número da jornada de diferentes formatos
                m = re.search(r"jornada\s*(\d+)", header_text, flags=re.I)
                if m:
                    lp_number = m.group(1)
                elif header_text.isdigit():
                    # Se for apenas um número (1, 2, 3, etc.)
                    lp_number = header_text
                elif re.match(r"^\d+$", header_text.strip()):
                    lp_number = header_text.strip()

            # Ler equipas (robusto)
            team1, team2 = extract_teams_from_row(row)

            if not team1 and not team2:
                continue  # linha informativa/vazia

            # Validação adicional: ignorar se as equipas forem inválidas (cabeçalhos, etc.)
            invalid_team_patterns = [
                "jornada",
                "dia",
                "hora",
                "local",
                "resultado",
                "equipa visitada",
                "equipa visitante",
                "|",  # Contém pipe (separador de título)
            ]
            team1_lower = team1.lower() if team1 else ""
            team2_lower = team2.lower() if team2 else ""

            if any(pattern in team1_lower for pattern in invalid_team_patterns):
                continue
            if any(pattern in team2_lower for pattern in invalid_team_patterns):
                continue

            # Determinar Jornada
            if current_stage in {"E1", "E2", "E3L", "E3", "PM1", "PM2"}:
                jornada_val = current_stage
            elif current_stage == "LM" and lp_number:
                jornada_val = f"LM{lp_number}"
            else:
                # fallback: se o próprio header_text for algo como 'E1' etc.
                jornada_val = (
                    header_text if self.is_playoff_jornada(header_text) else ""
                )

            out_row = {
                "Jornada": jornada_val,
                "Dia": str(row.get(col_dia)) if col_dia else "",
                "Hora": str(row.get(col_hora)) if col_hora else "",
                "Local": str(row.get(col_local)) if col_local else "",
                "Equipa 1": team1,
                "Golos 1": pd.NA,
                "Golos 2": pd.NA,
                "Equipa 2": team2,
                "Falta de Comparência": "",
            }
            rows.append(out_row)

        if not rows:
            return None

        df_out = pd.DataFrame(rows)
        # Manter apenas linhas com Jornada válida de playoff
        df_out = df_out[df_out["Jornada"].apply(self.is_playoff_jornada)]
        return df_out.reset_index(drop=True)

    def _append_playoffs_to_target_csv(
        self, base_modality: str, playoffs_df: pd.DataFrame
    ):
        """Anexa as linhas de playoffs ao CSV da modalidade (no fim)."""
        # Construir caminho do CSV alvo
        if self.season:
            target_filename = f"{base_modality}_{self.season}.csv"
        else:
            target_filename = f"{base_modality}.csv"
        target_path = self.output_dir / target_filename

        # Se não existir, criar com cabeçalho conforme base_headers
        if not target_path.exists():
            empty = pd.DataFrame(columns=self.base_headers)
            empty.to_csv(target_path, index=False)

        try:
            base_df = pd.read_csv(target_path)
        except Exception:
            base_df = pd.DataFrame(columns=self.base_headers)

        # Remover coluna 'Época' antiga se existir, para padronizar saída
        if "Época" in base_df.columns:
            base_df = base_df.drop(columns=["Época"])  # normalizar

        # Garantir que playoffs_df possui todas as colunas do base_df
        for c in base_df.columns:
            if c not in playoffs_df.columns:
                # Preencher defaults: NA para golos, vazio para strings
                if c in ("Golos 1", "Golos 2"):
                    playoffs_df[c] = pd.NA
                else:
                    playoffs_df[c] = ""
        # Ordem de colunas igual ao base_df
        playoffs_df = playoffs_df[base_df.columns]

        # Concatenar mantendo ordem
        combined = pd.concat([base_df, playoffs_df], ignore_index=True)
        # Evitar duplicados caso este método seja chamado várias vezes
        combined = combined.drop_duplicates(subset=self.base_headers)
        combined.to_csv(target_path, index=False)
        print(f"  - Playoffs adicionados ao ficheiro: {target_path}")

    def _extract_playoffs_from_dataframe(
        self, df: pd.DataFrame
    ) -> Optional[pd.DataFrame]:
        """Tenta extrair blocos de playoffs embutidos numa folha regular de modalidade.
        Mapeia cabeçalhos como 'Quartos de Final', 'Meias Finais', '3º/4º Lugar', 'Final',
        'Manutenção' e 'Liguilha/Jornada N' para jornadas E1/E2/E3L/E3, MP1/MP2, LP1-3.
        """
        if df is None or df.empty:
            return None

        # A primeira coluna costuma conter numeração de jornada ou cabeçalhos de estágio
        col_first = df.columns[0]

        def find_col(substrs: List[str]) -> Optional[str]:
            for c in df.columns:
                cl = str(c).lower()
                if any(s in cl for s in substrs):
                    return c
            return None

        col_dia = find_col(["dia"])  # opcional
        col_hora = find_col(["hora"])  # opcional
        col_local = find_col(["local"])  # opcional
        col_home = find_col(["visitad", "equipa visitad", "equipa 1"])  # equipa casa
        col_away = find_col(["visitant", "equipa visitan", "equipa 2"])  # visitante

        # Fallback posicional: se não encontrou pelos nomes, tenta colunas típicas (4 e última)
        if not col_home or not col_away:
            try:
                cols = list(df.columns)
                if not col_home and len(cols) > 4:
                    col_home = cols[4]
                if not col_away and len(cols) > 5:
                    col_away = cols[-1]
            except Exception:
                pass

        # Se ainda assim não conseguir identificar colunas de equipa, abortar
        if not col_home or not col_away:
            return None

        # Helpers de mapeamento de estágios com contexto (E/PM/LM)
        bracket_context = None  # 'E', 'PM', 'LM'

        def map_stage_to_jornada(stage: str) -> Optional[str]:
            s = (stage or "").strip().lower()
            if not s:
                return None
            nonlocal bracket_context

            # Detetar contexto de bracket pelo nome da folha ou cabeçalho
            # Manutenção/Promoção tem prioridade sobre outros contextos
            if any(k in s for k in ["manuten", "manutençao", "promo"]):
                bracket_context = "PM"
            # Liguilha tem segunda prioridade
            elif any(k in s for k in ["ligu", "ligui"]):
                bracket_context = "LM"
            # PLAYOFFS sem menção de manutenção/liguilha = playoffs de vencedores
            elif "playoff" in s and bracket_context is None:
                bracket_context = "E"

            # Mapeamento de estágios baseado no contexto
            if bracket_context == "PM":
                # Playoff de Manutenção: PM1 = Meias Finais, PM2 = Final
                if s.startswith("meias") or "semi" in s:
                    return "PM1"
                if s.startswith("final"):
                    return "PM2"
            elif bracket_context == "LM":
                # Liguilha: LM + número da jornada (será extraído depois)
                return "LM"
            elif bracket_context == "E":
                # Playoffs de vencedores: E1, E2, E3L, E3
                if s.startswith("quartos"):
                    return "E1"
                if s.startswith("meias") or "semi" in s:
                    return "E2"
                if ("3" in s and "4" in s) or "3º" in s or "3o" in s:
                    return "E3L"
                if s.startswith("final"):
                    return "E3"

            # Fallback: tentar detetar pelo padrão do texto
            if s.startswith("quartos") and bracket_context != "PM":
                bracket_context = "E"
                return "E1"
            if s.startswith("meias") or "semi" in s:
                if bracket_context == "PM":
                    return "PM1"
                bracket_context = "E"
                return "E2"
            if ("3" in s and "4" in s) or "3º" in s or "3o" in s:
                bracket_context = "E"
                return "E3L"
            if s.startswith("final"):
                if bracket_context == "PM":
                    return "PM2"
                bracket_context = "E"
                return "E3"

            return None

        def extract_teams_from_row(r: pd.Series) -> Tuple[str, str]:
            # Primeiro tenta com nomes de colunas
            t1 = (
                str(r.get(col_home)).strip()
                if col_home and pd.notna(r.get(col_home))
                else ""
            )
            t2 = (
                str(r.get(col_away)).strip()
                if col_away and pd.notna(r.get(col_away))
                else ""
            )
            # Fallback: varrer textos na linha e escolher os dois relevantes
            if not t1 or not t2:
                texts: List[str] = []
                banned_tokens = {
                    "vs",
                    "v s",
                    "v.s.",
                    "x",
                    "jornada",
                    "resultado",
                    "equipa visitada",
                    "equipa visitante",
                    "playoffs",
                    "playoff",
                    "dia",
                    "hora",
                    "local",
                }
                colnames_lower = {str(c).lower() for c in df.columns}
                for c in df.columns:
                    val = r.get(c)
                    if pd.isna(val):
                        continue
                    s = str(val).strip()
                    if not s:
                        continue
                    s_low = s.lower()
                    c_low = str(c).lower()
                    if c_low.startswith(("jornada", "dia", "hora", "local")):
                        continue
                    if "result" in c_low or s_low in banned_tokens:
                        continue
                    # Ignorar números simples (números de jornada)
                    if s.isdigit() and len(s) <= 2:
                        continue
                    # Ignorar se o texto contém pipeline
                    if "|" in s:
                        continue
                    if s_low.startswith(("quartos", "meias", "final")) or (
                        "3" in s_low and "4" in s_low
                    ):
                        continue
                    if s_low in colnames_lower:
                        continue
                    texts.append(s)
                if len(texts) >= 2:
                    t1 = texts[0] or t1
                    t2 = texts[-1] or t2
                elif len(texts) == 1:
                    t1 = t1 or texts[0]
            return t1, t2

        rows: List[dict] = []
        current_stage = None  # guarda código (E1/E2/E3L/E3/MP1/MP2/LP)

        for _, r in df.iterrows():
            header_cell = r.get(col_first)
            header_text = str(header_cell).strip() if pd.notna(header_cell) else ""

            # Verificar se esta linha é um cabeçalho de seção (contém "|")
            # Se for, verificar todas as células da linha para detetar mudança de contexto
            is_section_header = False
            for val in r.values:
                if pd.notna(val) and "|" in str(val):
                    is_section_header = True
                    section_text = str(val).lower()
                    # Resetar contexto baseado no cabeçalho da seção
                    if any(k in section_text for k in ["ligu", "ligui"]):
                        bracket_context = "LM"
                    elif any(
                        k in section_text for k in ["manuten", "manutençao", "promo"]
                    ):
                        # Verificar se é liguilha ou playoff de manutenção
                        if any(k in section_text for k in ["ligu", "ligui"]):
                            bracket_context = "LM"
                        else:
                            bracket_context = "PM"
                    elif "playoff" in section_text and not any(
                        k in section_text
                        for k in ["manuten", "manutençao", "promo", "ligu", "ligui"]
                    ):
                        bracket_context = "E"
                    break

            # Se for cabeçalho de seção, saltar esta linha
            if is_section_header:
                continue

            # Troca de bloco/estágio se a primeira coluna trouxer um cabeçalho textual
            maybe_stage = map_stage_to_jornada(header_text)
            if maybe_stage:
                current_stage = maybe_stage
                # não saltar a linha; pode conter já o par de equipas na mesma linha do cabeçalho

            # Para liguilha: 'Jornada 1' ou apenas '1' etc. na primeira coluna
            lp_number = None
            if current_stage == "LM" and header_text:
                # Tentar extrair número da jornada de diferentes formatos
                m = re.search(r"jornada\s*(\d+)", header_text, flags=re.I)
                if m:
                    lp_number = m.group(1)
                elif header_text.isdigit():
                    # Se for apenas um número (1, 2, 3, etc.)
                    lp_number = header_text
                elif re.match(r"^\d+$", header_text.strip()):
                    lp_number = header_text.strip()

            # Ler equipas (robusto)
            team1, team2 = extract_teams_from_row(r)

            # ignorar linhas sem equipas
            if not team1 and not team2:
                continue

            # Validação adicional: ignorar se as equipas forem inválidas (cabeçalhos, etc.)
            invalid_team_patterns = [
                "jornada",
                "dia",
                "hora",
                "local",
                "resultado",
                "equipa visitada",
                "equipa visitante",
                "|",  # Contém pipe (separador de título)
            ]
            team1_lower = team1.lower() if team1 else ""
            team2_lower = team2.lower() if team2 else ""

            if any(pattern in team1_lower for pattern in invalid_team_patterns):
                continue
            if any(pattern in team2_lower for pattern in invalid_team_patterns):
                continue

            # Determinar Jornada
            if current_stage in {"E1", "E2", "E3L", "E3", "PM1", "PM2"}:
                jornada_val = current_stage
            elif current_stage == "LM" and lp_number:
                jornada_val = f"LM{lp_number}"
            else:
                # Se a própria célula já trouxer um código (ex.: E1)
                jornada_val = (
                    header_text if self.is_playoff_jornada(header_text) else ""
                )

            if not jornada_val:
                # Não é linha de playoff
                continue

            out_row = {
                "Jornada": jornada_val,
                "Dia": str(r.get(col_dia)) if col_dia else "",
                "Hora": str(r.get(col_hora)) if col_hora else "",
                "Local": str(r.get(col_local)) if col_local else "",
                "Equipa 1": team1,
                "Golos 1": pd.NA,
                "Golos 2": pd.NA,
                "Equipa 2": team2,
                "Falta de Comparência": "",
            }
            rows.append(out_row)

        if not rows:
            return None

        df_out = pd.DataFrame(rows)
        # Manter apenas linhas com Jornada válida de playoff
        df_out = df_out[df_out["Jornada"].apply(self.is_playoff_jornada)]
        # Remover duplicadas eventuais
        df_out = df_out.drop_duplicates(
            subset=["Jornada", "Equipa 1", "Equipa 2"]
        ).reset_index(drop=True)
        return df_out

    def get_sport_default_score(self, sheet_name: str) -> Tuple[int, int]:
        """Retorna o resultado padrão baseado no desporto."""
        sheet_upper = sheet_name.upper()

        if "VOLEIBOL" in sheet_upper:
            return (2, 0)  # 2-0 no voleibol
        elif "FUTSAL" in sheet_upper or "FUTEBOL" in sheet_upper:
            return (3, 0)  # 3-0 nos futebóis
        elif "ANDEBOL" in sheet_upper:
            return (15, 0)  # 15-0 no andebol
        elif "BASQUETEBOL" in sheet_upper:
            return (21, 0)  # 21-0 no basquetebol
        else:
            return (3, 0)  # Padrão para outros desportos

    def apply_default_scores(self, df: pd.DataFrame, sheet_name: str) -> pd.DataFrame:
        """Aplica resultados padrão quando há falta de comparência de apenas uma equipa."""
        if "Falta de Comparência" not in df.columns:
            return df

        # Obtém o resultado padrão para este desporto
        golos_vencedor, golos_perdedor = self.get_sport_default_score(sheet_name)

        for idx, row in df.iterrows():
            falta = row["Falta de Comparência"]

            # Verifica se há falta de comparência e se não está vazio
            if pd.notna(falta) and falta != "":
                # Conta quantas equipas faltaram (separadas por vírgula)
                equipas_faltaram = [
                    equipa.strip() for equipa in falta.split(",") if equipa.strip()
                ]

                # Só aplica resultado se apenas uma equipa faltou
                if len(equipas_faltaram) == 1:
                    equipa_faltou = equipas_faltaram[0]
                    equipa1 = row["Equipa 1"]
                    equipa2 = row["Equipa 2"]
                    # usar o índice diretamente
                    idx_i = idx

                    # Verifica qual equipa faltou e aplica o resultado
                    if equipa_faltou == equipa1:
                        # Equipa 1 faltou, Equipa 2 ganha
                        mask = df.index == idx_i
                        df.loc[mask, "Golos 1"] = golos_perdedor
                        df.loc[mask, "Golos 2"] = golos_vencedor
                    elif equipa_faltou == equipa2:
                        # Equipa 2 faltou, Equipa 1 ganha
                        mask = df.index == idx_i
                        df.loc[mask, "Golos 1"] = golos_vencedor
                        df.loc[mask, "Golos 2"] = golos_perdedor

        return df

    def extract_division_number(self, text: str) -> Optional[str]:
        """Extrai número da divisão do texto."""
        if not isinstance(text, str):
            return None
        match = self.divisao_pattern.search(text)
        return match.group(1) if match else None

    def extract_group(self, text: str) -> Optional[str]:
        """Extrai grupo do texto."""
        if not isinstance(text, str):
            return None
        match = self.grupo_pattern.search(text)
        return match.group(0) if match else None

    def find_divisions_and_groups(
        self, df: pd.DataFrame
    ) -> Tuple[Dict[str, int], Dict[str, int]]:
        """Encontra divisões e grupos no DataFrame."""
        primeira_coluna = df.columns[0]
        divisoes = {}
        grupos = {}

        # Verifica cabeçalho
        num_divisao = self.extract_division_number(primeira_coluna)
        if num_divisao:
            divisoes[num_divisao] = 0

        grupo = self.extract_group(primeira_coluna)
        if grupo:
            grupos[grupo] = 0

        # Percorre dados
        for idx, valor in enumerate(df[primeira_coluna]):
            if isinstance(valor, str) and "DIVISÃO" in valor:
                num_divisao = self.extract_division_number(valor)
                if num_divisao and num_divisao not in divisoes:
                    divisoes[num_divisao] = idx

                grupo = self.extract_group(valor)
                if grupo and grupo not in grupos:
                    grupos[grupo] = idx
            else:
                grupo = self.extract_group(str(valor))
                if grupo and grupo not in grupos:
                    grupos[grupo] = idx

        return divisoes, grupos

    def fill_sections(
        self, df: pd.DataFrame, sections: Dict[str, int], column_name: str
    ) -> pd.DataFrame:
        """Preenche colunas de seção (divisão ou grupo)."""
        if not sections:
            return df

        df[column_name] = ""
        indices = sorted(sections.items(), key=lambda x: x[1])

        for i, (name, start_idx) in enumerate(indices):
            end_idx = indices[i + 1][1] if i + 1 < len(indices) else len(df)

            if column_name == "Grupo":
                clean_name = name.replace("GRUPO ", "").strip()
            else:
                clean_name = name

            df.loc[start_idx : end_idx - 1, column_name] = clean_name

        return df

    def create_headers(self, has_divisions: bool, has_groups: bool) -> List[str]:
        """Cria cabeçalhos baseado na presença de divisões e grupos."""
        headers = self.base_headers.copy()

        if has_divisions:
            headers.append("Divisão")
        if has_groups:
            headers.append("Grupo")

        return headers

    def clean_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Limpa e processa o DataFrame."""
        # Remove linhas vazias
        df = df.dropna(how="all").reset_index(drop=True)

        # Filtra linhas válidas (que começam por número ou estão vazias)
        primeira_coluna = df.columns[0]
        df = df[
            df[primeira_coluna].map(lambda x: pd.isna(x) or isinstance(x, (int, float)))
        ]

        # Remove linhas com equipas zeradas
        df = df[~((df["Equipa 1"] == 0) | (df["Equipa 2"] == 0))]

        # Preenche jornadas
        df["Jornada"] = df["Jornada"].ffill()

        # Converte golos para inteiros
        for col in ["Golos 1", "Golos 2"]:
            if col in df.columns:
                df[col] = df[col].apply(lambda x: int(x) if pd.notna(x) else pd.NA)

        return df

    def adjust_journeys(self, df: pd.DataFrame) -> pd.DataFrame:
        """Ajusta números das jornadas para evitar duplicações."""

        def ajustar_jornada(row):
            jornada = row["Jornada"]
            equipa1 = row["Equipa 1"]
            equipa2 = row["Equipa 2"]

            if (jornada, equipa1) in aparicoes or (jornada, equipa2) in aparicoes:
                return jornada + 1

            aparicoes.add((jornada, equipa1))
            aparicoes.add((jornada, equipa2))
            return jornada

        aparicoes = set()
        df["Jornada"] = df.apply(ajustar_jornada, axis=1)
        df["Jornada"] = (
            df["Jornada"].astype(str).str.replace(".1", " (2ª)", regex=False)
        )

        return df

    def sort_by_datetime(self, df: pd.DataFrame) -> pd.DataFrame:
        """Ordena por data e hora, tratando jogos da madrugada (0h-1h) como do dia seguinte."""

        def parse_data_hora(row):
            dia, hora = row["Dia"], row["Hora"]

            if pd.isna(dia):
                return pd.Timestamp.max
            if pd.isna(hora):
                hora = "00:00"

            try:
                data_hora = pd.to_datetime(f"{dia} {hora}", errors="coerce")
                if pd.isna(data_hora):
                    return pd.Timestamp.max

                # Se a hora está entre 0h00 e 0h59, adiciona 24 horas para ordenar depois
                if (
                    data_hora.time() >= pd.to_datetime("00:00").time()
                    and data_hora.time() < pd.to_datetime("01:00").time()
                ):
                    data_hora += pd.Timedelta(hours=24)

                return data_hora
            except Exception:
                return pd.Timestamp.max

        # Coluna auxiliar para data/hora
        df["DataHoraSort"] = df.apply(parse_data_hora, axis=1)

        # Coluna auxiliar para ordenar por jornada quando não há data
        def parse_jornada_sort(val):
            if pd.isna(val):
                return 10**9
            if isinstance(val, (int, float)):
                try:
                    return int(val)
                except Exception:
                    return 10**9
            if isinstance(val, str):
                s = val.strip()
                m = re.match(r"^(\d+)", s)
                if m:
                    try:
                        return int(m.group(1))
                    except Exception:
                        return 10**9
                # Jornadas tipo 'E...' (eliminatórias) vão para o fim do grupo sem data
                return 10**9
            return 10**9

        df["JornadaSort"] = df["Jornada"].apply(parse_jornada_sort)

        # Colunas auxiliares para Divisão e Grupo (caso existam)
        def parse_divisao_sort(val):
            if pd.isna(val):
                return 10**6
            if isinstance(val, (int, float)):
                try:
                    return int(val)
                except Exception:
                    return 10**6
            if isinstance(val, str):
                m = re.search(r"(\d+)", val)
                if m:
                    try:
                        return int(m.group(1))
                    except Exception:
                        return 10**6
            return 10**6

        def parse_grupo_sort(val):
            if pd.isna(val):
                return 10**6
            # Aceita letras (A->1, B->2, ...) ou números diretamente
            if isinstance(val, (int, float)):
                try:
                    return int(val)
                except Exception:
                    return 10**6
            if isinstance(val, str) and val:
                v = val.strip().upper()
                # Se começar por letra
                if v[0].isalpha():
                    return ord(v[0]) - ord("A") + 1
                # Se contiver número
                m = re.search(r"(\d+)", v)
                if m:
                    try:
                        return int(m.group(1))
                    except Exception:
                        return 10**6
            return 10**6

        df["DivisaoSort"] = (
            df["Divisão"].apply(parse_divisao_sort)
            if "Divisão" in df.columns
            else 10**6
        )
        df["GrupoSort"] = (
            df["Grupo"].apply(parse_grupo_sort) if "Grupo" in df.columns else 10**6
        )

        # Ordenar por data/hora, depois jornada, depois Divisão e Grupo, e por fim nomes de equipas
        df = df.sort_values(
            [
                "DataHoraSort",
                "JornadaSort",
                "DivisaoSort",
                "GrupoSort",
                "Equipa 1",
                "Equipa 2",
            ],
            ascending=[True, True, True, True, True, True],
        )
        df = df.drop(
            columns=["DataHoraSort", "JornadaSort", "DivisaoSort", "GrupoSort"]
        )

        return df

    def finalize_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Finalizações finais do DataFrame."""
        # Remove linhas vazias nas colunas principais
        colunas_principais = [
            "Dia",
            "Hora",
            "Local",
            "Equipa 1",
            "Golos 1",
            "Golos 2",
            "Equipa 2",
        ]
        df = df.dropna(subset=colunas_principais, how="all")

        # Garantir coluna "Falta de Comparência" presente e no fim, mesmo vazia
        if "Falta de Comparência" not in df.columns:
            df["Falta de Comparência"] = ""

        colunas = [col for col in df.columns if col != "Falta de Comparência"]
        colunas.append("Falta de Comparência")
        df = df[colunas]

        return df

    def process_sheet(self, sheet_name: str) -> bool:
        """Processa uma folha específica."""
        if sheet_name == "CASTIGOS":
            return False

        print(f"A processar a folha: {sheet_name}")

        # Verifica se tem divisões
        sample = self.xls.parse(sheet_name, nrows=1)
        has_div = "DIVISÃO" in str(sample.columns[0])

        # Extrai células vermelhas
        linhas_faltas = self.extract_red_cells(sheet_name)

        # Carrega dados (mantendo cabeçalhos originais para reconhecer estágios)
        df = pd.read_excel(
            self.xls, sheet_name=sheet_name, usecols=[0, 1, 2, 3, 4, 5, 7, 8]
        )
        df["Falta de Comparência"] = ""

        # Validar e corrigir datas fora do intervalo da época
        dia_col = df.columns[1]  # Coluna "Dia"
        if self.season:
            df[dia_col] = df[dia_col].apply(
                lambda x: (
                    validate_and_fix_date_for_season(x, self.season)
                    if pd.notna(x)
                    else x
                )
            )

        # Preenche faltas de comparência
        for row_idx, value in linhas_faltas.items():
            df_idx = row_idx - 2  # Ajusta índice
            if 0 <= df_idx < len(df):
                df.at[df_idx, "Falta de Comparência"] = value

        # Limpa DataFrame inicial
        df = df.dropna(how="all").reset_index(drop=True)

        # Antes de qualquer limpeza, tentar extrair blocos de playoffs embutidos
        playoffs_df_embedded = self._extract_playoffs_from_dataframe(df.copy())

        # Processa divisões e grupos
        if has_div:
            divisoes, grupos = self.find_divisions_and_groups(df)
            df = self.fill_sections(df, divisoes, "Divisão")
            df = self.fill_sections(df, grupos, "Grupo")
            headers = self.create_headers(bool(divisoes), bool(grupos))
        else:
            _, grupos = self.find_divisions_and_groups(df)
            df = self.fill_sections(df, grupos, "Grupo")
            headers = self.create_headers(False, bool(grupos))

        # Ajusta cabeçalhos
        df = df.iloc[:, : len(headers)]
        df.columns = headers

        # Processa dados
        df = self.clean_dataframe(df)
        df = self.adjust_journeys(df)
        df = self.sort_by_datetime(df)
        df = self.apply_default_scores(df, sheet_name)
        df = self.filter_playoff_games(df)  # Filtrar jogos de playoffs
        df = self.finalize_dataframe(df)

        # Garantir que não existe coluna 'Época' nos CSVs
        if "Época" in df.columns:
            df = df.drop(columns=["Época"])  # normalizar

        # Salva resultado
        if self.season:
            filename = f"{sheet_name}_{self.season}.csv"
        else:
            filename = f"{sheet_name}.csv"

        output_file = self.output_dir / filename
        df.to_csv(output_file, index=False)

        print(f"Folha '{sheet_name}' processada e salva em '{output_file}'")

        # Se foram encontrados playoffs embutidos, anexar ao CSV desta modalidade
        if playoffs_df_embedded is not None and not playoffs_df_embedded.empty:
            # Garantir colunas esperadas e ordem
            expected_cols = self.base_headers
            for c in expected_cols:
                if c not in playoffs_df_embedded.columns:
                    playoffs_df_embedded[c] = (
                        "" if c not in ("Golos 1", "Golos 2") else pd.NA
                    )
            playoffs_df_embedded = playoffs_df_embedded[expected_cols]
            self._append_playoffs_to_target_csv(sheet_name, playoffs_df_embedded)
        return True

    def process_all_sheets(self):
        """Processa todas as folhas do Excel."""
        processed_count = 0
        target_sheets = (
            self._sheets_to_process if self._sheets_to_process else self.xls.sheet_names
        )

        playoffs_accumulator: List[Tuple[str, pd.DataFrame]] = []

        # 1) Processar folhas normais (com divisões/grupos)
        for sheet in map(str, target_sheets):
            if "PLAYOFFS" in sheet.upper():
                # Adiar para a 2ª fase
                continue
            if self.process_sheet(sheet):
                processed_count += 1

        # 2) Processar folhas de PLAYOFFS e anexar aos CSVs alvo
        for sheet in map(str, target_sheets):
            if "PLAYOFFS" not in sheet.upper():
                continue

            base_modality = self._detect_base_modality_for_playoffs(sheet)
            if not base_modality:
                print(
                    f"Aviso: Não foi possível determinar a modalidade base para '{sheet}'. Ignorado."
                )
                continue

            df_playoffs = self._parse_playoffs_sheet(sheet)
            if df_playoffs is None or df_playoffs.empty:
                print(f"Aviso: Folha de playoffs '{sheet}' sem linhas válidas.")
                continue

            # Garantir colunas esperadas e ordem
            expected_cols = self.base_headers
            for c in expected_cols:
                if c not in df_playoffs.columns:
                    df_playoffs[c] = "" if c != "Golos 1" and c != "Golos 2" else pd.NA
            df_playoffs = df_playoffs[expected_cols]

            self._append_playoffs_to_target_csv(base_modality, df_playoffs)

        print(
            f"\nProcessamento concluído! {processed_count} folhas processadas e playoffs anexados (se existirem)."
        )


def main():
    """Função principal."""
    # 1) Ler config/env para obter a URL do documento de resultados
    config_url: Optional[str] = None
    config_path = Path("../docs/config/config.json")
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                config_url = cfg.get("results_url")
        except Exception as e:
            print(f"Aviso: Não foi possível ler config.json: {e}")

    # Variável de ambiente como fallback
    env_url = os.environ.get("RESULTS_URL")
    if not config_url and env_url:
        config_url = env_url

    downloaded_file: Optional[Path] = None
    season_detected: Optional[str] = None

    # 2) Se houver URL, descarregar o ficheiro atualizado
    if config_url:
        try:
            url = normalize_results_url(config_url)
            downloaded_file = download_results_excel(url)
            print(f"Documento descarregado para: {downloaded_file}")

            # Abrir para detetar época mais recente a partir das folhas
            xls_temp = pd.ExcelFile(str(downloaded_file))
            season_detected = detect_latest_season_from_sheet_names(
                list(map(str, xls_temp.sheet_names))
            )
            # Fechar o handler do Excel antes de renomear em Windows
            try:
                xls_temp.close()
            except Exception:
                pass

            # Definir o nome alvo do Excel como 'Resultados Taça UA <época>.xlsx'
            if not season_detected:
                # fallback se não houver época nas folhas -> tentar a partir do nome
                extracted = extract_season_from_filename(downloaded_file.name)
                if not extracted:
                    extracted = current_season_token()
                season_detected = extracted
            target_name = f"Resultados Taça UA {season_detected}.xlsx"

            target_path = downloaded_file.parent / target_name
            if downloaded_file.name != target_name:
                try:
                    # Substitui se já existir
                    if target_path.exists():
                        target_path.unlink()
                    downloaded_file.rename(target_path)
                    downloaded_file = target_path
                except Exception as e:
                    print(
                        f"Aviso: Não foi possível renomear o ficheiro descarregado: {e}"
                    )
                    # fallback: copiar para o destino com o nome correto, mantendo o original
                    try:
                        shutil.copy2(downloaded_file, target_path)
                        downloaded_file = target_path
                    except Exception as e2:
                        print(f"Aviso: Falhou também o fallback de cópia: {e2}")

        except Exception as e:
            print(f"Erro ao descarregar o documento: {e}")
            downloaded_file = None

    # 3) Determinar o caminho do ficheiro a processar
    if downloaded_file and downloaded_file.exists():
        file_path = str(downloaded_file)
    else:
        # fallback: usar ficheiro local existente (compatibilidade antiga)
        # tentar usar padrão com época corrente
        default_local = f"../data/Resultados Taça UA {current_season_token()}.xlsx"
        if not os.path.exists(default_local):
            print("Erro: Nenhum ficheiro local encontrado e URL não disponível/valida.")
            print(
                "Defina 'results_url' em config.json ou a variável de ambiente RESULTS_URL."
            )
            return
        file_path = default_local

    # 4) Preparar backup e verificação de mudanças
    # Tenta inferir época para nome do backup
    season_for_backup = (
        season_detected
        or extract_season_from_filename(Path(file_path).name)
        or current_season_token()
    )
    backup_file = f"../data/backup_Resultados Taça UA {season_for_backup}.xlsx"

    if os.path.exists(backup_file) and files_are_identical(file_path, backup_file):
        print(
            "O arquivo Excel não mudou desde a última execução. Nenhum processamento necessário."
        )
        if os.getenv('GITHUB_OUTPUT'):
            with open(os.environ['GITHUB_OUTPUT'], 'a') as fh:
                print(f"data_changed=false", file=fh)
        return

    print("Arquivo Excel mudou ou primeira execução. Processando dados...")

    try:
        shutil.copy2(file_path, backup_file)
        print(f"Backup criado: {backup_file}")
    except Exception as e:
        print(f"Aviso: Não foi possível criar backup: {e}")

    # 5) Selecionar folhas a processar com base na época
    xls_all = pd.ExcelFile(file_path)
    if not season_detected:
        season_detected = detect_latest_season_from_sheet_names(
            list(map(str, xls_all.sheet_names))
        )

    sheets_to_process = choose_sheets_for_season(
        list(map(str, xls_all.sheet_names)), season_detected
    )

    # 6) Processar o ficheiro
    processor = ExcelProcessor(
        file_path, season_override=season_detected, sheets_to_process=sheets_to_process
    )
    processor.process_all_sheets()

    if os.getenv('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as fh:
            print(f"data_changed=true", file=fh)


if __name__ == "__main__":
    main()
