// ==================== SISTEMA DE INTERNACIONALIZAÇÃO (i18n) ====================

// Mapeamento de tradução de nomes de equipas (de PT para EN)
const teamNamesTranslation = {
    'pt': {
        'Administração Pública': 'Public Administration',
        'AP': 'PA',
        'Aero': 'Aero',
        'Automação e Sistemas de Produção': 'Automation and Production Systems',
        'ASP': 'APS',
        'Biologia': 'Biology',
        'Biologia e Geologia': 'Biology and Geology',
        'BG': 'BG',
        'Bioquímica': 'Biochemistry',
        'Biotec': 'Biotech',
        'Biotecnologia': 'Biotechnology',
        'Ciências Biomédicas': 'Biomedical Sciences',
        'Ciências Biomédicas B': 'Biomedical Sciences B',
        'Bimédica': 'Biomedical',
        'Biomédica': 'Biomedical',
        'CBM': 'BMS',
        'CBM B': 'BMS B',
        'Ciências do Mar': 'Marine Sciences',
        'CM': 'MS',
        'Contabilidade': 'Accounting',
        'Contab': 'Accounting',
        'Civil': 'Civil',
        'Computacional': 'Computational',
        'EAmb': 'Env',
        'EB': 'BE',
        'Design': 'Design',
        'Design de Produto e Tecnologia': 'Product Design and Technology',
        'DPT': 'PDT',
        'Economia': 'Economics',
        'Educação Básica': 'Basic Education',
        'Enfermagem': 'Nursing',
        'Eng. Aeroespacial': 'Aeronautical Engineering',
        'Eng. Biomédica': 'Biomedical Engineering',
        'Eng. Civil': 'Civil Engineering',
        'Eng. Computacional': 'Computational Engineering',
        'Eng. Computadores e Telemática': 'Computers and Telematics Engineering',
        'ECT': 'CTE',
        'Eng. de Materiais': 'Materials Engineering',
        'Materiais': 'Materials',
        'Eng. do Ambiente': 'Environmental Engineering',
        'Eng. e Gestão Industrial': 'Industrial Engineering and Management',
        'Eng. e Gestão Industrial B': 'Industrial Engineering and Management B',
        'EGI': 'IEM',
        'EGI B': 'IEM B',
        'Eng. Eletrónica e Telecomunicações': 'Electronics and Telecommunications Engineering',
        'Eng. Eletrónica e Telecomunicações B': 'Electronics and Telecommunications Engineering B',
        'EET': 'ETE',
        'EET B': 'ETE B',
        'Eng. Física': 'Physics Engineering',
        'EF': 'PE',
        'Eng. Informática': 'Computer Science and Engineering',
        'Eng. Informática B': 'Computer Science and Engineering B',
        'EI': 'CSE',
        'EI B': 'CSE B',
        'Eng. Mecânica': 'Mechanical Engineering',
        'Eng. Mecânica B': 'Mechanical Engineering B',
        'Mecânica': 'Mechanical',
        'Mecânica B': 'Mechanical B',
        'Eng. Química': 'Chemical Engineering',
        'EQ': 'CE',
        'Estudos Editoriais': 'Editorial Studies',
        'Finanças': 'Finance',
        'Física': 'Physics',
        'Fisioterapia': 'Physiotherapy',
        'Geologia': 'Geology',
        'Gestão': 'Management',
        'Gestão Comercial': 'Business Management',
        'Gest. Comercial': 'Business Mgmt',
        'Gestão e Planeamento em Turismo': 'Tourism Management and Planning',
        'GPT': 'TMP',
        'Gestão Pública': 'Public Management',
        'Gest. Pública': 'Public Mgmt',
        'Línguas e Relações Empresariais': 'Languages and Business Relations',
        'LRE': 'LBR',
        'Línguas, Literaturas e Culturas': 'Languages, Literatures and Cultures',
        'LLC': 'LLC',
        'Marketing': 'Marketing',
        'Matemática': 'Mathematics',
        'Medicina': 'Medicine',
        'Meteorologia, Oceanografia e Clima': 'Meteorology, Oceanography and Climate',
        'MOC': 'MOC',
        'MTC': 'MCT',
        'Música': 'Music',
        'Multimédia e Tecnologias da Comunicação': 'Multimedia and Communication Technologies',
        'Psicologia': 'Psychology',
        'Química': 'Chemistry',
        'Tecnologias de Informação': 'Information Technologies',
        'TI': 'IT',
        'Terapia da Fala': 'Speech-Language Pathology',
        'Tradução': 'Translation'
    }
};

const translations = {
    pt: {
        // === Página / Meta ===
        pageTitle: 'Dashboard da Taça UA',
        pageDescription: 'Dashboard interativo da Taça UA - Rankings, estatísticas ELO, calendário de jogos e brackets de eliminação',

        // === Header ===
        dashboardTitle: 'Dashboard da Taça UA',

        // === Seletores ===
        seasonLabel: 'Época:',
        modalityLabel: 'Modalidade:',

        // === Classificação ===
        generalRanking: 'Classificação Geral',
        compactMode: 'Modo Compacto',
        posTitle: 'Posição na classificação geral',
        posAbbr: 'Pos.',
        team: 'Equipa',
        ptsTitle: 'Pontos acumulados',
        ptsAbbr: 'Pts',
        gamesTitle: 'Jogos realizados',
        gamesAbbr: 'GP',
        winsTitle: 'Vitórias',
        winsAbbr: 'V',
        drawsTitle: 'Empates',
        drawsAbbr: 'E',
        lossesTitle: 'Derrotas',
        lossesAbbr: 'D',
        noShowsTitle: 'Faltas de comparência',
        noShowsAbbr: 'FF',
        goalDiffSymbol: '±',
        eloTrend: 'ELO Trend',
        eloTrendTitle: 'Mostra a evolução do rating ELO da equipa nos 5 jogos mais recentes.\nELO minimo - ELO máximo',
        form: 'Forma',
        formTitle: 'Mostra os últimos 5 resultados da equipa (V=Vitória, E=Empate, D=Derrota)\nEsquerda é o jogo mais antigo, direita o mais recente.',
        noDataAvailable: 'Nenhum dado disponível',
        selectModality: 'Selecione uma modalidade',
        selectModalityData: 'Selecione uma modalidade para ver os dados',
        selectModalityBracket: 'Selecione uma modalidade para ver o bracket',
        selectModalityFirst: 'Selecione uma modalidade primeiro',
        removeFavorite: 'Remover dos favoritos',
        markFavorite: 'Marcar como favorita',
        favoriteRemoved: 'Equipa favorita removida',
        favoriteSet: 'Equipa favorita:',
        eloCurrentTitle: 'ELO atual e posição no ranking geral',
        unknownDate: 'Data desconhecida',
        lastGame: 'último jogo',
        form: 'Forma',
        placeLabel: 'lugar',

        // === Forma (V/E/D) ===
        formWin: 'Vitória',
        formDraw: 'Empate',
        formLoss: 'Derrota',
        formUnknown: 'Desconhecido',
        formWinLetter: 'V',
        formDrawLetter: 'E',
        formLossLetter: 'D',

        // === ELO Sparkline ===
        eloEvolution: 'Evolução de ELO',
        lastGames: 'jogos',
        until: 'até',
        eloTrendAriaLabel: 'Tendência de ELO',

        // === Gráfico ELO ===
        eloChartTitle: 'Evolução de ELO das Equipas',
        eloChartTooltip: 'ELO representa a força relativa das equipas ao longo da época. Sobe com vitórias, desce com derrotas.',
        expandCollapse: 'Expandir/Colapsar',
        previousSeason: '← Época Anterior',
        nextSeason: 'Época Seguinte →',
        teamsLabel: 'equipas',

        // === Seletor de equipas ===
        selectAll: 'Seleccionar Todas',
        deselectAll: 'Desseleccionar Todas',
        invertSelection: 'Inverter Seleção',
        selectAllAria: 'Selecionar todas as equipas',
        deselectAllAria: 'Desselecionar todas as equipas',
        invertSelectionAria: 'Inverter seleção de equipas',
        allGroups: 'Todos',
        divisionGeneral: 'Divisão Geral',
        divisionNth: 'ª Divisão',
        teamSingular: 'equipa',
        teamPlural: 'equipas',
        groupLabel: 'Grupo',

        // === Filtros rápidos ===
        filterTop3: 'Top 3',
        filterTop3Aria: 'Filtrar top 3 equipas',
        filterByLabel: 'Filtrar por',
        filterByAllDiv2: 'Filtrar por toda a 2ª Divisão',
        playoffsLabel: 'Playoffs',
        playoffsCurrentRanking: 'Playoffs (Classificação Atual)',
        filterPlayoffsAria: 'Filtrar equipas dos playoffs',
        sensationTeams: 'Equipas Sensação',
        sensationTeamsAria: 'Filtrar equipas sensação com maior ganho de ELO',
        resetFilter: 'Resetar Filtro',
        resetFilterAria: 'Resetar filtros de equipas',

        // === Calendário ===
        gameCalendar: 'Calendário de Jogos',
        matchday: 'Jornada',
        selectMatchday: 'Selecione uma jornada para ver os jogos',
        noGamesFound: 'Nenhum jogo encontrado para esta jornada',
        dateToSchedule: 'DATA POR MARCAR',
        previousMatchday: 'Jornada anterior',
        nextMatchday: 'Jornada seguinte',
        navigatePrevious: 'Navegar para jornada anterior',
        navigateNext: 'Navegar para próxima jornada',

        // === Brackets ===
        eliminationBracket: 'Bracket de Eliminação',
        playoffLiguilha: 'Playoff/Liguilha',
        bracketNotAvailable: 'Bracket não disponível para esta modalidade',
        thirdPlace: '3º Lugar',
        bracketLabel1stDivision: '1ª Divisão',
        bracketLabel2ndDivision: '2ª Divisão',
        bracketLabelLeague: 'da Liga',
        bracketLabelGroup: 'Grupo',
        bracketQualificationSuffix: 'º',
        bracketWinner: 'Vencedor',
        bracketLoser: 'Perdedor',
        fourthPlace: '4º Lugar',
        predictedMatch: '📅 Confronto Previsto',
        unknownResult: '⚠️ Resultado Desconhecido',
        quarterFinals: 'Quartos de Final',
        semiFinals: 'Meias-Finais',
        finals: 'Final',
        ofTheLeague: 'da Liga',
        div1st: '1st Div',
        div2nd: '2nd Div',
        groupAbbr: 'Gr.',

        // === Legenda de progressão ===
        playoffs: 'Play-offs',
        maintenancePlayoff: 'Play-off de Manutenção',
        maintenanceLeague: 'Liguilha de Manutenção',
        relegation: 'Descida de divisão',
        playoffsPromotion: 'Play-offs + Promoção',
        promotionPlayoff: 'Play-off de Promoção',
        promotionLeague: 'Liguilha de Promoção',
        promotion: 'Subida de divisão',
        safeZone: 'Zona segura',
        qualificationPlayoffs: 'Qualificação para play-offs',
        replaces: 'substitui',
        ofGroup: 'do grupo',
        teamBNoQualify: 'equipa B não qualifica',

        // === Previsões ===
        seasonPredictions: 'Previsões da Época',
        generalPredictions: 'PREVISÕES GERAIS',
        matchdayPredictions: 'Previsões jornada a jornada',
        predJornada: 'Jornada',
        predDate: 'Data',
        predOpponent: 'Adversário',
        predWinProb: 'P(V)',
        predWinProbTitle: 'Probabilidade de vitória',
        predDrawProb: 'P(E)',
        predDrawProbTitle: 'Probabilidade de empate',
        predLossProb: 'P(D)',
        predLossProbTitle: 'Probabilidade de derrota',
        expectedGoals: 'Golos Esp.',
        expectedGoalsAbbr: 'Golos Esp.',
        expectedGoalsTitle: 'Golos esperados',
        basketGoalsExpected: 'Cestos Esp.',
        basketGoalsTitle: 'Cestos esperados',
        setsExpected: 'Sets Esp.',
        setsTitle: 'Sets esperados',
        noStatsAvailable: 'Sem estatísticas disponíveis',
        noPredictionsData: 'Sem dados de previsões para esta modalidade/época',
        noDataAvailableShort: 'Sem dados disponíveis',
        errorLoading: 'Erro ao carregar',
        loadingData: 'A carregar dados...',
        loadingRankings: 'A carregar classificação...',
        noGamesForTeam: 'Sem jogos previstos para esta equipa',
        dataNotAvailable: 'Dados não disponíveis',
        simulations: 'simulações',
        simulatedResults: 'Resultados Simulados',
        clickToFixTooltip: 'Clique para fixar/desafixar o tooltip de distribuição',
        previousTeam: 'Equipa anterior',
        nextTeam: 'Próxima equipa',
        seasonStart: 'Início da Época',
        eloFinalPreviousSeason: 'ELO Final Época Anterior',
        eloSeasonStart: 'ELO Início da Época',
        interGroupAdjustments: 'Ajustes Inter-Grupos',
        eloRatingLabel: 'Rating ELO',

        // Cabeçalhos dinâmicos por modalidade
        basketScored: 'Cestos feitos',
        basketConceded: 'Cestos sofridos',
        basketDiff: 'Diferença de cestos (CF - CS)',
        setsWon: 'Sets ganhos',
        setsLost: 'Sets perdidos',
        setsDiff: 'Diferença de sets (SG - SP)',
        goalsScored: 'Golos marcados',
        goalsConceded: 'Golos sofridos',
        goalsDiff: 'Diferença de golos (GM - GS)',

        // Estatísticas de previsão
        predPlayoffs: 'Playoffs',
        predSemiFinals: 'Meias-Finais',
        predFinal: 'Final',
        predChampionsMale: 'Campeões',
        predChampionsFemale: 'Campeãs',
        predChampionsMaleDesc: 'Probabilidade de serem campeões',
        predChampionsFemaleDesc: 'Probabilidade de serem campeãs',
        predQualification: 'Probabilidade de qualificação',
        predReachSemis: 'Probabilidade de chegarem às meias',
        predReachFinals: 'Probabilidade de chegarem à final',
        expectedPoints: 'Pontos Esperados',
        expectedPosition: 'Posição Esperada no Grupo',
        expectedValue: 'Valor esperado',
        positions: 'posições',
        points: 'pontos',
        avgFinalElo: 'ELO Final Médio',
        predPromotion: 'Promoção',
        predPromotionDesc: 'Probabilidade de subir de divisão',
        predRelegation: 'Descida',
        predRelegationDesc: 'Probabilidade de descer de divisão',
        unknown: 'Desconhecido',

        // === Tooltip Histórico ===
        historicalRankings: 'Histórico de Classificações',
        season: 'Época',
        group: 'Grupo',
        general: 'Geral',
        inProgress: 'em andamento',
        didNotParticipate: 'Não participou',
        as: 'Como',

        // === Golos/Cestos/Sets (sport-specific) ===
        goalsScored: 'Golos marcados',
        goalsConceded: 'Golos sofridos',
        goalsDiff: 'Diferença de golos (GM - GS)',
        goalsExpected: 'Golos esperados',
        goalsScoredAbbr: 'GF',
        goalsConcededAbbr: 'GA',
        goalsExpectedAbbr: 'Expected Goals',
        basketsScored: 'Cestos feitos',
        basketsConceded: 'Cestos sofridos',
        basketsDiff: 'Diferença de cestos (CF - CS)',
        basketsExpected: 'Cestos esperados',
        basketsScoredAbbr: 'BS',
        basketsConcededAbbr: 'BC',
        basketsExpectedAbbr: 'Expected Baskets',
        setsWon: 'Sets ganhos',
        setsLost: 'Sets perdidos',
        setsDiff: 'Diferença de sets (SG - SP)',
        setsExpected: 'Sets esperados',
        setsWonAbbr: 'SW',
        setsLostAbbr: 'SL',
        setsExpectedAbbr: 'Expected Sets',

        // === Campeões === 
        championsMale: 'Campeões',
        championsViceMale: 'Vice-Campeões',
        championsFemale: 'Campeãs',
        championsViceFemale: 'Vice-Campeãs',

        // === Debug Panel ===
        activateDebug: 'Ativar Debug',
        verboseDebug: 'Debug Verbose',
        deactivate: 'Desativar',
        close: 'Fechar',

        // === DivisionSelector ===
        div1Label: '1ª Divisão',
        div2Label: '2ª Divisão',

        // === Modalidades ===
        ANDEBOL_MISTO: 'Andebol Misto',
        BASQUETEBOL_FEMININO: 'Basquetebol Feminino',
        BASQUETEBOL_MASCULINO: 'Basquetebol Masculino',
        FUTEBOL_DE_7_MASCULINO: 'Futebol 7 Masculino',
        FUTSAL_FEMININO: 'Futsal Feminino',
        FUTSAL_MASCULINO: 'Futsal Masculino',
        VOLEIBOL_FEMININO: 'Voleibol Feminino',
        VOLEIBOL_MASCULINO: 'Voleibol Masculino',

        // === Termos de Divisão/Grupo ===
        division: 'Divisão',
        group: 'Grupo',
        divisionLabel: 'ª Divisão',
        mainDivision: '1ª Divisão',
        secondDivision: '2ª Divisão',
        groupA: 'Grupo A',
        groupB: 'Grupo B',
        groupC: 'Grupo C',
        groupD: 'Grupo D',

        // === Termos Adicionais ===
        selectAllTeams: 'Seleccionar Todas',
        deselectAllTeams: 'Desseleccionar Todas',
        invertSelection: 'Inverter Seleção',
        teams: 'equipas',
        team: 'equipa',
        thirdPlace: '3º Lugar',
        fourthPlace: '4º Lugar',
        groupPrefix: 'Grupo ',
        divisionPrefix: 'ª Divisão',
        noMatchesAvailable: 'Nenhum jogo disponível',
        roundOf: 'Ronda de ',
        vs: 'vs',
        home: 'Casa',
        away: 'Fora',
        draw: 'Empate',
        matchday: 'Jornada',
        date: 'Data',
        time: 'Hora',
        opponent: 'Adversário',
        result: 'Resultado',
        score: 'Pontuação',

        // === Rótulos de Rodadas (para use em rótulos curtos) ===
        roundQuarters: 'Quartos',
        roundSemiFinals: 'Meias',
        roundFinal: 'Final',
        eloFinal: 'ELO final',
        previousSeason: 'Época Anterior',
        nextSeason: 'Época Seguinte',
    },

    en: {
        // === Page / Meta ===
        pageTitle: 'UA Cup Dashboard',
        pageDescription: 'Interactive UA Cup Dashboard - Rankings, ELO statistics, match schedule and elimination brackets',

        // === Header ===
        dashboardTitle: 'UA Cup Dashboard',

        // === Selectors ===
        seasonLabel: 'Season:',
        modalityLabel: 'Sport:',

        // === Rankings ===
        generalRanking: 'General Standings',
        compactMode: 'Compact Mode',
        posTitle: 'Position in general standings',
        posAbbr: 'Pos.',
        team: 'Team',
        ptsTitle: 'Points accumulated',
        ptsAbbr: 'Pts',
        gamesTitle: 'Games played',
        gamesAbbr: 'GP',
        winsTitle: 'Wins',
        winsAbbr: 'W',
        drawsTitle: 'Draws',
        drawsAbbr: 'D',
        lossesTitle: 'Losses',
        lossesAbbr: 'L',
        noShowsTitle: 'Forfeits',
        noShowsAbbr: 'FF',
        goalDiffSymbol: '±',
        eloTrend: 'ELO Trend',
        eloTrendTitle: 'Shows the ELO rating evolution of the team in the last 5 games.\nMinimum ELO - Maximum ELO',
        form: 'Form',
        formTitle: 'Shows the last 5 results of the team (W=Win, D=Draw, L=Loss)\nLeft is oldest, right is most recent.',
        noDataAvailable: 'No data available',
        selectModality: 'Select a sport',
        selectModalityData: 'Select a sport to view the data',
        selectModalityBracket: 'Select a sport to view the bracket',
        selectModalityFirst: 'Select a sport first',
        removeFavorite: 'Remove from favorites',
        markFavorite: 'Mark as favorite',
        favoriteRemoved: 'Favorite team removed',
        favoriteSet: 'Favorite team:',
        eloCurrentTitle: 'Current ELO and overall ranking position',
        unknownDate: 'Unknown date',
        lastGame: 'last game',
        form: 'Form',
        placeLabel: 'place',

        // === Form (W/D/L) ===
        formWin: 'Win',
        formDraw: 'Draw',
        formLoss: 'Loss',
        formUnknown: 'Unknown',
        formWinLetter: 'W',
        formDrawLetter: 'D',
        formLossLetter: 'L',

        // === ELO Sparkline ===
        eloEvolution: 'ELO Evolution',
        lastGames: 'games',
        until: 'until',
        eloTrendAriaLabel: 'ELO Trend',

        // === ELO Chart ===
        eloChartTitle: 'Team ELO Evolution',
        eloChartTooltip: 'ELO represents the relative strength of teams throughout the season. It goes up with wins and down with losses.',
        expandCollapse: 'Expand/Collapse',
        previousSeason: '← Previous Season',
        nextSeason: 'Next Season →',
        teamsLabel: 'teams',

        // === Team Selector ===
        selectAll: 'Select All',
        deselectAll: 'Deselect All',
        invertSelection: 'Invert Selection',
        selectAllAria: 'Select all teams',
        deselectAllAria: 'Deselect all teams',
        invertSelectionAria: 'Invert team selection',
        allGroups: 'All',
        divisionGeneral: 'General Division',
        divisionNth: ' Division',
        teamSingular: 'team',
        teamPlural: 'teams',
        groupLabel: 'Group',

        // === Quick Filters ===
        filterTop3: 'Top 3',
        filterTop3Aria: 'Filter top 3 teams',
        filterByLabel: 'Filter by',
        filterByAllDiv2: 'Filter teams by all 2nd Division',
        playoffsLabel: 'Playoffs',
        playoffsCurrentRanking: 'Playoffs (Current Standings)',
        filterPlayoffsAria: 'Filter playoff teams',
        sensationTeams: 'Sensation Teams',
        sensationTeamsAria: 'Filter sensation teams with highest ELO gain',
        resetFilter: 'Reset Filter',
        resetFilterAria: 'Reset team filters',

        // === Calendar ===
        gameCalendar: 'Match Schedule',
        matchday: 'Matchday',
        selectMatchday: 'Select a matchday to see the games',
        noGamesFound: 'No games found for this matchday',
        dateToSchedule: 'DATE TBD',
        previousMatchday: 'Previous matchday',
        nextMatchday: 'Next matchday',
        navigatePrevious: 'Navigate to previous matchday',
        navigateNext: 'Navigate to next matchday',

        // === Brackets ===
        eliminationBracket: 'Elimination Bracket',
        playoffLiguilha: 'Playoff/Play-in',
        bracketNotAvailable: 'Bracket not available for this sport',
        thirdPlace: '3rd Place',
        bracketLabel1stDivision: '1st Division',
        bracketLabel2ndDivision: '2nd Division',
        bracketLabelLeague: 'of the League',
        bracketLabelGroup: 'Group',
        bracketQualificationSuffix: 'th',
        bracketWinner: 'Winner',
        bracketLoser: 'Loser',
        fourthPlace: '4th Place',
        predictedMatch: '📅 Predicted Matchup',
        unknownResult: '⚠️ Unknown Result',
        quarterFinals: 'Quarterfinals',
        semiFinals: 'Semifinals',
        finals: 'Final',
        ofTheLeague: 'in League',
        div1st: '1st Div',
        div2nd: '2nd Div',
        groupAbbr: 'Gr.',

        // === Progression Legend ===
        playoffs: 'Playoffs',
        maintenancePlayoff: 'Maintenance Playoff',
        maintenanceLeague: 'Maintenance Play-in',
        relegation: 'Relegation',
        playoffsPromotion: 'Playoffs + Promotion',
        promotionPlayoff: 'Promotion Playoff',
        promotionLeague: 'Promotion Play-in',
        promotion: 'Promotion',
        safeZone: 'Safe zone',
        qualificationPlayoffs: 'Qualification for playoffs',
        replaces: 'replaces',
        ofGroup: 'of the group',
        teamBNoQualify: 'team B does not qualify',

        // === Predictions ===
        seasonPredictions: 'Season Predictions',
        generalPredictions: 'GENERAL PREDICTIONS',
        matchdayPredictions: 'Matchday-by-matchday Predictions',
        predJornada: 'Matchday',
        predDate: 'Date',
        predOpponent: 'Opponent',
        predWinProb: 'P(W)',
        predWinProbTitle: 'Probability of win',
        predDrawProb: 'P(D)',
        predDrawProbTitle: 'Probability of draw',
        predLossProb: 'P(L)',
        predLossProbTitle: 'Probability of loss',
        expectedGoals: 'Expected Goals',
        expectedGoalsAbbr: 'Exp. Goals',
        expectedGoalsTitle: 'Expected goals',
        basketGoalsExpected: 'Exp. Baskets',
        basketGoalsTitle: 'Expected baskets',
        setsExpected: 'Exp. Sets',
        setsTitle: 'Expected sets',
        noStatsAvailable: 'No statistics available',
        noPredictionsData: 'No predictions data for this sport/season',
        noDataAvailableShort: 'No data available',
        errorLoading: 'Error loading',
        loadingData: 'Loading data...',
        loadingRankings: 'Loading rankings...',
        noGamesForTeam: 'No predicted games for this team',
        dataNotAvailable: 'Data not available',
        simulations: 'Simulations',
        simulatedResults: 'Simulated Results',
        clickToFixTooltip: 'Click to pin/unpin distribution tooltip',
        previousTeam: 'Previous team',
        nextTeam: 'Next team',
        seasonStart: 'Season Start',
        eloFinalPreviousSeason: 'Previous Season Final ELO',
        eloSeasonStart: 'Season Start ELO',
        interGroupAdjustments: 'Inter-Group Adjustments',
        eloRatingLabel: 'ELO Rating',

        // Dynamic headers per sport
        basketScored: 'Baskets made',
        basketConceded: 'Baskets conceded',
        basketDiff: 'Baskets difference (BM - BC)',
        setsWon: 'Sets won',
        setsLost: 'Sets lost',
        setsDiff: 'Sets difference (SW - SL)',
        goalsScored: 'Goals scored',
        goalsConceded: 'Goals conceded',
        goalsDiff: 'Goals difference (GS - GC)',

        // Prediction stats
        predPlayoffs: 'Playoffs',
        predSemiFinals: 'Semifinals',
        predFinal: 'Final',
        predChampionsMale: 'Champions',
        predChampionsFemale: 'Champions',
        predChampionsMaleDesc: 'Probability of being champions',
        predChampionsFemaleDesc: 'Probability of being champions',
        predQualification: 'Qualification probability',
        predReachSemis: 'Probability of reaching semifinals',
        predReachFinals: 'Probability of reaching the final',
        expectedPoints: 'Expected Points',
        expectedPosition: 'Expected Group Position',
        expectedValue: 'Expected value',
        positions: 'positions',
        points: 'points',
        avgFinalElo: 'Average Final ELO',
        predPromotion: 'Promotion',
        predPromotionDesc: 'Probability of promotion',
        predRelegation: 'Relegation',
        predRelegationDesc: 'Probability of relegation',
        unknown: 'Unknown',

        // === Historical Tooltip ===
        historicalRankings: 'Rankings History',
        season: 'Season',
        group: 'Group',
        general: 'General',
        inProgress: 'In progress',
        didNotParticipate: 'Did not participate',
        as: 'As',

        // === Goals/Baskets/Sets (sport-specific) ===
        goalsScored: 'Goals scored',
        goalsConceded: 'Goals conceded',
        goalsDiff: 'Goal difference (GF - GA)',
        goalsExpected: 'Expected goals',
        goalsScoredAbbr: 'GF',
        goalsConcededAbbr: 'GA',
        goalsExpectedAbbr: 'Exp. Goals',
        basketsScored: 'Baskets scored',
        basketsConceded: 'Baskets conceded',
        basketsDiff: 'Basket difference (BS - BC)',
        basketsExpected: 'Expected baskets',
        basketsScoredAbbr: 'BS',
        basketsConcededAbbr: 'BC',
        basketsExpectedAbbr: 'Expected Baskets',
        setsWon: 'Sets won',
        setsLost: 'Sets lost',
        setsDiff: 'Set difference (SW - SL)',
        setsExpected: 'Expected sets',
        setsWonAbbr: 'SW',
        setsLostAbbr: 'SL',
        setsExpectedAbbr: 'Expected Sets',

        // === Champions ===
        championsMale: 'Champions',
        championsViceMale: 'Runners-up',
        championsFemale: 'Champions',
        championsViceFemale: 'Runners-up',

        // === Debug Panel ===
        activateDebug: 'Enable Debug',
        verboseDebug: 'Verbose Debug',
        deactivate: 'Disable',
        close: 'Close',

        // === DivisionSelector ===
        div1Label: '1st Division',
        div2Label: '2nd Division',

        // === Sports/Modalities ===
        ANDEBOL_MISTO: 'Mixed Handball',
        BASQUETEBOL_FEMININO: 'Women\'s Basketball',
        BASQUETEBOL_MASCULINO: 'Men\'s Basketball',
        FUTEBOL_DE_7_MASCULINO: 'Men\'s 7-a-side Football',
        FUTSAL_FEMININO: 'Women\'s Futsal',
        FUTSAL_MASCULINO: 'Men\'s Futsal',
        VOLEIBOL_FEMININO: 'Women\'s Volleyball',
        VOLEIBOL_MASCULINO: 'Men\'s Volleyball',

        // === Division/Group Terms ===
        division: 'Division',
        group: 'Group',
        divisionLabel: ' Division',
        mainDivision: '1st Division',
        secondDivision: '2nd Division',
        groupA: 'Group A',
        groupB: 'Group B',
        groupC: 'Group C',
        groupD: 'Group D',

        // === Additional Terms ===
        selectAllTeams: 'Select All',
        deselectAllTeams: 'Deselect All',
        invertSelection: 'Invert Selection',
        teams: 'teams',
        team: 'team',
        thirdPlace: '3rd Place',
        fourthPlace: '4th Place',
        groupPrefix: 'Group ',
        divisionPrefix: ' Division',
        noMatchesAvailable: 'No matches available',
        roundOf: 'Round of ',
        vs: 'vs',
        home: 'Home',
        away: 'Away',
        draw: 'Draw',
        matchday: 'Matchday',
        date: 'Date',
        time: 'Time',
        opponent: 'Opponent',
        result: 'Result',
        score: 'Score',

        // === Round Labels (for short label use) ===
        roundQuarters: 'Quarterfinals',
        roundSemiFinals: 'Semifinals',
        roundFinal: 'Final',
        eloFinal: 'Final ELO',
        previousSeason: 'Previous Season',
        nextSeason: 'Next Season',
    }
};

// ==================== FUNÇÕES DO i18n ====================

let currentLanguage = localStorage.getItem('mmr_selectedLanguage') || localStorage.getItem('dashboardLanguage') || 'pt';

/** * Traduz um nome de equipa para o idioma atual
 * @param {string} teamNamePt - Nome da equipa em português
 * @returns {string} Nome traduzido
 */
function translateTeamName(teamNamePt) {
    if (!teamNamePt) return '';

    // Se o idioma é português, retorna o nome original
    if (currentLanguage === 'pt') {
        return teamNamePt;
    }

    // Procurar no mapeamento de tradução
    if (teamNamesTranslation.pt && teamNamesTranslation.pt[teamNamePt]) {
        return teamNamesTranslation.pt[teamNamePt];
    }

    // Fallback: retornar o nome original se não houver tradução
    return teamNamePt;
}

/** * Obtém a tradução para uma chave.
 * Fallback para português se a chave não existir no idioma atual.
 * @param {string} key - Chave de tradução
 * @returns {string} Texto traduzido
 */
function t(key) {
    const lang = translations[currentLanguage];
    if (lang && lang[key] !== undefined) {
        return lang[key];
    }
    // Fallback para português
    if (translations.pt[key] !== undefined) {
        return translations.pt[key];
    }
    // Se nem em PT existe, retorna a chave
    console.warn(`[i18n] Missing translation key: "${key}"`);
    return key;
}

/**
 * Define o idioma atual e persiste no localStorage
 * @param {string} lang - Código do idioma ('pt' ou 'en')
 */
function setLanguage(lang) {
    if (!translations[lang]) {
        console.warn(`[i18n] Language "${lang}" not supported`);
        return;
    }
    currentLanguage = lang;
    localStorage.setItem('mmr_selectedLanguage', lang);

    // Atualizar o atributo lang do HTML
    document.documentElement.lang = lang;

    // Aplicar traduções estáticas
    applyStaticTranslations();

    // Atualizar título da página
    document.title = t('pageTitle');

    // Atualizar meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.setAttribute('content', t('pageDescription'));
    }

    // Re-renderizar todo o conteúdo dinâmico
    refreshAllContent();
}

/**
 * Obtém o idioma atual
 * @returns {string} Código do idioma
 */
function getCurrentLanguage() {
    return currentLanguage;
}

/**
 * Aplica traduções a todos os elementos com data-i18n e data-i18n-title
 */
function applyStaticTranslations() {
    // Traduzir textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    // Traduzir atributos title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.setAttribute('title', t(key));
    });

    // Traduzir placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.setAttribute('placeholder', t(key));
    });

    // Traduzir aria-labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        el.setAttribute('aria-label', t(key));
    });
}

/**
 * Re-renderiza todo o conteúdo dinâmico após mudança de idioma
 */
function refreshAllContent() {
    // Atualizar labels dos seletores de época/modalidade
    if (typeof updateSelectorLabels === 'function') {
        try {
            updateSelectorLabels();
        } catch (e) { }
    }

    // Verificar se a app já foi inicializada
    if (typeof updateRankingsTable === 'function') {
        try {
            if (typeof createDivisionSelector === 'function') {
                createDivisionSelector();
            }
            if (typeof updateGroupSelector === 'function') {
                updateGroupSelector();
            }
            updateRankingsTableHeaders();
            updateRankingsTable();
            if (typeof updateRankingsDivisionButtons === 'function') {
                updateRankingsDivisionButtons();
            }
            if (typeof updateRankingsGroupButtons === 'function') {
                updateRankingsGroupButtons();
            }
        } catch (e) { /* Silenciar se não há dados */ }
    }

    if (typeof updateCalendar === 'function') {
        try {
            if (typeof createCalendarDivisionSelector === 'function') {
                createCalendarDivisionSelector();
            }
            if (typeof createCalendarGroupSelector === 'function') {
                createCalendarGroupSelector();
            }
            updateJornadaDisplay();
            updateCalendar();
        } catch (e) { }
    }

    if (typeof createBracket === 'function') {
        try {
            createBracket();
            createSecondaryBracket();
        } catch (e) { }
    }

    if (typeof updateEloChart === 'function') {
        try {
            updateEloChart();
            createTeamSelector();
            updateQuickFilters();
            updateTeamCountIndicator();
            updateSeasonNavigationButtons();
        } catch (e) { }
    }

    if (typeof updatePredictionsDisplay === 'function') {
        try {
            if (typeof updatePredictionsSelectors === 'function') {
                updatePredictionsSelectors();
            }
            updatePredictionsDisplay();
            updatePredictionsSimulationsCount();
            updatePredictionsTableHeaders();
        } catch (e) { }
    }
}

/**
 * Inicializa o seletor de idioma na UI
 */
function initLanguageSelector() {
    const header = document.querySelector('.header');
    if (!header) return;

    // Criar container do seletor
    const selectorDiv = document.createElement('div');
    selectorDiv.className = 'language-selector';
    selectorDiv.id = 'languageSelector';

    // Botão PT
    const ptBtn = document.createElement('button');
    ptBtn.className = `lang-btn ${currentLanguage === 'pt' ? 'active' : ''}`;
    ptBtn.id = 'lang-pt';
    ptBtn.setAttribute('aria-label', 'Português');
    ptBtn.title = 'Português';
    ptBtn.innerHTML = '🇵🇹';
    ptBtn.addEventListener('click', () => {
        setLanguage('pt');
        updateLanguageButtons('pt');
    });

    // Botão EN
    const enBtn = document.createElement('button');
    enBtn.className = `lang-btn ${currentLanguage === 'en' ? 'active' : ''}`;
    enBtn.id = 'lang-en';
    enBtn.setAttribute('aria-label', 'English');
    enBtn.title = 'English';
    enBtn.innerHTML = '🇪🇳';
    enBtn.addEventListener('click', () => {
        setLanguage('en');
        updateLanguageButtons('en');
    });

    selectorDiv.appendChild(ptBtn);
    selectorDiv.appendChild(enBtn);
    header.appendChild(selectorDiv);

    // Aplicar idioma guardado
    if (currentLanguage !== 'pt') {
        setLanguage(currentLanguage);
    }
}

/**
 * Atualiza os botões de idioma (estado ativo)
 */
function updateLanguageButtons(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`lang-${lang}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// Inicializar seletor quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initLanguageSelector);

// Garantir que t() está acessível globalmente (importante para tooltips e contextos dinâmicos)
window.t = t;
window.translateTeamName = translateTeamName;
window.setLanguage = setLanguage;
window.getCurrentLanguage = getCurrentLanguage;
