# -*- coding: utf-8 -*-
"""
Módulo para extração de calendários de jogos a partir de PDFs da Taça UA.

Este módulo processa PDFs de calendário e extrai informações de jogos
(data, hora, local, equipas, modalidade) para integração com o sistema
de processamento de resultados.
"""

import re
import json
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from difflib import SequenceMatcher
from PyPDF2 import PdfReader


# Cache global para evitar leitura repetida de PDFs
_calendario_cache: Dict[str, Dict] = {}


def normalizar_texto(texto: str) -> str:
    """Remove acentos e normaliza texto para matching."""
    if not texto:
        return ""
    # Normalizar unicode e remover acentos
    texto_nfd = unicodedata.normalize("NFD", texto)
    texto_sem_acentos = "".join(
        char for char in texto_nfd if unicodedata.category(char) != "Mn"
    )
    return texto_sem_acentos.upper().strip()


def carregar_config_cursos(repo_root: Path) -> Dict:
    """Carrega configuração de cursos para normalização de nomes."""
    config_path = repo_root / "docs" / "config" / "config_cursos.json"
    if not config_path.exists():
        print(f"  [!] Aviso: config_cursos.json não encontrado em {config_path}")
        return {}

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"  [!] Erro ao carregar config_cursos.json: {e}")
        return {}


def normalizar_nome_equipa(nome: str, config_cursos: Dict) -> str:
    """Normaliza nome de equipa usando config_cursos.json com fuzzy matching.

    Tenta fazer match por displayName ou shortName, removendo prefixos
    como "Eng.", "Lic.", "Mest." e normalizando acentos. Usa SequenceMatcher
    para fuzzy matching quando match exato falha.

    Args:
        nome: Nome da equipa como aparece no PDF
        config_cursos: Dicionário de configuração de cursos

    Returns:
        Nome normalizado da equipa
    """
    if not nome:
        return ""

    # Remover sufixos de equipa B
    is_equipa_b = nome.strip().endswith(" B")
    nome_limpo = nome.strip().replace(" B", "") if is_equipa_b else nome.strip()

    # Remover prefixo "UA " (utilizado em alguns PDFs)
    if nome_limpo.startswith("UA "):
        nome_limpo = nome_limpo[3:].strip()

    # Remover prefixos comuns (Eng., Lic., Mest., etc.)
    prefixos = ["Eng.", "Eng ", "Lic.", "Lic ", "Mest.", "Mest ", "Cand.", "Cand "]
    for prefixo in prefixos:
        if nome_limpo.startswith(prefixo):
            nome_limpo = nome_limpo[len(prefixo) :].strip()

    # Tentar encontrar no config com match exato
    if config_cursos and "courses" in config_cursos:
        nome_normalizado = normalizar_texto(nome_limpo)

        for key, curso in config_cursos["courses"].items():
            # Tentar match por chave (key)
            if normalizar_texto(key) == nome_normalizado:
                resultado = curso["displayName"].upper()
                return f"{resultado} B" if is_equipa_b else resultado

            # Tentar match por displayName
            if normalizar_texto(curso.get("displayName", "")) == nome_normalizado:
                resultado = curso["displayName"].upper()
                return f"{resultado} B" if is_equipa_b else resultado

            # Tentar match por shortName
            if normalizar_texto(curso.get("shortName", "")) == nome_normalizado:
                resultado = curso["displayName"].upper()
                return f"{resultado} B" if is_equipa_b else resultado

        # Se não encontrou match exato, tentar fuzzy matching
        displays = {
            normalizar_texto(curso.get("displayName", "")): curso["displayName"]
            for curso in config_cursos["courses"].values()
        }
        shorts = {
            normalizar_texto(curso.get("shortName", "")): curso["displayName"]
            for curso in config_cursos["courses"].values()
        }

        # Buscar matches mais próximos (similarity > 0.65)
        all_options = {**displays, **shorts}
        best_match = None
        best_ratio = 0.0

        for normed, displayname in all_options.items():
            ratio = SequenceMatcher(None, nome_normalizado, normed).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_match = displayname

        if best_ratio > 0.65:  # Threshold de 65% de similaridade
            resultado = best_match.upper()
            return f"{resultado} B" if is_equipa_b else resultado

    # Fallback: apenas normalizar
    resultado = nome_limpo.upper()
    return f"{resultado} B" if is_equipa_b else resultado


def mapear_modalidade_pdf_para_excel(modalidade_pdf: str) -> Tuple[str, Optional[str]]:
    """Converte nome de modalidade do PDF para padrão do Excel.

    Args:
        modalidade_pdf: Nome da modalidade como aparece no PDF
                       ex: "Futsal Masculino", "Voleibol Feminino 1ª Divisão"

    Returns:
        Tupla (modalidade_normalizada, divisao)
        ex: ("FUTSAL MASCULINO", None) ou ("VOLEIBOL FEMININO", "1")
    """
    if not modalidade_pdf:
        return ("", None)

    modalidade = modalidade_pdf.strip()
    divisao = None

    # Extrair divisão se presente
    divisao_match = re.search(r"(\d)ª\s*Divisão", modalidade, re.IGNORECASE)
    if divisao_match:
        divisao = divisao_match.group(1)
        # Remover divisão do nome da modalidade
        modalidade = re.sub(
            r"\s*\d ª\s*Divisão", "", modalidade, flags=re.IGNORECASE
        ).strip()

    # Normalizar "Futebol" para "Futebol 7" (padrão do Excel)
    if "FUTEBOL" in modalidade.upper() and "7" not in modalidade:
        modalidade = modalidade.replace("Futebol", "Futebol 7").replace(
            "futebol", "Futebol 7"
        )

    # Converter para maiúsculas (padrão do Excel)
    modalidade_normalizada = modalidade.upper()

    return (modalidade_normalizada, divisao)


def processar_pdf(caminho_pdf: Path) -> str:
    """Extrai texto de um arquivo PDF.

    Args:
        caminho_pdf: Caminho para o arquivo PDF

    Returns:
        Texto extraído do PDF
    """
    try:
        leitor = PdfReader(str(caminho_pdf))
        texto = ""
        for pagina in leitor.pages:
            texto += pagina.extract_text() or ""
        return texto
    except Exception as e:
        print(f"  [!] Erro ao processar PDF {caminho_pdf}: {e}")
        return ""


def extrair_jogos_pdf(
    texto: str, config_cursos: Dict, ano_base: int = 2025
) -> List[Dict]:
    """Extrai jogos do texto do PDF.

    Args:
        texto: Texto extraído do PDF
        config_cursos: Configuração de cursos para normalização
        ano_base: Ano base para parsing de datas (ex: 2025 para época 25_26)

    Returns:
        Lista de dicionários com informações dos jogos
    """
    jogos = []
    linhas = texto.split("\n")
    data_atual = None
    modalidade_atual = None
    divisao_atual = None
    local_padrao = ""

    # Regex para detectar header de tabela (indica início de lista de jogos)
    header_pattern = re.compile(
        r"Hora\s+Local\s+Equipa\s+Visitada.*Equipa\s+Visitante", re.IGNORECASE
    )

    for i, linha in enumerate(linhas):
        # Extrair data
        data_match = re.search(r"Dia (\d+) de (\w+)", linha, re.IGNORECASE)
        if data_match:
            try:
                dia = int(data_match.group(1))
                mes_nome = data_match.group(2).lower()

                # Mapear nomes de meses em português
                meses = {
                    "janeiro": 1,
                    "fevereiro": 2,
                    "março": 3,
                    "abril": 4,
                    "maio": 5,
                    "junho": 6,
                    "julho": 7,
                    "agosto": 8,
                    "setembro": 9,
                    "outubro": 10,
                    "novembro": 11,
                    "dezembro": 12,
                }

                mes = meses.get(mes_nome)
                if mes:
                    # Ajustar ano: setembro-dezembro usa ano_base, janeiro-junho usa ano_base+1
                    ano = ano_base if mes >= 9 else ano_base + 1
                    data_atual = datetime(ano, mes, dia)
            except (ValueError, KeyError) as e:
                print(f"  [!] Erro ao parsear data '{data_match.group(0)}': {e}")
                continue

        # Atualizar modalidade e divisão
        modalidade_match = re.search(
            r"(Futsal|Voleibol|Basquetebol|Andebol|Râguebi|Hóquei|Futebol)(\s+Masculino|\s+Feminino)?",
            linha,
            re.IGNORECASE,
        )
        if modalidade_match:
            modalidade_base = modalidade_match.group(0)
            modalidade_atual = modalidade_base
            divisao_atual = None  # Reset divisão

        # Verificar divisão na mesma linha ou linha seguinte
        divisao_match = re.search(r"(\d)ª\s*Divisão", linha, re.IGNORECASE)
        if divisao_match and modalidade_atual:
            divisao_atual = divisao_match.group(1)

        # Detectar header de tabela (não processar como jogo)
        if header_pattern.search(linha):
            continue

        # Extrair jogos: linhas que começam com horário (formato HHhMM)
        hora_match = re.match(r"^(\d{1,2}h\d{2})\s+(.+)$", linha)
        if hora_match and data_atual and modalidade_atual:
            hora = f"{int(hora_match.group(1).split('h')[0]):02d}h{hora_match.group(1).split('h')[1]}"
            resto_linha = hora_match.group(2).strip()

            # Extrair local (primeira palavra após horário)
            partes = resto_linha.split(maxsplit=1)
            if len(partes) >= 2:
                possivel_local = partes[0].strip()
                resto = partes[1].strip()

                # Verificar se é um local conhecido
                if possivel_local.upper() in [
                    "PAH",
                    "CAIXA",
                    "NAVE",
                    "SINTÉTICO",
                    "SINTETICO",
                    "UA",
                ]:
                    local_padrao = possivel_local.upper()
                    if local_padrao == "CAIXA":
                        local_padrao = "Caixa UA"
                    equipas_texto = resto
                else:
                    # Sem local explícito, usar texto completo
                    equipas_texto = resto_linha

                # Tentar extrair duas equipas: Visitada e Visitante
                # Formato esperado: "Equipa1 [Resultado] Equipa2"
                # Remover possíveis resultados numéricos no meio (ex: "3-2", "20-15")
                equipas_texto_clean = re.sub(r"\s+\d+[-–]\d+\s+", " ", equipas_texto)

                # Split por múltiplos espaços (geralmente separam as colunas)
                # Ou tentar heurística de encontrar dois nomes de curso
                partes_equipas = re.split(r"\s{2,}", equipas_texto_clean)

                if len(partes_equipas) >= 2:
                    equipa1_raw = partes_equipas[0].strip()
                    equipa2_raw = partes_equipas[
                        -1
                    ].strip()  # Última parte (pode ter resultado no meio)

                    # Normalizar nomes de equipas
                    equipa1 = normalizar_nome_equipa(equipa1_raw, config_cursos)
                    equipa2 = normalizar_nome_equipa(equipa2_raw, config_cursos)

                    # Normalizar modalidade
                    modalidade_norm, _ = mapear_modalidade_pdf_para_excel(
                        modalidade_atual
                    )
                    if divisao_atual:
                        modalidade_norm = f"{modalidade_norm}"  # Não incluir divisão no nome (será tratado separadamente)

                    if equipa1 and equipa2 and equipa1 != equipa2:
                        jogo = {
                            "data": data_atual,
                            "hora": hora,
                            "local": local_padrao if local_padrao else "",
                            "equipa1": equipa1,
                            "equipa2": equipa2,
                            "modalidade": modalidade_norm,
                            "divisao": divisao_atual,
                        }
                        jogos.append(jogo)

    return jogos


def carregar_calendario_epoca(
    epoca: str, calendarios_dir: Optional[Path] = None, repo_root: Optional[Path] = None
) -> Dict[str, Dict[Tuple[str, str], Tuple[str, str]]]:
    """Carrega calendários de todos os PDFs de uma época.

    Args:
        epoca: Época no formato 'YY_YY' (ex: '25_26')
        calendarios_dir: Diretório onde estão os PDFs (opcional)
        repo_root: Raiz do repositório (opcional, auto-detectado se None)

    Returns:
        Dicionário estruturado:
        {
            'MODALIDADE': {
                ('EQUIPA1', 'EQUIPA2'): ('YYYY-MM-DD HH:MM:SS', 'HHhMM'),
                ('EQUIPA2', 'EQUIPA1'): ('YYYY-MM-DD HH:MM:SS', 'HHhMM'),
                ...
            },
            ...
        }
    """
    # Verificar cache
    if epoca in _calendario_cache:
        return _calendario_cache[epoca]

    # Auto-detectar repo_root se não fornecido
    if repo_root is None:
        repo_root = Path(__file__).resolve().parents[1]

    # Auto-detectar calendarios_dir se não fornecido
    if calendarios_dir is None:
        calendarios_dir = repo_root / "docs" / "calendários" / epoca

    if not calendarios_dir.exists():
        print(f"  [INFO] Pasta de calendários não encontrada: {calendarios_dir}")
        _calendario_cache[epoca] = {}
        return {}

    # Carregar config de cursos
    config_cursos = carregar_config_cursos(repo_root)

    # Encontrar todos os PDFs de calendário na pasta
    pdfs = sorted(calendarios_dir.glob("Calendário Taça UA #*.pdf"))

    if not pdfs:
        pdfs = sorted(calendarios_dir.glob("Calendario*.pdf"))  # Fallback sem acento

    if not pdfs:
        print(f"  [INFO] Nenhum PDF de calendário encontrado em {calendarios_dir}")
        _calendario_cache[epoca] = {}
        return {}

    print(f"  [INFO] Encontrados {len(pdfs)} PDF(s) de calendário para época {epoca}")

    # Estrutura para consolidar jogos de todos os PDFs
    calendario_consolidado: Dict[str, Dict[Tuple[str, str], Tuple[str, str]]] = (
        defaultdict(lambda: {})
    )

    # Inferir ano base da época (ex: '25_26' -> 2025)
    try:
        ano_base = 2000 + int(epoca.split("_")[0])
    except (ValueError, IndexError):
        ano_base = datetime.now().year

    # Processar cada PDF
    for pdf_path in pdfs:
        print(f"    - Processando {pdf_path.name}...")
        texto = processar_pdf(pdf_path)

        if not texto:
            continue

        jogos = extrair_jogos_pdf(texto, config_cursos, ano_base)
        print(f"      Extraídos {len(jogos)} jogos")

        # Consolidar jogos no dicionário
        for jogo in jogos:
            modalidade = jogo["modalidade"]
            equipa1 = jogo["equipa1"]
            equipa2 = jogo["equipa2"]
            data = jogo["data"]
            hora = jogo["hora"]

            # Formatar data no padrão do CSV (YYYY-MM-DD HH:MM:SS)
            data_formatada = data.strftime("%Y-%m-%d 00:00:00")

            # Criar chaves bidirecionais (equipa1 vs equipa2) e (equipa2 vs equipa1)
            chave_direta = (equipa1, equipa2)
            chave_invertida = (equipa2, equipa1)

            # Inicializar dicionário para modalidade se não existir
            if modalidade not in calendario_consolidado:
                calendario_consolidado[modalidade] = {}

            # Verificar conflitos (mesmo jogo em múltiplos PDFs com datas diferentes)
            if chave_direta in calendario_consolidado[modalidade]:
                data_existente, hora_existente = calendario_consolidado[modalidade][
                    chave_direta
                ]
                if data_existente != data_formatada or hora_existente != hora:
                    print(f"      [!] Conflito: {equipa1} vs {equipa2} em {modalidade}")
                    print(f"          Anterior: {data_existente} {hora_existente}")
                    print(f"          Nova: {data_formatada} {hora}")
                    print(f"          Mantendo a mais recente (PDF mais recente)")
                    # Armazenar (PDF mais recente sobrescreve)
                    calendario_consolidado[modalidade][chave_direta] = (
                        data_formatada,
                        hora,
                    )
                    calendario_consolidado[modalidade][chave_invertida] = (
                        data_formatada,
                        hora,
                    )
            else:
                # Jogo não existe ainda, adicionar
                calendario_consolidado[modalidade][chave_direta] = (
                    data_formatada,
                    hora,
                )
                calendario_consolidado[modalidade][chave_invertida] = (
                    data_formatada,
                    hora,
                )

    # Resultado já é dict normal
    resultado = dict(calendario_consolidado)

    # Cachear resultado
    _calendario_cache[epoca] = resultado

    # Estatísticas
    total_jogos = sum(
        len(v) // 2 for v in resultado.values()
    )  # Dividir por 2 pois cada jogo tem 2 chaves
    print(
        f"  [INFO] Calendário consolidado: {len(resultado)} modalidades, ~{total_jogos} jogos únicos"
    )

    return resultado


def limpar_cache():
    """Limpa o cache de calendários. Útil para forçar re-leitura dos PDFs."""
    global _calendario_cache
    _calendario_cache.clear()


# Para testes standalone
if __name__ == "__main__":
    import sys

    # Detectar repo root
    repo_root = Path(__file__).resolve().parents[1]

    # Época para testar (pode ser passada como argumento)
    epoca = sys.argv[1] if len(sys.argv) > 1 else "25_26"

    print(f"\n=== Teste de Extração de Calendário - Época {epoca} ===\n")

    calendario = carregar_calendario_epoca(epoca, repo_root=repo_root)

    if not calendario:
        print("Nenhum calendário carregado.")
        sys.exit(0)

    # Mostrar amostra de jogos por modalidade
    for modalidade, jogos in calendario.items():
        print(f"\n{modalidade}:")
        # Mostrar apenas primeiros 5 jogos (chaves únicas)
        jogos_unicos = {}
        for (eq1, eq2), (data, hora) in jogos.items():
            chave_ordenada = tuple(sorted([eq1, eq2]))
            if chave_ordenada not in jogos_unicos:
                jogos_unicos[chave_ordenada] = (eq1, eq2, data, hora)

        for i, (eq1, eq2, data, hora) in enumerate(list(jogos_unicos.values())[:5]):
            print(f"  {data} {hora} - {eq1} vs {eq2}")

        if len(jogos_unicos) > 5:
            print(f"  ... e mais {len(jogos_unicos) - 5} jogos")
