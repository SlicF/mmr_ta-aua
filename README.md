# Taça UA - Sistema de Classificação e Previsão

Sistema avançado de análise de dados desportivos para a **Taça Universidade de Aveiro**. Este projeto calcula classificações ELO dinâmicas, gera previsões probabilísticas para jogos futuros e mantém um dashboard interativo.

__Website:__ [https://slicf.github.io/mmr_ta-aua/](https://slicf.github.io/mmr_ta-aua/)

## Estrutura do Repositório

O projeto segue uma estrutura organizada para separar código, dados e interface web:

- **`/src`**: Código fonte Python (O "cérebro" do sistema).

   - `extrator.py`: Extrai dados dos ficheiros Excel oficiais.
   - `mmr_taçaua.py`: Processa torneios e calcula classificações ELO.
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

Utiliza um algoritmo ELO personalizado que considera margem de vitória, fase da época e força do adversário.
__[Ver Documentação Completa do Sistema ELO](docs/ELO_AND_PREDICTION.md)__

### 3. Previsão (Monte Carlo)

Para prever o futuro, o sistema simula a época **10.000 vezes** utilizando distribuições estatísticas adaptadas a cada desporto (Poisson, Normal, etc.).

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
python preditor.py    # Gera previsões (padrão: 10.000 simulações)

```

O `preditor.py` suporta diferentes modos de simulação:

O número de simulações utilizado é incluído automaticamente no nome dos ficheiros de saída (ex: `forecast_FUTSAL_FEMININO_2026_100000.csv`).

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

__[📊 Ver Documentação Detalhada dos Campos CSV →](docs/FORECAST_CSV_FIELDS.md)__

__Nota:__ O `mmr_taçaua.py` apaga automaticamente ficheiros antigos da pasta `previsoes/` antes de processar, garantindo que apenas previsões atualizadas estão disponíveis.

## Suporte para Windows

O projeto foi otimizado para correr nativamente em Windows:

- **Encoding:** O código força UTF-8 (`sys.stdout`, `sys.stderr`) para evitar problemas com caracteres na consola.
- **Paths:** Todos os caminhos usam barras `/` ou `os.path.join` para compatibilidade cross-platform.
- __Multiprocessing:__ O `preditor.py` implementa proteções (`if __name__ == "__main__":`) e lógica específica para contornar limitações de _forking_ do Windows, permitindo simulações paralelas eficientes.

Para correr em PowerShell:

```powershell
# Opcional, mas recomendado para visualizar emojis/caracteres corretamente
Set-ItemEnv -Path env:PYTHONUTF8 -Value 1
cd src
python extrator.py

```

## Website

O dashboard está disponível publicamente via GitHub Pages. Os dados na pasta `/docs` são servidos automaticamente.

## Validação

O sistema inclui um módulo de "Backtesting" que viaja no tempo para verificar se as previsões passadas teriam acertado.

```bash
cd src
python backtest_validation.py

```
