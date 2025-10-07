const API_URL = "https://api.open-meteo.com/v1/forecast";

// Global para armazenar os dados brutos e os horários disponíveis
const globalState = {
    hourlyTimeLabels: [], // Ex: ["00:00", "01:00", ...]
    itacoatiara: {
        data: null, // Dados brutos da API
        chartInstance: null,
        desiredDeg: 10, 
    },
    itaipu: {
        data: null,
        chartInstance: null,
        desiredDeg: 56, 
    }
};

const dateInput = document.getElementById('date-input');
const timeSlider = document.getElementById('time-slider');
const currentTimeDisplay = document.getElementById('current-time-display');

/**
 * Define o dia atual e o limite de 7 dias no seletor de data.
 */
function initializeDateInput() {
    // ... (função initializeDateInput permanece a mesma) ...
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 6);

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
 * Inicializa o listener do slider de horário.
 */
function initializeTimeSlider() {
    timeSlider.addEventListener('input', (event) => {
        const index = parseInt(event.target.value);
        
        // 1. Atualiza o display de hora
        currentTimeDisplay.textContent = globalState.hourlyTimeLabels[index];

        // 2. Atualiza os cards das duas praias
        updateCurrentDisplay('itacoatiara', index);
        updateCurrentDisplay('itaipu', index);
        
        // 3. Destaca o ponto no gráfico (opcional, pode ser feito re-renderizando o ponto ativo)
    });
}

/**
 * Configura o slider de acordo com o número de horas disponíveis na API.
 */
function configureTimeSlider(hourlyTimes) {
    globalState.hourlyTimeLabels = hourlyTimes.map(t => t.substring(11, 16));
    
    const maxIndex = globalState.hourlyTimeLabels.length - 1;
    timeSlider.max = maxIndex;
    timeSlider.disabled = false;
    
    // Define o valor inicial (hora mais próxima/primeira hora)
    let initialIndex = 0;
    const selectedDate = dateInput.value;
    const todayFormatted = new Date().toISOString().slice(0, 10);
    
    if (selectedDate === todayFormatted) {
        const now = new Date();
        const currentHour = now.getHours();
        initialIndex = hourlyTimes.findIndex(timeStr => {
            const hour = parseInt(timeStr.substring(11, 13));
            return hour >= currentHour;
        });
        if (initialIndex === -1) initialIndex = maxIndex;
    }
    
    timeSlider.value = initialIndex;
    currentTimeDisplay.textContent = globalState.hourlyTimeLabels[initialIndex];

    return initialIndex; // Retorna o índice inicial para o display
}

// ---------------- Funções de Cálculo e Estilo ----------------

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
 */
function getColorForScore(score) {
    const normalizedScore = Math.max(0, Math.min(10, score)) / 10;
    let r, g;

    if (normalizedScore <= 0.5) {
        r = 255;
        g = Math.round(255 * (normalizedScore * 2));
    } else {
        r = Math.round(255 * (1 - (normalizedScore - 0.5) * 2));
        g = 255;
    }
    
    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = (0).toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
}


// ---------------- Funções de Atualização de Display ----------------

/**
 * Atualiza o display superior (nota, setas e velocidade) com base em um índice horário.
 */
function updateCurrentDisplay(beachKey, index) {
    const beach = globalState[beachKey];
    const hourlyData = beach.data;
    const statusElement = document.getElementById(`${beachKey}-status`);
    const subtitleElement = document.getElementById(`${beachKey}-current-subtitle`);

    if (!hourlyData || hourlyData.time.length <= index) {
        return;
    }
    
    // 1. Busca os dados no índice selecionado/clicado
    const currentWind = {
        time: hourlyData.time[index],
        speed: hourlyData.wind_speed_10m[index],
        direction: hourlyData.wind_direction_10m[index]
    };

    const currentDirectionCardinal = degToCardinal(currentWind.direction);
    const currentScore = calculateWindScore(currentWind.direction, beach.desiredDeg);
    const desiredCardinal = degToCardinal(beach.desiredDeg);
    const pointColor = getColorForScore(currentScore);

    const currentHourStr = globalState.hourlyTimeLabels[index];
    subtitleElement.textContent = `Previsão selecionada: ${currentHourStr}h`;
    
    // 2. Renderiza o HTML (Atual e Setas)
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

    // 3. Atualiza o gráfico para garantir que o ponto clicado/selecionado esteja destacado
    if (beach.chartInstance) {
        // Encontra o ponto ativo no dataset e re-renderiza o gráfico se necessário
        beach.chartInstance.update(); 
    }
}

/**
 * Cria/Atualiza o gráfico de linha, adicionando cor aos pontos e o handler de clique.
 */
function updateChart(beachKey, scores, directions, speeds) {
    const ctx = document.getElementById(`${beachKey}-chart`).getContext('2d');
    const beach = globalState[beachKey];
    
    const pointColors = scores.map(score => getColorForScore(score));

    if (beach.chartInstance) {
        beach.chartInstance.destroy();
    }

    beach.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: globalState.hourlyTimeLabels,
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
                pointBackgroundColor: pointColors, 
            }]
        },
        options: {
            responsive: true,
            // Handler de clique no gráfico (Atualiza o slider e o display)
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const clickedIndex = elements[0].index;
                    
                    // 1. Atualiza o valor do slider
                    timeSlider.value = clickedIndex;

                    // 2. Chama a função de atualização (que já é o listener do slider)
                    updateCurrentDisplay(beachKey, clickedIndex);
                    
                    // Como a atualização do slider não dispara o evento 'input', atualizamos o display da hora
                    currentTimeDisplay.textContent = globalState.hourlyTimeLabels[clickedIndex];

                    // Garante que o display da outra praia também atualize
                    const otherBeachKey = (beachKey === 'itacoatiara') ? 'itaipu' : 'itacoatiara';
                    updateCurrentDisplay(otherBeachKey, clickedIndex);
                }
            },
            plugins: {
                // ... (restante das opções do gráfico, sem alteração) ...
                title: {
                    display: true,
                    text: 'Nota de Vento Horária (Clique ou Arraste para Selecionar Hora)',
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
                // ... (restante das configurações de escala, sem alteração) ...
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
 * Renderiza o card e o gráfico de uma praia específica.
 */
function renderBeachData(beachKey, fetchedHourlyData) {
    const beach = globalState[beachKey];
    const statusElement = document.getElementById(`${beachKey}-status`);
    
    // 1. Armazena os dados brutos horários
    beach.data = fetchedHourlyData;

    // 2. Se for a primeira praia a ser processada, configura o slider
    let initialIndexToDisplay;
    if (globalState.hourlyTimeLabels.length === 0) {
        initialIndexToDisplay = configureTimeSlider(fetchedHourlyData.time);
    } else {
        // Usa o índice atual do slider se já estiver configurado
        initialIndexToDisplay = parseInt(timeSlider.value);
    }

    // 3. Prepara dados para o Gráfico
    const scores = fetchedHourlyData.wind_direction_10m.map(deg => calculateWindScore(deg, beach.desiredDeg));
    const directions = fetchedHourlyData.wind_direction_10m.map(deg => degToCardinal(deg));
    const speeds = fetchedHourlyData.wind_speed_10m.map(s => s.toFixed(0));
    
    // Remove o loading e injeta um conteúdo inicial para garantir que o display seja atualizado depois
    statusElement.innerHTML = '<div id="current-display-placeholder"></div>';

    // 4. Renderiza o Gráfico
    updateChart(beachKey, scores, directions, speeds);

    // 5. Renderiza o display inicial com base no índice determinado
    updateCurrentDisplay(beachKey, initialIndexToDisplay);
}

/**
 * Faz a requisição da API para ambas as praias com base na data selecionada.
 */
async function fetchAllData() {
    const selectedDate = dateInput.value;
    if (!selectedDate) return;

    // Reset global state for new date
    globalState.hourlyTimeLabels = [];
    timeSlider.disabled = true;
    currentTimeDisplay.textContent = '---';

    const startDate = selectedDate;
    const endDate = selectedDate;

    // Keys of the beaches
    const beachKeys = ['itacoatiara', 'itaipu'];

    // Update loading status for both
    beachKeys.forEach(key => {
        document.getElementById(`${key}-status`).innerHTML = `<p class="loading">Buscando previsão para ${startDate.split('-').reverse().join('/')}...</p>`;
    });

    for (const key of beachKeys) {
        const beach = globalState[key];
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
            console.error(`Erro ao buscar dados para ${key}:`, error);
            document.getElementById(`${key}-status`).innerHTML = `<p class="error">Erro ao carregar os dados do vento para ${key}.</p>`;
        }
    }
}

// Inicia os listeners e o carregamento inicial
initializeDateInput();
initializeTimeSlider();
fetchAllData();
// Atualiza os dados a cada 15 minutos (900000 milissegundos)
setInterval(fetchAllData, 900000);
