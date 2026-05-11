"""
Parser para o calendário de Playoffs da Taça UA.

Estrutura do PDF de playoffs é diferente do calendário regular:
  - Cabeçalho de secção: "VOLEIBOL MASCULINO | PLAYOFFS" (em maiúsculas)
  - Fase: "Quartos de final", "Meia Final", "Final", "3º/4º"
  - A tabela tem coluna "Dia" com datas no formato "13/mai"
  - A tabela pode ter (ou não) coluna "Jornada"
  - Equipas são descritivas: "1º Class. 1ª Div.", "W1", "Vencedor MF1"

Retorna lista de dicts com as mesmas chaves que o parser regular:
  data, hora, local, equipa_visitada, resultado, equipa_visitante,
  modalidade, divisao, fase
"""

import re
from PyPDF2 import PdfReader

# Mapeamento de abreviatura do mês para número
MES_MAP = {
    "jan": "01",
    "fev": "02",
    "mar": "03",
    "abr": "04",
    "mai": "05",
    "jun": "06",
    "jul": "07",
    "ago": "08",
    "set": "09",
    "out": "10",
    "nov": "11",
    "dez": "12",
}

# Padrões de data
RE_DIA_CABECALHO = re.compile(r"Dia\s+(\d{1,2})\s+de\s+(\w+)\s*\(", re.IGNORECASE)
RE_DATA_CELULA = re.compile(r"^(\d{1,2})/(\w{3})$")  # "13/mai"
RE_HORA = re.compile(r"^\d{1,2}h\d{2}$")  # "16h30"

# Cabeçalhos de tabela a ignorar
HEADER_TOKENS = {
    "Jornada",
    "Dia",
    "Hora",
    "Local",
    "Equipa",
    "Visitada",
    "Resultado",
    "Visitante",
}

# Palavras que indicam uma nova secção de modalidade (linha em maiúsculas)
RE_MODALIDADE = re.compile(r"^([A-ZÁÉÍÓÚÀÃÕÂÊÔÇÜ0-9][A-ZÁÉÍÓÚÀÃÕÂÊÔÇÜ0-9\s]*)\s*\|\s*(.+)$")

# Fases conhecidas
FASES = {
    "Quartos de final",
    "Quartos de Final",
    "Quartos",
    "Meia Final",
    "Meiafinal",
    "Semi-Final",
    "Semifinal",
    "Meias-finais",
    "Meia-Final",
    "Final",
    "FINAL",
    "Finalissima",
    "FINALÍSSIMA",
    "3º/4º",
    "3º/4º Lugar",
    "3º e 4º lugar",
    "Terceiro e Quarto",
}


def _normalizar_mes(abrev: str) -> str:
    return MES_MAP.get(abrev.lower(), "00")


def _parse_data_celula(token: str):
    """Tenta interpretar 'DD/mon' → (dia, mes_num) ou None."""
    m = RE_DATA_CELULA.match(token.strip())
    if m:
        return m.group(1).zfill(2), _normalizar_mes(m.group(2))
    return None


def _e_cabecalho_tabela(linha: str) -> bool:
    """Verifica se a linha é um cabeçalho de tabela."""
    tokens = linha.split()
    if not tokens:
        return False
    return all(t in HEADER_TOKENS for t in tokens)


def parse_playoffs(caminho_pdf: str) -> list[dict]:
    """
    Lê o PDF de playoffs e devolve lista de jogos ordenados visualmente.
    """
    reader = PdfReader(caminho_pdf)
    linhas = []
    
    for page in reader.pages:
        # Extrair texto com coordenadas Y
        parts = []
        def visitor_body(text, cm, tm, fontDict, fontSize):
            y = tm[5]
            x = tm[4]
            if text.strip():
                parts.append((y, x, text))
                
        page.extract_text(visitor_text=visitor_body)
        
        # Agrupar fragmentos na mesma linha (y com tolerância de 5 pts)
        linhas_visuais = []
        parts.sort(key=lambda p: p[0])  # Ordenar apenas por Y primeiro
        
        linha_atual = []
        y_atual = None
        
        for y, x, t in parts:
            if y_atual is None or abs(y_atual - y) < 5:
                linha_atual.append((x, t))
                if y_atual is None:
                    y_atual = y
            else:
                linha_atual.sort(key=lambda item: item[0])
                texto = " ".join(item[1] for item in linha_atual)
                linhas_visuais.append((y_atual, texto))
                linha_atual = [(x, t)]
                y_atual = y
                
        if linha_atual:
            linha_atual.sort(key=lambda item: item[0])
            texto = " ".join(item[1] for item in linha_atual)
            linhas_visuais.append((y_atual, texto))
            
        linhas.extend(linhas_visuais)

    jogos = []
    modalidade_atual = ""
    divisao_atual = ""  # ex: "PLAYOFFS", "LIGUILHA MANUTENÇÃO/PROMOÇÃO"
    fase_atual = ""  # ex: "Quartos de final"
    ano_atual = "2026"  # ajustar se necessário

    i = 0
    while i < len(linhas):
        y_atual, linha = linhas[i]
        linha = linha.strip()
        i += 1

        if not linha:
            continue

        # ── Cabeçalho de dia (pode existir e serve apenas de contexto) ──
        m_dia_cab = RE_DIA_CABECALHO.match(linha)
        if m_dia_cab:
            continue  # A data real vem nas células da tabela

        # ── Cabeçalho de modalidade: "VOLEIBOL MASCULINO | PLAYOFFS" ──
        m_mod = RE_MODALIDADE.match(linha)
        if m_mod:
            modalidade_atual = m_mod.group(1).strip().title()
            divisao_atual = m_mod.group(2).strip()
            fase_atual = ""  # reset da fase ao mudar modalidade
            continue

        # ── Fase: "Quartos de final", "Meia Final", etc. ──
        if linha in FASES:
            fase_atual = linha
            if jogos and jogos[-1].get("modalidade") == modalidade_atual and jogos[-1].get("divisao") == divisao_atual:
                if "_y" in jogos[-1] and abs(y_atual - jogos[-1]["_y"]) < 15:
                    jogos[-1]["fase"] = fase_atual
            continue

        # ── Cabeçalho de tabela ──
        if _e_cabecalho_tabela(linha):
            continue

        # ── Tentativa de interpretar linha como jogo ──
        # Formatos possíveis:
        #   [Jornada]  DD/mon  HHhMM  Local  Equipa_Visitada  [Resultado]  Equipa_Visitante
        # O número de tokens varia. A estratégia é:
        #   1. Ignorar token numérico inicial (Jornada)
        #   2. Encontrar data (DD/mon) e hora (HHhMM)
        #   3. O token a seguir à hora é o Local
        #   4. O que restar é dividido pelo campo Resultado (vazio ou "X-X")
        tokens = linha.split()
        if not tokens:
            continue

        idx = 0

        # 1. Tentar ler jornada (pode ser número, "Final", "3º/4º")
        jornada_num = ""
        if _parse_data_celula(tokens[idx]) is None and idx + 1 < len(tokens) and _parse_data_celula(tokens[idx+1]) is not None:
            jornada_num = tokens[idx]
            idx += 1
            if idx >= len(tokens):
                continue

        # 2. Data
        data_info = _parse_data_celula(tokens[idx])
        if data_info is None:
            continue  # linha não começa com data → não é jogo
        dia, mes = data_info
        data_str = f"{dia}/{mes}"
        idx += 1
        if idx >= len(tokens):
            continue

        # 3. Hora
        if not RE_HORA.match(tokens[idx]):
            continue
        hora = tokens[idx]
        idx += 1
        if idx >= len(tokens):
            continue

        # 4. Local (token único, sem espaço — ex: PAH, Caixa UA, Sintético)
        # "Caixa UA" tem dois tokens; apanhar até encontrar o padrão de equipa
        # Heurística: local termina quando encontramos um token que começa
        # com dígito ordinal ou maiúscula seguida de padrão de equipa.
        # Simplificação: locais conhecidos são "PAH", "Sintético", "Caixa" (+UA)
        local_tokens = []
        while idx < len(tokens):
            t = tokens[idx]
            # "Caixa UA" → dois tokens; PAH e Sintético são um só
            if t in ("PAH", "Sintético"):
                local_tokens.append(t)
                idx += 1
                break
            elif t == "Caixa" and idx + 1 < len(tokens) and tokens[idx + 1] == "UA":
                local_tokens.extend(["Caixa", "UA"])
                idx += 2
                break
            else:
                # Local desconhecido: assume token único
                local_tokens.append(t)
                idx += 1
                break
        local = " ".join(local_tokens)

        # 5. Resto da linha → equipa_visitada [resultado] equipa_visitante
        resto = tokens[idx:]
        if not resto:
            continue

        equipa_visitada, resultado, equipa_visitante = _split_equipas(resto)

        jogos.append(
            {
                "data": data_str,
                "hora": hora,
                "local": local,
                "equipa_visitada": equipa_visitada,
                "resultado": resultado,
                "equipa_visitante": equipa_visitante,
                "modalidade": modalidade_atual,
                "divisao": divisao_atual,
                "fase": fase_atual or (jornada_num if jornada_num and not jornada_num.isdigit() else (f"Jornada {jornada_num}" if jornada_num else "")),
                "_y": y_atual,
            }
        )

    for j in jogos:
        j.pop("_y", None)

    return jogos


# ── Resultado dentro de uma linha ──────────────────────────────────────────

RE_RESULTADO = re.compile(r"^\d+[-–]\d+$")

# Padrões de início de equipa nos playoffs
# Ex: "1º", "2º", "9º", "W1", "W2", "Vencedor", "Vencido"
RE_INICIO_EQUIPA = re.compile(r"^(\d+º|W\d+|Vencedor|Vencido)$", re.IGNORECASE)


def _split_equipas(tokens: list[str]):
    """
    Divide os tokens restantes em equipa_visitada, resultado, equipa_visitante.

    O resultado é algo como "3-1" ou ausente.
    As equipas dos playoffs são frases descritivas como:
      "1º Class. 1ª Div."  |  "2º Class. 2ª Div. Gr. B"
      "W1"  |  "W4"  |  "Vencedor MF1"  |  "Vencido MF2"

    Estratégia (por ordem de preferência):
      1. Resultado numérico explícito (ex: "3-1")
      2. Procurar segundo token de início de equipa (ordinal, W, Vencedor…)
         a partir da posição 1 — esse é o corte
      3. Fallback: metade dos tokens
    """
    # 1. Resultado explícito
    for j, t in enumerate(tokens):
        if RE_RESULTADO.match(t):
            return (
                " ".join(tokens[:j]).strip(),
                t.strip(),
                " ".join(tokens[j + 1 :]).strip(),
            )

    # 2. Segundo padrão de início de equipa
    for j in range(1, len(tokens)):
        if RE_INICIO_EQUIPA.match(tokens[j]):
            return (
                " ".join(tokens[:j]).strip(),
                "",
                " ".join(tokens[j:]).strip(),
            )

    # 3. Fallback: metade
    mid = max(1, len(tokens) // 2)
    return " ".join(tokens[:mid]).strip(), "", " ".join(tokens[mid:]).strip()


# ── Ponto de entrada ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    import csv

    caminho = sys.argv[1] if len(sys.argv) > 1 else "Calendário_Taça_UA_Playoffs.pdf"
    jogos = parse_playoffs(caminho)

    writer = csv.DictWriter(
        sys.stdout,
        fieldnames=[
            "data",
            "hora",
            "local",
            "equipa_visitada",
            "resultado",
            "equipa_visitante",
            "modalidade",
            "divisao",
            "fase",
        ],
        extrasaction="ignore",
    )
    writer.writeheader()
    writer.writerows(jogos)
    print(f"\n# {len(jogos)} jogos extraídos", file=sys.stderr)
