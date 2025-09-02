
class ChartManager {
    constructor() {
        this.historyChart = null;
        this.comparisonChart = null;
        this.highlightedTeams = new Set();
        this.teamColors = {};
        this.currentModality = null;
        // Número máximo de equipas para exibir por padrão
        this.maxDefaultTeams = 5;
    }

    async initializeCharts(modality) {
        // Limpar destacamentos ao mudar de modalidade
        if (this.currentModality !== modality) {
            this.highlightedTeams.clear();
            this.currentModality = modality;
        }
        try {
            await window.DataLoader.loadModality(modality);
            const modalityData = window.DataLoader.getCurrentModalityData();
            if (!modalityData) {
                console.error("Não foi possível carregar dados da modalidade:", modality);
                return;
            }
            this.renderRatingHistoryChart();
            this.renderStandings();
            this.renderPlayoffTree();
            this.updateTeamSelectors();
        } catch (error) {
            console.error("Erro ao inicializar gráficos:", error);
        }
    }

    // Gera uma cor aleatória para cada equipe
    getTeamColor(team) {
        if (!this.teamColors[team]) {
            this.teamColors[team] = this.generateColor(team);
        }
        return this.teamColors[team];
    }

    generateColor(str) {
        // Gera uma cor baseada no nome da equipe para ser consistente
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }

        let color = '#';
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;
            color += ('00' + value.toString(16)).substr(-2);
        }
        return color;
    }

    // Converte string de data para objeto Date (suporta múltiplos formatos)
    parseDate(dateStr) {
        if (!dateStr) return null;
        try {
            if (dateStr.includes('/')) {
                // Formato DD/MM/YYYY
                const [day, month, year] = dateStr.split('/').map(Number);
                if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
                return new Date(year, month - 1, day);
            } else if (dateStr.includes('-')) {
                // Formato YYYY-MM-DD ou YYYY-MM-DD HH:MM:SS
                const datePart = dateStr.split(' ')[0]; // Pega apenas a parte da data
                const [year, month, day] = datePart.split('-').map(Number);
                if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
                return new Date(year, month - 1, day);
            }
            // Tenta analisar como timestamp ou outro formato
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
        } catch (e) {
            console.error("Erro ao parsear data:", dateStr, e);
            return null;
        }
    }

    renderRatingHistoryChart() {
        const ctx = document.getElementById('rating-history-chart').getContext('2d');
        if (this.historyChart) {
            this.historyChart.destroy();
        }
        const teams = window.DataLoader.getTeamsForModality();
        if (this.highlightedTeams.size === 0 && teams.length > 0) {
            const teamsToShow = teams.slice(0, this.maxDefaultTeams);
            teamsToShow.forEach(team => this.highlightedTeams.add(team));
        }
        const datasets = [];
        teams.forEach(team => {
            const teamData = window.DataLoader.getEloHistoryForTeam(team);
            if (teamData && teamData.length) {
                const visible = this.highlightedTeams.has(team);
                const dataPoints = teamData.map(d => {
                    const date = this.parseDate(d.dateStr);
                    if (!date) return null;
                    return { x: date, y: d.value };
                }).filter(point => point !== null);
                datasets.push({
                    label: team,
                    data: dataPoints,
                    backgroundColor: this.getTeamColor(team),
                    borderColor: this.getTeamColor(team),
                    fill: false,
                    tension: 0.1,
                    pointRadius: 3,
                    hidden: !visible
                });
            }
        });
        let minDate = null, maxDate = null, minElo = null, maxElo = null;
        datasets.forEach(ds => {
            ds.data.forEach(point => {
                if (point.x instanceof Date) {
                    if (!minDate || point.x < minDate) minDate = point.x;
                    if (!maxDate || point.x > maxDate) maxDate = point.x;
                }
                if (typeof point.y === 'number') {
                    if (minElo === null || point.y < minElo) minElo = point.y;
                    if (maxElo === null || point.y > maxElo) maxElo = point.y;
                }
            });
        });
        if (minElo !== null && maxElo !== null) {
            const eloMargin = Math.max(10, Math.round((maxElo - minElo) * 0.05));
            minElo -= eloMargin;
            maxElo += eloMargin;
        }
        this.historyChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'nearest', intersect: false },
                plugins: {
                    legend: {
                        position: 'right',
                        onClick: (e, legendItem, legend) => {
                            const index = legendItem.datasetIndex;
                            const teamName = this.historyChart.data.datasets[index].label;
                            this.toggleTeamHighlight(teamName);
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                const date = context[0].raw.x;
                                if (!date) return 'Data desconhecida';
                                return `Data: ${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                            },
                            label: function (context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: { day: 'dd/MM/yyyy' },
                            tooltipFormat: 'dd/MM/yyyy'
                        },
                        title: { display: true, text: 'Data' },
                        min: minDate,
                        max: maxDate
                    },
                    y: {
                        title: { display: true, text: 'Rating ELO' },
                        min: minElo,
                        max: maxElo
                    }
                }
            }
        });
    }

    renderComparisonChart(team1, team2) {
        const ctx = document.getElementById('team-comparison-chart').getContext('2d');
        if (this.comparisonChart) {
            this.comparisonChart.destroy();
        }
        const team1Data = window.DataLoader.getEloHistoryForTeam(team1);
        const team2Data = window.DataLoader.getEloHistoryForTeam(team2);
        const datasets = [];
        if (team1Data.length) {
            datasets.push({
                label: team1,
                data: team1Data.map(d => ({ x: this.parseDate(d.dateStr), y: d.value })).filter(point => point.x !== null),
                backgroundColor: this.getTeamColor(team1),
                borderColor: this.getTeamColor(team1),
                fill: false
            });
        }
        if (team2Data.length) {
            datasets.push({
                label: team2,
                data: team2Data.map(d => ({ x: this.parseDate(d.dateStr), y: d.value })).filter(point => point.x !== null),
                backgroundColor: this.getTeamColor(team2),
                borderColor: this.getTeamColor(team2),
                fill: false
            });
        }
        let minDate = null, maxDate = null, minElo = null, maxElo = null;
        datasets.forEach(ds => {
            ds.data.forEach(point => {
                if (point.x instanceof Date) {
                    if (!minDate || point.x < minDate) minDate = point.x;
                    if (!maxDate || point.x > maxDate) maxDate = point.x;
                }
                if (typeof point.y === 'number') {
                    if (minElo === null || point.y < minElo) minElo = point.y;
                    if (maxElo === null || point.y > maxElo) maxElo = point.y;
                }
            });
        });
        if (minElo !== null && maxElo !== null) {
            const eloMargin = Math.max(10, Math.round((maxElo - minElo) * 0.05));
            minElo -= eloMargin;
            maxElo += eloMargin;
        }
        this.comparisonChart = new Chart(ctx, {
            type: 'line',
            data: { datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Comparação: ${team1} vs ${team2}`
                    },
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                const date = context[0].raw.x;
                                if (!date) return 'Data desconhecida';
                                return `Data: ${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'day', displayFormats: { day: 'dd/MM/yyyy' } },
                        title: { display: true, text: 'Data' },
                        min: minDate,
                        max: maxDate
                    },
                    y: {
                        title: { display: true, text: 'Rating ELO' },
                        min: minElo,
                        max: maxElo
                    }
                }
            }
        });
    }
    // ...nenhum código fora da classe...

    toggleTeamHighlight(team) {
        if (this.highlightedTeams.has(team)) {
            this.highlightedTeams.delete(team);
        } else {
            this.highlightedTeams.add(team);
        }

        // Atualizar visibilidade no gráfico
        if (this.historyChart) {
            this.historyChart.data.datasets.forEach(dataset => {
                if (dataset.label === team) {
                    dataset.hidden = !this.highlightedTeams.has(team);
                }
            });
            this.historyChart.update();
        }

        // Atualizar destaque na tabela
        document.querySelectorAll('.standings-table .team-name').forEach(element => {
            if (element.getAttribute('data-team') === team) {
                element.classList.toggle('highlighted', this.highlightedTeams.has(team));
            }
        });
    }

    updateTeamSelectors() {
        const teams = window.DataLoader.getTeamsForModality();
        const selectors = ['team-select-1', 'team-select-2'];

        selectors.forEach((selectorId, index) => {
            const selector = document.getElementById(selectorId);
            if (!selector) return;

            // Limpar opções existentes
            selector.innerHTML = '';

            // Adicionar opções para cada equipe
            teams.forEach(team => {
                const option = document.createElement('option');
                option.value = team;
                option.textContent = team;
                selector.appendChild(option);
            });

            // Selecionar equipe por padrão
            if (teams.length > index) {
                selector.value = teams[index];
            }
        });
    }

    renderStandings() {
        const currentRatingElement = document.getElementById('current-rating');
        if (!currentRatingElement) return;

        const modalityData = window.DataLoader.getCurrentModalityData();
        if (!modalityData || !modalityData.standings || !modalityData.standings.length) {
            currentRatingElement.innerHTML = '<p>Dados de classificação não disponíveis</p>';
            return;
        }

        // Detectar grupos/divisões únicos
        let standings = modalityData.standings;
        const groups = new Set();
        const divisions = new Set();
        standings.forEach(team => {
            if (team.Grupo) groups.add(team.Grupo);
            if (team.Divisao) divisions.add(team.Divisao);
        });

        // Renderizar seletor de grupo/divisão se houver mais de um
        let selectorHtml = '';
        let selectedGroup = null;
        if (groups.size > 1 || divisions.size > 1) {
            selectorHtml += '<label for="group-select">Grupo/Divisão:</label>';
            selectorHtml += '<select id="group-select">';
            selectorHtml += '<option value="">Todos</option>';
            groups.forEach(group => {
                selectorHtml += `<option value="${group}">${group}</option>`;
            });
            divisions.forEach(divisao => {
                selectorHtml += `<option value="${divisao}">${divisao}</option>`;
            });
            selectorHtml += '</select>';
        }

        // Verifica valor selecionado
        setTimeout(() => {
            const groupSelector = document.getElementById('group-select');
            if (groupSelector) {
                groupSelector.addEventListener('change', () => {
                    this.renderStandings();
                });
                selectedGroup = groupSelector.value;
            }
        }, 0);

        // Filtrar por grupo/divisão se selecionado
        const groupSelector = document.getElementById('group-select');
        if (groupSelector && groupSelector.value) {
            selectedGroup = groupSelector.value;
        }
        if (selectedGroup) {
            standings = standings.filter(team => team.Grupo === selectedGroup || team.Divisao === selectedGroup);
        }

        // Criar tabela de classificação
        let html = selectorHtml;
        html += '<table class="standings-table">';
        html += '<thead><tr>';
        html += '<th>Pos</th><th>Equipe</th><th>Pts</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GM</th><th>GS</th><th>Dif</th><th>ELO</th>';
        html += '</tr></thead><tbody>';

        standings.forEach(team => {
            const isHighlighted = this.highlightedTeams.has(team.Equipa);
            html += `<tr>
                <td>${team.Posicao || '-'}</td>
                <td class="team-name ${isHighlighted ? 'highlighted' : ''}" data-team="${team.Equipa}">${team.Equipa || '-'}</td>
                <td>${team.pontos || '0'}</td>
                <td>${team.jogos || '0'}</td>
                <td>${team.vitorias || '0'}</td>
                <td>${team.empates || '0'}</td>
                <td>${team.derrotas || '0'}</td>
                <td>${team.golos_marcados || '0'}</td>
                <td>${team.golos_sofridos || '0'}</td>
                <td>${team.diferenca_golos || '0'}</td>
                <td>${team.elo ? team.elo.toFixed(2) : '-'}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        currentRatingElement.innerHTML = html;

        // Adicionar listeners para destacar equipas no gráfico
        document.querySelectorAll('.standings-table .team-name').forEach(element => {
            element.addEventListener('click', () => {
                const team = element.getAttribute('data-team');
                this.toggleTeamHighlight(team);
            });
        });
    }

    renderPlayoffTree() {
        const playoffElement = document.getElementById('playoff-tree');
        if (!playoffElement) return;

        const modalityData = window.DataLoader.getCurrentModalityData();
        if (!modalityData || !modalityData.playoffTree || modalityData.playoffTree.length === 0) {
            playoffElement.innerHTML = '<p>Dados dos playoffs não disponíveis</p>';
            return;
        }

        // Agrupar jogos por fase
        const phases = {};
        modalityData.playoffTree.forEach(game => {
            const phase = game.Jornada || 'Unknown';
            if (!phases[phase]) {
                phases[phase] = [];
            }
            phases[phase].push(game);
        });

        // Criar HTML para a árvore de playoffs
        let html = '<div class="playoff-tree">';

        // Ordem das fases
        const phaseOrder = ['E1', 'E2', 'E3L', 'EF'];

        // Mostrar cada fase
        phaseOrder.forEach(phase => {
            if (!phases[phase]) return;

            html += `<div class="playoff-phase">
                <h3>${this.getPhaseTitle(phase)}</h3>
                <div class="phase-games">`;

            phases[phase].forEach(game => {
                const team1Class = this.highlightedTeams.has(game['Equipa 1']) ? 'highlighted' : '';
                const team2Class = this.highlightedTeams.has(game['Equipa 2']) ? 'highlighted' : '';

                html += `<div class="playoff-game">
                    <span class="team ${team1Class} ${parseFloat(game['Golos 1']) > parseFloat(game['Golos 2']) ? 'winner' : ''}" 
                          data-team="${game['Equipa 1']}">${game['Equipa 1']}</span>
                    <span class="score">${game['Golos 1']} - ${game['Golos 2']}</span>
                    <span class="team ${team2Class} ${parseFloat(game['Golos 2']) > parseFloat(game['Golos 1']) ? 'winner' : ''}" 
                          data-team="${game['Equipa 2']}">${game['Equipa 2']}</span>
                    <div class="game-date">${game.Dia || ''}</div>
                </div>`;
            });

            html += '</div></div>';
        });

        html += '</div>';
        playoffElement.innerHTML = html;

        // Adicionar listeners para destaque de equipas
        document.querySelectorAll('.playoff-game .team').forEach(element => {
            element.addEventListener('click', () => {
                const team = element.getAttribute('data-team');
                this.toggleTeamHighlight(team);
            });
        });
    }

    getPhaseTitle(phase) {
        const titles = {
            'E1': 'Primeira Eliminatória',
            'E2': 'Segunda Eliminatória',
            'E3L': 'Disputa do 3º Lugar',
            'EF': 'Final'
        };
        return titles[phase] || phase;
    }
}

// Exportar a classe para uso global
window.ChartManager = new ChartManager();