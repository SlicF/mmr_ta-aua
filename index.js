document.addEventListener('DOMContentLoaded', async () => {
    // Elementos DOM principais
    const modalitySelect = document.getElementById('modalidade-select');
    const ratingHistoryChart = document.getElementById('rating-history-chart');

    // Adicionar event listener para mudança de modalidade
    if (modalitySelect) {
        modalitySelect.addEventListener('change', async (e) => {
            const selectedModality = e.target.value;
            console.log(`Modalidade selecionada: ${selectedModality}`);
            await loadModality(selectedModality);
        });
    }

    // Carregar modalidade inicial
    const initialModality = modalitySelect?.value || 'ANDEBOL MISTO';
    console.log(`Modalidade inicial: ${initialModality}`);
    await loadModality(initialModality);

    // Função para carregar modalidade selecionada
    async function loadModality(modality) {
        // Mostrar indicador de carregamento
        if (ratingHistoryChart) {
            const ctx = ratingHistoryChart.getContext('2d');
            ctx.clearRect(0, 0, ratingHistoryChart.width, ratingHistoryChart.height);
            ctx.font = '16px Arial';
            ctx.fillText('Carregando dados...', 20, 50);
        }

        try {
            // Inicializar os gráficos com a modalidade selecionada
            await window.ChartManager.initializeCharts(modality);
        } catch (error) {
            console.error('Erro ao carregar modalidade:', error);
            if (ratingHistoryChart) {
                const ctx = ratingHistoryChart.getContext('2d');
                ctx.clearRect(0, 0, ratingHistoryChart.width, ratingHistoryChart.height);
                ctx.font = '16px Arial';
                ctx.fillText('Erro ao carregar dados.', 20, 50);
            }
        }
    }
});