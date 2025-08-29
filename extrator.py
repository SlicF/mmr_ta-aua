import pandas as pd
import warnings
import os
import re
import shutil
import hashlib
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


class ExcelProcessor:
    """Classe para processar ficheiros Excel de resultados desportivos."""

    def __init__(self, file_path: str, output_dir: str = "csv_modalidades"):
        self.file_path = Path(file_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.xls = pd.ExcelFile(file_path)

        # Extrai a época do nome do arquivo
        self.season = extract_season_from_filename(str(self.file_path))

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

                    # Verifica qual equipa faltou e aplica o resultado
                    if equipa_faltou == equipa1:
                        # Equipa 1 faltou, Equipa 2 ganha
                        df.at[idx, "Golos 1"] = golos_perdedor
                        df.at[idx, "Golos 2"] = golos_vencedor
                    elif equipa_faltou == equipa2:
                        # Equipa 2 faltou, Equipa 1 ganha
                        df.at[idx, "Golos 1"] = golos_vencedor
                        df.at[idx, "Golos 2"] = golos_perdedor

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

        df["DataHoraSort"] = df.apply(parse_data_hora, axis=1)
        df = df.sort_values("DataHoraSort").drop(columns=["DataHoraSort"])

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

        # Verifica se há faltas de comparência e remove a coluna se estiver vazia
        if "Falta de Comparência" in df.columns:
            # Verifica se a coluna tem algum conteúdo (não vazia e não apenas strings vazias)
            tem_faltas = (
                df["Falta de Comparência"].notna().any()
                and (df["Falta de Comparência"] != "").any()
            )

            if tem_faltas:
                # Move "Falta de Comparência" para o fim
                colunas = [col for col in df.columns if col != "Falta de Comparência"]
                colunas.append("Falta de Comparência")
                df = df[colunas]
            else:
                # Remove a coluna se não houver faltas
                df = df.drop(columns=["Falta de Comparência"])

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

        # Carrega dados
        df = pd.read_excel(
            self.xls, sheet_name=sheet_name, usecols=[0, 1, 2, 3, 4, 5, 7, 8]
        )
        df["Falta de Comparência"] = ""

        # Preenche faltas de comparência
        for row_idx, value in linhas_faltas.items():
            df_idx = row_idx - 2  # Ajusta índice
            if 0 <= df_idx < len(df):
                df.at[df_idx, "Falta de Comparência"] = value

        # Limpa DataFrame inicial
        df = df.dropna(how="all").reset_index(drop=True)

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
        df = self.finalize_dataframe(df)

        # Salva resultado
        if self.season:
            filename = f"{sheet_name}_{self.season}.csv"
        else:
            filename = f"{sheet_name}.csv"

        output_file = self.output_dir / filename
        df.to_csv(output_file, index=False)

        print(f"Folha '{sheet_name}' processada e salva em '{output_file}'")
        return True

    def process_all_sheets(self):
        """Processa todas as folhas do Excel."""
        processed_count = 0
        for sheet_name in self.xls.sheet_names:
            if self.process_sheet(str(sheet_name)):
                processed_count += 1

        print(f"\nProcessamento concluído! {processed_count} folhas processadas.")


def main():
    """Função principal."""
    file_path = "Resultados Taça UA 24_25.xlsx"
    backup_file = "backup_Resultados Taça UA 24_25.xlsx"

    # Verificar se o arquivo Excel existe
    if not os.path.exists(file_path):
        print(f"Erro: Arquivo '{file_path}' não encontrado!")
        return

    # Verificar se o arquivo Excel mudou desde a última execução
    if os.path.exists(backup_file) and files_are_identical(file_path, backup_file):
        print(
            "O arquivo Excel não mudou desde a última execução. Nenhum processamento necessário."
        )
        return

    # Se chegou aqui, o arquivo mudou ou é a primeira execução
    print("Arquivo Excel mudou ou primeira execução. Processando dados...")

    # Criar cópia de backup do arquivo Excel
    try:
        shutil.copy2(file_path, backup_file)
        print(f"Backup criado: {backup_file}")
    except Exception as e:
        print(f"Aviso: Não foi possível criar backup: {e}")

    # Processar o arquivo
    processor = ExcelProcessor(file_path)
    processor.process_all_sheets()


if __name__ == "__main__":
    main()
