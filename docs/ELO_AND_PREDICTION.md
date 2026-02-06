# Documentação Técnica: Sistema de ELO e Motor de Previsão

Esta documentação providencia uma análise aprofundada dos algoritmos matemáticos e estatísticos utilizados no projeto `mmr_taçaua`.

---

## 🏗️ 1. Arquitetura do Sistema ELO (`CompleteTacauaEloSystem`)

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

1.  **Fase de Calibração (Início da Época):**
    Nos primeiros 33% dos jogos, o K é amplificado para permitir que novas equipas atinjam rapidamente o seu "verdadeiro" ELO.
    $$ M_{fase} = \frac{1}{\log_{16}(4 \times progresso_{scaled})} $$

2.  **Pós-Inverno (Recalibração):**
    Após a pausa semestral, aplica-se uma lógica similar para reajustar equipas que possam ter mudado de forma.

3.  **Playoffs:** $M_{fase} = 1.5$ (50% mais impacto).
4.  **Jogos de 3º/4º Lugar:** $M_{fase} = 0.75$ (25% menos impacto).

#### B. Multiplicador de Proporção ($M_{proporcao}$) - "Margin of Victory"
Para evitar que vitórias por 1-0 ou 10-0 tenham o mesmo peso, usamos um multiplicador logarítmico suave:

$$ M_{proporcao} = \left( \frac{\max(Golos_A, Golos_B)}{\min(Golos_A, Golos_B)} \right)^{1/10} $$

> **Exemplo:** Uma vitória por 10-1 resulta num multiplicador de $10^{0.1} \approx 1.26$. O vencedor ganha 26% mais pontos do que numa vitória tangencial. A raiz décima impede inflação excessiva de pontos em desportos de alta pontuação.

---

## 🔮 2. Motor de Simulação (`SportScoreSimulator`)

O `preditor.py` utiliza simulação de Monte Carlo para prever o futuro. Em vez de prever apenas o vencedor, simula **resultados exatos** para cada jogo.

### 2.1 Modelos Estatísticos por Desporto

O simulador distingue entre tipos de desporto para gerar resultados realistas:

#### Tipo A: Futebol/Futsal (Distribuição de Poisson)
Desportos de baixa pontuação são modelados como processos de Poisson independentes para cada equipa.
- **Lambda ($\lambda$):** A média de golos esperada para uma equipa num jogo é derivada do seu ELO relativo.
  - Se ELO > Adversário: $\lambda$ aumenta.
  - Se ELO < Adversário: $\lambda$ diminui.
  - Média base: ~2.5 golos/jogo (ajustável).

$$ Golos \sim Poisson(\lambda_{ELO}) $$
$$ P(k \text{ golos}) = \frac{\lambda^k e^{-\lambda}}{k!} $$

> Isto permite a ocorrência natural de empates (quando Poisson(A) == Poisson(B)).

#### Tipo B: Basquetebol/Andebol (Distribuição Normal)
Desportos de alta pontuação seguem uma distribuição Normal (Gaussiana).
- **Média ($\mu$):** Baseada no ELO (ex: equipa forte média 60 pontos, fraca 40).
- **Desvio Padrão ($\sigma$):** Fixo por modalidade (ex: 15 pontos no basquete), permitindo "upsets".

$$ Pontos \sim \mathcal{N}(\mu_{ELO}, \sigma^2) $$

> **Destaque:** No basquetebol, o modelo previne empates forçando prolongamento (adiciona simulação de 5 min se Scores iguais).

#### Tipo C: Voleibol (Simulação Set-a-Set)
Simula cada set individualmente como uma Bernoulli Trial baseada nas probabilidades de ELO.
- Vence o jogo quem chegar primeiro a 2 (Melhor de 3) ou 3 (Melhor de 5) sets.
- O resultado é sempre exato (ex: 3-0, 3-2, 2-1).

### 2.2 Pipeline de Monte Carlo
Para prever a classificação final:

1.  **Estado Inicial:** Carrega classificação atual e ELOs atuais.
2.  **Iteração (x10.000):**
    - Para cada jogo futuro no calendário:
        a. Determina ELOs atuais das equipas.
        b. `SportScoreSimulator` gera um resultado (ex: 3-1).
        c. Atualiza os ELOs das equipas (o sistema aprende durante a simulação!).
        d. Atualiza a classificação virtual.
    - No final da época virtual, determina o Campeão e lugares de Playoff.
3.  **Agregação:**
    - Conta quantas vezes a Equipa X foi campeã em 10.000 universos paralelos.
    - Resultado: "Equipa X tem 24.5% de probabilidade de ser Campeã".

---

## ⚙️ 3. Otimizações de Performance (Windows/Linux)

O sistema foi altamente otimizado para performance computacional (`src/preditor.py`):

### Paralelismo (`ProcessPoolExecutor`)
Devido ao **GIL (Global Interpreter Lock)** do Python, threads normais não aceleram simulações de CPU intensivo.
- O sistema usa `multiprocessing` para lançar processos operários independentes.
- Cada processo corre uma fatia das 10.000 simulações em paralelo (ex: 4 cores = 2.500 sims cada).

### Compatibilidade Windows
O módulo `multiprocessing` no Windows obriga a que o código principal esteja protegido por `if __name__ == "__main__":`.
- O script deteta o SO e usa `spawn` (Windows) ou `fork` (Linux).
- Configura automaticamente o `locale` e encoding para lidar com UTF-8 no terminal Windows (powershell).

---

## 🧪 4. Validação (Backtesting)

O ficheiro `src/backtest_validation.py` permite validar se o modelo é fiável.

### Brier Score
Mede a precisão das probabilidades probabilísticas.
$$ BS = \frac{1}{N} \sum (ProbabilidadePrevista - ResultadoReal)^2 $$
- **0.0:** Pervisão perfeita.
- **0.25:** Chute aleatório (50/50).
- O nosso modelo visa **BS < 0.15**.

### RMSE (Root Mean Square Error)
Mede o erro médio na previsão da posição final na tabela.
- Se o modelo diz que equipa fica em 2º e ela fica em 4º, erro = 2.
