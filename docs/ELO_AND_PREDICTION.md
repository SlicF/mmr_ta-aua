# Sistema de ELO e Preditor da Taça UA

Este documento detalha o funcionamento matemático e lógico por trás do sistema de rankings (ELO) e do motor de previsões utilizados na Taça UA.

## 1. Sistema ELO (CompleteTacauaEloSystem)

O sistema de classificação utiliza uma variante personalizada do sistema ELO, adaptada para ligas desportivas universitárias com fases de grupos, playoffs e pausas de inverno.

### Fórmula Base
A atualização do ELO após cada jogo segue a fórmula clássica:

$$ \Delta ELO = K \times (Score_{real} - Score_{esperado}) $$

Onde:
- **Score_esperado**: Probabilidade de vitória da equipa A sobre a B.
  $$ P(A) = \frac{1}{1 + 10^{(ELO_B - ELO_A)/250}} $$
  *(Nota: O divisor 250 aumenta a sensibilidade comparado com o padrão de 400 do xadrez)*

- **Score_real**:
  - Vitória: 1.0
  - Empate: 0.5
  - Derrota: 0.0

### Fator K Dinâmico ($K_{factor}$)
O fator K determina a volatilidade do ranking. No nosso sistema, ele não é estático, mas calculado para cada jogo:

$$ K = K_{base} \times M_{fase} \times M_{proporcao} $$

#### 1. K Base ($K_{base}$)
O valor base é **100**.

#### 2. Multiplicador de Fase ($M_{fase}$)
Ajusta o impacto do jogo consoante o momento da época:

- **Playoffs**: `1.5` (Jogos decisivos valem mais)
- **Terceiro Lugar (E3L)**: `0.75` (Jogos de consolação valem menos)
- **Início da Época (primeiro 1/3)**: Valor elevado para permitir calibração rápida.
  $$ \frac{1}{\log_{16}(4 \times progresso)} $$
- **Pós-Inverno**: Aceleração temporária para recalibrar equipas após a pausa.
- **Fase Regular (restante)**: `1.0`

#### 3. Multiplicador de Proporção ($M_{proporcao}$)
Recompensa vitórias expressivas (goleadas), mas com retornos decrescentes (raiz décima):

$$ M_{proporcao} = \max(\frac{Golos_A}{Golos_B}, \frac{Golos_B}{Golos_A})^{1/10} $$

*(Se golos = 0, assume-se 0.5 para evitar divisão por zero)*

---

## 2. Motor de Previsão (Preditor)

O sistema não se limita a calcular o passado; ele simula o futuro utilizando **Simulação de Monte Carlo**.

### Metodologia
Para prever o desfecho da época:
1. O sistema simula os jogos restantes milhares de vezes (ex: 10.000 iterações).
2. Em cada simulação, cada jogo futuro é jogado virtualmente.
3. Os resultados são agregados para calcular probabilidades finais (ex: % de ser Campeão, % de ir aos Playoffs).

### Simulação de Resultados (SportScoreSimulator)
Cada desporto tem características de pontuação diferentes. O simulador utiliza distribuições estatísticas adaptadas:

- **Futsal/Futebol**: Baseado em Distribuição de Poisson ajustada aos ELOs das equipas.
- **Voleibol**: Simulação set-a-set (melhor de 3 ou 5), considerando probabilidades de vencer cada set.
- **Basquetebol/Andebol**: Distribuição Normal para pontos, com média e desvio padrão baseados na força das equipas.

### Backtesting "Viagem no Tempo" (`backtest_validation.py`)
Para garantir a confiança nas previsões, o sistema possui um validador histórico:
1. O sistema "viaja" para uma jornada passada (ex: Jornada 8).
2. "Esquece" todos os resultados que aconteceram depois dessa data.
3. Gera previsões para o resto da época.
4. Compara as probabilidades geradas com o que **realmente aconteceu**.
5. Calcula métricas de erro (Brier Score, RMSE) para calibrar o modelo.

---

## 3. Gestão de Equipas (`mmr_taçaua.py`)

### Normalização
O sistema lida automaticamente com erros humanos na introdução de nomes (ex: "Eng. Informatica" vs "Eng. Informática" vs "EI").

### Transições de Época
- Equipas mantêm parte do seu ELO de uma época para a outra (soft reset).
- O sistema deteta automaticamente mudanças de nome de cursos (ex: Fusões ou alterações oficiais).
