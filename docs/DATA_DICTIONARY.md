# DATA_DICTIONARY.md - Dicionário e Estrutura de Dados

[🇬🇧 View English Version](DATA_DICTIONARY_EN.md)

## Visão Geral do Ecossistema de Dados

Este documento define formalmente o contrato de dados (Data Schema) esperado e consumido pelas diversas camadas da *pipeline* em Python (`extrator.py`, `mmr_taçaua.py`, e `preditor.py`), bem como a arquitetura estrutural dos dados de saída processados para visualização no Frontend.

---

## 1. Fonte de Dados (Input Raw - Formato Excel)

O `extrator.py` consome dados exclusivamente a partir de um ficheiro Excel central providenciado pela Organização (ex: `Taça UA 25_26 Oficial.xlsx`).

### Colunas Obrigatórias Suportadas

Para a serialização ocorrer sem perdas ou dependências rompidas, a folha de cálculo (*sheet*) correspondente à modalidade **tem de conter rigorosamente** o seguinte mapeamento de colunas principais ao nível da grelha de jogos:

| Nome da Coluna | Tipo de Dado | Obrigatório | Descrição / Propósito Analítico |
| :--- | :--- | :---: | :--- |
| **Jornada** | String / Int | Sim | Identificador da ronda/fase. Serve para cálculo temporal do multiplicador de fase do K-factor (Fase de Grupos vs Playoffs). Sub-tags como "MFA" (Meia-Final) ativam K-factors de 1.5. |
| **Equipa 1** | String | Sim | Nome bruto da primeira equipa. Se incluir terminologias de placeholder (ex: "Vencedor QF"), o parser elimina a linha automaticamente. |
| **Equipa 2** | String | Sim | Nome bruto da segunda equipa. Submetido a conversão Unicode e mapeamento no `config_cursos.json`. |
| **Golos 1** | Inteiro | Sim | Pontuação terminal real registada. Mapeia estritamente resultados. Requer numéricos. |
| **Golos 2** | Inteiro | Sim | Pontuação terminal registada da Equipa 2. |
| **Falta de Comparência**| String genérica | Não | Quando preenchida (ex: com "X", "Sim", "Falta"), induz o sistema a classificar o jogo como "Walkover" (WO). Estes jogos contam pro ELO mas são **removidos** ativamente dos algoritmos de calibração para não enviesar a regressão Gamma-Poisson. |
| **Sets 1** | Inteiro | Apenas em Voleibol | Identificador do número de Sets amealhados (0-2). |
| **Sets 2** | Inteiro | Apenas em Voleibol | Sets conquistados pela Equipa 2. |

---

## 2. Matrizes Intermédias Extratadas (.csv)

O Extrator produz versões purgadas e absolutas em `docs/output/csv_modalidades/`. O formato de nomenclatura gerado rege-se por: `MODALIDADE_EPOCA.csv` (ex: `FUTSAL_MASCULINO_25_26.csv`).

**Schema de Saída (Normalizado):**
- **Jornada** -> **Data** -> **Local** -> **Equipa 1** -> **Equipa 2** -> **Golos 1** -> **Golos 2** -> **Sets 1** -> **Sets 2** -> **Falta de Comparência**

A componente mais crítica deste processamento é garantir que elementos linguísticos distintos apontando para a mesma instituição (ex: "Eng. Informática" e "EI") sejam unificados sob o seu termo *Canonical* declarado em `config_cursos.json`.

---

## 3. Matrizes de Visualização Consumidas pelo Frontend

O Frontend estático interage diretamente com duas categorias brutas de CSVs exportadas durante a *pipeline*.

### A. Tabelas de Classificações e ELO 
Localização: `docs/output/elo_ratings/classificacao_*.csv`

**Colunas Geradas:**
1. `Posição`: *Integer* - Critério final indexado com base em pontos e desempates normativos.
2. `Equipa`: *String* - Nome canónico.
3. `Jogos`: *Integer* - Fator acumulado histórico em época.
4. `Vitórias` / `Empates` / `Derrotas`: *Integer* - Distribuição nominal de W/D/L.
5. `Golos Marcados` / `Golos Sofridos`: *Integer*.
6. `Diferença de Golos`: *Float/Int* - Primeiro critério de desempate intra-equipa em caso de igualdade de pontos em *knockout*.
7. `Pontos`: *Float* - Acumulado do formato do torneio. O ELO dita performance, mas "Pontos" dita Ranking oficial de vitrina.
8. `ELO_Current`: *Float* - Valor quantitativo métrico finalizado para exibição pública de performance oculta.

### B. Distribuições Preditivas Monte Carlo
Localização: `docs/output/previsoes/previsoes_*.csv`

A grelha probabilística calculada matematicamente pelo nódulo `preditor.py` com amostragens superiores a 1M avaliando desvio-padrão dos *ratings*:

**Colunas Geradas:**
- `Equipa`: Nome canónico.
- `P(1º lugar)`, `P(2º)`, `P(3º)`, `P(4º)`, `P(Descida/Eliminado)`: *Float* (percentagens geradas em `0.0` a `100.0` traduzindo vetores simulados probabilísticos).
- Formatação em matriz limpa lida como DataFrame puro sem dependências externas adicionais, exibidos dinamicamente nos Tooltips das páginas finais de cada div de Modalidade.
