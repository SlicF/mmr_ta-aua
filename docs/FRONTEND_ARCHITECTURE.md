# FRONTEND_ARCHITECTURE.md - Arquitetura da Interface Web (Frontend)

[🇬🇧 View English Version](FRONTEND_ARCHITECTURE_EN.md)

## Visão Geral

O frontend do sistema **Taça UA ELO** opera estritamente como uma aplicação do lado do cliente (Single Page Application - SPA) de tipologia arquitetural *Serverless* / Estática. 
Toda a dinâmica de processamento de dados subjacente à interface depende do consumo sistemático e assimíncrono (via *Fetch API*) dos artefactos numéricos previamente pré-compilados (.csv e .json) que a vertente em Python da *pipeline* gerou (confinados à diretoria `/docs/output/`).

Esta arquitetura dispensa em absoluto a exigência funcional de um elemento Backend de infraestrutura dinâmica de bases de dados (como SQL/NoSQL) ou APIs Web intermédias (como processos Express, Django ou Flask), permitindo alocamento 100% nativo em serviços de hospedagem como o *GitHub Pages*.

---

## 1. Topologia Tecnológica (Stack)

- **Estruturação Funcional (DOM):** Puramente regulada por HTML5 sem processadores estáticos.
- **Folhas de Estilo Embutidas:** CSS3 padronizado gerindo toda a parte visual (layout e *media-queries*) (`styles.css`).
- **Lógica e Dinâmica em Cliente:** JavaScript Vanilla (ES6+) isolado, que processa e unifica lógicas interligadas de análise estática sem necessidade de processos de _Build/Compile_ intermédios em Frameworks pesadas.

---

## 2. Abstração de Componentes Modulares

O ecossistema é compartimentado lógicamente em scripts distintos:

### `index.html` (Nó Estrutural Central)
Alberga todas as árvores estáticas elementares do DOM, providenciando as âncoras (IDs estruturais) utilizadas futuramente pelos algoritmos assíncronos de inserção que moldam relatórios de tabela (como rankings, menus iterativos de modalidades).

### `app.js` (Controlador Principal)
Responsável pelo processo core funcional de processamento dos dados lidos. A rotina principal de execução deste controlador:
1. Resgata e manipula iterativamente as respostas CSV persistentes no diretório `output`.
2. Reverte essa matriz para arrays internos manipuláveis (Objects).
3. Efetua cálculos e paginações nos resultados, projetando finalmente elementos estáticos DOM recriados formatados para exibição.

### `i18n.js` (Internacionalização Módular)
Integra dicionários e matrizes completas para renderização gráfica idiomática. Fornece ferramentas robustas executando traduções puramente sobre DOM em tempo real. Interceta eventos de interface e recalcula imediatamente textos da árvore HTML.

### `debug.js` 
Camada isolada auxiliar. Emite painéis orientados exclusivamente para fins de rastreio orgânico avaliando integrações de dados, validando integridade de dados consumidos no Frontend (ex: arrays mal estruturados ou parâmetros ELO subjacentes em rutura).

---

## 3. Gestão de Fluxo e Ciclo de Vida do Cliente

A sequência comportamental inerente do utilizador no acesso incide na rotina:
1. **Carregamento Síncrono (`DOMContentLoaded`)**: Compiladores de script despertam as definições do ambiente. 
2. **Fetch Subsequente Assíncrono**: O script exige o *parsing* do ficheiro matriz base CSV correspondente à modalidade definida num seletor superior pelo visitante.
3. **Renderização Funcional do Dashboard**: 
   - Modifica os gráficos ou listas de ranking gerando grelhas matriciais numéricas baseadas na posição.
   - Analisa e funde os reports e metas diárias projetando o módulo preditivo da probabilidade (tabelas e simulações das competições).

---

## 4. Orientações de Deploy (Alojamento Estático)

Uma vez que toda a manipulação reside intrínseca em elementos puros (Vanilla JS e HTML), a implantação desta aplicação obriga meramente a:
1. Configurar nas _Settings_ do repositório alojador a projeção *Pages* restrita à diretoria `docs/`.
2. O ramo _push_ subseqüente de `preditor.py` comitará as modificações absolutas nos dados brutos da pasta `output`, provocando efetivamente um ciclo de reconstrução/commit da infraestrutura virtual visível para os utilizadores simultaneamente instantâneo e seguro.
