# OPERATIONS_GUIDE.md - Guia Operacional Completo

## Índice

1. [Pipeline de Execução](#pipeline)
2. [Procedimentos Operacionais](#procedures)
3. [Troubleshooting](#troubleshooting)
4. [Manutenção e Atualizações](#maintenance)
5. [Checklist de Nova Modalidade](#new-sport)
6. [Automação GitHub Actions](#github-actions)
7. [Monitorização e Logs](#monitoring)

---

## <a name="pipeline"></a> 1. Pipeline de Execução

### Sequência Completa (Início de Época)

```bash
# ═══════════════════════════════════════════════════════════════════
# WORKFLOW COMPLETO: ÉPOCA 26-27 (Exemplo)
# Tempo total: ~9 minutos
# ═══════════════════════════════════════════════════════════════════

cd D:\mmr_taçaua\src

# ── PASSO 1: EXTRAÇÃO ──────────────────────────────────────────────
# Input:  Excel oficial da Taça UA
# Output: CSVs normalizados em docs/output/csv_modalidades/
# Tempo:  ~30 segundos

python extrator.py

# Validações automáticas:
#   ✓ Nomes normalizados (displayName de config_cursos.json)
#   ✓ Modalidades detectadas (8 esperadas)
#   ✓ Placeholders de playoffs removidos
#   ✓ Ausências marcadas (campo "Falta de Comparência")

# Verificar outputs:
ls ..\docs\output\csv_modalidades\*_26_27.csv
# Esperar: 8 ficheiros (ou 16 se época dupla 25_26 + 26_27)

# ── PASSO 2: CÁLCULO ELO ──────────────────────────────────────────
# Input:  CSVs normalizados + épocas anteriores (para carry-over)
# Output: Classificações + ELO ratings + histórico JSON
# Tempo:  ~2-3 minutos

python mmr_taçaua.py

# Validações automáticas:
#   ✓ ELOs carregados de época anterior (se existir)
#   ✓ Transições especiais aplicadas (ex: Contabilidade→Marketing)
#   ✓ K-factor dinâmico aplicado (range 65-210 observado)
#   ✓ Divisões e grupos detectados corretamente

# Verificar ELO médio (deve estar ~1500 ± 200):
cat ..\docs\output\elo_ratings\classificacao_FUTSAL_MASCULINO_26_27.csv | \
    tail -n +2 | cut -d',' -f4 | \
    awk '{sum+=$1; n++} END {print "ELO médio:", sum/n}'

# ── PASSO 3: CALIBRAÇÃO ──────────────────────────────────────────
# Input:  CSVs históricos (25_26, 24_25)
# Output: Parâmetros calibrados (Gamma-Poisson, logit empates)
# Tempo:  ~1 minuto

python calibrator.py

# Validações críticas:
#   ✓ n_draws ≥ 5 para modelo logit (senão fallback gaussiano)
#   ✓ k ≥ 3.0 (floor de dispersão)
#   ✓ |intercept| < 100 (sanity check overfitting)
#   ✓ draw_multiplier ∈ [0.8, 2.0]

# Inspecionar parâmetros calibrados:
cat ..\docs\output\calibration\calibrated_simulator_config.json | jq .

# Validar JSON:
python -c "import json; json.load(open('../docs/output/calibration/calibrated_simulator_config.json'))"

# ── PASSO 4: PREVISÕES ───────────────────────────────────────────
# Input:  ELOs atuais + parâmetros calibrados
# Output: Probabilidades de classificação final
# Tempo:  ~30s (10k iter) | ~5 min (1M iter deep)

# Previsão rápida (10k iterações):
python preditor.py --season 26_27

# Previsão profunda (1M iterações, maior precisão):
python preditor.py --season 26_27 --deep-simulation

# Validações:
#   ✓ Soma de probabilidades = 100% para cada equipa
#   ✓ Posições 1-N todas atribuídas
#   ✓ Forecast consistente com probabilidades

# Verificar forecast:
cat ..\docs\output\previsoes\forecast_FUTSAL_MASCULINO_2027.csv

# ═══════════════════════════════════════════════════════════════════
# FIM DO PIPELINE
# ═══════════════════════════════════════════════════════════════════
```

### Comandos por Fase

#### 1.1 Extração (extrator.py)

```bash
# Modo standard (usa caminho padrão)
python src/extrator.py

# Modo custom (especificar Excel)
python src/extrator.py --input caminho/para/tacaua_26_27.xlsx

# Flags úteis:
#   --verbose       : Log detalhado de normalização
#   --dry-run       : Simular sem escrever ficheiros (teste)
#   --force-refresh : Ignorar cache, reprocessar tudo

# Exemplo com debug:
python src/extrator.py --verbose 2>&1 | tee extrator.log
```

#### 1.2 Cálculo ELO (mmr_taçaua.py)

```bash
# Modo standard (detecta época automaticamente)
python src/mmr_taçaua.py

# Especificar época:
python src/mmr_taçaua.py --season 26_27

# Forçar reset de ELOs (início de competição):
python src/mmr_taçaua.py --reset-elos

# Flags avançadas:
#   --carry-over    : Carregar ELOs de época anterior (padrão: True)
#   --debug-k       : Log de K-factor aplicado a cada jogo
#   --export-history: Gerar JSONs de histórico ELO completo

# Backtest (validar época passada):
python src/mmr_taçaua.py --season 25_26 --backtest
```

#### 1.3 Calibração (calibrator.py)

```bash
# Calibração completa (todas modalidades):
python src/calibrator.py

# Calibrar modalidade específica:
python src/calibrator.py --modalidade "FUTSAL MASCULINO"

# Flags de diagnóstico:
#   --verbose       : Log detalhado de ajustes
#   --plot-curves   : Gerar gráficos (requer matplotlib)
#   --cv-folds 5    : Cross-validation k-fold

# Exemplo com validação cruzada:
python src/calibrator.py --cv-folds 5 --verbose
```

#### 1.4 Previsão (preditor.py)

```bash
# Previsão rápida (10k iterações, ~30s):
python src/preditor.py --season 26_27

# Previsão profunda (1M iterações, ~5 min):
python src/preditor.py --season 26_27 --deep-simulation

# Cenários personalizados:
python src/preditor.py --season 26_27 \
    --scenario "FUTSAL FEMININO" \
    --iterations 100000 \
    --force-winner  # Simular playoffs (sem empates)

# Usar parâmetros não-calibrados (defaults):
python src/preditor.py --no-calibrated --season 26_27

# Flags úteis:
#   --workers N     : Paralelização (padrão: CPU count - 1)
#   --seed 42       : Reproduzibilidade (mesmo RNG)
#   --output-format : csv | json | html
```

---

## <a name="procedures"></a> 2. Procedimentos Operacionais

### 2.1 Início de Nova Época

**Trigger:** Primeira jornada da época 26-27 disputada.

```bash
# 1. Atualizar Excel oficial
#    - Verificar sheet names corretos (Futsal M, Andebol, etc.)
#    - Validar fórmulas (golos, sets, pontos)

# 2. Carregar configuração de cursos (se mudanças)
vi docs/config/config_cursos.json
# Adicionar novos cursos, atualizar displayNames

# 3. Executar pipeline COMPLETO
cd src
python extrator.py && \
python mmr_taçaua.py --carry-over && \
python calibrator.py && \
python preditor.py --season 26_27 --deep-simulation

# 4. Commit mudanças
cd ..
git add docs/output/
git commit -m "feat(25-26): Adicionar resultados jornada 1"
git push origin master

# 5. Website auto-atualiza via GitHub Pages webhook
#    Verificar em ~5 min: https://tacaua.example.com/
```

### 2.2 Atualização Semanal (Durante Época)

**Trigger:** Após cada jornada (~1x semana).

```bash
# 1. Atualizar Excel com resultados novos
#    (apenas linha nova, não editar anteriores!)

# 2. Pipeline PARCIAL (sem recalibrar):
cd src
python extrator.py
python mmr_taçaua.py  # Usa ELOs existentes + novos jogos
python preditor.py --season 26_27  # 10k iter rápido (suficiente)

# 3. Validação rápida:
#    - ELOs fazem sentido? (vencedores +15-50, perdedores -15-50)
#    - Probabilidades somam 100%?
tail -n 20 ../docs/output/elo_ratings/classificacao_FUTSAL_MASCULINO_26_27.csv

# 4. Commit + Push
git add -A
git commit -m "chore(26-27): Atualizar após jornada X"
git push
```

### 2.3 Recalibração Mid-Season

**Trigger:** ~Jornada 8-10 (meio da época), dados suficientes acumulados.

```bash
# Objetivo: Refinar parâmetros com dados da época ATUAL (não apenas histórico)

cd src

# 1. Calibrar APENAS época atual (override opção)
python calibrator.py --seasons 26_27 --override-historical

# 2. Comparar parâmetros:
diff ../docs/output/calibration/calibrated_simulator_config.json \
     ../docs/output/calibration/calibrated_simulator_config_26_27_mid.json

# 3. Se melhoria significativa (Brier -2% ou mais):
mv ../docs/output/calibration/calibrated_simulator_config_26_27_mid.json \
   ../docs/output/calibration/calibrated_simulator_config.json

# 4. Reprovar previsões com novos parâmetros:
python preditor.py --season 26_27 --deep-simulation

# 5. Commit com comentário explicativo:
git commit -m "calibration(26-27): Mid-season recalibration (Brier 0.145→0.138)"
```

---

## <a name="troubleshooting"></a> 3. Troubleshooting

### 3.1 Problema: Equipas Duplicadas na Classificação

**Sintoma:**
```csv
Posição,Equipa,ELO
1,Gestão,1627
2,Gestao,1582   ← Duplicado!
3,GESTÃO,1544   ← Triplicado!
```

**Causa:** Normalização incompleta (`normalize_team_name()` falhou).

**Diagnóstico:**
```bash
# Ver mapeamentos aplicados
python -c "from mmr_taçaua import create_team_name_mapping; \
           import json; \
           print(json.dumps(create_team_name_mapping(), indent=2))"

# Verificar se "Gestao" → "Gestão" existe no output
```

**Solução:**
```bash
# 1. Adicionar mapeamento em config_cursos.json:
{
  "GESTÃO": {
    "displayName": "Gestão",
    "variants": ["Gestao", "GESTÃO", "gestão"]
  }
}

# 2. Reprovar extrator:
python src/extrator.py --force-refresh

# 3. Reprovar ELO (reset para aplicar normalização):
python src/mmr_taçaua.py --reset-elos
```

---

### 3.2 Problema: Brier Score Anormalmente Alto (>0.20)

**Sintoma:**
```json
{
  "FUTSAL MASCULINO": {
    "brier_score": 0.247,  ← Muito pior que acaso (0.25)!
    "rmse_position": 3.82
  }
}
```

**Causa Provável:**
1. Parâmetros não calibrados (usando defaults)
2. Modelo de empates overfitted (intercept absurdo)
3. Dataset muito pequeno (<20 jogos)

**Diagnóstico:**
```bash
# Ver parâmetros usados:
cat docs/output/calibration/calibrated_simulator_config.json | \
    jq '."FUTSAL MASCULINO"'

# Verificar flags de status:
# {
#   "draw_model": {
#     "status": "overfitted"  ← PROBLEMA!
#   }
# }
```

**Soluções:**

**Caso 1: Overfitting**
```python
# Em calibrator.py, aumentar threshold mínimo:
min_draws = max(5, len(games) // 15)  # Era 20, relaxar para 15

# Reprovar:
python src/calibrator.py
```

**Caso 2: Dataset Pequeno**
```bash
# Usar fallback conservador:
python src/preditor.py --no-calibrated  # Usa defaults

# Ou calibrar com épocas combinadas:
python src/calibrator.py --seasons "25_26,24_25,23_24"
```

---

### 3.3 Problema: Tempo de Simulação Excessivo (>10 min)

**Sintoma:**
```
[preditor.py] Simulação 15% (150k/1M iterações) - ETA: 45 min
```

**Causa Provável:**
1. ProcessPoolExecutor não ativado (fallback ThreadPool → GIL)
2. Swap/memória insuficiente
3. I/O bottleneck (disco lento)

**Diagnóstico:**
```python
# Ver quantos workers ativos:
import multiprocessing
print(f"CPU cores: {multiprocessing.cpu_count()}")

# Verificar em código (preditor.py linha ~2800):
# with ProcessPoolExecutor(max_workers=N) as executor:
#       ^^^^^^^^^^^^^^^^^ deve ser Process, não Thread
```

**Soluções:**

```bash
# 1. Reduzir workers se RAM baixa (<8GB):
python src/preditor.py --workers 2 --season 26_27

# 2. Compilar numpy com OpenBLAS (speedup ~20%):
pip uninstall numpy
pip install numpy --no-binary numpy

# 3. Usar iterações menores para testes:
python src/preditor.py --iterations 10000  # vs 1M padrão
```

---

### 3.4 Problema: Transição de Equipa Não Aplicada

**Sintoma:**
```
Época 25-26: Contabilidade (ELO=1623)
Época 26-27: Marketing (ELO=1500) ← Deveria ser 1623!
```

**Causa:** `handle_special_team_transitions()` não executou.

**Diagnóstico:**
```bash
# Ver log de transições:
grep -i "transição" mmr_tacaua.log

# Esperado:
# "Transferido ELO de Contabilidade para Marketing no andebol misto: 1623"
```

**Solução:**
```python
# 1. Verificar detecção de modalidade em mmr_taçaua.py:
if "andebol" in sport_name.lower() and "misto" in sport_name.lower():
    # Código deve entrar aqui para andebol misto

# 2. Verificar se Contabilidade existe na época anterior:
cat docs/output/elo_ratings/classificacao_ANDEBOL_MISTO_25_26.csv | grep Contabilidade

# 3. Se ausente, adicionar manualmente:
# Em mmr_taçaua.py, função load_previous_elos():
previous_elos["Contabilidade"] = 1623  # Hardcoded temporário
```

---

### 3.5 Problema: Empates em Voleibol

**Sintoma:**
```csv
Jornada,Equipa 1,Equipa 2,Sets 1,Sets 2
8,Gestão,Economia,1,1  ← IMPOSSÍVEL! (volei é melhor de 3)
```

**Causa:** Dados mal inseridos no Excel (jogo interrompido?).

**Diagnóstico:**
```bash
# Encontrar jogos anómalos de voleibol:
grep "VOLEI" docs/output/csv_modalidades/VOLEIBOL_MASCULINO_26_27.csv | \
    awk -F',' '$NF==$(NF-1) {print}'  # Sets iguais
```

**Solução:**
```bash
# 1. Corrigir Excel manualmente (sets devem ser 2-0, 2-1, 1-2, 0-2)

# 2. Ou marcar como ausência (se jogo não terminou):
# Adicionar "X" na coluna "Falta de Comparência"

# 3. Reprovar extrator:
python src/extrator.py --force-refresh
```

---

## <a name="maintenance"></a> 4. Manutenção e Atualizações

### 4.1 Atualização de Dependências

**Frequência:** ~6 meses ou quando aviso de segurança.

```bash
# 1. Backup do ambiente atual:
pip freeze > requirements_backup_$(date +%F).txt

# 2. Atualizar dependências críticas:
pip install --upgrade numpy scipy scikit-learn pandas

# 3. Testar pipeline completo:
cd src
python extrator.py && \
python mmr_taçaua.py --season 25_26 && \
python calibrator.py && \
python preditor.py --season 26_27 --iterations 1000  # Teste rápido

# 4. Se tudo OK, atualizar requirements.txt:
pip freeze > ../requirements.txt

# 5. Commit:
git add requirements.txt
git commit -m "deps: Atualizar numpy 1.21→1.24, scipy 1.7→1.10"
```

### 4.2 Adicionar Nova Modalidade

**Ver checklist detalhado:** [Seção 5](#new-sport)

### 4.3 Limpeza de Ficheiros Antigos

**Frequência:** Início de nova época (liberar espaço).

```bash
# Arquivar épocas antigas (>2 anos):
cd docs/output

# Criar arquivo tar.gz:
tar -czf archive_23_24.tar.gz \
    csv_modalidades/*_23_24.csv \
    elo_ratings/*_23_24.* \
    previsoes/*_2024*.csv

# Verificar integridade:
tar -tzf archive_23_24.tar.gz | head

# Mover para storage/backup:
mv archive_23_24.tar.gz ../../backups/

# Remover ficheiros locais (CUIDADO!):
rm csv_modalidades/*_23_24.csv
rm elo_ratings/*_23_24.*
rm previsoes/*_2024*.csv

# Commit:
git add -A
git commit -m "chore: Arquivar época 23-24"
```

---

## <a name="new-sport"></a> 5. Checklist de Nova Modalidade

**Exemplo:** Adicionar "TÉNIS DE MESA MASCULINO" à época 26-27.

### Passo 1: Atualizar Configurações

```bash
# 1.1 Adicionar enum em mmr_taçaua.py:
class Sport(Enum):
    # ...
    TENIS_MESA = "tenis_mesa"  # ← NOVO

# 1.2 Atualizar SportDetector:
@staticmethod
def detect_from_filename(filename):
    # ...
    elif "tenis" in filename_lower and "mesa" in filename_lower:
        return Sport.TENIS_MESA

# 1.3 Definir pontuação em PointsCalculator:
def calculate(sport, score1, score2, sets1=None, sets2=None):
    # ...
    elif sport == Sport.TENIS_MESA:
        # Formato: Melhor de 5 sets
        if sets1 >= 3:
            return 2, 0  # Vitória
        elif sets2 >= 3:
            return 0, 2
        else:
            return 1, 1  # Interrompido (raro)
```

### Passo 2: Preparar Dados

```bash
# 2.1 Criar Excel com sheet "Ténis de Mesa M"
#     Colunas obrigatórias:
#       - Jornada
#       - Equipa 1
#       - Equipa 2
#       - Sets 1
#       - Sets 2
#       - Falta de Comparência (vazio se jogo normal)

# 2.2 Executar extrator (primeira vez):
python src/extrator.py --verbose
# Verificar log: "Modalidade detectada: TÉNIS DE MESA MASCULINO"

# 2.3 Validar CSV gerado:
cat docs/output/csv_modalidades/TENIS_DE_MESA_MASCULINO_26_27.csv
```

### Passo 3: Calibrar Modelo

```bash
# 3.1 Determinar tipo de simulação adequado:
#     - Poisson: golos altos (>5/jogo)
#     - Gaussiano: pontos médios variáveis
#     - Sets: formato fixo (2-0, 2-1, etc.)
#
# Ténis de mesa: SETS (como voleibol, mas melhor de 5)

# 3.2 Adicionar em preditor.py (SportScoreSimulator):
self.baselines["tenis_mesa"] = {
    "elo_scale": 450,  # Similar a voleibol
    "p_sweep_base": 0.40,  # Estimar inicial (40% jogos 3-0)
}

# 3.3 Implementar _simulate_tenis_mesa():
def _simulate_tenis_mesa(self, elo_a, elo_b, winner_is_a):
    """Similar a voleibol mas melhor de 5 (3-0, 3-1, 3-2)."""
    elo_diff = abs(elo_a - elo_b)
    p_sweep = 0.40 + min(elo_diff / 700, 0.35)  # Cap 75%
    
    if random() < p_sweep:
        return (3, 0) if winner_is_a else (0, 3)
    
    # 3-1 ou 3-2 (distribuir 50/50):
    if random() < 0.5:
        return (3, 1) if winner_is_a else (1, 3)
    else:
        return (3, 2) if winner_is_a else (2, 3)
```

### Passo 4: Executar Pipeline

```bash
# 4.1 Pipeline completo:
cd src
python extrator.py
python mmr_taçaua.py --season 26_27
python calibrator.py  # Pode dar "insufficient_data" se <10 jogos
python preditor.py --season 26_27

# 4.2 Validar outputs:
ls ../docs/output/previsoes/*TENIS_DE_MESA*.csv
# Esperado: forecast_TENIS_DE_MESA_MASCULINO_2027.csv

# 4.3 Inspeção rápida:
cat ../docs/output/previsoes/forecast_TENIS_DE_MESA_MASCULINO_2027.csv | \
    head -n 5
```

### Passo 5: Documentar

```bash
# 5.1 Atualizar README.md (adicionar à lista de modalidades)
# 5.2 Atualizar SIMULATION_MODELS.md (adicionar MODELO E: Sets Ténis)
# 5.3 Commit:
git add -A
git commit -m "feat(tenis-mesa): Adicionar nova modalidade Ténis de Mesa Masculino"
git push
```

---

## <a name="github-actions"></a> 6. Automação GitHub Actions

### Workflow Atual (.github/workflows/update_predictions.yml)

```yaml
name: Update Predictions Daily

on:
  schedule:
    - cron: '0 1 * * *'  # 01:00 UTC diário
  workflow_dispatch:      # Manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout código
        uses: actions/checkout@v3
      
      - name: Setup Python 3.10
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
          cache: 'pip'
      
      - name: Instalar dependências
        run: |
          pip install -r requirements.txt
      
      - name: Executar pipeline
        run: |
          cd src
          python extrator.py --assume-yes
          python mmr_taçaua.py
          python preditor.py --iterations 50000
      
      - name: Commit resultados
        run: |
          git config user.name "GitHub Actions Bot"
          git config user.email "<>"
          git add docs/output/
          git diff --staged --quiet || \
            git commit -m "auto: Atualização diária $(date +%F)"
          git push
```

### Configurar Secrets (Primeira Vez)

```bash
# 1. Gerar token GitHub:
#    Settings → Developer settings → Personal access tokens
#    Scopes: repo (full), workflow

# 2. Adicionar secret ao repositório:
#    Repo → Settings → Secrets → Actions
#    Nome: ACTIONS_TOKEN
#    Valor: ghp_xxxxxxxxxxxxxxxxxxxx

# 3. Atualizar workflow para usar token:
# Em .github/workflows/update_predictions.yml:
      - name: Push changes
        env:
          GITHUB_TOKEN: ${{ secrets.ACTIONS_TOKEN }}
        run: git push
```

### Troubleshooting GitHub Actions

**Problema:** Workflow falha com "ModuleNotFoundError: numpy"

**Solução:**
```yaml
# Adicionar cache:
- name: Cache Python deps
  uses: actions/cache@v3
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('requirements.txt') }}

# Ou instalar com flags:
pip install -r requirements.txt --no-cache-dir
```

---

## <a name="monitoring"></a> 7. Monitorização e Logs

### Estrutura de Logs

```bash
# Logs criados automaticamente:
mmr_tacaua.log         # ELO calculation logs
calibration.log        # Calibração (se --verbose)
simulation.log         # Preditor (se --log-simulations)
```

### Níveis de Log

```python
# Configuração em cada módulo:
logging.basicConfig(
    level=logging.INFO,  # DEBUG | INFO | WARNING | ERROR
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    filename="mmr_tacaua.log"
)
```

### Analisar Logs

```bash
# Ver erros recentes:
grep ERROR mmr_tacaua.log | tail -n 20

# Contar avisos de normalização:
grep "Placeholder de playoff" mmr_tacaua.log | wc -l

# Timeline de K-factor aplicado:
grep "K_factor aplicado" mmr_tacaua.log | \
    awk '{print $1, $2, $NF}' | \
    tail -n 50
```

### Métricas de Performance

```bash
# Tempo de execução por fase:
time python src/extrator.py        # ~30s
time python src/mmr_taçaua.py      # ~2-3 min
time python src/calibrator.py      # ~1 min
time python src/preditor.py        # ~5 min (1M iter)

# Uso de memória (Linux):
/usr/bin/time -v python src/preditor.py 2>&1 | grep "Maximum resident"
```

---

## Conclusão

**Pipeline maduro e robusto:**
- ✓ Automação completa via GitHub Actions
- ✓ Troubleshooting documentado (5 cenários comuns)
- ✓ Procedimentos operacionais detalhados
- ✓ Checklist de nova modalidade (12 passos)

**SLOs recomendados:**
- Atualização semanal: <10 min (manual) | <5 min (automática)
- Disponibilidade site: >99.5% uptime
- Precisão (Brier Score): <0.15 para modalidades principais

---

**Última atualização:** 2026-03-02  
**Autor:** Sistema Taça UA  
**Próxima revisão:** 2026-09-01 (início época 26-27)
