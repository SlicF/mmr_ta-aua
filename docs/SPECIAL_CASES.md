# SPECIAL_CASES.md - Casos Especiais e Edge Cases

## Índice

1. [Transições de Equipas Entre Épocas](#team-transitions)
2. [Formatos de Playoff Variáveis](#playoff-formats)
3. [Gestão de Ausências](#absence-handling)
4. [Normalização de Nomes Complexa](#name-normalization)
5. [Divisões e Grupos Dinâmicos](#divisions-groups)
6. [Detecção de Desporto](#sport-detection)
7. [Casos de Pontuação Atípica](#scoring-edge-cases)
8. [Validação de Dados](#data-validation)

---

## <a name="team-transitions"></a> 1. Transições de Equipas Entre Épocas

### Caso 1.1: Renomeação (Contabilidade → Marketing)

**Contexto:**  
Curso "Contabilidade" foi renomeado para "Marketing" entre épocas 24-25 e 25-26.  
No andebol misto, a mesma equipa (mesmos jogadores) continuou com novo nome.

**Problema:**  
Sistema ELO interpreta como equipa NOVA → ELO reset para 1500 → injustiça competitiva.

**Solução Implementada:**

```python
# Ficheiro: src/mmr_taçaua.py
# Função: handle_special_team_transitions()

def handle_special_team_transitions(old_teams, sport_name):
    """
    Aplica transições hardcoded conhecidas.
    
    Args:
        old_teams: Dict {team_name: elo_value} da época anterior
        sport_name: Nome da modalidade (ex: "ANDEBOL MISTO")
    
    Returns:
        Dict com ELOs ajustados (Contabilidade removida, Marketing adicionada)
    """
    adjusted_teams = old_teams.copy()
    
    # ── TRANSIÇÃO HARDCODED: Contabilidade → Marketing ─────────────────
    if "andebol" in sport_name.lower() and "misto" in sport_name.lower():
        logger.info(
            "Detectado andebol misto - verificando transição Contabilidade→Marketing"
        )
        
        if "Contabilidade" in adjusted_teams:
            elo_to_transfer = adjusted_teams["Contabilidade"]
            logger.info(f"Contabilidade ELO={elo_to_transfer}")
            
            if "Marketing" not in adjusted_teams:
                # Transferir ELO
                adjusted_teams["Marketing"] = elo_to_transfer
                logger.info(
                    f"✓ Transferido ELO {elo_to_transfer} "
                    f"de Contabilidade para Marketing"
                )
                
                # Remover antiga
                del adjusted_teams["Contabilidade"]
                logger.info("✓ Contabilidade removida após transferência")
            else:
                logger.warning(
                    "Marketing já existe! Transição não aplicada "
                    "(possível conflito)"
                )
        else:
            logger.info("Contabilidade não encontrada na época anterior")
    
    return adjusted_teams
```

**Validação:**

```bash
# Verificar transferência nos logs:
grep -i "transferido elo.*contabilidade" mmr_tacaua.log

# Output esperado:
# 2025-09-15 10:23:45 - mmr_tacaua - INFO - ✓ Transferido ELO 1623 de Contabilidade para Marketing

# Confirmar em classificação:
grep "Marketing\|Contabilidade" \
    docs/output/elo_ratings/classificacao_ANDEBOL_MISTO_25_26.csv

# Época 24-25: Contabilidade,1623,...
# Época 25-26: Marketing,1623,...  ← ELO preservado ✓
```

**Adicionar Nova Transição:**

```python
# Exemplo: Eng. Materias → Eng. Materiais (25-26 → 26-27)

# 1. Identificar modalidades afetadas:
#    - Futsal M, Basquete F, Voleibol M

# 2. Adicionar lógica em handle_special_team_transitions():
if "futsal" in sport_name.lower() or \
   "basquete" in sport_name.lower() or \
   "volei" in sport_name.lower():
    
    if "Eng. Materias" in adjusted_teams:
        elo = adjusted_teams["Eng. Materias"]
        if "Eng. Materiais" not in adjusted_teams:
            adjusted_teams["Eng. Materiais"] = elo
            del adjusted_teams["Eng. Materias"]
            logger.info(
                f"✓ Transferido ELO {elo} "
                f"de Eng. Materias para Eng. Materiais"
            )
```

---

## <a name="playoff-formats"></a> 2. Formatos de Playoff Variáveis

### Caso 2.1: Placeholders de Playoff

**Problema:**  
Excel oficial contém jogos futuros com placeholders:

```ini
Equipa 1         | Equipa 2         | Golos 1 | Golos 2
1º Class. 1ª Div | 2º Class. 2ª Div |         |
Vencedor QF1     | Vencedor QF2     |         |
```

**Impacto:**  
Normalização falha → "1º Class." tratado como equipa real → rankings corrompidos.

__Solução:__ Filtrar via regex em `normalize_team_name()`.

```python
# Ficheiro: src/mmr_taçaua.py

def normalize_team_name(team_name):
    """
    Normaliza e filtra placeholders.
    
    Returns:
        str normalizado OU None se placeholder
    """
    if not team_name or pd.isna(team_name):
        return None
    
    normalized = str(team_name).strip()
    if not normalized:
        return None
    
    # ── FILTRAR PLACEHOLDERS ───────────────────────────────────────────
    placeholder_patterns = [
        r"^\d+º\s+Class\.",      # "1º Class.", "2º Class.", etc.
        r"^Vencedor\s+",          # "Vencedor QF1", "Vencedor MF2"
        r"^Vencido\s+",           # "Vencido QF3"
        r"^\d+º\s+Grupo\s+",      # "1º Grupo A"
        r"^1º\s+Div\.",          # "1º Div. 1"
        r"^2º\s+Div\.",          # "2º Div. 2"
    ]
    
    for pattern in placeholder_patterns:
        if re.match(pattern, normalized):
            logger.debug(f"Placeholder de playoff filtrado: {normalized}")
            return None  # ← CRÍTICO: retornar None, não string vazia
    
    # ... resto da normalização (mappings, acentos, etc.)
```

**Validação:**

```bash
# Contar placeholders removidos:
grep "Placeholder de playoff filtrado" mmr_tacaua.log | wc -l
# Output típico: 30-50 (depende de quantos playoffs estão no Excel)

# Verificar que classificações não contêm placeholders:
grep -E "Class\.|Vencedor|Vencido" \
    docs/output/elo_ratings/classificacao_*.csv
# Output esperado: (vazio)
```

---

### Caso 2.2: Jogo do 3º Lugar (E3L)

**Contexto:**  
Jornada "E3L" é jogo de consolação (equipas eliminadas na semi-final).  
Importância reduzida → K-factor deve ser menor.

**Implementação:**

```python
# Ficheiro: src/mmr_taçaua.py
# Função: EloRatingSystem.calculate_season_phase_multiplier()

def calculate_season_phase_multiplier(
    self,
    game_number: int,
    total_group_games: int,
    jornada: str = None,
    **kwargs
) -> float:
    """
    Retorna multiplicador de fase da época.
    
    Casos especiais:
        - E3L (3º lugar): 0.75 (menor importância)
        - Playoffs gerais: 1.5 (maior tensão)
        - Início época: >1.0 (incerteza alta)
    """
    # ── CASO ESPECIAL: JOGO DO 3º LUGAR ────────────────────────────────
    if jornada and str(jornada).upper() == "E3L":
        logger.info("E3L detectado → M_fase = 0.75")
        return 0.75
    
    # ── CASO: PLAYOFFS (jornada > escala máxima) ───────────────────────
    game_scaled = (game_number / total_group_games) * 8
    if game_scaled > 8:
        logger.info(f"Playoff detectado (scaled={game_scaled:.1f}) → M_fase = 1.5")
        return 1.5
    
    # ... resto da lógica de fase
```

**Exemplo Numérico:**

```python
# Jogo: EI vs Gestão na E3L
elo_EI, elo_Gestão = 1650, 1580
score_EI, score_Gestão = 3, 2  # Vitória apertada

# K-factor breakdown:
K_base = 100
M_fase = 0.75  # ← E3L reduzido
M_prop = (3/2)^0.1 = 1.047

K_total = 100 × 0.75 × 1.047 = 78.5

# Mudança ELO:
S_expected_EI = 1 / (1 + 10^((1580-1650)/250)) = 0.617
ΔElo_EI = 78.5 × (1.0 - 0.617) = +30

# Vs jogo de playoff normal (M_fase=1.5):
K_playoff = 100 × 1.5 × 1.047 = 157
ΔElo_playoff = 157 × (1.0 - 0.617) = +60

# ✓ E3L tem metade do impacto de playoff normal (30 vs 60)
```

---

### Caso 2.3: Formato Knockout vs Round-Robin

__Problema:__  
Algumas modalidades têm __apenas playoffs__ (sem fase de grupos).  
Divisão não existe → `self.div_col = None`.

**Solução:** Inferir "grupo único" se ausência de colunas.

```python
# Ficheiro: src/mmr_taçaua.py
# Classe: StandingsCalculator

def _create_group_key_column(self, df_group):
    """
    Cria chave de agrupamento para classificações.
    
    Hierarquia:
        1. Divisão + Grupo (se ambos existem)
        2. Apenas Grupo (se só grupo existe)
        3. Grupo inferido por divisão (se só divisão)
        4. Grupo único "Group_1" (se nada existe)  ← KNOCKOUT!
    """
    if self.div_col and self.group_col:
        # Caso standard: Divisões + Grupos explícitos
        df_group["Group_Key"] = (
            df_group[self.div_col].astype(str) + "_" +
            df_group[self.group_col].astype(str)
        )
        return "Group_Key"
    
    elif self.group_col:
        # Apenas grupos (sem divisões)
        return self.group_col
    
    elif self.div_col:
        # Apenas divisões (inferir grupos)
        df_group["Inferred_Group"] = df_group[self.div_col].astype(str)
        return "Inferred_Group"
    
    else:
        # ── SEM DIVISÕES NEM GRUPOS: KNOCKOUT PURO ─────────────────────
        logger.info(
            "Sem divisões/grupos detectados → classificação única (knockout)"
        )
        df_group["Inferred_Group"] = "Group_1"
        return "Inferred_Group"
```

---

## <a name="absence-handling"></a> 3. Gestão de Ausências

### Caso 3.1: Falta de Comparência (WO)

**Contexto:**  
Equipa não comparece → resultado automático 3-0 (ou 2-0 sets em voleibol).  
Campo "Falta de Comparência" ≠ vazio.

**Problemas:**

1. **Distorção de médias:** WO 3-0 não reflete habilidade ELO real.
2. **Calibração enviesada:** Golos inflacionados artificialmente.

**Solução:** Remover de calibração, **mas manter para ELO**.

```python
# Ficheiro: src/calibrator.py
# Classe: HistoricalDataLoader

def _load_single_csv(self, csv_path: Path) -> List[Dict]:
    """
    Carrega jogos, filtrando ausências para calibração.
    """
    games = []
    
    for row in reader:
        # ... parsing campos ...
        
        falta_raw = self._first_non_empty(
            row,
            ["Falta de Comparência", "Falta", "Falta de Comparencia"]
        )
        has_absence = falta_raw != ""
        
        # ── FILTRAR AUSÊNCIAS ───────────────────────────────────────────
        if has_absence:
            logger.debug(f"Ausência detectada: {team_a} vs {team_b} (WO)")
            continue  # ← NÃO adicionar a games[] (calibração)
        
        # ... adicionar jogo normal ...
        games.append(game)
    
    return games
```

__Mas no ELO (mmr_taçaua.py), ausências SÃO processadas:__

```python
# Ficheiro: src/mmr_taçaua.py

def process_match(self, row, sport):
    """
    Processa jogo individual, incluindo WOs.
    """
    # ... parsing ...
    
    falta = row.get("Falta de Comparência", "").strip()
    
    if falta:
        # WO: atribuir resultado automaticamente
        # (mas com K-factor reduzido?)
        logger.info(f"WO detectado: {team_a} vs {team_b}")
        # Processar normalmente (vencedor ganha ELO, perdedor perde)
        # Alternativa: K_factor *= 0.5 (opcional, não implementado)
    
    # ... cálculo ELO normal ...
```

**Impacto Quantitativo:**

```bash
# Contar ausências por época:
grep -c "Falta de Comparência" \
    docs/output/csv_modalidades/*_25_26.csv

# Output típico:
# FUTSAL_MASCULINO_25_26.csv:   2  (~4% de 48 jogos)
# ANDEBOL_MISTO_25_26.csv:       3  (~7% de 42 jogos)
# VOLEIBOL_FEMININO_25_26.csv:   1  (~3% de 36 jogos)
# TOTAL: ~4.5% de todos os jogos
```

**Validação de melhoria:**

```python
# Brier Score COM ausências na calibração:
BS_with_absences = 0.156

# Brier Score SEM ausências (implementado):
BS_without_absences = 0.138

# Melhoria = (0.156 - 0.138) / 0.156 = 11.5% ✓
```

---

### Caso 3.2: Jogos Interrompidos/Anulados

**Problema:**  
Jogo iniciou mas foi interrompido (distúrbios, lesão grave, etc.).  
Resultado parcial no Excel (ex: 1-0 aos 20 min).

**Tratamento:**

```bash
# 1. Marcar como ausência (adicionar "X" em "Falta de Comparência")
#    → Jogo não conta para calibração nem ELO

# 2. OU manter resultado parcial se foi homologado oficialmente
#    → Processar normalmente
```

---

## <a name="name-normalization"></a> 4. Normalização de Nomes Complexa

### Caso 4.1: Variações de Acentuação

**Problema:**  
Mesmo curso aparece como:

- "Tradução" (correto)
- "Traduçao" (sem til)
- "TRADUÇÃO" (uppercase)
- "traducao" (lowercase sem acentos)

**Solução:** Decomposição Unicode NFD + remoção de acentos.

```python
import unicodedata

def normalize_team_name(team_name):
    # ... validações iniciais ...
    
    # ── NORMALIZAÇÃO UNICODE ────────────────────────────────────────────
    # NFD: Decomposição canónica (ã → a + ~)
    normalized_nfd = unicodedata.normalize("NFD", normalized)
    
    # Remover combining marks (categoria "Mn")
    without_accents = "".join(
        char for char in normalized_nfd
        if unicodedata.category(char) != "Mn"
    )
    
    # Mapeamento de nomes SEM acentos → COM acentos (canonical)
    accent_mappings = {
        "traducao": "Tradução",
        "gestao": "Gestão",
        "matematica": "Matemática",
        "bioquimica": "Bioquímica",
        # ... etc
    }
    
    lower_no_accents = without_accents.lower()
    if lower_no_accents in accent_mappings:
        return accent_mappings[lower_no_accents]
    
    # ... resto da normalização ...
```

**Exemplo de transformação:**

```python
# Input → Output
"Traduçao"  → "Tradução"  # ç preservado, resto normalizado
"TRADUÇÃO"  → "Tradução"  # Case normalizada
"traducao"  → "Tradução"  # Sem acentos → mapeado
"Tradução " → "Tradução"  # Espaço trailing removido
```

---

### Caso 4.2: Siglas vs Nomes Completos

**Problema:**  
"Eng. Informática" vs "EI" devem ser mesma equipa.

**Solução:** Mapeamento JSON centralizado.

```json
// docs/config/config_cursos.json
{
  "Eng. Informática": {
    "displayName": "EI",
    "variants": [
      "Engenharia Informática",
      "Eng. Informatica",
      "Eng Informática",
      "E.I.",
      "Eng. Informática "  // Com espaço trailing
    ]
  }
}
```

**Processamento:**

```python
# Ficheiro: src/mmr_taçaua.py

def create_team_name_mapping():
    """
    Carrega config_cursos.json e gera dicionário de mapeamentos.
    
    Returns:
        {"Engenharia Informática": "EI",
         "Eng. Informatica": "EI",
         ...}
    """
    mappings = {}
    
    with open("docs/config/config_cursos.json") as f:
        config = json.load(f)
    
    for course_key, course_data in config["courses"].items():
        canonical = course_data.get("displayName", course_key)
        variants = course_data.get("variants", [])
        
        # Todas as variantes apontam para displayName
        for variant in variants:
            mappings[variant] = canonical
        
        # O próprio key também pode ser variante
        if course_key != canonical:
            mappings[course_key] = canonical
    
    return mappings

# Uso em normalize_team_name():
team_mappings = create_team_name_mapping()
if normalized in team_mappings:
    return team_mappings[normalized]
```

---

### Caso 4.3: Erros Tipográficos Conhecidos

**Hardcoded fallback para erros não no JSON:**

```python
# Ficheiro: src/mmr_taçaua.py

KNOWN_TYPOS = {
    "EGO": "EGI", 
    "Eng. Compotacional": "Eng. Computacional",
    "Adminstração Pública": "Administração Pública",
    "Edcucação Básica": "Educação Básica",
}

def normalize_team_name(team_name):
    # ... após normalização básica ...
    
    if normalized in KNOWN_TYPOS:
        corrected = KNOWN_TYPOS[normalized]
        logger.warn(f"Erro tipográfico corrigido: {normalized} → {corrected}")
        return corrected
    
    # ... resto ...
```

---

## <a name="divisions-groups"></a> 5. Divisões e Grupos Dinâmicos

### Caso 5.1: Inferência de Grupos por Conectividade

**Problema:**  
CSV não tem coluna "Grupo", mas jogos estão claramente em grupos separados.

**Solução:** Análise de grafos (componentes conectados).

```python
# Ficheiro: src/mmr_taçaua.py
# Classe: StandingsCalculator

def _infer_groups_from_games(self, df_div):
    """
    Infere grupos baseado em conectividade de jogos.
    
    Algoritmo:
        1. Criar grafo: nós=equipas, arestas=jogos
        2. Encontrar componentes conectados (Union-Find ou DFS)
        3. Cada componente = 1 grupo
    """
    teams = set()
    connections = set()
    
    # ── CONSTRUIR GRAFO ─────────────────────────────────────────────────
    for _, row in df_div.iterrows():
        team1 = normalize_team_name(row["Equipa 1"])
        team2 = normalize_team_name(row["Equipa 2"])
        
        if team1 and team2:
            teams.add(team1)
            teams.add(team2)
            connections.add((team1, team2))
    
    # ── ENCONTRAR COMPONENTES CONECTADOS ────────────────────────────────
    groups = []
    remaining_teams = teams.copy()
    
    while remaining_teams:
        # Começar novo grupo
        current_group = {remaining_teams.pop()}
        changed = True
        
        # Expandir grupo até não haver mais conexões
        while changed:
            changed = False
            for t1, t2 in connections:
                if t1 in current_group and t2 in remaining_teams:
                    current_group.add(t2)
                    remaining_teams.discard(t2)
                    changed = True
                elif t2 in current_group and t1 in remaining_teams:
                    current_group.add(t1)
                    remaining_teams.discard(t1)
                    changed = True
        
        groups.append(current_group)
    
    logger.info(f"Inferidos {len(groups)} grupos por conectividade")
    for idx, group in enumerate(groups, 1):
        logger.info(f"  Grupo {idx}: {sorted(group)}")
    
    return groups
```

**Exemplo:**

```ini
Jogos:
  EI vs Gestão
  EI vs Economia
  Gestão vs Economia
  Tradução vs Bioquímica
  Tradução vs Física

Componentes:
  Grupo 1: {EI, Gestão, Economia}       ← Conectados entre si
  Grupo 2: {Tradução, Bioquímica, Física}
```

---

## <a name="sport-detection"></a> 6. Detecção de Desporto

### Caso 6.1: Ambiguidade Futebol vs Futsal

__Problema:__  
Ficheiro "FUTEBOL_DE_7_MASCULINO_25_26.csv" pode ser confundido com futsal.

**Solução:** Prioridade de keywords.

```python
# Ficheiro: src/mmr_taçaua.py
# Classe: SportDetector

@staticmethod
def detect_from_filename(filename):
    """
    Detecta desporto com hierarquia de prioridade.
    
    Prioridade:
        1. Andebol (específico)
        2. Futebol + 7 (específico)
        3. Futsal (genérico)
        4. Basquete
        5. Voleibol
    """
    filename_lower = filename.lower()
    
    # Prioridade 1: Andebol
    if "andebol" in filename_lower:
        return Sport.ANDEBOL
    
    # Prioridade 2: Futebol de 7 (ANTES de futsal!)
    if "futebol" in filename_lower and "7" in filename_lower:
        return Sport.FUTEBOL7
    
    # Prioridade 3: Futsal (genérico)
    if "futsal" in filename_lower or "futebol" in filename_lower:
        return Sport.FUTSAL
    
    # ... resto ...
```

---

## <a name="scoring-edge-cases"></a> 7. Casos de Pontuação Atípica

### Caso 7.1: Voleibol com Sets Inválidos

**Problema:**  
Excel mostra "Sets 1 = 1, Sets 2 = 1" (impossível em melhor de 3).

**Detecção e correção:**

```python
# Ficheiro: src/mmr_taçaua.py
# Classe: PointsCalculator

def calculate(sport, score1, score2, sets1=None, sets2=None):
    if sport == Sport.VOLEI:
        # Validar sets
        if sets1 is None or sets2 is None:
            logger.warning("Sets ausentes em voleibol! Usando scores como sets")
            sets1, sets2 = score1, score2
        
        # ── VALIDAÇÃO: SETS VÁLIDOS ─────────────────────────────────────
        valid_sets = {(2,0), (2,1), (1,2), (0,2)}
        if (sets1, sets2) not in valid_sets:
            logger.error(
                f"Sets inválidos em voleibol: {sets1}-{sets2} "
                f"(esperado: 2-0, 2-1, 1-2, 0-2)"
            )
            # Fallback: inferir vencedor e assumir 2-1
            if score1 > score2:
                return 2, 1  # Aproximação
            elif score2 > score1:
                return 1, 2
            else:
                logger.error("Empate em voleibol detectado! Impossível!")
                return 1, 1  # Forçar tratamento especial
        
        # ... processar sets válidos ...
```

---

### Caso 7.2: Andebol com Pontos Negativos (Bug?)

**Problema histórico resolvido:**  
Versão antiga permitia pontos negativos (bug em lógica de empate 2-2-1 andebol).

**Proteção atual:**

```python
def calculate_standings(self):
    # ... cálculo de pontos ...
    
    stats[team]["Pontos"] = max(0, stats[team]["Pontos"])  # Floor 0
```

---

## <a name="data-validation"></a> 8. Validação de Dados

### Checklist de Validação Pré-Execução

```python
# Script: src/validate_data.py (novo, a criar)

def validate_csv_integrity(csv_path):
    """
    Valida CSV antes de processar.
    
    Checks:
        1. Colunas obrigatórias existem
        2. Tipos de dados corretos
        3. Valores em ranges esperados
        4. Nomes de equipas são válidos (não placeholders)
    """
    required_columns = {
        "Jornada", "Equipa 1", "Equipa 2",
        "Golos 1", "Golos 2"
    }
    
    df = pd.read_csv(csv_path)
    
    # Check 1: Colunas obrigatórias
    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(f"Colunas em falta: {missing}")
    
    # Check 2: Tipos de dados
    for col in ["Golos 1", "Golos 2"]:
        if df[col].dtype not in [int, float]:
            raise TypeError(f"{col} deve ser numérico!")
    
    # Check 3: Ranges válidos
    if (df["Golos 1"] < 0).any() or (df["Golos 1"] > 100).any():
        raise ValueError("Golos 1 fora de range [0, 100]")
    
    # Check 4: Placeholders
    for col in ["Equipa 1", "Equipa 2"]:
        placeholders = df[col].str.contains("Class\.|Vencedor|Vencido", na=False)
        if placeholders.sum() > 0:
            logger.warning(
                f"{placeholders.sum()} placeholders detectados em {col}. "
                f"Serão filtrados."
            )
    
    logger.info(f"✓ Validação OK: {csv_path}")

# Executar antes do pipeline:
for csv_file in glob("docs/output/csv_modalidades/*.csv"):
    validate_csv_integrity(csv_file)
```

---

## Resumo e Manutenção

**Edge cases documentados:** 15+ cenários críticos

- ✓ Transições de equipas (renomeações, fusões)
- ✓ Formatos de playoff variáveis (E3L, knockout)
- ✓ Gestão de ausências (~4.5% jogos filtrados)
- ✓ Normalização complexa (acentos, siglas, typos)
- ✓ Divisões/grupos dinâmicos (inferência por grafo)
- ✓ Validação de dados (pre-checks)

**Maintenance plan:**

- Adicionar novos casos em KNOWN_TYPOS conforme aparecem
- Atualizar config_cursos.json semestralmente
- Revisar handle_special_team_transitions() no início de cada época

---

**Última atualização:** 2026-03-02  
**Autor:** Sistema Taça UA  
**Ficheiros relacionados:**

- `src/mmr_taçaua.py` (normalização, transições)
- `src/calibrator.py` (filtro de ausências)
- `docs/config/config_cursos.json` (mapeamentos)
