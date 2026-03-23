# ARCHITECTURE.md - Arquitetura Técnica do Sistema ELO Taça UA

[🇬🇧 View English Version](ARCHITECTURE_EN.md)

---

## Visão Geral do Sistema

Este modelo computacional de **ranking ELO adaptativo** e **simulação Monte Carlo** foi concebido exclusivamente para modelar competições desportivas do desporto universitário. A infraestrutura conjuga um método ELO otimizado, assente num $K$-factor dinâmico não linear, com uma robusta calibração estatística que emprega regressão Gamma-Poisson para suportar projeções estocásticas em massa.

**Versão da Build:** 2.1  
**Ambiente de Execução:** Python 3.8+  
**Dependências do Núcleo:** `numpy`, `scipy`, `scikit-learn`, `pandas`

---

## Estrutura do Pipeline de Dados (Data Pipeline)

```ini
┌─────────────────────────────────────────────────────────────────────────┐
│                    FASE 1: EXTRAÇÃO E NORMALIZAÇÃO                      │
└─────────────────────────────────────────────────────────────────────────┘
              │
              │  extrator.py (Tempo de execução: ~30s)
              ▼
     ┌─────────────────────────────┐
     │  Grelha Fonte (Excel)       │
     │  - Extração em múltiplas    │──┐
     │    folhas                   │  │ Parsing iterativo linha-a-linha
     │  - Sanitização de entidades │  │ Executa normalize_team_name()
     │  - Identificação orgânica   │  │ Infere o contexto 'Sport' enum
     └─────────────────────────────┘  │
              │                        │
              │  Ficheiros CSV Particionados ◀┘
              ▼
     docs/output/csv_modalidades/
     ├── <modalidade>_<época>.csv

┌─────────────────────────────────────────────────────────────────────────┐
│                  FASE 2: CONTAGEM E AVALIAÇÃO ELO                       │
└─────────────────────────────────────────────────────────────────────────┘
              │
              │  mmr_taçaua.py (Tempo de execução: 2-3 min)
              ▼
     ┌───────────────────────────────────┐
     │  Instanciação EloRatingSystem()   │
     │  - K_base indexado: 100           │
     │  - E_factor modelado: 250         │
     │  - Computador de Pontos Específico│
     └───────────────────────────────────┘
              │
              │  Para cada iteração cronológica competitiva:
              ▼
     ┌───────────────────────────────────┐
     │  ΔElo = K × (S_historico - S_proj)│
     │                                   │
     │  K = K_base × M_fase × M_prop     │──┐
     │  M_fase = f(jornada, momento)     │  │ K-factor mutável
     │  M_prop = log_scale(diferencial)  │  │ (refira-se à Seção 3)
     │                                   │  │
     │  S_proj = 1/(1+10^(-Δ/250))       │◀─┘
     └───────────────────────────────────┘
              │
              │  Estruturas CSV / JSON (Outputs persistentes)
              ▼
     docs/output/elo_ratings/
     ├── classificacao_<modalidade>_<época>.csv
     ├── elo_history_<modalidade>_<época>.json

┌─────────────────────────────────────────────────────────────────────────┐
│              FASE 3: CALIBRAÇÃO PARAMÉTRICA GLOBAL                      │
└─────────────────────────────────────────────────────────────────────────┘
              │
              │  calibrator.py (Tempo de execução: ~1 min)
              ▼
     ┌──────────────────────────────────────────────┐
     │  Módulo 'HistoricalDataLoader'               │
     │  - Valida dataframes em memória              │
     │  - Expurgos: omissões e anomalias de jogo    │
     └──────────────────────────────────────────────┘
              │
              │  Calibrador de Histórico ELO
              ▼
     ┌──────────────────────────────────────────────┐
     │  Calibrador de Probabilidades de Empate      │
     │  P_draw: logit(P) = β₀ + β₁|Δ| + β₂|Δ|²      │
     │  Otimizador: Regressão Logística (sklearn)   │
     └──────────────────────────────────────────────┘
              │
              │  Calibrador de Distribuição (Golos)
              ▼
     ┌──────────────────────────────────────────────┐
     │  RECONHECIMENTO GAMMA-POISSON                │
     │  k = μ² / (σ² - μ)   com teto  k ≥ 3.0       │
     │                                              │
     │  Limites de 'k' regulam 'overdispersion'     │
     └──────────────────────────────────────────────┘
              │
              │  Mapeamento em JSON
              ▼
     docs/output/calibration/
     ├── calibrated_simulator_config.json

┌─────────────────────────────────────────────────────────────────────────┐
│              FASE 4: MOTOR DE SIMULAÇÃO MONTE CARLO                     │
└─────────────────────────────────────────────────────────────────────────┘
              │
              │  preditor.py (Tempo de exc. Típico: ~5 min)
              ▼
     ┌──────────────────────────────────────────────┐
     │  Inicializador 'SportScoreSimulator'         │
     │  - Importa configurações calibradas          │
     └──────────────────────────────────────────────┘
              │
              │  Por cada universo (N = 10⁴ a 10⁶):
              ▼
     ┌──────────────────────────────────────────────┐
     │  Processar simulação(elo_a, elo_b)           │
     │                                              │
     │  Módulos ativados conforme o Desporto:       │
     │  (Ver: SIMULATION_MODELS.md)                 │
     └──────────────────────────────────────────────┘
              │
              │  Agregação em Memória Volátil
              ▼
     ┌──────────────────────────────────────────────┐
     │  Compilação e Exportação                     │
     │  - Asserções preditivas para final, P(top3)  │
     └──────────────────────────────────────────────┘
              │
              │  Persistência Física
              ▼
     docs/output/previsoes/
     ├── forecast_<modalidade>_<ano>.csv
```

---

## Módulos Sistémicos Críticos

### 1. Motor ELO Dinâmico e Reajuste Empírico

#### Fator de Escala (E-factor) = 250

A base quantitativa centraliza a transição do termodinâmico standard $E=400$ (aplicado ao xadrez convencional) em direção a uma escala tática de $E=250$. 

**Resolução Técnica:**
A contração do fator E inflaciona artificialmente os gradientes nas extremidades probabilísticas, promovendo uma sensibilidade acentuada à flutuação orgânica desportiva. Este valor calibrado demonstrou um índice de correlação retroativa (*goodness of fit*) exímio ($R² = 0.992$), traduzindo um $\Delta ELO = 200$ numa expectativa pragmática de 73% vitórias (próximo dos 72% de empirismo testado).

#### Complexidade do K-factor Variável

O escalar de atualização, contrariamente aos sistemas monolíticos, obedece à equação multivariável funcional:

$$K_{factor} = K_{base} \times M_{fase} \times M_{proporcao}$$

- O **Teto Primário ($K_{base} = 100$)** permite aberturas para que a inflação compense volatilidades agudas nas provas;
- O fator temporal **$M_{fase}$** altera a resiliência do valor, maximizando a reavaliação nos momentos propedêuticos (onde incerteza é soberana) ou nos estádios colossais eliminatórios (Playoffs);
- O rácio logarítmico **$M_{proporcao}$** avalia tangencialmente o esmagamento entre pontuações das equipas envolvidas, amortecendo picos irrazoáveis deriváveis de distribuições atípicas mediante extração da base de 10.

### 2. Sanitização Fonética e Semiótica

**Fundamentação Teórica:** Equipas detentoras de variações nominais idiossincráticas ou de preenchimento incoerente (siglas divergentes) propagam erro no registo temporal (e consequentemente induzem divisão e falha ELO).

**Tratamento Sistematizado:** O módulo propaga 3 níveis de abstração para processamento textual (Natural Language Treatment):
1. **Dicionário JSON (`config_cursos.json`)**: Regula de forma binária com privilégios absolutos o mapeamento explícito entre variantes comuns e a nomenclatura canónica real.
2. **Hardcoding de Transições**: Processa e une rastreios legados, mantendo ligações em heranças lógicas passadas (ex. 'Contabilidade' migra integralmente para 'Marketing').
3. **Decadificação Unicode (NFD)**: Executa redução purgada de acentuação, convertendo os blocos brutos em referências *hashing* confiéis.

### 3. Matriz de Detecção Desportiva

O reconhecimento dos regulamentos decorre através de padrões e sub-padrões regex predefinidos ou da correspondência de topónimo no *Dataframe*:

```python
# Tabela de Recompensas Matriciais Associadas ($X$ \mapsto (V,E,D))
POINTS_RULES = {
    "FUTSAL":    (3, 1, 0),
    "ANDEBOL":   (3, 2, 1), # Valorização extrema do empate
    "BASQUETE":  (2, 1, 0), # Redução do empate 3x3
    "VOLEI":     "Sub-matriz de paridade estruturada"
}
```

### 4. Gestão de Contingências (Faltas e Resoluções)

A pipeline é programada rigorosamente para identificar e ativamente expurgar de certas zonas de cálculo ocorrências de Forfaits (Abstenções/Ausências não documentadas), equivalentes a aproximadamente $4.5\%$ do total empírico. 

- **Camada de Restrição do ELO**: Forfaits **não despoletam modificadores**, mitigando oscilações enganosas do modelo;
- **Camada de Restrição Calibradora**: As resoluções em falso também são suprimidas na regressão estatística para impedir distorções na extração da curva $\lambda$ de Poisson.

---

## Tabela de Complexidade e Consumo

| Rotina Tecnológica | Procedimento Matemático / Asserção | Classificação (Big O) | Consumo ($T_{\text{cpu}}$) |
|--------------------|------------------------------------|-----------------------|----------------------------|
| Extrator | Sanitizações Cruzadas (`Regex` e Hash) | $\mathcal{O}(N \times M)$ | $\sim 30 \text{ sec}$ |
| ELO System | Processamento Serializado Vectorial | $\mathcal{O}(N)$ | $\sim 2-3 \text{ min}$ |
| Calibração | Convergência _L-BFGS_ (_sklearn_) | $\mathcal{O}(N \log N)$ | $\sim 1 \text{ min}$ |
| Previsão (Standard) | Paralelismo $10^4$ simulações | $\mathcal{O}(I \times T \times G)$ | $\sim 30 \text{ sec}$ |
| Previsão (Deep) | Paralelismo $10^6$ simulações | $\mathcal{O}(I \times T \times G)$ | $\sim 5 \text{ min}$ |

O paralelismo (suportado por `ProcessPoolExecutor`) conjugado com as diretrizes e transformações nativas de arranjos estáticos via `numpy` providenciaram uma **escalabilidade assinalável**: uma redução temporal com a magnitude de $5\times$ até $10\times$ aquando das simulações estocásticas pesadas.

---

**Comissão e Gestão Técnica do Sistema:** 2026-03  
**Domínio Operativo:** Gestão de Modelagem Analytics da Taça UA
