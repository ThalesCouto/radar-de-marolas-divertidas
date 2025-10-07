const API_URL = "https://api.open-meteo.com/v1/forecast";

// Configuração das Praias
const beaches = {
    itacoatiara: {
        name: "Praia de Itacoatiara",
        lat: -22.97, // Latitude
        lon: -43.04, // Longitude
        desiredDeg: 10, // Nordeste (NE), ideal para surf em Ita
        chartInstance: null
    },
    itaipu: {
        name: "Canal de Itaipu",
        lat: -22.95, 
        lon: -43.06,
        desiredDeg: 56, // Sudeste/Leste, ideal para Kitesurf no Canal
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
 * Renderiza o card e o gráfico de uma praia específica.
 */
function renderBeachData(beachKey, hourlyData) {
    const beach = beaches[beachKey];
    const statusElement = document.getElementById(`${beachKey}-status`);
    const subtitleElement = document.getElementById(`${beachKey}-current-subtitle`);
    const now = new Date();
    const selectedDate = dateInput.value;
    const todayFormatted = new Date().toISOString().slice(0, 10);
    
    // 1. Encontra o dado mais atual (ou primeira hora se for dia futuro)
    let currentWind = null;
    let currentIndex = -1;
    
    if (selectedDate === todayFormatted) {
        // Para hoje, encontra a hora mais próxima
        const currentHour = now.getHours();
        currentIndex = hourlyData.time.findIndex(timeStr => {
            const hour = parseInt(timeStr.substring(11, 13));
            return hour >= currentHour;
        });
        if (currentIndex === -1) currentIndex = hourlyData.time.length - 1; // Pega o último se a hora atual já passou
    } else {
        // Para dias futuros, pega a primeira hora do dia
        currentIndex = 0;
    }
    
    currentWind = {
        time: hourlyData.time[currentIndex],
        speed: hourlyData.wind_speed_10m[currentIndex],
        direction: hourlyData.wind_direction_10m[currentIndex]
    };

    if (!currentWind || currentWind.speed === undefined) {
        statusElement.innerHTML = `<p class="error">Dados de vento indisponíveis para a hora selecionada.</p>`;
        return;
    }

    const currentHourStr = currentWind.time.substring(11, 16);
    subtitleElement.textContent = `Previsão atualizada para ${currentHourStr}h`;
    
    const currentDirectionCardinal = degToCardinal(currentWind.direction);
    const currentScore = calculateWindScore(currentWind.direction, beach.desiredDeg);
    const desiredCardinal = degToCardinal(beach.desiredDeg);

    // 2. Renderiza o HTML (Atual e Setas)
    const htmlContent = `
        <div class="current-data">
            <div class="nota-box">
                <div class="nota-score">${currentScore}</div>
                <div class="nota-label">Nota (0-10)</div>
            </div>
            <div class="nota-box">
                <div class="nota-score">${currentDirectionCardinal}</div>
                <div class="nota-label">Vento Atual</div>
            </div>
            <div class="nota-box">
                <div class="nota-score">${currentWind.speed.toFixed(0)} km/h</div>
                <div class="nota-label">Velocidade</div>
            </div>
        </div>

        <div class="setas-container">
            <div class="seta-item">
                <span class="icone-seta seta-atual" style="transform: rotate(${currentWind.direction + 180}deg);">
                    &#x27A4;
                </span>
                <div class="seta-label">Atual (${currentWind.direction}°)</div>
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

    // 3. Prepara dados para o Gráfico
    const hours = hourlyData.time.map(t => t.substring(11, 16));
    const scores = hourlyData.wind_direction_10m.map(deg => calculateWindScore(deg, beach.desiredDeg));
    const directions = hourlyData.wind_direction_10m.map(deg => degToCardinal(deg));
    const speeds = hourlyData.wind_speed_10m.map(s => s.toFixed(0));

    updateChart(beachKey, hours, scores, directions, speeds);
}

/**
 * Cria/Atualiza o gráfico de linha.
 */
function updateChart(beachKey, labels, scores, directions, speeds) {
    const ctx = document.getElementById(`${beachKey}-chart`).getContext('2d');
    const beach = beaches[beachKey];

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
                pointRadius: 3,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Nota de Vento e Direção Horária',
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
