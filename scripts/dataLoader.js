// filepath: d:\mmr_taçaua\scripts\dataLoader.js

class DataLoader {
    constructor() {
        this.modalityData = {};
        this.currentModality = null;
    }

    async loadModality(modality) {
        // Limpar dados anteriores se carregando nova modalidade
        this.currentModality = modality;

        // Se já temos os dados em cache, retornamos
        if (this.modalityData[modality]) {
            return this.modalityData[modality];
        }

        try {
            // Carregar os três arquivos para a modalidade
            const [eloData, detailData, standingsData] = await Promise.all([
                this.loadCsvFile(`elo_ratings/elo_${modality}_24_25.csv`),
                this.loadCsvFile(`elo_ratings/detalhe_${modality}_24_25.csv`),
                this.loadCsvFile(`elo_ratings/classificacao_${modality}_24_25.csv`)
            ]);

            console.log(`Carregados ${detailData.length} detalhes para ${modality}`);

            // Processar dados de detalhes para extrair evolução de ELO ao longo do tempo
            const gameDetails = this.processDetailData(detailData);
            const teamRatingHistory = this.buildTeamRatingHistory(gameDetails);
            const standings = this.processStandingsData(standingsData);
            const playoffTree = this.buildPlayoffTree(detailData);

            // Extrair lista de times desta modalidade
            const teamsInThisModality = new Set();
            gameDetails.forEach(game => {
                if (game.team1) teamsInThisModality.add(game.team1);
                if (game.team2) teamsInThisModality.add(game.team2);
            });

            // Armazenar dados processados
            this.modalityData[modality] = {
                teamHistory: teamRatingHistory,
                gameDetails,
                standings,
                playoffTree,
                teams: Array.from(teamsInThisModality)
            };

            return this.modalityData[modality];
        } catch (error) {
            console.error(`Erro ao carregar dados da modalidade ${modality}:`, error);
            return null;
        }
    }

    async loadCsvFile(filePath) {
        try {
            console.log(`Carregando arquivo: ${filePath}`);
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Erro ao carregar arquivo: ${response.status}`);
            }
            const text = await response.text();
            return this.parseCsv(text);
        } catch (error) {
            console.error(`Erro ao carregar arquivo ${filePath}:`, error);
            return [];
        }
    }

    parseCsv(text) {
        const lines = text.split('\n');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        const result = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = lines[i].split(',');
            const entry = {};

            headers.forEach((header, index) => {
                // Tratar valores numéricos
                const value = values[index]?.trim() || '';
                if (value && !isNaN(value)) {
                    entry[header] = parseFloat(value);
                } else {
                    entry[header] = value;
                }
            });

            result.push(entry);
        }

        return result;
    }

    processDetailData(detailData) {
        // Filtrar jogos inválidos e ordenar por data
        return detailData
            .filter(game => {
                return game && game.Dia && game['Equipa 1'] && game['Equipa 2'];
            })
            .map(game => {
                // Converter string de data para objeto Date
                let gameDate;
                try {
                    // Formato esperado: DD/MM/YYYY
                    const [day, month, year] = game.Dia.split('/').map(Number);
                    gameDate = new Date(year, month - 1, day);
                } catch (e) {
                    console.error("Erro ao processar data:", game.Dia, e);
                    gameDate = new Date(0); // Data inválida
                }

                return {
                    date: gameDate,
                    dateStr: game.Dia,
                    team1: game['Equipa 1'],
                    team2: game['Equipa 2'],
                    score1: game['Golos 1'] || 0,
                    score2: game['Golos 2'] || 0,
                    eloBefore1: game['Elo Antes 1'] || 1000,
                    eloBefore2: game['Elo Antes 2'] || 1000,
                    eloAfter1: game['Elo Depois 1'] || game['Final Elo 1'] || 1000,
                    eloAfter2: game['Elo Depois 2'] || game['Final Elo 2'] || 1000,
                    jornada: game['Jornada']
                };
            })
            .sort((a, b) => a.date - b.date);
    }

    // Constrói o histórico de ratings por equipe com datas
    buildTeamRatingHistory(gameDetails) {
        const teamHistory = {};

        if (!gameDetails || !gameDetails.length) {
            console.warn("Não há detalhes de jogos para construir histórico");
            return teamHistory;
        }

        console.log("Construindo histórico para", gameDetails.length, "jogos");

        // Registrar rating inicial de cada equipe (primeiro jogo)
        gameDetails.forEach(game => {
            const { team1, team2, dateStr, eloBefore1, eloBefore2, date } = game;

            if (!teamHistory[team1]) {
                teamHistory[team1] = [{
                    date: date,
                    dateStr: dateStr, // Mantém a string original da data
                    value: eloBefore1
                }];
            }

            if (!teamHistory[team2]) {
                teamHistory[team2] = [{
                    date: date,
                    dateStr: dateStr, // Mantém a string original da data
                    value: eloBefore2
                }];
            }
        });

        // Adicionar histórico de ratings após cada jogo
        gameDetails.forEach(game => {
            const { team1, team2, dateStr, eloAfter1, eloAfter2, date } = game;

            if (team1 && teamHistory[team1]) {
                teamHistory[team1].push({
                    date: date,
                    dateStr: dateStr, // Mantém a string original da data
                    value: eloAfter1
                });
            }

            if (team2 && teamHistory[team2]) {
                teamHistory[team2].push({
                    date: date,
                    dateStr: dateStr, // Mantém a string original da data
                    value: eloAfter2
                });
            }
        });

        // Log para ver quantos pontos de dados temos por equipe
        console.log("Histórico de equipes construído:");
        Object.keys(teamHistory).forEach(team => {
            console.log(`${team}: ${teamHistory[team].length} pontos`);
        });

        // Ordenar histórico por data para cada equipe e remover duplicatas
        Object.keys(teamHistory).forEach(team => {
            // Ordena por data (objeto Date)
            teamHistory[team].sort((a, b) => a.date - b.date);

            // Remover entradas duplicadas (mesma data, mesmo valor)
            const uniqueEntries = [];
            let lastEntry = null;

            for (const entry of teamHistory[team]) {
                if (!lastEntry ||
                    lastEntry.date.getTime() !== entry.date.getTime() ||
                    lastEntry.value !== entry.value) {
                    uniqueEntries.push(entry);
                    lastEntry = entry;
                }
            }

            teamHistory[team] = uniqueEntries;
        });

        return teamHistory;
    }

    processStandingsData(standingsData) {
        // Ordenar classificação pela posição
        return standingsData
            .sort((a, b) => (a.Posicao || 999) - (b.Posicao || 999));
    }

    buildPlayoffTree(detailData) {
        const playoffGames = detailData
            .filter(game => game.Jornada && String(game.Jornada).toUpperCase().startsWith('E'))
            .sort((a, b) => {
                // Ordenar por fase (E1, E2, E3L, EF) e depois por data
                const phaseA = String(a.Jornada);
                const phaseB = String(b.Jornada);

                if (phaseA === phaseB) {
                    // Ordenar pela data
                    const dateA = this.parseDate(a.Dia);
                    const dateB = this.parseDate(b.Dia);
                    return dateA - dateB;
                }

                // Mapear fases para números para ordenação
                const phaseOrder = {
                    'E1': 1,
                    'E2': 2,
                    'E3L': 3,
                    'EF': 4
                };

                return (phaseOrder[phaseA] || 99) - (phaseOrder[phaseB] || 99);
            });

        return playoffGames;
    }

    parseDate(dateStr) {
        if (!dateStr) return new Date(0);
        try {
            // Verificar o formato da data
            if (dateStr.includes('/')) {
                // Formato DD/MM/YYYY
                const [day, month, year] = dateStr.split('/').map(Number);
                return new Date(year, month - 1, day);
            } else if (dateStr.includes('-')) {
                // Formato YYYY-MM-DD ou YYYY-MM-DD HH:MM:SS
                const datePart = dateStr.split(' ')[0]; // Pega apenas a parte da data
                const [year, month, day] = datePart.split('-').map(Number);
                return new Date(year, month - 1, day);
            }
            // Formato desconhecido
            return new Date(dateStr);
        } catch (e) {
            console.error("Erro ao processar data:", dateStr, e);
            return new Date(0);
        }
    }

    getTeamsForModality() {
        if (!this.currentModality || !this.modalityData[this.currentModality]) {
            return [];
        }
        return this.modalityData[this.currentModality].teams;
    }

    getEloHistoryForTeam(teamName) {
        if (!this.currentModality || !this.modalityData[this.currentModality]) {
            return [];
        }

        return this.modalityData[this.currentModality].teamHistory[teamName] || [];
    }

    getGameDetailsWithDates() {
        if (!this.currentModality || !this.modalityData[this.currentModality]) {
            return [];
        }

        return this.modalityData[this.currentModality].gameDetails;
    }

    getCurrentModalityData() {
        return this.modalityData[this.currentModality] || null;
    }
}

// Exportar a classe para uso global
window.DataLoader = new DataLoader();