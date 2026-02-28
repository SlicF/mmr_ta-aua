# Documentação Técnica: Sistema de ELO e Motor de Previsão

Documentação técnica dos algoritmos ELO, sistema de calibração de parâmetros e motor de simulação Monte Carlo implementados no projeto `mmr_taçaua`.

---

## 1. Arquitetura do Sistema ELO (`CompleteTacauaEloSystem`)

A classe `CompleteTacauaEloSystem` (em `src/preditor.py` e `src/mmr_taçaua.py`) implementa um modelo ELO modificado, especificamente calibrado para o contexto da Taça UA.

### 1.1 Fórmula Fundamental

Ao contrário do ELO clássico (binário: ganha/perde), o nosso sistema é contínuo e sensível à margem de vitória.

$$ \Delta ELO = K \times (Score_{real} - Score_{esperado}) $$

**Parâmetros:**

- **K (Fator de Volatilidade):** Determina o quanto um único jogo afeta o ranking.
- **Score Esperado:** Probabilidade a priori baseada na diferença de força.
- **Score Real:** Resultado normalizado do jogo.

### 1.2 Win Probability (Função Logística)

A probabilidade esperada de vitória da Equipa A contra Equipa B é calculada usando uma curva logística com base 10:

$$ P(A) = \frac{1}{1 + 10^{(ELO_B - ELO_A)/250}} $$

> **Nota Técnica:** O divisor **250** (em vez do padrão 400 do xadrez) aumenta a sensibilidade do modelo. Uma diferença de 250 pontos ELO implica 90% de probabilidade de vitória, enquanto no xadrez seriam precisos 400 pontos. Isto reflete a maior variância e desnível entre equipas universitárias.

### 1.3 Fator K Dinâmico ($K_{factor}$)

O grande diferencial deste sistema é o $K$ dinâmico, calculado jogo a jogo:

$$ K = K_{base} \times M_{fase} \times M_{proporcao} $$

Onde $K_{base} = 100$.

#### A. Multiplicador de Fase ($M_{fase}$) - "Season Phase Multiplier"

O peso dos jogos varia temporalmente e contextualmente:

1. __Fase de Calibração (Início da Época):__
   Nos primeiros 33% dos jogos, o K é amplificado para permitir que novas equipas atinjam rapidamente o seu "verdadeiro" ELO.
   $$ M_{fase} = \frac{1}{\log_{16}(4 \times progresso_{scaled})} $$
2. **Pós-Inverno (Recalibração):**
   Após a pausa semestral, aplica-se uma lógica similar para reajustar equipas que possam ter mudado de forma.
3. __Playoffs:__ $M_{fase} = 1.5$ (50% mais impacto).
4. __Jogos de 3º/4º Lugar:__ $M_{fase} = 0.75$ (25% menos impacto).

#### B. Multiplicador de Proporção ($M_{proporcao}$) - "Margin of Victory"

Para evitar que vitórias por 1-0 ou 10-0 tenham o mesmo peso, usamos um multiplicador logarítmico suave:

$$ M_{proporcao} = \left( \frac{\max(Golos_A, Golos_B)}{\min(Golos_A, Golos_B)} \right)^{1/10} $$

> **Exemplo:** Uma vitória por 10-1 resulta num multiplicador de $10^{0.1} \approx 1.26$. O vencedor ganha 26% mais pontos do que numa vitória tangencial. A raiz décima impede inflação excessiva de pontos em desportos de alta pontuação.

---

## 2. Sistema de Calibração Automática (`FullCalibrator`)

O `calibrator.py` implementa aprendizagem de parâmetros a partir de dados históricos para cada modalidade. O sistema calibra separadamente por divisão e ajusta os parâmetros do simulador para refletir características reais de cada desporto.

### 2.1 Pipeline de Calibração

1. **Carregamento de Dados** (`HistoricalDataLoader`):
   - Lê CSVs históricos de resultados por modalidade
   - **Filtragem de ausências:** Remove jogos com "Falta de Comparência" (campo `has_absence`)
   - Razão: Ausências distorcem médias de golos (resultados como 3-0 técnico inflacionam artificialmente `base_goals`)

2. **Calibração de Distribuição de Golos** (`GoalsDistributionCalibrator`):
   - Calcula `base_goals`: média de golos por equipa
   - Calcula `dispersion_k`: parâmetro de sobredispersão Gamma-Poisson
   - **Floor de dispersão:** `dispersion_k ≥ 3.0` (previne variância excessiva em datasets pequenos)
   - Fórmula: $k = \frac{\mu^2}{\sigma^2 - \mu}$ onde $\mu$ = média, $\sigma^2$ = variância

3. **Calibração de Probabilidade de Empate** (`DrawProbabilityCalibrator`):
   - Ajusta regressão logística: $P(empate) = \frac{1}{1 + e^{-(a + b \times diff\_elo)}}$
   - **Validação de suficiência:** Requer $n\_empates ≥ 5$ para evitar overfitting
   - **Sanidade do modelo:** Rejeita se $|intercept| > 100$ ou $|coef\_linear| > 10$
   - Caso rejeitado: retorna modelo zero (usa Gaussiana-based draw em vez de logística)

### 2.2 Parâmetros Calibrados por Modalidade

O sistema exporta parâmetros específicos conforme o tipo de desporto (ficheiro `calibrated_simulator_config.json`):

**Parâmetros Universais:**
- `base_goals`: Média de golos/pontos por equipa
- `dispersion_k`: Parâmetro de forma Gamma (sobredispersão Poisson)
- `elo_adjustment_limit`: Limite máximo de ajuste ELO por jogo (previne spread excessivo)
- `draw_model`: Coeficientes da regressão logística (`intercept`, `coef_linear`, `coef_quadratic`)
- `draw_multiplier`: Fator de ajuste fino para taxa de empates

**Parâmetros Específicos de Basquetebol:**
- `base_score`: Pontuação média por equipa (substitui `base_goals` para Gaussiana)
- `sigma`: Desvio padrão da distribuição Normal de pontos

**Parâmetros Específicos de Voleibol:**
- `p_sweep_base`: Probabilidade base de vitória por 2-0 (calculada de sweeps históricos)
- Calculado como: $p\_sweep = \frac{\text{número de 2-0}}{\text{total de jogos}}$

### 2.3 Valores Típicos de `elo_adjustment_limit`

### 2.4 Exemplos de Calibração Real

**Basquetebol (modelo específico):**
- **Média ($\mu$):** Usa `base_score` calibrado (não `base_goals`)
- **Desvio Padrão ($\sigma$):** Calibrado por divisão (ex: 4.67 masculino, 6.21 feminino)
- Ajuste ELO: $\mu_{ajustado} = base\_score + elo\_diff \times limit$

**Andebol:**
- Usa mesma fórmula Gaussiana mas com `base_goals` calibrado (~20.5)
- `elo_adjustment_limit = 0.45` (previne spread excessivo: evita jogos 5-40)

**Futsal Feminino (caso de dataset limitado):**
- Apenas 1 empate em 66 jogos históricos
- Sistema rejeitou `draw_model` (insuficientes empates)
- `dispersion_k` original: 1.38 → Forçado a 3.0 (floor)
- Resultado: Previne overfitting e variância artificial

**Diferenças-chave:**
- Andebol: Permite empates (se arredondamentos coincidem)
- Basquetebol: Força prolongamento se scores iguais (adiciona simulação de 5min)

**Voleibol (sweeps):**
- P_sweep hardcoded antigo: 35%
- P_sweep calibrado: 68.7% (feminino), 71.9% (masculino)
- Melhoria: 2-0 agora é resultado dominante (realista)

---

## 3. Motor de Simulação (`SportScoreSimulator`)

O `preditor.py` utiliza simulação Monte Carlo com parâmetros calibrados. Simula resultados exatos (não apenas vencedor) usando distribuições estatísticas apropriadas por modalidade.

### 2.1 Modelos Estatísticos por Desporto

Cada modalidade usa um modelo estatístico distinto. Parâmetros ($\lambda$, $\mu$, $\sigma$) são ajustados dinamicamente com base no ELO relativo e valores calibrados.

#### Tipo A: Futsal/Futebol 7 (Gamma-Poisson Overdispersion)

Desportos de baixa pontuação usam Poisson com multiplicação Gamma para capturar sobredispersão.

**Processo:**
1. Calcula $\lambda_{base}$ a partir de `base_goals` calibrado
2. Ajusta por ELO relativo: $\lambda_{ajustado} = \lambda_{base} \times (1 + elo\_diff \times limit)$
3. Aplica multiplicação Gamma: $multiplier \sim Gamma(k, \theta)$ onde $k =$ `dispersion_k`

4. **Clip de multiplicação:** $[0.75, 1.30]$ para `base_goals > 10`, $[0.5, 1.8]$ caso contrário6. **Max lambda:** Limitado a $base \times 1.4$ (desportos alta pontuação) ou $base \times 2.0$ (baixa)
5. $\lambda_{final} = \lambda_{ajustado} \times multiplier$

$$ Golos \sim Poisson(\lambda_{final}) $$
$$ P(k \text{ golos}) = \frac{\lambda^k e^{-\lambda}}{k!} $$

**Vantagem:** Permite empates naturais (quando Poisson(A) == Poisson(B)) e variância realista.

#### Tipo B: Basquetebol/Andebol (Distribuição Gaussiana)

Desportos de alta pontuação seguem uma distribuição Normal (Gaussiana).

Desportos de alta pontuação seguem distribuição Normal.

**Basquetebol (modelo específico):**

- **Média ($\mu$):** Usa `base_score` calibrado (não `base_goals`)- `elo_adjustment_limit = 0.45` (previne spread excessivo: evita jogos 5-40)

- **Desvio Padrão ($\sigma$):** Calibrado por divisão (ex: 4.67 masculino, 6.21 feminino)- Usa mesma fórmula Gaussiana mas com `base_goals` calibrado (~20.5)

- Ajuste ELO: $\mu_{ajustado} = base\_score + elo\_diff \times limit$**Andebol:**

> **Destaque:** No basquetebol, o modelo previne empates forçando prolongamento (adiciona simulação de 5 min se Scores iguais).

#### Tipo C: Voleibol (Simulação Binária por Sets)

Cada set é uma Bernoulli trial com probabilidade ajustada por ELO e `p_sweep_base` calibrado.

**Processo:**
1. Calcula $P(A\_vence\_set)$ via ELO logistic function

2. Ajusta por `p_sweep_base` calibrado (~69-72% histórico)**Nota:** `p_sweep_base` substituí valor hardcoded antigo (35%) por realidade histórica.

3. Simula sets até vitória (Melhor de 3: primeiro a 2; Melhor de 5: primeiro a 3)
4. Resultado sempre exato: 2-0, 2-1, 3-0, 3-1, 3-2

### 2.2 Pipeline de Monte Carlo

Fluxo para gerar previsões de classificação final e probabilidades por jogo:

1. **Carregamento:** Classificação atual, ELOs atuais, parâmetros calibrados (`calibrated_simulator_config.json`)
2. **Iteração Monte Carlo (N = 10k / 100k / 1M):**

   - Para cada jogo futuro no calendário:
      a. Obtém ELOs atuais das equipas na simulação
      b. `SportScoreSimulator` gera resultado usando parâmetros calibrados (ex: 3-1)
      c. Atualiza ELOs com K-factor dinâmico
      d. Atualiza classificação virtual (pontos, vitórias, golos)
      e. Regista placar para estatísticas de distribuição
   - Fim da época virtual: determina campeão e vaga playoffs

3. **Agregação de resultados:**

   - Frequentist probabilities: "Equipa X foi campeã em 2450/10000 universos → 24.5%"
   - Distribuição de placares: probabilidade de cada score exato
   - Expected goals: média ponderada $E[G_A] = \sum_i p_i \times g_{A,i}$
   - Expected ELO: média de ELO no momento do jogo (reflete evolução esperada)

### 2.3 Estatísticas de Saída

Para cada jogo futuro, o sistema calcula e exporta:

**Probabilidades de Resultado:**

**Golos Esperados (Expected Goals):**

- Média ponderada de golos para cada equipa com base na distribuição de placares
- Cálculo: $E[G_A] = \sum_i p_i \times g_{A,i}$ onde $p_i$ é a probabilidade do placar $i$
- Desvio padrão: $\sigma = \sqrt{\sum_i p_i \times (g_{A,i} - E[G_A])^2}$

**Distribuição Completa de Placares:**

- Lista de todos os placares observados nas simulações com suas frequências
- Permite análise detalhada de cenários mais prováveis (ex: "2-1: 15.3%, 1-1: 12.7%, 3-1: 10.2%")

**ELO Esperado no Momento do Jogo:**

- Média e desvio padrão do ELO de cada equipa no momento do jogo
- Reflete a evolução esperada dos ELOs ao longo da época simulada

O número de simulações utilizado é incluído no nome do ficheiro (ex: `previsoes_FUTSAL_MASCULINO_2026_100000.csv`), permitindo rastreabilidade e comparação entre diferentes níveis de precisão.

---

## 3. Otimizações de Performance (Windows/Linux)

O sistema foi altamente otimizado para performance computacional (`src/preditor.py`):

### Paralelismo (`ProcessPoolExecutor`)

Devido ao **GIL (Global Interpreter Lock)** do Python, threads normais não aceleram simulações de CPU intensivo.

- Multiprocessing contorna GIL (Global Interpreter Lock)
- Cada processo corre fração das iterações em paralelo
- **Normal:** 10.000 sims (~30s, 4 cores = 2.500 sims/core)

- **Deep:** 100.000 sims (~5min, reduz variância estatística)- **Deeper:** 1.000.000 sims (~45min, máxima precisão)

### Compatibilidade Multiplataforma

**Windows:** Usa `spawn` (obriga `if __name__ == "__main__":` protection), configura UTF-8 encoding.

**Linux/macOS:** Usa `fork` (mais rápido, copia memória do processo pai).

- O script deteta o SO e usa `spawn` (Windows) ou `fork` (Linux).
- Configura automaticamente o `locale` e encoding para lidar com UTF-8 no terminal Windows (powershell).

### Gestão de Ficheiros de Previsão

O sistema implementa gestão automática dos ficheiros de saída para evitar acumulação de previsões desatualizadas:

__Limpeza Automática (`mmr_taçaua.py`):__

- No início da execução, apaga automaticamente todos os ficheiros CSV da pasta `/docs/output/previsoes/`
- Garante que apenas as classificações e ELOs mais recentes são usados para gerar previsões
- Previne confusão entre previsões de diferentes épocas ou estados do sistema

**Nomenclatura com Rastreabilidade (`preditor.py`):**

- Os ficheiros de saída incluem o número de simulações no nome (ex: `forecast_FUTSAL_FEMININO_2026_10000.csv`)
- Permite comparar resultados com diferentes níveis de precisão
- Formato: `[tipo]_[modalidade]_[ano]_[nsimulações].csv`
- Ficheiros de cenários "what-if" incluem sufixo `_hardset`

Esta abordagem garante que o pipeline de dados mantém consistência entre as fases de cálculo de ELO e geração de previsões.

---

## 4. Validação e Métricas (Backtesting)

O `src/backtest_validation.py` testa precisão de previsões históricas (time-travel testing).

### 4.1 Brier Score

Mede calibração de probabilidades (penaliza confiança excessiva).
$$ BS = \frac{1}{N} \sum_{i=1}^{N} (p_i - o_i)^2 $$

Onde $p_i$ = probabilidade prevista, $o_i \in \{0,1\}$ = resultado real.

**Interpretação:**
- **0.0:** Previsão perfeita (irreal)
- **0.25:** Baseline aleatório (50/50)
- **< 0.15:** Modelo razoável para desportos universitários
- **> 0.30:** Pior que chute aleatório

**Nota:** Dados universitários têm inerente alta variância (upsets frequentes, equipas voláteis).

### 4.2 RMSE (Root Mean Square Error)

Avalia precisão de previsão de classificação final:
$$ RMSE = \sqrt{\frac{1}{N} \sum_{i=1}^{N} (pos_{prevista,i} - pos_{real,i})^2} $$

**Exemplo:** Se modelo prevê 2º lugar mas equipa termina em 4º: erro individual = 2 posições.

**Valores típicos:**
- RMSE < 1.5: Excelente (raro em desportos amadores)
- RMSE 1.5-2.5: Bom (captura tendências principais)
- RMSE > 3.0: Modelo precisa recalibração

### 4.3 Limitações de Validação

**Dados limitados:**
- Épocas universitárias têm ~30-80 jogos/modalidade
- Pequenas amostras dificultam significância estatística

**Alta volatilidade:**
- Equipas amadoras têm maior variância skill que profissionais
- Lesões, calendário académico, motivação afetam performance

**Overfitting risk:**
- Calibração em datasets pequenos pode superajustar a ruído
- Daí validações como min 5 empates, floor dispersion_k, sanity checks

---

## 5. Pipeline Completo de Execução

Ordem de execução e dependências entre módulos:

### 5.1 Fluxo Manual

```bash
cd src
python extrator.py      # 1. Extrai dados de Excels → CSVs normalizados
python mmr_taçaua.py    # 2. Calcula ELOs e classificações atuais
python calibrator.py    # 3. Aprende parâmetros de simulação (histórico)
python preditor.py      # 4. Gera previsões (10k sims, ~30s)
```

**Detalhe de cada etapa:**

1. **extrator.py:**
   - Input: `/data/Resultados Taça UA*.xlsx`
   - Output: `/docs/output/csv_modalidades/*.csv`
   - Normaliza formatos (nomes de equipas, datas, códigos de modalidade)

2. **mmr_taçaua.py:**
   - Input: CSVs de modalidades
   - Output: `/docs/output/elo_ratings/classificacao_*.csv` (ELOs atuais)
   - **Side-effect:** Apaga `/docs/output/previsoes/*.csv` (previne previsões desatualizadas)
   - Calcula histórico completo de ELO jogo-a-jogo

3. **calibrator.py:**
   - Input: CSVs históricos (24_25 + 25_26)
   - Output: `/docs/output/calibration/calibrated_simulator_config.json`
   - Filtra ausências, valida draw_models, exporta parâmetros por modalidade/divisão

4. **preditor.py:**
   - Input: ELOs atuais + config calibrado + calendário futuro
   - Output: `/docs/output/previsoes/forecast_*.csv` + `previsoes_*.csv`
   - Modes: `--deep-simulation` (100k), `--deeper-simulation` (1M)

### 5.2 Automação (GitHub Actions)

Workflow `.github/workflows/updater.yml` executa diariamente (1h UTC):

```yaml
extrator.py → mmr_taçaua.py → calibrator.py → preditor.py (normal)
→ commit/push → preditor.py --deep-simulation → commit/push
→ preditor.py --deeper-simulation → commit/push final
```

**Vantagens:**
- 3 níveis de precisão disponíveis simultaneamente (10k/100k/1M)
- Commits incrementais permitem rollback se alguma etapa falhar
- Ficheiros nomeados com número de sims permitem comparação

### 5.3 Dependências Críticas

**Ordem é importante:**
- `calibrator.py` **DEVE** rodar **APÓS** `mmr_taçaua.py` (precisa de CSVs atualizados)
- `preditor.py` **DEVE** rodar **APÓS** `calibrator.py` (senão usa parâmetros desatualizados)
- `preditor.py` carrega `calibrated_simulator_config.json` automaticamente (flag ignored)

**Quando pular calibração:**
- Se não houve jogos novos (dados históricos inalterados)
- Testes rápidos com `--modalidade "FUTSAL MASCULINO"` (usa config existente)

**Quando forçar recalibração:**
- Após adicionar época nova aos CSVs
- Após mudanças em filtros/validações (ex: alterar min_empates threshold)
- Quando backtest mostra deterioração de métricas
