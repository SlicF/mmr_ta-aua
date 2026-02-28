# Taça UA - Sistema de Classificação e Previsão

Sistema de classificação ELO e previsão probabilística para a **Taça Universidade de Aveiro**. Implementa um modelo ELO modificado com K-factor dinâmico, calibração automática de parâmetros a partir de dados históricos, e simulação Monte Carlo para previsões multi-jogo.

__Website:__ [https://slicf.github.io/mmr_ta-aua/](https://slicf.github.io/mmr_ta-aua/)

## Estrutura do Repositório

O projeto segue uma estrutura organizada para separar código, dados e interface web:

- **`/src`**: Código fonte Python (pipeline de processamento).

   - `extrator.py`: Extrai dados dos ficheiros Excel oficiais.
   - `mmr_taçaua.py`: Processa torneios e calcula classificações ELO.
   - `calibrator.py`: Calibra parâmetros de simulação a partir de dados históricos.
   - `preditor.py`: Motor de simulação Monte Carlo para previsões.
   - `backtest_validation.py`: Valida a precisão das previsões contra dados históricos.

- **`/docs`**: Interface Web e Dados Públicos (Github Pages).

   - `index.html` & `app.js`: Dashboard interativo.
   - `/output`: Dados gerados (CSVs de classificações, ELOs, previsões).
   - `/config`: Configurações de cursos e cores.
   - `/assets`: Logótipos e imagens.

- **`/data`**: Ficheiros de entrada (Excels brutos da AAUAv).

## Como Funciona

### 1. Extração de Dados

O sistema lê os ficheiros Excel de resultados (`data/Resultados Taça UA...xlsx`) e converte-os para um formato normalizado.

### 2. Cálculo de ELO

Utiliza um algoritmo ELO modificado que considera margem de vitória, fase da época e força do adversário. K-factor dinâmico ajusta-se automaticamente conforme o progresso da época e contexto do jogo (playoffs, calibração inicial, etc.).
__[Ver Documentação Completa do Sistema ELO e Calibração](docs/ELO_AND_PREDICTION.md)__

### 3. Calibração de Parâmetros

O sistema aprende parâmetros de simulação (médias de golos, dispersão, probabilidades de empate) a partir de dados históricos. Filtra jogos com ausências, valida modelos estatísticos (ex: mínimo 5 empates para regressão logística) e exporta configurações específicas por modalidade.

### 4. Previsão (Monte Carlo)

O motor de simulação utiliza os parâmetros calibrados para simular a época completa múltiplas vezes (10.000/100.000/1.000.000 iterações). Cada modalidade usa distribuições apropriadas: Gamma-Poisson (futsal/andebol/futebol), Gaussiana (basquetebol), binária por sets (voleibol).

## Detalhes Técnicos (Calibração)

### Parâmetros Aprendidos Automaticamente

O sistema calibra parâmetros específicos por modalidade/divisão a partir de ~100-200 jogos históricos (épocas 24/25 + 25/26):

**Comuns:**
- `base_goals`: Média de golos por equipa (Futsal: 3.2, Andebol: 20.5, Futebol 7: 2.4)
- `dispersion_k`: Sobredispersão Gamma-Poisson (floor: 3.0, previne variância artificial)
- `elo_adjustment_limit`: Limite máximo de ajuste ELO para evitar spreads irrealistas
- `draw_model`: Regressão logística (validada: requer ≥5 empates históricos)

**Basquetebol (3x3):**
- `base_score`: 9.51 (masc), 8.84 (fem) — substituiu hardcode 15
- `sigma`: 4.67 (masc), 6.21 (fem) — desvio padrão Gaussiano

**Voleibol:**
- `p_sweep_base`: 68.7% (fem), 71.9% (masc) — taxa real de 2-0 vs hardcode antigo 35%

**Filtragens aplicadas:**
- Remove jogos com "Falta de Comparência" (distorcem médias)
- Rejeita draw_models instáveis (|intercept| > 100 ou |coef_linear| > 10)

### Aplicação de Parâmetros

Ordem de precedência no `preditor.py`:
1. Valores calibrados específicos de divisão (`calibrated_simulator_config.json`)
2. Valores default atualizados (se calibração falhar para divisão específica)
3. Fallback hardcoded (segurança, raramente usado)

O sistema sempre carrega configuração calibrada quando disponível — flag `use_calibrated` é ignorada para garantir consistência.

## Instalação e Uso

1. **Instalar dependências**:

```bash
pip install -r requirements.txt

```

2. **Executar pipeline completo**:

```bash
cd src
python extrator.py    # Atualiza dados dos Excels
python mmr_taçaua.py  # Recalcula ELOs e Classificações (apaga previsões antigas automaticamente)
python calibrator.py  # Calibra parâmetros a partir de dados históricos
python preditor.py    # Gera previsões (padrão: 10.000 simulações)

```

O `preditor.py` suporta diferentes níveis de precisão:

- **Normal:** `python preditor.py` → 10.000 simulações (~30s)
- **Deep:** `python preditor.py --deep-simulation` → 100.000 simulações (~5min)
- **Deeper:** `python preditor.py --deeper-simulation` → 1.000.000 simulações (~45min)

O número de simulações é incluído no nome dos ficheiros (ex: `forecast_FUTSAL_FEMININO_2026_100000.csv`). Simulações deep/deeper reduzem variância estatística mas aumentam tempo de execução proporcionalmente.

### Formato dos Ficheiros de Previsão

Os ficheiros CSV gerados em `/docs/output/previsoes/` contêm as seguintes informações por jogo:

__Ficheiros `previsoes_*_[nsims].csv`:__

- `jornada`, `dia`, `hora`: Informação do calendário
- `team_a`, `team_b`: Equipas em confronto
- `expected_elo_a`, `expected_elo_a_std`: ELO esperado da equipa A e desvio padrão
- `expected_elo_b`, `expected_elo_b_std`: ELO esperado da equipa B e desvio padrão
- `prob_vitoria_a`, `prob_empate`, `prob_vitoria_b`: Probabilidades de cada resultado (%)
- `expected_goals_a`, `expected_goals_a_std`: Golos esperados para equipa A e desvio padrão
- `expected_goals_b`, `expected_goals_b_std`: Golos esperados para equipa B e desvio padrão
- `distribuicao_placares`: Distribuição completa de placares possíveis com probabilidades

__Ficheiros `forecast_*_[nsims].csv`:__

- Probabilidades de playoffs, meias-finais, finais e títulos por equipa
- Pontos esperados e classificação esperada com desvios padrão
- ELO final esperado após simulação da época completa
- __Campo `expected_place_in_group`:__ Posição esperada __dentro do grupo/divisão__ da equipa (não global)

__Nota:__ O `mmr_taçaua.py` apaga automaticamente ficheiros antigos da pasta `previsoes/` antes de processar, garantindo que apenas previsões atualizadas estão disponíveis.

## Compatibilidade Multiplataforma

O projeto roda em Windows, Linux e macOS com as seguintes adaptações:

**Windows:**
- Multiprocessing usa `spawn` (obriga `if __name__ == "__main__":` protection)
- UTF-8 forçado via `sys.stdout.reconfigure()` para compatibilidade de consola
- Paths normalizados com `/` ou `os.path.join`

**Linux/macOS:**
- Multiprocessing usa `fork` (mais rápido, copia memória do processo pai)
- UTF-8 geralmente nativo

**ProcessPoolExecutor:**
- Detecta número de cores automaticamente (`os.cpu_count()`)
- Divide iterações Monte Carlo por workers (ex: 4 cores = 2500 sims/core em modo normal)

Exemplo de execução PowerShell:

```powershell
# Opcional, mas recomendado para visualizar emojis/caracteres corretamente
Set-ItemEnv -Path env:PYTHONUTF8 -Value 1
cd src
python extrator.py

```

## Website

O dashboard está disponível publicamente via GitHub Pages. Os dados na pasta `/docs` são servidos automaticamente.

## Validação e Backtesting

Testa precisão de previsões históricas usando time-travel (simula épocas passadas e compara com resultados reais).

```bash
cd src
python backtest_validation.py

```

**Métricas calculadas:**
- **Brier Score:** Calibração de probabilidades (objetivo: < 0.15)
- **RMSE:** Erro de posição final na tabela (objetivo: < 2.5)

Datasets universitários têm inerente alta variância devido a tamanho de amostra limitado (~30-80 jogos/modalidade) e volatilidade de equipas amadoras.
