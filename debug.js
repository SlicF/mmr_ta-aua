/**
 * Debug Utils - Funções de debug para o sistema MMR Taça UA
 * Arquivo separado para manter o código principal limpo
 */

// Configuração de debug
const DEBUG_CONFIG = {
    enabled: false, // Alterar para true para ativar debug
    teams: ['informática', 'informatica'], // Equipas para debug específico
    verbose: false // Debug mais detalhado
};

/**
 * Debug para normalização de equipas
 */
function debugTeamNormalization(originalName, normalizedName) {
    if (!DEBUG_CONFIG.enabled) return;

    if (originalName !== normalizedName) {
        console.log(`🔧 NOME NORMALIZADO: "${originalName}" → "${normalizedName}"`);
    }
}

/**
 * Debug para jogos da Informática
 */
function debugInformaticaGame(team1, team2, round, initialElo1, initialElo2, finalElo1, finalElo2) {
    if (!DEBUG_CONFIG.enabled) return;

    const isInformaticaGame = DEBUG_CONFIG.teams.some(teamName =>
        team1.toLowerCase().includes(teamName) || team2.toLowerCase().includes(teamName)
    );

    if (isInformaticaGame) {
        console.log(`🔧 JOGO INFORMÁTICA: ${team1} vs ${team2}`);
        if (DEBUG_CONFIG.verbose) {
            console.log(`  - Jornada: ${round}`);
            console.log(`  - ELO inicial: ${team1}=${initialElo1}, ${team2}=${initialElo2}`);
            console.log(`  - ELO final: ${team1}=${finalElo1}, ${team2}=${finalElo2}`);
        }
    }
}

/**
 * Debug para processamento ELO de equipa específica
 */
function debugTeamEloProcessing(teamName, initialElo, currentElo, eloByRound, allRounds) {
    if (!DEBUG_CONFIG.enabled) return;

    const isTargetTeam = DEBUG_CONFIG.teams.some(debugTeam =>
        teamName.toLowerCase().includes(debugTeam)
    );

    if (isTargetTeam) {
        console.log(`✅ EQUIPA PROCESSADA: ${teamName}`);
        console.log(`  - ELO inicial: ${initialElo}`);
        console.log(`  - ELO atual: ${currentElo}`);

        if (DEBUG_CONFIG.verbose) {
            console.log(`  - Dados por jornada:`, eloByRound);
            console.log(`  - Todas as jornadas:`, allRounds);
        }
    }
}

/**
 * Debug para evolução ELO por jornada
 */
function debugJornadaElo(teamName, round, elo) {
    if (!DEBUG_CONFIG.enabled || !DEBUG_CONFIG.verbose) return;

    const isTargetTeam = DEBUG_CONFIG.teams.some(debugTeam =>
        teamName.toLowerCase().includes(debugTeam)
    );

    if (isTargetTeam) {
        console.log(`  - Jornada ${round}: ELO = ${elo}`);
    }
}

/**
 * Debug para array final de ELO
 */
function debugFinalEloArray(teamName, eloValues) {
    if (!DEBUG_CONFIG.enabled || !DEBUG_CONFIG.verbose) return;

    const isTargetTeam = DEBUG_CONFIG.teams.some(debugTeam =>
        teamName.toLowerCase().includes(debugTeam)
    );

    if (isTargetTeam) {
        console.log(`  - Array ELO final:`, eloValues);
    }
}

/**
 * Debug para ajustes intergrupos
 */
function debugInterGroupAdjustment(teamName, adjustment) {
    if (!DEBUG_CONFIG.enabled) return;

    console.log(`🔄 AJUSTE INTERGRUPO: ${teamName} = ${adjustment}`);
}

/**
 * Debug geral para dados processados
 */
function debugProcessedData(type, count, firstEntry = null) {
    if (!DEBUG_CONFIG.enabled) return;

    console.log(`📊 PROCESSANDO ${type.toUpperCase()}: ${count} entradas`);
    if (firstEntry && DEBUG_CONFIG.verbose) {
        console.log('  - Primeira entrada:', firstEntry);
    }
}

/**
 * Ativar/desativar debug
 */
function setDebugEnabled(enabled, verbose = false, targetTeams = ['informática', 'informatica']) {
    DEBUG_CONFIG.enabled = enabled;
    DEBUG_CONFIG.verbose = verbose;
    DEBUG_CONFIG.teams = targetTeams;

    console.log(`🐛 DEBUG ${enabled ? 'ATIVADO' : 'DESATIVADO'}`);
    if (enabled) {
        console.log(`   - Verbose: ${verbose}`);
        console.log(`   - Equipas alvo: ${targetTeams.join(', ')}`);

        // Adicionar indicador visual
        let indicator = document.getElementById('debug-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'debug-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                background: rgba(255, 0, 0, 0.8);
                color: white;
                padding: 5px 10px;
                border-radius: 3px;
                font-family: monospace;
                font-size: 12px;
                z-index: 10001;
                animation: pulse 2s infinite;
            `;
            indicator.innerHTML = `🐛 DEBUG ${verbose ? 'VERBOSE' : 'ON'}`;
            document.body.appendChild(indicator);

            // Adicionar animação CSS
            if (!document.getElementById('debug-styles')) {
                const style = document.createElement('style');
                style.id = 'debug-styles';
                style.innerHTML = `
                    @keyframes pulse {
                        0% { opacity: 1; }
                        50% { opacity: 0.6; }
                        100% { opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
            }
        } else {
            indicator.innerHTML = `🐛 DEBUG ${verbose ? 'VERBOSE' : 'ON'}`;
        }
    } else {
        // Remover indicador visual
        const indicator = document.getElementById('debug-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
}/**
 * Debug para gráfico ELO
 */
function debugEloChart(action, data = null) {
    if (!DEBUG_CONFIG.enabled) return;

    switch (action) {
        case 'insufficient_data':
            console.log('⚠️ GRÁFICO ELO: dados insuficientes');
            break;
        case 'updating':
            console.log('📊 GRÁFICO ELO: atualizando...');
            break;
        case 'labels':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('📊 Labels do gráfico:', data);
            }
            break;
        case 'adjustments':
            if (DEBUG_CONFIG.verbose && data !== null) {
                console.log('📊 Ajustes encontrados:', data);
            }
            break;
        case 'team_added':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`📊 Equipa adicionada: ${data.name}`, data.history);
            }
            break;
        case 'datasets_total':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('📊 Total de datasets:', data);
            }
            break;
    }
}

/**
 * Debug para bracket e estrutura
 */
function debugBracket(action, data = null) {
    if (!DEBUG_CONFIG.enabled) return;

    switch (action) {
        case 'no_elo_data':
            console.log('⚠️ BRACKET: dados brutos de ELO não carregados');
            break;
        case 'no_elimination_games':
            console.log('⚠️ BRACKET: nenhum jogo de eliminação encontrado');
            break;
        case 'elimination_games_found':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🏆 BRACKET: jogos de eliminação encontrados:', data);
            }
            break;
        case 'bracket_created':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🏆 BRACKET: estrutura criada:', data);
            }
            break;
        case 'using_ranking_fallback':
            console.log('📊 BRACKET: usando ranking para Top 3 (bracket insuficiente)');
            break;
    }
}

/**
 * Debug para análise de modalidade
 */
function debugModalityAnalysis(action, data = null) {
    if (!DEBUG_CONFIG.enabled) return;

    const prefix = '[🎯 MODALIDADE]';
    switch (action) {
        case 'analyzing_structure':
            if (DEBUG_CONFIG.verbose) {
                console.log(`${prefix} Analisando estrutura da modalidade...`);
            }
            break;
        case 'rankings_available':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`${prefix} Divisões/grupos disponíveis:`, data);
            }
            break;
        case 'structure_detected':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`${prefix} Estrutura detectada:`, data);
            }
            break;
        case 'calculating_progression':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`${prefix} Calculando progressão - Posição: ${data.position}/${data.totalTeams}, Estrutura: ${data.structure}`);
            }
            break;
        case 'progression_determined':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`${prefix} Progressão determinada:`, data);
            }
            break;
        case 'updating_filters':
            if (DEBUG_CONFIG.verbose) {
                console.log(`${prefix} Atualizando filtros rápidos...`);
            }
            break;
        default:
            if (DEBUG_CONFIG.verbose) {
                console.log(`${prefix} ${action}:`, data);
            }
    }
}

/**
 * Debug para zoom e visualização
 */
function debugVisualization(action, data = null) {
    if (!DEBUG_CONFIG.enabled || !DEBUG_CONFIG.verbose) return;

    if (action === 'zoom_info' && data) {
        console.log(`🔍 ZOOM: factor ${data.zoom}, proximidade ${data.proximity}px, threshold ELO ${data.eloThreshold}`);
    }
}

/**
 * Debug para carregamento de ficheiros
 */
function debugFileLoading(action, data = null) {
    if (!DEBUG_CONFIG.enabled) return;

    switch (action) {
        case 'file_loaded':
            if (data) {
                console.log(`📁 ARQUIVO: carregado ${data.current}/${data.total}`);
            }
            break;
        case 'all_files_loaded':
            console.log('📁 ARQUIVO: todos os arquivos carregados, atualizando interface...');
            if (DEBUG_CONFIG.verbose && data) {
                console.log('📁 Estado dos dados:', data);
            }
            break;
        case 'rankings_processed':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('📊 Rankings processados:', data);
            }
            break;
        case 'teams_processed':
            if (data) {
                console.log(`👥 Equipas processadas: ${data}`);
            }
            break;
    }
}

/**
 * Debug para playoffs e top teams
 */
function debugPlayoffs(action, data = null) {
    if (!DEBUG_CONFIG.enabled || !DEBUG_CONFIG.verbose) return;

    switch (action) {
        case 'top3_teams':
            if (data) {
                console.log('🏆 Top 3 do bracket:', data);
            }
            break;
        case 'playoff_teams':
            if (data) {
                console.log('🏆 Equipas dos playoffs encontradas:', data);
            }
            break;
    }
}

/**
 * Debug para ajustes de ELO
 */
function debugEloAdjustments(teamName, action, data = {}) {
    if (!DEBUG_CONFIG.enabled || !DEBUG_CONFIG.verbose) return;

    switch (action) {
        case 'before_adjustments':
            console.log(`⚙️ ${teamName}: ELO antes ajustes ${data.before} -> ELO final ${data.after} (ajuste ${data.adjustment})`);
            break;
        case 'with_adjustment':
            console.log(`⚙️ ${teamName}: ELO antes ajustes ${data.before} + ajuste ${data.adjustment} = ${data.after}`);
            break;
        case 'no_adjustment':
            console.log(`⚙️ ${teamName}: sem ajustes (ajuste = 0), mantendo ELO ${data.elo}`);
            break;
        case 'no_intergroup':
            console.log(`⚙️ ${teamName}: sem ajustes intergrupos, mantendo ELO ${data.elo}`);
            break;
        case 'final_elo':
            console.log(`⚙️ ${teamName}: ELO inicial ${data.initial}, ${data.points} pontos totais`);
            break;
        case 'no_games_adjustment':
            console.log(`⚙️ ${teamName}: sem jogos, ELO inicial ${data.initial} -> ELO final ${data.final} (ajuste ${data.adjustment})`);
            break;
        case 'no_games_with_adjustment':
            console.log(`⚙️ ${teamName}: sem jogos, ELO inicial ${data.initial} + ajuste ${data.adjustment} = ${data.final}`);
            break;
        case 'no_games_no_adjustment':
            console.log(`⚙️ ${teamName}: sem jogos, sem ajustes (ajuste = 0), mantendo ELO inicial ${data.initial}`);
            break;
        case 'no_games_no_intergroup':
            console.log(`⚙️ ${teamName}: sem jogos e sem ajustes, mantendo ELO inicial ${data.initial}`);
            break;
        case 'completed_with_adjustment':
            console.log(`✅ ${teamName}: completado com ELO final ${data.final} (ajuste ${data.adjustment})`);
            break;
        case 'completed_with_total_adjustment':
            console.log(`✅ ${teamName}: completado com ajuste ${data.adjustment}, ELO final ${data.final}`);
            break;
        case 'completed_no_adjustment':
            console.log(`✅ ${teamName}: completado sem ajustes (ajuste = 0), mantendo ELO ${data.elo}`);
            break;
        case 'completed_no_intergroup':
            console.log(`✅ ${teamName}: completado sem ajustes, mantendo ELO ${data.elo}`);
            break;
        case 'completed_points':
            console.log(`✅ ${teamName}: completado para ${data.points} pontos`);
            break;
    }
}

/**
 * Debug para histórico ELO final
 */
function debugEloHistoryFinal(history) {
    if (!DEBUG_CONFIG.enabled || !DEBUG_CONFIG.verbose) return;

    console.log('📊 Histórico ELO final:', history);
}

// Exportar funções globalmente
window.DebugUtils = {
    setDebugEnabled,
    debugTeamNormalization,
    debugInformaticaGame,
    debugTeamEloProcessing,
    debugJornadaElo,
    debugFinalEloArray,
    debugInterGroupAdjustment,
    debugProcessedData,
    debugEloChart,
    debugBracket,
    debugModalityAnalysis,
    debugVisualization,
    debugFileLoading,
    debugPlayoffs,
    debugEloAdjustments,
    debugEloHistoryFinal
};