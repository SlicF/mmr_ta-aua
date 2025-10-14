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
        case 'secondary_games_found':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🏆 BRACKET SECUNDÁRIO: jogos PM/LM encontrados:', data);
            }
            break;
        case 'bracket_created':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🏆 BRACKET: estrutura criada:', data);
            }
            break;
        case 'secondary_bracket_created':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🏆 BRACKET SECUNDÁRIO: estrutura criada:', data);
            }
            break;
        case 'auto_filling_bracket':
            console.log('🤖 BRACKET: preenchendo automaticamente com equipas qualificadas:', data);
            break;
        case 'qualified_teams':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('✅ BRACKET: equipas qualificadas detectadas:', data);
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
        case 'epochs_detected':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('📅 ÉPOCAS: detectadas', data.epochs);
            }
            break;
        case 'default_epoch_set':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`📅 ÉPOCA: padrão definida como ${data.epoch}`);
            }
            break;
        case 'courses_loaded':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`📚 CURSOS: ${data.count} cursos carregados`);
            }
            break;
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

/**
 * Debug para qualificação de equipas
 */
function debugQualification(action, data = null) {
    if (!DEBUG_CONFIG.enabled) return;

    switch (action) {
        case 'structure_detected':
            if (DEBUG_CONFIG.verbose) {
                console.log('🔍 Structure detected:', data);
            }
            break;
        case 'rankings_keys':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🔍 Rankings keys:', data);
            }
            break;
        case 'single_league_playoffs':
            console.log('🏆 Liga única - Qualificados para playoffs:', data);
            break;
        case 'has_divisions':
            console.log('✅ Sistema TEM divisões, processando...');
            break;
        case 'available_keys':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🔍 Chaves disponíveis em rankings:', data);
            }
            break;
        case 'processing_key':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`📁 Processando chave: "${data.key}" com ${data.count} equipas`);
            }
            break;
        case 'match_1st_division':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`  ✅ MATCH 1ª Divisão! Adicionando ${data} equipas`);
            }
            break;
        case 'match_2nd_division':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`  ✅ MATCH 2ª Divisão! Adicionando ${data} equipas`);
            }
            break;
        case 'no_match':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`  ❌ Não match. Key: "${data}"`);
            }
            break;
        case 'teams_sorted':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🔢 Equipas 1ª Divisão ordenadas:', data.div1);
                console.log('🔢 Equipas 2ª Divisão ordenadas:', data.div2);
            }
            break;
        case 'playoff_slots':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`📊 Slots playoffs: ${data.first} da 1ª div + ${data.second} da 2ª div = ${data.total} total`);
            }
            break;
        case 'selecting_1st_division':
            if (DEBUG_CONFIG.verbose) {
                console.log('🔍 Selecionando equipas da 1ª divisão para playoffs...');
            }
            break;
        case 'team_b_skip':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`  ⚠️ ${data.position}º lugar: "${data.team}" é equipa B - PULANDO`);
            }
            break;
        case 'team_qualified':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`  ✅ ${data.position}º lugar: "${data.team}" qualificado`);
            }
            break;
        case 'group_team_b_skip':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`  ⚠️ Grupo ${data.group} - ${data.position}º: "${data.team}" é equipa B - PULANDO`);
            }
            break;
        case 'group_winner':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`  🏆 Grupo ${data.group}: ${data.team} (${data.position}º classificado)`);
                if (data.replaces) {
                    console.log(`    ℹ️ Substitui "${data.replaces}" que é equipa B`);
                }
            }
            break;
        case 'selecting_2nd_places':
            if (DEBUG_CONFIG.verbose) {
                console.log('🔍 Selecionando 2º lugares da 2ª divisão para promotion-playoff...');
            }
            break;
        case 'already_in_playoffs':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`  ⚠️ Grupo ${data.group} - ${data.position}º: "${data.team}" JÁ foi para playoffs de vencedores - PULANDO`);
            }
            break;
        case 'team_b_with_relegation':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`  ✅ Grupo ${data.group} - ${data.position}º: "${data.team}" é B mas equipa A em descida - QUALIFICA`);
            }
            break;
        case 'team_b_no_relegation':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`  ⚠️ Grupo ${data.group} - ${data.position}º: "${data.team}" é B e equipa A NÃO em descida - PULANDO`);
            }
            break;
        case 'qualified_complete':
            console.log('✅ getQualifiedTeams COMPLETO. Legend:', data);
            break;
    }
}

/**
 * Debug para resolução de nomes de equipas
 */
function debugTeamResolution(action, data = null) {
    if (!DEBUG_CONFIG.enabled) return;

    switch (action) {
        case 'resolving_team':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🔍 resolveTeamName para:', data);
            }
            break;
        case 'qualified_legend':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('📋 Qualified legend:', data);
            }
            break;
        case 'legend_item':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('  🔹 Item:', data);
            }
            break;
        case 'creating_placeholders_with_group':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`    ✅ Criando placeholders: "${data.withGr}" e "${data.noGr}" → "${data.team}"`);
            }
            break;
        case 'creating_placeholder':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`    ✅ Criando placeholder: "${data.placeholder}" → "${data.team}"`);
            }
            break;
        case 'complete_map':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🗺️ Mapa completo:', data);
            }
            break;
        case 'resolved':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`  ✅ Resolvendo: "${data.from}" → "${data.to}"`);
            }
            break;
        case 'not_found':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`  ⚠️ Não encontrado, mantendo: "${data}"`);
            }
            break;
    }
}

/**
 * Debug para processamento de jogos de eliminação
 */
function debugEliminationGames(action, data = null) {
    if (!DEBUG_CONFIG.enabled) return;

    switch (action) {
        case 'processing_start':
            console.log('🎯 processEliminationMatches INICIADO. Número de jogos:', data);
            break;
        case 'first_game':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🎯 Primeiro jogo:', data.game);
                console.log('🎯 Equipa 1 do primeiro jogo:', data.team1);
                console.log('🎯 Equipa 2 do primeiro jogo:', data.team2);
            }
            break;
        case 'placeholders_created':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('📝 Placeholders criados para bracket:', data);
            }
            break;
        case 'insufficient_teams':
            console.log('⚠️ Bracket automático não criado: equipas qualificadas insuficientes');
            break;
        case 'substitution_map':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🔄 Mapa de substituições:', data);
            }
            break;
        case 'substituting':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`  🔄 Substituindo "${data.from}" → "${data.to}"`);
            }
            break;
        case 'quarters_info':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🎯 Quartos de Final - Número de jogos:', data.count);
                console.log('🎯 Primeiro jogo dos quartos:', data.first);
            }
            break;
        case 'before_resolve':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🔍 Antes de resolveTeamName - Equipa 1:', data.team1);
                console.log('🔍 Antes de resolveTeamName - Equipa 2:', data.team2);
            }
            break;
        case 'after_resolve':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('✅ Depois de resolveTeamName - Team 1:', data.team1);
                console.log('✅ Depois de resolveTeamName - Team 2:', data.team2);
            }
            break;
    }
}

/**
 * Debug para bracket secundário
 */
function debugSecondaryBracket(action, data = null) {
    if (!DEBUG_CONFIG.enabled) return;

    switch (action) {
        case 'analyzing_games':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🔍 Analisando jogos secundários:', data);
            }
            break;
        case 'before_assign':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🔧 ANTES de atribuir - bracketData:', data);
            }
            break;
        case 'after_assign':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🔧 DEPOIS de atribuir - sampleData.secondaryBracket:', data);
            }
            break;
        case 'lm_match':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🏆 LM match:', data);
            }
            break;
        case 'created':
            console.log('🏆 Bracket secundário criado:', data);
            break;
        case 'started':
            if (DEBUG_CONFIG.verbose && data) {
                console.log('🎨 createSecondaryBracket INICIADO:', data);
            }
            break;
        case 'qualified_teams':
            console.log('🏆 Qualified teams ao criar bracket secundário:', data);
            break;
    }
}

/**
 * Debug para bracket previsto
 */
function debugPredictedBracket(action, data = null) {
    if (!DEBUG_CONFIG.enabled) return;

    switch (action) {
        case 'called':
            console.log('🤖 createPredictedBracket chamada com:', data);
            break;
        case 'creating':
            console.log('✅ Criando bracket previsto com 8 equipas');
            break;
    }
}

/**
 * Debug para equipas B e progressão
 */
function debugTeamBStatus(action, data = null) {
    if (!DEBUG_CONFIG.enabled) return;

    switch (action) {
        case 'team_b_not_qualified':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`⚠️ Equipa B "${data.team}" em posição ${data.position} NÃO qualifica - marcando como SAFE`);
            }
            break;
        case 'team_b_qualified':
            console.log(`✅ Equipa B "${data.team}" em posição ${data.position} QUALIFICA`);
            break;
        case 'in_playoffs_replaced':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`🔄 Equipa "${data.team}" (${data.position}º) está nos PLAYOFFS - substituiu equipa B do 1º lugar`);
            }
            break;
        case 'in_promotion_replaced':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`🔄 Equipa "${data.team}" (${data.position}º) está no PROMOTION PLAYOFF - substituiu equipa B do 2º lugar`);
            }
            break;
    }
}

/**
 * Debug para processamento de rankings CSV
 */
function debugRankingsProcessing(action, data = null) {
    if (!DEBUG_CONFIG.enabled) return;

    switch (action) {
        case 'processing_row':
            if (DEBUG_CONFIG.verbose && data) {
                console.log(`📝 Processando ${data.team}: divisao=${data.divisao}, grupo=${data.grupo} → mainKey="${data.key}"`);
            }
            break;
        case 'rankings_complete':
            console.log('📊 Rankings processados. Chaves criadas:', data.keys);
            if (DEBUG_CONFIG.verbose) {
                console.log('📊 Detalhes:', data.details);
            }
            break;
        case 'playoff_system_detected':
            console.log('Sistema de playoff detectado:', data);
            break;
    }
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
    debugEloHistoryFinal,
    debugQualification,
    debugTeamResolution,
    debugEliminationGames,
    debugSecondaryBracket,
    debugPredictedBracket,
    debugTeamBStatus,
    debugRankingsProcessing
};