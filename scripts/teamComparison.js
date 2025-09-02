// filepath: d:\mmr_taçaua\scripts\teamComparison.js

document.addEventListener('DOMContentLoaded', () => {
    const teamSelect1 = document.getElementById('team-select-1');
    const teamSelect2 = document.getElementById('team-select-2');
    const compareButton = document.getElementById('compare-teams');
    const modalitySelect = document.getElementById('modalidade-select');
    const chartContainer = document.getElementById('rating-history-chart');

    let teamsData = {};

    function loadTeamsData(modality) {
        // Load the data for the selected modality
        fetch(`elo_ratings/elo_${modality}_24_25.csv`)
            .then(response => response.text())
            .then(data => {
                const parsedData = parseCSV(data);
                teamsData[modality] = parsedData;
                populateTeamSelect(parsedData);
            });
    }

    function parseCSV(data) {
        const rows = data.split('\n').map(row => row.split(','));
        const headers = rows[0];
        const teams = {};

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const teamName = row[0];
            const eloScores = row.slice(1).map(Number);
            teams[teamName] = eloScores;
        }

        return teams;
    }

    function populateTeamSelect(data) {
        teamSelect1.innerHTML = '';
        teamSelect2.innerHTML = '';
        for (const team in data) {
            const option1 = document.createElement('option');
            option1.value = team;
            option1.textContent = team;
            teamSelect1.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = team;
            option2.textContent = team;
            teamSelect2.appendChild(option2);
        }
    }

    if (!compareButton) {
        console.warn("Elemento 'compare-teams' não encontrado");
        return;
    }

    if (!modalitySelect) {
        console.warn("Elemento 'modalidade-select' não encontrado");
        return;
    }

    compareButton.addEventListener('click', () => {
        if (teamSelect1 && teamSelect2) {
            const team1 = teamSelect1.value;
            const team2 = teamSelect2.value;

            if (team1 && team2) {
                window.ChartManager.renderComparisonChart(team1, team2);
            }
        }
    });

    function drawComparisonChart(selectedTeams, modality) {
        const labels = Object.keys(teamsData[modality][selectedTeams[0]]);
        const datasets = selectedTeams.map(team => ({
            label: team,
            data: teamsData[modality][team],
            borderColor: getRandomColor(),
            fill: false
        }));

        const ctx = chartContainer.getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    modalitySelect.addEventListener('change', () => {
        loadTeamsData(modalitySelect.value);
    });

    // Initial load for the default modality
    loadTeamsData(modalitySelect.value);
});