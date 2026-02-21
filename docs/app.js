
// ==================== CONSTANTES GLOBAIS ====================
const DEFAULT_ELO = 750;
const ENABLE_RANKING_SPARKLINES = true; // Mostrar micro-tendência de ELO na tabela
const SPARKLINE_POINTS = 10; // número de pontos mais recentes
let compactModeEnabled = false; // Modo compacto da tabela (sem emblemas e ELO Trend)
let predictionsTooltipFixed = false; // Estado do tooltip de previsões (fixo ou não)
let predictionsTooltipState = { distribution: null, isTeamA: false, itemsShown: 10 }; // Estado para gestão de batches
let predictionsTooltipCurrentDistribution = null; // Guardar o distribution atual para evitar re-render
let predictionsTooltipTimer = null; // Timer para debounce do hover
let predictionsTooltipLastCell = null; // Última célula onde o tooltip estava visível
let predictionsTooltipVisible = false; // Flag para rastrear se o tooltip está visível (evita flicker)
let favoriteTeam = localStorage.getItem('favoriteTeam'); // Equipa favorita do utilizador

// Mostrar painel de debug com Ctrl+Shift+D
document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        const panel = document.getElementById('debug-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
});

// ==================== FAVORITE TEAM SYSTEM ====================

/**
 * Alternar equipa favorita
 */
function toggleFavorite(teamName) {
    // Normalizar o nome da equipa para ser consistente em todo o lado
    const normalizedTeamName = normalizeTeamName(teamName);

    if (favoriteTeam === normalizedTeamName) {
        // Se já é favorita, remove
        favoriteTeam = null;
        localStorage.removeItem('favoriteTeam');
        showNotification('Equipa favorita removida');
    } else {
        favoriteTeam = normalizedTeamName;
        localStorage.setItem('favoriteTeam', normalizedTeamName);
        // Mostrar no formato preferido (nome limpo)
        const displayName = getPreferredTeamLabel(normalizedTeamName);
        showNotification(`Equipa favorita: ${displayName}`);
    }

    // Atualizar UI em todo o lado
    updateFavoriteUI();
}

/**
 * Atualizar UI com a nova equipa favorita
 */
function updateFavoriteUI() {
    // Atualizar Tabela
    updateRankingsTable();

    // Atualizar Gráfico (re-render para destacar linha/pontos)
    updateEloChart();

    // Atualizar Calendário
    updateCalendar();

    // Atualizar Previsões
    updatePredictionsDisplay();

    // Atualizar Selector de equipas no gráfico
    // Não precisa de re-render total, apenas classes
    document.querySelectorAll('.team-checkbox').forEach(label => {
        const input = label.querySelector('input');
        if (input && favoriteTeam) {
            const teamInCheckbox = input.dataset.teamName;
            const teamCanonical = resolveCanonicalCourseKey(teamInCheckbox);
            const favoriteCanonical = resolveCanonicalCourseKey(favoriteTeam);

            if (teamCanonical === favoriteCanonical) {
                label.classList.add('favorite-team-selected');
            } else {
                label.classList.remove('favorite-team-selected');
            }
        } else {
            label.classList.remove('favorite-team-selected');
        }
    });

    // Se a equipa favorita existe na modalidade atual, forçar visualização
    if (favoriteTeam) {
        // Verificar se equipa existe na modalidade atual
        // (Isto será tratado na lógica de navegação, aqui é só update visual)
    }
}

/**
 * Verifica se uma equipa é a favorita (comparando com normalização)
 */
function isTeamFavorite(teamName) {
    if (!favoriteTeam || !teamName) return false;
    const teamCanonical = resolveCanonicalCourseKey(teamName);
    const favoriteCanonical = resolveCanonicalCourseKey(favoriteTeam);
    return teamCanonical === favoriteCanonical;
}

/**
 * Mostrar notificação toast
 */
function showNotification(message) {
    let toast = document.getElementById('notification-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'notification-toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = 'show';

    setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000);
}

// ==================== SISTEMA DE COLAPSÁVEIS ====================

/**
 * Inicializa o comportamento colapsável do gráfico ELO
 */
function initializeCollapsibles() {
    const toggleBtn = document.getElementById('toggleEloChart');
    const chartContent = document.getElementById('eloChartContent');

    if (!toggleBtn || !chartContent) return;

    // Carregar preferência do localStorage
    const isCollapsed = localStorage.getItem('eloChartCollapsed') === 'true';

    if (isCollapsed) {
        chartContent.classList.add('collapsed');
        toggleBtn.setAttribute('aria-expanded', 'false');
    }

    toggleBtn.addEventListener('click', () => {
        const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';

        if (expanded) {
            chartContent.classList.add('collapsed');
            toggleBtn.setAttribute('aria-expanded', 'false');
            localStorage.setItem('eloChartCollapsed', 'true');
        } else {
            chartContent.classList.remove('collapsed');
            toggleBtn.setAttribute('aria-expanded', 'true');
            localStorage.setItem('eloChartCollapsed', 'false');
        }
    });
}

// Inicializar aplicação
async function initApp() {
    // Carregar configuração dos cursos
    await loadCoursesConfig();

    // Inicializar tooltip de previsões imediatamente
    if (!predictionsTooltipEl) {
        predictionsTooltipEl = createPredictionsTooltip();
    }

    // Inicializar tooltip histórico
    if (!historicalTooltipEl) {
        historicalTooltipEl = createHistoricalTooltip();
    }

    // Inicializar colapsáveis
    initializeCollapsibles();

    // Inicializar seletores de época e modalidade
    initializeSelectors();

    // Não carregar dados inicialmente - aguardar seleção de modalidade
    document.getElementById('teamSelector').innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">' + t('selectModalityData') + '</p>';
    document.getElementById('rankingsBody').innerHTML = '<tr><td colspan="13" style="text-align: center; color: #666;">' + t('selectModality') + '</td></tr>';
    document.getElementById('bracketContainer').innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">' + t('selectModalityBracket') + '</p>';

    // Inicializar gráfico vazio
    initEloChart();

    // Disparar evento de mudança na modalidade para carregar dados iniciais (User Feedback: Render on Load)
    setTimeout(() => {
        const modalitySelector = document.getElementById('modalidade');
        if (modalitySelector && modalitySelector.value) {
            modalitySelector.dispatchEvent(new Event('change'));
        }
    }, 500);
}

// Criar seletor de equipas
function createTeamSelector() {
    const selector = document.getElementById('teamSelector');
    selector.innerHTML = '';

    if (sampleData.teams.length === 0) {
        selector.innerHTML = '<p style="color: #666; text-align: center;">' + t('selectModalityFirst') + '</p>';
        return;
    }

    // Aplicar layout inteligente baseado no número de equipas
    applyIntelligentTeamLayout(selector, sampleData.teams.length);

    // Adicionar estilos de transição para animações suaves
    if (!document.getElementById('team-selector-transitions')) {
        const style = document.createElement('style');
        style.id = 'team-selector-transitions';
        style.textContent = `
            #teamSelector {
                position: relative;
            }
            #teamSelector label.team-checkbox {
                transition: transform 0.3s ease, opacity 0.3s ease;
                will-change: transform;
            }
            #teamSelector label.team-checkbox.moving {
                z-index: 10;
            }
        `;
        document.head.appendChild(style);
    }

    // Função auxiliar para agrupar equipas
    function groupTeamsByDivisionAndGroup(teams) {
        const grouped = {};

        teams.forEach(team => {
            const division = team.division || 'A';
            const group = team.group || 'Único';

            if (!grouped[division]) {
                grouped[division] = {};
            }
            if (!grouped[division][group]) {
                grouped[division][group] = [];
            }
            grouped[division][group].push(team);
        });

        // Ordenar divisões alfabeticamente
        const sortedGrouped = {};
        Object.keys(grouped).sort().forEach(division => {
            sortedGrouped[division] = {};
            const groupKeys = Object.keys(grouped[division]).sort((a, b) => {
                if (a === 'Único') return 1;
                if (b === 'Único') return -1;
                return a.localeCompare(b);
            });
            groupKeys.forEach(group => {
                sortedGrouped[division][group] = grouped[division][group];
            });
        });

        return sortedGrouped;
    }

    // Reorganizar equipas por divisão e grupo
    const teamsByDivisionAndGroup = groupTeamsByDivisionAndGroup(sampleData.teams);

    // Criar estrutura colapsável por divisão
    Object.entries(teamsByDivisionAndGroup).forEach(([division, groups]) => {
        // Criar contentor de divisão
        const divisionContainer = document.createElement('div');
        divisionContainer.className = 'team-division-group';

        // Cabeçalho da divisão com botão colapsável
        const divisionHeader = document.createElement('div');
        divisionHeader.className = 'team-division-header';
        divisionHeader.dataset.division = division;

        // Chevron do colapsável
        const chevron = document.createElement('span');
        chevron.className = 'team-division-chevron';
        chevron.innerHTML = '▼';

        // Título da divisão com contador de equipas
        const divisionTitle = document.createElement('span');
        divisionTitle.className = 'team-division-title';
        const groupCount = Object.keys(groups).length;
        const teamCount = Object.values(groups).flat().length;
        const divisionLabel = division === 'geral' ? t('divisionGeneral') : `${division}` + t('divisionNth');
        const singular = t('teamSingular');
        const plural = t('teamPlural');
        divisionTitle.textContent = `${divisionLabel} (${teamCount} ${teamCount !== 1 ? plural : singular})`;

        divisionHeader.appendChild(chevron);
        divisionHeader.appendChild(divisionTitle);

        // Contentor de grupos
        const groupsContainer = document.createElement('div');
        groupsContainer.className = 'team-groups-container';
        groupsContainer.style.maxHeight = '0px';
        groupsContainer.style.paddingTop = '0px';
        groupsContainer.style.paddingBottom = '0px';

        // Criar grupos dentro da divisão
        Object.entries(groups).forEach(([groupName, teams]) => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'team-group';

            // Se há apenas um grupo, não mostrar cabeçalho
            if (groupCount > 1) {
                const groupHeader = document.createElement('div');
                groupHeader.className = 'team-group-header';
                groupHeader.textContent = `${t('groupPrefix')}${groupName}`;
                groupDiv.appendChild(groupHeader);
            }

            // Adicionar equipas do grupo
            const teamsInGroupDiv = document.createElement('div');
            teamsInGroupDiv.className = 'team-group-teams';

            teams.forEach(team => {
                const label = document.createElement('label');
                const isFavorite = isTeamFavorite(team.name);
                label.className = isFavorite ? 'team-checkbox active favorite-team-selected' : 'team-checkbox active';
                label.dataset.teamName = team.name;

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `team-${team.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
                checkbox.name = checkbox.id;
                checkbox.checked = true;
                checkbox.dataset.teamName = team.name;

                // Garantir que há cor: fallback se necessário
                let teamColor = team.color;
                if (!teamColor) {
                    const courseInfo = getCourseInfo(team.name);
                    teamColor = courseInfo.primaryColor;
                    team.color = teamColor; // Guardar de volta para garantir consistência
                }

                const teamDot = document.createElement('div');
                teamDot.className = 'team-dot';
                teamDot.style.backgroundColor = teamColor;

                const teamNameSpan = document.createElement('span');
                teamNameSpan.className = 'team-name';
                // Gráfico sempre usa nome curto
                const teamCourseInfo = getCourseInfo(team.name);
                teamNameSpan.title = translateTeamName(teamCourseInfo.fullName);
                teamNameSpan.textContent = translateTeamName(teamCourseInfo.shortName);

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

                label.title = teamCourseInfo.fullName;
                teamsInGroupDiv.appendChild(label);
            });

            groupDiv.appendChild(teamsInGroupDiv);
            groupsContainer.appendChild(groupDiv);
        });

        divisionContainer.appendChild(divisionHeader);
        divisionContainer.appendChild(groupsContainer);
        selector.appendChild(divisionContainer);

        // Event listener para colapsar/expandir divisão
        divisionHeader.addEventListener('click', () => {
            const isCollapsed = groupsContainer.dataset.state === 'collapsed';
            if (isCollapsed) {
                // expandir
                groupsContainer.style.display = 'block';
                groupsContainer.style.maxHeight = 'none';
                const contentHeight = groupsContainer.scrollHeight;
                groupsContainer.style.maxHeight = '0px';
                requestAnimationFrame(() => {
                    groupsContainer.style.maxHeight = `${contentHeight}px`;
                    groupsContainer.style.paddingTop = '8px';
                    groupsContainer.style.paddingBottom = '8px';
                });
                groupsContainer.dataset.state = 'expanded';
                groupsContainer.dataset.state = 'expanded';
                chevron.style.transform = 'rotate(0deg)';

                // Remover restrição de altura após animação
                const transitionEndHandler = () => {
                    if (groupsContainer.dataset.state === 'expanded') {
                        groupsContainer.style.maxHeight = 'none';
                    }
                    groupsContainer.removeEventListener('transitionend', transitionEndHandler);
                };
                groupsContainer.addEventListener('transitionend', transitionEndHandler);
            } else {
                // colapsar
                const contentHeight = groupsContainer.scrollHeight;
                groupsContainer.style.maxHeight = `${contentHeight}px`;
                requestAnimationFrame(() => {
                    groupsContainer.style.maxHeight = '0px';
                    groupsContainer.style.paddingTop = '0px';
                    groupsContainer.style.paddingBottom = '0px';
                });
                groupsContainer.dataset.state = 'collapsed';
                chevron.style.transform = 'rotate(-90deg)';
                setTimeout(() => {
                    if (groupsContainer.dataset.state === 'collapsed') {
                        groupsContainer.style.display = 'none';
                    }
                }, 350);
            }

            // Guardar preferência
            const collapsedDivisions = JSON.parse(localStorage.getItem('teamDivisionsCollapsed') || '{}');
            if (isCollapsed) {
                delete collapsedDivisions[division];
            } else {
                collapsedDivisions[division] = true;
            }
            localStorage.setItem('teamDivisionsCollapsed', JSON.stringify(collapsedDivisions));
        });

        // Restaurar estado colapsado
        const collapsedDivisions = JSON.parse(localStorage.getItem('teamDivisionsCollapsed') || '{}');
        const shouldCollapse = collapsedDivisions[division];
        const setExpandedState = () => {
            groupsContainer.style.display = 'block';
            groupsContainer.style.maxHeight = 'none';
            const contentHeight = groupsContainer.scrollHeight;
            groupsContainer.style.maxHeight = `${contentHeight}px`;
            groupsContainer.style.paddingTop = '8px';
            groupsContainer.style.paddingBottom = '8px';
            groupsContainer.dataset.state = 'expanded';
            chevron.style.transform = 'rotate(0deg)';
        };

        const setCollapsedState = () => {
            groupsContainer.style.display = 'none';
            groupsContainer.style.maxHeight = '0px';
            groupsContainer.style.paddingTop = '0px';
            groupsContainer.style.paddingBottom = '0px';
            groupsContainer.dataset.state = 'collapsed';
            chevron.style.transform = 'rotate(-90deg)';
        };

        // Esperar um frame para garantir scrollHeight correto antes de definir estado
        requestAnimationFrame(() => {
            if (shouldCollapse) {
                setCollapsedState();
            } else {
                setExpandedState();
            }
            // Reavaliar necessidade de scroll após o toggle inicial
            const selectorEl = document.getElementById('teamSelector');
            if (selectorEl) {
                setTimeout(() => checkScrollIndicator(selectorEl), 120);
            }
        });
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
    selectAllBtn.textContent = t('selectAllTeams');
    selectAllBtn.className = 'quick-control-btn';
    selectAllBtn.setAttribute('aria-label', t('selectAllAria'));
    selectAllBtn.onclick = () => selectAllTeams(true);

    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.textContent = t('deselectAllTeams');
    deselectAllBtn.className = 'quick-control-btn';
    deselectAllBtn.setAttribute('aria-label', t('deselectAllAria'));
    deselectAllBtn.onclick = () => selectAllTeams(false);

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = t('invertSelection');
    toggleBtn.className = 'quick-control-btn';
    toggleBtn.setAttribute('aria-label', t('invertSelectionAria'));
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
    reorderTeamSelector();
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
    reorderTeamSelector();
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
    reorderTeamSelector();
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

    // Reordenar equipas com animação
    reorderTeamSelector();
}

// Função para reordenar equipas no seletor (selecionadas primeiro)
function reorderTeamSelector() {
    const selector = document.getElementById('teamSelector');
    if (!selector) return;

    // Reordenar equipa a equipa dentro de cada grupo para não quebrar as divisões
    const groupContainers = selector.querySelectorAll('.team-group-teams');
    groupContainers.forEach(group => {
        const labels = Array.from(group.querySelectorAll('label.team-checkbox'));
        if (labels.length === 0) return;

        const positions = new Map();
        labels.forEach(label => {
            const rect = label.getBoundingClientRect();
            positions.set(label, { top: rect.top, left: rect.left });
        });

        const teamsInfo = labels.map(label => {
            const checkbox = label.querySelector('input[type="checkbox"]');
            const teamName = checkbox.dataset.teamName;

            let currentElo = DEFAULT_ELO;
            const history = sampleData.eloHistory[teamName];
            if (history && history.length > 0) {
                for (let i = history.length - 1; i >= 0; i--) {
                    if (history[i] !== null && history[i] !== undefined && !isNaN(history[i])) {
                        currentElo = history[i];
                        break;
                    }
                }
            }

            return {
                label,
                isChecked: checkbox.checked,
                currentElo
            };
        });

        teamsInfo.sort((a, b) => {
            if (a.isChecked !== b.isChecked) {
                return a.isChecked ? -1 : 1;
            }
            return b.currentElo - a.currentElo;
        });

        const fragment = document.createDocumentFragment();
        teamsInfo.forEach(info => fragment.appendChild(info.label));
        group.appendChild(fragment);

        requestAnimationFrame(() => {
            teamsInfo.forEach(info => {
                const oldPos = positions.get(info.label);
                const newRect = info.label.getBoundingClientRect();
                const deltaX = oldPos.left - newRect.left;
                const deltaY = oldPos.top - newRect.top;

                if (deltaX !== 0 || deltaY !== 0) {
                    info.label.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                    info.label.style.transition = 'none';
                    info.label.offsetHeight; // força reflow
                    info.label.style.transition = 'transform 0.3s ease';
                    info.label.style.transform = '';
                    setTimeout(() => {
                        info.label.style.transition = '';
                        info.label.style.transform = '';
                    }, 300);
                }
            });
        });
    });
}

// Função para atualizar indicador de número de equipas selecionadas
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
                    left: 10px;
                    z-index: 15;
                    background: rgba(102, 126, 234, 0.9);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 15px;
                    font-size: 0.85em;
                    font-weight: 500;
                    display: inline-block;
                    transition: all 0.3s ease;
                `;

        // Inserir preferencialmente no container do gráfico (tem position: relative)
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.appendChild(indicator);
        } else {
            // Fallback para o header se o container não existir ainda
            const header = document.querySelector('.chart-header');
            if (header) {
                header.appendChild(indicator);
                indicator.style.position = 'static';
            }
        }
    }

    indicator.textContent = `${activeCount}/${totalCount} ${t('teamPlural')}`;

    // Mudar cor baseado na quantidade
    if (activeCount > 12) {
        indicator.style.background = 'rgba(220, 53, 69, 0.9)'; // Vermelho - muitas equipas
    } else if (activeCount > 8) {
        indicator.style.background = 'rgba(255, 193, 7, 0.9)'; // Amarelo - número médio
    } else {
        indicator.style.background = 'rgba(40, 167, 69, 0.9)'; // Verde - poucas equipas
    }

    // Atualizar botões de navegação entre épocas
    updateSeasonNavigationButtons();
}

// Função para criar e atualizar botões de navegação entre épocas
function updateSeasonNavigationButtons() {
    const navContainer = document.getElementById('seasonNavigation');
    if (!navContainer) return;

    const epochSelector = document.getElementById('epoca');
    const modalidadeSelector = document.getElementById('modalidade');
    if (!epochSelector || !modalidadeSelector) return;

    const currentEpoch = epochSelector.value;
    const currentModality = modalidadeSelector.value;

    // Obter todas as épocas disponíveis (ordenadas da mais recente para a mais antiga)
    const allEpochs = Array.from(epochSelector.options).map(opt => opt.value);
    const currentIndex = allEpochs.indexOf(currentEpoch);

    // Como as épocas estão ordenadas da mais recente (index 0) para a mais antiga (index length-1):
    // Época anterior (mais antiga) = index maior
    // Época seguinte (mais recente) = index menor
    const hasPrevious = currentIndex < allEpochs.length - 1; // Pode ir para época mais antiga
    const hasNext = currentIndex > 0; // Pode ir para época mais recente

    // Criar ou atualizar botão época anterior
    let prevBtn = document.getElementById('season-prev-btn');
    if (!prevBtn) {
        prevBtn = document.createElement('button');
        prevBtn.id = 'season-prev-btn';
        prevBtn.innerHTML = t('previousSeason');
        prevBtn.style.cssText = `
            background: rgba(102, 126, 234, 0.9);
            color: white;
            padding: 6px 16px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: 500;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        prevBtn.addEventListener('mouseover', () => {
            if (prevBtn.style.display !== 'none') {
                prevBtn.style.background = 'rgba(102, 126, 234, 1)';
            }
        });
        prevBtn.addEventListener('mouseout', () => {
            prevBtn.style.background = 'rgba(102, 126, 234, 0.9)';
        });
        navContainer.appendChild(prevBtn);
    }
    prevBtn.innerHTML = t('previousSeason');
    // Remover listeners antigos e adicionar novo com currentIndex atualizado
    prevBtn.onclick = () => {
        const epochSel = document.getElementById('epoca');
        const allEps = Array.from(epochSel.options).map(opt => opt.value);
        const currIdx = allEps.indexOf(epochSel.value);
        if (currIdx < allEps.length - 1) {
            const novaEpoca = allEps[currIdx + 1];
            epochSel.value = novaEpoca;
            changeEpoca(novaEpoca);
        }
    };
    prevBtn.style.display = hasPrevious ? 'inline-block' : 'none';

    // Criar ou atualizar botão época seguinte
    let nextBtn = document.getElementById('season-next-btn');
    if (!nextBtn) {
        nextBtn = document.createElement('button');
        nextBtn.id = 'season-next-btn';
        nextBtn.innerHTML = t('nextSeason');
        nextBtn.style.cssText = `
            background: rgba(102, 126, 234, 0.9);
            color: white;
            padding: 6px 16px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: 500;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-left: auto;
        `;
        nextBtn.addEventListener('mouseover', () => {
            if (nextBtn.style.display !== 'none') {
                nextBtn.style.background = 'rgba(102, 126, 234, 1)';
            }
        });
        nextBtn.addEventListener('mouseout', () => {
            nextBtn.style.background = 'rgba(102, 126, 234, 0.9)';
        });
        navContainer.appendChild(nextBtn);
    }
    nextBtn.innerHTML = t('nextSeason');
    // Remover listeners antigos e adicionar novo com currentIndex atualizado
    nextBtn.onclick = () => {
        const epochSel = document.getElementById('epoca');
        const allEps = Array.from(epochSel.options).map(opt => opt.value);
        const currIdx = allEps.indexOf(epochSel.value);
        if (currIdx > 0) {
            const novaEpoca = allEps[currIdx - 1];
            epochSel.value = novaEpoca;
            changeEpoca(novaEpoca);
        }
    };
    nextBtn.style.display = hasNext ? 'inline-block' : 'none';
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
        btn.classList.toggle('active', btn.dataset.division === division);
    });

    // Atualizar seletor de grupo do calendário
    createCalendarGroupSelector();

    // Atualizar jornadas disponíveis
    updateAvailableJornadas();

    // Atualizar calendário se houver jornada selecionada
    if (currentCalendarJornada) {
        updateCalendar();
    }

    updatePredictionsSelectors();
    refreshPredictionsTeamsForSelection();
    updatePredictionsDisplay();

    // Sincronizar com o gráfico ELO (exceto se for divisão com grupos, aí mostra todos)
    filterDivision(division);
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

    updatePredictionsSelectors();
    refreshPredictionsTeamsForSelection();
    updatePredictionsDisplay();

    // Sincronizar com o gráfico ELO
    if (group) {
        // Extrair letra do grupo se necessário (ex: "Grupo A" -> "A")
        const groupLetter = group.replace('Grupo ', '');
        filterGroup(groupLetter);
    } else {
        // Se grupo for null (clicou "Todos"), mostrar toda a divisão
        if (appState.view.division) {
            filterDivision(appState.view.division);
        }
    }
}

// Inicializar gráfico ELO com ApexCharts
function initEloChart() {
    // Verificar se ApexCharts está carregado
    if (typeof ApexCharts === 'undefined') {
        console.error('ApexCharts não está carregado!');
        setTimeout(initEloChart, 100); // Tentar novamente após 100ms
        return;
    }

    // Se já existe gráfico, destruir
    if (eloChart) {
        eloChart.destroy();
    }

    // Calcular altura do gráfico baseado em orientação e viewport
    const isLandscapeMobile = window.matchMedia('(max-width: 932px) and (orientation: landscape)').matches;
    const chartHeight = isLandscapeMobile ? Math.min(Math.max(window.innerHeight * 0.5, 300), 500) : 700;

    const options = {
        series: [], // Preenchido em updateEloChart
        chart: {
            id: 'eloChart',
            type: 'line',
            height: '100%',
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    selection: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: false
                },
                autoSelected: 'zoom'
            },
            animations: {
                enabled: false // Desativar animações para performance
            },
            events: {
                dataPointSelection: function (event, chartContext, config) {
                    // Este evento é disparado quando um ponto específico é clicado

                    // Guardar a cor original do ponto ANTES de qualquer mudança
                    if (event && event.target) {
                        const marker = event.target.closest('.apexcharts-marker');
                        if (marker && !marker.hasAttribute('data-original-fill')) {
                            // Guardar a cor atual como cor original (antes de ser selecionado)
                            const currentFill = marker.getAttribute('fill');
                            if (currentFill) {
                                marker.setAttribute('data-original-fill', currentFill);
                                // console.log('[DEBUG] Guardou cor original:', currentFill);
                            }
                        }
                    }

                    // Se já está fixo e clicamos no mesmo ponto, desafixar
                    if (window.tooltipFixed &&
                        window.tooltipFixedDataPoint &&
                        window.tooltipFixedDataPoint.seriesIndex === config.seriesIndex &&
                        window.tooltipFixedDataPoint.dataPointIndex === config.dataPointIndex) {
                        // Remover seleção anterior
                        window.tooltipFixed = null;
                        window.tooltipFixedPosition = null;
                        window.tooltipFixedDataPoint = null;

                        // Remover atributo selected e resetar visual de todos os marcadores
                        document.querySelectorAll('.apexcharts-marker[selected="true"]').forEach(marker => {
                            marker.setAttribute('selected', 'false');

                            // Obter a cor original guardada
                            let originalColor = marker.getAttribute('data-original-fill');
                            if (!originalColor) {
                                // Fallback: tentar obter da série
                                const seriesIndex = marker.getAttribute('rel');
                                if (seriesIndex !== null && eloChart && eloChart.opts.colors) {
                                    originalColor = eloChart.opts.colors[seriesIndex];
                                }
                            }

                            if (originalColor) {
                                marker.setAttribute('fill', originalColor);
                            }
                            marker.removeAttribute('filter');
                        });

                        // Resetar markers discretos para remover o visual de seleção
                        if (eloChart) {
                            eloChart.updateOptions({
                                markers: {
                                    discrete: []
                                }
                            }, false);

                            if (typeof eloChart.clearSelection === 'function') {
                                eloChart.clearSelection();
                            }
                        }
                    } else {
                        // Limpar seleção anterior do ApexCharts antes de selecionar nova
                        if (eloChart && typeof eloChart.clearSelection === 'function') {
                            eloChart.clearSelection();
                        }

                        // Resetar flags globais
                        const wasFixed = window.tooltipFixed;
                        window.tooltipFixed = null;
                        window.tooltipFixedPosition = null;

                        // Guardar o ponto que foi clicado para fixar o tooltip
                        window.tooltipFixedDataPoint = {
                            seriesIndex: config.seriesIndex,
                            dataPointIndex: config.dataPointIndex
                        };

                        // Aguardar um momento para o tooltip renderizar e posicionar-se no novo ponto
                        setTimeout(() => {
                            const tooltip = document.querySelector('.apexcharts-tooltip');
                            if (tooltip && tooltip.style.display !== 'none') {
                                window.tooltipFixed = true;
                                // Guardar a nova posição do tooltip
                                window.tooltipFixedPosition = {
                                    top: tooltip.style.top,
                                    left: tooltip.style.left
                                };
                                tooltip.style.pointerEvents = 'auto';
                            }
                        }, 100);
                    }
                }
            }
        },
        colors: [], // Preenchido dinamicamente
        stroke: {
            width: 3,
            curve: 'straight' // Linhas retas para conectar pontos
        },
        grid: {
            borderColor: '#f1f1f1',
            xaxis: {
                lines: {
                    show: true
                }
            }
        },
        markers: {
            size: 8, // Tamanho aumentado para garantir visibilidade
            strokeWidth: 3,
            strokeOpacity: 1,
            fillOpacity: 1,
            discrete: [],
            hover: {
                size: 10,
                sizeOffset: 3
            }
        },
        xaxis: {
            type: 'category', // MUDANÇA: Categórico para remover dias vazios
            tooltip: {
                enabled: false
            },
            labels: {
                rotate: -45,
                hideOverlappingLabels: true
            }
        },
        yaxis: {
            title: {
                text: t('eloRatingLabel')
            }
        },
        legend: {
            show: false
        },
        tooltip: {
            enabled: true,
            shared: false,
            intersect: true, // CRÍTICO: true para detectar a série correta
            followCursor: false,
            offsetY: 100,
            offsetX: 10,
            fixed: {
                enabled: false,
                position: 'topRight'
            },
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                // Se o tooltip está fixo, usar os dados do ponto fixado
                if (window.tooltipFixed && window.tooltipFixedDataPoint) {
                    seriesIndex = window.tooltipFixedDataPoint.seriesIndex;
                    dataPointIndex = window.tooltipFixedDataPoint.dataPointIndex;
                }

                // Usar os dados armazenados globalmente para garantir consistência
                const currentSeries = appState.chart.currentSeriesData;

                if (!currentSeries || !currentSeries[seriesIndex]) {
                    return '';
                }

                const seriesData = currentSeries[seriesIndex];
                if (!seriesData.data || !seriesData.data[dataPointIndex]) {
                    return '';
                }

                const data = seriesData.data[dataPointIndex];
                const teamKey = normalizeTeamName(seriesData.name);
                const eloValue = series[seriesIndex][dataPointIndex];
                const extraData = data.extra || {};

                // Usar data completa se disponível, senão usar a categoria (label)
                let dateDisplay = '';
                const dateLocale = getDateLocale();
                if (extraData.fullDate) {
                    dateDisplay = new Date(extraData.fullDate).toLocaleDateString(dateLocale);
                } else if (w.globals.labels && w.globals.labels[dataPointIndex]) {
                    const label = w.globals.labels[dataPointIndex];
                    // Usar o label directamente, seja string ou número
                    dateDisplay = String(label);
                } else {
                    dateDisplay = t('unknownDate');
                }

                // Obter logo da equipa
                const courseInfo = getCourseInfo(teamKey);
                const displayTeamName = getTranslatedTeamLabel(courseInfo, teamKey);
                const logoPath = courseInfo.emblemPath || 'assets/taça_ua.png';
                const teamColor = w.globals.colors[seriesIndex];

                // Construir tooltip HTML (formato exemplo)
                let html = '<div class="apexcharts-tooltip-title" style="background: #fff; color: #333; font-family: Segoe UI; display: flex; align-items: center; justify-content: space-between; padding: 0px 0px; border-bottom: none;">';
                html += '<span style="font-weight: 600; padding: 0px 10px;">' + displayTeamName + '</span>';

                // Ajustar tamanho do emblema (EGI com padding extra)
                let emblemaStyle = 'height: 48px;';
                if (logoPath.includes('EGI-07.png')) {
                    emblemaStyle = 'height: 48px; padding: 8px;';
                }
                html += '<img src="' + logoPath + '" style="' + emblemaStyle + '" alt="' + displayTeamName + '">';
                html += '</div>';
                html += '<div style="height: 3px; background: ' + teamColor + ';"></div>';
                html += '<div class="apexcharts-tooltip-body" style="font-family: Segoe UI; padding: 8px 8px;">';

                // Linha de ELO
                html += '<div><strong>' + t('eloCurrentTitle') + ': ' + eloValue + '</strong>';

                // Delta ELO
                if (extraData.eloDelta && Math.abs(extraData.eloDelta) > 0.01) {
                    const isPos = extraData.eloDelta > 0;
                    const color = isPos ? '#28a745' : '#dc3545';
                    const sign = isPos ? '+' : '';
                    html += '<span style="color: ' + color + '; margin-left: 8px; font-weight: bold;">' + sign + extraData.eloDelta + '</span>';
                }
                html += '</div>';

                // Detalhes do Jogo - usar dados atuais ou do último jogo
                let gameData = extraData.opponent ? extraData : null;
                let isLastGame = false;

                if (!gameData) {
                    // Procurar último jogo se não há opponent
                    for (let i = dataPointIndex - 1; i >= 0; i--) {
                        if (seriesData.data[i] && seriesData.data[i].extra && seriesData.data[i].extra.opponent) {
                            gameData = seriesData.data[i].extra;
                            isLastGame = true;
                            break;
                        }
                    }
                }

                if (gameData) {
                    html += '<div style="padding-top: 8px;">';

                    // Labels de jornada/fase
                    let roundLabel = gameData.round;
                    if (roundLabel === 'E1') roundLabel = t('roundQuarters');
                    else if (roundLabel === 'E2') roundLabel = t('roundSemiFinals');
                    else if (roundLabel === 'E3L') roundLabel = t('thirdPlace');
                    else if (roundLabel === 'E3') roundLabel = t('roundFinal');
                    else if (typeof roundLabel === 'string' && roundLabel.startsWith('J')) {
                        // Já está formatado
                    } else if (roundLabel && !isNaN(roundLabel)) {
                        roundLabel = t('matchday') + ' ' + roundLabel;
                    }

                    const gameDate = gameData.fullDate ? new Date(gameData.fullDate).toLocaleDateString('pt-PT') : dateDisplay;
                    if (isLastGame) {
                        html += '<div style="color: #999; font-size: 0.85em; margin-bottom: 2px;">(' + t('lastGame') + ')</div>';
                    }
                    html += '<div style="color: #666; font-size: 0.9em;">' + (roundLabel || '') + ' • ' + gameDate + '</div>';
                    const translatedOpponent = translateTeamName(gameData.opponent);
                    html += '<div style="font-weight: 600; margin-top: 2px;">' + (gameData.result + ' vs ' + translatedOpponent) + '</div>';
                    html += '</div>';
                } else {
                    html += '<div style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px; color: #666; font-size: 0.9em;">' + dateDisplay + '</div>';
                    if (extraData.description) {
                        html += '<div style="font-weight: 600; margin-top: 2px;">' + extraData.description + '</div>';
                    }
                }

                // Delta ELO - usar do gameData se disponível
                if (gameData && gameData.eloDelta && Math.abs(gameData.eloDelta) > 0.01) {
                    const isPos = gameData.eloDelta > 0;
                    const color = isPos ? '#28a745' : '#dc3545';
                    const sign = isPos ? '+' : '';
                    // Nota: o delta ELO é mostrado logo após o ELO na seção anterior
                }

                // Forma (Últimos 5 jogos) - usar do gameData se disponível
                if (gameData && gameData.form && gameData.form.length > 0) {
                    // Filtrar apenas resultados válidos (V, E, D)
                    const validForm = gameData.form.filter(outcome => outcome === 'V' || outcome === 'E' || outcome === 'D');

                    if (validForm.length > 0) {
                        html += '<div style="margin-top: 8px; display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">';
                        html += '<span style="font-size: 0.8em; color: #666; width: 100%; margin-bottom: 2px;">' + t('form') + ':</span>';
                        validForm.forEach(outcome => {
                            let color = '#6c757d';
                            let letter = '-';
                            if (outcome === 'V') { color = '#28a745'; letter = 'V'; }
                            else if (outcome === 'D') { color = '#dc3545'; letter = 'D'; }
                            else if (outcome === 'E') { color = '#ffc107'; letter = 'E'; }

                            html += '<span style="width: 16px; height: 16px; border-radius: 50%; background-color: ' + color + '; display: inline-flex; justify-content: center; align-items: center; color: #fff; font-size: 10px; font-weight: bold;" title="' + outcome + '">' + letter + '</span>';
                        });
                        html += '</div>';
                    }
                } else if (extraData.form && extraData.form.length > 0) {
                    // Fallback para forma atual se não há gameData
                    const validForm = extraData.form.filter(outcome => outcome === 'V' || outcome === 'E' || outcome === 'D');

                    if (validForm.length > 0) {
                        html += '<div style="margin-top: 8px; display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">';
                        html += '<span style="font-size: 0.8em; color: #666; width: 100%; margin-bottom: 2px;">' + t('form') + ':</span>';
                        validForm.forEach(outcome => {
                            let color = '#6c757d';
                            let letter = '-';
                            if (outcome === 'V') { color = '#28a745'; letter = 'V'; }
                            else if (outcome === 'D') { color = '#dc3545'; letter = 'D'; }
                            else if (outcome === 'E') { color = '#ffc107'; letter = 'E'; }

                            html += '<span style="width: 16px; height: 16px; border-radius: 50%; background-color: ' + color + '; display: inline-flex; justify-content: center; align-items: center; color: #fff; font-size: 10px; font-weight: bold;" title="' + outcome + '">' + letter + '</span>';
                        });
                        html += '</div>';
                    }
                }

                html += '</div>';
                return html;
            }
        }
    };

    eloChart = new ApexCharts(document.querySelector("#eloChart"), options);

    // Renderizar e aguardar conclusão
    eloChart.render().then(() => {
        removeChartAriaLabel();
        // Guardar a cor original de cada marker logo após renderizar
        const saveOriginalMarkerColors = () => {
            document.querySelectorAll('.apexcharts-marker').forEach(marker => {
                if (!marker.hasAttribute('data-original-fill')) {
                    const currentFill = marker.getAttribute('fill');
                    if (currentFill && currentFill !== 'none') {
                        marker.setAttribute('data-original-fill', currentFill);
                        // console.log('[DEBUG] Guardou cor original do marker:', currentFill);
                    }
                }
            });
        };

        // Guardar cores originais
        saveOriginalMarkerColors();

        // Se não conseguir na primeira vez, tentar novamente com delay (para garantir que SVG está pronto)
        setTimeout(saveOriginalMarkerColors, 100);

        // Adicionar observer para repositionar o tooltip com delay
        setTimeout(() => {
            const tooltipObserver = new MutationObserver(() => {
                removeChartAriaLabel();
                const tooltip = document.querySelector('.apexcharts-tooltip');
                if (tooltip && !window.tooltipFixed) {
                    const currentTop = parseInt(tooltip.style.top) || 0;
                    tooltip.style.top = (currentTop + 75) + 'px';
                    tooltip.style.pointerEvents = 'none';
                } else if (tooltip && window.tooltipFixed) {
                    // Manter a posição fixada e sempre visível
                    if (window.tooltipFixedPosition) {
                        tooltip.style.top = window.tooltipFixedPosition.top;
                        tooltip.style.left = window.tooltipFixedPosition.left;
                    }
                    tooltip.style.display = 'block';
                    tooltip.style.opacity = '1';
                    tooltip.style.pointerEvents = 'auto';
                }
            });

            // Garantir que o elemento existe antes de observar
            const eloChartElement = document.querySelector("#eloChart");
            if (eloChartElement && eloChartElement.parentElement) {
                tooltipObserver.observe(eloChartElement.parentElement, {
                    childList: true,
                    subtree: true
                });
            }
        }, 200);
    });
}

// Funções de pan manual removidas pois ApexCharts tem nativo

// Listener GLOBAL e ÚNICO para clique fora do gráfico
if (!window._chartClickListenerAdded) {
    document.addEventListener('click', function handleGlobalChartClick(e) {
        if (!window.tooltipFixed) return;

        const eloChartElement = document.querySelector('#eloChart');
        const isClickOutside = !eloChartElement || !eloChartElement.contains(e.target);

        if (isClickOutside) {
            // Resetar as flags de seleção
            window.tooltipFixed = null;
            window.tooltipFixedPosition = null;
            window.tooltipFixedDataPoint = null;

            // Esconder tooltip
            const tooltip = document.querySelector('.apexcharts-tooltip');
            if (tooltip) {
                tooltip.style.pointerEvents = 'none';
                tooltip.style.display = 'none';
                tooltip.removeAttribute('data-shifted');
            }

            // Remover atributo selected e resetar visual de todos os marcadores
            document.querySelectorAll('.apexcharts-marker[selected="true"]').forEach(marker => {
                // Obter a cor original guardada no atributo data
                let originalColor = marker.getAttribute('data-original-fill');

                if (!originalColor) {
                    // Fallback: tentar obter da série
                    if (eloChart && eloChart.opts.colors) {
                        const seriesIndex = marker.getAttribute('rel');
                        if (seriesIndex !== null) {
                            originalColor = eloChart.opts.colors[seriesIndex];
                        }
                    }
                    if (!originalColor) originalColor = '#ffffff';
                }

                // Resetar atributos diretamente sem substituir o elemento
                marker.setAttribute('fill', originalColor);
                marker.setAttribute('selected', 'false');
                marker.removeAttribute('filter');
                marker.style.filter = '';

                // Remover qualquer transformação ou estado hover
                marker.removeAttribute('transform');
            });
        }
    });

    window._chartClickListenerAdded = true;
}

// Funções de Zoom e Reset para ApexCharts
function zoomChart(factor) {
    if (!eloChart) return;

    // ApexCharts não tem zoom direto, mas podemos usar xaxis.min/max
    try {
        const xaxis = eloChart.opts.xaxis;
        if (xaxis && eloChart.w.globals.minX !== undefined && eloChart.w.globals.maxX !== undefined) {
            const minX = eloChart.w.globals.minX;
            const maxX = eloChart.w.globals.maxX;
            const range = maxX - minX;
            const center = (minX + maxX) / 2;
            const newRange = range / factor;
            const newMin = center - newRange / 2;
            const newMax = center + newRange / 2;

            eloChart.updateOptions({
                xaxis: {
                    min: newMin,
                    max: newMax
                }
            });
        }
    } catch (e) {
        console.error('Erro ao fazer zoom:', e);
    }
}

function resetZoom() {
    if (!eloChart) return;

    try {
        // Resetar o zoom para a vista original (sem afetar os dados/pontos)
        eloChart.zoomX(undefined, undefined);
    } catch (e) {
        console.error('Erro ao fazer reset:', e);
    }
}

function togglePanMode() {
    // ApexCharts tem modo pan nativo quando 'pan' está no toolbar
    // Esta função é para compatibilidade com event listener
}

// Atualizar gráfico ELO
// Funções de pan manual removidas pois ApexCharts tem nativo


// Função updateDynamicTeamLabels removida (legado Chart.js)

/**
 * Ajusta hora para o dia anterior se for entre 00:00 e 02:00
 * Jogos após meia-noite até 2 da manhã pertencem ao "dia anterior"
 */
function adjustDateForPostMidnightGame(date) {
    if (!date) return date;
    const hour = date.getHours();
    if (hour >= 0 && hour < 2) {
        // Descontar 1 dia
        const adjusted = new Date(date);
        adjusted.setDate(adjusted.getDate() - 1);
        return adjusted;
    }
    return date;
}

/**
 * Agrupa todos os jogos por dia (com ajuste para post-midnight)
 * e calcula o máximo de jogos em qualquer equipa para cada dia
 * NOTA: Apenas conta FASE REGULAR para expansão, não playoffs nem ajustes
 */
function groupGamesByDayAndCalculateMaxGames() {
    const dayToGames = new Map(); // Map<dayKey, Array<{team, round, time, date, originalDate}>>
    const dayToMaxTeamGames = new Map(); // Map<dayKey, maxCount>

    if (!sampleData.gameDetails) return { dayToGames, dayToMaxTeamGames };

    // Agrupar APENAS jogos da fase regular (não playoffs, não intergrupos)
    Object.entries(sampleData.gameDetails).forEach(([teamName, rounds]) => {
        Object.entries(rounds).forEach(([round, gameData]) => {
            if (!gameData || !gameData.date || gameData.isAdjustment) return;

            // Pular playoffs (rounds que começam com 'E')
            if (round.startsWith('E')) return;

            // Pular ajustes intergrupos
            if (round === 'Inter-Group') return;

            let originalDate = gameData.date;
            if (!(originalDate instanceof Date)) {
                originalDate = new Date(originalDate);
            }

            // Guardar hora original ANTES de ajustar
            const originalHours = originalDate.getHours();
            const originalMinutes = originalDate.getMinutes();
            const gameTime = originalHours * 60 + originalMinutes;

            // Ajustar data para post-midnight
            let adjustedDate = adjustDateForPostMidnightGame(originalDate);

            const year = adjustedDate.getFullYear();
            const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
            const day = String(adjustedDate.getDate()).padStart(2, '0');
            const dayKey = `${year}-${month}-${day}`;

            if (!dayToGames.has(dayKey)) {
                dayToGames.set(dayKey, []);
            }

            dayToGames.get(dayKey).push({
                team: teamName,
                round,
                time: gameTime, // Hora original para ordenação
                date: originalDate,
                adjustedDate: adjustedDate
            });
        });
    });

    // Calcular máximo de jogos por equipa para cada dia
    dayToGames.forEach((games, dayKey) => {
        // Contar quantos jogos cada equipa tem neste dia
        const teamGameCount = {};
        games.forEach(game => {
            teamGameCount[game.team] = (teamGameCount[game.team] || 0) + 1;
        });

        // Máximo é o maior número de jogos de qualquer equipa neste dia
        const maxCount = Math.max(...Object.values(teamGameCount));
        dayToMaxTeamGames.set(dayKey, maxCount);

        // Ordenar jogos por hora (original, para respeitar ordem 21, 23, 1)
        games.sort((a, b) => a.time - b.time);
    });

    return { dayToGames, dayToMaxTeamGames };
}

function updateEloChart() {
    if (!eloChart || !sampleData.teams || sampleData.teams.length === 0) {
        return;
    }

    const checkboxes = document.querySelectorAll('#teamSelector input[type="checkbox"]');
    const selectedTeams = [];

    checkboxes.forEach(cb => {
        if (cb.checked) {
            const teamObj = sampleData.teams.find(t => t.name === cb.dataset.teamName);
            if (teamObj) selectedTeams.push(teamObj);
        }
    });

    if (selectedTeams.length === 0) {
        eloChart.updateSeries([]);
        eloChart.updateOptions({ xaxis: { categories: [] } });
        return;
    }



    // 1. Usar timeline global construída pelo processador (alinha com eloHistory)
    let allDates = Array.isArray(sampleData.gamesDates) ? sampleData.gamesDates : [];

    // CRÍTICO: Deduplicar allDates por dia (E2/E3/E3L no mesmo dia só devem contar 1 vez)
    const allDatesMap = new Map();
    allDates.forEach(date => {
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (!allDatesMap.has(dateKey)) {
            allDatesMap.set(dateKey, date);
        } else {
            // Manter a data com hora mais cedo
            const existing = allDatesMap.get(dateKey);
            if (date < existing) {
                allDatesMap.set(dateKey, date);
            }
        }
    });
    allDates = Array.from(allDatesMap.values()).sort((a, b) => a - b);

    // Mapear rounds de playoff por dia (para colapsar E3/E3L)
    const playoffRoundsByDay = new Map(); // Map<dayKey, Set<round>>
    if (sampleData.gameDetails) {
        Object.entries(sampleData.gameDetails).forEach(([teamName, rounds]) => {
            Object.entries(rounds || {}).forEach(([round, gameInfo]) => {
                if (!gameInfo || !gameInfo.date) return;
                if (!round || !round.startsWith('E')) return; // apenas playoffs

                let gameDate = gameInfo.date instanceof Date ? gameInfo.date : new Date(gameInfo.date);
                gameDate = adjustDateForPostMidnightGame(gameDate);
                const year = gameDate.getFullYear();
                const month = String(gameDate.getMonth() + 1).padStart(2, '0');
                const day = String(gameDate.getDate()).padStart(2, '0');
                const dayKey = `${year}-${month}-${day}`;

                if (!playoffRoundsByDay.has(dayKey)) {
                    playoffRoundsByDay.set(dayKey, new Set());
                }
                playoffRoundsByDay.get(dayKey).add(round);
            });
        });
    }

    if (!allDates.length) {
        eloChart.updateSeries([]);
        eloChart.updateOptions({ xaxis: { categories: [] } });
        return;
    }

    // Verificar se há equipas da época anterior
    const hasPreviousSeasonData = sampleData.teamsFromPreviousSeason && sampleData.teamsFromPreviousSeason.size > 0;
    const previousSeasonIndex = hasPreviousSeasonData ? 0 : -1;
    const initialSeasonIndex = hasPreviousSeasonData ? 1 : 0;

    // DEBUG: Verificar duplicatas em allDates
    const dateKeyCounts = {};
    allDates.forEach(d => {
        const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dateKeyCounts[dk] = (dateKeyCounts[dk] || 0) + 1;
    });
    const duplicateDays = Object.entries(dateKeyCounts).filter(([k, v]) => v > 1);
    if (duplicateDays.length > 0) {
        console.warn('[DEBUG] allDates tem dias duplicados:', duplicateDays);
    }

    // Agrupar jogos por dia e calcular máximo de jogos
    const { dayToGames, dayToMaxTeamGames } = groupGamesByDayAndCalculateMaxGames();

    // Criar timeline expandida com múltiplos slots para dias com múltiplos jogos
    const expandedDates = [];
    const slotToOriginalIndex = new Map(); // Map<slotIndex, originalDateIndex>
    const slotIndexByOriginalDay = new Map(); // Map<originalDateIndex, [slotIndices]>

    allDates.forEach((d, idx) => {
        const dateObj = new Date(d);

        // Para datas não-especiais (não início/época anterior), expandir se houver múltiplos jogos
        const isPreviousSeason = hasPreviousSeasonData && idx === 0;
        const isInitial = idx === initialSeasonIndex;

        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dayKey = `${year}-${month}-${day}`;

        const slotIndices = [];

        if (!isPreviousSeason && !isInitial) {
            // Calcular slots para o dia: fase regular + playoffs (E3/E3L colapsam)
            let slotsForDay = 1;
            const maxGames = dayToMaxTeamGames.get(dayKey);
            if (maxGames !== undefined && maxGames > 1) {
                slotsForDay = maxGames;
            }

            const playoffRounds = playoffRoundsByDay.get(dayKey);
            if (playoffRounds && playoffRounds.size > 0) {
                let playoffSlots = playoffRounds.size;
                // E3 e E3L contam como um único slot (acontecem no mesmo bloco)
                if (playoffRounds.has('E3') && playoffRounds.has('E3L')) {
                    playoffSlots -= 1;
                }
                playoffSlots = Math.max(playoffSlots, 1);
                slotsForDay = Math.max(slotsForDay, playoffSlots);
            }

            for (let i = 0; i < slotsForDay; i++) {
                const slotDate = new Date(dateObj);
                expandedDates.push(slotDate);
                const newSlotIndex = expandedDates.length - 1;
                slotToOriginalIndex.set(newSlotIndex, idx);
                slotIndices.push(newSlotIndex);
            }
        } else {
            // Data especial: apenas 1 slot
            expandedDates.push(dateObj);
            const newSlotIndex = expandedDates.length - 1;
            slotToOriginalIndex.set(newSlotIndex, idx);
            slotIndices.push(newSlotIndex);
        }

        slotIndexByOriginalDay.set(idx, slotIndices);
    });

    const dateLocale = getDateLocale();
    const timelineSlots = expandedDates.map((d, idx) => {
        const dateObj = new Date(d);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dayKey = `${year}-${month}-${day}`;

        // Encontrar índice original desta data
        const originalIndex = slotToOriginalIndex.get(idx) ?? -1;

        const isPreviousSeason = hasPreviousSeasonData && originalIndex === 0;
        const isInitial = originalIndex === initialSeasonIndex;

        let label;
        if (isPreviousSeason) {
            label = t('previousSeason');
        } else if (isInitial) {
            label = t('seasonStart');
        } else {
            // Para múltiplos slots do mesmo dia, adicionar sub-índice
            const slotIndices = slotIndexByOriginalDay.get(originalIndex) || [];
            if (slotIndices.length > 1) {
                const slotPosition = slotIndices.indexOf(idx) + 1;
                label = `${dateObj.toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' })} (${slotPosition}/${slotIndices.length})`;
            } else {
                label = dateObj.toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' });
            }
        }

        return {
            timestamp: dateObj.getTime(),
            dayKey,
            slotIndex: idx,
            originalDateIndex: originalIndex,
            isVirtual: isInitial,
            isPreviousSeason: isPreviousSeason,
            label: label
        };
    });

    // Atualizar categorias do Eixo X
    eloChart.updateOptions({
        xaxis: {
            categories: timelineSlots.map(slot => slot.label)
        }
    });

    const series = [];

    // 2. Mapear dados de cada equipa para esta Timeline expandida
    selectedTeams.forEach(team => {
        const teamName = team.name;
        const normalizedTeamName = normalizeTeamName(teamName);
        const isMaterialsTeam = normalizedTeamName === 'Educação Básica';
        const eloHistory = sampleData.eloHistory[normalizedTeamName];
        if (!eloHistory) return;



        const teamGameDetails = sampleData.gameDetails ? sampleData.gameDetails[normalizedTeamName] : {};

        // Mapear rounds para índices na timeline
        const roundToIndexMap = {};



        // Mapear cada round para seu slot expandido
        // Para dias com múltiplos jogos, precisamos encontrar o slot correto baseado na hora

        const roundToSlotIndices = new Map(); // Map<round, [slotIndices onde este round pode aparecer]>

        // Primeiro, agrupar rounds da equipa por dia
        const teamRoundsByDay = new Map(); // Map<dayKey, [rounds]>

        Object.entries(teamGameDetails || {}).forEach(([round, gameInfo]) => {
            if (!gameInfo || !gameInfo.date || gameInfo.isAdjustment) return;

            let gameDate = gameInfo.date;
            if (!(gameDate instanceof Date)) {
                gameDate = new Date(gameDate);
            }

            // Guardar hora original ANTES do ajuste
            const originalHours = gameDate.getHours();
            const originalMinutes = gameDate.getMinutes();

            // Ajustar para post-midnight
            gameDate = adjustDateForPostMidnightGame(gameDate);

            const year = gameDate.getFullYear();
            const month = String(gameDate.getMonth() + 1).padStart(2, '0');
            const day = String(gameDate.getDate()).padStart(2, '0');
            const dayKey = `${year}-${month}-${day}`;

            if (!teamRoundsByDay.has(dayKey)) {
                teamRoundsByDay.set(dayKey, []);
            }

            // CRÍTICO: Calcular time considerando ajuste post-midnight
            // Jogos às 00:00-01:59 são tratados como 24:00+ do dia anterior
            let sortTime = originalHours * 60 + originalMinutes;
            if (originalHours >= 0 && originalHours < 2) {
                sortTime = (24 + originalHours) * 60 + originalMinutes;
            }

            teamRoundsByDay.get(dayKey).push({
                round,
                time: sortTime,
                gameInfo
            });
        });

        // Ordenar rounds de cada dia por hora
        teamRoundsByDay.forEach((rounds, dayKey) => {
            rounds.sort((a, b) => a.time - b.time);

            // Agora encontrar os slots expandidos para este dia
            const slotIndices = [];
            for (let i = 0; i < timelineSlots.length; i++) {
                if (timelineSlots[i].dayKey === dayKey &&
                    !timelineSlots[i].isPreviousSeason &&
                    !timelineSlots[i].isVirtual) {
                    slotIndices.push(i);
                }
            }

            // Mapear cada round do dia para seu slot correspondente (1º round -> 1º slot, etc)
            rounds.forEach((roundData, position) => {
                if (position < slotIndices.length) {
                    roundToSlotIndices.set(roundData.round, slotIndices[position]);
                } else {
                    // Se há mais rounds que slots, usar o último slot
                    roundToSlotIndices.set(roundData.round, slotIndices[slotIndices.length - 1]);
                }
            });
        });

        // Adicionar rounds especiais (época anterior, ajustes inter-grupos, etc)
        Object.entries(teamGameDetails || {}).forEach(([round, gameInfo]) => {
            if (!gameInfo || !gameInfo.date) return;

            let gameDate = gameInfo.date;
            if (!(gameDate instanceof Date)) {
                gameDate = new Date(gameDate);
            }

            // NÃO ajustar post-midnight para rounds especiais
            const year = gameDate.getFullYear();
            const month = String(gameDate.getMonth() + 1).padStart(2, '0');
            const day = String(gameDate.getDate()).padStart(2, '0');
            const dayKey = `${year}-${month}-${day}`;

            if (round === 'Inter-Group' && !roundToSlotIndices.has(round)) {
                // Encontrar o slot da data inter-group
                const slotIndex = timelineSlots.findIndex(slot => slot.dayKey === dayKey);
                if (slotIndex >= 0) {
                    roundToSlotIndices.set(round, slotIndex);
                }
            }
        });

        // Processar todos os pontos da timeline para esta equipa
        const dataPoints = [];
        const extraDataPoints = [];
        let lastKnownElo = null;
        let lastGameForm = [];  // Rastrear a forma do último jogo

        // Verificar se esta equipa estava na época anterior
        const teamWasInPreviousSeason = sampleData.teamsFromPreviousSeason &&
            sampleData.teamsFromPreviousSeason.has(normalizedTeamName);

        timelineSlots.forEach((slot, idx) => {
            // Se é o ponto da época anterior e a equipa não estava lá, pular este ponto
            if (slot.isPreviousSeason && !teamWasInPreviousSeason) {
                dataPoints.push(null);
                extraDataPoints.push({});
                return;
            }

            let sourceTag = 'carry-forward';

            // Tentar obter jogo usando o mapa de rounds para slots expandidos
            let gameData = null;
            let round = null;

            // Procurar se há algum round mapeado para este slot
            for (const [r, slotIndex] of roundToSlotIndices.entries()) {
                if (slotIndex === idx) {
                    round = r;
                    gameData = teamGameDetails[r];
                    break;
                }
            }

            // CORREÇÃO CRÍTICA: O eloHistory e os slots não têm mapeamento 1:1
            // porque cada jogo adiciona 2 valores (data do jogo + dia seguinte).
            // Quando há gameData, devemos usar o ELO final do jogo (finalElo).
            // Quando NÃO há gameData, devemos usar o último ELO conhecido (lastKnownElo).
            let eloValue;
            if (gameData && gameData.finalElo !== undefined) {
                // Usar o ELO final do jogo (valor APÓS o jogo)
                eloValue = gameData.finalElo;
                lastKnownElo = eloValue; // Atualizar último ELO conhecido
                sourceTag = 'game';
            } else if (lastKnownElo !== null) {
                // Sem jogo neste slot: usar o último ELO conhecido (manter linha horizontal)
                eloValue = lastKnownElo;
                sourceTag = 'carry-forward';
            } else {
                // Pontos especiais (época anterior, início): usar eloHistory[idx]
                eloValue = eloHistory[idx];
                if (eloValue !== null && eloValue !== undefined && !isNaN(eloValue)) {
                    lastKnownElo = eloValue;
                }
                sourceTag = 'raw-history';
            }

            const numericElo = (eloValue === null || eloValue === undefined || isNaN(eloValue)) ? null : Math.round(eloValue);

            let extra = {};

            // Verificar se existe um ajuste inter-grupos para esta jornada
            const interGroupData = teamGameDetails["Inter-Group"] || null;

            if (gameData && gameData.opponent) {
                // Tem dados de jogo!
                extra.opponent = gameData.opponent;
                extra.result = gameData.result;
                extra.round = round;
                extra.fullDate = gameData.date;
                extra.eloDelta = gameData.eloDelta || null;

                // A forma mostrada no ponto do jogo deve ser APÓS o jogo (incluindo resultado deste jogo)
                // gameData.form contém os últimos 5 ANTES deste jogo
                // Precisamos adicionar o resultado deste jogo para mostrar a forma APÓS
                if (gameData.outcome && ['V', 'E', 'D'].includes(gameData.outcome)) {
                    const formBeforeGame = gameData.form || [];
                    const formAfterGame = [...formBeforeGame, gameData.outcome].slice(-5);
                    extra.form = formAfterGame;
                    lastGameForm = formAfterGame;  // Guardar para propagar aos pontos seguintes
                } else {
                    // Jogo sem resultado conhecido - manter forma anterior
                    extra.form = gameData.form || [];
                    lastGameForm = gameData.form || [];
                }

                dataPoints.push(numericElo);
                extraDataPoints.push(extra);

                if (numericElo !== null) {
                    lastKnownElo = numericElo;
                }

            } else if (slot.isPreviousSeason) {
                // Ponto da época anterior
                extra.description = t('eloFinalPreviousSeason');
                extra.fullDate = new Date(slot.timestamp).toISOString();
                extra.form = [];  // Sem forma na época anterior

                dataPoints.push(numericElo);
                extraDataPoints.push(extra);

            } else if (slot.isVirtual) {
                // Ponto do início da época (não é época anterior)
                extra.description = t('eloSeasonStart');
                extra.fullDate = new Date(slot.timestamp).toISOString();
                extra.form = [];  // Sem forma no início

                dataPoints.push(numericElo);
                extraDataPoints.push(extra);

            } else {
                // Ponto sem jogo: usar o último ELO conhecido
                extra.fullDate = new Date(slot.timestamp).toISOString();
                extra.form = lastGameForm;  // Herdar a forma do último jogo

                dataPoints.push(numericElo);
                extraDataPoints.push(extra);

                if (numericElo !== null) {
                    lastKnownElo = numericElo;
                }

            }
        });

        // NOTA: ApexCharts só aceita {name, data} nas séries
        // Os dados extras são guardados separadamente em appState
        series.push({
            name: normalizedTeamName,
            data: dataPoints
        });

        // Guardar extraData e cor separadamente para a tooltip
        // Fallback: se não houver cor, obter do config ou gerar uma cor aleatória
        let teamColor = team.color;
        if (!teamColor) {
            const courseInfo = getCourseInfo(normalizedTeamName);
            teamColor = courseInfo.primaryColor;
        }

        if (!window._chartExtraData) window._chartExtraData = {};
        window._chartExtraData[normalizedTeamName] = {
            color: teamColor,
            extraData: extraDataPoints
        };

    });

    // REORDENAR SÉRIES POR ELO FINAL (descending)
    // CRÍTICO: Usar sampleData.eloHistory (valor real final), não s.data (valor intermédio)
    series.sort((a, b) => {
        const getLastValidElo = (teamName) => {
            // USAR APENAS eloHistory - é o valor final verdadeiro
            if (sampleData && sampleData.eloHistory && sampleData.eloHistory[teamName]) {
                const history = sampleData.eloHistory[teamName];
                for (let i = history.length - 1; i >= 0; i--) {
                    if (history[i] !== null && history[i] !== undefined && !isNaN(history[i])) {
                        return history[i];
                    }
                }
            }
            return 0;
        };

        const eloA = getLastValidElo(a.name);
        const eloB = getLastValidElo(b.name);
        return eloB - eloA; // Ordenar em ordem descending (maior primeiro)
    });

    // Adicionar pontos para "Ajustes Inter-Grupos" se existirem
    // Primeiro verificar se há algum ajuste
    let hasAnyInterGroupAdjustments = false;
    for (let team of selectedTeams) {
        const normalizedTeamName = normalizeTeamName(team.name);
        const teamGameDetails = sampleData.gameDetails ? sampleData.gameDetails[normalizedTeamName] : {};
        const interGroupData = teamGameDetails["Inter-Group"];
        if (interGroupData && interGroupData.isAdjustment && interGroupData.eloDelta) {
            hasAnyInterGroupAdjustments = true;
            break;
        }
    }

    selectedTeams.forEach(team => {
        const teamName = team.name;
        const normalizedTeamName = normalizeTeamName(teamName);
        const teamGameDetails = sampleData.gameDetails ? sampleData.gameDetails[normalizedTeamName] : {};
        const interGroupData = teamGameDetails["Inter-Group"];
        const isMaterialsTeam = normalizedTeamName === 'Educação Básica';

        if (interGroupData && interGroupData.isAdjustment && interGroupData.eloDelta) {
            // Encontrar a série desta equipa
            const seriesIndex = series.findIndex(s => s.name === normalizedTeamName);
            if (seriesIndex >= 0) {
                // Obter o último ELO
                const dataPoints = series[seriesIndex].data;
                const lastEloIndex = dataPoints.length - 1;
                const lastElo = dataPoints[lastEloIndex] !== null ? dataPoints[lastEloIndex] : null;

                if (lastElo !== null) {
                    const adjustedElo = lastElo + interGroupData.eloDelta;

                    // Adicionar ponto à série
                    dataPoints.push(adjustedElo);
                    // Garantir que o objeto existe
                    if (!window._chartExtraData[normalizedTeamName]) {
                        window._chartExtraData[normalizedTeamName] = { color: team.color, extraData: [] };
                    }

                    // Adicionar dados extras
                    const extraData = window._chartExtraData[normalizedTeamName].extraData;
                    extraData.push({
                        description: t('interGroupAdjustments'),
                        opponent: null,
                        result: null,
                        round: 'Inter-Group',
                        fullDate: new Date().toISOString(),
                        eloDelta: interGroupData.eloDelta,
                        form: extraData[lastEloIndex]?.form || [],
                        isInterGroupAdjustment: true
                    });

                }
            }
        } else {
            // Só adicionar pontos fillers se há ajustes noutras equipas
            if (hasAnyInterGroupAdjustments) {
                const seriesIndex = series.findIndex(s => s.name === normalizedTeamName);
                if (seriesIndex >= 0) {
                    const dataPoints = series[seriesIndex].data;

                    // Encontrar o último ELO válido
                    let lastValidElo = null;
                    for (let i = dataPoints.length - 1; i >= 0; i--) {
                        if (dataPoints[i] !== null) {
                            lastValidElo = dataPoints[i];
                            break;
                        }
                    }

                    // Adicionar ponto com mesmo ELO (filler)
                    dataPoints.push(lastValidElo);

                    const extraData = window._chartExtraData[normalizedTeamName].extraData;
                    extraData.push({
                        description: null,
                        opponent: null,
                        result: null,
                        round: null,
                        fullDate: new Date().toISOString(),
                        eloDelta: null,
                        form: []
                    });

                }
            }
        }
    });


    // Validar que temos séries e dados
    if (!series || series.length === 0) {
        console.warn('[ERRO] Nenhuma série de dados! Equipas selecionadas?');
        // Se não há dados, fazer updateSeries vazio para limpar
        if (eloChart) {
            eloChart.updateSeries([]);
        }
        return;
    }

    // Armazenar os dados das séries globalmente para uso na tooltip
    appState.chart.currentSeriesData = series;

    // Verificar se há algum "Ajustes Inter-Grupos" nas séries
    let hasInterGroupAdjustments = false;
    if (window._chartExtraData) {
        for (let teamName in window._chartExtraData) {
            const extraData = window._chartExtraData[teamName].extraData;
            if (extraData && extraData.some(item => item.isInterGroupAdjustment)) {
                hasInterGroupAdjustments = true;
                break;
            }
        }
    }

    // Adicionar categoria "Ajustes Inter-Grupos" se existir
    let categories = timelineSlots.map(slot => slot.label);
    if (hasInterGroupAdjustments) {
        categories.push(t('interGroupAdjustments'));
    }


    // Destruir o gráfico existente e recrear com dados completos
    // Isto força ApexCharts a renderizar os marcadores com o tamanho correto desde o início
    if (eloChart) {
        eloChart.destroy();
        eloChart = null;
    }

    const chartContainer = document.querySelector("#eloChart");
    if (!chartContainer) {
        console.error('[ERRO] Container #eloChart não encontrado!');
        return;
    }

    // CRÍTICO: Limpar completamente o container antes de recrear
    // ApexCharts deixa SVG residual que bloqueia a nova renderização
    chartContainer.innerHTML = '';


    // Recrear com toda a configuração original + dados
    const options = {
        series: series, // Dados já estruturados
        chart: {
            id: 'eloChart',
            type: 'line',
            height: '100%',
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    selection: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: false
                },
                autoSelected: 'zoom'
            },
            animations: {
                enabled: false
            },
            events: {
                dataPointSelection: function (event, chartContext, config) {
                    if (window.tooltipFixed &&
                        window.tooltipFixedDataPoint &&
                        window.tooltipFixedDataPoint.seriesIndex === config.seriesIndex &&
                        window.tooltipFixedDataPoint.dataPointIndex === config.dataPointIndex) {
                        window.tooltipFixed = null;
                        window.tooltipFixedPosition = null;
                        window.tooltipFixedDataPoint = null;
                    } else {
                        const wasFixed = window.tooltipFixed;
                        window.tooltipFixed = null;
                        window.tooltipFixedPosition = null;

                        window.tooltipFixedDataPoint = {
                            seriesIndex: config.seriesIndex,
                            dataPointIndex: config.dataPointIndex
                        };

                        setTimeout(() => {
                            const tooltip = document.querySelector('.apexcharts-tooltip');
                            if (tooltip && tooltip.style.display !== 'none') {
                                window.tooltipFixed = true;
                                window.tooltipFixedPosition = {
                                    top: tooltip.style.top,
                                    left: tooltip.style.left
                                };
                                tooltip.style.pointerEvents = 'auto';
                            }
                        }, 100);
                    }
                }
            }
        },
        colors: series.map(s => {
            // Obter a cor baseado no nome da série (que já está reordenada)
            const team = sampleData.teams.find(t => t.name === s.name);
            if (team && team.color) {
                return team.color;
            }
            // Fallback se não encontrar a cor
            const courseInfo = getCourseInfo(s.name);
            return courseInfo.primaryColor;
        }),
        stroke: {
            width: 3,
            curve: 'smooth',  // smooth funciona melhor com dados esparsos
            connectNullData: true,  // Conectar linhas sobre valores null
            colors: series.map(s => {
                // Obter a cor baseado no nome da série (que já está reordenada)
                const team = sampleData.teams.find(t => t.name === s.name);
                if (team && team.color) {
                    return team.color;
                }
                // Fallback se não encontrar a cor
                const courseInfo = getCourseInfo(s.name);
                return courseInfo.primaryColor;
            })
        },
        fill: {
            type: 'solid'
        },
        grid: {
            borderColor: '#f1f1f1',
            xaxis: {
                lines: {
                    show: true
                }
            }
        },
        markers: {
            size: 6,
            strokeWidth: 2,
            strokeOpacity: 1,
            fillOpacity: 1,
            hover: {
                size: 8,
                sizeOffset: 2
            }
        },
        xaxis: {
            categories: categories,
            tooltip: {
                enabled: false
            },
            labels: {
                rotate: -45,
                hideOverlappingLabels: true
            }
        },
        yaxis: {
            title: {
                text: t('eloRatingLabel')
            }
        },
        legend: {
            show: false
        },
        tooltip: {
            enabled: true,
            shared: false,
            intersect: true,
            followCursor: false,
            offsetY: 100,
            offsetX: 10,
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                if (window.tooltipFixed && window.tooltipFixedDataPoint) {
                    seriesIndex = window.tooltipFixedDataPoint.seriesIndex;
                    dataPointIndex = window.tooltipFixedDataPoint.dataPointIndex;
                }

                const currentSeries = appState.chart.currentSeriesData;

                if (!currentSeries || !currentSeries[seriesIndex]) {
                    return '';
                }

                const seriesData = currentSeries[seriesIndex];
                const eloValue = seriesData.data[dataPointIndex];

                // Verificar se o valor é null
                if (eloValue === null || eloValue === undefined) {
                    return '';
                }

                const teamKey = normalizeTeamName(seriesData.name);
                // Os dados extras estão guardados separadamente em window._chartExtraData
                const chartExtra = window._chartExtraData && window._chartExtraData[teamKey];
                const extraData = (chartExtra && chartExtra.extraData && chartExtra.extraData[dataPointIndex]) || {};


                let dateDisplay = '';
                const dateLocale = getDateLocale();
                if (extraData.fullDate) {
                    dateDisplay = new Date(extraData.fullDate).toLocaleDateString(dateLocale);
                } else if (w.globals.labels && w.globals.labels[dataPointIndex]) {
                    dateDisplay = String(w.globals.labels[dataPointIndex]);
                } else {
                    dateDisplay = t('unknownDate');
                }

                const courseInfo = getCourseInfo(teamKey);
                const displayTeamName = getTranslatedTeamLabel(courseInfo, teamKey);
                const logoPath = courseInfo.emblemPath || 'assets/taça_ua.png';
                const teamColor = w.globals.colors[seriesIndex];

                let html = '<div class="apexcharts-tooltip-title" style="background: #fff; color: #333; font-family: Segoe UI; display: flex; align-items: center; justify-content: space-between; padding: 0px 0px; border-bottom: none;">';
                html += '<span style="font-weight: 600; padding: 0px 10px;">' + displayTeamName + '</span>';

                let emblemaStyle = 'height: 48px;';
                if (logoPath.includes('EGI-07.png')) {
                    emblemaStyle = 'height: 48px; padding: 8px;';
                }
                html += '<img src="' + logoPath + '" style="' + emblemaStyle + '" alt="' + displayTeamName + '">';
                html += '</div>';
                html += '<div style="height: 3px; background: ' + teamColor + ';"></div>';
                html += '<div class="apexcharts-tooltip-body" style="font-family: Segoe UI; padding: 8px 8px;">';

                html += '<div><strong>ELO: ' + eloValue + '</strong>';

                if (extraData.eloDelta && Math.abs(extraData.eloDelta) > 0.01 || extraData.isInterGroupAdjustment) {
                    const isPos = extraData.eloDelta > 0;
                    const color = isPos ? '#28a745' : '#dc3545';
                    const sign = isPos ? '+' : '';
                    html += '<span style="color: ' + color + '; margin-left: 8px; font-weight: bold;">' + sign + extraData.eloDelta + '</span>';
                }
                html += '</div>';

                let gameData = extraData.opponent ? extraData : null;
                let isLastGame = false;

                if (!gameData && chartExtra && chartExtra.extraData && !extraData.isInterGroupAdjustment) {
                    for (let i = dataPointIndex - 1; i >= 0; i--) {
                        const prevExtra = chartExtra.extraData[i];
                        if (prevExtra && prevExtra.opponent) {
                            gameData = prevExtra;
                            isLastGame = true;
                            break;
                        }
                    }
                }

                if (gameData) {
                    html += '<div style="padding-top: 8px;">';

                    let roundLabel = gameData.round;
                    if (roundLabel === 'E1') roundLabel = t('roundQuarters');
                    else if (roundLabel === 'E2') roundLabel = t('roundSemiFinals');
                    else if (roundLabel === 'E3L') roundLabel = t('thirdPlace');
                    else if (roundLabel === 'E3') roundLabel = t('roundFinal');
                    else if (typeof roundLabel === 'string' && roundLabel.startsWith('J')) {
                        // Já está formatado
                    } else if (roundLabel && !isNaN(roundLabel)) {
                        roundLabel = t('matchday') + ' ' + roundLabel;
                    }

                    const gameDate = gameData.fullDate ? new Date(gameData.fullDate).toLocaleDateString(dateLocale) : dateDisplay;
                    if (isLastGame) {
                        html += '<div style="color: #999; font-size: 0.85em; margin-bottom: 2px;">(' + t('lastGame') + ')</div>';
                    }
                    html += '<div style="color: #666; font-size: 0.9em;">' + (roundLabel || '') + ' • ' + gameDate + '</div>';
                    const translatedOpponentCalendar = translateTeamName(gameData.opponent);
                    html += '<div style="font-weight: 600; margin-top: 2px;">' + (gameData.result + ' vs ' + translatedOpponentCalendar) + '</div>';
                    html += '</div>';
                } else if (extraData.isInterGroupAdjustment) {
                    // Encontrar o ELO antes do ajuste (último ponto válido antes deste)
                    let eloBeforeAdjustment = null;
                    if (dataPointIndex > 0 && chartExtra && chartExtra.extraData) {
                        for (let i = dataPointIndex - 1; i >= 0; i--) {
                            if (seriesData.data[i] !== null && seriesData.data[i] !== undefined) {
                                eloBeforeAdjustment = seriesData.data[i];
                                break;
                            }
                        }
                    }

                    if (eloBeforeAdjustment !== null && extraData.eloDelta) {
                        html += '<div style="font-size: 0.9em; color: #666;">';
                        html += '<div style="font-weight: 600; margin-top: 2px;">' + extraData.description + '</div>'
                    } else {
                        html += '<div style="font-size: 0.9em; color: #666;">' + t('eloFinal') + ': <strong>' + eloValue + '</strong></div>';
                    }

                    html += '</div>';
                } else {
                    html += '<div style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px; color: #666; font-size: 0.9em;">' + dateDisplay + '</div>';
                    if (extraData.description) {
                        html += '<div style="font-weight: 600; margin-top: 2px;">' + extraData.description + '</div>';
                    }
                }

                if (gameData && gameData.form && gameData.form.length > 0) {
                    const validForm = gameData.form.filter(outcome => outcome === 'V' || outcome === 'E' || outcome === 'D');

                    if (validForm.length > 0) {
                        html += '<div style="margin-top: 8px; display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">';
                        html += '<span style="font-size: 0.8em; color: #666; width: 100%; margin-bottom: 2px;">' + t('form') + ':</span>';
                        validForm.forEach(outcome => {
                            let color = '#6c757d';
                            let letter = '-';
                            if (outcome === 'V') { color = '#28a745'; letter = 'V'; }
                            else if (outcome === 'D') { color = '#dc3545'; letter = 'D'; }
                            else if (outcome === 'E') { color = '#ffc107'; letter = 'E'; }

                            html += '<span style="width: 16px; height: 16px; border-radius: 50%; background-color: ' + color + '; display: inline-flex; justify-content: center; align-items: center; color: #fff; font-size: 10px; font-weight: bold;" title="' + outcome + '">' + letter + '</span>';
                        });
                        html += '</div>';
                    }
                } else if (extraData && extraData.form && extraData.form.length > 0) {
                    // console.log('[DEBUG] Renderizando form de extraData:', extraData.form);
                    const validForm = extraData.form.filter(outcome => outcome === 'V' || outcome === 'E' || outcome === 'D');

                    if (validForm.length > 0) {
                        html += '<div style="margin-top: 8px; display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">';
                        html += '<span style="font-size: 0.8em; color: #666; width: 100%; margin-bottom: 2px;">' + t('form') + ':</span>';
                        validForm.forEach(outcome => {
                            let color = '#6c757d';
                            let letter = '-';
                            if (outcome === 'V') { color = '#28a745'; letter = 'V'; }
                            else if (outcome === 'D') { color = '#dc3545'; letter = 'D'; }
                            else if (outcome === 'E') { color = '#ffc107'; letter = 'E'; }

                            html += '<span style="width: 16px; height: 16px; border-radius: 50%; background-color: ' + color + '; display: inline-flex; justify-content: center; align-items: center; color: #fff; font-size: 10px; font-weight: bold;" title="' + outcome + '">' + letter + '</span>';
                        });
                        html += '</div>';
                    }
                }

                html += '</div>';
                return html;
            }
        }
    };

    eloChart = new ApexCharts(chartContainer, options);
    eloChart.render().then(removeChartAriaLabel);

    // Guardar a cor original de cada marker logo após renderizar
    const saveOriginalMarkerColors = () => {
        document.querySelectorAll('.apexcharts-marker').forEach(marker => {
            if (!marker.hasAttribute('data-original-fill')) {
                const currentFill = marker.getAttribute('fill');
                if (currentFill && currentFill !== 'none') {
                    marker.setAttribute('data-original-fill', currentFill);
                    // console.log('[DEBUG] Guardou cor original do marker:', currentFill);
                }
            }
        });
    };

    // Guardar cores originais
    saveOriginalMarkerColors();

    // Se não conseguir na primeira vez, tentar novamente com delay (para garantir que SVG está pronto)
    setTimeout(saveOriginalMarkerColors, 100);

    // Adicionar observer para repositionar o tooltip (sem acumular deslocamento)
    const tooltipObserver = new MutationObserver(() => {
        const tooltip = document.querySelector('.apexcharts-tooltip');
        if (tooltip && tooltip.style.display === 'none') {
            // Reset de estado quando o tooltip é escondido
            tooltip.removeAttribute('data-shifted');
        }

        if (tooltip && !window.tooltipFixed) {
            if (!tooltip.getAttribute('data-shifted')) {
                const currentTop = parseInt(tooltip.style.top) || 0;
                tooltip.style.top = (currentTop + 75) + 'px';
                tooltip.setAttribute('data-shifted', 'true');
            }
            tooltip.style.pointerEvents = 'none';
        } else if (tooltip && window.tooltipFixed) {
            if (window.tooltipFixedPosition) {
                tooltip.style.top = window.tooltipFixedPosition.top;
                tooltip.style.left = window.tooltipFixedPosition.left;
            }
            tooltip.style.display = 'block';
            tooltip.style.opacity = '1';
            tooltip.style.pointerEvents = 'auto';
        }
    });

    tooltipObserver.observe(chartContainer.parentElement, {
        childList: true,
        subtree: true
    });

    // ==================== SYSTEM DE OPACIDADE DINÂMICA ====================
    /**
     * Atualiza opacidade das linhas quando o rato passa sobre uma
     */
    const updateLineOpacity = (hoveredSeriesIndex) => {
        const svgElement = chartContainer.querySelector('svg');
        if (!svgElement) return;

        const paths = svgElement.querySelectorAll('.apexcharts-series-' + hoveredSeriesIndex + ' path.apexcharts-line');
        paths.forEach(path => {
            path.style.strokeOpacity = '1';
            path.style.strokeWidth = (3 + 1) + 'px';
        });

        // Reduzir opacidade das outras séries
        for (let i = 0; i < series.length; i++) {
            if (i !== hoveredSeriesIndex) {
                const otherPaths = svgElement.querySelectorAll('.apexcharts-series-' + i + ' path.apexcharts-line');
                otherPaths.forEach(path => {
                    path.style.strokeOpacity = '0.15';
                });
            }
        }
    };

    /**
     * Restaura opacidade normal de todas as linhas
     */
    const resetLineOpacity = () => {
        const svgElement = chartContainer.querySelector('svg');
        if (!svgElement) return;

        for (let i = 0; i < series.length; i++) {
            const paths = svgElement.querySelectorAll('.apexcharts-series-' + i + ' path.apexcharts-line');
            paths.forEach(path => {
                path.style.strokeOpacity = '1';
                path.style.strokeWidth = '3px';
            });
        }
    };

    // Adicionar listeners de hover ao seletor de equipas
    const teamCheckboxes = document.querySelectorAll('#teamSelector .team-checkbox');
    teamCheckboxes.forEach((checkbox, index) => {
        checkbox.addEventListener('mouseenter', () => {
            updateLineOpacity(index);
        });

        checkbox.addEventListener('mouseleave', () => {
            resetLineOpacity();
        });
    });

    // Permitir que o tooltip volte ao comportamento normal ao passar o rato dentro do gráfico
    const chartContainerWrapper = document.querySelector('#chartContainer');
    if (chartContainerWrapper) {
        chartContainerWrapper.addEventListener('mouseenter', function () {
            const tooltip = document.querySelector('.apexcharts-tooltip');
            if (tooltip && tooltip.style.display === 'none' && !window.tooltipFixed) {
                tooltip.style.display = '';  // Permite que ApexCharts controle novamente
            }
        });

        chartContainerWrapper.addEventListener('mouseleave', function () {
            if (!window.tooltipFixed) {
                const tooltip = document.querySelector('.apexcharts-tooltip');
                if (tooltip) {
                    tooltip.style.display = 'none';  // Esconder quando sai
                }
            }
        });
    }
}

// Funções de labels dinâmicos e navegação de época removidas/simplificadas
// ApexCharts lida com legendas e tooltips nativamente
// Botão de época anterior pode ser reimplementado separadamente se necessário
function addPreviousSeasonButton() {
    // Implementação futura: adicionar botão flutuante sobre o gráfico ApexCharts
}

// Remover listeners e funções antigas se existirem
function updateDynamicTeamLabels() { }



// Obter labels dos cabeçalhos baseados na modalidade
function getGoalHeaders() {
    // Extrair o nome da modalidade sem a época
    let modalityName = '';
    if (currentModalidade) {
        modalityName = currentModalidade.replace(/_\d{2}_\d{2}$/, '').toUpperCase();
    }

    // Basquetebol usa "Cestos Feitos" e "Cestos Sofridos"
    if (modalityName.includes('BASQUETEBOL')) {
        return {
            scored: 'CF',
            conceded: 'CS',
            scoredTitle: t('basketScored') || 'Cestos feitos',
            concededTitle: t('basketConceded') || 'Cestos sofridos',
            diffTitle: t('basketDiff') || 'Diferença de cestos (CF - CS)',
            expectedLabel: t('basketGoalsExpected') || 'Cestos Esp.',
            expectedTitle: t('basketGoalsTitle') || 'Cestos esperados'
        };
    }

    // Voleibol usa "Sets Ganhos" e "Sets Perdidos"
    if (modalityName.includes('VOLEIBOL')) {
        return {
            scored: 'SG',
            conceded: 'SP',
            scoredTitle: t('setsWon') || 'Sets ganhos',
            concededTitle: t('setsLost') || 'Sets perdidos',
            diffTitle: t('setsDiff') || 'Diferença de sets (SG - SP)',
            expectedLabel: t('setsExpected') || 'Sets Esp.',
            expectedTitle: t('setsTitle') || 'Sets esperados'
        };
    }

    // Futebol, Futsal e Andebol mantêm "Golos Marcados" e "Golos Sofridos"
    return {
        scored: 'GM',
        conceded: 'GS',
        scoredTitle: t('goalsScored') || 'Golos marcados',
        concededTitle: t('goalsConceded') || 'Golos sofridos',
        diffTitle: t('goalsDiff') || 'Diferença de golos (GM - GS)',
        expectedLabel: t('expectedGoals') || 'Golos Esp.',
        expectedTitle: t('expectedGoalsTitle') || 'Golos esperados'
    };
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

    // Atualizar os cabeçalhos (texto e títulos)
    thElements[scoredIndex].textContent = headers.scored;
    thElements[scoredIndex].title = headers.scoredTitle;
    thElements[concededIndex].textContent = headers.conceded;
    thElements[concededIndex].title = headers.concededTitle;
    thElements[diffIndex].title = headers.diffTitle;

    // Esconder/mostrar coluna ELO Trend em modo compacto
    const eloTrendIndex = thElements.findIndex(th =>
        normalizeHeaderText(th.textContent).includes('elotrend') ||
        normalizeHeaderText(th.textContent).includes('elo') && normalizeHeaderText(th.textContent).includes('trend')
    );
    if (eloTrendIndex !== -1) {
        thElements[eloTrendIndex].style.display = compactModeEnabled ? 'none' : '';
    }

    // Esconder/mostrar coluna Forma em modo compacto
    const formIndex = thElements.findIndex(th =>
        normalizeHeaderText(th.textContent).includes('forma') ||
        normalizeHeaderText(th.textContent).includes('form')
    );
    if (formIndex !== -1) {
        thElements[formIndex].style.display = compactModeEnabled ? 'none' : '';
    }
}

// Verificar se a modalidade é voleibol
function isVolleyballModality() {
    if (!currentModalidade) return false;
    const modalityName = currentModalidade.replace(/_\d{2}_\d{2}$/, '').toUpperCase();
    return modalityName.includes('VOLEIBOL');
}

// Obter informações de ELO de uma equipa (para exibição na tabela de classificação)
function getTeamEloInfo(teamName) {
    // Normalizar nome da equipa
    const normalizedName = normalizeTeamName(teamName);

    // Buscar equipa em sampleData.teams
    const team = sampleData.teams.find(t => normalizeTeamName(t.name) === normalizedName);

    if (!team) {
        return { elo: 'N/A', position: null };
    }

    // Obter histórico de ELO da equipa
    const eloHistory = sampleData.eloHistory[team.name];
    if (!eloHistory || eloHistory.length === 0) {
        return { elo: 'N/A', position: null };
    }

    // Pegar o último ELO não-null
    let currentElo = null;
    for (let i = eloHistory.length - 1; i >= 0; i--) {
        if (eloHistory[i] !== null) {
            currentElo = Math.round(eloHistory[i]);
            break;
        }
    }

    if (currentElo === null) {
        return { elo: 'N/A', position: null };
    }

    // Calcular posição no ranking geral (comparar com todas as equipas)
    const allTeamsElo = sampleData.teams.map(t => {
        const hist = sampleData.eloHistory[t.name];
        if (!hist || hist.length === 0) return { name: t.name, elo: 0 };

        // Pegar último ELO não-null
        for (let i = hist.length - 1; i >= 0; i--) {
            if (hist[i] !== null) {
                return { name: t.name, elo: hist[i] };
            }
        }
        return { name: t.name, elo: 0 };
    }).sort((a, b) => b.elo - a.elo);

    const position = allTeamsElo.findIndex(t => normalizeTeamName(t.name) === normalizedName) + 1;

    return { elo: currentElo, position: position > 0 ? position : null };
}

// Toggle modo compacto da tabela
function toggleCompactMode() {
    const checkbox = document.getElementById('compactModeCheckbox');
    compactModeEnabled = checkbox ? checkbox.checked : !compactModeEnabled;
    localStorage.setItem('mmr_compactModeEnabled', compactModeEnabled);
    updateRankingsTable();
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
        tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; color: #666;">' + t('noDataAvailable') + '</td></tr>';
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

    // Deduplicar equipas por nome normalizado (mantém a primeira ocorrência)
    if (teams.length > 1) {
        const uniqueTeams = [];
        const seen = new Set();
        teams.forEach(team => {
            const key = normalizeTeamName(team.team);
            if (!seen.has(key)) {
                seen.add(key);
                uniqueTeams.push(team);
            }
        });
        teams = uniqueTeams;
    }

    // Analisar estrutura da modalidade para determinar progressões
    const structure = analyzeModalityStructure();
    const totalTeams = teams.length;

    // Mostrar legenda se houver equipes suficientes para progressões
    const showProgressionIndicators = totalTeams >= 4;

    // Atualizar legenda dinâmica
    updateProgressionLegend(showProgressionIndicators, structure);

    // Helper para obter forma (últimos 5 resultados) de uma equipa
    const getTeamForm = (teamName) => {
        if (!sampleData.gameDetails || !sampleData.gameDetails[teamName]) {
            return [];
        }

        const teamGames = sampleData.gameDetails[teamName];
        const rounds = Object.keys(teamGames).sort((a, b) => {
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });

        const outcomes = rounds
            .map(r => teamGames[r]?.outcome)
            .filter(o => o === 'V' || o === 'E' || o === 'D');

        return outcomes.slice(-5);
    };

    // Helper para sparkline de ELO (tendência curta)
    const buildEloSparkline = (teamName) => {
        if (!ENABLE_RANKING_SPARKLINES) return '';
        const history = sampleData.eloHistory?.[teamName] || [];
        const valid = history.filter(v => v !== null && v !== undefined && !isNaN(v));
        if (!valid.length) return '<span class="sparkline-empty">—</span>';

        const points = valid.slice(-SPARKLINE_POINTS);
        const width = 80;
        const height = 28;
        const padding = 2;
        const min = Math.min(...points);
        const max = Math.max(...points);
        const range = Math.max(1, max - min);
        const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

        const coords = points.map((v, i) => {
            const x = padding + i * stepX;
            const y = height - padding - ((v - min) / range) * (height - padding * 2);
            return { x, y };
        });

        const pathD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const last = coords[coords.length - 1];
        const minLabel = Math.round(min);
        const maxLabel = Math.round(max);

        return `
            <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" title="${t('eloEvolution')} (${t('lastGames')} ${points.length}): ${minLabel} ${t('until')} ${maxLabel}" aria-label="${t('eloTrendAriaLabel')}">
                <path class="sparkline-area" d="${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z" />
                <path class="sparkline-path" d="${pathD}" />
                <circle class="sparkline-dot" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="2.5" />
            </svg>
            <div class="sparkline-range" aria-hidden="true">${minLabel}–${maxLabel}</div>
        `;
    };

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
            { type: 'safe', description: t('safeZone') };

        // Determinar classe CSS para a zona da tabela
        let zoneClass = 'zone-safe';
        if (progression.type === 'playoffs' || progression.type === 'promotion-playoffs' || progression.type === 'maintenance-playoffs') {
            zoneClass = 'zone-playoff';
        } else if (progression.type === 'relegation' || progression.type === 'maintenance-league') {
            zoneClass = 'zone-relegation';
        }

        // Obter informações do curso para emblema - aplicar normalização
        const normalizedTeamName = normalizeTeamName(team.team);
        const courseInfo = getCourseInfo(normalizedTeamName);
        // Tabela usa nome curto em modo compacto, nome completo caso contrário
        const baseTeamName = compactModeEnabled ? courseInfo.shortName : courseInfo.fullName;
        const displayTeamName = translateTeamName(baseTeamName);
        const emblemHtml = (!compactModeEnabled && courseInfo.emblemPath) ?
            `<img src="${courseInfo.emblemPath}" alt="${normalizedTeamName}" class="team-emblem-table" onerror="this.style.display='none'">` :
            '';

        // Criar indicador de progressão
        const progressionClass = showProgressionIndicators ? `progression-${progression.type}` : 'progression-safe';
        const badgeTitle = showProgressionIndicators ? progression.description : `${position}º lugar`;

        // Obter informação do ELO - aplicar normalização
        const eloInfo = getTeamEloInfo(normalizedTeamName);
        const eloDisplay = eloInfo.position ? `${eloInfo.elo} (#${eloInfo.position})` : `${eloInfo.elo}`;

        const formOutcomes = getTeamForm(team.team);
        const formBadgesHtml = formOutcomes.length
            ? `<div class="form-badges">${formOutcomes.map((outcome, idx) => {
                const map = { 'V': { cls: 'win', letter: 'V', text: t('formWin') }, 'E': { cls: 'draw', letter: 'E', text: t('formDraw') }, 'D': { cls: 'loss', letter: 'D', text: t('formLoss') } };
                const meta = map[outcome] || { cls: 'draw', letter: outcome || '-', text: t('formUnknown') };
                return `<span class="form-badge ${meta.cls}" title="${meta.text}">${meta.letter}</span>`;
            }).join('')}</div>`
            : '<span class="form-badges empty">—</span>';

        row.innerHTML = `
                    <td>
                        <span class="rank-badge ${progressionClass}" title="${badgeTitle}">${position}</span>
                    </td>
                    <td class="team-cell ${isTeamFavorite(team.team) ? 'favorite-team-row' : ''}">
                        <button class="favorite-btn ${isTeamFavorite(team.team) ? 'active' : ''}" 
                                onclick="toggleFavorite('${team.team}')" 
                                title="${isTeamFavorite(team.team) ? t('removeFavorite') : t('markFavorite')}">
                            ${isTeamFavorite(team.team) ? '★' : '☆'}
                        </button>
                        ${emblemHtml}
                        <div class="team-color-indicator" style="background-color: ${courseInfo.primaryColor}"></div>
                        <div class="team-info-container">
                            <span class="team-name-table" title="${displayTeamName}">${displayTeamName}</span>
                            <span class="team-elo-info" title="${t('eloCurrentTitle')}">${eloDisplay}</span>
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
                    <td class="sparkline-cell" style="display: ${compactModeEnabled ? 'none' : ''}">${buildEloSparkline(team.team)}</td>
                    <td class="form-column" style="display: ${compactModeEnabled ? 'none' : ''}">${formBadgesHtml}</td>
                `;
        row.classList.add(zoneClass);

        // Adicionar event listeners para tooltip histórico na célula da equipa
        const teamCell = row.querySelector('.team-cell');
        if (teamCell) {
            let tooltipTimer = null;

            teamCell.addEventListener('mouseenter', async () => {
                // Delay para evitar mostrar tooltip em passagens rápidas
                tooltipTimer = setTimeout(async () => {
                    await showHistoricalTooltip(team.team, teamCell);
                }, 300);
            });

            teamCell.addEventListener('mouseleave', () => {
                clearTimeout(tooltipTimer);
                hideHistoricalTooltip();
            });
        }

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
            text: t('playoffs')
        });

        // Playoff/Liguilha de manutenção - SÓ mostrar se realmente existir
        if (hasMaintenancePlayoffs) {
            legendItems.push({
                badge: 'PM',
                cssClass: 'legend-maintenance-playoffs',
                text: t('maintenancePlayoff')
            });
        } else if (hasMaintenanceLeague) {
            legendItems.push({
                badge: 'LM',
                cssClass: 'legend-maintenance-league',
                text: t('maintenanceLeague')
            });
        }

        // Sempre mostrar descida direta (últimos 2 ou 3 dependendo de haver PM/LM)
        legendItems.push({
            badge: '↓',
            cssClass: 'legend-relegation',
            text: t('relegation')
        });
    }
    // Legendas para 2ª divisão
    else if (isSecondDivision) {
        // 1º de cada grupo vai aos playoffs + promoção
        legendItems.push({
            badge: 'P',
            cssClass: 'legend-playoffs',
            text: t('playoffsPromotion')
        });

        // 2º lugar: depende se há PM/LM ou não
        if (hasMaintenancePlayoffs) {
            legendItems.push({
                badge: 'PP',
                cssClass: 'legend-promotion-playoffs',
                text: t('promotionPlayoff')
            });
        } else if (hasMaintenanceLeague) {
            legendItems.push({
                badge: 'LP',
                cssClass: 'legend-promotion-league',
                text: t('promotionLeague')
            });
        } else {
            // Sem PM/LM: 2º sobe direto
            legendItems.push({
                badge: '↑',
                cssClass: 'legend-promotion',
                text: t('promotion')
            });
        }
    }
    // Legendas para 3ª+ divisão
    else {
        legendItems.push({
            badge: '↑',
            cssClass: 'legend-promotion',
            text: t('promotion')
        });
    }

    // Sempre adicionar zona segura
    legendItems.push({
        badge: 'S',
        cssClass: 'legend-safe',
        text: t('safeZone')
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

    // Apenas grupos (sem divisões) - rotular por posição no grupo
    if (structure.type === 'groups-only') {
        // Agrupar a partir de todas as tabelas disponíveis (não apenas 'geral')
        const rankingAll = Object.values(sampleData.rankings || {}).flat();

        // Ordenação que respeita posição explícita do CSV antes de tie-break por pontos
        const sortByPositionThenPoints = (a, b) => {
            const hasPosA = a.position !== null && a.position !== undefined;
            const hasPosB = b.position !== null && b.position !== undefined;

            if (hasPosA && hasPosB) return a.position - b.position;
            if (hasPosA) return -1;
            if (hasPosB) return 1;

            if (b.points !== a.points) return b.points - a.points;
            const diffA = (a.goals || 0) - (a.conceded || 0);
            const diffB = (b.goals || 0) - (b.conceded || 0);
            return diffB - diffA;
        };

        // Mapear equipas para posição no grupo
        const groupsMap = {};
        rankingAll.forEach(entry => {
            const grp = entry.group;
            if (!grp) return;
            if (!groupsMap[grp]) groupsMap[grp] = [];
            groupsMap[grp].push(entry);
        });

        // Ordenar cada grupo e adicionar legendas
        Object.entries(groupsMap).forEach(([grp, grpRanking]) => {
            grpRanking.sort(sortByPositionThenPoints);

            grpRanking.forEach((entry, idx) => {
                const posFromCsv = entry.position && !isNaN(parseInt(entry.position)) ? parseInt(entry.position) : null;
                const computedPos = idx + 1;
                const finalPos = posFromCsv || computedPos;

                qualified.legend.push({
                    position: finalPos,
                    actualPosition: finalPos,
                    team: entry.team,
                    type: 'playoff',
                    group: grp
                });
            });
        });

        // Gerar seeds de playoffs por cruzamento entre grupos (1A x 4B, 2A x 3B, 1B x 4A, 2B x 3A)
        const groupKeys = Object.keys(groupsMap).sort(); // ordenação estável (A, B, ...)
        const hasTwoGroups = groupKeys.length === 2;

        if (hasTwoGroups) {
            const [gA, gB] = groupKeys;
            const topA = (groupsMap[gA] || []).slice(0, 4);
            const topB = (groupsMap[gB] || []).slice(0, 4);

            // Só semear se ambos têm pelo menos 4 equipas
            if (topA.length === 4 && topB.length === 4) {
                // Ordem alinhada com createPredictedBracket (1 vs 8, 4 vs 5, 2 vs 7, 3 vs 6):
                // 1A vs 4B, 1B vs 4A, 2B vs 3A, 2A vs 3B
                qualified.playoffs = [
                    topA[0]?.team, // idx0 -> 1A (vs idx7)
                    topB[0]?.team, // idx1 -> 1B (vs idx6)
                    topB[1]?.team, // idx2 -> 2B (vs idx5)
                    topA[1]?.team, // idx3 -> 2A (vs idx4)
                    topB[2]?.team, // idx4 -> 3B
                    topA[2]?.team, // idx5 -> 3A
                    topA[3]?.team, // idx6 -> 4A
                    topB[3]?.team  // idx7 -> 4B
                ].filter(Boolean);
            }
        }

        // Fallback: se não for 2 grupos ou faltarem equipas, usar top 8 globalmente mas respeitando grupo
        if (!qualified.playoffs || qualified.playoffs.length < 8) {
            const sortedAll = [...rankingAll].sort(sortByPositionThenPoints);

            // Manter alternância A/B sempre que possível: 1A,1B,2A,2B,3A,3B,4A,4B
            const altSeeds = [];
            const byGroup = {};
            sortedAll.forEach(entry => {
                if (!byGroup[entry.group]) byGroup[entry.group] = [];
                byGroup[entry.group].push(entry);
            });
            const groups = Object.keys(byGroup).sort();
            for (let pos = 0; pos < 4; pos++) {
                groups.forEach(g => {
                    if (byGroup[g][pos]) altSeeds.push(byGroup[g][pos].team);
                });
            }

            qualified.playoffs = (altSeeds.length >= 8 ? altSeeds.slice(0, 8) : sortedAll.slice(0, 8).map(t => t.team));
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
    if (typeof teamName === 'string' && teamName.startsWith('Vencido ')) {
        teamName = teamName.replace(/^Vencido\s+/, 'Perdedor ');
    }
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
            // Suporte adicional: épocas com grupos sem divisão
            if (item.group) {
                const grp = item.group;
                const keys = [
                    `${item.position}º Gr. ${grp}`,
                    `${item.position}º Grupo ${grp}`,
                    `${item.position}º Class. Gr. ${grp}`,
                    `${item.position}º Class. Grupo ${grp}`,
                    // Alguns CSVs antigos incluem "1ª Div." mesmo em liga única
                    `${item.position}º 1ª Div. Gr. ${grp}`,
                    `${item.position}º 1ª Div. Grupo ${grp}`,
                    `${item.position}º Class. 1ª Div. Gr. ${grp}`,
                    `${item.position}º Class. 1ª Div. Grupo ${grp}`
                ];
                keys.forEach(k => { qualifiedMap[k] = item.team; });
            }
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

    const requestedModalidade = modalidade;

    const jogosPath = `output/csv_modalidades/${modalidade}.csv`;

    Papa.parse(jogosPath, {
        download: true,
        header: true,
        complete: results => {
            if (requestedModalidade !== currentModalidade) return;
            // Salvar dados do calendário para verificação de resultados desconhecidos
            sampleData.calendarData = results.data;

            // Marcar resultados desconhecidos (caso o detalhe já tenha sido carregado)
            markUnknownResultsFromCalendar();

            // Calcular form (últimos 5 resultados) para cada equipa
            calculateFormForAllGames();

            // Calcular número máximo de jornadas do calendário (antes dos jogos acontecerem)
            const regularRounds = results.data
                .filter(match => match.Jornada && !isNaN(parseInt(match.Jornada)))
                .map(match => parseInt(match.Jornada));

            sampleData.totalRegularSeasonGames = regularRounds.length > 0 ? Math.max(...regularRounds) : 0;                    // Filtrar jogos de eliminação dos dados originais (E*)
            const eliminationMatches = dedupeMatchRows(results.data.filter(match =>
                match.Jornada && (
                    match.Jornada.startsWith('E1') ||  // Quartos
                    match.Jornada.startsWith('E2') ||  // Meias
                    match.Jornada.startsWith('E3')    // Final/3º lugar
                )
            ));

            // Filtrar jogos secundários (PM* ou LM*)
            const secondaryMatches = dedupeMatchRows(results.data.filter(match =>
                match.Jornada && (
                    match.Jornada.startsWith('PM') ||  // Playoff Manutenção/Promoção
                    match.Jornada.startsWith('LM')     // Liguilha Manutenção/Promoção
                )
            ));

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
            if (requestedModalidade !== currentModalidade) return;
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
            // Suporte adicional: épocas com grupos sem divisão
            if (item.group) {
                const grp = item.group;
                const keys = [
                    `${item.position}º Gr. ${grp}`,
                    `${item.position}º Grupo ${grp}`,
                    `${item.position}º Class. Gr. ${grp}`,
                    `${item.position}º Class. Grupo ${grp}`,
                    `${item.position}º 1ª Div. Gr. ${grp}`,
                    `${item.position}º 1ª Div. Grupo ${grp}`,
                    `${item.position}º Class. 1ª Div. Gr. ${grp}`,
                    `${item.position}º Class. 1ª Div. Grupo ${grp}`
                ];
                keys.forEach(k => { qualifiedMap[k] = item.team; });
            }
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
        container.innerHTML = `<p style="text-align: center; color: #666; padding: 40px;">${t('bracketNotAvailable')}</p>`;
        return;
    }

    container.innerHTML = '';

    // Analisar estrutura para decidir como exibir labels (liga única vs divisões/grupos)
    const structure = analyzeModalityStructure();

    // Obter mapa de equipas qualificadas para mostrar labels - forçar refresh
    const qualified = getQualifiedTeams(true);
    DebugUtils.debugBracket('qualified_teams', qualified);
    const qualificationLabels = {};

    qualified.legend.forEach(item => {
        if (item.type === 'playoff') {
            let label = `${item.position}${t('bracketQualificationSuffix')}`;
            if (item.division === '2ª' && item.group) {
                label += ` ${t('groupLabel')} ${item.group}`;
            } else if (item.division === '2ª') {
                label += ` ${t('div2nd')}`;
            } else if (item.division === '1ª') {
                label += ` ${t('div1st')}`;
            }
            qualificationLabels[item.team] = label;
        }
    });

    Object.entries(sampleData.bracket).forEach(([round, matches]) => {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'bracket-round';

        const title = document.createElement('h3');
        title.textContent = translateBracketRound(round);
        roundDiv.appendChild(title);

        matches.forEach((match, index) => {
            // Adicionar subtítulo para o 3º lugar se for o caso
            if (match.isThirdPlace && !document.querySelector('.third-place-header')) {
                const thirdPlaceHeader = document.createElement('h4');
                thirdPlaceHeader.className = 'third-place-header';
                thirdPlaceHeader.textContent = t('thirdPlace');
                thirdPlaceHeader.style.cssText = `
                            text-align: center;
                            color: rgb(102, 102, 102);
                            margin: 30px 0px -20px !important;
                            padding: 8px;
                            background: rgb(245, 245, 245);
                            border-radius: 8px;
                            font-weight: 600;
                            font-size: 0.9em;
                        `;
                roundDiv.appendChild(thirdPlaceHeader);
            }

            // Criar wrapper para o identificador + card do jogo
            const matchWrapper = document.createElement('div');
            matchWrapper.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 2px;
                margin-top: 3px;
            `;

            // Adicionar identificador do jogo ANTES do card (QF1-4, MF1-2)
            // Estrutura do bracket: QF1 vs QF4 -> MF1, QF2 vs QF3 -> MF2
            let matchIdentifier = '';
            if (round === 'Quartos de Final') {
                // Mapear visualmente: índice 0->QF1, 1->QF4, 2->QF2, 3->QF3
                const qfMapping = [1, 4, 2, 3];
                matchIdentifier = `QF${qfMapping[index]}`;
            } else if (round === 'Meias-Finais') {
                matchIdentifier = `MF${index + 1}`;
            } else if (round === 'Final') {
                // Adicionar espaço vazio para alinhamento
                matchIdentifier = ' '; // espaço invisível
            }

            const idLabel = document.createElement('div');
            idLabel.className = 'match-id-label';
            idLabel.textContent = matchIdentifier && matchIdentifier.trim()
                ? matchIdentifier
                : '\u00A0'; // espaço não quebrável se vazio
            idLabel.style.cssText = `
                font-size: 0.75em;
                color: #2a5298;
                margin: 0;
                padding: 0 0 0 2px;
                line-height: 1;
                min-height: 1em;
            `;
            matchWrapper.appendChild(idLabel);

            const matchDiv = document.createElement('div');
            matchDiv.className = 'bracket-match';

            // Resolver nomes (substituir placeholders por equipas reais)
            const resolvedTeam1 = resolveTeamName(match.team1);
            const resolvedTeam2 = resolveTeamName(match.team2);

            // Obter informações das equipas - aplicar normalização
            const team1Info = getCourseInfo(normalizeTeamName(resolvedTeam1));
            const team2Info = getCourseInfo(normalizeTeamName(resolvedTeam2));

            // Brackets sempre usam nome curto
            const displayTeam1 = isBracketPlaceholder(resolvedTeam1)
                ? translateBracketPlaceholder(resolvedTeam1)
                : getTranslatedTeamLabel(team1Info, resolvedTeam1);
            const displayTeam2 = isBracketPlaceholder(resolvedTeam2)
                ? translateBracketPlaceholder(resolvedTeam2)
                : getTranslatedTeamLabel(team2Info, resolvedTeam2);

            // Usar cor da equipa ou cinza neutro como fallback
            const team1Color = team1Info.colors ? team1Info.colors[0] : '#6c757d';
            const team2Color = team2Info.colors ? team2Info.colors[0] : '#6c757d';

            const team1Div = document.createElement('div');
            // ✅ MOSTRAR vencedor MESMO com unknownResult (só não mostrar se predicted ou sem score)
            const hasScore = (match.score1 !== null && match.score2 !== null);
            const matchPlayed = hasScore && !match.predicted; // Permitir unknownResult
            const showScore = hasScore && !match.predicted; // Mostrar score mesmo se unknownResult
            const isFavorite1 = isTeamFavorite(resolvedTeam1);
            team1Div.className = `bracket-team ${matchPlayed && match.winner === match.team1 ? 'winner' : ''} ${isFavorite1 ? 'favorite-team-bracket' : ''}`;

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
                    `<img src="${team1Info.emblemPath}" alt="${displayTeam1}" class="bracket-team-emblem" onerror="this.style.display='none'">` :
                    ''
                }
                            <span>${displayTeam1}</span>
                        </div>
                        <span class="score">${showScore ? match.score1 : '-'}</span>
                        ${elo1Html}
                    `;

            // Adicionar label de qualificação acima da equipa 1 (com fallback por seed em liga única)
            let legendItem1 = qualified.legend.find(item =>
                normalizeTeamName(item.team) === normalizeTeamName(resolvedTeam1)
            );
            if (!legendItem1) {
                const idx1 = qualified.playoffs.findIndex(t => normalizeTeamName(t) === normalizeTeamName(resolvedTeam1));
                if (idx1 !== -1) {
                    legendItem1 = { position: idx1 + 1, division: '1ª' };
                }
            }

            if (legendItem1) {
                let qualLabel = '';
                // Garantir posição caso ausente
                if (!legendItem1.position) {
                    const idx1 = qualified.playoffs.findIndex(t => normalizeTeamName(t) === normalizeTeamName(resolvedTeam1));
                    if (idx1 !== -1) legendItem1.position = idx1 + 1;
                }

                // Liga única: mostrar apenas posição (sem mencionar divisão)
                if (structure.type === 'single-league') {
                    qualLabel = getQualificationLabel(legendItem1.position);
                }
                // Grupos sem divisões: priorizar mostrar grupo
                else if (legendItem1.group) {
                    qualLabel = getQualificationLabel(legendItem1.actualPosition || legendItem1.position, null, legendItem1.group);
                }
                // Divisões convencionais
                else if (legendItem1.division === '1ª') {
                    qualLabel = getQualificationLabel(legendItem1.position, '1ª');
                } else if (legendItem1.division === '2ª') {
                    if (legendItem1.group) {
                        qualLabel = getQualificationLabel(legendItem1.actualPosition || legendItem1.position, '2ª', legendItem1.group);
                    } else {
                        qualLabel = getQualificationLabel(legendItem1.actualPosition || legendItem1.position, '2ª');
                    }
                } else {
                    // Fallback: só posição
                    qualLabel = `${legendItem1.position}º`;
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
            const isFavorite2 = isTeamFavorite(resolvedTeam2);
            team2Div.className = `bracket-team ${matchPlayed && match.winner === match.team2 ? 'winner' : ''} ${isFavorite2 ? 'favorite-team-bracket' : ''}`;

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
                    `<img src="${team2Info.emblemPath}" alt="${displayTeam2}" class="bracket-team-emblem" onerror="this.style.display='none'">` :
                    ''
                }
                            <span>${displayTeam2}</span>
                        </div>
                        <span class="score">${showScore ? match.score2 : '-'}</span>
                        ${elo2Html}
                    `;

            matchDiv.appendChild(team1Div);
            matchDiv.appendChild(team2Div);

            // Adicionar label de qualificação abaixo da equipa 2 (com fallback por seed em liga única)
            let legendItem2 = qualified.legend.find(item =>
                normalizeTeamName(item.team) === normalizeTeamName(resolvedTeam2)
            );
            if (!legendItem2) {
                const idx2 = qualified.playoffs.findIndex(t => normalizeTeamName(t) === normalizeTeamName(resolvedTeam2));
                if (idx2 !== -1) {
                    legendItem2 = { position: idx2 + 1, division: '1ª' };
                }
            }

            if (legendItem2) {
                let qualLabel = '';
                // Garantir posição caso ausente
                if (!legendItem2.position) {
                    const idx2 = qualified.playoffs.findIndex(t => normalizeTeamName(t) === normalizeTeamName(resolvedTeam2));
                    if (idx2 !== -1) legendItem2.position = idx2 + 1;
                }

                // Liga única: mostrar apenas posição (sem mencionar divisão)
                if (structure.type === 'single-league') {
                    qualLabel = getQualificationLabel(legendItem2.position);
                }
                // Grupos sem divisões: priorizar mostrar grupo
                else if (legendItem2.group) {
                    qualLabel = getQualificationLabel(legendItem2.actualPosition || legendItem2.position, null, legendItem2.group);
                }
                // Divisões convencionais
                else if (legendItem2.division === '1ª') {
                    qualLabel = getQualificationLabel(legendItem2.position, '1ª');
                } else if (legendItem2.division === '2ª') {
                    if (legendItem2.group) {
                        qualLabel = getQualificationLabel(legendItem2.actualPosition || legendItem2.position, '2ª', legendItem2.group);
                    } else {
                        qualLabel = getQualificationLabel(legendItem2.actualPosition || legendItem2.position, '2ª');
                    }
                } else {
                    // Fallback: só posição
                    qualLabel = getQualificationLabel(legendItem2.position);
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
                predictedIndicator.innerHTML = '<small style="color: #2196F3; font-style: italic; text-align: center; margin-top: 5px;">📅 ' + t('predictedMatch') + '</small>';
                matchDiv.appendChild(predictedIndicator);
            }

            // Adicionar indicação de resultado desconhecido se aplicável
            if (match.unknownResult) {
                const unknownIndicator = document.createElement('div');
                unknownIndicator.className = 'unknown-result-indicator';
                unknownIndicator.innerHTML = '<small style="color: #666; font-style: italic; text-align: center; margin-top: 5px;">⚠️ ' + t('unknownResult') + '</small>';
                matchDiv.appendChild(unknownIndicator);
            }

            matchWrapper.appendChild(matchDiv);
            roundDiv.appendChild(matchWrapper);
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
        title.textContent = t('maintenancePlayoff');
    } else if (bracketType === 'maintenance-league') {
        title.textContent = t('maintenanceLeague');
    } else if (bracketType === 'promotion-playoff') {
        title.textContent = t('promotionPlayoff');
    } else if (bracketType === 'promotion-league') {
        title.textContent = t('promotionLeague');
    } else {
        title.textContent = t('playoffLiguilha');
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
        tableDiv.className = 'maintenance-league-table';

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
                            <span>${normalizeTeamName(resolvedTeam)}</span>
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
            roundTitle.textContent = translateBracketRound(round);
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

                // Liguinha sempre usa nome curto
                const displayTeam1 = isBracketPlaceholder(resolvedTeam1)
                    ? translateBracketPlaceholder(resolvedTeam1)
                    : getTranslatedTeamLabel(team1Info, resolvedTeam1);
                const displayTeam2 = isBracketPlaceholder(resolvedTeam2)
                    ? translateBracketPlaceholder(resolvedTeam2)
                    : getTranslatedTeamLabel(team2Info, resolvedTeam2);

                // Usar cor da equipa ou cinza neutro como fallback
                const team1Color = team1Info.colors ? team1Info.colors[0] : '#6c757d';
                const team2Color = team2Info.colors ? team2Info.colors[0] : '#6c757d';

                const team1Div = document.createElement('div');
                // ✅ MOSTRAR vencedor MESMO com unknownResult (só não mostrar se predicted ou sem score)
                const hasScore = (match.score1 !== null && match.score2 !== null);
                const matchPlayed = hasScore && !match.predicted; // Permitir unknownResult
                const showScore = hasScore && !match.predicted; // Mostrar score mesmo se unknownResult
                const isFavorite1 = isTeamFavorite(resolvedTeam1);
                team1Div.className = `bracket-team ${matchPlayed && match.winner === match.team1 ? 'winner' : ''} ${isFavorite1 ? 'favorite-team-bracket' : ''}`;

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
                        `<img src="${team1Info.emblemPath}" alt="${displayTeam1}" class="bracket-team-emblem" onerror="this.style.display='none'">` :
                        ''
                    }
                            <span>${displayTeam1}</span>
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
                const isFavorite2 = isTeamFavorite(resolvedTeam2);
                team2Div.className = `bracket-team ${matchPlayed && match.winner === match.team2 ? 'winner' : ''} ${isFavorite2 ? 'favorite-team-bracket' : ''}`;

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
                        `<img src="${team2Info.emblemPath}" alt="${displayTeam2}" class="bracket-team-emblem" onerror="this.style.display='none'">` :
                        ''
                    }
                            <span>${displayTeam2}</span>
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
                    unknownIndicator.innerHTML = `<small style="color: #666; font-style: italic; text-align: center; margin-top: 5px;">⚠️ ${t('unknownResult')}</small>`;
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
    top3Btn.textContent = t('filterTop3');
    top3Btn.dataset.filter = 'top3';
    top3Btn.setAttribute('aria-label', t('filterTop3Aria'));
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
            btn.textContent = translateDivisionLabel(division);
            btn.dataset.filter = 'division';
            btn.dataset.division = division;
            btn.setAttribute('aria-label', `${t('filterByLabel')} ${translateDivisionLabel(division)}`);
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
            allDiv2Btn.textContent = translateDivisionLabel('2ª Divisão');
            allDiv2Btn.dataset.filter = 'all-div2';
            allDiv2Btn.setAttribute('aria-label', t('filterByAllDiv2'));
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
    const playoffsLabel = (hasActualPlayoffs || groupStageComplete)
        ? t('playoffsLabel')
        : t('playoffsCurrentRanking');

    // Adicionar filtros finais
    const playoffsBtn = document.createElement('button');
    playoffsBtn.className = 'filter-btn';
    playoffsBtn.textContent = playoffsLabel;
    playoffsBtn.setAttribute('aria-label', t('filterPlayoffsAria'));
    playoffsBtn.onclick = filterPlayoffs;
    filtersContainer.appendChild(playoffsBtn);

    const sensationBtn = document.createElement('button');
    sensationBtn.className = 'filter-btn';
    sensationBtn.textContent = t('sensationTeams');
    sensationBtn.setAttribute('aria-label', t('sensationTeamsAria'));
    sensationBtn.onclick = filterSensationTeams;
    filtersContainer.appendChild(sensationBtn);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'filter-btn';
    resetBtn.textContent = t('resetFilter');
    resetBtn.setAttribute('aria-label', t('resetFilterAria'));
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
                description: t('qualificationPlayoffs')
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
                description: t('qualificationPlayoffs')
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
                description: t('qualificationPlayoffs')
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
                description: t('playoffsPromotion')
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
                description: t('qualificationPlayoffs')
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
                description: t('playoffsPromotion')
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
                description: t('promotion')
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
            description: t('relegation')
        };
    }

    if (relegationRules.maintenancePosition > 0 && position >= maintenanceStart) {
        if (hasMaintenancePlayoffs || hasMaintenanceLeague) {
            return {
                type: hasMaintenancePlayoffs ? 'maintenance-playoffs' : 'maintenance-league',
                description: hasMaintenancePlayoffs ? t('maintenancePlayoff') : t('maintenanceLeague')
            };
        }
    }

    return null;
}

function calculatePromotionProgression(hasMaintenancePlayoffs, hasMaintenanceLeague) {
    if (hasMaintenancePlayoffs) {
        return {
            type: 'promotion-playoffs',
            description: t('promotionPlayoff')
        };
    }

    if (hasMaintenanceLeague) {
        return {
            type: 'promotion-league',
            description: t('promotionLeague')
        };
    }

    return {
        type: 'promotion',
        description: t('promotion')
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
            description: `${t('safeZone')} (${position}${t('bracketQualificationSuffix')} ${t('placeLabel')} - ${t('teamBNoQualify')})`
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
            description: `${t('playoffsPromotion')} (${t('replaces')} ${position}${t('bracketQualificationSuffix')} ${t('ofGroup')})`
        };
    }

    const isInPromotionPlayoff = qualified.promotionPlayoff.some(t => t === teamName);

    if (isInPromotionPlayoff && position > 2) {
        DebugUtils.debugTeamBStatus('in_promotion_replaced', { team: teamName, position });

        if (hasMaintenancePlayoffs) {
            return {
                type: 'promotion-playoffs',
                description: `${t('promotionPlayoff')} (${t('replaces')} ${position}${t('bracketQualificationSuffix')} ${t('ofGroup')})`
            };
        }

        if (hasMaintenanceLeague) {
            return {
                type: 'promotion-league',
                description: `${t('promotionLeague')} (${t('replaces')} ${position}${t('bracketQualificationSuffix')} ${t('ofGroup')})`
            };
        }

        return {
            type: 'promotion',
            description: `${t('promotion')} (${t('replaces')} ${position}${t('bracketQualificationSuffix')} ${t('ofGroup')})`
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
        return { type: 'safe', description: t('safeZone') };
    }

    const result = strategy(context);
    return result || { type: 'safe', description: t('safeZone') };
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
    checkboxes.forEach((checkbox) => {
        const label = checkbox.parentElement;
        const teamName = checkbox.dataset.teamName || label?.dataset.teamName;
        const isActive = teamNames.includes(teamName);

        checkbox.checked = isActive;
        if (isActive) {
            label.classList.add('active');
        } else {
            label.classList.remove('active');
        }
    });
    updateEloChart();
    updateTeamCountIndicator();
    reorderTeamSelector();
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

        // Encontrar o primeiro ELO não-null (ELO inicial verdadeiro)
        let initialElo = null;
        for (let i = 0; i < history.length; i++) {
            if (history[i] !== null && history[i] !== undefined && !isNaN(history[i])) {
                initialElo = history[i];
                break;
            }
        }

        // Encontrar o último ELO não-null (ELO atual)
        let currentElo = null;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i] !== null && history[i] !== undefined && !isNaN(history[i])) {
                currentElo = history[i];
                break;
            }
        }

        // Se não encontrou valores válidos, usar ELO default
        if (initialElo === null) initialElo = team.initialElo || DEFAULT_ELO;
        if (currentElo === null) currentElo = team.initialElo || DEFAULT_ELO;

        const gain = currentElo - initialElo;

        return {
            name: team.name,
            gain: gain,
            initial: initialElo,
            current: currentElo
        };
    });

    // Filtrar apenas equipas com ganho POSITIVO
    const teamsWithPositiveGain = teamsWithGain.filter(t => t.gain > 0);

    // Ordenar por ganho de ELO decrescente
    teamsWithPositiveGain.sort((a, b) => b.gain - a.gain);

    // Pegar top 3 com maior ganho positivo
    const top3Sensation = teamsWithPositiveGain.slice(0, 3).map(t => t.name);

    DebugUtils.debugBracket('sensation_teams', {
        teams: top3Sensation,
        details: teamsWithPositiveGain.slice(0, 3),
        allTeamsWithGain: teamsWithGain
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
    reorderTeamSelector();
}

// Configuração dos cursos carregada de ficheiro externo
let coursesConfig = {};

/**
 * Carrega a configuração dos cursos do ficheiro JSON
 */
async function loadCoursesConfig() {
    try {
        const response = await fetch('config/config_cursos.json');
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

    let [, year, month, day] = dateMatch;
    year = parseInt(year);
    month = parseInt(month) - 1; // JavaScript months are 0-indexed
    day = parseInt(day);

    // FIX: Corrigir anos inconsistentes baseado na época atual
    // Se currentEpoca é 25_26, todos os jogos devem estar em 2025 ou início de 2026
    // Se um jogo aparece em 2026 mas o mês é posterior a agosto, é erro de digitação
    if (currentEpoca === '25_26') {
        // Época 25_26 vai de setembro 2025 a junho 2026
        if (year === 2026 && month > 5) {
            // Mês > junho em 2026 é erro - deve ser 2025
            year = 2025;
        }
    } else if (currentEpoca === '24_25') {
        // Época 24_25 vai de setembro 2024 a junho 2025
        if (year === 2025 && month > 5) {
            // Mês > junho em 2025 é erro - deve ser 2024
            year = 2024;
        }
    }

    // Parsear hora (formato: "10h15" ou "23h15")
    let hours = 0, minutes = 0;
    if (timeStr) {
        const timeMatch = timeStr.match(/(\d+)h(\d+)/);
        if (timeMatch) {
            hours = parseInt(timeMatch[1]);
            minutes = parseInt(timeMatch[2]);
        }
    }

    // FIX: Jogos entre 00:00 e 00:59 acontecem na realidade no "dia anterior" 
    // (após a meia-noite mas ainda na mesma "noite")
    // Para efeitos de ordenação, tratá-los como sendo 24h+ do dia anterior
    if (hours === 0) {
        // Ajustar: considerar como 24:XX do dia anterior
        // Isto garante que um jogo às 00:15 aparece DEPOIS de um jogo às 23:00 do mesmo dia
        hours = 24;
    }

    // Criar data com hora incluída
    return new Date(year, month, day, hours, minutes);
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

    // Forçar nomes canónicos quando o config estiver disponível
    const canonical = resolveCanonicalCourseKey(normalized);
    return canonical || normalized;
}

let canonicalCourseKeyCache = null;

function getCanonicalCourseKeyMap() {
    if (canonicalCourseKeyCache) {
        return canonicalCourseKeyCache;
    }

    if (!coursesConfig) {
        canonicalCourseKeyCache = new Map();
        return canonicalCourseKeyCache;
    }

    const map = new Map();
    Object.entries(coursesConfig).forEach(([key, info]) => {
        const displayName = (info && info.displayName) ? info.displayName : key;
        const current = map.get(displayName);
        if (!current || key.length < current.length) {
            map.set(displayName, key);
        }
    });

    canonicalCourseKeyCache = map;
    return map;
}

function resolveCanonicalCourseKey(teamName) {
    if (!coursesConfig || !teamName) return null;

    const normalizedInput = normalizeText(teamName).replace(/[^a-z0-9]/g, '');
    if (!normalizedInput) return null;

    const matchedKey = Object.keys(coursesConfig).find(key => {
        const normalizedKey = normalizeText(key).replace(/[^a-z0-9]/g, '');
        return normalizedKey === normalizedInput;
    });

    if (!matchedKey) return null;

    const info = coursesConfig[matchedKey] || {};
    const displayName = info.displayName || matchedKey;
    const map = getCanonicalCourseKeyMap();
    return map.get(displayName) || matchedKey;
}

/**
 * Traduz labels de qualificação em brackets
 */
function getQualificationLabel(position, division = null, group = null) {
    if (division === '1ª') {
        return `${position}${t('bracketQualificationSuffix')} ${t('bracketLabel1stDivision')}`;
    } else if (division === '2ª') {
        if (group) {
            return `${position}${t('bracketQualificationSuffix')} ${t('bracketLabelGroup')} ${group}`;
        } else {
            return `${position}${t('bracketQualificationSuffix')} ${t('bracketLabel2ndDivision')}`;
        }
    } else if (group) {
        return `${position}${t('bracketQualificationSuffix')} ${t('bracketLabelGroup')} ${group}`;
    } else {
        // Liga única - sem divisão mencionada
        return `${position}${t('bracketQualificationSuffix')} ${t('bracketLabelLeague')}`;
    }
}

function getPreferredTeamLabel(teamName) {
    const normalized = normalizeTeamName(teamName);
    if (!normalized || !coursesConfig) {
        return normalized;
    }

    if (coursesConfig[normalized]) {
        return normalized;
    }

    const courseInfo = getCourseInfo(normalized);
    if (!courseInfo || !courseInfo.emblemPath) {
        return normalized;
    }

    const candidates = Object.entries(coursesConfig)
        .filter(([, info]) => info.emblem === courseInfo.emblemPath)
        .map(([key]) => key)
        .sort((a, b) => a.length - b.length);

    return candidates.length > 0 ? candidates[0] : normalized;
}

function translateDivisionLabel(divisionLabel) {
    if (!divisionLabel) return '';
    if (typeof getCurrentLanguage === 'function' && getCurrentLanguage() === 'pt') {
        return divisionLabel;
    }

    if (divisionLabel === 'Divisão Geral') {
        return t('divisionGeneral');
    }

    const match = divisionLabel.match(/^(\d+)ª Divisão(?:\s*-\s*Grupo\s*([A-Z]))?$/);
    if (!match) {
        return divisionLabel;
    }

    const divisionNumber = match[1];
    const group = match[2] || null;
    let baseLabel = `${divisionNumber}${t('divisionLabel')}`;
    if (divisionNumber === '1') {
        baseLabel = t('div1Label');
    } else if (divisionNumber === '2') {
        baseLabel = t('div2Label');
    }

    return group ? `${baseLabel} - ${t('groupLabel')} ${group}` : baseLabel;
}

function translateBracketRound(roundLabel) {
    switch (roundLabel) {
        case 'Quartos de Final':
            return t('quarterFinals');
        case 'Meias-Finais':
            return t('semiFinals');
        case 'Final':
            return t('finals');
        case '3º Lugar':
            return t('thirdPlace');
        default:
            return roundLabel;
    }
}

function isBracketPlaceholder(teamLabel) {
    return /^Vencedor\s+[A-Z]{1,2}\d+$/.test(teamLabel) ||
        /^Perdedor\s+[A-Z]{1,2}\d+$/.test(teamLabel) ||
        /^Vencido\s+[A-Z]{1,2}\d+$/.test(teamLabel);
}

function translateBracketPlaceholder(teamLabel) {
    const match = teamLabel.match(/^(Vencedor|Perdedor|Vencido)\s+([A-Z]{1,2}\d+)$/);
    if (!match) {
        return teamLabel;
    }

    const prefix = match[1] === 'Vencedor' ? t('bracketWinner') : t('bracketLoser');
    return `${prefix} ${match[2]}`;
}

function getDateLocale() {
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'pt';
    return lang === 'en' ? 'en-GB' : 'pt-PT';
}

function removeChartAriaLabel() {
    const chartRoot = document.querySelector('#eloChart');
    if (!chartRoot) return;

    chartRoot.querySelectorAll('svg[aria-label="chart"], svg[aria-label="Chart"]').forEach(svg => {
        svg.removeAttribute('aria-label');
    });

    chartRoot.querySelectorAll('title').forEach(title => {
        if (title.textContent && title.textContent.trim().toLowerCase() === 'chart') {
            title.remove();
        }
    });
}

function getTranslatedTeamLabel(courseInfo, fallbackName) {
    const shortName = courseInfo?.shortName || fallbackName || '';
    return translateTeamName(shortName);
}


/**
         * Obtém as informações de um curso pelo nome
         * @param {string} courseName Nome do curso
         * @returns {object} Informações do curso (nome completo, núcleo, emblema, cores)
         */
function getCourseInfo(courseName) {
    if (!courseName) return null;

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

    if (normalizedInput === 'cienciasbiomedicas') {
        courseKey = 'CBM';
    } else if (normalizedInput === 'cienciasbiomedicasb') {
        courseKey = 'CBM B';
    } else if (normalizedInput === 'engeletronicaetelecomunicacoes') {
        courseKey = 'EET';
    } else if (normalizedInput === 'engeletronicaetelecomunicacoesb') {
        courseKey = 'EET B';
    }

    // coursesConfig já é o objeto courses (loadCoursesConfig faz data.courses)
    let courseInfo = coursesConfig ? coursesConfig[courseKey] : null;
    if (!courseInfo && coursesConfig) {
        const normalizedKey = normalizeText(courseKey).replace(/[^a-z0-9]/g, '');
        const matchedKey = Object.keys(coursesConfig).find(
            (key) => normalizeText(key).replace(/[^a-z0-9]/g, '') === normalizedKey
        );
        if (matchedKey) {
            courseKey = matchedKey;
            courseInfo = coursesConfig[matchedKey];
        }
    }

    if (courseInfo) {
        return {
            shortName: courseInfo.shortName || courseKey,
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
        currentSeriesData: [], // Armazena os dados das séries atuais para tooltips
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
    },

    // Dados históricos das últimas épocas
    historical: {
        data: {}, // {epoca: {classificacoes: [], detalhes: []}}
        loaded: false,
        currentModalidade: null
    }
};

let currentLoadToken = 0;
let historicalTooltipEl = null;

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
        { value: 'ANDEBOL MISTO', label: t('ANDEBOL_MISTO') },
        { value: 'BASQUETEBOL FEMININO', label: t('BASQUETEBOL_FEMININO') },
        { value: 'BASQUETEBOL MASCULINO', label: t('BASQUETEBOL_MASCULINO') },
        { value: 'FUTEBOL DE 7 MASCULINO', label: t('FUTEBOL_DE_7_MASCULINO') },
        { value: 'FUTSAL FEMININO', label: t('FUTSAL_FEMININO') },
        { value: 'FUTSAL MASCULINO', label: t('FUTSAL_MASCULINO') },
        { value: 'VOLEIBOL FEMININO', label: t('VOLEIBOL_FEMININO') },
        { value: 'VOLEIBOL MASCULINO', label: t('VOLEIBOL_MASCULINO') }
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

    // Tentar carregar época e modalidade do cache (localStorage)
    const cachedEpoca = localStorage.getItem('mmr_selectedEpoca');
    const cachedModalidade = localStorage.getItem('mmr_selectedModalidade');
    const cachedCompactMode = localStorage.getItem('mmr_compactModeEnabled');

    // Restaurar modo compacto se existir no cache
    if (cachedCompactMode !== null) {
        compactModeEnabled = cachedCompactMode === 'true';
        const checkbox = document.getElementById('compactModeCheckbox');
        if (checkbox) checkbox.checked = compactModeEnabled;
    }

    // Definir época atual - priorizar cache se válido
    if (!currentEpoca && availableEpocas.length > 0) {
        if (cachedEpoca && availableEpocas.includes(cachedEpoca)) {
            currentEpoca = cachedEpoca;
            DebugUtils.debugFileLoading('cached_epoch_loaded', { epoch: currentEpoca });
        } else {
            currentEpoca = availableEpocas[0];
            DebugUtils.debugFileLoading('default_epoch_set', { epoch: currentEpoca });
        }
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

    // Tentar carregar modalidade do cache
    const cachedModalidade = localStorage.getItem('mmr_selectedModalidade');

    // Tentar preservar modalidade atual ou do cache se existir na nova época
    let modalidadeToLoad = null;

    // Extrair o nome da modalidade atual sem a época (ex: "FUTSAL MASCULINO_25_26" -> "FUTSAL MASCULINO")
    let currentModalidadeName = null;
    if (currentModalidade) {
        currentModalidadeName = currentModalidade.replace(/_\d{2}_\d{2}$/, '');
    }

    // Também extrair nome da modalidade do cache
    let cachedModalidadeName = null;
    if (cachedModalidade) {
        cachedModalidadeName = cachedModalidade.replace(/_\d{2}_\d{2}$/, '');
    }

    modalidades.forEach((mod, index) => {
        const option = document.createElement('option');
        option.value = mod.value;
        option.textContent = mod.label;

        // Verificar se esta modalidade corresponde à atual ou cached
        const modName = mod.value.replace(/_\d{2}_\d{2}$/, '');

        if (currentModalidadeName && modName === currentModalidadeName) {
            // Preservar modalidade atual se existir na nova época
            option.selected = true;
            modalidadeToLoad = mod.value;
        } else if (!modalidadeToLoad && cachedModalidadeName && modName === cachedModalidadeName) {
            // Usar modalidade do cache como segunda prioridade
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

/**
 * Atualiza os labels dos seletores quando o idioma é mudado
 */
function updateSelectorLabels() {
    const modalidadeSelect = document.getElementById('modalidade');
    if (!modalidadeSelect) return;

    const currentEpoca = document.getElementById('epoca')?.value;
    if (!currentEpoca) return;

    // Obter as modalidades com os labels atual (em novo idioma)
    const modalidades = getModalidadesForEpoca(currentEpoca);

    // Atualizar os labels das opções de modalidade
    Array.from(modalidadeSelect.options).forEach(option => {
        const mod = modalidades.find(m => m.value === option.value);
        if (mod) {
            option.textContent = mod.label;
        }
    });
}

// Função para trocar época
function changeEpoca(epoca) {
    if (!epoca || epoca === currentEpoca) return;

    currentEpoca = epoca;

    // Salvar época selecionada no cache
    localStorage.setItem('mmr_selectedEpoca', epoca);

    updateModalidadeSelector();
}

/**
 * Procura o ranking key onde uma equipa existe
 * Retorna a chave de rankings ou null se não encontrada
 */
function findRankingKeyForTeam(teamName) {
    if (sampleData.teams && sampleData.teams.length > 0) {
    }

    if (!teamName || !sampleData.rankings) {
        return null;
    }


    // Procurar em todas as chaves de rankings pela equipa
    for (const [rankingKey, teams] of Object.entries(sampleData.rankings)) {
        const teamExists = teams.some(t => t.team === teamName);
        if (teamExists) {
            return rankingKey;
        }
    }

    return null;
}

/**
 * Obtém a divisão e o grupo a partir de uma chave de rankings
 * E.g. "1ª Divisão - Grupo A" -> { division: "1ª Divisão", group: "Grupo A" }
 */
function parseRankingKey(rankingKey) {
    if (!rankingKey) return { division: null, group: null };

    // Se for "1ª Divisão - Grupo A", extrair ambos
    if (rankingKey.includes(' - Grupo ')) {
        const parts = rankingKey.split(' - ');
        return { division: parts[0], group: parts[1] };
    }

    // Se for só "1ª Divisão" ou "Grupo A" ou "geral"
    if (rankingKey.startsWith('Grupo ')) {
        return { division: null, group: rankingKey };
    }

    if (rankingKey === 'geral') {
        return { division: null, group: null };
    }

    return { division: rankingKey, group: null };
}

// ==================== SISTEMA DE HISTÓRICO DE CLASSIFICAÇÕES ====================

/**
 * Verifica se uma época está concluída (tem jogos de playoffs E1, E2, E3)
 */
function isSeasonCompleted(modalidade, epoca) {
    const detalhes = appState.historical.data[epoca]?.detalhes || [];
    // Procurar por jogo E3 (Final) que indica época concluída
    return detalhes.some(jogo => jogo.Jornada === 'E3');
}

function hasUnknownResultMarker(row) {
    if (!row) return false;
    return Object.values(row).some(value => value && value.toString().trim() === '?');
}

function getChampionLabels(modalidade) {
    const normalized = (modalidade || '').toUpperCase();
    const isFeminino = normalized.includes('FEMININO');
    return isFeminino
        ? { 1: 'Campeãs', 2: 'Vice-Campeãs', 3: '3º Lugar', 4: '4º Lugar' }
        : { 1: 'Campeões', 2: 'Vice-Campeões', 3: '3º Lugar', 4: '4º Lugar' };
}

function getChampionPredictionLabel(modalidade) {
    const normalized = (modalidade || '').toUpperCase();
    const isFeminino = normalized.includes('FEMININO');
    return isFeminino
        ? { label: 'Campeãs', description: 'Probabilidade de serem campeãs' }
        : { label: 'Campeões', description: 'Probabilidade de serem campeões' };
}

/**
 * Extrai as posições gerais (1º-4º) e resultados de quartos de final dos dados de detalhes
 */
function extractGeneralRankings(detalhes) {
    const result = {
        1: null, // Campeão
        2: null, // Vice-campeão
        3: null, // 3º lugar
        4: null, // 4º lugar
        quartos: [] // Equipas eliminadas nos quartos
    };

    if (!detalhes || detalhes.length === 0) return result;

    // Procurar jogos de playoffs
    const final = detalhes.find(j => j.Jornada === 'E3'); // Final
    const terceiro = detalhes.find(j => j.Jornada === 'E3L'); // Jogo 3º lugar
    const semifinais = detalhes.filter(j => j.Jornada === 'E2'); // Meias-finais
    const quartos = detalhes.filter(j => j.Jornada === 'E1'); // Quartos

    // Extrair campeão e vice (da final)
    if (final) {
        const gols1 = parseFloat(final['Golos 1']) || 0;
        const gols2 = parseFloat(final['Golos 2']) || 0;
        const equipa1 = final['Equipa 1'];
        const equipa2 = final['Equipa 2'];

        if (gols1 > gols2) {
            result[1] = normalizeTeamName(equipa1);
            result[2] = normalizeTeamName(equipa2);
        } else {
            result[1] = normalizeTeamName(equipa2);
            result[2] = normalizeTeamName(equipa1);
        }
    }

    // Extrair 3º e 4º lugar (do jogo do 3º lugar)
    if (terceiro) {
        const gols1 = parseFloat(terceiro['Golos 1']) || 0;
        const gols2 = parseFloat(terceiro['Golos 2']) || 0;
        const equipa1 = terceiro['Equipa 1'];
        const equipa2 = terceiro['Equipa 2'];

        if (gols1 > gols2) {
            result[3] = normalizeTeamName(equipa1);
            result[4] = normalizeTeamName(equipa2);
        } else {
            result[3] = normalizeTeamName(equipa2);
            result[4] = normalizeTeamName(equipa1);
        }
    }

    // Extrair resultados dos quartos de final
    quartos.forEach(jogo => {
        const gols1 = parseFloat(jogo['Golos 1']) || 0;
        const gols2 = parseFloat(jogo['Golos 2']) || 0;
        const equipa1 = jogo['Equipa 1'];
        const equipa2 = jogo['Equipa 2'];
        const unknownResult = hasUnknownResultMarker(jogo);

        let perdedor, vencedor, resultado;
        if (gols1 > gols2) {
            perdedor = normalizeTeamName(equipa2);
            vencedor = normalizeTeamName(equipa1);
            resultado = `${gols2}-${gols1}`;
        } else {
            perdedor = normalizeTeamName(equipa1);
            vencedor = normalizeTeamName(equipa2);
            resultado = `${gols1}-${gols2}`;
        }

        result.quartos.push({
            equipa: perdedor,
            resultado: resultado,
            adversario: vencedor,
            unknownResult: unknownResult
        });
    });

    return result;
}

/**
 * Verifica se o ELO final de uma equipa numa época é compatível com o ELO inicial de outra equipa na época seguinte
 * @param {string} teamEpocaAnterior - Nome da equipa na época anterior
 * @param {string} epocaAnterior - Época anterior
 * @param {string} teamEpocaAtual - Nome da equipa na época atual
 * @param {string} epocaAtual - Época atual
 * @returns {boolean} - true se os ELO batem (diferença < 5%), false caso contrário
 */
function validateELOContinuity(teamEpocaAnterior, epocaAnterior, teamEpocaAtual, epocaAtual) {
    const dataAnterior = appState.historical.data[epocaAnterior];
    const dataAtual = appState.historical.data[epocaAtual];

    if (!dataAnterior?.elo || !dataAtual?.elo) {
        return true; // Se não temos dados de ELO, aceitar baseado só no emblema
    }

    // Encontrar última linha (último jogo) da época anterior
    const eloDataAnterior = dataAnterior.elo;
    if (eloDataAnterior.length === 0) {
        return true;
    }

    const ultimaLinhaAnterior = eloDataAnterior[eloDataAnterior.length - 1];
    const eloFinalAnterior = parseFloat(ultimaLinhaAnterior[teamEpocaAnterior]);

    // Encontrar primeira linha (início) da época atual
    const eloDataAtual = dataAtual.elo;
    if (eloDataAtual.length === 0) {
        return true;
    }

    const primeiraLinhaAtual = eloDataAtual[0];
    const eloInicialAtual = parseFloat(primeiraLinhaAtual[teamEpocaAtual]);

    if (isNaN(eloFinalAnterior) || isNaN(eloInicialAtual)) {
        return true; // Se não conseguimos ler os valores, aceitar
    }

    // ELO deve ser exatamente igual (ou diferença < 1 para arredondamentos)
    const diferenca = Math.abs(eloFinalAnterior - eloInicialAtual);
    return diferenca < 1;
}

/**
 * Encontra equipas do mesmo núcleo (mesmo emblema) numa época específica
 * @param {string} currentTeamName - Nome da equipa atual
 * @param {string} epoca - Época a procurar
 * @param {string} epocaSeguinte - Época seguinte (para validação de ELO)
 * @returns {string|null} - Nome da equipa com mesmo emblema ou null
 */
function findTeamBySameCore(currentTeamName, epoca, epocaSeguinte = null) {
    const normalizedCurrent = normalizeTeamName(currentTeamName);
    const currentInfo = getCourseInfo(normalizedCurrent);

    if (!currentInfo || !currentInfo.emblemPath) {
        return null;
    }

    const epocaData = appState.historical.data[epoca];
    if (!epocaData || !epocaData.classificacoes) {
        return null;
    }

    // Procurar outra equipa com o mesmo emblema
    for (const classificacao of epocaData.classificacoes) {
        const teamName = normalizeTeamName(classificacao.Equipa);

        // Pular se for o mesmo nome
        if (teamName === normalizedCurrent) {
            continue;
        }

        const teamInfo = getCourseInfo(teamName);
        if (teamInfo && teamInfo.emblemPath === currentInfo.emblemPath) {
            // Se temos época seguinte, validar continuidade de ELO
            if (epocaSeguinte) {
                const eloValido = validateELOContinuity(teamName, epoca, normalizedCurrent, epocaSeguinte);
                if (eloValido) {
                    return teamName;
                } else {
                    continue; // ELO não bate, continuar procurando
                }
            }

            // Sem época seguinte para validar, retornar baseado só no emblema
            return teamName;
        }
    }

    return null;
}

/**
 * Rastreia o histórico de uma equipa seguindo mudanças de nome (mesmo núcleo/emblema)
 * @param {string} teamName - Nome da equipa a rastrear
 * @param {Array<string>} epocas - Lista de épocas ordenadas (mais recente primeiro)
 * @returns {Object} - Mapa de epoca -> nome da equipa nessa época
 */
function traceTeamNameChanges(teamName, epocas) {
    const nameMap = {};
    let currentName = normalizeTeamName(teamName);

    for (let i = 0; i < epocas.length; i++) {
        const epoca = epocas[i];
        const epocaData = appState.historical.data[epoca];
        if (!epocaData) continue;

        // Verificar se a equipa com o nome atual existe nesta época
        const foundDirect = epocaData.classificacoes.find(c =>
            normalizeTeamName(c.Equipa) === currentName
        );

        if (foundDirect) {
            nameMap[epoca] = currentName;
        } else {
            // Época seguinte para validação de ELO (a anterior no array, pois está em ordem decrescente)
            const epocaSeguinte = i > 0 ? epocas[i - 1] : null;

            // Procurar equipa do mesmo núcleo (emblema) com validação de ELO
            const sameCoreName = findTeamBySameCore(currentName, epoca, epocaSeguinte);
            if (sameCoreName) {
                nameMap[epoca] = sameCoreName;
                currentName = sameCoreName; // Atualizar nome atual para continuar o rastro
            }
        }
    }

    return nameMap;
}

/**
 * Constrói o histórico de uma equipa nas últimas 5 épocas
 */
function buildTeamHistory(teamName, modalidade) {
    const normalizedTeam = normalizeTeamName(teamName);
    const history = [];
    const epocas = Object.keys(appState.historical.data).sort().reverse(); // Mais recente primeiro
    const currentSeasonEpoca = currentEpoca || appState.selection.epoca;

    // Rastrear mudanças de nome ao longo das épocas
    const nameMap = traceTeamNameChanges(teamName, epocas);

    let count = 0;

    for (const epoca of epocas) {
        const epocaData = appState.historical.data[epoca];
        if (!epocaData) continue;

        // Verificar se é época atual e se está concluída
        const isCurrentSeason = epoca === currentSeasonEpoca;
        const isCompleted = isSeasonCompleted(modalidade, epoca);

        // Usar o nome correto para esta época (pode ter mudado)
        const teamNameInEpoca = nameMap[epoca] || normalizedTeam;
        const isDifferentName = teamNameInEpoca !== normalizedTeam;

        // Procurar equipa nas classificações (com nome que tinha nesta época)
        const classificacao = epocaData.classificacoes.find(c =>
            normalizeTeamName(c.Equipa) === teamNameInEpoca
        );

        if (!classificacao) {
            // Equipa não participou nesta época - adicionar entrada indicando isso
            history.push({
                epoca: epoca,
                posGrupo: null,
                divisao: null,
                grupo: null,
                posGeral: null,
                descricaoGeral: null,
                naoParticipou: true,
                emAndamento: isCurrentSeason && !isCompleted,
                nomeAnterior: null
            });
            count++;
            if (count >= 5) break;
            continue;
        }

        // Extrair informações
        const posGrupo = parseInt(classificacao.Posicao) || 0;
        const divisao = classificacao.Divisao;
        const grupo = classificacao.Grupo && classificacao.Grupo !== 'nan' ? classificacao.Grupo : null;

        // Extrair posição geral (playoffs)
        const generalRankings = extractGeneralRankings(epocaData.detalhes);
        let posGeral = null;
        let descricaoGeral = null;

        // Verificar posições 1-4 (usar nome da época)
        const labels = getChampionLabels(modalidade);
        for (let pos = 1; pos <= 4; pos++) {
            if (generalRankings[pos] === teamNameInEpoca) {
                posGeral = pos;
                descricaoGeral = labels[pos];
                break;
            }
        }

        // Verificar se foi eliminado nos quartos
        if (!posGeral) {
            const quartoInfo = generalRankings.quartos.find(q => q.equipa === teamNameInEpoca);
            if (quartoInfo) {
                const unknownIndicator = quartoInfo.unknownResult
                    ? ` <span class="unknown-result-indicator" style="display: inline-block; margin-left: 6px; padding: 2px 6px;"><small style="color: #666; font-style: italic;">⚠️ ${t('unknownResult')}</small></span>`
                    : '';
                descricaoGeral = `Quartos: ${quartoInfo.resultado} vs ${getPreferredTeamLabel(quartoInfo.adversario)}${unknownIndicator}`;
            }
        }

        history.push({
            epoca: epoca,
            posGrupo: posGrupo,
            divisao: divisao,
            grupo: grupo,
            posGeral: posGeral,
            descricaoGeral: descricaoGeral,
            naoParticipou: false,
            emAndamento: isCurrentSeason && !isCompleted,
            nomeAnterior: isDifferentName ? teamNameInEpoca : null
        });

        count++;
        if (count >= 5) break; // Limitar a 5 épocas
    }

    // Reverter para ter do mais antigo para o mais recente
    history.reverse();

    // Calcular progressões (comparando cada época com a anterior)
    for (let i = 0; i < history.length; i++) {
        const atual = history[i];

        // Não calcular progressão se a época está em andamento
        if (atual.emAndamento) {
            atual.progressao = 'none';
            continue;
        }

        if (i > 0 && !atual.naoParticipou) {
            const anterior = history[i - 1];

            // Se a época anterior também não participou, não calcular progressão
            if (anterior.naoParticipou) {
                atual.progressao = 'none';
            } else {
                // Comparar posição no grupo (menor é melhor)
                if (atual.posGrupo < anterior.posGrupo) {
                    atual.progressao = 'up';
                } else if (atual.posGrupo > anterior.posGrupo) {
                    atual.progressao = 'down';
                } else {
                    atual.progressao = 'same';
                }

                // Se mudou de divisão, considerar isso na progressão (menor divisão é melhor)
                // Apenas comparar se ambas as divisões existirem (algumas modalidades não têm divisões)
                if (atual.divisao && anterior.divisao && atual.divisao !== anterior.divisao) {
                    const divAtual = parseInt(atual.divisao) || 0;
                    const divAnterior = parseInt(anterior.divisao) || 0;
                    if (divAtual < divAnterior) {
                        atual.progressao = 'up'; // Subiu de divisão
                    } else if (divAtual > divAnterior) {
                        atual.progressao = 'down'; // Desceu de divisão
                    }
                }
            }
        } else {
            atual.progressao = 'none'; // Primeira época no histórico ou não participou
        }
    }

    return history; // Já está do mais antigo para o mais recente
}

/**
 * Carrega dados históricos de classificações e detalhes para todas as épocas disponíveis
 */
async function loadHistoricalData(modalidade) {
    // Se já carregou para esta modalidade, não recarregar
    if (appState.historical.loaded && appState.historical.currentModalidade === modalidade) {
        return;
    }

    appState.historical.data = {};
    appState.historical.loaded = false;
    appState.historical.currentModalidade = modalidade;

    const epocasDisponiveis = availableEpocas || ['24_25']; // Fallback
    const promises = [];

    for (const epoca of epocasDisponiveis) {
        const classificacaoPath = `output/elo_ratings/classificacao_${modalidade.replace(/\d{2}_\d{2}/, epoca)}.csv`;
        const detalhePath = `output/csv_modalidades/${modalidade.replace(/\d{2}_\d{2}/, epoca)}.csv`;
        const eloPath = `output/elo_ratings/elo_${modalidade.replace(/\d{2}_\d{2}/, epoca)}.csv`;

        // Carregar classificações
        const classPromise = new Promise((resolve) => {
            Papa.parse(classificacaoPath, {
                download: true,
                header: true,
                complete: (results) => {
                    resolve({ epoca, tipo: 'classificacoes', data: results.data });
                },
                error: () => {
                    resolve({ epoca, tipo: 'classificacoes', data: [] });
                }
            });
        });

        // Carregar detalhes
        const detPromise = new Promise((resolve) => {
            Papa.parse(detalhePath, {
                download: true,
                header: true,
                complete: (results) => {
                    resolve({ epoca, tipo: 'detalhes', data: results.data });
                },
                error: () => {
                    resolve({ epoca, tipo: 'detalhes', data: [] });
                }
            });
        });

        // Carregar ELO
        const eloPromise = new Promise((resolve) => {
            Papa.parse(eloPath, {
                download: true,
                header: true,
                complete: (results) => {
                    resolve({ epoca, tipo: 'elo', data: results.data });
                },
                error: () => {
                    resolve({ epoca, tipo: 'elo', data: [] });
                }
            });
        });

        promises.push(classPromise, detPromise, eloPromise);
    }

    // Aguardar todos os carregamentos
    const results = await Promise.all(promises);

    // Organizar dados por época
    results.forEach(result => {
        if (!appState.historical.data[result.epoca]) {
            appState.historical.data[result.epoca] = {
                classificacoes: [],
                detalhes: [],
                elo: []
            };
        }

        if (result.tipo === 'classificacoes') {
            appState.historical.data[result.epoca].classificacoes = result.data;
        } else if (result.tipo === 'detalhes') {
            appState.historical.data[result.epoca].detalhes = result.data;
        } else if (result.tipo === 'elo') {
            appState.historical.data[result.epoca].elo = result.data;
        }
    });

    appState.historical.loaded = true;
}

/**
 * Cria o elemento HTML do tooltip histórico
 */
function createHistoricalTooltip() {
    const tooltip = document.createElement('div');
    tooltip.id = 'historical-tooltip';
    tooltip.className = 'historical-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
    return tooltip;
}

/**
 * Renderiza e mostra o tooltip histórico para uma equipa
 */
async function showHistoricalTooltip(teamName, anchorEl) {
    if (!historicalTooltipEl) {
        historicalTooltipEl = createHistoricalTooltip();
    }

    const modalidade = currentModalidade;
    if (!modalidade) return;

    // Carregar dados históricos primeiro
    await loadHistoricalData(modalidade);

    const history = buildTeamHistory(teamName, modalidade);

    if (history.length === 0) {
        // Sem histórico disponível
        historicalTooltipEl.style.display = 'none';
        return;
    }

    // Verificar se há pelo menos uma época onde a equipa participou
    const participouEmAlgumaEpoca = history.some(entry => !entry.naoParticipou);

    if (!participouEmAlgumaEpoca) {
        // Equipa nunca participou em nenhuma época - não mostrar tooltip
        historicalTooltipEl.style.display = 'none';
        return;
    }

    const normalizedTeam = normalizeTeamName(teamName);
    const courseInfo = getCourseInfo(normalizedTeam);
    const displayName = translateTeamName(courseInfo.fullName || teamName);
    const emblemPath = courseInfo.emblemPath || 'assets/taça_ua.png';

    // Construir HTML do tooltip
    let html = `
        <div class="historical-tooltip-header">
            <img src="${emblemPath}" alt="${displayName}" class="historical-tooltip-emblem" onerror="this.style.display='none'">
            <span class="historical-tooltip-title">${displayName}</span>
        </div>
        <div class="historical-tooltip-subtitle">${t('historicalRankings')}</div>
        <table class="historical-tooltip-table">
            <thead>
                <tr>
                    <th>${t('season')}</th>
                    <th>${t('group')}</th>
                    <th>${t('general')}</th>
                </tr>
            </thead>
            <tbody>
    `;

    history.forEach((entry, index) => {
        const epocaLabel = entry.epoca.replace('_', '/');
        const emAndamentoSuffix = entry.emAndamento ? ` <span style="color: #94a3b8; font-size: 0.85em;">(${t('inProgress')})</span>` : '';

        let grupoLabel, geralLabel;
        if (entry.naoParticipou) {
            grupoLabel = `<span style="color: #94a3b8; font-style: italic;">${t('didNotParticipate')}</span>`;
            geralLabel = '—';
        } else {
            // Formato para modalidades com divisões
            if (entry.divisao) {
                grupoLabel = entry.grupo
                    ? `${entry.divisao}ª Div - Grupo ${entry.grupo} (${entry.posGrupo}º)`
                    : `${entry.divisao}ª Div (${entry.posGrupo}º)`;
            } else {
                // Formato para modalidades sem divisões
                grupoLabel = entry.grupo
                    ? `Grupo ${entry.grupo} (${entry.posGrupo}º)`
                    : `${entry.posGrupo}º lugar`;
            }

            // Se tinha nome diferente, adicionar indicação
            if (entry.nomeAnterior) {
                const nomeAnteriorInfo = getCourseInfo(entry.nomeAnterior);
                const displayNomeAnterior = nomeAnteriorInfo.fullName || entry.nomeAnterior;
                grupoLabel += `<br><span style="color: #94a3b8; font-size: 0.85em; font-style: italic;">Como: ${displayNomeAnterior}</span>`;
            }

            geralLabel = entry.descricaoGeral || '—';
        }

        // Adicionar classe especial para épocas onde não participou
        const rowClass = entry.naoParticipou ? ' class="no-participation"' : '';

        html += `
            <tr${rowClass}>
                <td>${epocaLabel}${emAndamentoSuffix}</td>
                <td>${grupoLabel}</td>
                <td class="historical-general-col">${geralLabel}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    historicalTooltipEl.innerHTML = html;

    // Posicionar tooltip
    positionHistoricalTooltip(anchorEl);

    // Mostrar tooltip
    historicalTooltipEl.style.display = 'block';
    historicalTooltipEl.setAttribute('data-team', teamName);
}

/**
 * Posiciona o tooltip histórico na tela
 */
function positionHistoricalTooltip(anchorEl) {
    if (!historicalTooltipEl) return;

    const tooltip = historicalTooltipEl;
    const padding = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (!anchorEl || !anchorEl.getBoundingClientRect) {
        return;
    }

    const anchorRect = anchorEl.getBoundingClientRect();

    // Mostrar temporariamente para medir
    tooltip.style.display = 'block';
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = anchorRect.right + padding;
    let top = anchorRect.top;

    // Ajustar se sair da tela na horizontal
    if (left + tooltipRect.width > viewportWidth - padding) {
        left = anchorRect.left - tooltipRect.width - padding;
    }

    // Ajustar se sair da tela na vertical
    if (top + tooltipRect.height > viewportHeight - padding) {
        top = viewportHeight - tooltipRect.height - padding;
    }

    // Garantir que não sai pelos cantos
    left = Math.max(padding, Math.min(left, viewportWidth - tooltipRect.width - padding));
    top = Math.max(padding, Math.min(top, viewportHeight - tooltipRect.height - padding));

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

/**
 * Esconde o tooltip histórico
 */
function hideHistoricalTooltip() {
    if (historicalTooltipEl && !historicalTooltipEl.classList.contains('fixed')) {
        historicalTooltipEl.style.display = 'none';
    }
}

function changeModalidade(mod) {
    if (!mod) return;

    currentLoadToken += 1;
    const loadToken = currentLoadToken;

    // Atualizar modalidade atual
    currentModalidade = mod;

    // Salvar modalidade selecionada no cache
    localStorage.setItem('mmr_selectedModalidade', mod);

    // Caminhos relativos
    const classificacaoPath = `output/elo_ratings/classificacao_${mod}.csv`;
    const detalhePath = `output/elo_ratings/detalhe_${mod}.csv`;
    const eloPath = `output/elo_ratings/elo_${mod}.csv`;
    const jogosPath = `output/csv_modalidades/${mod}.csv`;

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
    document.getElementById('teamSelector').innerHTML = `<div class="loading"><div class="spinner"></div>${t('loadingData')}</div>`;
    document.getElementById('rankingsBody').innerHTML = `<tr><td colspan="11" class="loading">${t('loadingRankings')}</td></tr>`;

    let loadedFiles = 0;
    const totalFiles = 4; // Agora são 4 ficheiros

    function checkAllLoaded() {
        if (loadToken !== currentLoadToken) return;
        loadedFiles++;
        DebugUtils.debugFileLoading('file_loaded', { current: loadedFiles, total: totalFiles });
        if (loadedFiles === totalFiles) {
            DebugUtils.debugFileLoading('all_files_loaded', sampleData);
            // Todos os arquivos carregados, atualizar interface
            setTimeout(() => {
                if (loadToken !== currentLoadToken) return;

                // ===== PASSO 1: Auto-navegar para a equipa favorita ANTES de renderizar seletores =====
                if (favoriteTeam) {
                    // Procurar diretamente a equipa nos rankings
                    const rankingKey = findRankingKeyForTeam(favoriteTeam);

                    if (rankingKey) {
                        // A equipa favorita está nesta modalidade
                        DebugUtils.debugRankingsProcessing('favorite_team_navigation', {
                            team: favoriteTeam,
                            rankingKey: rankingKey
                        });

                        // Definir directamente no appState ANTES de renderizar os seletores
                        // A "divisão" é realmente a chave de rankings completa
                        appState.view.division = rankingKey;

                        // Extrair grupo se existir
                        const { group: rankingGroup } = parseRankingKey(rankingKey);
                        appState.view.group = rankingGroup;

                        currentDivision = rankingKey;
                        currentGroup = rankingGroup;

                    } else {
                    }
                }

                // ===== PASSO 2: Renderizar seletores (que vão respeitar appState.view já definido) =====
                createTeamSelector();
                createDivisionSelector();
                updateGroupSelector(); // Garantir que seletor de grupos é renderizado
                updateQuickFilters(); // Atualizar filtros baseados na estrutura
                updateRankingsTable();
                initializeCalendarSelectors(); // Inicializar calendário
                if (eloChart) {
                    updateEloChart();
                }
                // Brackets serão carregados depois de processar rankings

                // ===== PASSO 3: Sincronizar gráfico com a vista final =====
                if (appState.view.group) {
                    // Seletor de grupo já trata da lógica de filtrar
                    const groupLetter = appState.view.group.replace('Grupo ', '');
                    filterGroup(groupLetter);
                } else if (appState.view.division) {
                    filterDivision(appState.view.division);
                } else {
                }

                // Disparar evento indicando que os dados foram carregados
                document.dispatchEvent(new CustomEvent('data:loaded'));

                // Carregar dados históricos em background
                loadHistoricalData(mod).catch(err => {
                    console.error('Erro ao carregar dados históricos:', err);
                });
            }, 500);
        }
    }

    // Carregar CSVs
    Papa.parse(classificacaoPath, {
        download: true,
        header: true,
        complete: results => {
            if (loadToken !== currentLoadToken) return;
            processRankings(results.data);
            checkAllLoaded();
        },
        error: error => {
            if (loadToken !== currentLoadToken) return;
            console.error('Erro ao carregar classificação:', error);
            checkAllLoaded();
        }
    });

    Papa.parse(jogosPath, {
        download: true,
        header: true,
        complete: results => {
            if (loadToken !== currentLoadToken) return;
            processMatches(results.data);
            checkAllLoaded();
        },
        error: error => {
            if (loadToken !== currentLoadToken) return;
            console.error('Erro ao carregar jogos:', error);
            checkAllLoaded();
        }
    });

    // Carregar ficheiro elo_*.csv com ELOs iniciais PRIMEIRO
    Papa.parse(eloPath, {
        download: true,
        header: false, // Sem cabeçalho - primeira linha é nomes, segunda é valores
        complete: results => {
            if (loadToken !== currentLoadToken) return;
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
                    const previousEloPath = `output/elo_ratings/elo_${mod.replace(currentEpoch, previousEpoch)}.csv`;

                    Papa.parse(previousEloPath, {
                        download: true,
                        header: false,
                        complete: prevResults => {
                            if (loadToken !== currentLoadToken) return;
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
                            if (loadToken !== currentLoadToken) return;
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
                        if (loadToken !== currentLoadToken) return;
                        processEloHistory(results.data, initialElosFromFile, previousSeasonTeams);
                        checkAllLoaded();
                    },
                    error: error => {
                        if (loadToken !== currentLoadToken) return;
                        console.error('Erro ao carregar detalhes ELO:', error);
                        checkAllLoaded();
                    }
                });
            }
        },
        error: error => {
            if (loadToken !== currentLoadToken) return;
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
        btn.textContent = translateDivisionLabel(div);
        btn.dataset.division = div;
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
        btn.textContent = `${t('groupLabel')} ${group}`;
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

    // Sincronizar com gráfico ELO
    filterDivision(division);

    // Atualizar previsões
    updatePredictionsSelectors();
    refreshPredictionsTeamsForSelection();
    updatePredictionsDisplay();
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

    // Sincronizar com gráfico ELO
    if (group) {
        filterGroup(group);
    }

    // Atualizar previsões
    updatePredictionsSelectors();
    refreshPredictionsTeamsForSelection();
    updatePredictionsDisplay();
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
        gamesList.innerHTML = '<div class="no-games-message">' + t('noGamesFound') + '</div>';
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

    div.className = `game-item ${hasResult ? 'played' : 'not-played'} ${isTeamFavorite(team1) || isTeamFavorite(team2) ? 'favorite-team-game' : ''}`;

    // Obter informações das equipas
    const team1Info = getCourseInfo(team1);
    const team2Info = getCourseInfo(team2);

    // Calendário sempre usa nome curto
    const displayTeam1 = getTranslatedTeamLabel(team1Info, team1);
    const displayTeam2 = getTranslatedTeamLabel(team2Info, team2);

    // Formatar data e hora
    let dateStr;
    if (hasDate) {
        dateStr = formatGameDate(gameDate);
        if (gameTime) {
            dateStr += ` • ${gameTime}`;
        }
    } else {
        dateStr = t('dateToSchedule');
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
        `<img src="${team1Info.emblemPath}" class="game-team-emblem" alt="${displayTeam1}" onerror="this.style.display='none'">` : '';
    const emblem2Html = team2Info.emblemPath ?
        `<img src="${team2Info.emblemPath}" class="game-team-emblem" alt="${displayTeam2}" onerror="this.style.display='none'">` : '';

    div.innerHTML = `
                <div class="game-date">${dateStr}</div>
                <div class="game-teams">
                    <div class="game-team home">
                        ${elo1Html}
                        ${emblem1Html}
                        <span class="game-team-name">${displayTeam1}</span>
                    </div>
                    ${scoreHtml}
                    <div class="game-team away">
                        <span class="game-team-name">${displayTeam2}</span>
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
        const posicaoRaw = row.Posicao || row['Posição'] || row.posicao || row['posição'];
        const explicitPosition = posicaoRaw !== undefined && posicaoRaw !== '' ? parseInt(posicaoRaw) : null;

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
        }
        // Equipa duplicada ignorada silenciosamente (é normal em context com divisões/grupos)

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
            group: grupo,
            position: explicitPosition
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

function getMatchRowKey(row) {
    const team1Raw = row["Equipa 1"] || row.team1 || '';
    const team2Raw = row["Equipa 2"] || row.team2 || '';
    const team1 = normalizeTeamName(String(team1Raw).trim());
    const team2 = normalizeTeamName(String(team2Raw).trim());
    const date = row.Dia || row.Data || row.date || '';
    const time = row.Hora || row.time || '';
    const division = row['Divisão'] || row.Divisao || row.division || '';
    const grupo = row.Grupo || row.grupo || '';
    const jornada = row.Jornada || row.jornada || '';

    return `${jornada}|${team1}|${team2}|${date}|${time}|${division}|${grupo}`;
}

function getMatchRowScore(row) {
    const raw1 = row["Golos 1"] ?? row.score1 ?? row["Resultado 1"] ?? row["Golos Equipa 1"];
    const raw2 = row["Golos 2"] ?? row.score2 ?? row["Resultado 2"] ?? row["Golos Equipa 2"];
    const score1 = raw1 !== '' && raw1 !== undefined && raw1 !== null ? parseInt(raw1) : null;
    const score2 = raw2 !== '' && raw2 !== undefined && raw2 !== null ? parseInt(raw2) : null;
    return { score1, score2 };
}

function getMatchRowQuality(row) {
    const date = row.Dia || row.Data || row.date || '';
    const time = row.Hora || row.time || '';
    const { score1, score2 } = getMatchRowScore(row);
    const hasScore = score1 !== null && score2 !== null;
    const hasTime = !!time;
    const hasDate = !!date;
    return (hasScore ? 4 : 0) + (hasTime ? 2 : 0) + (hasDate ? 1 : 0);
}

function pickPreferredMatchRow(existingRow, candidateRow) {
    const existingQuality = getMatchRowQuality(existingRow);
    const candidateQuality = getMatchRowQuality(candidateRow);
    if (candidateQuality > existingQuality) return candidateRow;
    if (candidateQuality < existingQuality) return existingRow;

    const existingScore = getMatchRowScore(existingRow);
    const candidateScore = getMatchRowScore(candidateRow);

    const existingHasScore = existingScore.score1 !== null && existingScore.score2 !== null;
    const candidateHasScore = candidateScore.score1 !== null && candidateScore.score2 !== null;

    if (candidateHasScore && !existingHasScore) return candidateRow;
    if (existingHasScore && !candidateHasScore) return existingRow;

    if (candidateHasScore && existingHasScore) {
        if (candidateScore.score1 !== existingScore.score1 || candidateScore.score2 !== existingScore.score2) {
            const candidateTotal = candidateScore.score1 + candidateScore.score2;
            const existingTotal = existingScore.score1 + existingScore.score2;
            if (candidateTotal !== existingTotal) {
                return candidateTotal > existingTotal ? candidateRow : existingRow;
            }
            if (candidateScore.score1 !== existingScore.score1) {
                return candidateScore.score1 > existingScore.score1 ? candidateRow : existingRow;
            }
        }
    }

    return existingRow;
}

function dedupeMatchRows(rows) {
    const byKey = new Map();
    const collisions = [];

    rows.forEach(row => {
        const key = getMatchRowKey(row);
        if (!byKey.has(key)) {
            byKey.set(key, row);
            return;
        }

        const existingRow = byKey.get(key);
        const preferredRow = pickPreferredMatchRow(existingRow, row);
        if (preferredRow !== existingRow) {
            byKey.set(key, preferredRow);
        }

        const existingScore = getMatchRowScore(existingRow);
        const candidateScore = getMatchRowScore(row);
        if (existingScore.score1 !== candidateScore.score1 || existingScore.score2 !== candidateScore.score2) {
            collisions.push({
                key,
                existing: existingScore,
                candidate: candidateScore
            });
        }
    });

    if (collisions.length > 0) {
        console.warn('[Aviso] Colisoes de jogos detectadas e resolvidas:', collisions);
    }

    return Array.from(byKey.values());
}

function processMatches(data) {
    sampleData.matches = [];

    // Analisar sistema de playoff/liguilha ao processar os jogos
    analyzePlayoffSystem(data);

    const deduped = dedupeMatchRows(data);

    deduped.forEach(row => {
        if (!row["Equipa 1"] || !row["Equipa 2"]) return;

        // Extrair golos (podem estar vazios para jogos futuros)
        const golos1 = row["Golos 1"];
        const golos2 = row["Golos 2"];

        const team1 = normalizeTeamName(row["Equipa 1"].trim());
        const team2 = normalizeTeamName(row["Equipa 2"].trim());
        const date = row.Dia || row.Data || '';
        const time = row.Hora || '';
        const division = row['Divisão'] || row.Divisao || '';
        const grupo = row.Grupo || '';

        sampleData.matches.push({
            jornada: row.Jornada,
            team1: team1,
            team2: team2,
            score1: golos1 !== '' && golos1 !== undefined ? parseInt(golos1) : null,
            score2: golos2 !== '' && golos2 !== undefined ? parseInt(golos2) : null,
            date: date,
            time: time,
            division: division || null,
            grupo: grupo || null
        });
    });
}

/**
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

// ==================== FUNÇÕES DE PROCESSAMENTO ELO ====================

/**
 * Processa o histórico de ELO das equipas
 */
function processEloHistory(data, initialElosFromFile = {}, previousSeasonTeams = new Set()) {
    const processor = new EloHistoryProcessor();
    processor.process(data, initialElosFromFile, previousSeasonTeams);
}

/**
 * Marca resultados desconhecidos baseado nos dados do calendário
 */
function markUnknownResultsFromCalendar() {
    if (!sampleData.calendarData || !sampleData.gameDetails) {
        return;
    }

    // Comparar dados do calendário (csv_modalidades) com detalhes de ELO
    sampleData.calendarData.forEach(calendarMatch => {
        const team1 = normalizeTeamName(calendarMatch['Equipa 1']);
        const team2 = normalizeTeamName(calendarMatch['Equipa 2']);
        const round = calendarMatch.Jornada;

        if (team1 && sampleData.gameDetails[team1] && sampleData.gameDetails[team1][round]) {
            const gameDetail = sampleData.gameDetails[team1][round];
            // Se não há resultado no calendário mas há detalhes de ELO, o resultado era desconhecido
            const calendarResult1 = calendarMatch['Golos 1'];
            const calendarResult2 = calendarMatch['Golos 2'];

            if (!calendarResult1 && !calendarResult2 && gameDetail.result) {
                gameDetail.unknownResult = true;
            }
        }

        if (team2 && sampleData.gameDetails[team2] && sampleData.gameDetails[team2][round]) {
            const gameDetail = sampleData.gameDetails[team2][round];
            const calendarResult1 = calendarMatch['Golos 1'];
            const calendarResult2 = calendarMatch['Golos 2'];

            if (!calendarResult1 && !calendarResult2 && gameDetail.result) {
                gameDetail.unknownResult = true;
            }
        }
    });
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
                finalElo: finalElo1,  // ELO final APÓS o jogo
                goalsFor: golos1,
                goalsAgainst: golos2,
                outcome: resultado1,  // V, E, D ou null se desconhecido
                date: gameDate,
                unknownResult: false,  // Será marcado depois pela função markUnknownResultsFromCalendar
                form: []  // Será preenchido pela função calculateFormForAllGames()
            };


            sampleData.gameDetails[team2][round] = {
                opponent: team1,
                result: golos1 !== null && golos2 !== null ? `${golos2}-${golos1}` : null,
                eloDelta: eloDelta2,
                finalElo: finalElo2,  // ELO final APÓS o jogo
                goalsFor: golos2,
                goalsAgainst: golos1,
                outcome: resultado2,  // V, E, D ou null se desconhecido
                date: gameDate,
                unknownResult: false,  // Será marcado depois pela função markUnknownResultsFromCalendar
                form: []  // Será preenchido pela função calculateFormForAllGames()
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
                // Se já existe, manter a data mais antiga (hora menor)
                if (!allDatesMap.has(dateKey)) {
                    allDatesMap.set(dateKey, date);
                } else {
                    const existing = allDatesMap.get(dateKey);
                    if (date < existing) {
                        allDatesMap.set(dateKey, date);
                    }
                }
            });
        });

        const chronologicalDates = Array.from(allDatesMap.values())
            .sort((a, b) => a - b);

        // EXTRA: Deduplicar novamente por dia completo (garantir zero duplicatas)
        const finalDatesMap = new Map();
        chronologicalDates.forEach(date => {
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            if (!finalDatesMap.has(dateKey)) {
                finalDatesMap.set(dateKey, date);
            }
        });
        const finalChronologicalDates = Array.from(finalDatesMap.values()).sort((a, b) => a - b);

        // Data inicial baseada na época
        const initialDate = currentEpoca === '25_26' ? new Date('2025-09-01') : new Date('2024-09-01');

        // Se há equipas da época anterior, adicionar um ponto antes do início
        const hasPreviousSeasonData = this.teamsFromPreviousSeason && this.teamsFromPreviousSeason.size > 0;
        if (hasPreviousSeasonData) {
            const previousSeasonDate = new Date(initialDate);
            previousSeasonDate.setDate(previousSeasonDate.getDate() - 15); // 15 dias antes do início
            this.allDates = [previousSeasonDate, initialDate, ...finalChronologicalDates];
        } else {
            this.allDates = [initialDate, ...finalChronologicalDates];
        }

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

        // REMOVIDO: Não adicionar data extra para ajustes inter-grupos
        // Os ajustes devem ser aplicados na mesma data do último jogo
        // Adicionar uma data separada causa pontos vazios no gráfico
        DebugUtils.debugProcessedData('ajustes intergrupos encontrados', this.hasInterGroupAdjustments ? 1 : 0, this.hasInterGroupAdjustments);

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
            const gameDate = parseDateWithTime(row.Dia, row.Hora);  // FIX: usar parseDateWithTime para ter correção de ano
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
        const hasPreviousSeasonData = this.teamsFromPreviousSeason && this.teamsFromPreviousSeason.size > 0;

        allTeamsWithGames.forEach(teamName => {
            const initialElo = initialElosFromFile[teamName] || this.teamInitialElo[teamName] || DEFAULT_ELO;
            teamCurrentElo[teamName] = initialElo;

            // Se há equipas da época anterior, adicionar ponto extra no início
            if (hasPreviousSeasonData) {
                if (this.teamsFromPreviousSeason.has(teamName)) {
                    // Equipa estava na época anterior - adicionar ELO inicial nos dois primeiros pontos
                    // [época anterior, início da época]
                    sampleData.eloHistory[teamName] = [initialElo, initialElo];
                } else {
                    // Equipa nova - adicionar null no ponto da época anterior, e ELO no início da época
                    // [null (época anterior), início da época]
                    sampleData.eloHistory[teamName] = [null, initialElo];
                }
            } else {
                // Sem época anterior - apenas ponto inicial
                sampleData.eloHistory[teamName] = [initialElo];
            }
        });

        // 6. Processar cada data em sequência (usando this.allDates que já tem tudo)
        // Para cada data, processar os jogos dessa data e atualizar ELO das equipas
        this.allDates.forEach(date => {
            const dateKey = this._getLocalDateKey(date);

            if (gameRoundsByDate.has(dateKey)) {
                const rounds = gameRoundsByDate.get(dateKey);

                // Rastrear quais equipas jogaram nesta data
                const teamsWhoPlayedToday = new Set();

                // Processar cada rodada de jogos dessa data
                rounds.forEach((roundGames) => {
                    // Atualizar ELO das equipas que jogaram
                    roundGames.forEach(game => {

                        if (game.finalElo1) {
                            teamCurrentElo[game.team1] = game.finalElo1;
                            teamsWhoPlayedToday.add(game.team1);
                        }
                        if (game.finalElo2) {
                            teamCurrentElo[game.team2] = game.finalElo2;
                            teamsWhoPlayedToday.add(game.team2);
                        }
                    });
                });

                // CORREÇÃO: Adicionar ponto apenas às equipas que jogaram nesta data
                teamsWhoPlayedToday.forEach(teamName => {
                    sampleData.eloHistory[teamName].push(teamCurrentElo[teamName]);
                });
            }
        });

        // REMOVIDO: Pontos filler para ajustes inter-grupos
        // Estes pontos estavam causando slots extras desnecessários após a final

        // 5. Guardar array de datas (época anterior se houver + inicial + todas as datas de eventos)
        // IMPORTANTE: Usar this.allDates e this.roundsByDateOrder que já incluem os playoffs
        // Não usar allDates local que foi reconstruído apenas a partir dos jogos regulares/playoffs com dados
        sampleData.gamesDates = this.allDates;
        sampleData.roundsByDateOrder = this.roundsByDateOrder;



        // 6. Processar equipas que não jogaram (nem fase regular nem playoffs nem ajustes)
        // CORREÇÃO: Equipas sem jogos não devem ter pontos para cada data de playoff
        // Devem ter apenas: ponto inicial (e época anterior se houver)
        sampleData.teams.forEach(team => {
            if (!sampleData.eloHistory[team.name]) {
                const initialElo = initialElosFromFile[team.name] || this.teamInitialElo[team.name] || DEFAULT_ELO;

                if (hasPreviousSeasonData) {
                    if (this.teamsFromPreviousSeason.has(team.name)) {
                        // Equipa estava na época anterior - apenas 2 pontos: época anterior + início
                        sampleData.eloHistory[team.name] = [initialElo, initialElo];
                    } else {
                        // Equipa nova - null na época anterior, ELO no início
                        sampleData.eloHistory[team.name] = [null, initialElo];
                    }
                } else {
                    // Sem época anterior - apenas ponto inicial
                    sampleData.eloHistory[team.name] = [initialElo];
                }
            }
        });

        // Calcular form (últimos 5 resultados) para cada jogo
        calculateFormForAllGames();
    }
}

/**
 * Calcula o array de forma (últimos 5 resultados V/E/D) para cada jogo
 */
function calculateFormForAllGames() {
    if (!sampleData.gameDetails) {
        // console.log('[DEBUG] sampleData.gameDetails não existe!');
        return;
    }

    const teamsCount = Object.keys(sampleData.gameDetails).length;
    // console.log('[DEBUG] calculateFormForAllGames iniciado com', teamsCount, 'equipas');

    let totalGamesProcessed = 0;
    let formsCalculated = 0;

    // Para cada equipa
    Object.keys(sampleData.gameDetails).forEach(teamName => {
        const teamGames = sampleData.gameDetails[teamName];

        const roundsCount = Object.keys(teamGames).length;
        totalGamesProcessed += roundsCount;

        // Obter lista de jornadas ordenadas numericamente
        const rounds = Object.keys(teamGames).sort((a, b) => {
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            // Playoffs vêm depois dos números
            return a.localeCompare(b);
        });

        // Para cada jogo, calcular form com base nos jogos anteriores
        rounds.forEach((round, idx) => {
            const form = [];

            // Pegar os últimos 5 jogos anteriores
            for (let i = Math.max(0, idx - 5); i < idx; i++) {
                const prevRound = rounds[i];
                const prevGame = teamGames[prevRound];
                if (prevGame && prevGame.outcome && (prevGame.outcome === 'V' || prevGame.outcome === 'E' || prevGame.outcome === 'D')) {
                    form.push(prevGame.outcome); // push mantém ordem cronológica
                }
            }

            // Atualizar o form do jogo atual
            if (teamGames[round]) {
                teamGames[round].form = form;
                if (form.length > 0) {
                    formsCalculated++;
                }
            }
        });
    });

    // console.log(`[DEBUG] Processados ${totalGamesProcessed} jogos, ${formsCalculated} com forma calculada`);
}

// ==================== SISTEMA DE EVENT DELEGATION ====================

class EventManager {
    constructor() {
        this.handlers = new Map();
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
        if (!(event.target instanceof Element)) {
            return;
        }

        for (const [key, handlers] of this.handlers) {
            const [type, selector] = key.split(':');

            if (type !== eventType) {
                continue;
            }

            const matchedTarget = event.target.closest(selector);
            if (matchedTarget) {
                const delegatedEvent = Object.assign({}, event, {
                    target: matchedTarget,
                    currentTarget: matchedTarget,
                    originalEvent: event
                });
                handlers.forEach(handler => handler(delegatedEvent));
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

        // Validar divisão atual: usar a já definida se for válida, senão usar a primeira
        if (!appState.view.division || !divisions.includes(appState.view.division)) {
            appState.view.division = divisions[0];
        } else {
        }

        divisions.forEach(division => {
            const btn = document.createElement('button');
            btn.className = `division-btn ${division === appState.view.division ? 'active' : ''}`;
            btn.textContent = translateDivisionLabel(division);
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
            btn.classList.toggle('active', btn.dataset.division === division);
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
        allBtn.textContent = t('allGroups');
        allBtn.dataset.group = '';
        this.element.appendChild(allBtn);

        // Botões de grupos
        groups.forEach(group => {
            const btn = document.createElement('button');
            btn.className = `group-btn ${group === appState.view.group ? 'active' : ''}`;
            btn.textContent = `${t('groupLabel')} ${group}`;
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

// Inicializar EventManager
eventManager.init();

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
    if (division) switchDivision(division); // Usar switchDivision para sincronizar tudo
});

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', initApp);

// Recalcular altura do gráfico quando mudar orientação ou resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (eloChart) {
            const isLandscapeMobile = window.matchMedia('(max-width: 932px) and (orientation: landscape)').matches;
            const newHeight = isLandscapeMobile
                ? Math.min(Math.max(window.innerHeight * 0.5, 300), 520)
                : Math.min(Math.max(window.innerHeight * 0.65, 380), 640);
            eloChart.updateOptions({
                chart: {
                    height: newHeight
                }
            });
        }
    }, 250);
});

// Event listeners para controles de teclado
document.addEventListener('keydown', (event) => {
    // Verificar se o usuário está editando texto
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
});

// Inicializar sistema de debug (desativado por padrão)
document.addEventListener('DOMContentLoaded', function () {
    // Para ativar debug, descomente a linha abaixo:
    // DebugUtils.setDebugEnabled(true, false, ['informática', 'informatica']);
});

// ==================== SISTEMA DE PREVISÕES ====================

// Estado das previsões
const PredictionsState = {
    forecastData: null,      // Dados do forecast (estatísticas gerais)
    predictionsData: null,   // Dados das previsões jogo a jogo
    availableTeams: [],      // Lista de equipas disponíveis
    currentTeamIndex: 0,     // Índice da equipa atual no slider
    selectedTeam: null,      // Nome da equipa selecionada
    simulations: null        // Numero de simulacoes usadas
};

let predictionsTooltipEl = null;
let predictionsTooltipChart = null;

function getForecastDataForCurrentGroup() {
    if (!PredictionsState.forecastData) return [];

    const divisionKey = appState.view.division;
    const groupKey = appState.view.group;

    if (!divisionKey || !sampleData.rankings || !sampleData.rankings[divisionKey]) {
        return PredictionsState.forecastData;
    }

    const divisionTeams = sampleData.rankings[divisionKey];
    const groupTeams = groupKey ? divisionTeams.filter(team => team.group === groupKey) : divisionTeams;
    const teamSet = new Set(groupTeams.map(team => normalizeTeamName(team.team)));

    return PredictionsState.forecastData.filter(row =>
        row.team && teamSet.has(normalizeTeamName(row.team))
    );
}

function refreshPredictionsTeamsForSelection() {
    const forecastSubset = getForecastDataForCurrentGroup();


    PredictionsState.availableTeams = forecastSubset
        .map(row => row.team)
        .filter(team => team && team.trim() !== '')
        .sort((a, b) => a.localeCompare(b, 'pt-PT'));


    if (PredictionsState.availableTeams.length === 0) {
        PredictionsState.selectedTeam = null;
        PredictionsState.currentTeamIndex = 0;
        return;
    }

    if (!PredictionsState.selectedTeam || !PredictionsState.availableTeams.includes(PredictionsState.selectedTeam)) {
        // Se houver equipa favorita e ela estiver disponível, selecionar automaticamente
        // Precisa fazer matching usando normalização porque favoriteTeam pode ser "EI" e availableTeams ter "Eng. Informática"
        if (favoriteTeam) {
            // Procurar equipa com chave canónica igual
            const favoriteCanonical = resolveCanonicalCourseKey(favoriteTeam);
            const matchingTeam = PredictionsState.availableTeams.find(team => {
                const teamCanonical = resolveCanonicalCourseKey(team);
                return teamCanonical === favoriteCanonical;
            });

            if (matchingTeam) {
                PredictionsState.selectedTeam = matchingTeam;
            } else {
                PredictionsState.currentTeamIndex = 0;
                PredictionsState.selectedTeam = PredictionsState.availableTeams[0];
            }
        } else {
            PredictionsState.currentTeamIndex = 0;
            PredictionsState.selectedTeam = PredictionsState.availableTeams[0];
        }
        return;
    }

    PredictionsState.currentTeamIndex = PredictionsState.availableTeams.indexOf(PredictionsState.selectedTeam);
}

function updatePredictionsDivisionSelector() {
    const container = document.getElementById('predictionsDivisionSelector');
    if (!container) return;

    if (!sampleData.rankings) {
        container.style.display = 'none';
        return;
    }

    const divisions = Object.keys(sampleData.rankings);
    if (divisions.length <= 1) {
        container.style.display = 'none';
        return;
    }

    if (!appState.view.division || !divisions.includes(appState.view.division)) {
        appState.view.division = divisions[0];
    }

    container.style.display = 'flex';
    container.innerHTML = '';

    divisions.forEach(division => {
        const btn = document.createElement('button');
        btn.className = `division-btn ${division === appState.view.division ? 'active' : ''}`;
        btn.textContent = translateDivisionLabel(division);
        btn.dataset.division = division;
        container.appendChild(btn);
    });
}

function updatePredictionsGroupSelector() {
    const container = document.getElementById('predictionsGroupSelector');
    if (!container) return;

    if (!sampleData.rankings || !sampleData.rankings[appState.view.division]) {
        container.style.display = 'none';
        return;
    }

    const divisionHasGroup = appState.view.division && appState.view.division.includes('Grupo');
    if (divisionHasGroup) {
        container.style.display = 'none';
        appState.view.group = null;
        return;
    }

    const teams = sampleData.rankings[appState.view.division];
    const groups = [...new Set(teams.map(team => team.group))].filter(group => group && group !== 'nan');

    if (groups.length === 0) {
        container.style.display = 'none';
        appState.view.group = null;
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = `group-btn ${!appState.view.group ? 'active' : ''}`;
    allBtn.textContent = t('allGroups');
    allBtn.dataset.group = '';
    container.appendChild(allBtn);

    groups.forEach(group => {
        const btn = document.createElement('button');
        btn.className = `group-btn ${group === appState.view.group ? 'active' : ''}`;
        btn.textContent = `${t('groupLabel')} ${group}`;
        btn.dataset.group = group;
        container.appendChild(btn);
    });
}

function updatePredictionsSelectors() {
    updatePredictionsDivisionSelector();
    updatePredictionsGroupSelector();
}

let previsoesFilesCache = null;

/**
 * Carrega um ficheiro de previsões com simulações fixas
 * @param {string} fileType - "forecast" ou "previsoes"
 * @param {string} modalidadeBase - Nome da modalidade
 * @param {string} anoCompleto - Ano completo (ex: "2026")
 * @returns {Promise<{data: string, sims: number}|null>} - Conteudo do ficheiro CSV e num simulacoes ou null se nao encontrar
 */
async function tryLoadWithSimulations(fileType, modalidadeBase, anoCompleto) {
    // GitHub Pages não suporta directory listing, por isso usamos simulações fixas
    const simulations = [1000000, 100000, 10000];

    for (const sims of simulations) {
        const filename = `output/previsoes/${fileType}_${modalidadeBase}_${anoCompleto}_${sims}.csv`;

        try {
            const response = await fetch(filename);
            if (response.ok) {
                const csvdata = await response.text();
                return { data: csvdata, sims: sims };
            }
        } catch (error) {
            // Continuar para o próximo número de simulações
        }
    }

    console.warn(`Nenhum ficheiro de ${fileType} encontrado para ${modalidadeBase} ${anoCompleto}`);
    return null;
}

/**
 * Carrega os dados de previsões baseado na época e modalidade selecionadas
 */
async function loadPredictionsData() {
    const epoca = document.getElementById('epoca').value;
    const modalidade = document.getElementById('modalidade').value;

    if (!epoca || !modalidade) {
        clearPredictionsDisplay();
        return;
    }

    try {
        // Formato dos ficheiros: forecast_MODALIDADE_ANO_SIMS.csv
        // ex: forecast_FUTSAL MASCULINO_2026_1000000.csv
        // modalidade vem como "FUTSAL MASCULINO_25_26", precisamos extrair a base e converter para ano
        const modalidadeMatch = modalidade.match(/^(.+)_(\d{2})_(\d{2})$/);
        if (!modalidadeMatch) {
            console.error('Formato de modalidade inválido:', modalidade);
            clearPredictionsDisplay();
            return;
        }

        const modalidadeBase = modalidadeMatch[1]; // "FUTSAL MASCULINO"
        const anoFinal = modalidadeMatch[3]; // "26"
        const anoCompleto = `20${anoFinal}`; // "2026"

        // Tentar carregar forecast com diferentes números de simulações
        const forecastResult = await tryLoadWithSimulations('forecast', modalidadeBase, anoCompleto);
        if (!forecastResult) {
            clearPredictionsDisplay();
            return;
        }

        PredictionsState.simulations = forecastResult.sims;
        PredictionsState.forecastData = Papa.parse(forecastResult.data, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        }).data;

        // Tentar carregar previsões com diferentes números de simulações
        const predictionsResult = await tryLoadWithSimulations('previsoes', modalidadeBase, anoCompleto);
        if (!predictionsResult) {
            clearPredictionsDisplay();
            return;
        }

        PredictionsState.predictionsData = Papa.parse(predictionsResult.data, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        }).data;

        updatePredictionsSimulationsCount();
        updatePredictionsSelectors();
        refreshPredictionsTeamsForSelection();

        if (PredictionsState.availableTeams.length > 0) {
            updatePredictionsDisplay();
        } else {
            clearPredictionsDisplay();
        }

    } catch (error) {
        console.error('Erro ao carregar previsões:', error);
        clearPredictionsDisplay();
    }
}

function updatePredictionsSimulationsCount() {
    const countEl = document.getElementById('predictionsSimCount');
    if (countEl && PredictionsState.simulations) {
        const formatted = PredictionsState.simulations.toLocaleString('pt-PT');
        countEl.textContent = `(${formatted} ${t('simulations')})`;
    }
}

/**
 * Limpa a exibição de previsões quando não há dados
 */
function clearPredictionsDisplay() {
    document.getElementById('selectedTeamName').textContent = t('dataNotAvailable');
    document.getElementById('selectedTeamEmblem').innerHTML = '';
    document.getElementById('predictionsStatsGrid').innerHTML = `<div class="no-predictions-message">${t('noPredictionsData')}</div>`;
    document.getElementById('predictionsTableBody').innerHTML = `<tr><td colspan="7" class="no-predictions-message">${t('noDataAvailableShort')}</td></tr>`;

    // Desabilitar botões
    document.getElementById('prevTeamBtn').disabled = true;
    document.getElementById('nextTeamBtn').disabled = true;

    PredictionsState.forecastData = null;
    PredictionsState.predictionsData = null;
    PredictionsState.availableTeams = [];
    PredictionsState.simulations = null;
}

/**
 * Atualiza a exibição com os dados da equipa selecionada
 */
function updatePredictionsDisplay() {
    if (!PredictionsState.forecastData) {
        clearPredictionsDisplay();
        return;
    }

    refreshPredictionsTeamsForSelection();
    if (!PredictionsState.selectedTeam) {
        clearPredictionsDisplay();
        return;
    }

    const prevBtn = document.getElementById('prevTeamBtn');
    const nextBtn = document.getElementById('nextTeamBtn');
    const disableNav = PredictionsState.availableTeams.length <= 1;
    if (prevBtn) prevBtn.disabled = disableNav;
    if (nextBtn) nextBtn.disabled = disableNav;

    // Atualizar nome e emblema da equipa
    updateTeamSliderDisplay();

    // Atualizar estatísticas gerais
    updatePredictionsStats();

    // Atualizar cabeçalhos da tabela de previsões conforme a modalidade
    updatePredictionsTableHeaders();

    // Atualizar tabela de previsões
    updatePredictionsTable();
}

/**
 * Atualiza o display do slider com a equipa atual
 */
function updateTeamSliderDisplay() {
    const teamName = PredictionsState.selectedTeam;
    if (!teamName) return;

    // Setar custom properties dos gaps responsivos
    const sliderContainer = document.querySelector('.team-slider-container');
    if (sliderContainer) {
        const gaps = getResponsiveGaps();
        sliderContainer.style.setProperty('--gap1', `${gaps.gap1}px`);
        sliderContainer.style.setProperty('--gap2', `${gaps.gap2}px`);
        sliderContainer.style.setProperty('--gap3', `${gaps.gap3}px`);
    }

    const courseInfo = getCourseInfo(teamName);
    const totalTeams = PredictionsState.availableTeams.length;
    const currentIndex = PredictionsState.currentTeamIndex;

    // Atualizar nome
    const nameEl = document.getElementById('selectedTeamName');
    const displayName = translateTeamName(courseInfo.fullName || courseInfo.shortName || teamName);
    nameEl.textContent = displayName;

    // Remover estrela anterior se existir
    const oldStar = nameEl.querySelector('.favorite-star-btn');
    if (oldStar) {
        oldStar.remove();
    }

    // Botão de favorito - usar isTeamFavorite() para comparação correta
    const isFav = isTeamFavorite(teamName);
    const starBtn = document.createElement('span');
    starBtn.className = 'favorite-star-btn';
    starBtn.style.color = isFav ? '#fbbf24' : '#ccc';
    starBtn.innerHTML = isFav ? '★' : '☆';
    starBtn.title = isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos';

    starBtn.onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(teamName);
    };

    nameEl.appendChild(starBtn);

    // Atualizar emblema central
    const emblemContainer = document.getElementById('selectedTeamEmblem');
    renderPredictionsEmblem(emblemContainer, courseInfo, teamName);

    // Atualizar todos os ghosts
    for (let offset = -3; offset <= 3; offset++) {
        if (offset === 0) continue; // Pular o centro

        const ghostIndex = (currentIndex + offset + totalTeams) % totalTeams;
        const ghostTeam = PredictionsState.availableTeams[ghostIndex];

        let ghostElement;
        if (offset < 0) {
            ghostElement = document.querySelector(`.ghost-left-${Math.abs(offset)}`);
        } else {
            ghostElement = document.querySelector(`.ghost-right-${offset}`);
        }

        if (ghostElement && ghostTeam) {
            const ghostInfo = getCourseInfo(ghostTeam);
            renderPredictionsEmblem(ghostElement, ghostInfo, ghostTeam, true);
        } else if (ghostElement) {
            ghostElement.innerHTML = '';
        }
    }

    // Limpar estilos inline dos ghosts DEPOIS de renderizar tudo
    // Usar requestAnimationFrame para garantir que o browser processou o re-render primeiro
    requestAnimationFrame(() => {
        // Verificar se ainda está animando - se sim, esperar mais
        const mainEmblem = document.getElementById('selectedTeamEmblem');

        if (mainEmblem && mainEmblem.classList.contains('animating')) {
            // Ainda está animando, esperar até terminar
            return;
        }

        const allGhosts = document.querySelectorAll('.team-slider-ghost');
        allGhosts.forEach(ghost => {
            if (!ghost.classList.contains('animating')) {
                ghost.style.removeProperty('transform');
                ghost.style.removeProperty('opacity');
                ghost.style.removeProperty('filter');
                ghost.style.removeProperty('visibility');
            }
        });
    });
}

function renderPredictionsEmblem(container, courseInfo, teamName, isGhost = false, invisibleStart = false) {
    if (!container) return;

    if (courseInfo.emblemPath) {
        const ghostClass = isGhost ? 'team-slider-ghost-emblem' : '';
        const existingImg = container.querySelector('img');

        // Se a imagem já existe e é a mesma, não re-renderizar (evitar piscar)
        if (existingImg) {
            const currentSrc = existingImg.src;
            const newSrc = courseInfo.emblemPath;

            // Comparar apenas o final do caminho (filename)
            const currentFilename = currentSrc.split('/').pop().split('\\').pop();
            const newFilename = newSrc.split('/').pop().split('\\').pop();

            if (currentFilename === newFilename) {
                // Mesma imagem, não fazer nada
                return;
            }
        }

        // Criar nova imagem (com opacity 0 se invisibleStart for true)
        const styleAttr = invisibleStart ? ' style="opacity: 0;"' : '';
        container.innerHTML = `<img src="${courseInfo.emblemPath}" alt="${courseInfo.fullName || teamName}" class="${ghostClass}"${styleAttr}>`;
    } else if (!isGhost) {
        container.innerHTML = `<div class="team-slider-fallback" style="background: ${courseInfo.primaryColor};"></div>`;
    } else {
        container.innerHTML = '';
    }
}

function getResponsiveGaps() {
    const width = window.innerWidth;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    // Mobile (≤480px)
    if (width <= 480) {
        const scale = clamp(width / 380, 0.9, 1.08);
        return {
            gap1: Math.round(50 * scale),
            gap2: Math.round(85 * scale),
            gap3: Math.round(112 * scale),
            gap4: Math.round(138 * scale)
        };
    }
    // Tablet (≤768px)
    else if (width <= 768) {
        const scale = clamp(width / 700, 0.92, 1.12);
        return {
            gap1: Math.round(75 * scale),
            gap2: Math.round(135 * scale),
            gap3: Math.round(175 * scale),
            gap4: Math.round(215 * scale)
        };
    }
    // Desktop
    const scale = clamp(width / 1200, 0.9, 1.15);
    return {
        gap1: Math.round(95 * scale),
        gap2: Math.round(165 * scale),
        gap3: Math.round(210 * scale),
        gap4: Math.round(255 * scale)
    };
}

function getResponsiveScales() {
    const width = window.innerWidth;

    // Mobile (≤480px) - animações mais contidas
    if (width <= 480) {
        return {
            scale1: 0.65,
            scale2: 0.45,
            scale3: 0.3,
            scale4: 0.1,
            opacity1: 0.45,
            opacity2: 0.3,
            opacity3: 0.18,
            opacity4: 0.1
        };
    }
    // Tablet (≤768px)
    else if (width <= 768) {
        return {
            scale1: 0.75,
            scale2: 0.55,
            scale3: 0.4,
            scale4: 0.35,
            opacity1: 0.55,
            opacity2: 0.4,
            opacity3: 0.3,
            opacity4: 0.2
        };
    }
    // Desktop - valores originais
    return {
        scale1: 0.7,
        scale2: 0.5,
        scale3: 0.35,
        scale4: 0.3,
        opacity1: 0.5,
        opacity2: 0.35,
        opacity3: 0.2,
        opacity4: 0.1
    };
}

function animateTeamSlider(direction) {
    const mainEmblem = document.getElementById('selectedTeamEmblem');
    const allGhosts = document.querySelectorAll('.team-slider-ghost');
    const sliderContainer = document.querySelector('.team-slider-container');

    if (!mainEmblem) return;

    // Obter gaps e escalas responsivos
    const gaps = getResponsiveGaps();
    const scales = getResponsiveScales();

    // Definir custom properties dos gaps no container para que o CSS use corretos
    if (sliderContainer) {
        sliderContainer.style.setProperty('--gap1', `${gaps.gap1}px`);
        sliderContainer.style.setProperty('--gap2', `${gaps.gap2}px`);
        sliderContainer.style.setProperty('--gap3', `${gaps.gap3}px`);
    }

    // Limpar classes de animação anteriores
    mainEmblem.classList.remove('slide-left', 'slide-right', 'enter-from-left', 'enter-from-right', 'animating');

    // Limpar variáveis CSS anteriores
    mainEmblem.style.removeProperty('--start-x');
    mainEmblem.style.removeProperty('--start-scale');
    mainEmblem.style.removeProperty('--end-x');
    mainEmblem.style.removeProperty('--end-scale');

    allGhosts.forEach(ghost => {
        ghost.classList.remove('animating');

        // Remover estilos inline para permitir que o CSS base controle novamente
        ghost.style.removeProperty('animation');
        ghost.style.removeProperty('--start-x');
        ghost.style.removeProperty('--start-scale');
        ghost.style.removeProperty('--start-opacity');
        ghost.style.removeProperty('--end-x');
        ghost.style.removeProperty('--end-scale');
        ghost.style.removeProperty('--end-opacity');
        ghost.style.removeProperty('transform');
        ghost.style.removeProperty('opacity');
        ghost.style.removeProperty('filter');
        ghost.style.removeProperty('visibility');
    });

    void mainEmblem.offsetWidth; // Forçar reflow

    if (direction === 'prev') {
        // Navegar para trás (seta esquerda)
        // Emblema principal sai para a direita (0 → 1)
        mainEmblem.style.setProperty('--start-x', '-50%');
        mainEmblem.style.setProperty('--start-scale', '1');
        mainEmblem.style.setProperty('--end-x', `calc(-50% + ${gaps.gap1}px)`);
        mainEmblem.style.setProperty('--end-scale', `${scales.scale1}`);
        mainEmblem.classList.add('slide-right', 'animating');

        // Animar ghosts: todos movem uma posição para a direita
        allGhosts.forEach(ghost => {
            const position = parseInt(ghost.dataset.position);
            const newPos = position + 1;

            if (position === 3) {
                // Ghost mais à direita: desaparece
                ghost.style.animation = 'fadeOut 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            } else if (position === -1) {
                // Ghost esquerdo que vai para o centro: anima para ser o novo principal
                ghost.style.setProperty('--start-x', `calc(-50% - ${gaps.gap1}px)`);
                ghost.style.setProperty('--start-scale', `${scales.scale1}`);
                ghost.style.setProperty('--start-opacity', `${scales.opacity1}`);
                ghost.style.setProperty('--end-x', '-50%');
                ghost.style.setProperty('--end-scale', '1');
                ghost.style.setProperty('--end-opacity', '1');
                ghost.style.animation = 'ghostToMain 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            } else if (position === -2) {
                // Ghost esquerdo na posição -2: move para posição -1
                ghost.style.setProperty('--start-x', `calc(-50% - ${gaps.gap2}px)`);
                ghost.style.setProperty('--start-scale', `${scales.scale2}`);
                ghost.style.setProperty('--start-opacity', `${scales.opacity2}`);
                ghost.style.setProperty('--end-x', `calc(-50% - ${gaps.gap1}px)`);
                ghost.style.setProperty('--end-scale', `${scales.scale1}`);
                ghost.style.setProperty('--end-opacity', `${scales.opacity1}`);
                ghost.style.animation = 'ghostShiftRight 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            } else if (position === -3) {
                // Ghost na posição -3: move para posição -2
                ghost.style.setProperty('--start-x', `calc(-50% - ${gaps.gap3}px)`);
                ghost.style.setProperty('--start-scale', `${scales.scale3}`);
                ghost.style.setProperty('--start-opacity', `${scales.opacity3}`);
                ghost.style.setProperty('--end-x', `calc(-50% - ${gaps.gap2}px)`);
                ghost.style.setProperty('--end-scale', `${scales.scale2}`);
                ghost.style.setProperty('--end-opacity', `${scales.opacity2}`);
                ghost.style.animation = 'ghostShiftRight 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            } else if (position === -4) {
                // Ghost temporário na posição -4: desliza para -3 com fade-in
                ghost.classList.remove('temp-ghost-invisible');  // Remover classe antes da animação
                ghost.style.setProperty('--start-x', `calc(-50% - ${gaps.gap4}px)`);
                ghost.style.setProperty('--start-scale', `${scales.scale4}`);
                ghost.style.setProperty('--start-opacity', '0');
                ghost.style.setProperty('--end-x', `calc(-50% - ${gaps.gap3}px)`);
                ghost.style.setProperty('--end-scale', `${scales.scale3}`);
                ghost.style.setProperty('--end-opacity', `${scales.opacity3}`);
                ghost.style.animation = 'ghostShiftRight 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            } else if (position === 1) {
                // Ghost direito próximo: move para posição 2
                ghost.style.setProperty('--start-x', `calc(-50% + ${gaps.gap1}px)`);
                ghost.style.setProperty('--start-scale', `${scales.scale1}`);
                ghost.style.setProperty('--start-opacity', `${scales.opacity1}`);
                ghost.style.setProperty('--end-x', `calc(-50% + ${gaps.gap2}px)`);
                ghost.style.setProperty('--end-scale', `${scales.scale2}`);
                ghost.style.setProperty('--end-opacity', `${scales.opacity2}`);
                ghost.style.animation = 'ghostShiftRight 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            } else if (position === 2) {
                // Ghost direito na posição 2: move para posição 3
                ghost.style.setProperty('--start-x', `calc(-50% + ${gaps.gap2}px)`);
                ghost.style.setProperty('--start-scale', `${scales.scale2}`);
                ghost.style.setProperty('--start-opacity', `${scales.opacity2}`);
                ghost.style.setProperty('--end-x', `calc(-50% + ${gaps.gap3}px)`);
                ghost.style.setProperty('--end-scale', `${scales.scale3}`);
                ghost.style.setProperty('--end-opacity', `${scales.opacity3}`);
                ghost.style.animation = 'ghostShiftRight 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            }
            ghost.classList.add('animating');
        });
    } else {
        // Navegar para frente (seta direita): ghost direito vem para o centro
        // Emblema principal sai para a esquerda (0 → -1)
        mainEmblem.style.setProperty('--start-x', '-50%');
        mainEmblem.style.setProperty('--start-scale', '1');
        mainEmblem.style.setProperty('--end-x', `calc(-50% - ${gaps.gap1}px)`);
        mainEmblem.style.setProperty('--end-scale', `${scales.scale1}`);
        mainEmblem.classList.add('slide-left', 'animating');

        // Animar ghosts: todos movem uma posição para a esquerda
        allGhosts.forEach(ghost => {
            const position = parseInt(ghost.dataset.position);
            const newPos = position - 1;

            if (position === -3) {
                // Ghost mais à esquerda: desaparece
                ghost.style.animation = 'fadeOut 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            } else if (position === 1) {
                // Ghost direito que vai para o centro: anima para ser o novo principal
                ghost.style.setProperty('--start-x', `calc(-50% + ${gaps.gap1}px)`);
                ghost.style.setProperty('--start-scale', `${scales.scale1}`);
                ghost.style.setProperty('--start-opacity', `${scales.opacity1}`);
                ghost.style.setProperty('--end-x', '-50%');
                ghost.style.setProperty('--end-scale', '1');
                ghost.style.setProperty('--end-opacity', '1');
                ghost.style.animation = 'ghostToMain 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            } else if (position === 2) {
                // Ghost direito na posição 2: move para posição 1
                ghost.style.setProperty('--start-x', `calc(-50% + ${gaps.gap2}px)`);
                ghost.style.setProperty('--start-scale', `${scales.scale2}`);
                ghost.style.setProperty('--start-opacity', `${scales.opacity2}`);
                ghost.style.setProperty('--end-x', `calc(-50% + ${gaps.gap1}px)`);
                ghost.style.setProperty('--end-scale', `${scales.scale1}`);
                ghost.style.setProperty('--end-opacity', `${scales.opacity1}`);
                ghost.style.animation = 'ghostShiftLeft 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            } else if (position === 3) {
                // Ghost na posição 3: move para posição 2
                ghost.style.setProperty('--start-x', `calc(-50% + ${gaps.gap3}px)`);
                ghost.style.setProperty('--start-scale', `${scales.scale3}`);
                ghost.style.setProperty('--start-opacity', `${scales.opacity3}`);
                ghost.style.setProperty('--end-x', `calc(-50% + ${gaps.gap2}px)`);
                ghost.style.setProperty('--end-scale', `${scales.scale2}`);
                ghost.style.setProperty('--end-opacity', `${scales.opacity2}`);
                ghost.style.animation = 'ghostShiftLeft 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            } else if (position === 4) {
                // Ghost temporário na posição 4: desliza para 3 com fade-in
                ghost.classList.remove('temp-ghost-invisible');  // Remover classe antes da animação
                ghost.style.setProperty('--start-x', `calc(-50% + ${gaps.gap4}px)`);
                ghost.style.setProperty('--start-scale', `${scales.scale4}`);
                ghost.style.setProperty('--start-opacity', '0');
                ghost.style.setProperty('--end-x', `calc(-50% + ${gaps.gap3}px)`);
                ghost.style.setProperty('--end-scale', `${scales.scale3}`);
                ghost.style.setProperty('--end-opacity', `${scales.opacity3}`);
                ghost.style.animation = 'ghostShiftLeft 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            } else if (position === -1) {
                // Ghost esquerdo próximo: move para posição -2
                ghost.style.setProperty('--start-x', `calc(-50% - ${gaps.gap1}px)`);
                ghost.style.setProperty('--start-scale', `${scales.scale1}`);
                ghost.style.setProperty('--start-opacity', `${scales.opacity1}`);
                ghost.style.setProperty('--end-x', `calc(-50% - ${gaps.gap2}px)`);
                ghost.style.setProperty('--end-scale', `${scales.scale2}`);
                ghost.style.setProperty('--end-opacity', `${scales.opacity2}`);
                ghost.style.animation = 'ghostShiftLeft 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            } else if (position === -2) {
                // Ghost esquerdo na posição -2: move para posição -3
                ghost.style.setProperty('--start-x', `calc(-50% - ${gaps.gap2}px)`);
                ghost.style.setProperty('--start-scale', `${scales.scale2}`);
                ghost.style.setProperty('--start-opacity', `${scales.opacity2}`);
                ghost.style.setProperty('--end-x', `calc(-50% - ${gaps.gap3}px)`);
                ghost.style.setProperty('--end-scale', `${scales.scale3}`);
                ghost.style.setProperty('--end-opacity', `${scales.opacity3}`);
                ghost.style.animation = 'ghostShiftLeft 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            }
            ghost.classList.add('animating');
        });
    }

    return new Promise(resolve => {
        mainEmblem.addEventListener('animationend', () => {
            mainEmblem.classList.remove('slide-left', 'slide-right', 'animating');

            // Remover variáveis CSS depois da animação terminar
            mainEmblem.style.removeProperty('--start-x');
            mainEmblem.style.removeProperty('--start-scale');
            mainEmblem.style.removeProperty('--end-x');
            mainEmblem.style.removeProperty('--end-scale');

            allGhosts.forEach(ghost => {
                ghost.classList.remove('animating');
                ghost.style.removeProperty('animation');
                // NÃO remover transform, opacity, filter aqui - deixar para updateTeamSliderDisplay fazer o cleanup
            });
            resolve();
        }, { once: true });
    });
}

/**
 * Atualiza as estatísticas gerais da equipa
 */
function updatePredictionsStats() {
    const teamName = PredictionsState.selectedTeam;
    const teamData = PredictionsState.forecastData.find(row =>
        row.team === teamName
    );

    if (!teamData) {
        document.getElementById('predictionsStatsGrid').innerHTML = `<div class="no-predictions-message">${t('noStatsAvailable')}</div>`;
        return;
    }

    const statsGrid = document.getElementById('predictionsStatsGrid');
    const forecastSubset = getForecastDataForCurrentGroup();
    const expectedPlaceSorted = forecastSubset
        .filter(row => row.team)
        .slice()
        .sort((a, b) => {
            const aPlace = a.expected_place_in_group ?? Number.POSITIVE_INFINITY;
            const bPlace = b.expected_place_in_group ?? Number.POSITIVE_INFINITY;
            if (aPlace !== bPlace) return aPlace - bPlace;
            return String(a.team).localeCompare(String(b.team));
        });
    const expectedPlaceRank = expectedPlaceSorted.findIndex(row => row.team === teamName) + 1;
    const expectedPlaceValue = (teamData.expected_place_in_group || 0).toFixed(1);
    const expectedPlaceStd = (teamData.expected_place_in_group_std || 0).toFixed(1);

    // Definir estatísticas a mostrar
    const championPrediction = getChampionPredictionLabel(currentModalidade);
    const stats = [
        {
            label: 'Playoffs',
            value: `${(teamData.p_playoffs || 0).toFixed(1)}%`,
            description: 'Probabilidade de qualificação'
        },
        {
            label: 'Meias-Finais',
            value: `${(teamData.p_meias_finais || 0).toFixed(1)}%`,
            description: 'Probabilidade de chegarem às meias'
        },
        {
            label: 'Final',
            value: `${(teamData.p_finais || 0).toFixed(1)}%`,
            description: 'Probabilidade de chegarem à final'
        },
        {
            label: championPrediction.label,
            value: `${(teamData.p_champion || 0).toFixed(1)}%`,
            description: championPrediction.description
        },
        {
            label: 'Pontos Esperados',
            value: (teamData.expected_points || 0).toFixed(1),
            description: `± ${(teamData.expected_points_std || 0).toFixed(1)} pontos`
        },
        {
            label: 'Posição Esperada no Grupo',
            value: `${expectedPlaceRank > 0 ? expectedPlaceRank : '-'}º`,
            description: `Valor esperado: ${expectedPlaceValue} (± ${expectedPlaceStd} posições)`
        },
        {
            label: 'ELO Final Médio',
            value: Math.round(teamData.avg_final_elo || 0),
            description: `± ${Math.round(teamData.avg_final_elo_std || 0)} pontos`
        }
    ];

    // Adicionar promoção ou descida se existirem
    if (teamData.p_promocao && teamData.p_promocao > 0) {
        stats.push({
            label: 'Promoção',
            value: `${(teamData.p_promocao).toFixed(1)}%`,
            description: 'Probabilidade de subir de divisão'
        });
    }
    if (teamData.p_descida && teamData.p_descida > 0) {
        stats.push({
            label: 'Descida',
            value: `${(teamData.p_descida).toFixed(1)}%`,
            description: 'Probabilidade de descer de divisão'
        });
    }

    // Gerar HTML
    statsGrid.innerHTML = stats.map(stat => `
        <div class="stat-card">
            <div class="stat-label">${stat.label}</div>
            <div class="stat-value">${stat.value}</div>
            <div class="stat-description">${stat.description}</div>
        </div>
    `).join('');
}

/**
 * Atualiza os cabeçalhos da tabela de previsões baseado na modalidade
 */
function updatePredictionsTableHeaders() {
    const headers = getGoalHeaders();
    const predictionsTable = document.getElementById('predictionsTable');

    if (!predictionsTable) return;

    const thead = predictionsTable.querySelector('thead tr');
    if (!thead) return;

    const thElements = Array.from(thead.querySelectorAll('th'));

    // Encontrar a coluna "Golos Esp." (última coluna)
    const expectedGoalsIndex = thElements.length - 1;

    if (expectedGoalsIndex >= 0 && expectedGoalsIndex < thElements.length) {
        thElements[expectedGoalsIndex].textContent = headers.expectedLabel;
        thElements[expectedGoalsIndex].title = headers.expectedTitle;
    }
}

/**
 * Atualiza a tabela de previsões jogo a jogo
 */
function updatePredictionsTable() {
    const teamName = PredictionsState.selectedTeam;

    // Filtrar jogos onde a equipa participa
    const teamGames = PredictionsState.predictionsData.filter(row => {
        const teamA = row.team_a || '';
        const teamB = row.team_b || '';
        return teamA === teamName || teamB === teamName;
    });

    const tbody = document.getElementById('predictionsTableBody');

    if (teamGames.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="no-predictions-message">${t('noGamesForTeam')}</td></tr>`;
        return;
    }

    // Ordenar por jornada
    teamGames.sort((a, b) => (a.jornada || 0) - (b.jornada || 0));

    // Gerar linhas da tabela
    tbody.innerHTML = teamGames.map(game => {
        const teamA = game.team_a || '';
        const teamB = game.team_b || '';
        const isTeamA = teamA === teamName;

        const opponent = isTeamA ? teamB : teamA;
        const teamInfo = getCourseInfo(teamName);
        const opponentInfo = getCourseInfo(opponent);

        // Probabilidades do ponto de vista da equipa selecionada
        const probWin = isTeamA ? (game.prob_vitoria_a || 0) : (game.prob_vitoria_b || 0);
        const probDraw = game.prob_empate || 0;
        const probLoss = isTeamA ? (game.prob_vitoria_b || 0) : (game.prob_vitoria_a || 0);

        // Golos esperados
        const expectedGoals = isTeamA ? (game.expected_goals_a || 0) : (game.expected_goals_b || 0);
        const opponentExpectedGoals = isTeamA ? (game.expected_goals_b || 0) : (game.expected_goals_a || 0);

        // Data formatada
        const dateStr = game.dia ? formatPredictionDate(game.dia) : '-';
        const distribution = game.distribuicao_placares || '';
        const encodedDistribution = distribution ? encodeURIComponent(distribution) : '';

        // Verificar se o adversário é a equipa favorita
        const isFavoriteOpponent = isTeamFavorite(opponent);
        const favoriteClass = isFavoriteOpponent ? ' favorite-team-prediction' : '';

        // Nomes curtos das equipas para o tooltip
        const teamShortName = getTranslatedTeamLabel(teamInfo, teamName);
        const opponentShortName = getTranslatedTeamLabel(opponentInfo, opponent);

        return `
            <tr>
                <td>${game.jornada || '-'}</td>
                <td>${dateStr}</td>
                <td>
                    <div class="prediction-opponent">
                        ${opponentInfo.emblemPath ? `<img src="${opponentInfo.emblemPath}" alt="${opponentInfo.fullName || opponent}" class="prediction-opponent-emblem">` : ''}
                        <span class="prediction-opponent-name">${translateTeamName(opponentInfo.fullName || opponentInfo.shortName || opponent || t('unknown'))}</span>
                    </div>
                </td>
                <td><span class="prediction-prob ${getProbClass(probWin)}">${probWin.toFixed(1)}%</span></td>
                <td><span class="prediction-prob ${getProbClass(probDraw)}">${probDraw.toFixed(1)}%</span></td>
                <td><span class="prediction-prob ${getProbClass(probLoss)}">${probLoss.toFixed(1)}%</span></td>
                <td class="expected-goals-cell ${favoriteClass}" data-distribution="${encodedDistribution}" data-isteama="${isTeamA ? '1' : '0'}" data-team-short="${teamShortName}" data-opponent-short="${opponentShortName}" title="${t('clickToFixTooltip')}">
                    ${expectedGoals.toFixed(1)} - ${opponentExpectedGoals.toFixed(1)}
                </td>
            </tr>
        `;
    }).join('');

    attachPredictionsTooltipHandlers();
}

/**
 * Extrai o placar mais provável da distribuição
 */
function extractMostLikelyScore(distribution, isTeamA) {
    if (!distribution) return '-';

    // Formato: "3-1:3.5009%|4-1:3.4257%|..."
    const scores = distribution.split('|');
    if (scores.length === 0) return '-';

    // Pegar o primeiro (mais provável)
    const mostLikely = scores[0].split(':')[0];

    // Inverter se necessário
    if (!isTeamA && mostLikely.includes('-')) {
        const [a, b] = mostLikely.split('-');
        return `${b}-${a}`;
    }

    return mostLikely;
}

/**
 * Retorna classe CSS baseada na probabilidade
 */
function getProbClass(prob) {
    if (prob >= 50) return 'high';
    if (prob >= 25) return 'medium';
    return 'low';
}

/**
 * Formata a data da previsão
 */
function formatPredictionDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString(getDateLocale(), { day: '2-digit', month: '2-digit' });
    } catch {
        return dateStr;
    }
}

/**
 * Navega para a equipa anterior
 */
async function navigateToPreviousTeam() {
    const totalTeams = PredictionsState.availableTeams.length;
    if (totalTeams === 0) return;

    // Obter gaps e escalas responsivos
    const gaps = getResponsiveGaps();
    const scales = getResponsiveScales();

    // Calcular novo índice
    const newIndex = (PredictionsState.currentTeamIndex - 1 + totalTeams) % totalTeams;

    // Criar ghost temporário na posição -4 para o novo emblema
    const newGhostIndex = (newIndex - 3 + totalTeams) % totalTeams;
    const newGhostTeam = PredictionsState.availableTeams[newGhostIndex];
    const ghostLeft3 = document.querySelector('.ghost-left-3');

    // Criar elemento temporário na posição -4 (fora de vista)
    const tempGhost = document.createElement('div');
    tempGhost.className = 'team-slider-ghost temp-ghost-invisible';
    tempGhost.dataset.position = '-4';
    tempGhost.style.left = '50%';
    tempGhost.style.transform = `translate(calc(-50% - ${gaps.gap4}px), -50%) scale(${scales.scale4})`;
    tempGhost.style.pointerEvents = 'none';

    if (newGhostTeam) {
        const newGhostInfo = getCourseInfo(newGhostTeam);
        renderPredictionsEmblem(tempGhost, newGhostInfo, newGhostTeam, true);
    }

    ghostLeft3.parentElement.appendChild(tempGhost);

    // Iniciar animação (ghost -4 desliza para -3 com fade-in, -3 desliza para -2, etc)
    const animationPromise = animateTeamSlider('prev');

    // Atualizar índice após animação
    PredictionsState.currentTeamIndex = newIndex;
    PredictionsState.selectedTeam = PredictionsState.availableTeams[PredictionsState.currentTeamIndex];

    await animationPromise;

    // Remover ghost temporário
    tempGhost.remove();

    // Atualizar display
    updateTeamSliderDisplay();

    // Atualizar stats e tabelas
    updatePredictionsStats();
    updatePredictionsTableHeaders();
    updatePredictionsTable();
}

/**
 * Navega para a próxima equipa
 */
async function navigateToNextTeam() {
    const totalTeams = PredictionsState.availableTeams.length;
    if (totalTeams === 0) return;

    // Obter gaps e escalas responsivos
    const gaps = getResponsiveGaps();
    const scales = getResponsiveScales();

    // Calcular novo índice
    const newIndex = (PredictionsState.currentTeamIndex + 1) % totalTeams;

    // Criar ghost temporário na posição 4 para o novo emblema
    const newGhostIndex = (newIndex + 3) % totalTeams;
    const newGhostTeam = PredictionsState.availableTeams[newGhostIndex];
    const ghostRight3 = document.querySelector('.ghost-right-3');

    // Criar elemento temporário na posição 4 (fora de vista)
    const tempGhost = document.createElement('div');
    tempGhost.className = 'team-slider-ghost temp-ghost-invisible';
    tempGhost.dataset.position = '4';
    tempGhost.style.left = '50%';
    tempGhost.style.transform = `translate(calc(-50% + ${gaps.gap4}px), -50%) scale(${scales.scale4})`;
    tempGhost.style.pointerEvents = 'none';

    if (newGhostTeam) {
        const newGhostInfo = getCourseInfo(newGhostTeam);
        renderPredictionsEmblem(tempGhost, newGhostInfo, newGhostTeam, true);
    }

    ghostRight3.parentElement.appendChild(tempGhost);

    // Iniciar animação (ghost 4 desliza para 3 com fade-in, 3 desliza para 2, etc)
    const animationPromise = animateTeamSlider('next');

    // Atualizar índice após animação
    PredictionsState.currentTeamIndex = newIndex;
    PredictionsState.selectedTeam = PredictionsState.availableTeams[PredictionsState.currentTeamIndex];

    await animationPromise;

    // Remover ghost temporário
    tempGhost.remove();

    // Atualizar display
    updateTeamSliderDisplay();

    // Atualizar stats e tabelas
    updatePredictionsStats();
    updatePredictionsTableHeaders();
    updatePredictionsTable();
}
// Event listeners para os botões do slider
document.getElementById('prevTeamBtn')?.addEventListener('click', navigateToPreviousTeam);
document.getElementById('nextTeamBtn')?.addEventListener('click', navigateToNextTeam);

// Navegação por teclado no slider de equipas (setas esquerda/direita)
document.addEventListener('keydown', (e) => {
    // Verificar se a secção de previsões está visível e tem equipas
    if (PredictionsState.availableTeams.length === 0) return;

    // Verificar se não está a escrever num input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateToPreviousTeam();
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateToNextTeam();
    }
});

// Event listeners para carregar previsões quando época/modalidade muda
document.addEventListener('data:loaded', () => {
    loadPredictionsData();
});

document.getElementById('epoca')?.addEventListener('change', (e) => {
    changeEpoca(e.target.value);
    // As previsões serão carregadas automaticamente pelo evento 'data:loaded'
});

document.getElementById('modalidade')?.addEventListener('change', (e) => {
    changeModalidade(e.target.value);
    // As previsões serão carregadas automaticamente pelo evento 'data:loaded'
});

// ==================== TOOLTIP DE PREVISÕES COM GRÁFICO ====================

function createPredictionsTooltip() {
    const tooltip = document.createElement('div');
    tooltip.id = 'predictions-tooltip';
    tooltip.className = 'predictions-tooltip';
    tooltip.style.display = 'none';
    tooltip.style.visibility = 'hidden';
    tooltip.style.position = 'fixed';
    tooltip.style.zIndex = '99999';
    tooltip.style.pointerEvents = 'none';

    // Fechar tooltip ao clicar fora (apenas se está fixo)
    document.addEventListener('click', (e) => {
        if (predictionsTooltipFixed) {
            // Verificar se clicou no tooltip ou numa célula da tabela
            const isTooltipClick = tooltip.contains(e.target);
            const isTableCellClick = e.target.closest('.predictions-table tbody .expected-goals-cell');

            if (!isTooltipClick && !isTableCellClick) {
                predictionsTooltipFixed = false;
                tooltip.style.display = 'none';
                tooltip.style.visibility = 'hidden';
                tooltip.style.pointerEvents = 'none';
                // Destruir gráfico para liberar memória
                if (predictionsTooltipChart) {
                    try { predictionsTooltipChart.destroy(); } catch (e) { }
                    predictionsTooltipChart = null;
                }
                predictionsTooltipCurrentDistribution = null;
            }
        }
    });

    document.body.appendChild(tooltip);
    return tooltip;
    return tooltip;
}

function parsePredictionsDistribution(distribution, isTeamA) {
    // Formato: "3-1:3.5009%|4-1:3.4257%|..."
    if (!distribution) return [];

    const scores = distribution.split('|');
    return scores.map(item => {
        const [score, prob] = item.split(':');
        const [a, b] = score.split('-').map(Number);
        const probability = parseFloat(prob) || 0;

        const result = isTeamA ? `${a}-${b}` : `${b}-${a}`;
        return { score: result, probability };
    });
}

function renderPredictionsTooltip(distribution, isTeamA, teamShortName, opponentShortName) {
    if (!predictionsTooltipEl) {
        predictionsTooltipEl = createPredictionsTooltip();
    }

    // Evitar re-render se é a mesma distribuição
    if (predictionsTooltipCurrentDistribution === distribution) {
        return;
    }
    predictionsTooltipCurrentDistribution = distribution;

    const allScores = parsePredictionsDistribution(decodeURIComponent(distribution), isTeamA);

    // Guardar estado para carregar mais depois
    predictionsTooltipState = {
        distribution: allScores,
        isTeamA: isTeamA,
        currentPage: 0,  // Índice da página atual
        itemsPerPage: 5
    };

    const chartId = `predictions-tooltip-chart-${Date.now()}`;
    const chartContainerId = `predictions-chart-container-${Date.now()}`;
    const visibleScores = allScores.slice(0, 5);  // Apenas primeiros 5
    const hasMore = allScores.length > 5;

    // Construir título com nomes das equipas
    const teamsText = (teamShortName && opponentShortName) ? `${teamShortName} - ${opponentShortName}` : '';

    const html = `
        <div>
            <div style="display: flex; gap: 8px; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div style="flex: 1; text-align: center;">
                    <div style="font-weight: 600; color: #2a5298; font-size: 0.9em;">${t('simulatedResults')}</div>
                    ${teamsText ? `<div style="font-size: 0.85em; color: #666; margin-top: 2px;">${teamsText}</div>` : ''}
                </div>
                <div style="display: flex; gap: 4px; flex-shrink: 0;">
                    ${hasMore ? `<button id="scrollLeft" style="padding: 4px 8px; background: #2a5298; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; opacity: 0.5; pointer-events: none;">‹</button>` : ''}
                    ${hasMore ? `<button id="scrollRight" style="padding: 4px 8px; background: #2a5298; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1em;">›</button>` : ''}
                </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <div id="${chartContainerId}" style="flex: 1; overflow-x: hidden; overflow-y: hidden;">
                    <div id="${chartId}" style="min-height: 280px;"></div>
                </div>
            </div>
            <div style="text-align: center; font-size: 0.8em; color: #666; margin-top: 8px;">
                <span id="pagination">${visibleScores.length}/${allScores.length}</span>
            </div>
        </div>
    `;

    predictionsTooltipEl.innerHTML = html;

    // Guardar referência do container
    predictionsTooltipState.chartId = chartId;
    predictionsTooltipState.chartContainerId = chartContainerId;

    // Renderizar gráfico imediatamente (já está no DOM)
    renderTooltipChart(chartId, visibleScores);

    // Adicionar listeners às setas
    if (hasMore) {
        const scrollLeftBtn = document.getElementById('scrollLeft');
        const scrollRightBtn = document.getElementById('scrollRight');

        if (scrollLeftBtn) {
            scrollLeftBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                loadMoreTooltipResults('prev');
            });
        }

        if (scrollRightBtn) {
            scrollRightBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                loadMoreTooltipResults('next');
            });
        }
    }
}

function loadMoreTooltipResults(direction) {
    if (!predictionsTooltipState.distribution) return;

    const itemsPerPage = predictionsTooltipState.itemsPerPage;
    const totalItems = predictionsTooltipState.distribution.length;
    const maxPages = Math.ceil(totalItems / itemsPerPage);

    // Atualizar página
    if (direction === 'next') {
        if (predictionsTooltipState.currentPage + itemsPerPage < totalItems) {
            predictionsTooltipState.currentPage += itemsPerPage;
        } else {
            return; // Já está na última página
        }
    } else if (direction === 'prev') {
        if (predictionsTooltipState.currentPage > 0) {
            predictionsTooltipState.currentPage -= itemsPerPage;
        } else {
            return; // Já está na primeira página
        }
    }

    // Obter items da página atual
    const startIdx = predictionsTooltipState.currentPage;
    const endIdx = startIdx + itemsPerPage;
    const visibleScores = predictionsTooltipState.distribution.slice(startIdx, endIdx);

    // Re-renderizar gráfico imediatamente
    renderTooltipChart(predictionsTooltipState.chartId, visibleScores);

    // Atualizar paginação
    const paginationEl = document.getElementById('pagination');
    if (paginationEl) {
        const startItem = startIdx + 1;
        const endItem = Math.min(endIdx, totalItems);
        paginationEl.textContent = `${startItem}-${endItem}/${totalItems}`;
    }

    // Atualizar estado dos botões
    const scrollLeftBtn = document.getElementById('scrollLeft');
    const scrollRightBtn = document.getElementById('scrollRight');

    if (scrollLeftBtn) {
        if (startIdx === 0) {
            scrollLeftBtn.style.opacity = '0.5';
            scrollLeftBtn.style.pointerEvents = 'none';
        } else {
            scrollLeftBtn.style.opacity = '1';
            scrollLeftBtn.style.pointerEvents = 'auto';
        }
    }

    if (scrollRightBtn) {
        if (endIdx >= totalItems) {
            scrollRightBtn.style.opacity = '0.5';
            scrollRightBtn.style.pointerEvents = 'none';
        } else {
            scrollRightBtn.style.opacity = '1';
            scrollRightBtn.style.pointerEvents = 'auto';
        }
    }
}

function renderTooltipChart(chartId, scores) {
    const chartEl = document.getElementById(chartId);
    if (!chartEl) {
        console.error('❌ Chart element not found:', chartId);
        return;
    }

    if (!scores || scores.length === 0) {
        chartEl.textContent = t('noDataAvailableShort');
        return;
    }

    // Destruir gráfico anterior se existir
    if (predictionsTooltipChart) {
        try {
            predictionsTooltipChart.destroy();
        } catch (e) {
            // Ignorar erros
        }
        predictionsTooltipChart = null;
    }

    // Limpar conteúdo anterior
    chartEl.innerHTML = '';

    const options = {
        chart: {
            type: 'bar',
            toolbar: { show: false },
            sparkline: { enabled: false },
            width: '100%',
            height: 280
        },
        series: [{ name: 'Probabilidade (%)', data: scores.map(s => s.probability) }],
        xaxis: {
            categories: scores.map(s => s.score),
            labels: { style: { fontSize: '11px' } }
        },
        yaxis: {
            title: { text: '%' },
            labels: { style: { fontSize: '10px' } }
        },
        colors: ['#2a5298'],
        plotOptions: {
            bar: { columnWidth: '75%', borderRadius: 4 }
        },
        tooltip: {
            y: { formatter: v => `${v.toFixed(2)}%` }
        },
        responsive: [{ breakpoint: 480, options: { chart: { height: 200 } } }]
    };

    try {
        predictionsTooltipChart = new ApexCharts(chartEl, options);
        predictionsTooltipChart.render();
    } catch (e) {
        console.error('Error rendering chart:', e);
        chartEl.textContent = t('errorLoading');
    }
}

function attachPredictionsTooltipHandlers() {
    if (!predictionsTooltipEl) {
        predictionsTooltipEl = createPredictionsTooltip();
    }

    const cells = document.querySelectorAll('.predictions-table tbody td.expected-goals-cell');

    cells.forEach(cell => {
        // Remove event listeners anteriores
        cell.removeEventListener('mouseenter', handlePredictionRowHover);
        cell.removeEventListener('mouseleave', handlePredictionRowLeave);
        cell.removeEventListener('click', handlePredictionRowClick);

        // Add new event listeners
        cell.addEventListener('mouseenter', handlePredictionRowHover);
        cell.addEventListener('mouseleave', handlePredictionRowLeave);
        cell.addEventListener('click', handlePredictionRowClick);
    });

    // Listeners para o tooltip próprio (para ele não desaparecer quando o rato vai para ele)
    if (predictionsTooltipEl) {
        predictionsTooltipEl.removeEventListener('mouseenter', handleTooltipEnter);
        predictionsTooltipEl.removeEventListener('mouseleave', handleTooltipLeave);
        predictionsTooltipEl.addEventListener('mouseenter', handleTooltipEnter);
        predictionsTooltipEl.addEventListener('mouseleave', handleTooltipLeave);
    }
}

function handlePredictionRowHover(e) {
    const cell = e.currentTarget;
    const distribution = cell.dataset.distribution;
    const isTeamA = cell.dataset.isteama === '1';
    const teamShortName = cell.dataset.teamShort || '';
    const opponentShortName = cell.dataset.opponentShort || '';

    if (!distribution) {
        return;
    }

    // Se está fixo, não fazer nada
    if (predictionsTooltipFixed) {
        return;
    }

    // Se já temos um timer, cancelar
    if (predictionsTooltipTimer) {
        clearTimeout(predictionsTooltipTimer);
        predictionsTooltipTimer = null;
    }

    // Guardar célula
    predictionsTooltipLastCell = cell;

    // Criar tooltip se necessário
    if (!predictionsTooltipEl) {
        predictionsTooltipEl = createPredictionsTooltip();
    }

    // Se já está visível e na mesma distribuição, apenas actualizar posição
    if (predictionsTooltipVisible && predictionsTooltipCurrentDistribution === distribution) {
        updateTooltipPosition({ currentTarget: cell });
        return;
    }

    // Mostrar tooltip imediatamente
    renderPredictionsTooltip(distribution, isTeamA, teamShortName, opponentShortName);

    if (predictionsTooltipEl && predictionsTooltipLastCell === cell) {
        predictionsTooltipEl.style.display = 'block';
        predictionsTooltipEl.style.visibility = 'visible';
        predictionsTooltipEl.style.pointerEvents = 'auto';
        predictionsTooltipVisible = true;
        updateTooltipPosition({ currentTarget: cell });
    }
}

function handlePredictionRowClick(e) {
    const cell = e.currentTarget;
    const distribution = cell.dataset.distribution;

    if (distribution && predictionsTooltipEl) {
        e.stopPropagation();

        // Cancelar timer pendente ao clicar
        if (predictionsTooltipTimer) {
            clearTimeout(predictionsTooltipTimer);
            predictionsTooltipTimer = null;
        }

        predictionsTooltipFixed = !predictionsTooltipFixed;

        if (predictionsTooltipFixed) {
            // Tooltip fica fixo
            predictionsTooltipEl.style.display = 'block';
            predictionsTooltipEl.style.visibility = 'visible';
            predictionsTooltipEl.style.pointerEvents = 'auto';
            predictionsTooltipVisible = true;
        } else {
            // Desafixar e esconder
            predictionsTooltipEl.style.display = 'none';
            predictionsTooltipEl.style.visibility = 'hidden';
            predictionsTooltipEl.style.pointerEvents = 'none';
            predictionsTooltipVisible = false;
            // Destruir gráfico para liberar memória
            if (predictionsTooltipChart) {
                try { predictionsTooltipChart.destroy(); } catch (e) { }
                predictionsTooltipChart = null;
            }
            predictionsTooltipCurrentDistribution = null;
        }
    }
}

// Handlers para o tooltip próprio não desaparecer
function handleTooltipEnter() {
    if (predictionsTooltipTimer) {
        clearTimeout(predictionsTooltipTimer);
        predictionsTooltipTimer = null;
    }
}

function handleTooltipLeave() {
    // Se está fixo, ignora
    if (predictionsTooltipFixed) return;

    // Esconder quando o rato sai do tooltip
    if (predictionsTooltipEl) {
        predictionsTooltipEl.style.display = 'none';
        predictionsTooltipEl.style.visibility = 'hidden';
        predictionsTooltipEl.style.pointerEvents = 'none';
        predictionsTooltipVisible = false;
    }
}

function handlePredictionRowLeave() {
    // Se está fixo, não fazer nada
    if (predictionsTooltipFixed) return;

    // Cancelar timer anterior se existir
    if (predictionsTooltipTimer) {
        clearTimeout(predictionsTooltipTimer);
        predictionsTooltipTimer = null;
    }

    // Limpar célula
    predictionsTooltipLastCell = null;

    // Usar pequeno debounce (50ms) para evitar flicker ao passar entre células próximas
    predictionsTooltipTimer = setTimeout(() => {
        if (predictionsTooltipEl && !predictionsTooltipFixed) {
            predictionsTooltipEl.style.display = 'none';
            predictionsTooltipEl.style.visibility = 'hidden';
            predictionsTooltipEl.style.pointerEvents = 'none';
            predictionsTooltipVisible = false;
        }
        predictionsTooltipTimer = null;
    }, 50);
}

// Esconder tooltip quando rato sai da tabela completamente
function handlePredictionTableLeave() {
    // Se está fixo, não fazer nada
    if (predictionsTooltipFixed) return;

    // Cancelar timer pendente
    if (predictionsTooltipTimer) {
        clearTimeout(predictionsTooltipTimer);
        predictionsTooltipTimer = null;
    }

    // Esconder quando sai da tabela (se não está sobre o tooltip, vai ser tratado no mouseleave do tooltip)
    if (predictionsTooltipEl) {
        predictionsTooltipEl.style.display = 'none';
        predictionsTooltipEl.style.visibility = 'hidden';
        predictionsTooltipEl.style.pointerEvents = 'none';
        predictionsTooltipVisible = false;
    }
    predictionsTooltipLastCell = null;
}

function updateTooltipPosition(e) {
    if (!predictionsTooltipEl) {
        return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipRect = predictionsTooltipEl.getBoundingClientRect();

    let left = rect.left + (rect.width - 300) / 2;
    let top = rect.top - 230;

    if (left < 10) {
        left = 10;
    }

    if (left + 300 > window.innerWidth) {
        left = window.innerWidth - 310;
    }

    if (top < 10) {
        top = rect.bottom + 10;
    }

    predictionsTooltipEl.style.left = left + 'px';
    predictionsTooltipEl.style.top = top + 'px';
}

// Adicionar suporte a navegação por teclado (setas esquerda/direita)
document.addEventListener('keydown', (event) => {
    // Verificar se o usuário está editando texto
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }

    // Verificar se a secção de previsões está visível
    const predictionsCard = document.querySelector('.predictions-card');
    if (!predictionsCard || !PredictionsState.availableTeams.length) {
        return;
    }

    if (event.key === 'ArrowLeft') {
        navigateToPreviousTeam();
    } else if (event.key === 'ArrowRight') {
        navigateToNextTeam();
    }
});

