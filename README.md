# 🏆 Taça UA - Sistema de Classificação e Previsão

Sistema avançado de análise de dados desportivos para a **Taça Universidade de Aveiro**. Este projeto calcula classificações ELO dinâmicas, gera previsões probabilísticas para jogos futuros e mantém um dashboard interativo.

## 📂 Estrutura do Repositório

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

## 🚀 Como Funciona

### 1. Extração de Dados
O sistema lê os ficheiros Excel de resultados (`data/Resultados Taça UA...xlsx`) e converte-os para um formato normalizado.

### 2. Cálculo de ELO
Utiliza um algoritmo ELO personalizado que considera:
- Margem de vitória (goleadas valem mais).
- Fase da época (playoffs valem mais).
- Força do adversário.

👉 **[Ver Documentação Completa do Sistema ELO](docs/ELO_AND_PREDICTION.md)**

### 3. Previsão (Monte Carlo)
Para prever o futuro (quem vai aos playoffs? quem será campeão?), o sistema simula o resto da época **10.000 vezes** jogo a jogo, utilizando distribuições estatísticas adaptadas a cada desporto (Poisson para Futsal, Normal para Basquete, etc.).

## 🛠️ Instalação e Uso

1. **Instalar dependências**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Executar pipeline completo**:
   ```bash
   cd src
   python extrator.py    # Atualiza dados dos Excels
   python mmr_taçaua.py  # Recalcula ELOs e Classificações
   ```

## 🌐 Website
O dashboard está disponível publicamente via GitHub Pages. Os dados na pasta `/docs` são servidos automaticamente.

## 🧪 Validação
O sistema inclui um módulo de "Backtesting" que viaja no tempo para verificar se as previsões feitas no passado teriam acertado nos resultados que já aconteceram.

```bash
cd src
python backtest_validation.py
```
