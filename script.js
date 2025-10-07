const API_URL = "https://api.open-meteo.com/v1/forecast";

// Configuração das Praias
const beaches = {
    itacoatiara: {
        name: "Praia de Itacoatiara",
        lat: -22.97, 
        lon: -43.04,
        desiredDeg: 10, 
        hourlyData: null, // Armazenará os dados brutos horários
        chartInstance: null
    },
    itaipu: {
        name: "Canal de Itaipu",
        lat: -22.95, 
        lon: -43.06,
        desiredDeg: 56, 
        hourlyData: null, // Armazenará os dados brutos horários
        chartInstance: null
    }
};

const dateInput = document.getElementById('date-input');

/**
 * Define o dia atual e o limite de 7 dias no seletor de data.
 */
function initializeDateInput() {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 6); // Previsão de até 7 dias

    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const todayFormatted = formatDate(today);
    const maxFormatted = formatDate(maxDate);

    dateInput.value = todayFormatted;
    dateInput.min = todayFormatted;
    dateInput.max = maxFormatted;

    dateInput.addEventListener('change', fetchAllData);
}

/**
 * Converte graus de direção do vento (0-360) para pontos cardeais.
 */
function degToCardinal(deg) {
    if (deg > 337.5 || deg <= 22.5) return "N";
    if (deg > 22.5 && deg <= 67.5) return "NE";
    if (deg > 67.5 && deg <= 112.5) return "L";
    if (deg > 112.5 && deg <= 157.5) return "SE";
    if (deg > 157.5 && deg <= 202.5) return "S";
    if (deg > 202.5 && deg <= 247.5) return "SO";
    if (deg > 247.5 && deg <= 292.5) return "O";
    if (deg > 292.5 && deg <= 337.5) return "NO";
    return "Indef.";
}

/**
 * Calcula uma nota de 0 a 10 com base na proximidade da direção do vento.
 */
function calculateWindScore(currentDeg, desiredDeg) {
    let diff = Math.abs(currentDeg - desiredDeg);
    if (diff > 180) {
        diff = 360 - diff;
    }
    const score = 10 - (diff / 180) * 10;
    return parseFloat(score.toFixed(1));
}

/**
 * Calcula a cor do gradiente: Vermelho (0) -> Amarelo (5) -> Verde (10).
 * @param {number} score - A nota do vento (0 a 10).
 * @returns {string} - Cor CSS em formato hexadecimal.
 */
function getColorForScore(score) {
    const normalizedScore = Math.max(0, Math.min(10, score)) / 10;
    let r, g;

    if (normalizedScore <= 0.5) {
        // Vermelho (0) para Amarelo (0.5)
        r = 255;
        g = Math.round(255 * (normalizedScore * 2));
    } else {
        // Amarelo (0.5) para Verde (1)
        r = Math.round(255 * (1 - (normalizedScore - 0.5) * 2));
        g = 255;
    }
    
    // Converte para hexadecimal
    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = (0).toString(16).padStart(2, '0'); // Mantém o azul em 0

    return `#${rHex}${gHex}${bHex}`;
}


/**
 * Atualiza o display superior (nota, setas e velocidade) com base em um índice horário.
 */
function updateCurrentDisplay(beachKey, index) {
    const beach = beaches[beachKey];
    const hourlyData = beach.hourlyData;
    const statusElement = document.getElementById(`${beachKey}-status`);
    const subtitleElement = document.getElementById(`${beachKey}-current-subtitle`);

    // Busca os dados no índice clicado/selecionado
    const currentWind = {
        time: hourlyData.time[index],
        speed: hourlyData.wind_speed_10m[index],
        direction: hourlyData.wind_direction_10m[index]
    };

    if (currentWind.speed === undefined) {
        return; 
    }

    const currentDirectionCardinal = degToCardinal(currentWind.direction);
    const currentScore = calculateWindScore(currentWind.direction, beach.desiredDeg);
    const desiredCardinal = degToCardinal(beach.desiredDeg);
    const pointColor = getColorForScore(currentScore);

    const currentHourStr = currentWind.time.substring(11, 16);
    subtitleElement.textContent = `Previsão selecionada: ${currentHourStr}h`;
    
    // Renderiza o HTML (Atual e Setas)
    const htmlContent = `
        <div class="current-data">
            <div class="nota-box">
                <div class="nota-score" style="color: ${pointColor};">${currentScore}</div>
                <div class="nota-label">Nota (0-10)</div>
            </div>
            <div class="nota-box">
                <div class="nota-score">${currentDirectionCardinal}</div>
                <div class="nota-label">Vento Previsto</div>
            </div>
            <div class="nota-box">
                <div class="nota-score">${currentWind.speed.toFixed(0)} km/h</div>
                <div class="nota-label">Velocidade</div>
            </div>
        </div>

        <div class="setas-container">
            <div class="seta-item">
                <span class="icone-seta seta-atual" style="transform: rotate(${currentWind.direction + 180}deg); color: ${pointColor};">
                    &#x27A4;
                </span>
                <div class="seta-label">Previsto (${currentWind.direction}°)</div>
            </div>
            
            <div class="seta-item">
                <span class="icone-seta seta-desejada" style="transform: rotate(${beach.desiredDeg + 180}deg);">
                    &#x27A4;
                </span>
                <div class="seta-label">Ideal (${desiredCardinal}, ${beach.desiredDeg}°)</div>
            </div>
        </div>
    `;
    
    statusElement.innerHTML = htmlContent;
}

/**
 * Renderiza o card e o gráfico de uma praia específica.
 */
function renderBeachData(beachKey, fetchedHourlyData) {
    const beach = beaches[beachKey];
    const statusElement = document.getElementById(`${beachKey}-status`);
    const now = new Date();
    const selectedDate = dateInput.value;
    const todayFormatted = new Date().toISOString().slice(0, 10);
    
    // 1. Armazena os dados brutos horários para uso na função de clique
    beach.hourlyData = fetchedHourlyData;

    // 2. Determina o índice inicial a ser exibido no topo (hora mais próxima/primeira hora)
    let initialIndexToDisplay = 0;
    
    if (selectedDate === todayFormatted) {
        const currentHour = now.getHours();
        initialIndexToDisplay = fetchedHourlyData.time.findIndex(timeStr => {
            const hour = parseInt(timeStr.substring(11, 13));
            return hour >= currentHour;
        });
        if (initialIndexToDisplay === -1) initialIndexToDisplay = fetchedHourlyData.time.length - 1;
    } 

    // 3. Prepara dados para o Gráfico
    const hours = fetchedHourlyData.time.map(t => t.substring(11, 16));
    const scores = fetchedHourlyData.wind_direction_10m.map(deg => calculateWindScore(deg, beach.desiredDeg));
    const directions = fetchedHourlyData.wind_direction_10m.map(deg => degToCardinal(deg));
    const speeds = fetchedHourlyData.wind_speed_10m.map(s => s.toFixed(0));
    
    // 4. Renderiza o display inicial
    updateCurrentDisplay(beachKey, initialIndexToDisplay);

    // 5. Renderiza o Gráfico
    updateChart(beachKey, hours, scores, directions, speeds);
}

/**
 * Cria/Atualiza o gráfico de linha, adicionando cor aos pontos e o handler de clique.
 */
function updateChart(beachKey, labels, scores, directions, speeds) {
    const ctx = document.getElementById(`${beachKey}-chart`).getContext('2d');
    const beach = beaches[beachKey];
    
    // Cria o array de cores dinâmicas para os pontos do gráfico
    const pointColors = scores.map(score => getColorForScore(score));

    // Destrói a instância anterior se existir
    if (beach.chartInstance) {
        beach.chartInstance.destroy();
    }

    beach.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nota de Qualidade (0-10)',
                data: scores,
                borderColor: '#48c9b0', 
                backgroundColor: 'rgba(72, 201, 176, 0.2)',
                fill: true,
                tension: 0.4,
                yAxisID: 'y',
                pointRadius: 4, 
                pointHoverRadius: 8,
                // Define as cores dinâmicas dos pontos
                pointBackgroundColor: pointColors, 
            }]
        },
        options: {
            responsive: true,
            // Handler de clique no gráfico
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const clickedIndex = elements[0].index;
                    // Atualiza o display superior para a hora clicada
                    updateCurrentDisplay(beachKey, clickedIndex);
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Nota de Vento e Direção Horária (Clique para Selecionar Hora)',
                    color: '#333'
                },
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const index = context.dataIndex;
                            return [
                                `Direção: ${directions[index]} (${beach.desiredDeg}° Ideal)`,
                                `Velocidade: ${speeds[index]} km/h`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Hora do Dia',
                        color: '#333'
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#333'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Nota de Vento',
                        color: '#333'
                    },
                    min: 0,
                    max: 10,
                    ticks: {
                        color: '#333'
                    }
                }
            }
        }
    });
}

/**
 * Faz a requisição da API para ambas as praias com base na data selecionada.
 */
async function fetchAllData() {
    // ... (restante da função fetchAllData, sem alteração) ...
    const selectedDate = dateInput.value;
    if (!selectedDate) return;

    const startDate = selectedDate;
    const endDate = selectedDate;

    for (const key in beaches) {
        const beach = beaches[key];
        const statusElement = document.getElementById(`${key}-status`);
        statusElement.innerHTML = `<p class="loading">Buscando previsão para ${startDate.split('-').reverse().join('/')}...</p>`;

        try {
            const params = new URLSearchParams({
                latitude: beach.lat,
                longitude: beach.lon,
                hourly: 'wind_speed_10m,wind_direction_10m',
                start_date: startDate,
                end_date: endDate,
                timezone: 'America/Sao_Paulo'
            });

            const response = await fetch(`${API_URL}?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.hourly && data.hourly.time.length > 0) {
                renderBeachData(key, data.hourly);
            } else {
                throw new Error("Dados horários não encontrados.");
            }

        } catch (error) {
            console.error(`Erro ao buscar dados para ${beach.name}:`, error);
            statusElement.innerHTML = `<p class="error">Erro ao carregar os dados do vento para ${beach.name}.</p>`;
        }
    }
}

// Inicia o seletor de data e carrega os dados
initializeDateInput();
fetchAllData();
// Opcional: Atualizar os dados a cada 15 minutos (900000 milissegundos)
setInterval(fetchAllData, 900000);
