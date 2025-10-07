const API_URL = "https://api.open-meteo.com/v1/forecast";

// Estrutura global para dados e configurações
const globalState = {
    hourlyTimeLabels: [], 
    itacoatiara: { name: "Praia de Itacoatiara", lat: -22.97, lon: -43.04, desiredDeg: 180+10, data: null, chartInstance: null },
    itaipu: { name: "Canal de Itaipu", lat: -22.95, lon: -43.06, desiredDeg: 180+56, data: null, chartInstance: null }
};

const dateInput = document.getElementById('date-input');
const timeSlider = document.getElementById('time-slider');
const currentTimeDisplay = document.getElementById('current-time-display');

// --- Funções de Inicialização e Controle ---

function initializeDateInput() {
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

function initializeTimeSlider() {
    timeSlider.addEventListener('input', (event) => {
        const index = parseInt(event.target.value);
        currentTimeDisplay.textContent = globalState.hourlyTimeLabels[index];
        updateCurrentDisplay('itacoatiara', index);
        updateCurrentDisplay('itaipu', index);
    });
}

function configureTimeSlider(hourlyTimes) {
    globalState.hourlyTimeLabels = hourlyTimes.map(t => t.substring(11, 16));
    
    const maxIndex = globalState.hourlyTimeLabels.length - 1;
    timeSlider.max = maxIndex;
    
    // ATIVA O SLIDER
    timeSlider.removeAttribute('disabled');
    
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

    return initialIndex;
}

// --- Funções de Lógica e Renderização ---

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

function calculateWindScore(currentDeg, desiredDeg) {
    let diff = Math.abs(currentDeg - desiredDeg);
    if (diff > 180) {
        diff = 360 - diff;
    }
    const score = 10 - (diff / 180) * 10;
    return parseFloat(score.toFixed(1));
}

function getColorForScore(score) {
    const normalizedScore = Math.max(0, Math.min(10, score)) / 10;
    let r, g;
    if (normalizedScore <= 0.5) { r = 255; g = Math.round(255 * (normalizedScore * 2)); } 
    else { r = Math.round(255 * (1 - (normalizedScore - 0.5) * 2)); g = 255; }
    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = (0).toString(16).padStart(2, '0');
    return `#${rHex}${gHex}${bHex}`;
}

function updateCurrentDisplay(beachKey, index) {
    const beach = globalState[beachKey];
    const hourlyData = beach.data;
    const statusElement = document.getElementById(`${beachKey}-status`);
    const subtitleElement = document.getElementById(`${beachKey}-current-subtitle`);

    if (!hourlyData || hourlyData.time.length <= index) {
        statusElement.innerHTML = `<p class="error">Dados de vento não disponíveis para este horário.</p>`;
        return;
    }
    
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
    
    // FÓRMULA DE ROTAÇÃO CORRIGIDA: Direção Real - 90
    const currentRotation = currentWind.direction - 90;
    const desiredRotation = beach.desiredDeg - 90;

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
                <div class="seta-referencia-container">
                    <span id="north-marker">N</span>
                    <span class="icone-seta seta-atual" 
                          style="transform: rotate(${currentRotation}deg); color: ${pointColor};">
                        &#x27A4;
                    </span>
                </div>
                <div class="seta-label">Previsto (${currentWind.direction}°)</div>
            </div>
            
            <div class="seta-item">
                <div class="seta-referencia-container">
                    <span id="north-marker">N</span>
                    <span class="icone-seta seta-desejada" 
                          style="transform: rotate(${desiredRotation}deg);">
                        &#x27A4;
                    </span>
                </div>
                <div class="seta-label">Ideal (${desiredCardinal}, ${beach.desiredDeg}°)</div>
            </div>
        </div>
    `;
    
    if (statusElement) {
         statusElement.innerHTML = htmlContent;
    }

    if (beach.chartInstance) {
        beach.chartInstance.update(); 
    }
}

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
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const clickedIndex = elements[0].index;
                    timeSlider.value = clickedIndex;
                    currentTimeDisplay.textContent = globalState.hourlyTimeLabels[clickedIndex];
                    updateCurrentDisplay('itacoatiara', clickedIndex);
                    updateCurrentDisplay('itaipu', clickedIndex);
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Nota de Vento Horária (Clique ou Arraste para Selecionar Hora)',
                    color: '#333'
                },
                legend: { display: false },
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
                    title: { display: true, text: 'Hora do Dia', color: '#333' },
                    grid: { display: false },
                    ticks: { color: '#333' }
                },
                y: {
                    title: { display: true, text: 'Nota de Vento', color: '#333' },
                    min: 0,
                    max: 10,
                    ticks: { color: '#333' }
                }
            }
        }
    });
}

function renderBeachData(beachKey, fetchedHourlyData) {
    const beach = globalState[beachKey];
    const statusElement = document.getElementById(`${beachKey}-status`);
    
    beach.data = fetchedHourlyData;

    let initialIndexToDisplay;
    if (globalState.hourlyTimeLabels.length === 0) {
        initialIndexToDisplay = configureTimeSlider(fetchedHourlyData.time);
    } else {
        initialIndexToDisplay = parseInt(timeSlider.value || 0);
    }

    const scores = fetchedHourlyData.wind_direction_10m.map(deg => calculateWindScore(deg, beach.desiredDeg));
    const directions = fetchedHourlyData.wind_direction_10m.map(deg => degToCardinal(deg));
    const speeds = fetchedHourlyData.wind_speed_10m.map(s => s.toFixed(0));
    
    statusElement.innerHTML = '<div id="current-display-placeholder"></div>';

    updateChart(beachKey, scores, directions, speeds);

    updateCurrentDisplay(beachKey, initialIndexToDisplay);
}

async function fetchAllData() {
    const selectedDate = dateInput.value;
    if (!selectedDate) return;

    // Desativa o slider e reseta a lista de horas antes de buscar novos dados
    timeSlider.setAttribute('disabled', 'true');
    globalState.hourlyTimeLabels = [];
    currentTimeDisplay.textContent = '---';

    const startDate = selectedDate;
    const endDate = selectedDate;

    const beachKeys = ['itacoatiara', 'itaipu'];

    // Define o status de carregamento antes da busca
    beachKeys.forEach(key => {
        document.getElementById(`${key}-status`).innerHTML = `<p class="loading">Buscando previsão para ${startDate.split('-').reverse().join('/')}...</p>`;
    });

    for (const key of beachKeys) {
        const beach = globalState[key];
        const statusElement = document.getElementById(`${key}-status`);

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
            statusElement.innerHTML = `<p class="error">Erro ao carregar os dados do vento para ${beach.name}.</p>`;
        }
    }
}

// Inicia os listeners e o carregamento inicial
initializeDateInput();
initializeTimeSlider();
fetchAllData();
// Atualiza os dados a cada 15 minutos (900000 milissegundos)
setInterval(fetchAllData, 900000);
