
// ==================== CONSTANTES GLOBAIS ====================
const DEFAULT_ELO = 750;

// Mostrar painel de debug com Ctrl+Shift+D
document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        const panel = document.getElementById('debug-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
});

// Inicializar aplicação
async function initApp() {
    // Carregar configuração dos cursos
    await loadCoursesConfig();

    // Inicializar seletores de época e modalidade
    initializeSelectors();

    // Não carregar dados inicialmente - aguardar seleção de modalidade
    document.getElementById('teamSelector').innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Selecione uma modalidade para ver os dados</p>';
    document.getElementById('rankingsBody').innerHTML = '<tr><td colspan="11" style="text-align: center; color: #666;">Selecione uma modalidade</td></tr>';
    document.getElementById('bracketContainer').innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Selecione uma modalidade para ver o bracket</p>';

    // Inicializar gráfico vazio
    initEloChart();
}

// Criar seletor de equipas
function createTeamSelector() {
    const selector = document.getElementById('teamSelector');
    selector.innerHTML = '';

    if (sampleData.teams.length === 0) {
        selector.innerHTML = '<p style="color: #666; text-align: center;">Selecione uma modalidade primeiro</p>';
        return;
    }

    // Aplicar layout inteligente baseado no número de equipas
    applyIntelligentTeamLayout(selector, sampleData.teams.length);

    sampleData.teams.forEach(team => {
        const label = document.createElement('label');
        label.className = 'team-checkbox active';

        // Criar elemento para o emblema
        const emblemHtml = team.emblemPath ?
            `<img src="${team.emblemPath}" alt="${team.name}" class="team-emblem" style="margin-right: 4px;" onerror="this.style.display='none'">` :
            '';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `team-${team.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        checkbox.name = checkbox.id;
        checkbox.checked = true;
        checkbox.dataset.teamName = team.name;

        const teamDot = document.createElement('div');
        teamDot.className = 'team-dot';
        teamDot.style.backgroundColor = team.color;

        const teamNameSpan = document.createElement('span');
        teamNameSpan.className = 'team-name';
        teamNameSpan.title = team.fullName;
        teamNameSpan.textContent = team.name;

        label.appendChild(checkbox);
        if (team.emblemPath) {
            const emblem = document.createElement('img');
            emblem.src = team.emblemPath;
            emblem.alt = team.name;
            emblem.className = 'team-emblem';
            emblem.style.marginRight = '4px';
            emblem.onerror = () => emblem.style.display = 'none';
            label.appendChild(emblem);
        }
        label.appendChild(teamDot);
        label.appendChild(teamNameSpan);

        label.title = team.fullName;
        selector.appendChild(label);
    });

    // Se há muitas equipas, adicionar controles de seleção rápida
    if (sampleData.teams.length > 12) {
        addQuickSelectionControls(selector);
    }

    // Inicializar indicador de equipas
    setTimeout(updateTeamCountIndicator, 100);

    // Verificar se precisa do indicador de scroll em mobile
    setTimeout(() => checkScrollIndicator(selector), 200);
}

// Função para verificar se precisa mostrar "scroll para ver mais"
function checkScrollIndicator(selector) {
    if (window.innerWidth <= 768) {
        // Em mobile, verificar se o conteúdo ultrapassa o container
        const needsScroll = selector.scrollHeight > selector.clientHeight;
        if (!needsScroll) {
            selector.style.setProperty('--show-scroll-indicator', 'none');
        } else {
            selector.style.setProperty('--show-scroll-indicator', 'block');
        }
    }
}

// Função para aplicar layout inteligente baseado no número de equipas
function applyIntelligentTeamLayout(selector, teamCount) {
    // Remover classes de layout anterior
    selector.classList.remove('many-teams', 'few-teams', 'medium-teams');

    if (teamCount <= 8) {
        // Poucas equipas: layout normal com boa margem
        selector.classList.add('few-teams');
        selector.style.gap = '12px';
    } else if (teamCount <= 16) {
        // Número médio: layout compacto mas legível
        selector.classList.add('medium-teams');
        selector.style.gap = '8px';
    } else {
        // Muitas equipas: layout muito compacto com scrolling horizontal se necessário
        selector.classList.add('many-teams');
        selector.style.gap = '6px';
    }

    // Verificar scroll indicator após aplicar layout
    setTimeout(() => checkScrollIndicator(selector), 100);
}

// Função para adicionar controles de seleção rápida
function addQuickSelectionControls(selector) {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'quick-selection-controls';
    controlsDiv.style.cssText = `
                width: 100%;
                display: flex;
                justify-content: center;
                gap: 10px;
                margin-bottom: 10px;
                padding: 10px;
                background: rgba(102, 126, 234, 0.1);
                border-radius: 8px;
            `;

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = 'Seleccionar Todas';
    selectAllBtn.className = 'quick-control-btn';
    selectAllBtn.setAttribute('aria-label', 'Selecionar todas as equipas');
    selectAllBtn.onclick = () => selectAllTeams(true);

    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.textContent = 'Desseleccionar Todas';
    deselectAllBtn.className = 'quick-control-btn';
    deselectAllBtn.setAttribute('aria-label', 'Desselecionar todas as equipas');
    deselectAllBtn.onclick = () => selectAllTeams(false);

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Inverter Seleção';
    toggleBtn.className = 'quick-control-btn';
    toggleBtn.setAttribute('aria-label', 'Inverter seleção de equipas');
    toggleBtn.onclick = toggleAllTeams;

    controlsDiv.appendChild(selectAllBtn);
    controlsDiv.appendChild(deselectAllBtn);
    controlsDiv.appendChild(toggleBtn);

    selector.prepend(controlsDiv);
}        // Funções de controle rápido
function selectAllTeams(select) {
    const checkboxes = document.querySelectorAll('#teamSelector input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        const label = checkbox.parentElement;
        checkbox.checked = select;
        if (select) {
            label.classList.add('active');
        } else {
            label.classList.remove('active');
        }
    });
    updateEloChart();
    updateTeamCountIndicator();
}

function toggleAllTeams() {
    const checkboxes = document.querySelectorAll('#teamSelector input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        const label = checkbox.parentElement;
        checkbox.checked = !checkbox.checked;
        if (checkbox.checked) {
            label.classList.add('active');
        } else {
            label.classList.remove('active');
        }
    });
    updateEloChart();
    updateTeamCountIndicator();
}

function selectDivision(division) {
    const checkboxes = document.querySelectorAll('#teamSelector input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        const teamName = checkbox.dataset.teamName;
        const team = sampleData.teams.find(t => t.name === teamName);
        const label = checkbox.parentElement;

        if (team && team.division && team.division.toString() === division) {
            checkbox.checked = true;
            label.classList.add('active');
        } else {
            checkbox.checked = false;
            label.classList.remove('active');
        }
    });
    updateEloChart();
    updateTeamCountIndicator();
}

// Alternar visibilidade da equipa no gráfico
function toggleTeam(teamName) {
    const checkbox = event.target;
    const label = checkbox.parentElement;

    if (checkbox.checked) {
        label.classList.add('active');
    } else {
        label.classList.remove('active');
    }

    updateEloChart();
    updateTeamCountIndicator();
}

// Função para atualizar indicador de número de equipas selecionadas
function updateTeamCountIndicator() {
    const activeCount = document.querySelectorAll('#teamSelector input[type="checkbox"]:checked').length;
    const totalCount = document.querySelectorAll('#teamSelector input[type="checkbox"]').length;

    let indicator = document.getElementById('team-count-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'team-count-indicator';
        indicator.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    background: rgba(102, 126, 234, 0.9);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 10px;
                    font-size: 0.75em;
                    font-weight: 500;
                    z-index: 15;
                    transition: all 0.3s ease;
                `;
        document.querySelector('.chart-container').appendChild(indicator);
    }

    indicator.textContent = `${activeCount}/${totalCount} equipas`;

    // Mudar cor baseado na quantidade
    if (activeCount > 12) {
        indicator.style.background = 'rgba(220, 53, 69, 0.9)'; // Vermelho - muitas equipas
    } else if (activeCount > 8) {
        indicator.style.background = 'rgba(255, 193, 7, 0.9)'; // Amarelo - número médio
    } else {
        indicator.style.background = 'rgba(40, 167, 69, 0.9)'; // Verde - poucas equipas
    }
}

// Criar seletor de divisões
// Criar seletor de divisões (usa DivisionSelector class)
function createDivisionSelector() {
    divisionSelector.render();
}

// Atualizar botões visuais da classificação
function updateRankingsDivisionButtons() {
    divisionSelector.setActive(appState.view.division);
}

// Trocar divisão
function switchDivision(division) {
    // Atualizar appState e variáveis globais
    appState.view.division = division;
    appState.view.group = null; // Reset group quando muda divisão
    currentDivision = division;
    currentGroup = null;

    // Atualizar UI da classificação
    divisionSelector.setActive(division);
    groupSelector.render();
    updateRankingsTable();

    // Sincronizar com o calendário
    currentCalendarDivision = division;
    currentCalendarGroup = null;

    // Atualizar botões do calendário
    document.querySelectorAll('#calendarDivisionSelector .division-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === division);
    });

    // Atualizar seletor de grupo do calendário
    createCalendarGroupSelector();

    // Atualizar jornadas disponíveis
    updateAvailableJornadas();

    // Atualizar calendário se houver jornada selecionada
    if (currentCalendarJornada) {
        updateCalendar();
    }
}

// Atualizar seletor de grupos (usa GroupSelector class)
function updateGroupSelector() {
    groupSelector.render();
}

// Atualizar botões visuais de grupo da classificação
function updateRankingsGroupButtons() {
    groupSelector.setActive(appState.view.group ? `Grupo ${appState.view.group}` : '');
}

// Trocar grupo
function switchGroup(group) {
    // Atualizar appState e variáveis globais
    appState.view.group = group;
    currentGroup = group;

    // Atualizar UI da classificação
    groupSelector.setActive(group ? `Grupo ${group}` : '');
    updateRankingsTable();

    // Sincronizar com o calendário
    currentCalendarGroup = group;

    // Atualizar botões do calendário
    document.querySelectorAll('#calendarGroupSelector .group-btn').forEach(btn => {
        const btnGroup = btn.dataset.group || '';
        const isActive = (group === null && btnGroup === '') || (btnGroup === group);
        btn.classList.toggle('active', isActive);
    });

    // Atualizar jornadas disponíveis
    updateAvailableJornadas();

    // Atualizar calendário se houver jornada selecionada
    if (currentCalendarJornada) {
        updateCalendar();
    }
}

// Inicializar gráfico ELO
function initEloChart() {
    const ctx = document.getElementById('eloChart').getContext('2d');

    eloChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false,  // Desabilitar tooltip padrão
                    mode: 'nearest',  // Modo nearest para pegar o ponto mais próximo
                    intersect: false,  // Não precisa estar exatamente sobre o ponto
                    axis: 'xy',  // Considera ambos os eixos
                    external: function (context) {
                        // Criar ou obter o elemento do tooltip
                        let tooltipEl = document.getElementById('chartjs-tooltip');

                        if (!tooltipEl) {
                            tooltipEl = document.createElement('div');
                            tooltipEl.id = 'chartjs-tooltip';
                            document.body.appendChild(tooltipEl);
                        }

                        // Esconder se não há tooltip
                        const tooltipModel = context.tooltip;
                        if (tooltipModel.opacity === 0) {
                            tooltipEl.style.opacity = 0;
                            return;
                        }

                        // Construir conteúdo do tooltip usando DOM seguro
                        if (tooltipModel.body && tooltipModel.dataPoints && tooltipModel.dataPoints.length > 0) {
                            // Pegar apenas o primeiro ponto (o mais próximo)
                            const dataPoint = tooltipModel.dataPoints[0];
                            const labels = context.chart.data.labels;
                            const dataIndex = dataPoint.dataIndex;
                            const teamName = dataPoint.dataset.label;
                            const eloValue = Math.round(dataPoint.parsed.y);

                            // Limpar tooltip e reconstruir usando DOM
                            tooltipEl.innerHTML = '';

                            // Título
                            const titleDiv = document.createElement('div');
                            titleDiv.className = 'tooltip-title';
                            titleDiv.textContent = teamName;
                            tooltipEl.appendChild(titleDiv);

                            // Body
                            const bodyDiv = document.createElement('div');
                            bodyDiv.className = 'tooltip-body';

                            // Encontrar o jogo desta equipa nesta data
                            let currentGameInfo = null;
                            let currentRound = null;

                            // Função auxiliar para comparar datas ignorando hora/timezone
                            const isSameDay = (date1, date2) => {
                                if (!date1 || !date2) return false;
                                // IMPORTANTE: Usar get* (local) porque as datas são criadas como locais, não UTC
                                const d1 = date1.getFullYear() * 10000 + date1.getMonth() * 100 + date1.getDate();
                                const d2 = date2.getFullYear() * 10000 + date2.getMonth() * 100 + date2.getDate();
                                return d1 === d2;
                            };

                            // Sempre tentar buscar jogo, exceto para pontos especiais sem data ou pontos de padding
                            const gameDetails = sampleData.gameDetails && sampleData.gameDetails[teamName];
                            const isPaddingPoint = !labels[dataIndex] || labels[dataIndex].trim() === '';

                            // Usar displayGamesDates que tem o mesmo tamanho que labels (inclui "Época Anterior")
                            const gameDatesList = sampleData.displayGamesDates || sampleData.gamesDates;

                            // Não buscar informações de jogo para pontos de padding
                            if (!isPaddingPoint && gameDetails && gameDatesList) {
                                // Verificar se o ELO mudou neste ponto (comparar com ponto anterior)
                                const previousElo = dataIndex > 0 ? dataPoint.dataset.data[dataIndex - 1] : null;
                                const eloChanged = previousElo !== null && Math.abs(eloValue - previousElo) > 0.01;

                                // Tentar obter a data para este índice
                                // Se não existir (último ponto extra), pegar a última data disponível
                                const currentDate = gameDatesList[dataIndex] || gameDatesList[gameDatesList.length - 1];

                                if (!currentDate) {
                                    // Se realmente não há data nenhuma, pular
                                    return;
                                }

                                // Usar roundsByDateOrder para saber qual jornada/fase está neste ponto exato
                                const roundsOrder = sampleData.roundsByDateOrder || [];

                                // IMPORTANTE: roundsOrder não inclui o ponto "Início" (índice 0)
                                // Calcular índice na array de rounds
                                // Se dataIndex > tamanho de gameDatesList, é um ponto extra (usar último round)
                                let roundsIndex;
                                if (dataIndex >= gameDatesList.length) {
                                    // Ponto extra no final - usar o último round
                                    roundsIndex = roundsOrder.length - 1;
                                } else {
                                    // Ponto normal - ajustar índice (dataIndex 0 = Início, dataIndex 1 = roundsOrder[0])
                                    roundsIndex = dataIndex - 1;
                                }

                                const expectedRound = roundsIndex >= 0 && roundsIndex < roundsOrder.length ? roundsOrder[roundsIndex] : null;                                        // Se o ELO mudou, este ponto representa um jogo que ACABOU de acontecer
                                if (eloChanged && expectedRound) {
                                    // Tentar encontrar o jogo com a chave exata ou convertida
                                    const roundKey = expectedRound;
                                    const roundKeyStr = String(expectedRound);
                                    const roundKeyNum = parseInt(expectedRound);

                                    if (gameDetails[roundKey]) {
                                        currentGameInfo = gameDetails[roundKey];
                                        currentRound = roundKey;
                                    } else if (gameDetails[roundKeyStr]) {
                                        currentGameInfo = gameDetails[roundKeyStr];
                                        currentRound = roundKeyStr;
                                    } else if (!isNaN(roundKeyNum) && gameDetails[roundKeyNum]) {
                                        currentGameInfo = gameDetails[roundKeyNum];
                                        currentRound = roundKeyNum;
                                    }
                                }

                                // REMOVIDO: A lógica que buscava jogos na mesma data quando ELO não mudou
                                // Isso causava o problema de mostrar jogos futuros

                                // Se ainda não encontrou jogo, buscar o último jogo anterior
                                // IMPORTANTE: Se ELO mudou, pode incluir jogo na data atual (<=)
                                // Se ELO não mudou, buscar apenas jogos anteriores (<)
                                if (!currentGameInfo) {
                                    let closestRound = null;
                                    let closestDate = null;

                                    for (const [round, gameInfo] of Object.entries(gameDetails)) {
                                        // Se ELO mudou, incluir jogos até a data atual (<=)
                                        // Se não mudou, buscar apenas jogos anteriores (<)
                                        const dateCondition = eloChanged ?
                                            (gameInfo.date && gameInfo.date <= currentDate) :
                                            (gameInfo.date && gameInfo.date < currentDate);

                                        if (dateCondition) {
                                            if (!closestDate || gameInfo.date > closestDate) {
                                                closestDate = gameInfo.date;
                                                closestRound = round;
                                            }
                                        }
                                    }

                                    if (closestRound) {
                                        currentRound = closestRound;
                                        currentGameInfo = gameDetails[closestRound];
                                    }
                                }
                            }

                            // ELO com variação
                            const eloDiv = document.createElement('div');
                            eloDiv.textContent = 'ELO: ' + eloValue;

                            // Calcular o delta real comparando com o ponto anterior
                            const prevElo = dataIndex > 0 ? dataPoint.dataset.data[dataIndex - 1] : null;
                            const actualDelta = prevElo !== null ? eloValue - prevElo : 0;

                            // Mostrar delta do último jogo (se existir)
                            let deltaToShow = actualDelta;

                            // Se não mudou neste ponto mas temos info do último jogo, buscar sua variação
                            if (Math.abs(actualDelta) < 0.01 && currentGameInfo && currentGameInfo.eloDelta !== undefined) {
                                deltaToShow = currentGameInfo.eloDelta;
                            }

                            // Mostrar delta se for significativo
                            if (Math.abs(deltaToShow) > 0.01) {
                                const isPositive = deltaToShow > 0;
                                const color = isPositive ? '#28a745' : '#dc3545';
                                const arrow = isPositive ? '↑' : '↓';
                                const deltaAbs = Math.abs(deltaToShow).toFixed(0);

                                const deltaSpan = document.createElement('span');
                                deltaSpan.style.color = color;
                                deltaSpan.style.fontWeight = '600';
                                deltaSpan.style.marginLeft = '8px';
                                deltaSpan.textContent = arrow + ' ' + deltaAbs;
                                eloDiv.appendChild(document.createTextNode(' '));
                                eloDiv.appendChild(deltaSpan);
                            }

                            bodyDiv.appendChild(eloDiv);

                            // Resultado do jogo - mostrar sempre o último jogo (se existir)
                            if (currentGameInfo && !currentGameInfo.isAdjustment) {
                                // Verificar se este ponto é exatamente onde o jogo aconteceu
                                const isExactGamePoint = Math.abs(actualDelta) > 0.01;

                                // Adicionar título "Último jogo:" se não for o ponto exato
                                if (!isExactGamePoint) {
                                    const lastGameLabel = document.createElement('div');
                                    lastGameLabel.style.fontSize = '0.9em';
                                    lastGameLabel.style.color = '#999';
                                    lastGameLabel.style.marginTop = '4px';
                                    lastGameLabel.textContent = 'Último jogo:';
                                    bodyDiv.appendChild(lastGameLabel);
                                }

                                const resultDiv = document.createElement('div');

                                if (currentGameInfo.unknownResult) {
                                    // Resultado desconhecido
                                    resultDiv.style.color = '#ffc107';
                                    const resultParts = currentGameInfo.result ? currentGameInfo.result.split('-') : ['?', '?'];
                                    const resultInt = currentGameInfo.result ?
                                        Math.floor(parseFloat(resultParts[0])) + '-' + Math.floor(parseFloat(resultParts[1])) :
                                        '? - ?';
                                    resultDiv.textContent = '⚠️ ' + resultInt + ' vs ' + currentGameInfo.opponent;
                                } else if (currentGameInfo.result !== null && currentGameInfo.opponent) {
                                    // Resultado normal
                                    const resultParts = currentGameInfo.result.split('-');
                                    const resultInt = Math.floor(parseFloat(resultParts[0])) + '-' + Math.floor(parseFloat(resultParts[1]));
                                    resultDiv.textContent = resultInt + ' vs ' + currentGameInfo.opponent;
                                }

                                if (resultDiv.textContent) {
                                    bodyDiv.appendChild(resultDiv);
                                }
                            }

                            tooltipEl.appendChild(bodyDiv);

                            // Forma (últimos 5 jogos) - buscar até a data atual
                            const gameDetails2 = sampleData.gameDetails && sampleData.gameDetails[teamName];

                            // Mostrar forma sempre que houver jogos até esta data (exceto pontos de padding)
                            if (!isPaddingPoint && gameDetails2 && gameDatesList) {
                                const currentDate = gameDatesList[dataIndex] || gameDatesList[gameDatesList.length - 1];

                                // Coletar todos os jogos até esta data
                                // Se ELO mudou (jogo aconteceu aqui), incluir jogos até esta data (<=)
                                // Se não mudou, incluir apenas jogos anteriores (<)
                                const gamesUpToDate = [];
                                for (const [round, gameInfo] of Object.entries(gameDetails2)) {
                                    const dateCondition = Math.abs(actualDelta) > 0.01 ?
                                        (gameInfo.date && gameInfo.date <= currentDate) :
                                        (gameInfo.date && gameInfo.date < currentDate);

                                    if (dateCondition && gameInfo.outcome) {
                                        gamesUpToDate.push({
                                            date: gameInfo.date,
                                            outcome: gameInfo.outcome
                                        });
                                    }
                                }

                                // Ordenar por data e pegar os últimos 5
                                gamesUpToDate.sort((a, b) => a.date - b.date);
                                const last5 = gamesUpToDate.slice(-5);

                                if (last5.length > 0) {
                                    const formDiv = document.createElement('div');
                                    formDiv.className = 'tooltip-body';
                                    formDiv.style.borderTop = '1px solid rgba(255,255,255,0.2)';
                                    formDiv.style.paddingTop = '4px';
                                    formDiv.style.marginTop = '4px';
                                    formDiv.appendChild(document.createTextNode('Forma: '));

                                    last5.forEach((game, idx) => {
                                        let color = '#6c757d';
                                        if (game.outcome === 'V') color = '#28a745';
                                        else if (game.outcome === 'D') color = '#dc3545';

                                        const outcomeSpan = document.createElement('span');
                                        outcomeSpan.style.color = color;
                                        outcomeSpan.style.fontWeight = '600';
                                        if (idx > 0) outcomeSpan.style.marginLeft = '6px';
                                        outcomeSpan.textContent = game.outcome;
                                        formDiv.appendChild(outcomeSpan);
                                    });

                                    tooltipEl.appendChild(formDiv);
                                }
                            }

                            // Footer
                            const footerDiv = document.createElement('div');
                            footerDiv.className = 'tooltip-footer';

                            if (labels[dataIndex] === 'Início' || labels[dataIndex] === 'Época Anterior') {
                                footerDiv.textContent = labels[dataIndex];
                            } else {
                                const labelText = labels[dataIndex];

                                // Se é um ponto de padding (label vazio), não mostrar informações de jornada
                                if (!labelText || labelText.trim() === '') {
                                    // Não adicionar footer para pontos de padding
                                } else if (labelText.includes('Ajustes')) {
                                    // Para ajustes inter-grupos, mostrar apenas o texto (sem data)
                                    footerDiv.textContent = 'Ajustes Inter-Grupos';
                                } else if (labelText.includes('(') && labelText.includes(')')) {
                                    footerDiv.textContent = labelText;
                                } else {
                                    // Buscar a jornada específica do jogo desta equipa nesta data
                                    // Usar o currentRound que já foi encontrado no body do tooltip
                                    // Isso garante consistência quando há múltiplos jogos no mesmo dia

                                    // Se não há jornada (entre Início e primeiro jogo), mostrar apenas a data
                                    if (!currentRound) {
                                        footerDiv.textContent = 'Data: ' + labelText;
                                    } else {
                                        let jornadaStr = currentRound;

                                        // Traduzir fases de playoff se necessário
                                        const formatRoundLabel = (round) => {
                                            if (round === 'E1') return 'Quartos de Final';
                                            if (round === 'E2') return 'Meias-Finais';
                                            if (round === 'E3') return 'Final';
                                            if (round === 'E3L') return '3º/4º Lugar';
                                            return round;
                                        };

                                        jornadaStr = formatRoundLabel(jornadaStr);
                                        let specificDateStr = labelText;

                                        footerDiv.textContent = 'Jornada: ' + jornadaStr + ' | Data: ' + specificDateStr;
                                    }
                                }
                            }

                            // Só adicionar footer se tiver conteúdo
                            if (footerDiv.textContent) {
                                tooltipEl.appendChild(footerDiv);
                            }
                        }

                        // Posicionar o tooltip seguindo o mouse
                        const position = context.chart.canvas.getBoundingClientRect();
                        const canvasTop = position.top + window.pageYOffset;
                        const canvasLeft = position.left + window.pageXOffset;

                        tooltipEl.style.opacity = 1;
                        tooltipEl.style.position = 'absolute';

                        // Posicionar à direita do cursor com offset
                        let tooltipLeft = canvasLeft + tooltipModel.caretX + 15;
                        let tooltipTop = canvasTop + tooltipModel.caretY - 10;

                        // Ajustar se sair da tela à direita
                        const tooltipWidth = tooltipEl.offsetWidth;
                        if (tooltipLeft + tooltipWidth > window.innerWidth) {
                            tooltipLeft = canvasLeft + tooltipModel.caretX - tooltipWidth - 15;
                        }

                        // Ajustar se sair da tela embaixo
                        const tooltipHeight = tooltipEl.offsetHeight;
                        if (tooltipTop + tooltipHeight > window.innerHeight + window.pageYOffset) {
                            tooltipTop = window.innerHeight + window.pageYOffset - tooltipHeight - 10;
                        }

                        // Ajustar se sair da tela em cima
                        if (tooltipTop < window.pageYOffset) {
                            tooltipTop = window.pageYOffset + 10;
                        }

                        tooltipEl.style.left = tooltipLeft + 'px';
                        tooltipEl.style.top = tooltipTop + 'px';
                        tooltipEl.style.pointerEvents = 'none';
                    }
                },
                zoom: {
                    pan: {
                        enabled: false,
                        mode: 'xy',
                        modifierKey: null,
                        onPanComplete: function () {
                            setTimeout(updateDynamicTeamLabels, 100);
                        }
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        drag: {
                            enabled: false,
                            backgroundColor: 'rgba(225,225,225,0.3)'
                        },
                        mode: 'xy',
                        onZoomComplete: function () {
                            setTimeout(updateDynamicTeamLabels, 100);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        padding: 10
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    },
                    ticks: {
                        padding: 5
                    }
                }
            },
            elements: {
                line: {
                    tension: 0.15
                },
                point: {
                    radius: 4,
                    hoverRadius: 6
                }
            },
            layout: {
                padding: {
                    right: 50
                }
            }
        }
    });

    // Adicionar funcionalidade de pan manual
    setupManualPan();
}

// Configurar pan manual com eventos de mouse
function setupManualPan() {
    const canvas = eloChart.canvas;

    canvas.addEventListener('mousedown', function (event) {
        if (!appState.chart.pan.enabled || !eloChart) return;

        appState.chart.pan.isPanning = true;
        appState.chart.pan.startX = event.clientX;
        appState.chart.pan.startY = event.clientY;
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', function (event) {
        if (!appState.chart.pan.isPanning || !appState.chart.pan.enabled || !eloChart) return;

        const deltaX = event.clientX - appState.chart.pan.startX;
        const deltaY = event.clientY - appState.chart.pan.startY;

        const xScale = eloChart.scales.x;
        const yScale = eloChart.scales.y;

        // Calcular movimento proporcional
        const xRange = xScale.max - xScale.min;
        const yRange = yScale.max - yScale.min;

        const xMovement = -(deltaX / canvas.width) * xRange;
        const yMovement = (deltaY / canvas.height) * yRange;

        // Aplicar pan
        eloChart.options.scales.x.min = (eloChart.options.scales.x.min || xScale.min) + xMovement;
        eloChart.options.scales.x.max = (eloChart.options.scales.x.max || xScale.max) + xMovement;
        eloChart.options.scales.y.min = (eloChart.options.scales.y.min || yScale.min) + yMovement;
        eloChart.options.scales.y.max = (eloChart.options.scales.y.max || yScale.max) + yMovement;

        eloChart.update('none');
        updateDynamicTeamLabels();

        appState.chart.pan.startX = event.clientX;
        appState.chart.pan.startY = event.clientY;
    });

    canvas.addEventListener('mouseup', function () {
        if (appState.chart.pan.isPanning) {
            appState.chart.pan.isPanning = false;
            canvas.style.cursor = appState.chart.pan.enabled ? 'grab' : 'default';
        }
    });

    canvas.addEventListener('mouseleave', function () {
        if (appState.chart.pan.isPanning) {
            appState.chart.pan.isPanning = false;
            canvas.style.cursor = 'default';
        }
    });

    // Função global para ativar/desativar pan
    window.toggleManualPan = function () {
        appState.chart.pan.enabled = !appState.chart.pan.enabled;
        canvas.style.cursor = appState.chart.pan.enabled ? 'grab' : 'default';

        const panButton = document.getElementById('panButton');
        if (panButton) {
            panButton.textContent = appState.chart.pan.enabled ? '🤚 Pan: ON' : '✋ Pan: OFF';
            panButton.classList.toggle('active', appState.chart.pan.enabled);
        }
    };
}

// Atualizar gráfico ELO
function updateEloChart() {
    if (!eloChart || !sampleData.teams || sampleData.teams.length === 0) {
        DebugUtils.debugEloChart('insufficient_data');
        return;
    }

    DebugUtils.debugEloChart('updating');

    const datasets = [];
    const checkboxes = document.querySelectorAll('#teamSelector input[type="checkbox"]');

    // Verificar se existem ajustes intergrupos reais nos dados atuais
    const hasAdjustments = currentModalityHasAdjustments;

    // Função helper para formatar labels
    const formatRoundLabel = (round) => {
        if (round === 'E1') return 'Quartos de Final';
        if (round === 'E2') return 'Meias-Finais';
        if (round === 'E3') return 'Final';
        if (round === 'E3L') return '3º/4º Lugar';
        if (round === 'Inter-Group') return 'Ajustes Inter-Grupos';
        return round;
    };

    // Criar labels com datas formatadas e identificação das fases
    let labels = [];
    if (sampleData.gamesDates && sampleData.gamesDates.length > 0) {
        const roundsOrder = sampleData.roundsByDateOrder || [];

        // Criar labels a partir das datas e fases
        labels = sampleData.gamesDates.map((date, index) => {
            if (index === 0) {
                return 'Início'; // Primeira posição é sempre "Início"
            }

            // Obter a fase/jornada deste ponto (ajustar índice -1 porque roundsOrder não inclui "Início")
            const roundIdx = index - 1;
            const round = roundIdx >= 0 && roundIdx < roundsOrder.length ? roundsOrder[roundIdx] : null;

            // Se for ajuste inter-grupos, mostrar apenas isso
            if (round === 'Inter-Group') {
                return 'Ajustes Inter-Grupos';
            }

            // Se for playoff, adicionar "(Playoffs)" à data
            const isPlayoff = round && typeof round === 'string' && round.startsWith('E');

            if (date instanceof Date) {
                // IMPORTANTE: Usar getDate() e getMonth() SEM UTC porque as datas são locais
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const dateStr = `${day}/${month}`;
                return isPlayoff ? `${dateStr} (Playoffs)` : dateStr;
            }
            return '';
        });

        // Adicionar "Época Anterior" no início se houver época anterior disponível
        const currentEpochElement = document.getElementById('epoca');
        if (currentEpochElement) {
            const currentEpoch = currentEpochElement.value;
            const currentIndex = availableEpocas.indexOf(currentEpoch);
            if (currentIndex < availableEpocas.length - 1) {
                labels.unshift('Época Anterior');
            }
        }

        sampleData.displayGamesDates = sampleData.gamesDates;
    } else {
        // Fallback para jornadas se não houver datas
        let maxRounds = 0;
        sampleData.teams.forEach(team => {
            if (sampleData.eloHistory[team.name] && sampleData.eloHistory[team.name].length > maxRounds) {
                maxRounds = sampleData.eloHistory[team.name].length;
            }
        });
        labels = Array.from({ length: maxRounds }, (_, i) => i === 0 ? 'Início' : `Jornada ${i}`);

        // Adicionar "Ajustes" só se há ajustes reais
        if (hasAdjustments && labels.length > 1) {
            labels[labels.length - 1] = 'Ajustes';
        }

        // Calcular número de jornadas regulares previstas
        // Primeiro tentar do calendário (csv_modalidades), depois dos resultados (detalhe)
        let regularSeasonGames = sampleData.totalRegularSeasonGames || 0;

        // Se não temos do calendário, tentar dos resultados já jogados
        if (regularSeasonGames === 0 && sampleData.rawEloData && sampleData.rawEloData.length > 0) {
            const regularRounds = sampleData.rawEloData
                .filter(match => match.Jornada && !isNaN(parseInt(match.Jornada)))
                .map(match => parseInt(match.Jornada));
            regularSeasonGames = regularRounds.length > 0 ? Math.max(...regularRounds) : 0;
        }

        // NÃO calcular automaticamente - usar apenas o número real de jornadas dos dados
        // (modalidades têm estruturas diferentes: divisões, grupos, etc)

        // Adicionar labels vazias até meio da temporada
        // labels.length - 1 porque o primeiro é "Início", não uma jornada
        const jornadasFeitas = labels.length - 1;
        const meioTemporada = Math.ceil(regularSeasonGames / 2);

        // Se ainda não passou do meio da temporada, adicionar espaços até ao total previsto
        // Se já passou do meio, não adicionar mais espaços vazios
        let labelsVazias = 0;
        if (jornadasFeitas < meioTemporada) {
            labelsVazias = regularSeasonGames - jornadasFeitas;
        }

        if (labelsVazias > 0) {
            for (let i = 0; i < labelsVazias; i++) {
                labels.push('');
            }
        }

        // Adicionar ponto extra no início para "Época Anterior" (só se houver época anterior)
        const currentEpochElement = document.getElementById('epoca');
        if (currentEpochElement) {
            const currentEpoch = currentEpochElement.value;
            const currentIndex = availableEpocas.indexOf(currentEpoch);
            if (currentIndex < availableEpocas.length - 1) {
                labels.unshift('Época Anterior');
            }
        }
    }

    // Garantir número mínimo/máximo de pontos no eixo X (pad labels LOCALMENTE, não modificar sampleData)
    // IMPORTANTE: NÃO modificar sampleData.gamesDates pois ele é reutilizado em cada atualização

    // Contar jogos reais (ignorar data inicial 01/09 e "Época Anterior")
    let realGamesCount = 0;
    if (sampleData.gamesDates) {
        realGamesCount = sampleData.gamesDates.filter((date, idx) => {
            if (!date || date === null) return false;
            if (!(date instanceof Date)) return false;
            // Ignorar data inicial 01/09
            if (date.getDate() === 1 && date.getMonth() === 8) return false;
            return true;
        }).length;
    }

    const desiredTotal = (realGamesCount >= 10) ? 20 : 10;

    // Adicionar padding apenas aos labels (NÃO modificar sampleData.gamesDates)
    while (labels.length < desiredTotal) {
        labels.push('');
    }

    DebugUtils.debugEloChart('labels', labels);
    DebugUtils.debugEloChart('adjustments', hasAdjustments);

    checkboxes.forEach((checkbox, index) => {
        if (checkbox.checked && sampleData.teams[index]) {
            const team = sampleData.teams[index];
            const teamHistory = sampleData.eloHistory[team.name] || [DEFAULT_ELO];

            DebugUtils.debugEloChart('team_added', { name: team.name, history: teamHistory });

            // Duplicar o primeiro valor para criar o ponto "Época Anterior" 
            // (só se houver época anterior E a equipa estava nessa época)
            let dataToUse = teamHistory;
            const currentEpochElement = document.getElementById('epoca');
            if (currentEpochElement) {
                const currentEpoch = currentEpochElement.value;
                const currentIndex = availableEpocas.indexOf(currentEpoch);

                // Verificar se há época anterior disponível
                const hasPreviousEpoch = currentIndex < availableEpocas.length - 1;

                // Verificar se a equipa estava na época anterior
                const wasInPreviousSeason = sampleData.teamsFromPreviousSeason &&
                    sampleData.teamsFromPreviousSeason.has(team.name);

                // Só adicionar ponto da época anterior se AMBAS as condições forem verdadeiras
                if (hasPreviousEpoch && wasInPreviousSeason) {
                    dataToUse = [teamHistory[0], ...teamHistory];
                } else if (hasPreviousEpoch && !wasInPreviousSeason) {
                    // Equipa nova: adicionar null no início para alinhar com os labels
                    dataToUse = [null, ...teamHistory];
                } else {
                    // Sem época anterior disponível
                    dataToUse = teamHistory;
                }
            }

            datasets.push({
                label: team.name,
                data: dataToUse,
                borderColor: team.color,
                backgroundColor: team.color + '20',
                fill: false,
                borderWidth: 3,
                tension: 0.15
            });
        }
    });

    DebugUtils.debugEloChart('datasets_total', datasets.length);

    // Garantir que todos os datasets têm o mesmo comprimento que labels
    datasets.forEach(ds => {
        if (!ds.data) ds.data = [];
        while (ds.data.length < labels.length) ds.data.push(null);
    });

    eloChart.data.labels = labels;
    eloChart.data.datasets = datasets;            // Calcular min e max dos dados e adicionar padding de 5%
    if (datasets.length > 0) {
        let allValues = [];
        datasets.forEach(dataset => {
            if (dataset.data) {
                allValues = allValues.concat(dataset.data.filter(v => v !== null && v !== undefined));
            }
        });

        if (allValues.length > 0) {
            const minValue = Math.min(...allValues);
            const maxValue = Math.max(...allValues);
            const range = maxValue - minValue;
            const padding = range > 0 ? range * 0.05 : 50; // Pelo menos 50 pontos de padding se range=0

            eloChart.options.scales.y.min = minValue - padding;
            eloChart.options.scales.y.max = maxValue + padding;
        } else {
            // Se não há valores válidos, definir escala padrão
            eloChart.options.scales.y.min = 0;
            eloChart.options.scales.y.max = 2000;
        }
    }

    eloChart.update('active');

    // Atualizar labels dinâmicos após o gráfico ser renderizado
    setTimeout(() => {
        updateDynamicTeamLabels();
    }, 100);
}

// Função para criar e posicionar labels dinâmicos no final das linhas
function updateDynamicTeamLabels() {
    const labelsContainer = document.getElementById('teamEndLabels');
    const chartInstance = eloChart;

    if (!chartInstance || !labelsContainer) return;

    labelsContainer.innerHTML = ''; // Limpar labels existentes

    // Obter apenas as equipas ativas (visíveis no gráfico)
    const activeDatasets = chartInstance.data.datasets || [];
    const chartArea = chartInstance.chartArea;
    const canvas = chartInstance.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = labelsContainer.getBoundingClientRect();

    // Calcular offset entre canvas e container
    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    // Coletar informações de todas as equipas primeiro
    const teamEndpoints = [];

    activeDatasets.forEach((dataset, datasetIndex) => {
        if (dataset && dataset.data && dataset.data.length > 0) {
            // Em vez de procurar o último ponto absoluto, encontrar o último ponto VISÍVEL
            let rightmostVisibleIndex = -1;
            let rightmostVisibleX = -Infinity;

            // Percorrer todos os pontos para encontrar o mais à direita que está visível
            for (let i = 0; i < dataset.data.length; i++) {
                if (dataset.data[i] !== null && dataset.data[i] !== undefined) {
                    const xPixel = chartInstance.scales.x.getPixelForValue(i);

                    // Verificar se este ponto está na área visível do gráfico
                    if (xPixel >= chartArea.left && xPixel <= chartArea.right) {
                        if (xPixel > rightmostVisibleX) {
                            rightmostVisibleX = xPixel;
                            rightmostVisibleIndex = i;
                        }
                    }
                }
            }

            // Se encontrou um ponto visível, usar esse
            if (rightmostVisibleIndex >= 0) {
                const visibleValue = dataset.data[rightmostVisibleIndex];
                const xPixel = chartInstance.scales.x.getPixelForValue(rightmostVisibleIndex);
                const yPixel = chartInstance.scales.y.getPixelForValue(visibleValue);

                // Verificar se o ponto Y também está numa área razoável
                if (yPixel >= chartArea.top - 50 && yPixel <= chartArea.bottom + 50) {
                    teamEndpoints.push({
                        dataset: dataset,
                        xPosition: xPixel,
                        yPixel: yPixel,
                        lastValue: visibleValue,
                        name: dataset.label,
                        dataIndex: rightmostVisibleIndex
                    });
                }
            }
        }
    });

    // Calcular nível de zoom atual para ajustar thresholds dinamicamente
    const yScale = chartInstance.scales.y;
    const xScale = chartInstance.scales.x;

    // Calcular fator de zoom baseado na diferença entre escalas atuais e originais
    const originalYRange = yScale.max - yScale.min;
    const originalXRange = xScale.max - xScale.min;

    // Estimar zoom baseado na altura visível da escala Y
    const currentYRange = (eloChart.options.scales?.y?.max || yScale.max) -
        (eloChart.options.scales?.y?.min || yScale.min);
    const currentXRange = (eloChart.options.scales?.x?.max || xScale.max) -
        (eloChart.options.scales?.x?.min || xScale.min);

    const yZoomFactor = originalYRange / currentYRange;
    const xZoomFactor = originalXRange / currentXRange;
    const avgZoomFactor = (yZoomFactor + xZoomFactor) / 2;

    // Ajustar thresholds baseado no zoom - quanto maior o zoom, menor o threshold
    // Isso permite que labels se separem quando há zoom suficiente
    const baseProximityThreshold = 25;
    const baseEloThreshold = 15;

    // Reduzir thresholds com zoom para permitir separação de labels
    const proximityThreshold = Math.max(8, baseProximityThreshold / Math.sqrt(avgZoomFactor));
    const eloThreshold = Math.max(3, baseEloThreshold / Math.sqrt(avgZoomFactor));

    DebugUtils.debugVisualization('zoom_info', {
        zoom: avgZoomFactor.toFixed(2),
        proximity: proximityThreshold.toFixed(1),
        eloThreshold: eloThreshold.toFixed(1)
    });

    const processedTeams = new Set();
    const labelsToShow = [];

    teamEndpoints.forEach((team, index) => {
        if (processedTeams.has(index)) return;

        // Encontrar equipas próximas
        const nearbyTeams = [team];
        const nearbyIndices = [index];

        teamEndpoints.forEach((otherTeam, otherIndex) => {
            if (otherIndex === index || processedTeams.has(otherIndex)) return;

            const verticalDistance = Math.abs(team.yPixel - otherTeam.yPixel);
            const eloDistance = Math.abs(team.lastValue - otherTeam.lastValue);
            const horizontalDistance = Math.abs(team.xPosition - otherTeam.xPosition);

            // Lógica melhorada: equipas são consideradas próximas se:
            // 1. Estão visualmente próximas (pixels) E têm ELO similar
            // 2. OU estão muito próximas visualmente independente do ELO
            const isVisuallyClose = verticalDistance < proximityThreshold;
            const hasCloseELO = eloDistance < eloThreshold;
            const isVeryClose = verticalDistance < (proximityThreshold / 2);

            if ((isVisuallyClose && hasCloseELO) || isVeryClose) {
                // Adicionar verificação de distância horizontal para evitar agrupar linhas muito distantes horizontalmente
                if (horizontalDistance < 150) {
                    nearbyTeams.push(otherTeam);
                    nearbyIndices.push(otherIndex);
                }
            }
        });

        // Marcar todas as equipas próximas como processadas
        nearbyIndices.forEach(idx => processedTeams.add(idx));

        if (nearbyTeams.length === 1) {
            // Equipa isolada - mostrar normalmente
            labelsToShow.push(team);
        } else {
            // Com zoom alto suficiente, mostrar labels individuais
            if (avgZoomFactor > 3) {
                // Zoom alto - mostrar todas as equipas individualmente
                nearbyTeams.forEach(nearbyTeam => {
                    labelsToShow.push(nearbyTeam);
                });
            } else {
                // Zoom normal - agrupar equipas próximas e mostrar apenas a com ELO mais alto
                const highestEloTeam = nearbyTeams.reduce((highest, current) =>
                    current.lastValue > highest.lastValue ? current : highest
                );

                // Criar label combinado com informação de múltiplas equipas
                const combinedTeam = {
                    ...highestEloTeam,
                    name: nearbyTeams.length > 3
                        ? `${highestEloTeam.name} (+${nearbyTeams.length - 1} outras)`
                        : nearbyTeams.map(t => t.name).join(', '),
                    isGroup: nearbyTeams.length > 1,
                    groupSize: nearbyTeams.length
                };

                labelsToShow.push(combinedTeam);
            }
        }
    });

    // Criar os labels visuais para pontos relevantes
    labelsToShow.forEach((team, index) => {
        const label = document.createElement('div');
        label.className = 'team-end-label visible';
        if (team.isGroup) {
            label.classList.add('group-label');
        }

        label.style.borderColor = team.dataset.borderColor;
        label.style.color = team.dataset.borderColor;

        // As coordenadas xPosition e yPixel já são absolutas em relação ao canvas
        // Calcular posição diretamente sem subtração adicional
        let labelX = team.xPosition + 8; // Offset padrão de 8px à direita do ponto
        let labelY = team.yPixel;

        // Se o ponto estiver fora da área direita, colocar label na borda direita
        if (team.xPosition > chartArea.right) {
            labelX = chartArea.right + 8; // Fixar logo após a borda direita
        }

        // Com zoom alto, adicionar pequeno offset vertical para labels individuais muito próximas
        if (avgZoomFactor > 3) {
            // Verificar se há outras labels muito próximas e ajustar posição
            const otherLabels = labelsToShow.slice(0, index);
            const conflictingLabels = otherLabels.filter(other => {
                return Math.abs(labelY - other.yPixel) < 18 && Math.abs(labelX - (other.xPosition + 8)) < 60;
            });

            if (conflictingLabels.length > 0) {
                labelY += conflictingLabels.length * 18; // Offset de 18px por cada label conflitante
            }
        }

        // Garantir que a label fica dentro dos limites do canvas
        labelX = Math.max(chartArea.left + 8, Math.min(chartArea.right + 100, labelX));
        labelY = Math.max(chartArea.top, Math.min(chartArea.bottom - 20, labelY));

        // Posicionamento final com offset correto (coordenadas já são absolutas)
        label.style.left = (offsetX + labelX) + 'px';
        label.style.top = (offsetY + labelY) + 'px';
        label.textContent = team.name;

        labelsContainer.appendChild(label);
    });

    // Adicionar botão de época anterior
    addPreviousSeasonButton();
}

// Função para adicionar botão de época anterior
function addPreviousSeasonButton() {
    const labelsContainer = document.getElementById('teamEndLabels');
    const chartInstance = eloChart;

    if (!chartInstance || !labelsContainer) return;

    const chartArea = chartInstance.chartArea;
    const canvas = chartInstance.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = labelsContainer.getBoundingClientRect();

    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    // Remover botões existentes
    const existingButtons = labelsContainer.querySelectorAll('.season-nav-btn');
    existingButtons.forEach(btn => btn.remove());

    // Obter época atual
    const currentEpochElement = document.getElementById('epoca');
    if (!currentEpochElement) return;

    const currentEpoch = currentEpochElement.value;
    const currentIndex = availableEpocas.indexOf(currentEpoch);

    const yPosition = offsetY + chartArea.top - 40; // 40px acima do gráfico

    // Botão Época Anterior (só se houver época anterior)
    if (currentIndex < availableEpocas.length - 1) {
        const previousEpoch = availableEpocas[currentIndex + 1];
        const btnPrev = document.createElement('button');
        btnPrev.className = 'season-nav-btn previous-season-btn';
        btnPrev.textContent = '← Época Anterior';
        btnPrev.title = `Ver época 20${previousEpoch.replace('_', '/')}`;
        btnPrev.setAttribute('aria-label', `Navegar para época anterior 20${previousEpoch.replace('_', '/')}`);

        // Posicionar à esquerda
        btnPrev.style.left = (offsetX + chartArea.left) + 'px';
        btnPrev.style.top = yPosition + 'px';

        btnPrev.onclick = () => {
            // Obter modalidade atual (sem a época)
            const modalidadeSelect = document.getElementById('modalidade');
            const currentMod = modalidadeSelect.value.replace(`_${currentEpoch}`, '');

            // Mudar época
            currentEpochElement.value = previousEpoch;
            changeEpoca(previousEpoch);

            // Selecionar a mesma modalidade na nova época
            setTimeout(() => {
                const newModValue = `${currentMod}_${previousEpoch}`;
                modalidadeSelect.value = newModValue;
                changeModalidade(newModValue);
            }, 100);
        };

        labelsContainer.appendChild(btnPrev);
    }

    // Botão Época Seguinte (só se houver época seguinte)
    if (currentIndex > 0) {
        const nextEpoch = availableEpocas[currentIndex - 1];
        const btnNext = document.createElement('button');
        btnNext.className = 'season-nav-btn next-season-btn';
        btnNext.textContent = 'Época Seguinte →';
        btnNext.title = `Ver época 20${nextEpoch.replace('_', '/')}`;
        btnNext.setAttribute('aria-label', `Navegar para época seguinte 20${nextEpoch.replace('_', '/')}`);

        // Posicionar à direita do gráfico
        btnNext.style.right = '20px'; // 20px da borda direita do container
        btnNext.style.top = yPosition + 'px';

        btnNext.onclick = () => {
            // Obter modalidade atual (sem a época)
            const modalidadeSelect = document.getElementById('modalidade');
            const currentMod = modalidadeSelect.value.replace(`_${currentEpoch}`, '');

            // Mudar época
            currentEpochElement.value = nextEpoch;
            changeEpoca(nextEpoch);

            // Selecionar a mesma modalidade na nova época
            setTimeout(() => {
                const newModValue = `${currentMod}_${nextEpoch}`;
                modalidadeSelect.value = newModValue;
                changeModalidade(newModValue);
            }, 100);
        };

        labelsContainer.appendChild(btnNext);
    }
}

// Funções de controle de zoom
function zoomChart(factor) {
    if (!eloChart) return;

    const chart = eloChart;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;

    // Calcular novos limites do zoom
    const xRange = xScale.max - xScale.min;
    const yRange = yScale.max - yScale.min;

    const newXRange = xRange / factor;
    const newYRange = yRange / factor;

    const xCenter = (xScale.max + xScale.min) / 2;
    const yCenter = (yScale.max + yScale.min) / 2;

    // Aplicar zoom
    chart.options.scales.x.min = xCenter - newXRange / 2;
    chart.options.scales.x.max = xCenter + newXRange / 2;
    chart.options.scales.y.min = yCenter - newYRange / 2;
    chart.options.scales.y.max = yCenter + newYRange / 2;

    chart.update('none');

    // Atualizar labels após zoom
    setTimeout(() => {
        updateDynamicTeamLabels();
    }, 50);
}

function resetZoom() {
    if (!eloChart) return;

    // Remover limites personalizados
    delete eloChart.options.scales.x.min;
    delete eloChart.options.scales.x.max;
    delete eloChart.options.scales.y.min;
    delete eloChart.options.scales.y.max;

    eloChart.update('none');

    // Atualizar labels após reset
    setTimeout(() => {
        updateDynamicTeamLabels();
    }, 50);
}

function togglePanMode() {
    if (window.toggleManualPan) {
        window.toggleManualPan();
    }
}

// Função para obter ELO mais recente e posição no ranking geral
function getTeamEloInfo(teamName) {
    const normalizedTeamName = normalizeTeamName(teamName);

    // Obter ELO mais recente
    const teamHistory = sampleData.eloHistory[normalizedTeamName];
    if (!teamHistory || teamHistory.length === 0) {
        return { elo: DEFAULT_ELO, position: null };
    }

    const latestElo = Math.round(teamHistory[teamHistory.length - 1]);

    // Calcular ranking geral de ELO
    const allTeamsElo = [];
    Object.keys(sampleData.eloHistory).forEach(team => {
        const history = sampleData.eloHistory[team];
        if (history && history.length > 0) {
            const currentElo = history[history.length - 1];
            allTeamsElo.push({ team, elo: currentElo });
        }
    });

    // Ordenar por ELO (maior para menor)
    allTeamsElo.sort((a, b) => b.elo - a.elo);

    // Encontrar posição da equipa
    const position = allTeamsElo.findIndex(entry => entry.team === normalizedTeamName) + 1;

    return { elo: latestElo, position: position > 0 ? position : null };
}

// Obter labels dos cabeçalhos baseados na modalidade
function getGoalHeaders() {
    // Extrair o nome da modalidade sem a época
    let modalityName = '';
    if (currentModalidade) {
        modalityName = currentModalidade.replace(/_\d{2}_\d{2}$/, '').toUpperCase();
    }

    // Basquetebol usa "Cestos Feitos" e "Cestos Sofridos"
    if (modalityName.includes('BASQUETEBOL')) {
        return { scored: 'CF', conceded: 'CS' };
    }

    // Voleibol usa "Sets Ganhos" e "Sets Perdidos"
    if (modalityName.includes('VOLEIBOL')) {
        return { scored: 'SG', conceded: 'SP' };
    }

    // Futebol, Futsal e Andebol mantêm "Golos Marcados" e "Golos Sofridos"
    return { scored: 'GM', conceded: 'GS' };
}

// Atualizar cabeçalhos da tabela de classificação
function updateRankingsTableHeaders() {
    const headers = getGoalHeaders();
    const rankingsTable = document.getElementById('rankingsTable');

    if (!rankingsTable) return;

    const thead = rankingsTable.querySelector('thead tr');
    if (!thead) return;

    const thElements = Array.from(thead.querySelectorAll('th'));

    // Normalizar texto de cabeçalho: remover espaços, minúsculas, remover diacríticos
    function normalizeHeaderText(text) {
        return text
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
            .replace(/\s+/g, ''); // Remove espaços
    }

    // Encontrar a coluna de diferença como âncora (várias variações)
    const diffSymbolsList = [
        '±', '+/-', '+-',
        'dif', 'dif.', 'diferenca', 'diferença',
        'dg', 'delta', 'δ', 'Δ',
        'saldo', 'diff',
        'gd', 'goal difference', 'goaldifference',
        'goal diff', 'goaldiff'
    ];

    // Normalizar símbolos e criar Set para O(1) lookups com deduplicação
    const normalizedDiffSymbols = new Set(
        diffSymbolsList.map(s => normalizeHeaderText(s))
    );
    let diffIndex = -1;

    for (let i = 0; i < thElements.length; i++) {
        const normalizedText = normalizeHeaderText(thElements[i].textContent);
        if (normalizedDiffSymbols.has(normalizedText)) {
            diffIndex = i;
            break;
        }
    }

    if (diffIndex === -1) {
        console.warn('Coluna de diferença (±) não encontrada na tabela de classificação');
        return;
    }

    // As colunas de golos/cestos/sets são sempre as duas anteriores ao "±"
    // Layout: ... | Scored | Conceded | ± | ...
    const scoredIndex = diffIndex - 2;
    const concededIndex = diffIndex - 1;

    // Validar bounds: garantir que diffIndex >= 2 e ambos os índices estão no range válido
    if (diffIndex < 2 || scoredIndex >= thElements.length || concededIndex >= thElements.length) {
        console.warn(
            `Índices de cabeçalho inválidos: diffIndex=${diffIndex}, ` +
            `scoredIndex=${scoredIndex}, concededIndex=${concededIndex}, ` +
            `total columns=${thElements.length}`
        );
        return;
    }

    // Atualizar os cabeçalhos
    thElements[scoredIndex].textContent = headers.scored;
    thElements[concededIndex].textContent = headers.conceded;
}

// Verificar se a modalidade é voleibol
function isVolleyballModality() {
    if (!currentModalidade) return false;
    const modalityName = currentModalidade.replace(/_\d{2}_\d{2}$/, '').toUpperCase();
    return modalityName.includes('VOLEIBOL');
}

// Atualizar visibilidade da coluna de empates
function updateDrawsColumnVisibility() {
    const isVolleyball = isVolleyballModality();
    const rankingsTable = document.getElementById('rankingsTable');

    if (!rankingsTable) return;

    // Selecionar coluna de empates no cabeçalho
    const drawsHeader = rankingsTable.querySelector('thead th.draws-column');

    if (drawsHeader) {
        drawsHeader.style.display = isVolleyball ? 'none' : '';
    }

    // Selecionar todas as células de empates no corpo da tabela
    const drawsCells = rankingsTable.querySelectorAll('tbody td.draws-column');
    drawsCells.forEach(cell => {
        cell.style.display = isVolleyball ? 'none' : '';
    });
}

// Atualizar tabela de classificações
function updateRankingsTable() {
    const tbody = document.getElementById('rankingsBody');
    const progressionLegend = document.getElementById('progressionLegend');

    // Atualizar cabeçalhos conforme a modalidade
    updateRankingsTableHeaders();

    if (!sampleData.rankings || Object.keys(sampleData.rankings).length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #666;">Nenhum dado disponível</td></tr>';
        progressionLegend.style.display = 'none';
        return;
    }

    // Usar a primeira divisão disponível se currentDivision não existir
    if (!sampleData.rankings[currentDivision]) {
        currentDivision = Object.keys(sampleData.rankings)[0];
    }

    let teams = sampleData.rankings[currentDivision] || [];

    // Filtrar por grupo se houver seleção de grupo
    if (currentGroup !== null) {
        teams = teams.filter(team => team.group === currentGroup);
    }

    // Analisar estrutura da modalidade para determinar progressões
    const structure = analyzeModalityStructure();
    const totalTeams = teams.length;

    // Mostrar legenda se houver equipes suficientes para progressões
    const showProgressionIndicators = totalTeams >= 4;

    // Atualizar legenda dinâmica
    updateProgressionLegend(showProgressionIndicators, structure);

    tbody.innerHTML = '';

    teams.forEach((team, index) => {
        const position = index + 1;
        const row = document.createElement('tr');
        const goalDiff = (team.goals || 0) - (team.conceded || 0);
        const goalDiffText = goalDiff > 0 ? `+${goalDiff}` : goalDiff.toString();
        const totalGames = (team.wins || 0) + (team.draws || 0) + (team.losses || 0);

        // Determinar progressão no torneio - AGORA passa o nome da equipa para verificar se é B
        const progression = showProgressionIndicators ?
            getTeamProgression(position, totalTeams, structure, team.team, currentGroup) :
            { type: 'safe', description: 'Zona segura' };

        // Obter informações do curso para emblema - aplicar normalização
        const normalizedTeamName = normalizeTeamName(team.team);
        const courseInfo = getCourseInfo(normalizedTeamName);
        const emblemHtml = courseInfo.emblemPath ?
            `<img src="${courseInfo.emblemPath}" alt="${normalizedTeamName}" class="team-emblem-table" onerror="this.style.display='none'">` :
            '';

        // Criar indicador de progressão
        const progressionClass = showProgressionIndicators ? `progression-${progression.type}` : 'progression-safe';
        const badgeTitle = showProgressionIndicators ? progression.description : `${position}º lugar`;

        // Obter informação do ELO - aplicar normalização
        const eloInfo = getTeamEloInfo(normalizedTeamName);
        const eloDisplay = eloInfo.position ? `${eloInfo.elo} (#${eloInfo.position})` : `${eloInfo.elo}`;

        row.innerHTML = `
                    <td>
                        <span class="rank-badge ${progressionClass}" title="${badgeTitle}">${position}</span>
                    </td>
                    <td class="team-cell">
                        ${emblemHtml}
                        <div class="team-color-indicator" style="background-color: ${courseInfo.primaryColor}"></div>
                        <div class="team-info-container">
                            <span class="team-name-table" title="${courseInfo.fullName}">${normalizedTeamName}</span>
                            <span class="team-elo-info" title="ELO atual e posição no ranking geral">${eloDisplay}</span>
                        </div>
                    </td>
                    <td><strong>${team.points}</strong></td>
                    <td>${totalGames}</td>
                    <td>${team.wins || 0}</td>
                    <td class="draws-column">${team.draws || 0}</td>
                    <td>${team.losses || 0}</td>
                    <td style="color: red;">${team.noShows || 0}</td>
                    <td>${team.goals || 0}</td>
                    <td>${team.conceded || 0}</td>
                    <td style="color: ${goalDiff > 0 ? '#28a745' : goalDiff < 0 ? '#dc3545' : '#666'}">${goalDiffText}</td>
                `;
        tbody.appendChild(row);
    });

    // Atualizar visibilidade da coluna de empates após renderizar todas as linhas
    updateDrawsColumnVisibility();
}

/**
 * Atualiza a legenda de progressão dinamicamente baseada no contexto
 */
function updateProgressionLegend(show, structure) {
    const progressionLegend = document.getElementById('progressionLegend');

    if (!show) {
        progressionLegend.style.display = 'none';
        return;
    }

    progressionLegend.style.display = 'flex';

    // Determinar quais legendas mostrar baseado no contexto
    const legendItems = [];
    const divisionNum = parseInt(currentDivision) || 1;
    const isSecondDivision = divisionNum === 2;

    // Detectar se há sistema de playoff/liguilha
    const hasWinnerPlayoffs = playoffSystemInfo.hasWinnerPlayoffs || false;
    const hasMaintenancePlayoffs = playoffSystemInfo.hasMaintenancePlayoffs || false;
    const hasMaintenanceLeague = playoffSystemInfo.hasMaintenanceLeague || false;

    // Época atual para determinar compatibilidade
    const is25_26 = currentEpoca === '25_26';

    // Legendas para 1ª divisão
    if (divisionNum === 1) {
        // Play-offs para o vencedor (sempre 8 equipas)
        legendItems.push({
            badge: 'P',
            cssClass: 'legend-playoffs',
            text: 'Play-offs'
        });

        // Playoff/Liguilha de manutenção - SÓ mostrar se realmente existir
        if (hasMaintenancePlayoffs) {
            legendItems.push({
                badge: 'PM',
                cssClass: 'legend-maintenance-playoffs',
                text: 'Play-off de Manutenção'
            });
        } else if (hasMaintenanceLeague) {
            legendItems.push({
                badge: 'LM',
                cssClass: 'legend-maintenance-league',
                text: 'Liguilha de Manutenção'
            });
        }

        // Sempre mostrar descida direta (últimos 2 ou 3 dependendo de haver PM/LM)
        legendItems.push({
            badge: '↓',
            cssClass: 'legend-relegation',
            text: 'Descida de divisão'
        });
    }
    // Legendas para 2ª divisão
    else if (isSecondDivision) {
        // 1º de cada grupo vai aos playoffs + promoção
        legendItems.push({
            badge: 'P',
            cssClass: 'legend-playoffs',
            text: 'Play-offs + Promoção'
        });

        // 2º lugar: depende se há PM/LM ou não
        if (hasMaintenancePlayoffs) {
            legendItems.push({
                badge: 'PP',
                cssClass: 'legend-promotion-playoffs',
                text: 'Play-off de Promoção'
            });
        } else if (hasMaintenanceLeague) {
            legendItems.push({
                badge: 'LP',
                cssClass: 'legend-promotion-league',
                text: 'Liguilha de Promoção'
            });
        } else {
            // Sem PM/LM: 2º sobe direto
            legendItems.push({
                badge: '↑',
                cssClass: 'legend-promotion',
                text: 'Subida de divisão'
            });
        }
    }
    // Legendas para 3ª+ divisão
    else {
        legendItems.push({
            badge: '↑',
            cssClass: 'legend-promotion',
            text: 'Subida de divisão'
        });
    }

    // Sempre adicionar zona segura
    legendItems.push({
        badge: 'S',
        cssClass: 'legend-safe',
        text: 'Zona segura'
    });

    // Gerar HTML da legenda
    progressionLegend.innerHTML = legendItems.map(item => `
                <div class="legend-item">
                    <div class="legend-badge ${item.cssClass}">${item.badge}</div>
                    <span>${item.text}</span>
                </div>
            `).join('');
}

// Cache para equipas qualificadas
let qualifiedTeamsCache = null;

// Obter equipas qualificadas baseado na classificação
function getQualifiedTeams(forceRefresh = false) {
    // Usar cache se disponível e não for forçado refresh
    if (qualifiedTeamsCache && !forceRefresh) {
        return qualifiedTeamsCache;
    }
    const structure = analyzeModalityStructure();
    const qualified = {
        playoffs: [],           // Top 8 para playoffs principais
        maintenancePlayoff: [], // Equipas para PM
        promotionPlayoff: [],   // Equipas para PP (2ª divisão)
        legend: []              // Legenda dos lugares
    };

    DebugUtils.debugBracket('qualified_teams', {
        rankingsAvailable: sampleData.rankings ? Object.keys(sampleData.rankings) : [],
        structure: structure
    });

    DebugUtils.debugQualification('structure_detected', structure);
    DebugUtils.debugQualification('rankings_keys', Object.keys(sampleData.rankings));

    if (!sampleData.rankings || Object.keys(sampleData.rankings).length === 0) {
        console.warn('⚠️ getQualifiedTeams: rankings não disponíveis ainda');
        return qualified;
    }

    // Liga única - top 8 vão para playoffs
    if (structure.type === 'single-league') {
        const ranking = sampleData.rankings['geral'] || [];

        // Os rankings já vêm ordenados do CSV, mas garantir ordenação por pontos
        ranking.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const diffA = (a.goals || 0) - (a.conceded || 0);
            const diffB = (b.goals || 0) - (b.conceded || 0);
            return diffB - diffA;
        });

        qualified.playoffs = ranking.slice(0, 8).map(team => team.team);

        DebugUtils.debugQualification('single_league_playoffs', qualified.playoffs);

        // Criar legenda
        for (let i = 0; i < Math.min(8, ranking.length); i++) {
            qualified.legend.push({
                position: i + 1,
                team: ranking[i].team,
                type: 'playoff'
            });
        }
        return qualified;
    }

    // Sistema com divisões
    if (structure.hasDivisions) {
        DebugUtils.debugQualification('has_divisions');
        const div1Teams = [];
        const div2Teams = [];

        DebugUtils.debugQualification('available_keys', Object.keys(sampleData.rankings));

        // Processar cada divisão - busca flexível por padrões
        Object.entries(sampleData.rankings).forEach(([key, ranking]) => {
            DebugUtils.debugQualification('processing_key', { key, count: ranking.length });

            // Buscar 1ª divisão
            const is1stDiv = key.includes('1ª Divisão') ||
                key === '1' ||
                key.match(/1[ªa]\s*div/i);

            if (is1stDiv) {
                DebugUtils.debugQualification('match_1st_division', ranking.length);
                div1Teams.push(...ranking);
            }
            // Buscar 2ª divisão - QUALQUER grupo
            else {
                const is2ndDiv = key.includes('2ª Divisão') ||
                    key === '2' ||
                    key.match(/2[ªa]\s*div/i);

                if (is2ndDiv) {
                    DebugUtils.debugQualification('match_2nd_division', ranking.length);
                    div2Teams.push(...ranking);
                } else {
                    DebugUtils.debugQualification('no_match', key);
                }
            }
        });

        // Ordenar por pontos (não por ELO que pode não existir ainda)
        div1Teams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            // Desempate por diferença de golos
            const diffA = (a.goals || 0) - (a.conceded || 0);
            const diffB = (b.goals || 0) - (b.conceded || 0);
            return diffB - diffA;
        });

        div2Teams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const diffA = (a.goals || 0) - (a.conceded || 0);
            const diffB = (b.goals || 0) - (b.conceded || 0);
            return diffB - diffA;
        });

        DebugUtils.debugQualification('teams_sorted', { div1: div1Teams.map(t => `${t.team} (${t.points}pts)`), div2: div2Teams.map(t => `${t.team} (${t.points}pts)`) });

        // Determinar número de equipas para playoffs baseado na estrutura
        // Contar APENAS grupos da 2ª divisão
        const numGroups2ndDiv = Object.keys(sampleData.rankings).filter(key =>
            key.match(/^2[ªa]?\s*(div|divisão|divisao)?\s*-?\s*grupo/i)
        ).length;

        // Se há 2ª divisão mas sem grupos, assume 1 equipa da 2ª divisão (7 da 1ª + 1 da 2ª = 8)
        // Se há grupos, cada grupo manda 1 equipa (ex: 2 grupos = 6 da 1ª + 2 da 2ª = 8)
        // Se não há 2ª divisão, todas as 8 vagas são da 1ª
        const playoffSlots1stDiv = div2Teams.length > 0
            ? (numGroups2ndDiv > 0 ? Math.max(0, 8 - numGroups2ndDiv) : 7)
            : 8;

        DebugUtils.debugQualification('playoff_slots', {
            first: playoffSlots1stDiv,
            second: div2Teams.length > 0 ? (numGroups2ndDiv || 1) : 0,
            total: 8,
            hasGroups: numGroups2ndDiv > 0
        });

        // Top da 1ª divisão vão para playoffs (excluindo equipas B)
        if (playoffSlots1stDiv > 0 && div1Teams.length > 0) {
            let qualifiedCount = 0;
            let currentPos = 0;
            let skippedBTeams = 0;

            DebugUtils.debugQualification('selecting_1st_division');

            while (qualifiedCount < playoffSlots1stDiv && currentPos < div1Teams.length) {
                const team = div1Teams[currentPos];

                if (TeamUtils.isTeamB(team.team)) {
                    DebugUtils.debugQualification('team_b_skip', { position: currentPos + 1, team: team.team });
                    skippedBTeams++;
                    currentPos++;
                    continue;
                }

                DebugUtils.debugQualification('team_qualified', { position: currentPos + 1, team: team.team });
                qualified.playoffs.push(team.team);
                qualified.legend.push({
                    position: currentPos + 1,
                    team: team.team,
                    type: 'playoff',
                    division: '1ª',
                    isSubstitute: skippedBTeams > 0 && qualifiedCount >= (currentPos + 1 - skippedBTeams)
                });

                qualifiedCount++;
                currentPos++;
            }

            if (qualifiedCount < playoffSlots1stDiv) {
                console.warn(`⚠️ Apenas ${qualifiedCount} de ${playoffSlots1stDiv} equipas qualificadas da 1ª divisão`);
            }
        }

        // 1º da 2ª divisão vai para playoffs
        // Caso 1: Se há grupos na 2ª divisão, pegar 1º de cada grupo
        // Caso 2: Se não há grupos mas há 2ª divisão, pegar 1º da 2ª divisão

        if (numGroups2ndDiv > 0) {
            // CASO 1: 2ª divisão com grupos - 1º de cada grupo
            const groups2ndDiv = {};
            Object.entries(sampleData.rankings).forEach(([key, ranking]) => {
                // Busca flexível por 2ª divisão COM GRUPO
                if (key.match(/^2[ªa]?\s*(div|divisão|divisao)?\s*-?\s*grupo\s+([A-Z])/i)) {
                    const groupMatch = key.match(/grupo\s+([A-Z])/i);
                    if (groupMatch && ranking.length > 0) {
                        const group = groupMatch[1].toUpperCase();

                        // Encontrar primeiro não-B
                        let teamIndex = 0;
                        while (teamIndex < ranking.length && TeamUtils.isTeamB(ranking[teamIndex].team)) {
                            DebugUtils.debugQualification('group_team_b_skip', { group, position: teamIndex + 1, team: ranking[teamIndex].team });
                            teamIndex++;
                        }

                        if (teamIndex < ranking.length) {
                            groups2ndDiv[group] = {
                                team: ranking[teamIndex],
                                actualPosition: teamIndex + 1,  // Posição real da equipa substituta
                                placeholderPosition: 1          // SEMPRE usa 1º para o placeholder!
                            };
                            DebugUtils.debugQualification('group_winner', { group, team: ranking[teamIndex].team, position: teamIndex + 1 });
                            if (teamIndex > 0) {
                                DebugUtils.debugQualification('group_winner', { group, team: ranking[teamIndex].team, position: teamIndex + 1, replaces: ranking[0].team });
                            }
                        } else {
                            console.warn(`  ⚠️ Grupo ${group}: Todas as equipas são B!`);
                        }
                    }
                }
            });

            Object.entries(groups2ndDiv).forEach(([group, data]) => {
                qualified.playoffs.push(data.team.team);
                qualified.legend.push({
                    position: data.placeholderPosition,  // USA 1 para o placeholder
                    actualPosition: data.actualPosition,  // Guarda posição real para exibição
                    team: data.team.team,
                    type: 'playoff',
                    division: '2ª',
                    group: isNaN(group) ? group : undefined,
                    isSubstitute: data.actualPosition > 1  // Flag indicando que é substituto
                });
            });
        } else if (div2Teams.length > 0) {
            // CASO 2: 2ª divisão SEM grupos - pegar 1º classificado geral (excluindo equipa B)
            DebugUtils.debugQualification('selecting_2nd_division_no_groups');

            let teamIndex = 0;
            while (teamIndex < div2Teams.length && TeamUtils.isTeamB(div2Teams[teamIndex].team)) {
                DebugUtils.debugQualification('team_b_skip_2nd_div', { position: teamIndex + 1, team: div2Teams[teamIndex].team });
                teamIndex++;
            }

            if (teamIndex < div2Teams.length) {
                const selectedTeam = div2Teams[teamIndex];
                qualified.playoffs.push(selectedTeam.team);
                qualified.legend.push({
                    position: teamIndex + 1,
                    actualPosition: teamIndex + 1,
                    team: selectedTeam.team,
                    type: 'playoff',
                    division: '2ª',
                    isSubstitute: teamIndex > 0  // Flag se não é o 1º real
                });
                DebugUtils.debugQualification('2nd_div_winner', { team: selectedTeam.team, position: teamIndex + 1 });
            } else {
                console.warn(`  ⚠️ 2ª Divisão: Todas as equipas são B!`);
            }
        }

        // Equipas para playoff/liguilha de manutenção ou promoção
        if (playoffSystemInfo.hasMaintenancePlayoffs || playoffSystemInfo.hasMaintenanceLeague) {
            // 5º pior da 1ª divisão (penúltimo = 9º lugar em 12 equipas) para playoff de manutenção
            const worstPos = div1Teams.length - 4; // 5º pior (índice 8 = 9º lugar)
            if (worstPos >= 0 && worstPos < div1Teams.length) {
                qualified.maintenancePlayoff.push(div1Teams[worstPos].team);
                qualified.legend.push({
                    position: worstPos + 1,
                    team: div1Teams[worstPos].team,
                    type: playoffSystemInfo.hasMaintenancePlayoffs ? 'maintenance-playoff' : 'maintenance-league',
                    division: '1ª'
                });
            }

            // 2º de cada grupo da 2ª divisão vão para PP/LP (excluindo equipas B, a menos que equipa A esteja em descida)
            DebugUtils.debugQualification('selecting_2nd_places');
            Object.entries(sampleData.rankings).forEach(([key, ranking]) => {
                // Busca flexível por 2ª divisão COM GRUPO
                if (key.match(/^2[ªa]?\s*(div|divisão|divisao)?\s*-?\s*grupo\s+([A-Z])/i) && ranking.length > 1) {
                    const groupMatch = key.match(/grupo\s+([A-Z])/i);
                    if (groupMatch) {
                        const group = groupMatch[1].toUpperCase();

                        // Encontrar equipa elegível (não-B, não já qualificada para playoffs, ou B com A em descida)
                        let teamIndex = 1; // Começar do 2º lugar
                        let selectedTeam = null;
                        let selectedPosition = null;

                        while (teamIndex < ranking.length && !selectedTeam) {
                            const team = ranking[teamIndex];

                            // ⚠️ VERIFICAR SE JÁ FOI PARA PLAYOFFS DE VENCEDORES
                            if (qualified.playoffs.includes(team.team)) {
                                DebugUtils.debugQualification('already_in_playoffs', { group, position: teamIndex + 1, team: team.team });
                                teamIndex++;
                                continue;
                            }

                            if (TeamUtils.isTeamB(team.team)) {
                                // Verificar se equipa A está em descida
                                if (TeamUtils.isTeamAInRelegation(team.team, div1Teams)) {
                                    DebugUtils.debugQualification('team_b_with_relegation', { group, position: teamIndex + 1, team: team.team });
                                    selectedTeam = team;
                                    selectedPosition = teamIndex + 1;
                                } else {
                                    DebugUtils.debugQualification('team_b_no_relegation', { group, position: teamIndex + 1, team: team.team });
                                    teamIndex++;
                                }
                            } else {
                                DebugUtils.debugQualification('team_qualified', { position: teamIndex + 1, team: team.team });
                                selectedTeam = team;
                                selectedPosition = teamIndex + 1;
                            }
                        }

                        if (selectedTeam) {
                            qualified.promotionPlayoff.push(selectedTeam.team);
                            qualified.legend.push({
                                position: 2,  // SEMPRE usa 2º para o placeholder
                                actualPosition: selectedPosition,  // Posição real
                                team: selectedTeam.team,
                                type: playoffSystemInfo.hasMaintenancePlayoffs ? 'promotion-playoff' : 'promotion-league',
                                division: '2ª',
                                group: group,
                                isSubstitute: selectedPosition > 2  // Flag se não é o 2º real
                            });
                        } else {
                            console.warn(`  ⚠️ Grupo ${group}: Nenhuma equipa elegível encontrada!`);
                        }
                    }
                }
            });
        }
    }

    DebugUtils.debugBracket('qualified_teams_result', {
        playoffs: qualified.playoffs,
        maintenancePlayoff: qualified.maintenancePlayoff,
        promotionPlayoff: qualified.promotionPlayoff,
        legendCount: qualified.legend.length
    });

    DebugUtils.debugQualification('qualified_complete', qualified.legend);

    // Cachear resultado
    qualifiedTeamsCache = qualified;

    return qualified;
}

// Função global para resolver nomes de equipas (substituir placeholders)
function resolveTeamName(teamName) {
    // Obter mapa de substituições atual
    const qualified = getQualifiedTeams();
    const qualifiedMap = {};

    DebugUtils.debugTeamResolution('resolving_team', teamName);
    DebugUtils.debugTeamResolution('qualified_legend', qualified.legend);

    // Criar mapa de placeholders para equipas reais
    qualified.legend.forEach(item => {
        let placeholder = '';
        DebugUtils.debugTeamResolution('legend_item', item);
        // Se não tem divisão (single-league), criar mapeamento dos placeholders hardcoded no CSV
        if (!item.division) {
            placeholder = `${item.position}º Class. 1ª Div.`;
        } else if (item.division === '1ª') {
            placeholder = `${item.position}º Class. 1ª Div.`;
        } else if (item.division === '2ª') {
            if (item.group) {
                // ✅ CORRIGIDO: Criar placeholders para AMBOS os formatos (com e sem "Gr.")
                // Formato 1: "2º Class. 2ª Div. Gr. A" (usado em PM 25_26)
                const placeholderWithGr = `${item.position}º Class. 2ª Div. Gr. ${item.group}`;
                qualifiedMap[placeholderWithGr] = item.team;

                // Formato 2: "2º Class. 2ª Div. A" (usado em LM 24_25)
                const placeholderNoGr = `${item.position}º Class. 2ª Div. ${item.group}`;
                qualifiedMap[placeholderNoGr] = item.team;

                DebugUtils.debugTeamResolution('creating_placeholders_with_group', { withGr: placeholderWithGr, noGr: placeholderNoGr, team: item.team });
                placeholder = null; // Não criar novamente abaixo
            } else {
                placeholder = `${item.position}º Class. 2ª Div.`;
            }
        }
        // Só criar placeholder se não foi criado acima
        if (placeholder) {
            DebugUtils.debugTeamResolution('creating_placeholder', { placeholder, team: item.team });
            qualifiedMap[placeholder] = item.team;
        }
    });

    DebugUtils.debugTeamResolution('complete_map', qualifiedMap);

    // Se for placeholder, substituir
    if (qualifiedMap[teamName]) {
        DebugUtils.debugTeamResolution('resolved', { from: teamName, to: qualifiedMap[teamName] });
        return qualifiedMap[teamName];
    }
    DebugUtils.debugTeamResolution('not_found', teamName);
    return teamName;
}

// Criar bracket de dados reais dos CSVs
function createRealBracket() {
    // Carregar dados originais do CSV diretamente para detectar "?"
    const modalidade = document.getElementById('modalidade').value;
    if (!modalidade) {
        sampleData.bracket = {};
        createBracket();
        return;
    }

    const jogosPath = `csv_modalidades/${modalidade}.csv`;

    Papa.parse(jogosPath, {
        download: true,
        header: true,
        complete: results => {
            // Salvar dados do calendário para verificação de resultados desconhecidos
            sampleData.calendarData = results.data;

            // Marcar resultados desconhecidos (caso o detalhe já tenha sido carregado)
            markUnknownResultsFromCalendar();

            // Calcular número máximo de jornadas do calendário (antes dos jogos acontecerem)
            const regularRounds = results.data
                .filter(match => match.Jornada && !isNaN(parseInt(match.Jornada)))
                .map(match => parseInt(match.Jornada));

            sampleData.totalRegularSeasonGames = regularRounds.length > 0 ? Math.max(...regularRounds) : 0;                    // Filtrar jogos de eliminação dos dados originais (E*)
            const eliminationMatches = results.data.filter(match =>
                match.Jornada && (
                    match.Jornada.startsWith('E1') ||  // Quartos
                    match.Jornada.startsWith('E2') ||  // Meias
                    match.Jornada.startsWith('E3')    // Final/3º lugar
                )
            );

            // Filtrar jogos secundários (PM* ou LM*)
            const secondaryMatches = results.data.filter(match =>
                match.Jornada && (
                    match.Jornada.startsWith('PM') ||  // Playoff Manutenção/Promoção
                    match.Jornada.startsWith('LM')     // Liguilha Manutenção/Promoção
                )
            );

            if (eliminationMatches.length === 0) {
                DebugUtils.debugBracket('no_elimination_games');
                sampleData.bracket = {};
                createBracket();
            } else {
                DebugUtils.debugBracket('elimination_games_found', eliminationMatches);
                processEliminationMatches(eliminationMatches);
            }

            // Processar bracket secundário se houver
            if (secondaryMatches.length > 0) {
                DebugUtils.debugBracket('secondary_games_found', secondaryMatches);
                processSecondaryMatches(secondaryMatches);
            } else {
                sampleData.secondaryBracket = {};
                createSecondaryBracket();
            }
        },
        error: error => {
            console.error('Erro ao carregar CSV para bracket:', error);
            // Fallback para dados processados se houver erro
            fallbackToProcessedData();
        }
    });
}

function fallbackToProcessedData() {
    if (!sampleData.rawEloData || sampleData.rawEloData.length === 0) {
        DebugUtils.debugBracket('no_elo_data');
        sampleData.bracket = {};
        createBracket();
        return;
    }

    const eliminationMatches = sampleData.rawEloData.filter(match =>
        match.Jornada && (
            match.Jornada.startsWith('E1') ||
            match.Jornada.startsWith('E2') ||
            match.Jornada.startsWith('E3')
        )
    );

    processEliminationMatches(eliminationMatches, true);
}

function processEliminationMatches(eliminationMatches, isProcessedData = false) {
    DebugUtils.debugEliminationGames('processing_start', eliminationMatches.length);
    if (eliminationMatches.length > 0) {
        DebugUtils.debugEliminationGames('first_game', { game: eliminationMatches[0], team1: eliminationMatches[0]['Equipa 1'], team2: eliminationMatches[0]['Equipa 2'] });
    }

    if (eliminationMatches.length === 0) {
        DebugUtils.debugBracket('no_elimination_games');

        // Preencher bracket automaticamente com equipas qualificadas
        const qualified = getQualifiedTeams();

        // Criar bracket se houver equipas qualificadas suficientes (mesmo sem pontos)
        const canCreateBracket = qualified.playoffs.length >= 8 && sampleData.rankings;

        if (canCreateBracket) {
            // Criar placeholders a partir do legend (em vez de usar nomes reais)
            const playoffPlaceholders = qualified.legend
                .filter(item => item.type === 'playoff')
                .sort((a, b) => {
                    // Ordenar: 1ª divisão primeiro, depois 2ª divisão
                    if (a.division !== b.division) return a.division === '1ª' ? -1 : 1;
                    // Dentro da divisão, ordenar por posição
                    if (a.position !== b.position) return a.position - b.position;
                    // Se mesmo grupo, ordenar alfabeticamente
                    if (a.group && b.group) return a.group.localeCompare(b.group);
                    return 0;
                })
                .map(item => {
                    // Se não tem divisão definida (single-league), usar nome direto
                    if (!item.division || item.division === 'geral') {
                        return item.team;
                    }
                    // Se tem divisão, criar placeholder
                    if (item.division === '1ª') {
                        return `${item.position}º Class. 1ª Div.`;
                    } else if (item.group) {
                        return `${item.position}º Class. 2ª Div. Gr. ${item.group}`;
                    } else {
                        return `${item.position}º Class. 2ª Div.`;
                    }
                });

            DebugUtils.debugEliminationGames('placeholders_created', playoffPlaceholders);
            DebugUtils.debugBracket('auto_filling_bracket', playoffPlaceholders);
            sampleData.bracket = createPredictedBracket(playoffPlaceholders);
        } else {
            DebugUtils.debugEliminationGames('insufficient_teams');
            sampleData.bracket = {};
        }

        createBracket();
        return;
    }

    DebugUtils.debugBracket('elimination_games_found', eliminationMatches);

    // Organizar jogos por fase na ordem de exibição correta
    const bracketData = {};

    // Obter equipas qualificadas para substituir placeholders
    const qualified = getQualifiedTeams();
    const qualifiedMap = {};

    // Criar mapa de placeholders para equipas reais
    qualified.legend.forEach(item => {
        let placeholder = '';
        // Se não tem divisão (single-league), criar mapeamento dos placeholders hardcoded no CSV
        if (!item.division) {
            placeholder = `${item.position}º Class. 1ª Div.`;
        } else if (item.division === '1ª') {
            placeholder = `${item.position}º Class. 1ª Div.`;
        } else if (item.division === '2ª') {
            if (item.group) {
                placeholder = `${item.position}º Class. 2ª Div. Gr. ${item.group}`;
            } else {
                placeholder = `${item.position}º Class. 2ª Div.`;
            }
        }
        if (placeholder) {
            qualifiedMap[placeholder] = item.team;
        }
    });

    DebugUtils.debugEliminationGames('substitution_map', qualifiedMap);

    // Função para substituir placeholder por equipa real
    function resolveTeamName(teamName) {
        // Se for placeholder, substituir
        if (qualifiedMap[teamName]) {
            DebugUtils.debugEliminationGames('substituting', { from: teamName, to: qualifiedMap[teamName] });
            return qualifiedMap[teamName];
        }
        return teamName;
    }

    // Função auxiliar para detectar "?" nos dados originais ou processados
    function detectUnknownResult(match) {
        const allKeys = Object.keys(match);

        // Verificar todas as chaves possíveis para encontrar "?"
        for (let key of allKeys) {
            const value = match[key];
            if (value && value.toString().trim() === '?') {
                return true;
            }
        }
        return false;
    }

    // Quartos de Final (E1)
    const quartos = eliminationMatches.filter(m =>
        (m.Jornada || m.round) &&
        (m.Jornada?.startsWith('E1') || m.round?.startsWith('E1')) &&
        !(m.Jornada?.includes('L') || m.round?.includes('L'))
    );
    if (quartos.length > 0) {
        DebugUtils.debugEliminationGames('quarters_info', { count: quartos.length, first: quartos[0] });
        bracketData["Quartos de Final"] = quartos.map(match => {
            const isUnknownResult = detectUnknownResult(match);
            DebugUtils.debugEliminationGames('before_resolve', { team1: match['Equipa 1'], team2: match['Equipa 2'] });
            const team1 = resolveTeamName(match['Equipa 1']);
            const team2 = resolveTeamName(match['Equipa 2']);
            DebugUtils.debugEliminationGames('after_resolve', { team1, team2 });
            // ⚠️ IMPORTANTE: Se score estiver vazio no CSV, usar null (não 0)
            const score1Val = match['Golos 1'] ? parseFloat(match['Golos 1']) : null;
            const score2Val = match['Golos 2'] ? parseFloat(match['Golos 2']) : null;

            // Procurar dados de ELO no rawEloData (mesmo padrão do calendário)
            const eloMatch = sampleData.rawEloData ? sampleData.rawEloData.find(m =>
                m.Jornada === match.Jornada &&
                normalizeTeamName(m['Equipa 1']) === normalizeTeamName(team1) &&
                normalizeTeamName(m['Equipa 2']) === normalizeTeamName(team2)
            ) : null;

            const elo1Delta = eloMatch && eloMatch['Elo Delta 1'] ? parseInt(eloMatch['Elo Delta 1']) : 0;
            const elo2Delta = eloMatch && eloMatch['Elo Delta 2'] ? parseInt(eloMatch['Elo Delta 2']) : 0;

            return {
                team1: team1,
                team2: team2,
                score1: score1Val,
                score2: score2Val,
                winner: (score1Val !== null && score2Val !== null) ? (score1Val > score2Val ? team1 : team2) : null,
                unknownResult: isUnknownResult,
                eloDelta1: elo1Delta,
                eloDelta2: elo2Delta
            };
        });
    }

    // Meias-Finais (E2)
    const meias = eliminationMatches.filter(m =>
        (m.Jornada || m.round) &&
        (m.Jornada?.startsWith('E2') || m.round?.startsWith('E2')) &&
        !(m.Jornada?.includes('L') || m.round?.includes('L'))
    );
    if (meias.length > 0) {
        bracketData["Meias-Finais"] = meias.map(match => {
            const isUnknownResult = detectUnknownResult(match);
            const team1 = resolveTeamName(match['Equipa 1']);
            const team2 = resolveTeamName(match['Equipa 2']);
            // ⚠️ IMPORTANTE: Se score estiver vazio no CSV, usar null (não 0)
            const score1Val = match['Golos 1'] ? parseFloat(match['Golos 1']) : null;
            const score2Val = match['Golos 2'] ? parseFloat(match['Golos 2']) : null;

            // Procurar dados de ELO no rawEloData (mesmo padrão do calendário)
            const eloMatch = sampleData.rawEloData ? sampleData.rawEloData.find(m =>
                m.Jornada === match.Jornada &&
                normalizeTeamName(m['Equipa 1']) === normalizeTeamName(team1) &&
                normalizeTeamName(m['Equipa 2']) === normalizeTeamName(team2)
            ) : null;

            const elo1Delta = eloMatch && eloMatch['Elo Delta 1'] ? parseInt(eloMatch['Elo Delta 1']) : 0;
            const elo2Delta = eloMatch && eloMatch['Elo Delta 2'] ? parseInt(eloMatch['Elo Delta 2']) : 0;

            return {
                team1: team1,
                team2: team2,
                score1: score1Val,
                score2: score2Val,
                winner: (score1Val !== null && score2Val !== null) ? (score1Val > score2Val ? team1 : team2) : null,
                unknownResult: isUnknownResult,
                eloDelta1: elo1Delta,
                eloDelta2: elo2Delta
            };
        });
    }

    // Final (E3)
    const final = eliminationMatches.filter(m =>
        (m.Jornada || m.round) &&
        (m.Jornada?.startsWith('E3') || m.round?.startsWith('E3')) &&
        !(m.Jornada?.includes('L') || m.round?.includes('L'))
    );

    // Jogo do 3º lugar (E3L) - na mesma ronda que a final
    const terceiroLugar = eliminationMatches.filter(m =>
        (m.Jornada || m.round) &&
        (m.Jornada === 'E3L' || m.round === 'E3L')
    );

    // Criar array da ronda final que inclui ambos os jogos
    const finalMatches = [];

    // Adicionar final primeiro
    if (final.length > 0) {
        finalMatches.push(...final.map(match => {
            const isUnknownResult = detectUnknownResult(match);
            const team1 = resolveTeamName(match['Equipa 1']);
            const team2 = resolveTeamName(match['Equipa 2']);
            // ⚠️ IMPORTANTE: Se score estiver vazio no CSV, usar null (não 0)
            const score1Val = match['Golos 1'] ? parseFloat(match['Golos 1']) : null;
            const score2Val = match['Golos 2'] ? parseFloat(match['Golos 2']) : null;

            // Procurar dados de ELO no rawEloData (mesmo padrão do calendário)
            const eloMatch = sampleData.rawEloData ? sampleData.rawEloData.find(m =>
                m.Jornada === match.Jornada &&
                normalizeTeamName(m['Equipa 1']) === normalizeTeamName(team1) &&
                normalizeTeamName(m['Equipa 2']) === normalizeTeamName(team2)
            ) : null;

            const elo1Delta = eloMatch && eloMatch['Elo Delta 1'] ? parseInt(eloMatch['Elo Delta 1']) : 0;
            const elo2Delta = eloMatch && eloMatch['Elo Delta 2'] ? parseInt(eloMatch['Elo Delta 2']) : 0;

            return {
                team1: team1,
                team2: team2,
                score1: score1Val,
                score2: score2Val,
                winner: (score1Val !== null && score2Val !== null) ? (score1Val > score2Val ? team1 : team2) : null,
                unknownResult: isUnknownResult,
                isThirdPlace: false,
                eloDelta1: elo1Delta,
                eloDelta2: elo2Delta
            };
        }));
    }

    // Adicionar 3º lugar depois
    if (terceiroLugar.length > 0) {
        finalMatches.push(...terceiroLugar.map(match => {
            const isUnknownResult = detectUnknownResult(match);
            const team1 = resolveTeamName(match['Equipa 1']);
            const team2 = resolveTeamName(match['Equipa 2']);
            // ⚠️ IMPORTANTE: Se score estiver vazio no CSV, usar null (não 0)
            const score1Val = match['Golos 1'] ? parseFloat(match['Golos 1']) : null;
            const score2Val = match['Golos 2'] ? parseFloat(match['Golos 2']) : null;

            // Procurar dados de ELO no rawEloData (mesmo padrão do calendário)
            const eloMatch = sampleData.rawEloData ? sampleData.rawEloData.find(m =>
                m.Jornada === match.Jornada &&
                normalizeTeamName(m['Equipa 1']) === normalizeTeamName(team1) &&
                normalizeTeamName(m['Equipa 2']) === normalizeTeamName(team2)
            ) : null;

            const elo1Delta = eloMatch && eloMatch['Elo Delta 1'] ? parseInt(eloMatch['Elo Delta 1']) : 0;
            const elo2Delta = eloMatch && eloMatch['Elo Delta 2'] ? parseInt(eloMatch['Elo Delta 2']) : 0;

            return {
                team1: team1,
                team2: team2,
                score1: score1Val,
                score2: score2Val,
                winner: (score1Val !== null && score2Val !== null) ? (score1Val > score2Val ? team1 : team2) : null,
                unknownResult: isUnknownResult,
                isThirdPlace: true,
                eloDelta1: elo1Delta,
                eloDelta2: elo2Delta
            };
        }));
    }

    if (finalMatches.length > 0) {
        bracketData["Final"] = finalMatches;
    }

    sampleData.bracket = bracketData;
    DebugUtils.debugBracket('bracket_created', bracketData);
    createBracket();
}

// Processar jogos secundários (PM/LM)
function processSecondaryMatches(secondaryMatches) {
    const bracketData = {};

    // Função auxiliar para detectar "?" nos dados
    function detectUnknownResult(match) {
        const allKeys = Object.keys(match);
        for (let key of allKeys) {
            const value = match[key];
            if (value && value.toString().trim() === '?') {
                return true;
            }
        }
        return false;
    }

    // Determinar o tipo de bracket secundário
    const hasPM = secondaryMatches.some(m => m.Jornada && m.Jornada.startsWith('PM'));
    const hasLM = secondaryMatches.some(m => m.Jornada && m.Jornada.startsWith('LM'));

    DebugUtils.debugSecondaryBracket('analyzing_games', {
        totalMatches: secondaryMatches.length,
        hasPM: hasPM,
        hasLM: hasLM,
        pmMatches: secondaryMatches.filter(m => m.Jornada && m.Jornada.startsWith('PM')).map(m => ({
            jornada: m.Jornada,
            equipa1: m['Equipa 1'],
            equipa2: m['Equipa 2'],
            golos1: m['Golos 1'],
            golos2: m['Golos 2']
        }))
    });

    // Verificar se é manutenção ou promoção baseado na estrutura
    const structure = analyzeModalityStructure();
    const isPromotion = structure.hasDivisions && structure.divisions.includes('2ª Divisão');

    if (hasPM) {
        sampleData.secondaryBracketType = isPromotion ? 'promotion-playoff' : 'maintenance-playoff';

        // PM1 (similar a quartos)
        const pm1 = secondaryMatches.filter(m => m.Jornada && m.Jornada.startsWith('PM1'));
        if (pm1.length > 0) {
            bracketData["1ª Fase"] = pm1.map(match => {
                const team1 = match['Equipa 1'];
                const team2 = match['Equipa 2'];
                // ⚠️ IMPORTANTE: Se score estiver vazio no CSV, usar null (não 0)
                const score1Val = match['Golos 1'] ? parseFloat(match['Golos 1']) : null;
                const score2Val = match['Golos 2'] ? parseFloat(match['Golos 2']) : null;

                // Procurar dados de ELO no rawEloData (mesmo padrão do calendário)
                const eloMatch = sampleData.rawEloData ? sampleData.rawEloData.find(m =>
                    m.Jornada === match.Jornada &&
                    normalizeTeamName(m['Equipa 1']) === normalizeTeamName(team1) &&
                    normalizeTeamName(m['Equipa 2']) === normalizeTeamName(team2)
                ) : null;

                const elo1Delta = eloMatch && eloMatch['Elo Delta 1'] ? parseInt(eloMatch['Elo Delta 1']) : 0;
                const elo2Delta = eloMatch && eloMatch['Elo Delta 2'] ? parseInt(eloMatch['Elo Delta 2']) : 0;

                return {
                    team1: team1,
                    team2: team2,
                    score1: score1Val,
                    score2: score2Val,
                    winner: (score1Val !== null && score2Val !== null) ? (score1Val > score2Val ? team1 : team2) : null,
                    unknownResult: detectUnknownResult(match),
                    eloDelta1: elo1Delta,
                    eloDelta2: elo2Delta
                };
            });
        }

        // PM2 (similar a meias/final)
        const pm2 = secondaryMatches.filter(m => m.Jornada && m.Jornada.startsWith('PM2'));
        if (pm2.length > 0) {
            bracketData["Final"] = pm2.map(match => {
                const team1 = match['Equipa 1'];
                const team2 = match['Equipa 2'];
                // ⚠️ IMPORTANTE: Se score estiver vazio no CSV, usar null (não 0)
                const score1Val = match['Golos 1'] ? parseFloat(match['Golos 1']) : null;
                const score2Val = match['Golos 2'] ? parseFloat(match['Golos 2']) : null;

                // Procurar dados de ELO no rawEloData (mesmo padrão do calendário)
                const eloMatch = sampleData.rawEloData ? sampleData.rawEloData.find(m =>
                    m.Jornada === match.Jornada &&
                    normalizeTeamName(m['Equipa 1']) === normalizeTeamName(team1) &&
                    normalizeTeamName(m['Equipa 2']) === normalizeTeamName(team2)
                ) : null;

                const elo1Delta = eloMatch && eloMatch['Elo Delta 1'] ? parseInt(eloMatch['Elo Delta 1']) : 0;
                const elo2Delta = eloMatch && eloMatch['Elo Delta 2'] ? parseInt(eloMatch['Elo Delta 2']) : 0;

                return {
                    team1: team1,
                    team2: team2,
                    score1: score1Val,
                    score2: score2Val,
                    winner: (score1Val !== null && score2Val !== null) ? (score1Val > score2Val ? team1 : team2) : null,
                    unknownResult: detectUnknownResult(match),
                    eloDelta1: elo1Delta,
                    eloDelta2: elo2Delta
                };
            });
        }

        // ✅ ATRIBUIR bracketData para PM (playoff)
        DebugUtils.debugSecondaryBracket('before_assign', {
            hasPM: hasPM,
            hasStandings: false,
            matchesCount: (bracketData["1ª Fase"]?.length || 0) + (bracketData["Final"]?.length || 0)
        });

        sampleData.secondaryBracket = bracketData;

        DebugUtils.debugSecondaryBracket('after_assign', {
            hasPromotionPlayoffs: hasPM,
            hasStandings: false
        });
    } else if (hasLM) {
        sampleData.secondaryBracketType = isPromotion ? 'promotion-league' : 'maintenance-league';

        // Calcular tabela de classificação da liguilha
        const teamStats = new Map();
        const lmMatches = [];

        // Processar todos os jogos LM
        secondaryMatches.forEach(match => {
            if (match.Jornada && match.Jornada.startsWith('LM')) {
                // ✅ RESOLVER placeholders antes de processar estatísticas
                const team1 = resolveTeamName(match['Equipa 1']);
                const team2 = resolveTeamName(match['Equipa 2']);
                // ⚠️ IMPORTANTE: Se score estiver vazio no CSV, usar null (não 0)
                const score1 = match['Golos 1'] ? parseFloat(match['Golos 1']) : null;
                const score2 = match['Golos 2'] ? parseFloat(match['Golos 2']) : null;
                const isUnknown = detectUnknownResult(match);
                const winner = (score1 !== null && score2 !== null) ? (score1 > score2 ? team1 : (score2 > score1 ? team2 : null)) : null;

                DebugUtils.debugSecondaryBracket('lm_match', { team1, team2, score1, score2, winner });

                lmMatches.push({
                    team1: team1,
                    team2: team2,
                    score1: score1,
                    score2: score2,
                    unknownResult: isUnknown
                });

                // Inicializar equipas SEMPRE (mesmo que jogo não tenha acontecido)
                if (!teamStats.has(team1)) {
                    teamStats.set(team1, {
                        team: team1,
                        played: 0,
                        wins: 0,
                        draws: 0,
                        losses: 0,
                        goalsFor: 0,
                        goalsAgainst: 0,
                        goalDiff: 0,
                        points: 0
                    });
                }
                if (!teamStats.has(team2)) {
                    teamStats.set(team2, {
                        team: team2,
                        played: 0,
                        wins: 0,
                        draws: 0,
                        losses: 0,
                        goalsFor: 0,
                        goalsAgainst: 0,
                        goalDiff: 0,
                        points: 0
                    });
                }

                // Apenas contar estatísticas se resultado conhecido
                if (!isUnknown && score1 !== null && score2 !== null) {
                    const stats1 = teamStats.get(team1);
                    const stats2 = teamStats.get(team2);

                    // Atualizar jogos disputados
                    stats1.played++;
                    stats2.played++;

                    // Atualizar golos
                    stats1.goalsFor += score1;
                    stats1.goalsAgainst += score2;
                    stats2.goalsFor += score2;
                    stats2.goalsAgainst += score1;

                    // Determinar resultado
                    if (score1 > score2) {
                        stats1.wins++;
                        stats1.points += 3;
                        stats2.losses++;
                    } else if (score2 > score1) {
                        stats2.wins++;
                        stats2.points += 3;
                        stats1.losses++;
                    } else {
                        stats1.draws++;
                        stats2.draws++;
                        stats1.points++;
                        stats2.points++;
                    }

                    // Calcular diferença de golos
                    stats1.goalDiff = stats1.goalsFor - stats1.goalsAgainst;
                    stats2.goalDiff = stats2.goalsFor - stats2.goalsAgainst;
                }
            }
        });

        // Converter para array e ordenar
        const standings = Array.from(teamStats.values()).sort((a, b) => {
            // Ordenar por pontos (desc), depois diferença golos (desc), depois golos marcados (desc)
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
            return b.goalsFor - a.goalsFor;
        });

        // Guardar tabela e jogos para exibição
        sampleData.secondaryBracket = {
            isTable: true,
            standings: standings,
            matches: lmMatches
        };
    }

    DebugUtils.debugSecondaryBracket('created', {
        type: sampleData.secondaryBracketType,
        hasPM: hasPM,
        hasLM: hasLM,
        bracketDataKeys: Object.keys(bracketData),
        bracketData: bracketData,
        secondaryBracket: sampleData.secondaryBracket,
        secondaryBracketKeys: Object.keys(sampleData.secondaryBracket || {}),
        secondaryBracketLength: Object.keys(sampleData.secondaryBracket || {}).length
    });

    DebugUtils.debugBracket('secondary_bracket_created', { type: sampleData.secondaryBracketType, data: sampleData.secondaryBracket });
    createSecondaryBracket();
}

// Criar bracket previsto com base nas equipas qualificadas
function createPredictedBracket(qualifiedTeams) {
    DebugUtils.debugPredictedBracket('called', qualifiedTeams);

    if (!qualifiedTeams || qualifiedTeams.length < 8) {
        console.warn('⚠️ createPredictedBracket: equipas insuficientes', qualifiedTeams ? qualifiedTeams.length : 0);
        return {};
    }

    DebugUtils.debugPredictedBracket('creating');

    // Gerar confrontos dos quartos de final (1º vs 8º, 4º vs 5º, 2º vs 7º, 3º vs 6º)
    const bracketData = {
        "Quartos de Final": [
            {
                team1: qualifiedTeams[0],  // 1º
                team2: qualifiedTeams[7],  // 8º
                score1: null,
                score2: null,
                winner: null,
                predicted: true
            },
            {
                team1: qualifiedTeams[3],  // 4º
                team2: qualifiedTeams[4],  // 5º
                score1: null,
                score2: null,
                winner: null,
                predicted: true
            },
            {
                team1: qualifiedTeams[1],  // 2º
                team2: qualifiedTeams[6],  // 7º
                score1: null,
                score2: null,
                winner: null,
                predicted: true
            },
            {
                team1: qualifiedTeams[2],  // 3º
                team2: qualifiedTeams[5],  // 6º
                score1: null,
                score2: null,
                winner: null,
                predicted: true
            }
        ],
        "Meias-Finais": [
            {
                team1: "Vencedor Q1",
                team2: "Vencedor Q2",
                score1: null,
                score2: null,
                winner: null,
                predicted: true
            },
            {
                team1: "Vencedor Q3",
                team2: "Vencedor Q4",
                score1: null,
                score2: null,
                winner: null,
                predicted: true
            }
        ],
        "3º Lugar": [
            {
                team1: "Perdedor M1",
                team2: "Perdedor M2",
                score1: null,
                score2: null,
                winner: null,
                predicted: true,
                isThirdPlace: true
            }
        ],
        "Final": [
            {
                team1: "Vencedor M1",
                team2: "Vencedor M2",
                score1: null,
                score2: null,
                winner: null,
                predicted: true
            }
        ]
    };

    return bracketData;
}

// Criar bracket de exemplo
function createSampleBracket() {
    if (!sampleData.teams || sampleData.teams.length === 0) {
        sampleData.bracket = {};
        createBracket();
        return;
    }

    // Criar bracket de exemplo com as equipas disponíveis
    const teams = sampleData.teams.slice(0, 8); // Usar até 8 equipas

    sampleData.bracket = {
        "Quartos de Final": [
            {
                team1: teams[0]?.name || "Equipa 1",
                team2: teams[1]?.name || "Equipa 2",
                score1: 2,
                score2: 1,
                winner: teams[0]?.name || "Equipa 1"
            },
            {
                team1: teams[2]?.name || "Equipa 3",
                team2: teams[3]?.name || "Equipa 4",
                score1: 3,
                score2: 0,
                winner: teams[2]?.name || "Equipa 3"
            },
            {
                team1: teams[4]?.name || "Equipa 5",
                team2: teams[5]?.name || "Equipa 6",
                score1: 1,
                score2: 2,
                winner: teams[5]?.name || "Equipa 6"
            },
            {
                team1: teams[6]?.name || "Equipa 7",
                team2: teams[7]?.name || "Equipa 8",
                score1: 4,
                score2: 1,
                winner: teams[6]?.name || "Equipa 7"
            }
        ],
        "Meias-Finais": [
            {
                team1: teams[0]?.name || "Equipa 1",
                team2: teams[2]?.name || "Equipa 3",
                score1: 2,
                score2: 3,
                winner: teams[2]?.name || "Equipa 3"
            },
            {
                team1: teams[5]?.name || "Equipa 6",
                team2: teams[6]?.name || "Equipa 7",
                score1: 1,
                score2: 0,
                winner: teams[5]?.name || "Equipa 6"
            }
        ],
        "3º Lugar": [
            {
                team1: teams[0]?.name || "Equipa 1",
                team2: teams[6]?.name || "Equipa 7",
                score1: null,
                score2: null,
                winner: null
            }
        ],
        "Final": [
            {
                team1: teams[2]?.name || "Equipa 3",
                team2: teams[5]?.name || "Equipa 6",
                score1: null,
                score2: null,
                winner: null
            }
        ]
    };

    createBracket();
}

// Criar bracket
function createBracket() {
    const container = document.getElementById('bracketContainer');

    if (!sampleData.bracket || Object.keys(sampleData.bracket).length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Bracket não disponível para esta modalidade</p>';
        return;
    }

    container.innerHTML = '';

    // Obter mapa de equipas qualificadas para mostrar labels - forçar refresh
    const qualified = getQualifiedTeams(true);
    DebugUtils.debugBracket('qualified_teams', qualified);
    const qualificationLabels = {};

    qualified.legend.forEach(item => {
        if (item.type === 'playoff') {
            let label = `${item.position}º`;
            if (item.division === '2ª' && item.group) {
                label += ` Grupo ${item.group}`;
            } else if (item.division === '2ª') {
                label += ` 2ª Div`;
            } else if (item.division === '1ª') {
                label += ` 1ª Div`;
            }
            qualificationLabels[item.team] = label;
        }
    });

    Object.entries(sampleData.bracket).forEach(([round, matches]) => {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'bracket-round';

        const title = document.createElement('h3');
        title.textContent = round;
        roundDiv.appendChild(title);

        matches.forEach((match, index) => {
            // Adicionar subtítulo para o 3º lugar se for o caso
            if (match.isThirdPlace && !document.querySelector('.third-place-header')) {
                const thirdPlaceHeader = document.createElement('h4');
                thirdPlaceHeader.className = 'third-place-header';
                thirdPlaceHeader.textContent = '3º Lugar';
                thirdPlaceHeader.style.cssText = `
                            text-align: center;
                            color: #666;
                            margin: 30px 0 10px 0;
                            padding: 8px;
                            background: #f5f5f5;
                            border-radius: 8px;
                            font-weight: 600;
                            font-size: 0.9em;
                        `;
                roundDiv.appendChild(thirdPlaceHeader);
            }

            const matchDiv = document.createElement('div');
            matchDiv.className = 'bracket-match';

            // Resolver nomes (substituir placeholders por equipas reais)
            const resolvedTeam1 = resolveTeamName(match.team1);
            const resolvedTeam2 = resolveTeamName(match.team2);

            // Obter informações das equipas - aplicar normalização
            const team1Info = getCourseInfo(normalizeTeamName(resolvedTeam1));
            const team2Info = getCourseInfo(normalizeTeamName(resolvedTeam2));

            // Usar cor da equipa ou cinza neutro como fallback
            const team1Color = team1Info.colors ? team1Info.colors[0] : '#6c757d';
            const team2Color = team2Info.colors ? team2Info.colors[0] : '#6c757d';

            const team1Div = document.createElement('div');
            // ✅ MOSTRAR vencedor MESMO com unknownResult (só não mostrar se predicted ou sem score)
            const hasScore = (match.score1 !== null && match.score2 !== null);
            const matchPlayed = hasScore && !match.predicted; // Permitir unknownResult
            const showScore = hasScore && !match.predicted; // Mostrar score mesmo se unknownResult
            team1Div.className = `bracket-team ${matchPlayed && match.winner === match.team1 ? 'winner' : ''}`;

            // Definir cor de fundo se for vencedor E jogo foi realizado, senão border colorida
            if (matchPlayed && match.winner === match.team1) {
                team1Div.style.background = `linear-gradient(135deg, ${team1Color}, ${team1Color}dd)`;
                team1Div.style.borderLeftColor = team1Color;
            } else {
                team1Div.style.borderLeftColor = team1Color;
            }

            // Preparar indicador de ELO
            const elo1Delta = match.eloDelta1 || 0;
            const elo1Html = matchPlayed && elo1Delta !== 0 ?
                `<span class="bracket-elo-change ${elo1Delta > 0 ? 'positive' : 'negative'}">${elo1Delta > 0 ? '+' : ''}${elo1Delta}</span>` : '';

            team1Div.innerHTML = `
                        <div class="bracket-team-content">
                            ${team1Info.emblemPath ?
                    `<img src="${team1Info.emblemPath}" alt="${normalizeTeamName(resolvedTeam1)}" class="bracket-team-emblem" onerror="this.style.display='none'">` :
                    ''
                }
                            <span>${team1Info.displayName || normalizeTeamName(resolvedTeam1)}</span>
                        </div>
                        <span class="score">${showScore ? match.score1 : '-'}</span>
                        ${elo1Html}
                    `;

            // Adicionar label de qualificação acima da equipa 1 (mesma lógica da liguilha - todas as rondas)
            const legendItem1 = qualified.legend.find(item =>
                normalizeTeamName(item.team) === normalizeTeamName(resolvedTeam1)
            );

            if (legendItem1) {
                let qualLabel = '';
                if (legendItem1.division === '1ª') {
                    qualLabel = `${legendItem1.position}º 1ª Div`;
                } else if (legendItem1.division === '2ª') {
                    if (legendItem1.group) {
                        qualLabel = `${legendItem1.actualPosition || legendItem1.position}º Gr. ${legendItem1.group}`;
                    } else {
                        qualLabel = `${legendItem1.actualPosition || legendItem1.position}º 2ª Div`;
                    }
                }

                if (qualLabel) {
                    const label1 = document.createElement('div');
                    label1.className = 'qualification-label qualification-label-top';
                    label1.textContent = qualLabel;
                    matchDiv.appendChild(label1);
                }
            }

            const team2Div = document.createElement('div');
            // ⚠️ Usar mesma lógica de matchPlayed calculada acima
            team2Div.className = `bracket-team ${matchPlayed && match.winner === match.team2 ? 'winner' : ''}`;

            // Definir cor de fundo se for vencedor E jogo foi realizado, senão border colorida
            if (matchPlayed && match.winner === match.team2) {
                team2Div.style.background = `linear-gradient(135deg, ${team2Color}, ${team2Color}dd)`;
                team2Div.style.borderLeftColor = team2Color;
            } else {
                team2Div.style.borderLeftColor = team2Color;
            }

            // Preparar indicador de ELO
            const elo2Delta = match.eloDelta2 || 0;
            const elo2Html = matchPlayed && elo2Delta !== 0 ?
                `<span class="bracket-elo-change ${elo2Delta > 0 ? 'positive' : 'negative'}">${elo2Delta > 0 ? '+' : ''}${elo2Delta}</span>` : '';

            team2Div.innerHTML = `
                        <div class="bracket-team-content">
                            ${team2Info.emblemPath ?
                    `<img src="${team2Info.emblemPath}" alt="${normalizeTeamName(resolvedTeam2)}" class="bracket-team-emblem" onerror="this.style.display='none'">` :
                    ''
                }
                            <span>${team2Info.displayName || normalizeTeamName(resolvedTeam2)}</span>
                        </div>
                        <span class="score">${showScore ? match.score2 : '-'}</span>
                        ${elo2Html}
                    `;

            matchDiv.appendChild(team1Div);
            matchDiv.appendChild(team2Div);

            // Adicionar label de qualificação abaixo da equipa 2 (mesma lógica da liguilha - todas as rondas)
            const legendItem2 = qualified.legend.find(item =>
                normalizeTeamName(item.team) === normalizeTeamName(resolvedTeam2)
            );

            if (legendItem2) {
                let qualLabel = '';
                if (legendItem2.division === '1ª') {
                    qualLabel = `${legendItem2.position}º 1ª Div`;
                } else if (legendItem2.division === '2ª') {
                    if (legendItem2.group) {
                        qualLabel = `${legendItem2.actualPosition || legendItem2.position}º Gr. ${legendItem2.group}`;
                    } else {
                        qualLabel = `${legendItem2.actualPosition || legendItem2.position}º 2ª Div`;
                    }
                }

                if (qualLabel) {
                    const label2 = document.createElement('div');
                    label2.className = 'qualification-label qualification-label-bottom';
                    label2.textContent = qualLabel;
                    matchDiv.appendChild(label2);
                }
            }

            // Adicionar indicação de bracket previsto se aplicável
            if (match.predicted) {
                const predictedIndicator = document.createElement('div');
                predictedIndicator.className = 'predicted-match-indicator';
                predictedIndicator.innerHTML = '<small style="color: #2196F3; font-style: italic; text-align: center; margin-top: 5px;">📅 Confronto Previsto</small>';
                matchDiv.appendChild(predictedIndicator);
            }

            // Adicionar indicação de resultado desconhecido se aplicável
            if (match.unknownResult) {
                const unknownIndicator = document.createElement('div');
                unknownIndicator.className = 'unknown-result-indicator';
                unknownIndicator.innerHTML = '<small style="color: #666; font-style: italic; text-align: center; margin-top: 5px;">⚠️ Resultado Desconhecido</small>';
                matchDiv.appendChild(unknownIndicator);
            }

            roundDiv.appendChild(matchDiv);
        });

        container.appendChild(roundDiv);
    });
}

// Criar bracket secundário (Manutenção/Promoção/Liguilha)
function createSecondaryBracket() {
    const container = document.getElementById('secondaryBracketContainer');
    const card = document.getElementById('secondaryBracketCard');
    const title = document.getElementById('secondaryBracketTitle');

    DebugUtils.debugSecondaryBracket('started', {
        secondaryBracket: sampleData.secondaryBracket,
        secondaryBracketKeys: Object.keys(sampleData.secondaryBracket || {}),
        isEmpty: !sampleData.secondaryBracket || Object.keys(sampleData.secondaryBracket).length === 0,
        bracketType: sampleData.secondaryBracketType
    });

    if (!sampleData.secondaryBracket || Object.keys(sampleData.secondaryBracket).length === 0) {
        console.warn('⚠️ Bracket secundário VAZIO - escondendo card');
        card.style.display = 'none';
        return;
    }

    // Determinar título baseado no tipo de bracket secundário
    const bracketType = sampleData.secondaryBracketType || 'playoff';
    if (bracketType === 'maintenance-playoff') {
        title.textContent = 'Playoff de Manutenção';
    } else if (bracketType === 'maintenance-league') {
        title.textContent = 'Liguilha de Manutenção';
    } else if (bracketType === 'promotion-playoff') {
        title.textContent = 'Playoff de Promoção';
    } else if (bracketType === 'promotion-league') {
        title.textContent = 'Liguilha de Promoção';
    } else {
        title.textContent = 'Playoff/Liguilha';
    }

    card.style.display = 'block';
    container.innerHTML = '';

    // Criar mapa de qualificationLabels para o bracket secundário - forçar refresh
    const qualified = getQualifiedTeams(true);
    DebugUtils.debugSecondaryBracket('qualified_teams', qualified);
    const qualificationLabels = {};

    qualified.legend.forEach(item => {
        const relevantTypes = ['maintenance-playoff', 'maintenance-league', 'promotion-playoff', 'promotion-league'];
        if (relevantTypes.includes(item.type)) {
            let label = `${item.position}º`;
            if (item.division === '2ª' && item.group) {
                label += ` Grupo ${item.group}`;
            } else if (item.division === '2ª') {
                label += ` 2ª Div`;
            } else if (item.division === '1ª') {
                label += ` 1ª Div`;
            }
            qualificationLabels[item.team] = label;
        }
    });

    // Verificar se é uma tabela (liguilha) ou bracket (playoff)
    if (sampleData.secondaryBracket.isTable) {
        // Criar tabela de classificação para liguilhas
        const tableDiv = document.createElement('div');
        tableDiv.className = 'bracket-league-table';

        // Obter labels corretos para golos/cestos
        const headers = getGoalHeaders();

        const table = document.createElement('table');
        table.innerHTML = `
                    <thead>
                        <tr>
                            <th>Pos</th>
                            <th>Equipa</th>
                            <th>J</th>
                            <th>V</th>
                            <th>E</th>
                            <th>D</th>
                            <th>${headers.scored}</th>
                            <th>${headers.conceded}</th>
                            <th>±</th>
                            <th>Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                `;

        const tbody = table.querySelector('tbody');

        // Obter informações de qualificação
        const qualified = getQualifiedTeams();

        sampleData.secondaryBracket.standings.forEach((stats, index) => {
            // Resolver nome da equipa
            const resolvedTeam = resolveTeamName(stats.team);
            const teamInfo = getCourseInfo(normalizeTeamName(resolvedTeam));

            // Encontrar de onde veio esta equipa
            let qualLabel = '';
            let qualClass = '';
            const legendItem = qualified.legend.find(item =>
                item.team === resolvedTeam &&
                (item.type === 'maintenance-league' || item.type === 'promotion-league')
            );

            if (legendItem) {
                if (legendItem.division === '1ª') {
                    qualLabel = `${legendItem.position}º 1ª Div`;
                    qualClass = 'qual-1div';
                } else if (legendItem.division === '2ª') {
                    if (legendItem.group) {
                        qualLabel = `${legendItem.actualPosition || legendItem.position}º Gr. ${legendItem.group}`;
                    } else {
                        qualLabel = `${legendItem.actualPosition || legendItem.position}º 2ª Div`;
                    }
                    qualClass = 'qual-2div';
                }
            }

            const row = document.createElement('tr');

            row.innerHTML = `
                        <td class="position">${index + 1}</td>
                        <td class="team-cell">
                            ${qualLabel ? `<span class="team-qualification-label ${qualClass}">${qualLabel}</span>` : ''}
                            ${teamInfo.emblemPath ?
                    `<img src="${teamInfo.emblemPath}" alt="${resolvedTeam}" class="team-emblem" onerror="this.style.display='none'">` :
                    ''
                }
                            <span>${teamInfo.displayName || resolvedTeam}</span>
                        </td>
                        <td>${stats.played}</td>
                        <td>${stats.wins}</td>
                        <td>${stats.draws}</td>
                        <td>${stats.losses}</td>
                        <td>${stats.goalsFor}</td>
                        <td>${stats.goalsAgainst}</td>
                        <td class="${stats.goalDiff > 0 ? 'positive' : stats.goalDiff < 0 ? 'negative' : ''}">${stats.goalDiff > 0 ? '+' : ''}${stats.goalDiff}</td>
                        <td class="points"><strong>${stats.points}</strong></td>
                    `;

            tbody.appendChild(row);
        });

        tableDiv.appendChild(table);
        container.appendChild(tableDiv);
    } else {
        // Exibir como bracket tradicional
        Object.entries(sampleData.secondaryBracket).forEach(([round, matches]) => {
            const roundDiv = document.createElement('div');
            roundDiv.className = 'bracket-round';

            const roundTitle = document.createElement('h3');
            roundTitle.textContent = round;
            roundDiv.appendChild(roundTitle);

            matches.forEach(match => {
                const matchDiv = document.createElement('div');
                matchDiv.className = 'bracket-match';

                // Resolver nomes (substituir placeholders por equipas reais)
                const resolvedTeam1 = resolveTeamName(match.team1);
                const resolvedTeam2 = resolveTeamName(match.team2);

                // Obter informações das equipas
                const team1Info = getCourseInfo(normalizeTeamName(resolvedTeam1));
                const team2Info = getCourseInfo(normalizeTeamName(resolvedTeam2));

                // Usar cor da equipa ou cinza neutro como fallback
                const team1Color = team1Info.colors ? team1Info.colors[0] : '#6c757d';
                const team2Color = team2Info.colors ? team2Info.colors[0] : '#6c757d';

                const team1Div = document.createElement('div');
                // ✅ MOSTRAR vencedor MESMO com unknownResult (só não mostrar se predicted ou sem score)
                const hasScore = (match.score1 !== null && match.score2 !== null);
                const matchPlayed = hasScore && !match.predicted; // Permitir unknownResult
                const showScore = hasScore && !match.predicted; // Mostrar score mesmo se unknownResult
                team1Div.className = `bracket-team ${matchPlayed && match.winner === match.team1 ? 'winner' : ''}`;

                if (matchPlayed && match.winner === match.team1) {
                    team1Div.style.background = `linear-gradient(135deg, ${team1Color}, ${team1Color}dd)`;
                    team1Div.style.borderLeftColor = team1Color;
                } else {
                    team1Div.style.borderLeftColor = team1Color;
                }

                // Preparar indicador de ELO
                const elo1Delta = match.eloDelta1 || 0;
                const elo1Html = matchPlayed && elo1Delta !== 0 ?
                    `<span class="bracket-elo-change ${elo1Delta > 0 ? 'positive' : 'negative'}">${elo1Delta > 0 ? '+' : ''}${elo1Delta}</span>` : '';

                team1Div.innerHTML = `
                        <div class="bracket-team-content">
                            ${team1Info.emblemPath ?
                        `<img src="${team1Info.emblemPath}" alt="${normalizeTeamName(resolvedTeam1)}" class="bracket-team-emblem" onerror="this.style.display='none'">` :
                        ''
                    }
                            <span>${team1Info.displayName || normalizeTeamName(resolvedTeam1)}</span>
                        </div>
                        <span class="score">${showScore ? match.score1 : '-'}</span>
                        ${elo1Html}
                    `;

                // Adicionar label de qualificação acima da equipa 1 (mesma lógica da liguilha)
                const legendItem1 = qualified.legend.find(item =>
                    normalizeTeamName(item.team) === normalizeTeamName(resolvedTeam1)
                );

                if (legendItem1) {
                    let qualLabel = '';
                    if (legendItem1.division === '1ª') {
                        qualLabel = `${legendItem1.position}º 1ª Div`;
                    } else if (legendItem1.division === '2ª') {
                        if (legendItem1.group) {
                            qualLabel = `${legendItem1.actualPosition || legendItem1.position}º Gr. ${legendItem1.group}`;
                        } else {
                            qualLabel = `${legendItem1.actualPosition || legendItem1.position}º 2ª Div`;
                        }
                    }

                    if (qualLabel) {
                        const label1 = document.createElement('div');
                        label1.className = 'qualification-label qualification-label-top';
                        label1.textContent = qualLabel;
                        matchDiv.appendChild(label1);
                    }
                }

                const team2Div = document.createElement('div');
                // ⚠️ Usar mesma lógica de matchPlayed calculada acima
                team2Div.className = `bracket-team ${matchPlayed && match.winner === match.team2 ? 'winner' : ''}`;

                if (matchPlayed && match.winner === match.team2) {
                    team2Div.style.background = `linear-gradient(135deg, ${team2Color}, ${team2Color}dd)`;
                    team2Div.style.borderLeftColor = team2Color;
                } else {
                    team2Div.style.borderLeftColor = team2Color;
                }

                // Preparar indicador de ELO
                const elo2Delta = match.eloDelta2 || 0;
                const elo2Html = matchPlayed && elo2Delta !== 0 ?
                    `<span class="bracket-elo-change ${elo2Delta > 0 ? 'positive' : 'negative'}">${elo2Delta > 0 ? '+' : ''}${elo2Delta}</span>` : '';

                team2Div.innerHTML = `
                        <div class="bracket-team-content">
                            ${team2Info.emblemPath ?
                        `<img src="${team2Info.emblemPath}" alt="${normalizeTeamName(resolvedTeam2)}" class="bracket-team-emblem" onerror="this.style.display='none'">` :
                        ''
                    }
                            <span>${team2Info.displayName || normalizeTeamName(resolvedTeam2)}</span>
                        </div>
                        <span class="score">${showScore ? match.score2 : '-'}</span>
                        ${elo2Html}
                    `;

                matchDiv.appendChild(team1Div);
                matchDiv.appendChild(team2Div);

                // Adicionar label de qualificação abaixo da equipa 2 (mesma lógica da liguilha)
                const legendItem2 = qualified.legend.find(item =>
                    normalizeTeamName(item.team) === normalizeTeamName(resolvedTeam2)
                );

                if (legendItem2) {
                    let qualLabel = '';
                    if (legendItem2.division === '1ª') {
                        qualLabel = `${legendItem2.position}º 1ª Div`;
                    } else if (legendItem2.division === '2ª') {
                        if (legendItem2.group) {
                            qualLabel = `${legendItem2.actualPosition || legendItem2.position}º Gr. ${legendItem2.group}`;
                        } else {
                            qualLabel = `${legendItem2.actualPosition || legendItem2.position}º 2ª Div`;
                        }
                    }

                    if (qualLabel) {
                        const label2 = document.createElement('div');
                        label2.className = 'qualification-label qualification-label-bottom';
                        label2.textContent = qualLabel;
                        matchDiv.appendChild(label2);
                    }
                }

                if (match.unknownResult) {
                    const unknownIndicator = document.createElement('div');
                    unknownIndicator.className = 'unknown-result-indicator';
                    unknownIndicator.innerHTML = '<small style="color: #666; font-style: italic; text-align: center; margin-top: 5px;">⚠️ Resultado Desconhecido</small>';
                    matchDiv.appendChild(unknownIndicator);
                }

                roundDiv.appendChild(matchDiv);
            });

            container.appendChild(roundDiv);
        });
    }
}

// Atualizar filtros rápidos baseado na estrutura da modalidade
function updateQuickFilters() {
    DebugUtils.debugModalityAnalysis('updating_filters');
    const structure = analyzeModalityStructure();
    DebugUtils.debugModalityAnalysis('structure_detected', structure);
    const filtersContainer = document.getElementById('quickFilters');

    // Limpar filtros existentes
    filtersContainer.innerHTML = '';

    const top3Btn = document.createElement('button');
    top3Btn.className = 'filter-btn';
    top3Btn.textContent = 'Top 3';
    top3Btn.dataset.filter = 'top3';
    top3Btn.setAttribute('aria-label', 'Filtrar top 3 equipas');
    top3Btn.onclick = filterTop3;
    filtersContainer.appendChild(top3Btn);

    // Usar a mesma lógica da tabela de classificação
    const divisions = Object.keys(sampleData.rankings);

    // Se for liga única, não adicionar filtros de divisão/grupo
    if (structure.type !== 'single-league') {
        // Verificar se há múltiplos grupos da 2ª divisão
        const div2Groups = divisions.filter(d => d.startsWith('2ª Divisão - Grupo'));

        divisions.forEach(division => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.textContent = division;
            btn.dataset.filter = 'division';
            btn.dataset.division = division;
            btn.setAttribute('aria-label', `Filtrar por ${division}`);
            filtersContainer.appendChild(btn);
        });

        // Adicionar botão "2ª Divisão" especial logo após a 1ª divisão
        if (div2Groups.length > 1) {
            // Encontrar a posição após a 1ª divisão
            const buttons = filtersContainer.querySelectorAll('.filter-btn');
            let insertAfter = null;
            buttons.forEach(btn => {
                if (btn.textContent === '1ª Divisão') {
                    insertAfter = btn;
                }
            });

            const allDiv2Btn = document.createElement('button');
            allDiv2Btn.className = 'filter-btn';
            allDiv2Btn.textContent = '2ª Divisão';
            allDiv2Btn.dataset.filter = 'all-div2';
            allDiv2Btn.setAttribute('aria-label', 'Filtrar por toda a 2ª Divisão');
            allDiv2Btn.onclick = () => selectDivision('2');

            if (insertAfter) {
                insertAfter.after(allDiv2Btn);
            } else {
                filtersContainer.appendChild(allDiv2Btn);
            }
        }
    }

    // Verificar se há playoffs REAIS ou se a fase de grupos ainda não terminou
    let hasActualPlayoffs = false;
    let groupStageComplete = false;

    if (sampleData.rawEloData && sampleData.rawEloData.length > 0) {
        // Verificar se há jogos de playoffs (jornadas começando com 'E')
        hasActualPlayoffs = sampleData.rawEloData.some(match =>
            match.Jornada && match.Jornada.startsWith('E')
        );

        // Verificar se todos os jogos da fase de grupos estão completos
        const groupStageGames = sampleData.rawEloData.filter(match =>
            match.Jornada && !match.Jornada.startsWith('E')
        );

        if (groupStageGames.length > 0) {
            const allGroupGamesPlayed = groupStageGames.every(match => {
                const score1 = match["Golos Casa"] || match.score1;
                const score2 = match["Golos Fora"] || match.score2;
                return score1 != null && score1 !== '' && score2 != null && score2 !== '';
            });
            groupStageComplete = allGroupGamesPlayed;
        }
    }

    // Mostrar "Playoffs" se há playoffs reais OU se fase de grupos está completa
    const playoffsLabel = (hasActualPlayoffs || groupStageComplete) ? 'Playoffs' : 'Playoffs (Classificação Atual)';

    // Adicionar filtros finais
    const playoffsBtn = document.createElement('button');
    playoffsBtn.className = 'filter-btn';
    playoffsBtn.textContent = playoffsLabel;
    playoffsBtn.setAttribute('aria-label', 'Filtrar equipas dos playoffs');
    playoffsBtn.onclick = filterPlayoffs;
    filtersContainer.appendChild(playoffsBtn);

    const sensationBtn = document.createElement('button');
    sensationBtn.className = 'filter-btn';
    sensationBtn.textContent = 'Equipas Sensação';
    sensationBtn.setAttribute('aria-label', 'Filtrar equipas sensação com maior ganho de ELO');
    sensationBtn.onclick = filterSensationTeams;
    filtersContainer.appendChild(sensationBtn);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'filter-btn';
    resetBtn.textContent = 'Resetar Filtro';
    resetBtn.setAttribute('aria-label', 'Resetar filtros de equipas');
    resetBtn.onclick = resetFilter;
    filtersContainer.appendChild(resetBtn);
}

// ==================== UTILITIES ====================

/**
 * Utilitários para trabalhar com equipas, especialmente equipas B
 */
const TeamUtils = {
    /**
     * Verifica se uma equipa é equipa B
     * @param {string} name - Nome da equipa
     * @returns {boolean}
     */
    isTeamB(name) {
        return /\sB$/i.test(name?.trim());
    },

    /**
     * Obtém o nome da equipa A correspondente a uma equipa B
     * @param {string} teamBName - Nome da equipa B
     * @returns {string} Nome da equipa A
     */
    getTeamA(teamBName) {
        return teamBName?.trim().replace(/\sB$/i, '');
    },

    /**
     * Verifica se a equipa A correspondente está em posição de descida
     * @param {string} teamBName - Nome da equipa B
     * @param {Array} div1Teams - Lista de equipas da 1ª divisão (ordenadas por classificação)
     * @returns {boolean}
     */
    isTeamAInRelegation(teamBName, div1Teams) {
        if (!this.isTeamB(teamBName)) {
            return false;
        }

        const teamAName = this.getTeamA(teamBName);
        const teamAIndex = div1Teams.findIndex(t => t.team === teamAName);

        if (teamAIndex === -1) {
            return false; // Equipa A não está na 1ª divisão
        }

        // Considerar em risco de descida se está nos últimos 3 lugares (10º, 11º, 12º)
        return teamAIndex >= div1Teams.length - 3;
    },

    /**
     * Normaliza nome de equipa para comparações
     * @param {string} name - Nome da equipa
     * @returns {string}
     */
    normalizeName(name) {
        return name?.trim().replace(/\s+/g, ' ');
    },

    /**
     * Encontra primeira equipa não-B numa lista
     * @param {Array} teams - Lista de equipas
     * @param {number} startIndex - Índice inicial para começar a procura
     * @returns {Object} { team, index } ou null se não encontrar
     */
    findFirstNonBTeam(teams, startIndex = 0) {
        for (let i = startIndex; i < teams.length; i++) {
            if (!this.isTeamB(teams[i].team)) {
                return { team: teams[i], index: i };
            }
        }
        return null;
    }
};

// ==================== STRATEGY PATTERN PARA PROGRESSÃO ====================

// Estratégias de progressão por tipo de estrutura de torneio
const progressionStrategies = {
    'single-league': (context) => {
        // Liga única sem divisões nem grupos
        // REGRA: Passam sempre 8 aos playoffs
        if (context.position <= 8) {
            return {
                type: 'playoffs',
                description: 'Qualificação para play-offs'
            };
        }
        return null;
    },

    'groups-only': (context) => {
        // Formato: Sem divisões, sempre 2 grupos
        // Passam os primeiros 4 de cada grupo aos play-offs
        if (context.position <= 4) {
            return {
                type: 'playoffs',
                description: 'Qualificação para play-offs'
            };
        }
        return null;
    },

    'divisions-only': (context) => {
        // Formato: Múltiplas divisões sem grupos
        const { position, totalTeams, divisionNum, structure,
            hasMaintenancePlayoffs, hasMaintenanceLeague } = context;

        if (divisionNum === 1) {
            return progressionStrategies._firstDivisionOnly(context);
        } else if (divisionNum === 2) {
            return progressionStrategies._secondDivisionOnly(context);
        } else {
            return progressionStrategies._lowerDivisions(context);
        }
    },

    'divisions-and-groups': (context) => {
        // Formato: Divisões com grupos
        const { divisionNum } = context;

        if (divisionNum === 1) {
            return progressionStrategies._firstDivisionWithGroups(context);
        } else if (divisionNum === 2) {
            return progressionStrategies._secondDivisionWithGroups(context);
        } else {
            return progressionStrategies._lowerDivisions(context);
        }
    },

    // Estratégias auxiliares para divisões específicas
    _firstDivisionOnly: (context) => {
        const { position, totalTeams, structure,
            hasMaintenancePlayoffs, hasMaintenanceLeague } = context;

        const has2ndDivision = structure.divisions.includes('2');
        const relegationRules = getRelegationRules();
        const playoffSpots = calculatePlayoffSpots(has2ndDivision);

        if (position <= playoffSpots && totalTeams >= 8) {
            return {
                type: 'playoffs',
                description: 'Qualificação para play-offs'
            };
        }

        return calculateRelegationProgression(
            position,
            totalTeams,
            relegationRules,
            hasMaintenancePlayoffs,
            hasMaintenanceLeague
        );
    },

    _secondDivisionOnly: (context) => {
        const { position, hasMaintenancePlayoffs, hasMaintenanceLeague } = context;

        if (position === 1) {
            return {
                type: 'playoffs',
                description: 'Play-offs + Promoção'
            };
        }

        if (position === 2) {
            return calculatePromotionProgression(hasMaintenancePlayoffs, hasMaintenanceLeague);
        }

        return null;
    },

    _firstDivisionWithGroups: (context) => {
        const { position, totalTeams, structure,
            hasMaintenancePlayoffs, hasMaintenanceLeague } = context;

        const secondDivisionGroups = structure.groups.filter(g =>
            sampleData.teams.some(team => team.division === '2' && team.group === g)
        ).length;

        const playoffSpotsFrom1st = calculatePlayoffSpotsWithGroups(secondDivisionGroups, structure);

        if (position <= playoffSpotsFrom1st) {
            return {
                type: 'playoffs',
                description: 'Qualificação para play-offs'
            };
        }

        const relegationRules = getRelegationRules();
        return calculateRelegationProgression(
            position,
            totalTeams,
            relegationRules,
            hasMaintenancePlayoffs,
            hasMaintenanceLeague
        );
    },

    _secondDivisionWithGroups: (context) => {
        const { position, hasMaintenancePlayoffs, hasMaintenanceLeague } = context;

        if (position === 1) {
            return {
                type: 'playoffs',
                description: 'Play-offs + Promoção'
            };
        }

        if (position === 2) {
            return calculatePromotionProgression(hasMaintenancePlayoffs, hasMaintenanceLeague);
        }

        return null;
    },

    _lowerDivisions: (context) => {
        // 3ª divisão ou inferior - primeiros 2 sobem
        if (context.position <= 2) {
            return {
                type: 'promotion',
                description: 'Subida de divisão'
            };
        }
        return null;
    }
};

// Funções auxiliares para cálculos específicos
function getRelegationRules() {
    const epochSelector = document.getElementById('epoca');
    const modalidadeSelector = document.getElementById('modalidade');

    if (!epochSelector || !modalidadeSelector) {
        console.warn('⚠️ getRelegationRules: seletores não encontrados');
        return { directRelegation: 3, maintenancePosition: 1 };
    }

    const currentEpoch = epochSelector.value;
    const currentModality = modalidadeSelector.value;

    if (currentEpoch === '24_25') {
        if (currentModality && currentModality.includes('ANDEBOL')) {
            return { directRelegation: 2, maintenancePosition: 0 };
        }
        return { directRelegation: 4, maintenancePosition: 0 };
    }

    if (currentModality && currentModality.includes('ANDEBOL')) {
        return { directRelegation: 2, maintenancePosition: 1 };
    }

    return { directRelegation: 3, maintenancePosition: 1 };
}

function calculatePlayoffSpots(has2ndDivision) {
    const epochSelector = document.getElementById('epoca');
    const modalidadeSelector = document.getElementById('modalidade');

    if (!epochSelector || !modalidadeSelector) {
        return 7;
    }

    const currentEpoch = epochSelector.value;
    const currentModality = modalidadeSelector.value;

    if (currentEpoch === '24_25') {
        return currentModality && currentModality.includes('ANDEBOL') ? 7 : 6;
    }

    if (currentModality && currentModality.includes('ANDEBOL')) {
        return 7;
    }

    return has2ndDivision ? 7 : 8;
}

function calculatePlayoffSpotsWithGroups(secondDivisionGroups, structure) {
    const epochSelector = document.getElementById('epoca');
    const currentEpoch = epochSelector ? epochSelector.value : null;

    if (currentEpoch === '24_25') {
        return calculatePlayoffSpots(false);
    }

    if (secondDivisionGroups === 0 && structure.divisions.includes('2')) {
        return 7;
    }

    return Math.max(4, 8 - secondDivisionGroups);
}

function calculateRelegationProgression(position, totalTeams, relegationRules, hasMaintenancePlayoffs, hasMaintenanceLeague) {
    const directRelegationStart = totalTeams - relegationRules.directRelegation + 1;
    const maintenanceStart = totalTeams - (relegationRules.directRelegation + relegationRules.maintenancePosition) + 1;

    if (position >= directRelegationStart) {
        return {
            type: 'relegation',
            description: 'Descida de divisão'
        };
    }

    if (relegationRules.maintenancePosition > 0 && position >= maintenanceStart) {
        if (hasMaintenancePlayoffs || hasMaintenanceLeague) {
            return {
                type: hasMaintenancePlayoffs ? 'maintenance-playoffs' : 'maintenance-league',
                description: hasMaintenancePlayoffs ? 'Play-off de manutenção' : 'Liguilha de manutenção'
            };
        }
    }

    return null;
}

function calculatePromotionProgression(hasMaintenancePlayoffs, hasMaintenanceLeague) {
    if (hasMaintenancePlayoffs) {
        return {
            type: 'promotion-playoffs',
            description: 'Play-off de Promoção'
        };
    }

    if (hasMaintenanceLeague) {
        return {
            type: 'promotion-league',
            description: 'Liguilha de Promoção'
        };
    }

    return {
        type: 'promotion',
        description: 'Subida de divisão'
    };
}

function checkTeamBQualification(teamName, position) {
    if (!teamName || !TeamUtils.isTeamB(teamName)) {
        return null;
    }

    const qualified = getQualifiedTeams();
    const isInPlayoffs = qualified.playoffs.some(t => t === teamName);
    const isInMaintenancePlayoff = qualified.maintenancePlayoff.some(t => t === teamName);
    const isInPromotionPlayoff = qualified.promotionPlayoff.some(t => t === teamName);

    if (!isInPlayoffs && !isInMaintenancePlayoff && !isInPromotionPlayoff) {
        DebugUtils.debugTeamBStatus('team_b_not_qualified', { team: teamName, position });
        return {
            type: 'safe',
            description: `Zona segura (${position}º lugar - equipa B não qualifica)`
        };
    }

    DebugUtils.debugTeamBStatus('team_b_qualified', { team: teamName, position });
    return null;
}

function checkSubstituteQualification(teamName, position, isSecondDivision, hasMaintenancePlayoffs, hasMaintenanceLeague) {
    if (!teamName || TeamUtils.isTeamB(teamName) || !isSecondDivision || (position !== 2 && position < 3)) {
        return null;
    }

    const qualified = getQualifiedTeams();
    const isInPlayoffs = qualified.playoffs.some(t => t === teamName);

    if (isInPlayoffs && position > 1) {
        DebugUtils.debugTeamBStatus('in_playoffs_replaced', { team: teamName, position });
        return {
            type: 'playoffs',
            description: `Play-offs + Promoção (substitui ${position}º do grupo)`
        };
    }

    const isInPromotionPlayoff = qualified.promotionPlayoff.some(t => t === teamName);

    if (isInPromotionPlayoff && position > 2) {
        DebugUtils.debugTeamBStatus('in_promotion_replaced', { team: teamName, position });

        if (hasMaintenancePlayoffs) {
            return {
                type: 'promotion-playoffs',
                description: `Play-off de Promoção (substitui ${position}º do grupo)`
            };
        }

        if (hasMaintenanceLeague) {
            return {
                type: 'promotion-league',
                description: `Liguilha de Promoção (substitui ${position}º do grupo)`
            };
        }

        return {
            type: 'promotion',
            description: `Subida de divisão (substitui ${position}º do grupo)`
        };
    }

    return null;
}

// Função principal de progressão usando Strategy Pattern
function getTeamProgression(position, totalTeams, structure, teamName = null, teamGroup = null) {
    DebugUtils.debugModalityAnalysis('calculating_progression', {
        position,
        totalTeams,
        structure: structure.type,
        divisions: structure.divisions,
        groups: structure.groups,
        currentDivision,
        currentGroup,
        playoffSystem: playoffSystemInfo,
        teamName,
        teamGroup
    });

    const divisionNum = parseInt(currentDivision) || 1;
    const isSecondDivision = divisionNum === 2;
    const hasWinnerPlayoffs = playoffSystemInfo.hasWinnerPlayoffs || false;
    const hasMaintenancePlayoffs = playoffSystemInfo.hasMaintenancePlayoffs || false;
    const hasMaintenanceLeague = playoffSystemInfo.hasMaintenanceLeague || false;

    // Verificar qualificação de equipa B
    const teamBResult = checkTeamBQualification(teamName, position);
    if (teamBResult) return teamBResult;

    // Verificar equipa substituta
    const substituteResult = checkSubstituteQualification(
        teamName,
        position,
        isSecondDivision,
        hasMaintenancePlayoffs,
        hasMaintenanceLeague
    );
    if (substituteResult) return substituteResult;

    // Criar contexto para a estratégia
    const context = {
        position,
        totalTeams,
        structure,
        divisionNum,
        isSecondDivision,
        hasWinnerPlayoffs,
        hasMaintenancePlayoffs,
        hasMaintenanceLeague,
        teamName,
        teamGroup
    };

    // Selecionar e executar estratégia apropriada
    const strategy = progressionStrategies[structure.type];
    if (!strategy) {
        console.warn(`⚠️ Estratégia não encontrada para tipo: ${structure.type}`);
        return { type: 'safe', description: 'Zona segura' };
    }

    const result = strategy(context);
    return result || { type: 'safe', description: 'Zona segura' };
}

// ==================== FIM DO STRATEGY PATTERN ====================

function analyzeModalityStructure() {
    const structure = {
        hasDivisions: false,
        hasGroups: false,
        divisions: [],
        groups: [],
        type: 'unknown'
    };

    DebugUtils.debugModalityAnalysis('analyzing_structure');
    DebugUtils.debugModalityAnalysis('rankings_available', Object.keys(sampleData.rankings));

    // Verificar estrutura baseada nos dados de classificação
    Object.keys(sampleData.rankings).forEach(key => {
        // Detectar divisões: "1ª Divisão", "2ª Divisão", "1", "2"
        if (key.includes('Divisão') || key.match(/^[12][ªa]?\s*(div|divisão)?$/i) || ['1', '2'].includes(key)) {
            structure.hasDivisions = true;
            if (!structure.divisions.includes(key)) {
                structure.divisions.push(key);
            }
        }

        // Detectar grupos: "2ª Divisão - Grupo A", ou qualquer chave com "Grupo"
        if (key.includes('Grupo') || key.match(/grupo\s+[A-Z]/i)) {
            structure.hasGroups = true;
            if (!structure.groups.includes(key)) {
                structure.groups.push(key);
            }
        }

        // "geral" é liga única
        if (key === 'geral') {
            structure.type = 'single-league';
        }
    });

    // Verificar grupos dentro das equipas para casos especiais
    const groupsInTeams = new Set();
    sampleData.teams.forEach(team => {
        if (team.group && team.group !== team.division) {
            groupsInTeams.add(team.group);
        }
    });

    if (groupsInTeams.size > 0) {
        structure.hasGroups = true;
        groupsInTeams.forEach(group => {
            if (!structure.groups.includes(group)) {
                structure.groups.push(group);
            }
        });
    }

    // Determinar tipo de estrutura
    if (structure.hasDivisions && structure.hasGroups) {
        structure.type = 'divisions-and-groups'; // Ex: Futsal Masculino
    } else if (structure.hasDivisions) {
        structure.type = 'divisions-only'; // Ex: Andebol
    } else if (structure.hasGroups) {
        structure.type = 'groups-only'; // Ex: Futsal Feminino 24_25 (2 grupos)
    } else if (Object.keys(sampleData.rankings).length === 1 && Object.keys(sampleData.rankings)[0] === 'geral') {
        structure.type = 'single-league'; // Ex: Basquetebol Feminino 25_26, Futsal Feminino 25_26 (liga única)
    }

    DebugUtils.debugModalityAnalysis('structure_detected', structure);
    return structure;
}

// Função auxiliar para ativar só certas equipas
function setActiveTeams(teamNames) {
    const checkboxes = document.querySelectorAll('#teamSelector input[type="checkbox"]');
    checkboxes.forEach((checkbox, index) => {
        const label = checkbox.parentElement;
        if (teamNames.includes(sampleData.teams[index].name)) {
            checkbox.checked = true;
            label.classList.add('active');
        } else {
            checkbox.checked = false;
            label.classList.remove('active');
        }
    });
    updateEloChart();
    updateTeamCountIndicator();
}

// Filtro Top 3 - mostra equipas da final e 3º lugar se existir, senão Top 3 por ELO
function filterTop3() {
    const top3Teams = new Set();

    // Verificar se há jogos de playoffs definidos
    if (sampleData.rawEloData && sampleData.rawEloData.length > 0) {
        // Procurar jogos da Final (E3) e 3º Lugar (E3L)
        sampleData.rawEloData.forEach(match => {
            if (match.Jornada === 'E3') {
                // Final - adicionar ambas as equipas (1º e 2º lugar)
                if (match["Equipa 1"]) top3Teams.add(match["Equipa 1"]);
                if (match["Equipa 2"]) top3Teams.add(match["Equipa 2"]);
            } else if (match.Jornada === 'E3L') {
                // 3º Lugar - adicionar APENAS o vencedor
                const score1 = parseInt(match["Golos Casa"]) || parseInt(match.score1) || 0;
                const score2 = parseInt(match["Golos Fora"]) || parseInt(match.score2) || 0;

                if (score1 > score2 && match["Equipa 1"]) {
                    top3Teams.add(match["Equipa 1"]);
                } else if (score2 > score1 && match["Equipa 2"]) {
                    top3Teams.add(match["Equipa 2"]);
                } else if (score1 === score2 && score1 > 0) {
                    // Em caso de empate, adicionar ambos (improvável mas possível)
                    if (match["Equipa 1"]) top3Teams.add(match["Equipa 1"]);
                    if (match["Equipa 2"]) top3Teams.add(match["Equipa 2"]);
                }
            }
        });
    }

    // Se encontrou exatamente 3 equipas dos playoffs, usar essas
    if (top3Teams.size === 3) {
        DebugUtils.debugBracket('top3_from_playoffs', [...top3Teams]);
        setActiveTeams([...top3Teams]);
        return;
    }

    // Caso contrário, usar Top 3 por ELO
    const allTeamsWithElo = sampleData.teams.map(team => {
        const history = sampleData.eloHistory[team.name];
        const currentElo = history && history.length > 0
            ? history[history.length - 1]
            : (team.initialElo || DEFAULT_ELO);

        return {
            name: team.name,
            elo: currentElo
        };
    });

    // Ordenar por ELO decrescente
    allTeamsWithElo.sort((a, b) => b.elo - a.elo);

    // Pegar top 3
    const top3Names = allTeamsWithElo.slice(0, 3).map(t => t.name);

    DebugUtils.debugBracket('top3_by_elo', { teams: top3Names, elos: allTeamsWithElo.slice(0, 3) });
    setActiveTeams(top3Names);
}        // Filtro por divisão
function filterDivision(division) {
    if (!sampleData.rankings[division]) return;
    const divisionTeams = sampleData.rankings[division].map(t => t.team);
    setActiveTeams(divisionTeams);
}

// Filtro por grupo
function filterGroup(group) {
    const groupTeams = [];
    // Procurar em todas as divisões por equipas do grupo especificado
    Object.values(sampleData.rankings).forEach(divisionTeams => {
        divisionTeams.forEach(team => {
            if (team.group === group) {
                groupTeams.push(team.team);
            }
        });
    });
    setActiveTeams(groupTeams);
}

// Filtro equipas que passaram aos playoffs (estão no bracket)
function filterPlayoffs() {
    const playoffTeams = new Set();
    let hasActualPlayoffs = false;

    // Primeiro verificar se há jogos de playoffs (jornadas que começam com 'E')
    if (sampleData.rawEloData && sampleData.rawEloData.length > 0) {
        sampleData.rawEloData.forEach(match => {
            if (match.Jornada && match.Jornada.startsWith('E')) {
                hasActualPlayoffs = true;
                if (match["Equipa 1"]) playoffTeams.add(match["Equipa 1"]);
                if (match["Equipa 2"]) playoffTeams.add(match["Equipa 2"]);
            }
        });
    }

    // Se não há jogos de playoffs reais, usar dados do bracket (classificação atual)
    if (!hasActualPlayoffs && sampleData.bracket && Object.keys(sampleData.bracket).length > 0) {
        DebugUtils.debugPlayoffs('using_bracket_classification');
        Object.values(sampleData.bracket).forEach(round =>
            round.forEach(match => {
                if (match.team1) playoffTeams.add(match.team1);
                if (match.team2) playoffTeams.add(match.team2);
            })
        );
    }

    DebugUtils.debugPlayoffs('playoff_teams', [...playoffTeams]);
    setActiveTeams([...playoffTeams]);
}

// Filtro Equipas Sensação - 3 equipas com maior ganho de ELO desde o início
function filterSensationTeams() {
    const teamsWithGain = sampleData.teams.map(team => {
        const history = sampleData.eloHistory[team.name];

        if (!history || history.length < 2) {
            return {
                name: team.name,
                gain: 0,
                initial: team.initialElo || DEFAULT_ELO,
                current: team.initialElo || DEFAULT_ELO
            };
        }

        const initialElo = history[0]; // Primeiro valor (início da época)
        const currentElo = history[history.length - 1]; // Último valor (ELO atual)
        const gain = currentElo - initialElo;

        return {
            name: team.name,
            gain: gain,
            initial: initialElo,
            current: currentElo
        };
    });

    // Ordenar por ganho de ELO decrescente
    teamsWithGain.sort((a, b) => b.gain - a.gain);

    // Pegar top 3 com maior ganho
    const top3Sensation = teamsWithGain.slice(0, 3).map(t => t.name);

    DebugUtils.debugBracket('sensation_teams', {
        teams: top3Sensation,
        details: teamsWithGain.slice(0, 3)
    });

    setActiveTeams(top3Sensation);
}

// Resetar filtro -> ativa todas as equipas
function resetFilter() {
    const checkboxes = document.querySelectorAll('#teamSelector input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        const label = checkbox.parentElement;
        checkbox.checked = true;
        label.classList.add('active');
    });
    updateEloChart();
}

// Configuração dos cursos carregada de ficheiro externo
let coursesConfig = {};

/**
 * Carrega a configuração dos cursos do ficheiro JSON
 */
async function loadCoursesConfig() {
    try {
        const response = await fetch('config_cursos.json');
        if (!response.ok) {
            throw new Error('Erro ao carregar config_cursos.json');
        }
        const data = await response.json();
        coursesConfig = data.courses;
        DebugUtils.debugFileLoading('courses_loaded', { count: Object.keys(coursesConfig).length });
    } catch (error) {
        console.error('Erro ao carregar configuração de cursos:', error);
    }
}

/**
 * Normaliza texto removendo acentos e convertendo para minúsculas
 */
function normalizeText(text) {
    return text.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

/**
 * Normaliza nomes de equipas para resolver duplicações
 */
// Parsear data sem problemas de timezone
// Formato esperado: "2025-10-27 00:00:00" ou "2025-10-27"
function parseDate(dateStr) {
    if (!dateStr) return null;

    // Parsear manualmente para evitar problemas de timezone
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, year, month, day] = match;
        // Criar data local diretamente sem conversões de timezone
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Fallback para Date normal se não conseguir parsear
    return new Date(dateStr);
}

function parseDateWithTime(dateStr, timeStr) {
    if (!dateStr) return null;

    // Parsear data
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) return parseDate(dateStr);

    const [, year, month, day] = dateMatch;

    // Parsear hora (formato: "10h15" ou "23h15")
    let hours = 0, minutes = 0;
    if (timeStr) {
        const timeMatch = timeStr.match(/(\d+)h(\d+)/);
        if (timeMatch) {
            hours = parseInt(timeMatch[1]);
            minutes = parseInt(timeMatch[2]);
        }
    }

    // Criar data com hora incluída
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes);
}

function normalizeTeamName(teamName) {
    if (!teamName) return teamName;

    let normalized = teamName.trim();

    // Casos específicos conhecidos de typos
    if (normalized === 'Traduçao' || normalized === 'TRADUÇÃO' || normalized === 'TRADUÇAO' ||
        normalized.toLowerCase() === 'tradução' || normalized.toLowerCase() === 'traduçao') {
        normalized = 'Tradução';
    }

    // Corrigir typo conhecido
    if (normalized === 'Edcucação Básica') {
        normalized = 'Educação Básica';
    }

    // Typos da época 24_25 (ficheiros antigos)
    if (normalized === 'Eng. Civil') {
        normalized = 'Eng. Cívil';
    }
    if (normalized === 'Eng. Materias') {
        normalized = 'Eng. Materiais';
    }
    if (normalized === 'Educaçao Básica') {
        normalized = 'Educação Básica';
    }

    // Normalização adicional removendo acentos
    const withoutAccents = normalizeText(normalized);
    if (withoutAccents === 'traducao') {
        normalized = 'Tradução';
    }

    return normalized;
}        /**
         * Obtém as informações de um curso pelo nome
         * @param {string} courseName Nome do curso
         * @returns {object} Informações do curso (nome completo, núcleo, emblema, cores)
         */
function getCourseInfo(courseName) {
    let courseKey = courseName.trim();

    // Normalização específica para cursos com variações de grafia
    if (courseKey === 'Traduçao' || courseKey === 'TRADUÇÃO' || courseKey === 'TRADUÇAO' ||
        courseKey.toLowerCase() === 'tradução' || courseKey.toLowerCase() === 'traduçao') {
        courseKey = 'Tradução';
    }

    // Normalização adicional para casos de variações de acentos
    const normalizedInput = normalizeText(courseKey);
    if (normalizedInput === 'traducao') {
        courseKey = 'Tradução';
    }

    // CORRIGIDO: Acessar coursesConfig.courses ao invés de coursesConfig diretamente
    const courseInfo = coursesConfig.courses ? coursesConfig.courses[courseKey] : coursesConfig[courseKey];

    if (courseInfo) {
        return {
            shortName: courseKey,
            fullName: courseInfo.displayName || courseKey,
            nucleus: courseInfo.nucleus,
            emblemPath: courseInfo.emblem,
            colors: courseInfo.colors, // Retornar o array completo
            primaryColor: courseInfo.colors[0],
            secondaryColor: courseInfo.colors[1]
        };
    }

    // Fallback para cursos não configurados - usar emblema padrão da UA
    return {
        shortName: courseKey,
        fullName: courseKey,
        nucleus: 'UA',
        emblemPath: 'assets/taça_ua.png',
        primaryColor: generateFallbackColor(courseKey),
        secondaryColor: generateFallbackColor(courseKey, true)
    };
}

/**
 * Gera uma cor baseada no hash do nome do curso
 * @param {string} courseName Nome do curso
 * @param {boolean} lighter Se deve gerar uma cor mais clara
 * @returns {string} Cor em formato hex
 */
function generateFallbackColor(courseName, lighter = false) {
    let hash = 0;
    for (let i = 0; i < courseName.length; i++) {
        hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;
    const saturation = lighter ? 50 : 70;
    const lightness = lighter ? 70 : 50;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Obtém todas as configurações de cursos
 * @returns {object} Objeto com todas as configurações de cursos
 */
function getAllCoursesConfig() {
    return coursesConfig;
}

// ==================== ESTADO CENTRALIZADO DA APLICAÇÃO ====================
const appState = {
    // Estado do gráfico ELO
    chart: {
        instance: null,
        pan: {
            enabled: false,
            isPanning: false,
            startX: 0,
            startY: 0
        }
    },

    // Estado da visualização atual
    view: {
        division: 'A',
        group: null,
        hasAdjustments: false
    },

    // Estado do calendário
    calendar: {
        jornada: null,
        division: null,
        group: null
    },

    // Dados carregados
    data: {
        teams: [],
        rankings: {},
        eloHistory: {},
        matches: [],
        bracket: {},
        secondaryBracket: {},
        secondaryBracketType: null,
        gamesDates: [],
        rawEloData: []
    },

    // Seleção atual
    selection: {
        epoca: null,
        modalidade: null,
        availableEpocas: [],
        playoffSystemInfo: {}
    }
};

// ==================== COMPATIBILIDADE COM CÓDIGO LEGADO ====================
// Proxies para sincronizar variáveis antigas com appState

// Proxy para sampleData
let sampleData = new Proxy(appState.data, {
    get(target, prop) {
        return target[prop];
    },
    set(target, prop, value) {
        target[prop] = value;
        return true;
    }
});

// Getters/Setters para variáveis de seleção
Object.defineProperty(window, 'currentEpoca', {
    get: () => appState.selection.epoca,
    set: (value) => { appState.selection.epoca = value; }
});

Object.defineProperty(window, 'currentModalidade', {
    get: () => appState.selection.modalidade,
    set: (value) => { appState.selection.modalidade = value; }
});

Object.defineProperty(window, 'availableEpocas', {
    get: () => appState.selection.availableEpocas,
    set: (value) => { appState.selection.availableEpocas = value; }
});

Object.defineProperty(window, 'playoffSystemInfo', {
    get: () => appState.selection.playoffSystemInfo,
    set: (value) => { appState.selection.playoffSystemInfo = value; }
});

// Getters/Setters para variáveis do calendário
Object.defineProperty(window, 'currentCalendarJornada', {
    get: () => appState.calendar.jornada,
    set: (value) => { appState.calendar.jornada = value; }
});

Object.defineProperty(window, 'currentCalendarDivision', {
    get: () => appState.calendar.division,
    set: (value) => { appState.calendar.division = value; }
});

Object.defineProperty(window, 'currentCalendarGroup', {
    get: () => appState.calendar.group,
    set: (value) => { appState.calendar.group = value; }
});

// Getters/Setters para variáveis de visualização
Object.defineProperty(window, 'currentDivision', {
    get: () => appState.view.division,
    set: (value) => { appState.view.division = value; }
});

Object.defineProperty(window, 'currentGroup', {
    get: () => appState.view.group,
    set: (value) => { appState.view.group = value; }
});

Object.defineProperty(window, 'currentModalityHasAdjustments', {
    get: () => appState.view.hasAdjustments,
    set: (value) => { appState.view.hasAdjustments = value; }
});

// Getters/Setters para variáveis do gráfico
Object.defineProperty(window, 'eloChart', {
    get: () => appState.chart.instance,
    set: (value) => { appState.chart.instance = value; }
});

// Função para detectar épocas disponíveis baseadas nos arquivos existentes
async function detectAvailableEpocas() {
    // Épocas conhecidas (não fazer requests para épocas futuras)
    const knownEpocas = ['24_25', '25_26'];

    // Ordenar épocas por ano (mais recente primeiro)
    const sortedEpocas = knownEpocas.sort((a, b) => {
        const [yearA] = a.split('_').map(n => parseInt(n));
        const [yearB] = b.split('_').map(n => parseInt(n));
        return yearB - yearA; // Ordem decrescente
    });

    DebugUtils.debugFileLoading('epochs_detected', { epochs: sortedEpocas });
    return sortedEpocas;
}

// Função para obter modalidades disponíveis para uma época específica
function getModalidadesForEpoca(epoca) {
    const modalidades = [
        { value: 'ANDEBOL MISTO', label: 'Andebol Misto' },
        { value: 'BASQUETEBOL FEMININO', label: 'Basquetebol Feminino' },
        { value: 'BASQUETEBOL MASCULINO', label: 'Basquetebol Masculino' },
        { value: 'FUTEBOL DE 7 MASCULINO', label: 'Futebol 7 Masculino' },
        { value: 'FUTSAL FEMININO', label: 'Futsal Feminino' },
        { value: 'FUTSAL MASCULINO', label: 'Futsal Masculino' },
        { value: 'VOLEIBOL FEMININO', label: 'Voleibol Feminino' },
        { value: 'VOLEIBOL MASCULINO', label: 'Voleibol Masculino' }
    ];

    // Adicionar a época ao final de cada modalidade
    return modalidades.map(mod => ({
        value: `${mod.value}_${epoca}`,
        label: mod.label
    }));
}

// Função para inicializar os seletores
async function initializeSelectors() {
    // Detectar épocas disponíveis
    availableEpocas = await detectAvailableEpocas();

    // Definir época atual como a mais recente (primeira do array ordenado)
    if (!currentEpoca && availableEpocas.length > 0) {
        currentEpoca = availableEpocas[0];
        DebugUtils.debugFileLoading('default_epoch_set', { epoch: currentEpoca });
    }

    // Preencher seletor de época
    const epocaSelect = document.getElementById('epoca');
    epocaSelect.innerHTML = '';

    availableEpocas.forEach(epoca => {
        const option = document.createElement('option');
        option.value = epoca;
        option.textContent = `20${epoca.replace('_', '/')}`; // Converter 24_25 para 2024/25
        if (epoca === currentEpoca) {
            option.selected = true;
        }
        epocaSelect.appendChild(option);
    });

    // Preencher seletor de modalidade
    updateModalidadeSelector();
}

// Função para atualizar o seletor de modalidade baseado na época
function updateModalidadeSelector() {
    const modalidadeSelect = document.getElementById('modalidade');
    modalidadeSelect.innerHTML = '';

    const modalidades = getModalidadesForEpoca(currentEpoca);

    // Tentar preservar modalidade atual se existir na nova época
    let modalidadeToLoad = null;

    // Extrair o nome da modalidade atual sem a época (ex: "FUTSAL MASCULINO_25_26" -> "FUTSAL MASCULINO")
    let currentModalidadeName = null;
    if (currentModalidade) {
        currentModalidadeName = currentModalidade.replace(/_\d{2}_\d{2}$/, '');
    }

    modalidades.forEach((mod, index) => {
        const option = document.createElement('option');
        option.value = mod.value;
        option.textContent = mod.label;

        // Verificar se esta modalidade corresponde à atual
        const modName = mod.value.replace(/_\d{2}_\d{2}$/, '');

        if (currentModalidadeName && modName === currentModalidadeName) {
            // Preservar modalidade atual se existir na nova época
            option.selected = true;
            modalidadeToLoad = mod.value;
        } else if (!modalidadeToLoad && mod.value.includes('FUTSAL MASCULINO')) {
            // Usar Futsal Masculino como fallback
            option.selected = true;
            modalidadeToLoad = mod.value;
        }

        modalidadeSelect.appendChild(option);
    });

    // Carregar a modalidade selecionada
    if (modalidadeToLoad) {
        changeModalidade(modalidadeToLoad);
    }
}

// Função para trocar época
function changeEpoca(epoca) {
    if (!epoca || epoca === currentEpoca) return;

    currentEpoca = epoca;
    updateModalidadeSelector();
}

function changeModalidade(mod) {
    if (!mod) return;

    // Atualizar modalidade atual
    currentModalidade = mod;

    // Caminhos relativos
    const classificacaoPath = `elo_ratings/classificacao_${mod}.csv`;
    const detalhePath = `elo_ratings/detalhe_${mod}.csv`;
    const eloPath = `elo_ratings/elo_${mod}.csv`;
    const jogosPath = `csv_modalidades/${mod}.csv`;

    // Reset dos dados e variáveis globais
    sampleData = {
        teams: [],
        rankings: {},
        eloHistory: {},
        gameDetails: {},  // ← ADICIONADO para guardar detalhes de cada jogo (adversário, resultado, variação)
        roundMapping: [],  // ← ADICIONADO para mapear índice do gráfico -> jornada real
        matches: [],
        bracket: {},
        secondaryBracket: {},  // ← ADICIONADO para playoffs/liguilhas secundários
        secondaryBracketType: null,  // ← ADICIONADO para tipo do bracket secundário
        gamesDates: [],
        rawEloData: [],
        totalRegularSeasonGames: 0,  // ← ADICIONADO para número de jornadas do calendário
        teamsFromPreviousSeason: new Set()  // ← ADICIONADO para rastreamento de equipas da época anterior
    };
    currentModalityHasAdjustments = false;

    // Variáveis para guardar ELOs iniciais e equipas da época anterior
    let initialElosFromFile = {};
    let previousSeasonTeams = new Set();

    // Mostrar loading
    document.getElementById('teamSelector').innerHTML = '<div class="loading"><div class="spinner"></div>A carregar dados...</div>';
    document.getElementById('rankingsBody').innerHTML = '<tr><td colspan="11" class="loading">A carregar classificação...</td></tr>';

    let loadedFiles = 0;
    const totalFiles = 4; // Agora são 4 ficheiros

    function checkAllLoaded() {
        loadedFiles++;
        DebugUtils.debugFileLoading('file_loaded', { current: loadedFiles, total: totalFiles });
        if (loadedFiles === totalFiles) {
            DebugUtils.debugFileLoading('all_files_loaded', sampleData);
            // Todos os arquivos carregados, atualizar interface
            setTimeout(() => {
                createTeamSelector();
                createDivisionSelector();
                updateQuickFilters(); // Atualizar filtros baseados na estrutura
                updateRankingsTable();
                initializeCalendarSelectors(); // Inicializar calendário
                if (eloChart) {
                    updateEloChart();
                }
                // Brackets serão carregados depois de processar rankings

                // Disparar evento indicando que os dados foram carregados
                document.dispatchEvent(new CustomEvent('data:loaded'));
            }, 500);
        }
    }

    // Carregar CSVs
    Papa.parse(classificacaoPath, {
        download: true,
        header: true,
        complete: results => {
            processRankings(results.data);
            checkAllLoaded();
        },
        error: error => {
            console.error('Erro ao carregar classificação:', error);
            checkAllLoaded();
        }
    });

    Papa.parse(jogosPath, {
        download: true,
        header: true,
        complete: results => {
            processMatches(results.data);
            checkAllLoaded();
        },
        error: error => {
            console.error('Erro ao carregar jogos:', error);
            checkAllLoaded();
        }
    });

    // Carregar ficheiro elo_*.csv com ELOs iniciais PRIMEIRO
    Papa.parse(eloPath, {
        download: true,
        header: false, // Sem cabeçalho - primeira linha é nomes, segunda é valores
        complete: results => {
            if (results.data && results.data.length >= 2) {
                const teams = results.data[0]; // Primeira linha: nomes das equipas
                const elos = results.data[1];  // Segunda linha: valores ELO

                // Criar mapa equipa -> ELO inicial
                teams.forEach((team, index) => {
                    if (team && elos[index]) {
                        const normalizedTeam = normalizeTeamName(team);
                        initialElosFromFile[normalizedTeam] = parseFloat(elos[index]);
                    }
                });

                DebugUtils.debugFileLoading('initial_elos_loaded', initialElosFromFile);
            }

            // Agora carregar época ANTERIOR para saber quais equipas existiam
            const currentEpochElement = document.getElementById('epoca');
            const currentEpoch = currentEpochElement ? currentEpochElement.value : null;

            if (currentEpoch && availableEpocas && availableEpocas.length > 0) {
                const previousEpochIndex = availableEpocas.indexOf(currentEpoch) + 1;
                if (previousEpochIndex < availableEpocas.length) {
                    const previousEpoch = availableEpocas[previousEpochIndex];
                    const previousEloPath = `elo_ratings/elo_${mod.replace(currentEpoch, previousEpoch)}.csv`;

                    Papa.parse(previousEloPath, {
                        download: true,
                        header: false,
                        complete: prevResults => {
                            if (prevResults.data && prevResults.data.length >= 1) {
                                const prevTeams = prevResults.data[0];
                                prevTeams.forEach(team => {
                                    if (team) {
                                        previousSeasonTeams.add(normalizeTeamName(team));
                                    }
                                });
                            }
                            loadDetailFile();
                        },
                        error: () => {
                            // Se não conseguir carregar época anterior, continuar sem ela
                            loadDetailFile();
                        }
                    });
                } else {
                    loadDetailFile();
                }
            } else {
                loadDetailFile();
            }

            function loadDetailFile() {
                checkAllLoaded();

                // AGORA SIM carregar detalhe (só depois de ter os ELOs iniciais)
                // Adicionar timestamp para evitar cache
                const cacheBuster = '?t=' + Date.now();
                Papa.parse(detalhePath + cacheBuster, {
                    download: true,
                    header: true,
                    skipEmptyLines: true,
                    complete: results => {
                        processEloHistory(results.data, initialElosFromFile, previousSeasonTeams);
                        checkAllLoaded();
                    },
                    error: error => {
                        console.error('Erro ao carregar detalhes ELO:', error);
                        checkAllLoaded();
                    }
                });
            }
        },
        error: error => {
            console.error('Erro ao carregar ELOs iniciais:', error);
            checkAllLoaded();
        }
    });
}

// ========== FUNÇÕES DO CALENDÁRIO DE JOGOS ==========

// Variáveis globais para controle do calendário
let availableJornadas = [];

// Inicializar seletores do calendário
function initializeCalendarSelectors() {
    const jornadaTitle = document.getElementById('jornadaTitle');
    const prevBtn = document.getElementById('prevJornadaBtn');
    const nextBtn = document.getElementById('nextJornadaBtn');
    const divisionSelectorDiv = document.getElementById('calendarDivisionSelector');
    const groupSelectorDiv = document.getElementById('calendarGroupSelector');            // Guardar jornada atual antes de limpar
    const previousJornada = currentCalendarJornada;

    // Limpar seletores
    divisionSelectorDiv.innerHTML = '';
    groupSelectorDiv.innerHTML = '';

    // Verificar se há jogos disponíveis (usar matches, não rawEloData)
    if (!sampleData.matches || sampleData.matches.length === 0) {
        jornadaTitle.textContent = 'Sem jogos disponíveis';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        divisionSelectorDiv.style.display = 'none';
        groupSelectorDiv.style.display = 'none';
        return;
    }

    // Verificar se há divisões/grupos nos dados dos jogos
    const hasDivisions = sampleData.rankings && Object.keys(sampleData.rankings).length > 0;
    const structure = analyzeModalityStructure();

    // Criar seletores IGUAIS à classificação
    if (hasDivisions && structure.type !== 'single-league') {
        createCalendarDivisionSelector();
    } else {
        divisionSelectorDiv.style.display = 'none';
        currentCalendarDivision = null;
    }

    // Não há seletor de grupo separado - já está incluído na divisão ("2ª Divisão - Grupo A")
    groupSelectorDiv.style.display = 'none';
    currentCalendarGroup = null;

    // Atualizar jornadas disponíveis para a divisão/grupo atual
    updateAvailableJornadas();

    // Selecionar a jornada mais recente com jogos realizados
    if (availableJornadas.length > 0) {
        currentCalendarJornada = getCurrentJornada();
        updateJornadaDisplay();
    } else {
        jornadaTitle.textContent = 'Sem jornadas disponíveis';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    }

    // Atualizar calendário com a jornada selecionada
    updateCalendar();

    // Garantir que os botões da classificação estejam sincronizados visualmente
    updateRankingsDivisionButtons();
    if (currentGroup) {
        updateRankingsGroupButtons();
    }
}

// Atualizar jornadas disponíveis para divisão/grupo atual
function updateAvailableJornadas() {
    // Extrair divisão numérica e grupo do label formatado
    let targetDivision = null;
    let targetGroup = null;

    if (currentCalendarDivision) {
        const divMatch = currentCalendarDivision.match(/^(\d+)ª Divisão(?:\s*-\s*Grupo\s*([A-Z]))?$/);
        if (divMatch) {
            targetDivision = divMatch[1]; // "1" ou "2"
            targetGroup = divMatch[2] || null; // "A", "B", "C" ou null
        }
    }

    // Filtrar jornadas para a divisão/grupo atual
    let filteredMatches = sampleData.matches.filter(match => {
        if (!match.jornada || isNaN(parseInt(match.jornada))) return false;

        // Se há divisão selecionada, filtrar por ela
        if (targetDivision) {
            const matchDiv = match.division ? match.division.toString() : null;
            const matchGroup = match.grupo || null;

            // Comparar divisão
            const divMatch = matchDiv && (matchDiv == targetDivision ||
                parseFloat(matchDiv) == parseFloat(targetDivision));
            if (!divMatch) return false;

            // Se tem grupo no label, filtrar por grupo também
            if (targetGroup && matchGroup !== targetGroup) return false;
        }

        return true;
    });

    // Obter jornadas únicas e ordenadas
    availableJornadas = [...new Set(
        filteredMatches.map(match => parseInt(match.jornada))
    )].sort((a, b) => a - b);
}        // Encontrar a jornada mais recente com pelo menos um jogo realizado
function getCurrentJornada() {
    if (availableJornadas.length === 0) return null;

    // Extrair divisão e grupo atuais
    let targetDivision = null;
    let targetGroup = null;

    if (currentCalendarDivision) {
        const divMatch = currentCalendarDivision.match(/^(\d+)ª Divisão(?:\s*-\s*Grupo\s*([A-Z]))?$/);
        if (divMatch) {
            targetDivision = divMatch[1];
            targetGroup = divMatch[2] || null;
        }
    }

    // Pré-filtrar jogos uma única vez por divisão/grupo (O(n))
    const filteredMatches = sampleData.matches.filter(match => {
        // Filtrar por divisão/grupo se necessário
        if (targetDivision) {
            const matchDiv = match.division ? match.division.toString() : null;
            const matchGroup = match.grupo || null;

            const divMatch = matchDiv && (matchDiv == targetDivision ||
                parseFloat(matchDiv) == parseFloat(targetDivision));
            if (!divMatch) return false;

            if (targetGroup && matchGroup !== targetGroup) return false;
        }

        return true;
    });

    // Construir lookup: jornada -> tem jogos realizados (O(n))
    const jornadaHasPlayedGames = new Map();

    for (const match of filteredMatches) {
        const jornada = parseInt(match.jornada);
        if (isNaN(jornada)) continue;

        // Verificar se já encontramos um jogo realizado nesta jornada
        if (!jornadaHasPlayedGames.has(jornada)) {
            jornadaHasPlayedGames.set(jornada, false);
        }

        // Verificar se este jogo tem resultado
        if (!jornadaHasPlayedGames.get(jornada)) {
            const hasScore = match.score1 != null && match.score1 !== '' &&
                match.score2 != null && match.score2 !== '';
            if (hasScore) {
                jornadaHasPlayedGames.set(jornada, true);
            }
        }
    }

    // Iterar jornadas da mais recente para a mais antiga (O(m))
    for (let i = availableJornadas.length - 1; i >= 0; i--) {
        const jornada = availableJornadas[i];

        if (jornadaHasPlayedGames.get(jornada) === true) {
            return jornada;
        }
    }

    // Se nenhuma jornada tem jogos realizados, retornar a primeira
    return availableJornadas[0];
}

// Criar seletor de divisão (IGUAL à classificação - usa sampleData.rankings)
function createCalendarDivisionSelector() {
    const divisionSelectorDiv = document.getElementById('calendarDivisionSelector');

    if (!sampleData.rankings || Object.keys(sampleData.rankings).length === 0) {
        divisionSelectorDiv.style.display = 'none';
        return;
    }

    const structure = analyzeModalityStructure();
    const divisions = Object.keys(sampleData.rankings); // Labels formatados: "1ª Divisão", "2ª Divisão - Grupo A"

    // Se for liga única, ocultar o seletor
    if (structure.type === 'single-league') {
        divisionSelectorDiv.style.display = 'none';
        return;
    }

    divisionSelectorDiv.style.display = 'flex';
    divisionSelectorDiv.innerHTML = '';

    // Sincronizar com divisão atual da classificação ou usar primeira
    if (!currentCalendarDivision || !divisions.includes(currentCalendarDivision)) {
        currentCalendarDivision = currentDivision || divisions[0];
    }

    divisions.forEach(div => {
        const btn = document.createElement('button');
        btn.className = `division-btn ${div === currentCalendarDivision ? 'active' : ''}`;
        btn.textContent = div; // Label já vem formatado: "1ª Divisão" ou "2ª Divisão - Grupo A"
        btn.onclick = () => switchCalendarDivision(div);
        divisionSelectorDiv.appendChild(btn);
    });
}

// Criar seletor de grupo (IGUAL à classificação - usa sampleData.rankings)
function createCalendarGroupSelector() {
    const groupSelectorDiv = document.getElementById('calendarGroupSelector');

    if (!sampleData.rankings || !sampleData.rankings[currentCalendarDivision]) {
        groupSelectorDiv.style.display = 'none';
        return;
    }

    // Obter grupos únicos para a divisão atual
    const teams = sampleData.rankings[currentCalendarDivision];
    const groups = [...new Set(teams.map(team => team.group))].filter(group => group && group !== 'nan');

    if (groups.length <= 1) {
        groupSelectorDiv.style.display = 'none';
        currentCalendarGroup = null;
        return;
    }

    // Mostrar seletor de grupos se há múltiplos grupos
    groupSelectorDiv.style.display = 'flex';
    groupSelectorDiv.innerHTML = '';

    // Sincronizar com grupo da classificação, ou usar Grupo A, ou primeiro disponível
    if (currentCalendarGroup === null || !groups.includes(currentCalendarGroup)) {
        // Tentar usar grupo atual da classificação
        if (currentGroup && groups.includes(currentGroup)) {
            currentCalendarGroup = currentGroup;
        } else if (groups.includes('A')) {
            currentCalendarGroup = 'A';
        } else {
            currentCalendarGroup = groups[0];
        }
    }

    // Botões de grupos específicos
    groups.forEach(group => {
        const btn = document.createElement('button');
        btn.className = `group-btn ${group === currentCalendarGroup ? 'active' : ''}`;
        btn.textContent = `Grupo ${group}`;
        btn.onclick = () => switchCalendarGroup(group);
        groupSelectorDiv.appendChild(btn);
    });
}

// Trocar divisão no calendário
function switchCalendarDivision(division) {
    currentCalendarDivision = division;

    // Atualizar botões de divisão do calendário
    document.querySelectorAll('#calendarDivisionSelector .division-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Sincronizar com a classificação
    currentDivision = division;
    currentGroup = null; // Reset group quando muda divisão
    appState.view.division = division;
    appState.view.group = null;

    // Atualizar botões da classificação
    divisionSelector.setActive(division);
    groupSelector.render();
    updateRankingsTable();

    // Atualizar seletor de grupo do calendário
    createCalendarGroupSelector();

    // Atualizar jornadas disponíveis para nova divisão/grupo
    updateAvailableJornadas();

    // Selecionar a jornada mais recente com jogos realizados
    if (availableJornadas.length > 0) {
        if (!availableJornadas.includes(currentCalendarJornada)) {
            // Se a jornada atual não existe nesta divisão, ir para a jornada atual desta divisão
            currentCalendarJornada = getCurrentJornada();
        }
        updateJornadaDisplay();
    } else {
        currentCalendarJornada = null;
    }

    // Atualizar calendário
    updateCalendar();
}

// Trocar grupo no calendário (não usado - grupos integrados na divisão)
function switchCalendarGroup(group) {
    currentCalendarGroup = group;

    // Atualizar botões de grupo do calendário
    document.querySelectorAll('#calendarGroupSelector .group-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Sincronizar com a classificação
    currentGroup = group;
    appState.view.group = group;

    // Atualizar botões da classificação
    groupSelector.setActive(group ? `Grupo ${group}` : '');
    updateRankingsTable();

    // Atualizar jornadas disponíveis para novo grupo
    updateAvailableJornadas();

    // Selecionar a jornada mais recente com jogos realizados
    if (availableJornadas.length > 0) {
        if (!availableJornadas.includes(currentCalendarJornada)) {
            // Se a jornada atual não existe neste grupo, ir para a jornada atual deste grupo
            currentCalendarJornada = getCurrentJornada();
        }
        updateJornadaDisplay();
    } else {
        currentCalendarJornada = null;
    }

    // Atualizar calendário
    updateCalendar();
}        // Mudar jornada (navegação com setas)
function changeJornada(direction) {
    if (availableJornadas.length === 0) return;

    const currentIndex = availableJornadas.indexOf(currentCalendarJornada);
    const newIndex = currentIndex + direction;

    // Se está dentro do range de jornadas, navegar normalmente
    if (newIndex >= 0 && newIndex < availableJornadas.length) {
        currentCalendarJornada = availableJornadas[newIndex];
        updateJornadaDisplay();
        updateCalendar();
    }
    // Se chegou ao limite, verificar se pode mudar de época
    else if (newIndex < 0) {
        // Tentar ir para época anterior
        switchToPreviousEpoca();
    } else if (newIndex >= availableJornadas.length) {
        // Tentar ir para próxima época
        switchToNextEpoca();
    }
}

// Mudar para época anterior (última jornada)
function switchToPreviousEpoca() {
    const currentEpochElement = document.getElementById('epoca');
    if (!currentEpochElement) return;

    const currentEpoch = currentEpochElement.value;
    const currentIndex = availableEpocas.indexOf(currentEpoch);

    // availableEpocas está em ordem decrescente: ['25_26', '24_25']
    // época anterior é o próximo índice
    if (currentIndex < availableEpocas.length - 1) {
        const previousEpoch = availableEpocas[currentIndex + 1];

        // Atualizar o select de época
        currentEpochElement.value = previousEpoch;

        // Chamar changeEpoca para atualizar todos os dados
        changeEpoca(previousEpoch);

        // Aguardar carregamento dos dados via evento
        document.addEventListener('data:loaded', function updateJornadaAfterLoad() {
            if (availableJornadas.length > 0) {
                currentCalendarJornada = getCurrentJornada();
                updateJornadaDisplay();
                updateCalendar();
            }
        }, { once: true });
    }
}

// Mudar para próxima época (jornada atual)
function switchToNextEpoca() {
    const currentEpochElement = document.getElementById('epoca');
    if (!currentEpochElement) return;

    const currentEpoch = currentEpochElement.value;
    const currentIndex = availableEpocas.indexOf(currentEpoch);

    // availableEpocas está em ordem decrescente: ['25_26', '24_25']
    // próxima época é o índice anterior
    if (currentIndex > 0) {
        const nextEpoch = availableEpocas[currentIndex - 1];

        // Atualizar o select de época
        currentEpochElement.value = nextEpoch;

        // Chamar changeEpoca para atualizar todos os dados
        changeEpoca(nextEpoch);

        // Aguardar carregamento dos dados via evento
        document.addEventListener('data:loaded', function updateJornadaAfterLoad() {
            if (availableJornadas.length > 0) {
                currentCalendarJornada = getCurrentJornada();
                updateJornadaDisplay();
                updateCalendar();
            }
        }, { once: true });
    }
}

// Atualizar display da jornada e botões
function updateJornadaDisplay() {
    const jornadaTitle = document.getElementById('jornadaTitle');
    const prevBtn = document.getElementById('prevJornadaBtn');
    const nextBtn = document.getElementById('nextJornadaBtn');
    const prevEpocaLabel = document.getElementById('prevEpocaLabel');
    const nextEpocaLabel = document.getElementById('nextEpocaLabel');

    jornadaTitle.textContent = `Jornada ${currentCalendarJornada}`;

    const currentIndex = availableJornadas.indexOf(currentCalendarJornada);
    const isFirstJornada = currentIndex <= 0;
    const isLastJornada = currentIndex >= availableJornadas.length - 1;

    // Verificar se há épocas anteriores/seguintes disponíveis
    const currentEpochElement = document.getElementById('epoca');
    if (currentEpochElement) {
        const currentEpoch = currentEpochElement.value;
        const epochIndex = availableEpocas.indexOf(currentEpoch);

        // Época anterior (índice maior, pois está em ordem decrescente)
        const hasPreviousEpoca = epochIndex < availableEpocas.length - 1;
        const hasNextEpoca = epochIndex > 0;

        // Mostrar label de época anterior se estiver na primeira jornada
        if (isFirstJornada && hasPreviousEpoca) {
            prevBtn.disabled = false;
            const prevEpoca = availableEpocas[epochIndex + 1];
            const prevEpocaFormatted = prevEpoca.replace('_', '/');
            prevEpocaLabel.textContent = `← ${prevEpocaFormatted}`;
            prevEpocaLabel.style.display = 'block';
            prevEpocaLabel.onclick = () => switchToPreviousEpoca();
        } else {
            prevBtn.disabled = isFirstJornada;
            prevEpocaLabel.style.display = 'none';
        }

        // Mostrar label de próxima época se estiver na última jornada
        if (isLastJornada && hasNextEpoca) {
            nextBtn.disabled = false;
            const nextEpoca = availableEpocas[epochIndex - 1];
            const nextEpocaFormatted = nextEpoca.replace('_', '/');
            nextEpocaLabel.textContent = `${nextEpocaFormatted} →`;
            nextEpocaLabel.style.display = 'block';
            nextEpocaLabel.onclick = () => switchToNextEpoca();
        } else {
            nextBtn.disabled = isLastJornada;
            nextEpocaLabel.style.display = 'none';
        }
    } else {
        prevBtn.disabled = isFirstJornada;
        nextBtn.disabled = isLastJornada;
        prevEpocaLabel.style.display = 'none';
        nextEpocaLabel.style.display = 'none';
    }
}

// Atualizar calendário de jogos
function updateCalendar() {
    const gamesList = document.getElementById('gamesList');

    if (!currentCalendarJornada) {
        gamesList.innerHTML = '<div class="no-games-message">Selecione uma jornada para ver os jogos</div>';
        return;
    }

    // Extrair divisão numérica e grupo do label formatado
    // Ex: "1ª Divisão" -> div=1, group=null
    // Ex: "2ª Divisão - Grupo A" -> div=2, group="A"
    let targetDivision = null;
    let targetGroup = null;

    if (currentCalendarDivision) {
        const divMatch = currentCalendarDivision.match(/^(\d+)ª Divisão(?:\s*-\s*Grupo\s*([A-Z]))?$/);
        if (divMatch) {
            targetDivision = divMatch[1]; // "1" ou "2"
            targetGroup = divMatch[2] || null; // "A", "B", "C" ou null
        }
    }

    // Usar dados do calendário (csv_modalidades) que tem TODOS os jogos (realizados e futuros)
    let games = sampleData.matches.filter(match => {
        const jornada = parseInt(match.jornada);
        const matchDiv = match.division ? match.division.toString() : null;
        const matchGroup = match.grupo || null;

        // Filtrar por jornada
        if (jornada !== currentCalendarJornada) return false;

        // Filtrar por divisão e grupo se selecionados
        if (targetDivision) {
            // Comparar divisão (pode ser "2" ou "2.0")
            const divMatch = matchDiv && (matchDiv == targetDivision ||
                parseFloat(matchDiv) == parseFloat(targetDivision));
            if (!divMatch) return false;

            // Se tem grupo no label, filtrar por grupo também
            if (targetGroup) {
                if (matchGroup !== targetGroup) return false;
            }
        }

        return true;
    });

    if (games.length === 0) {
        gamesList.innerHTML = '<div class="no-games-message">Nenhum jogo encontrado para esta jornada</div>';
        return;
    }

    // Para cada jogo do calendário, buscar info de ELO do rawEloData
    games = games.map(game => {
        // Procurar jogo correspondente no rawEloData para pegar info de ELO
        const eloMatch = sampleData.rawEloData ? sampleData.rawEloData.find(m =>
            m.Jornada == game.jornada &&
            normalizeTeamName(m['Equipa 1']) === normalizeTeamName(game.team1) &&
            normalizeTeamName(m['Equipa 2']) === normalizeTeamName(game.team2)
        ) : null;

        return {
            ...game,
            eloDelta1: eloMatch ? eloMatch['Elo Delta 1'] : null,
            eloDelta2: eloMatch ? eloMatch['Elo Delta 2'] : null
        };
    });

    // Renderizar jogos
    gamesList.innerHTML = '';
    games.forEach(game => {
        const gameItem = createGameItem(game);
        gamesList.appendChild(gameItem);
    });
}

// Criar elemento HTML de um jogo
function createGameItem(game) {
    const div = document.createElement('div');

    // Suportar tanto estrutura de rawEloData quanto de matches
    const team1 = normalizeTeamName(game.team1 || game['Equipa 1']);
    const team2 = normalizeTeamName(game.team2 || game['Equipa 2']);

    // Obter resultados
    const result1 = game.score1 !== undefined && game.score1 !== null ? game.score1 :
        (game['Resultado 1'] || game['Golos 1'] || game['Golos Equipa 1'] || null);
    const result2 = game.score2 !== undefined && game.score2 !== null ? game.score2 :
        (game['Resultado 2'] || game['Golos 2'] || game['Golos Equipa 2'] || null);

    // Verificar se jogo foi realizado (resultado pode ser 0, então usar null check)
    const hasResult = (result1 !== null && result1 !== undefined && result1 !== '') &&
        (result2 !== null && result2 !== undefined && result2 !== '');

    // Data e hora do jogo
    const gameDate = game.date || game.Data || game.Dia || '';
    const gameTime = game.time || game.Hora || '';
    const hasDate = gameDate && gameDate !== '';

    div.className = `game-item ${hasResult ? 'played' : 'not-played'}`;

    // Obter informações das equipas
    const team1Info = getCourseInfo(team1);
    const team2Info = getCourseInfo(team2);

    // Data e hora do jogo formatadas
    let dateStr = '';
    if (hasDate) {
        dateStr = formatGameDate(gameDate);
        if (gameTime) {
            dateStr += ` • ${gameTime}`;
        }
    }

    // Resultado
    let scoreHtml = '';
    if (hasResult) {
        scoreHtml = `<div class="game-score">${result1} - ${result2}</div>`;
    } else {
        scoreHtml = '<div class="game-vs">vs</div>';
    }

    // Mudanças de ELO (só aparece se jogo foi realizado)
    const elo1Delta = game.eloDelta1 ? parseInt(game.eloDelta1) :
        (game['Elo Delta 1'] ? parseInt(game['Elo Delta 1']) : 0);
    const elo2Delta = game.eloDelta2 ? parseInt(game.eloDelta2) :
        (game['Elo Delta 2'] ? parseInt(game['Elo Delta 2']) : 0);

    const elo1Html = hasResult && elo1Delta !== 0 ?
        `<span class="game-elo-change ${elo1Delta > 0 ? 'positive' : 'negative'}">${elo1Delta > 0 ? '+' : ''}${elo1Delta}</span>` : '';
    const elo2Html = hasResult && elo2Delta !== 0 ?
        `<span class="game-elo-change ${elo2Delta > 0 ? 'positive' : 'negative'}">${elo2Delta > 0 ? '+' : ''}${elo2Delta}</span>` : '';

    // Emblemas
    const emblem1Html = team1Info.emblemPath ?
        `<img src="${team1Info.emblemPath}" class="game-team-emblem" alt="${team1}" onerror="this.style.display='none'">` : '';
    const emblem2Html = team2Info.emblemPath ?
        `<img src="${team2Info.emblemPath}" class="game-team-emblem" alt="${team2}" onerror="this.style.display='none'">` : '';

    div.innerHTML = `
                <div class="game-date">${dateStr}</div>
                <div class="game-teams">
                    <div class="game-team home">
                        ${elo1Html}
                        ${emblem1Html}
                        <span class="game-team-name">${team1}</span>
                    </div>
                    ${scoreHtml}
                    <div class="game-team away">
                        <span class="game-team-name">${team2}</span>
                        ${emblem2Html}
                        ${elo2Html}
                    </div>
                </div>
            `;

    return div;
}

// Formatar data do jogo
function formatGameDate(dateStr) {
    if (!dateStr) return '';

    // Parsear manualmente para evitar problemas de timezone
    // Formato esperado: "2025-10-27 00:00:00" ou "2025-10-27"
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
        const [, year, month, day] = dateMatch;
        return `${day}/${month}/${year}`;
    }

    // Fallback: tentar usar Date se não conseguir parsear manualmente
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr; // Se não conseguir parsear, retorna string original

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}

// Sincronizar calendário quando divisão/grupo da classificação mudar
function syncCalendarWithRankings() {
    let divisionChanged = false;
    let groupChanged = false;

    // Sincronizar divisão do calendário com a classificação
    if (appState.view.division) {
        divisionChanged = appState.view.division !== currentCalendarDivision;

        currentCalendarDivision = appState.view.division;
        currentDivision = appState.view.division;

        if (divisionChanged) {
            // Atualizar botões de divisão do calendário
            document.querySelectorAll('#calendarDivisionSelector .division-btn').forEach(btn => {
                btn.classList.toggle('active', btn.textContent === appState.view.division);
            });

            // Atualizar seletor de grupo do calendário
            createCalendarGroupSelector();

            // Atualizar jornadas disponíveis
            updateAvailableJornadas();
        }
    }

    // Sincronizar grupo do calendário com a classificação (se aplicável)
    groupChanged = appState.view.group !== currentCalendarGroup;

    currentCalendarGroup = appState.view.group;
    currentGroup = appState.view.group;

    if (groupChanged) {
        // Atualizar botões de grupo do calendário
        document.querySelectorAll('#calendarGroupSelector .group-btn').forEach(btn => {
            const btnGroup = btn.dataset.group || '';
            const isActive = (appState.view.group === null && btnGroup === '') ||
                (btnGroup === appState.view.group);
            btn.classList.toggle('active', isActive);
        });

        // Atualizar jornadas disponíveis
        updateAvailableJornadas();
    }

    // Atualizar calendário sempre que houver mudança ou se já houver jornada selecionada
    if (divisionChanged || groupChanged || currentCalendarJornada) {
        updateCalendar();
    }
}

// ========== FIM DAS FUNÇÕES DO CALENDÁRIO ==========

// Funções processadoras (iguais às que já te preparei)
function processRankings(data) {
    DebugUtils.debugProcessedData('rankings', data.length, data[0]);

    data.forEach(row => {
        if (!row.Equipa) return;

        // Determinar a chave principal baseada em Divisão + Grupo
        let mainKey;
        let divisao = row.Divisao || row['Divisão'];
        let grupo = row.Grupo;

        // Tratar valores vazios ou nan
        if (!divisao || divisao === 'nan' || divisao === 'NaN' || divisao === '') {
            divisao = null;
        }
        if (!grupo || grupo === 'nan' || grupo === 'NaN' || grupo === '') {
            grupo = null;
        }

        // Determinar mainKey
        if (!divisao && !grupo) {
            // Liga única sem divisões nem grupos
            mainKey = 'geral';
        } else if (divisao && grupo) {
            // Tem divisão e grupo: "2ª Divisão - Grupo A"
            mainKey = `${divisao}ª Divisão - Grupo ${grupo}`;
        } else if (divisao) {
            // Só tem divisão: "1ª Divisão" ou "2ª Divisão"
            mainKey = `${divisao}ª Divisão`;
        } else {
            // Só tem grupo (caso raro)
            mainKey = `Grupo ${grupo}`;
        }

        DebugUtils.debugRankingsProcessing('processing_row', { team: row.Equipa, divisao, grupo, key: mainKey });

        // Obter informações do curso
        const normalizedTeamName = normalizeTeamName(row.Equipa);
        const courseInfo = getCourseInfo(normalizedTeamName);

        const team = {
            name: normalizedTeamName,
            division: divisao || mainKey,
            group: grupo,
            color: courseInfo.primaryColor,
            secondaryColor: courseInfo.secondaryColor,
            fullName: courseInfo.fullName,
            nucleus: courseInfo.nucleus,
            emblemPath: courseInfo.emblemPath
        };

        const existingTeam = sampleData.teams.find(t => t.name === team.name);
        if (!existingTeam) {
            sampleData.teams.push(team);
            sampleData.eloHistory[team.name] = [];
        } else {
            console.warn('⚠️ Equipa DUPLICADA detectada:', team.name, 'já existe em sampleData.teams');
        }

        if (!sampleData.rankings[mainKey]) sampleData.rankings[mainKey] = [];
        sampleData.rankings[mainKey].push({
            team: normalizedTeamName,
            points: parseInt(row.pontos) || 0,
            wins: parseInt(row.vitorias) || 0,
            draws: parseInt(row.empates) || 0,
            losses: parseInt(row.derrotas) || 0,
            noShows: parseInt(row.faltas_comparencia) || 0,
            goals: parseInt(row.golos_marcados) || 0,
            conceded: parseInt(row.golos_sofridos) || 0,
            group: grupo
        });
    });

    DebugUtils.debugRankingsProcessing('rankings_complete', { keys: Object.keys(sampleData.rankings), details: sampleData.rankings });

    DebugUtils.debugFileLoading('rankings_processed', sampleData.rankings);

    // Limpar cache de equipas qualificadas quando rankings mudam
    qualifiedTeamsCache = null;

    // Verificar duplicatas na lista de teams (apenas em modo debug)
    DebugUtils.debugFileLoading('teams_processed', sampleData.teams.length);

    // Carregar brackets depois de processar classificações
    // Isso garante que getQualifiedTeams() terá dados disponíveis
    setTimeout(() => {
        createRealBracket();
    }, 100);
}

function processMatches(data) {
    // Analisar sistema de playoff/liguilha ao processar os jogos
    analyzePlayoffSystem(data);

    data.forEach(row => {
        if (!row["Equipa 1"] || !row["Equipa 2"]) return;

        // Extrair golos (podem estar vazios para jogos futuros)
        const golos1 = row["Golos 1"];
        const golos2 = row["Golos 2"];

        sampleData.matches.push({
            jornada: row.Jornada,
            team1: row["Equipa 1"].trim(),
            team2: row["Equipa 2"].trim(),
            score1: golos1 !== '' && golos1 !== undefined ? parseInt(golos1) : null,
            score2: golos2 !== '' && golos2 !== undefined ? parseInt(golos2) : null,
            date: row.Dia || row.Data,
            time: row.Hora || '',
            division: row['Divisão'] || row.Divisao,
            grupo: row.Grupo
        });
    });
}        /**
         * Analisa os dados dos jogos para detectar o sistema de playoff/liguilha usado
         * Identifica se usa: playoffs (E*), playoff de manutenção (PM*), ou liguilha de manutenção (LM*)
         */
function analyzePlayoffSystem(matchesData) {
    const systems = {
        hasWinnerPlayoffs: false,    // E1, E2, E3L, E3
        hasMaintenancePlayoffs: false, // PM1, PM2
        hasMaintenanceLeague: false,   // LM1, LM2, LM3...
        hasPromotionSystem: false,     // Sistema de promoção direto
        divisions: new Set(),
        groups: new Set()
    };

    matchesData.forEach(row => {
        const jornada = (row.Jornada || '').toString().trim().toUpperCase();
        const divisao = row['Divisão'] || row['Divisao'];
        const grupo = row.Grupo;

        // Detectar divisões e grupos
        if (divisao) systems.divisions.add(divisao);
        if (grupo && grupo !== 'nan' && grupo !== 'NaN') systems.groups.add(grupo);

        // Detectar tipos de playoff/liguilha
        if (jornada.startsWith('E') && /^E\d/.test(jornada)) {
            systems.hasWinnerPlayoffs = true;
        } else if (jornada.startsWith('PM')) {
            systems.hasMaintenancePlayoffs = true;
        } else if (jornada.startsWith('LM')) {
            systems.hasMaintenanceLeague = true;
        }
    });

    // Determinar se há sistema de promoção baseado na estrutura
    systems.hasPromotionSystem = systems.divisions.size > 1;

    // Salvar informações globalmente
    playoffSystemInfo = {
        ...systems,
        divisions: Array.from(systems.divisions),
        groups: Array.from(systems.groups)
    };

    DebugUtils.debugRankingsProcessing('playoff_system_detected', playoffSystemInfo);
}

// Função auxiliar para verificar se existem ajustes intergrupos reais (não-zero)
function hasRealInterGroupAdjustments(teamInterGroupAdjustments, rawEloData = null) {
    // Método 1: Verificar através dos ajustes coletados
    const hasAdjustmentsFromTeamData = Object.values(teamInterGroupAdjustments).some(adjustments =>
        adjustments.some(adj => {
            // Verificar se há ajuste não-zero ou diferença significativa no ELO final
            const hasNonZeroAdjustment = adj.adjustment && adj.adjustment !== 0;
            const hasSignificantEloChange = adj.finalElo && adj.initialElo &&
                Math.abs(adj.finalElo - adj.initialElo) > 1; // Tolerância de 1 ponto
            return hasNonZeroAdjustment || hasSignificantEloChange;
        })
    );

    // Método 2: Verificar diretamente nos dados brutos se disponível
    let hasAdjustmentsFromRawData = false;
    if (rawEloData && rawEloData.length > 0) {
        hasAdjustmentsFromRawData = rawEloData.some(row => {
            // Verificar linhas "Inter-Group" com ajustes não-zero
            if (row.Jornada === "Inter-Group" && row["Equipa 1"]) {
                const adjustment = parseInt(row["Elo Delta 1"]) || 0;
                return adjustment !== 0;
            }
            // Verificar também ajustes nos jogos normais
            const interGroupAdj1 = parseInt(row["Inter Group Adjustment 1"]) || 0;
            const interGroupAdj2 = parseInt(row["Inter Group Adjustment 2"]) || 0;
            return interGroupAdj1 !== 0 || interGroupAdj2 !== 0;
        });
    }

    const result = hasAdjustmentsFromTeamData || hasAdjustmentsFromRawData;
    DebugUtils.debugProcessedData('ajustes intergrupos', result ? 1 : 0, {
        fromTeamData: hasAdjustmentsFromTeamData,
        fromRawData: hasAdjustmentsFromRawData,
        final: result
    });

    return result;
}

// ==================== PROCESSADOR DE HISTÓRICO ELO ====================

class EloHistoryProcessor {
    constructor() {
        this.teamEloByRound = {};
        this.teamInitialElo = {};
        this.gamesDates = {};
        this.gamesDatesList = {}; // Nova estrutura: array de datas por jornada
        this.teamInterGroupAdjustments = {};
        this.playoffGames = {};
        this.playoffDates = {};
        this.allDates = [];
        this.hasInterGroupAdjustments = false;
        this.teamsFromPreviousSeason = new Set(); // Novo: rastrear equipas da época anterior
    }

    /**
     * Cria chave de data timezone-safe usando data local (não UTC)
     * Formato: "yyyymmdd" (ex: "20251027")
     */
    _getLocalDateKey(date) {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    /**
     * Processa dados de histórico ELO
     */
    process(data, initialElosFromFile = {}, previousSeasonTeams = new Set()) {
        DebugUtils.debugProcessedData('histórico ELO', data.length, `${data.length} jogos`);

        // Guardar dados brutos para processamento do bracket
        sampleData.rawEloData = data;

        // Verificar se não há jogos
        if (this._hasNoGames(data, initialElosFromFile, previousSeasonTeams)) {
            return;
        }

        // Processar todos os jogos e extrair informações
        this._extractGameData(data, initialElosFromFile);

        // Organizar datas e ajustes
        this._organizeDatesAndAdjustments();

        // Construir histórico de ELO para cada equipa
        this._buildEloHistories(initialElosFromFile);

        // Salvar equipas da época anterior em sampleData
        sampleData.teamsFromPreviousSeason = this.teamsFromPreviousSeason;

        DebugUtils.debugEloHistoryFinal(sampleData.eloHistory);
    }            /**
             * Verifica se não há jogos para processar
             */
    _hasNoGames(data, initialElosFromFile, previousSeasonTeams) {
        const hasNoGames = !data || data.length === 0 ||
            (data.length === 1 && Object.values(data[0]).every(v => !v || v === ''));

        if (hasNoGames && Object.keys(initialElosFromFile).length > 0) {
            DebugUtils.debugProcessedData('sem jogos', Object.keys(initialElosFromFile).length, 'usar ELOs iniciais do ficheiro');

            Object.keys(initialElosFromFile).forEach(teamName => {
                const initialElo = initialElosFromFile[teamName];
                sampleData.eloHistory[teamName] = [initialElo];

                // Só adicionar ao Set se a equipa existia na época anterior
                if (previousSeasonTeams.has(teamName)) {
                    this.teamsFromPreviousSeason.add(teamName);
                }
            });

            // Salvar também no sampleData quando não há jogos
            sampleData.teamsFromPreviousSeason = this.teamsFromPreviousSeason;

            return true;
        }

        return false;
    }            /**
             * Extrai dados de jogos e ajustes intergrupos
             */
    _extractGameData(data, initialElosFromFile) {
        data.forEach(row => {
            // Processar ajustes intergrupos
            if (row.Jornada === "Inter-Group" && row["Equipa 1"]) {
                this._extractInterGroupAdjustment(row);
                return;
            }

            if (!row["Equipa 1"] || !row["Equipa 2"]) return;

            const round = row.Jornada;
            const team1 = normalizeTeamName(row["Equipa 1"]);
            const team2 = normalizeTeamName(row["Equipa 2"]);
            const finalElo1 = parseInt(row["Final Elo 1"]) || parseInt(row["Elo Depois 1"]) || null;
            const finalElo2 = parseInt(row["Final Elo 2"]) || parseInt(row["Elo Depois 2"]) || null;
            const initialElo1 = parseInt(row["Elo Antes 1"]) || null;
            const initialElo2 = parseInt(row["Elo Antes 2"]) || null;
            const gameDate = parseDateWithTime(row.Dia, row.Hora);

            // Guardar detalhes do jogo para o tooltip
            const eloDelta1 = parseInt(row["Elo Delta 1"]) || 0;
            const eloDelta2 = parseInt(row["Elo Delta 2"]) || 0;

            const golos1 = row["Golos 1"] !== undefined && row["Golos 1"] !== '' && row["Golos 1"] !== null && row["Golos 1"] !== '?' ? parseFloat(row["Golos 1"]) : null;
            const golos2 = row["Golos 2"] !== undefined && row["Golos 2"] !== '' && row["Golos 2"] !== null && row["Golos 2"] !== '?' ? parseFloat(row["Golos 2"]) : null;

            // Determinar resultado (V=Vitória, E=Empate, D=Derrota)
            let resultado1, resultado2;
            if (golos1 !== null && golos2 !== null) {
                if (golos1 > golos2) {
                    resultado1 = 'V';
                    resultado2 = 'D';
                } else if (golos1 < golos2) {
                    resultado1 = 'D';
                    resultado2 = 'V';
                } else {
                    resultado1 = 'E';
                    resultado2 = 'E';
                }
            } else {
                // Resultado desconhecido
                resultado1 = null;
                resultado2 = null;
            }

            // Inicializar estrutura de detalhes do jogo se não existir
            if (!sampleData.gameDetails[team1]) {
                sampleData.gameDetails[team1] = {};
            }
            if (!sampleData.gameDetails[team2]) {
                sampleData.gameDetails[team2] = {};
            }

            // Guardar detalhes para cada equipa
            sampleData.gameDetails[team1][round] = {
                opponent: team2,
                result: golos1 !== null && golos2 !== null ? `${golos1}-${golos2}` : null,
                eloDelta: eloDelta1,
                goalsFor: golos1,
                goalsAgainst: golos2,
                outcome: resultado1,  // V, E, D ou null se desconhecido
                date: gameDate,
                unknownResult: false  // Será marcado depois pela função markUnknownResultsFromCalendar
            };

            sampleData.gameDetails[team2][round] = {
                opponent: team1,
                result: golos1 !== null && golos2 !== null ? `${golos2}-${golos1}` : null,
                eloDelta: eloDelta2,
                goalsFor: golos2,
                goalsAgainst: golos1,
                outcome: resultado2,  // V, E, D ou null se desconhecido
                date: gameDate,
                unknownResult: false  // Será marcado depois pela função markUnknownResultsFromCalendar
            };

            // Verificar se equipas estavam na época anterior
            const wasInPreviousSeason1 = row["Was In Previous Season 1"];
            const wasInPreviousSeason2 = row["Was In Previous Season 2"];

            if (wasInPreviousSeason1 === true || wasInPreviousSeason1 === 'True' || wasInPreviousSeason1 === 'true') {
                this.teamsFromPreviousSeason.add(team1);
            }
            if (wasInPreviousSeason2 === true || wasInPreviousSeason2 === 'True' || wasInPreviousSeason2 === 'true') {
                this.teamsFromPreviousSeason.add(team2);
            }                    // Guardar ELO inicial
            this._setInitialElo(team1, initialElosFromFile[team1], initialElo1);
            this._setInitialElo(team2, initialElosFromFile[team2], initialElo2);

            // Processar ajustes intergrupos dos jogos normais
            this._processGameInterGroupAdjustments(row, team1, team2, round, gameDate);

            // Separar jornadas numéricas dos playoffs
            const roundNum = parseInt(round);
            if (!isNaN(roundNum)) {
                this._processRegularRound(roundNum, team1, team2, finalElo1, finalElo2, gameDate);
            } else if (round.startsWith('E')) {
                this._processPlayoffRound(round, team1, team2, finalElo1, finalElo2, gameDate);
            }
        });
    }

    /**
     * Extrai ajustes intergrupos especiais
     */
    _extractInterGroupAdjustment(row) {
        const teamName = normalizeTeamName(row["Equipa 1"]);
        const adjustment = parseInt(row["Elo Delta 1"]) || 0;
        const finalElo = parseInt(row["Final Elo 1"]) || parseInt(row["Elo Depois 1"]) || 0;

        if (adjustment !== 0) {
            if (!this.teamInterGroupAdjustments[teamName]) {
                this.teamInterGroupAdjustments[teamName] = [];
            }
            this.teamInterGroupAdjustments[teamName].push({
                round: "Inter-Group",
                adjustment: adjustment,
                finalElo: finalElo,
                date: null
            });

            // Guardar no gameDetails também para aparecer no tooltip
            if (!sampleData.gameDetails[teamName]) {
                sampleData.gameDetails[teamName] = {};
            }
            sampleData.gameDetails[teamName]["Inter-Group"] = {
                opponent: null,
                result: null,
                eloDelta: adjustment,
                isAdjustment: true
            };

            DebugUtils.debugInterGroupAdjustment(teamName, adjustment);
        }
    }

    /**
     * Define ELO inicial de uma equipa
     */
    _setInitialElo(teamName, fileElo, gameElo) {
        if (!this.teamInitialElo[teamName]) {
            this.teamInitialElo[teamName] = fileElo || gameElo || DEFAULT_ELO;
        }
    }

    /**
     * Processa ajustes intergrupos de jogos normais
     */
    _processGameInterGroupAdjustments(row, team1, team2, round, gameDate) {
        const interGroupAdj1 = parseInt(row["Inter Group Adjustment 1"]) || 0;
        const interGroupAdj2 = parseInt(row["Inter Group Adjustment 2"]) || 0;

        if (interGroupAdj1 !== 0) {
            if (!this.teamInterGroupAdjustments[team1]) {
                this.teamInterGroupAdjustments[team1] = [];
            }
            this.teamInterGroupAdjustments[team1].push({
                round: round,
                adjustment: interGroupAdj1,
                date: gameDate
            });
        }

        if (interGroupAdj2 !== 0) {
            if (!this.teamInterGroupAdjustments[team2]) {
                this.teamInterGroupAdjustments[team2] = [];
            }
            this.teamInterGroupAdjustments[team2].push({
                round: round,
                adjustment: interGroupAdj2,
                date: gameDate
            });
        }
    }

    /**
     * Processa jornada regular (fase de grupos)
     */
    _processRegularRound(roundNum, team1, team2, finalElo1, finalElo2, gameDate) {
        // Guardar todas as datas desta jornada
        if (gameDate) {
            if (!this.gamesDatesList[roundNum]) {
                this.gamesDatesList[roundNum] = [];
            }
            // Adicionar data se ainda não estiver na lista
            const dateStr = this._getLocalDateKey(gameDate);
            if (!this.gamesDatesList[roundNum].some(d => this._getLocalDateKey(d) === dateStr)) {
                this.gamesDatesList[roundNum].push(gameDate);
            }
        }

        if (!this.teamEloByRound[team1]) this.teamEloByRound[team1] = {};
        if (!this.teamEloByRound[team2]) this.teamEloByRound[team2] = {};

        this.teamEloByRound[team1][roundNum] = finalElo1;
        this.teamEloByRound[team2][roundNum] = finalElo2;
    }

    /**
     * Processa jornada de playoffs
     */
    _processPlayoffRound(round, team1, team2, finalElo1, finalElo2, gameDate) {
        if (!this.playoffGames[round]) {
            this.playoffGames[round] = [];
        }
        this.playoffGames[round].push({
            team1: team1,
            team2: team2,
            finalElo1: finalElo1,
            finalElo2: finalElo2,
            date: gameDate
        });
    }

    /**
     * Organiza datas e verifica ajustes intergrupos
     */
    _organizeDatesAndAdjustments() {
        // Consolidar datas: escolher a data mais antiga de cada jornada
        Object.keys(this.gamesDatesList).forEach(roundNum => {
            const dates = this.gamesDatesList[roundNum];
            if (dates && dates.length > 0) {
                // Ordenar datas e escolher a mais antiga
                dates.sort((a, b) => a - b);
                this.gamesDates[roundNum] = dates[0];
            }
        });

        // Criar lista de TODAS as datas únicas em ordem cronológica
        const allDatesMap = new Map(); // Usar Map para preservar objetos Date originais
        Object.keys(this.gamesDatesList).forEach(roundNum => {
            this.gamesDatesList[roundNum].forEach(date => {
                // Criar chave única baseada em ano-mês-dia (sem hora/timezone)
                const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                if (!allDatesMap.has(dateKey)) {
                    allDatesMap.set(dateKey, date);
                }
            });
        });

        const chronologicalDates = Array.from(allDatesMap.values())
            .sort((a, b) => a - b);

        // Data inicial baseada na época
        const initialDate = currentEpoca === '25_26' ? new Date('2025-09-01') : new Date('2024-09-01');
        this.allDates = [initialDate, ...chronologicalDates];

        // Criar mapeamento de datas para jornadas (para o tooltip)
        this.dateToRoundMapping = {};
        Object.keys(this.gamesDatesList).forEach(roundNum => {
            this.gamesDatesList[roundNum].forEach(date => {
                const dateKey = this._getLocalDateKey(date);
                if (!this.dateToRoundMapping[dateKey]) {
                    this.dateToRoundMapping[dateKey] = [];
                }
                this.dateToRoundMapping[dateKey].push(roundNum);
            });
        });

        // Criar lista ordenada de jornadas por ordem cronológica (para referência)
        this.roundsByDateOrder = [];
        chronologicalDates.forEach(date => {
            const dateKey = this._getLocalDateKey(date);
            if (this.dateToRoundMapping[dateKey]) {
                this.dateToRoundMapping[dateKey].forEach(round => {
                    if (!this.roundsByDateOrder.includes(round)) {
                        this.roundsByDateOrder.push(round);
                    }
                });
            }
        });

        // Adicionar datas dos playoffs ANTES dos ajustes intergrupos
        const playoffOrder = ['E1', 'E2', 'E3L', 'E3'];
        playoffOrder.forEach(phase => {
            if (this.playoffGames[phase] && this.playoffGames[phase].length > 0) {
                const phaseDate = this.playoffGames[phase][0].date;
                if (phaseDate) {
                    this.playoffDates[phase] = phaseDate;
                    this.allDates.push(phaseDate);
                    // Adicionar fase de playoff ao roundsByDateOrder também para o tooltip de forma
                    this.roundsByDateOrder.push(phase);
                }
            }
        });

        DebugUtils.debugProcessedData('jogos de playoffs', Object.keys(this.playoffGames).length, Object.keys(this.playoffGames));
        DebugUtils.debugProcessedData('datas dos playoffs', Object.keys(this.playoffDates).length, this.playoffDates);

        // Verificar ajustes intergrupos
        this.hasInterGroupAdjustments = hasRealInterGroupAdjustments(this.teamInterGroupAdjustments);

        // Adicionar ajustes intergrupos DEPOIS de todos os jogos (fase regular + playoffs)
        if (this.hasInterGroupAdjustments) {
            let adjustmentDate;

            if (this.allDates.length > 1) {
                // Ajustes vêm 1 dia depois do último jogo (seja fase regular ou playoff)
                const lastGameDate = this.allDates[this.allDates.length - 1];
                adjustmentDate = new Date(lastGameDate);
                adjustmentDate.setDate(adjustmentDate.getDate() + 1);
            } else {
                // Fallback
                adjustmentDate = new Date('2025-06-01');
            }

            this.allDates.push(adjustmentDate);
            this.roundsByDateOrder.push('Inter-Group');
            DebugUtils.debugProcessedData('ajustes intergrupos programados', 1, adjustmentDate.toLocaleDateString('pt-PT'));
        } DebugUtils.debugProcessedData('ajustes intergrupos encontrados', this.hasInterGroupAdjustments ? 1 : 0, this.hasInterGroupAdjustments);

        currentModalityHasAdjustments = this.hasInterGroupAdjustments;
        sampleData.gamesDates = this.allDates;
        sampleData.roundsByDateOrder = this.roundsByDateOrder; // Guardar ordem cronológica das jornadas

        DebugUtils.debugProcessedData('equipas com histórico ELO', Object.keys(this.teamEloByRound).length, Object.keys(this.teamEloByRound));
        DebugUtils.debugProcessedData('ELO inicial das equipas', Object.keys(this.teamInitialElo).length, this.teamInitialElo);
        DebugUtils.debugProcessedData('ajustes intergrupos', Object.keys(this.teamInterGroupAdjustments).length, this.teamInterGroupAdjustments);
        DebugUtils.debugProcessedData('datas dos jogos', sampleData.gamesDates ? sampleData.gamesDates.length : 0, sampleData.gamesDates);
    }

    /**
     * Constrói histórico de ELO para cada equipa
     * REGRA: Processar jogos sequencialmente mas agrupar por DIA no eixo X
     * A ordem deve ser: Data Inicial -> Fase Regular -> Playoffs -> Inter-Group
     */
    _buildEloHistories(initialElosFromFile) {
        // 1. Coletar todas as equipas
        const allTeamsWithGames = new Set([
            ...Object.keys(this.teamEloByRound),
            ...Object.keys(this.teamInterGroupAdjustments),
            ...Object.keys(initialElosFromFile)
        ]);

        // Adicionar equipas de playoffs
        Object.keys(this.playoffGames).forEach(phase => {
            this.playoffGames[phase].forEach(game => {
                allTeamsWithGames.add(game.team1);
                allTeamsWithGames.add(game.team2);
            });
        });

        // 2. Coletar TODOS os jogos em ordem cronológica
        const allGames = [];

        // Processar fase regular
        sampleData.rawEloData.forEach(row => {
            if (!row["Equipa 1"] || !row["Equipa 2"]) return;
            if (row.Jornada === "Inter-Group") return;

            const round = row.Jornada;
            if (!round || round.startsWith('E')) return; // Pular playoffs por agora

            const roundNum = parseInt(round);
            if (isNaN(roundNum)) return;

            const team1 = normalizeTeamName(row["Equipa 1"]);
            const team2 = normalizeTeamName(row["Equipa 2"]);
            const gameDate = parseDate(row.Dia);
            const finalElo1 = parseInt(row["Final Elo 1"]) || parseInt(row["Elo Depois 1"]);
            const finalElo2 = parseInt(row["Final Elo 2"]) || parseInt(row["Elo Depois 2"]);

            allGames.push({
                date: gameDate,
                team1, team2, finalElo1, finalElo2,
                round: roundNum,
                type: 'regular'
            });
        });

        // Adicionar playoffs
        const playoffOrder = ['E1', 'E2', 'E3L', 'E3'];
        playoffOrder.forEach(phase => {
            if (this.playoffGames[phase]) {
                this.playoffGames[phase].forEach(game => {
                    allGames.push({
                        date: game.date,
                        team1: game.team1,
                        team2: game.team2,
                        finalElo1: game.finalElo1,
                        finalElo2: game.finalElo2,
                        round: phase,
                        type: 'playoff'
                    });
                });
            }
        });

        // Ordenar todos os jogos por data
        allGames.sort((a, b) => (a.date || 0) - (b.date || 0));                // 3. Agrupar jogos por data (dia) e contar jogos por equipa
        const gamesByDate = new Map(); // dateKey -> array de jogos
        const gamesCountByTeamByDate = new Map(); // dateKey -> {teamName -> count}

        allGames.forEach(game => {
            const dateKey = game.date ? this._getLocalDateKey(game.date) : 'unknown';

            if (!gamesByDate.has(dateKey)) {
                gamesByDate.set(dateKey, []);
                gamesCountByTeamByDate.set(dateKey, {});
            }

            gamesByDate.get(dateKey).push(game);

            // Contar quantos jogos cada equipa tem nesta data
            const counts = gamesCountByTeamByDate.get(dateKey);
            counts[game.team1] = (counts[game.team1] || 0) + 1;
            counts[game.team2] = (counts[game.team2] || 0) + 1;
        });

        // 4. Agrupar jogos em "rodadas" - jogos que acontecem na MESMA HORA
        // Cada rodada representa jogos verdadeiramente simultâneos
        const gameRoundsByDate = new Map(); // dateKey -> [[jogos rodada 1], [jogos rodada 2], ...]

        gamesByDate.forEach((games, dateKey) => {
            // Agrupar por timestamp exato (dia + hora)
            const gamesByTime = new Map();

            games.forEach(game => {
                const timeKey = game.date ? game.date.getTime() : 0;
                if (!gamesByTime.has(timeKey)) {
                    gamesByTime.set(timeKey, []);
                }
                gamesByTime.get(timeKey).push(game);
            });

            // Ordenar por timestamp e criar rodadas
            const sortedTimes = Array.from(gamesByTime.keys()).sort((a, b) => a - b);
            const rounds = sortedTimes.map(time => gamesByTime.get(time));

            gameRoundsByDate.set(dateKey, rounds);
        });                // 5. Inicializar histórico de cada equipa
        const teamCurrentElo = {}; // ELO atual de cada equipa
        allTeamsWithGames.forEach(teamName => {
            const initialElo = initialElosFromFile[teamName] || this.teamInitialElo[teamName] || DEFAULT_ELO;
            teamCurrentElo[teamName] = initialElo;
            sampleData.eloHistory[teamName] = [initialElo];
        });

        const allDates = [];
        const roundsOrder = [];

        // 6. Processar cada data, rodada por rodada
        Array.from(gameRoundsByDate.keys()).forEach(dateKey => {
            const rounds = gameRoundsByDate.get(dateKey);

            // Processar cada rodada de jogos
            rounds.forEach((roundGames) => {
                // Todos os jogos desta rodada usam a mesma data
                allDates.push(roundGames[0].date);

                // Usar a fase do primeiro jogo como label da rodada
                roundsOrder.push(roundGames[0].round);

                // Atualizar ELO das equipas que jogaram
                roundGames.forEach(game => {
                    if (game.finalElo1) teamCurrentElo[game.team1] = game.finalElo1;
                    if (game.finalElo2) teamCurrentElo[game.team2] = game.finalElo2;
                });

                // Adicionar ponto ao histórico de todas as equipas
                allTeamsWithGames.forEach(teamName => {
                    sampleData.eloHistory[teamName].push(teamCurrentElo[teamName]);
                });
            });
        });

        // 4. Aplicar ajustes inter-grupos DEPOIS de todos os jogos
        if (this.hasInterGroupAdjustments) {
            const lastGameDate = allDates.length > 0 ? allDates[allDates.length - 1] : new Date();
            const adjustmentDate = new Date(lastGameDate);
            adjustmentDate.setDate(adjustmentDate.getDate() + 1);

            allDates.push(adjustmentDate);
            roundsOrder.push('Inter-Group');

            allTeamsWithGames.forEach(teamName => {
                const currentElo = sampleData.eloHistory[teamName][sampleData.eloHistory[teamName].length - 1];

                if (this.teamInterGroupAdjustments[teamName]) {
                    const adjustments = this.teamInterGroupAdjustments[teamName];
                    const adjustment = adjustments.find(adj => adj.round === "Inter-Group");
                    if (adjustment && adjustment.finalElo) {
                        sampleData.eloHistory[teamName].push(adjustment.finalElo);
                    } else {
                        sampleData.eloHistory[teamName].push(currentElo);
                    }
                } else {
                    sampleData.eloHistory[teamName].push(currentElo);
                }
            });
        }

        // 5. Guardar array de datas (inicial + todas as datas de eventos)
        const initialDate = currentEpoca === '25_26' ? new Date('2025-09-01') : new Date('2024-09-01');
        this.allDates = [initialDate, ...allDates];
        sampleData.gamesDates = this.allDates;
        sampleData.roundsByDateOrder = roundsOrder;

        // 6. Processar equipas que não jogaram (nem fase regular nem playoffs nem ajustes)
        sampleData.teams.forEach(team => {
            if (!sampleData.eloHistory[team.name]) {
                const initialElo = initialElosFromFile[team.name] || this.teamInitialElo[team.name] || DEFAULT_ELO;
                sampleData.eloHistory[team.name] = [initialElo, ...Array(allDates.length).fill(initialElo)];
            }
        });
    }
}

// Função wrapper para compatibilidade com código existente
function processEloHistory(data, initialElosFromFile = {}, previousSeasonTeams = new Set()) {
    const processor = new EloHistoryProcessor();
    processor.process(data, initialElosFromFile, previousSeasonTeams);

    // Marcar resultados desconhecidos do calendário (se já foi carregado)
    markUnknownResultsFromCalendar();
}

/**
 * Marca jogos com resultados desconhecidos baseado no calendário
 */
function markUnknownResultsFromCalendar() {
    if (!sampleData.calendarData || !sampleData.gameDetails) return;

    sampleData.calendarData.forEach(calendarMatch => {
        const round = calendarMatch.Jornada;
        const team1 = normalizeTeamName(calendarMatch['Equipa 1']);
        const team2 = normalizeTeamName(calendarMatch['Equipa 2']);

        // Verificar se há "?" em algum campo
        const hasUnknownMarker = Object.values(calendarMatch).some(value =>
            value && value.toString().trim() === '?'
        );

        if (hasUnknownMarker) {
            // Atualizar gameDetails para ambas as equipas - apenas marcar como desconhecido
            if (sampleData.gameDetails[team1] && sampleData.gameDetails[team1][round]) {
                sampleData.gameDetails[team1][round].unknownResult = true;
                // NÃO alterar result e outcome - preservar os valores que vieram do CSV de detalhe
            }

            if (sampleData.gameDetails[team2] && sampleData.gameDetails[team2][round]) {
                sampleData.gameDetails[team2][round].unknownResult = true;
                // NÃO alterar result e outcome - preservar os valores que vieram do CSV de detalhe
            }
        }
    });
}

// ==================== SISTEMA DE EVENT DELEGATION ====================

class EventManager {
    constructor() {
        this.handlers = new Map();
        this.init();
    }

    /**
     * Inicializa event listeners delegados
     */
    init() {
        // Event delegation para toda a página
        document.addEventListener('click', (e) => this.handleClick(e));
        document.addEventListener('change', (e) => this.handleChange(e));
    }

    /**
     * Registra um handler para um seletor CSS
     */
    on(selector, eventType, handler) {
        const key = `${eventType}:${selector}`;
        if (!this.handlers.has(key)) {
            this.handlers.set(key, []);
        }
        this.handlers.get(key).push(handler);
    }

    /**
     * Handler central para eventos de click
     */
    handleClick(event) {
        this.dispatchEvent('click', event);
    }

    /**
     * Handler central para eventos de change
     */
    handleChange(event) {
        this.dispatchEvent('change', event);
    }

    /**
     * Dispatch de eventos para handlers registrados
     */
    dispatchEvent(eventType, event) {
        for (const [key, handlers] of this.handlers) {
            const [type, selector] = key.split(':');

            if (type === eventType && event.target.matches(selector)) {
                handlers.forEach(handler => handler(event));
            }
        }
    }
}

// Instância global do gerenciador de eventos
const eventManager = new EventManager();

// ==================== COMPONENTES UI ====================

/**
 * Componente base para seletores
 */
class SelectorComponent {
    constructor(elementId) {
        this.element = document.getElementById(elementId);
        this.initialized = false;
    }

    render() {
        throw new Error('render() deve ser implementado pela subclasse');
    }

    clear() {
        if (this.element) {
            this.element.innerHTML = '';
        }
    }
}

/**
 * Seletor de Divisões
 */
class DivisionSelector extends SelectorComponent {
    constructor() {
        super('divisionSelector');
    }

    render() {
        this.clear();

        const structure = analyzeModalityStructure();
        const divisions = Object.keys(sampleData.rankings);

        if (divisions.length <= 1) {
            this.element.style.display = 'none';
            return;
        }

        this.element.style.display = 'flex';

        // Validar divisão atual
        if (!appState.view.division || !divisions.includes(appState.view.division)) {
            appState.view.division = divisions[0];
        }

        divisions.forEach(division => {
            const btn = document.createElement('button');
            btn.className = `division-btn ${division === appState.view.division ? 'active' : ''}`;
            btn.textContent = division;
            btn.dataset.division = division;
            this.element.appendChild(btn);
        });

        this.initialized = true;
    }

    setActive(division) {
        appState.view.division = division;
        appState.view.group = null;

        const buttons = this.element.querySelectorAll('.division-btn');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.textContent === division);
        });
    }
}

/**
 * Seletor de Grupos
 */
class GroupSelector extends SelectorComponent {
    constructor() {
        super('groupSelector');
    }

    render() {
        this.clear();

        if (!sampleData.rankings || !sampleData.rankings[appState.view.division]) {
            this.element.style.display = 'none';
            return;
        }

        // Verificar se a divisão atual já tem grupo no nome (ex: "2ª Divisão - Grupo A")
        const divisionHasGroup = appState.view.division && appState.view.division.includes('Grupo');

        if (divisionHasGroup) {
            // Se a divisão já inclui o grupo no nome, não mostrar seletor de grupo
            this.element.style.display = 'none';
            appState.view.group = null;
            return;
        }

        const teams = sampleData.rankings[appState.view.division];
        const groups = [...new Set(teams.map(team => team.group))].filter(group => group && group !== 'nan');

        if (groups.length === 0) {
            this.element.style.display = 'none';
            appState.view.group = null;
            return;
        }

        this.element.style.display = 'flex';

        // Botão "Todos"
        const allBtn = document.createElement('button');
        allBtn.className = `group-btn ${!appState.view.group ? 'active' : ''}`;
        allBtn.textContent = 'Todos';
        allBtn.dataset.group = '';
        this.element.appendChild(allBtn);

        // Botões de grupos
        groups.forEach(group => {
            const btn = document.createElement('button');
            btn.className = `group-btn ${group === appState.view.group ? 'active' : ''}`;
            btn.textContent = `Grupo ${group}`;
            btn.dataset.group = group;
            this.element.appendChild(btn);
        });

        this.initialized = true;
    }

    setActive(group) {
        const groupLetter = group ? group.replace('Grupo ', '') : null;
        appState.view.group = groupLetter;

        const buttons = this.element.querySelectorAll('.group-btn');
        buttons.forEach(btn => {
            const btnGroup = btn.dataset.group;
            btn.classList.toggle('active', btnGroup === (groupLetter || ''));
        });
    }
}

// Instâncias globais dos seletores
const divisionSelector = new DivisionSelector();
const groupSelector = new GroupSelector();

// ==================== REGISTRAR EVENT HANDLERS ====================

// Seletores de época e modalidade
eventManager.on('#epoca', 'change', (e) => changeEpoca(e.target.value));
eventManager.on('#modalidade', 'change', (e) => changeModalidade(e.target.value));

// Botões de zoom
eventManager.on('[data-zoom="in"]', 'click', () => zoomChart(1.2));
eventManager.on('[data-zoom="out"]', 'click', () => zoomChart(0.8));
eventManager.on('[data-zoom="reset"]', 'click', () => resetZoom());
eventManager.on('[data-action="toggle-pan"]', 'click', () => togglePanMode());

// Seletores de divisão e grupo
eventManager.on('.division-btn', 'click', (e) => {
    const division = e.target.dataset.division;
    if (division) {
        switchDivision(division);
        createBracket();
    }
});

eventManager.on('.group-btn', 'click', (e) => {
    const group = e.target.dataset.group;
    switchGroup(group);
});

// Navegação de jornadas
eventManager.on('[data-jornada-nav="prev"]', 'click', () => changeJornada(-1));
eventManager.on('[data-jornada-nav="next"]', 'click', () => changeJornada(1));

// Botões de debug
eventManager.on('[data-debug="enable"]', 'click', () => DebugUtils.setDebugEnabled(true, false));
eventManager.on('[data-debug="enable-all"]', 'click', () => DebugUtils.setDebugEnabled(true, true));
eventManager.on('[data-debug="disable"]', 'click', () => DebugUtils.setDebugEnabled(false));
eventManager.on('[data-debug="close"]', 'click', () => {
    document.getElementById('debug-panel').style.display = 'none';
});

// Checkboxes de equipas (delegação para o container)
eventManager.on('#teamSelector input[type="checkbox"]', 'change', (e) => {
    const teamName = e.target.dataset.teamName || e.target.id.replace('team-', '').replace(/_/g, ' ');
    toggleTeam(teamName);
});

// Filtros rápidos
eventManager.on('[data-filter="top3"]', 'click', () => filterTop3());
eventManager.on('[data-filter="division"]', 'click', (e) => {
    const division = e.target.dataset.division;
    if (division) filterDivision(division);
});

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', initApp);

// Event listeners para controles de teclado
document.addEventListener('keydown', (event) => {
    // Verificar se o usuário está editando texto
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }

    switch (event.key) {
        case '+':
        case '=':
            event.preventDefault();
            zoomChart(1.2);
            break;
        case '-':
            event.preventDefault();
            zoomChart(0.8);
            break;
        case '0':
            event.preventDefault();
            resetZoom();
            break;
        case 'p':
        case 'P':
            event.preventDefault();
            togglePanMode();
            break;
    }
});

// Atualizar labels dinâmicos quando a janela for redimensionada
window.addEventListener('resize', () => {
    setTimeout(() => {
        updateDynamicTeamLabels();
    }, 200);
});
// Inicializar sistema de debug (desativado por padrão)
document.addEventListener('DOMContentLoaded', function () {
    // Para ativar debug, descomente a linha abaixo:
    // DebugUtils.setDebugEnabled(true, false, ['informática', 'informatica']);
});