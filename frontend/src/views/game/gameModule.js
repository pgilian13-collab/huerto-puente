// ============================================================
// Game Module - Huerto Challenge wrapper
// ============================================================

var GameModule = (function() {
    function init() {
        render();
        if (window.huertoGame) huertoGame.reset();
    }

    function destroy() {
        if (window.huertoGame) {
            huertoGame.playing = false;
            clearInterval(huertoGame.timer);
            clearInterval(huertoGame.driftTimer);
            clearTimeout(huertoGame.threatTimer);
            clearTimeout(huertoGame.threatTimeout);
        }
    }

    function render() {
        var el = document.getElementById('view-juego');
        if (!el) return;
        el.innerHTML = '<div class="panel game-panel">' +
            '<div class="panel-header"><span class="material-icons-round">videogame_asset</span><h3>Huerto Challenge</h3><div class="panel-tag">GAME//SURVIVAL</div></div>' +
            '<div class="game-stats-bar">' +
            '<div class="game-stat"><span class="game-stat-label">Puntaje</span><span class="game-stat-val" id="game-score">0</span></div>' +
            '<div class="game-stat"><span class="game-stat-label">Ronda</span><span class="game-stat-val" id="game-round">0/5</span></div>' +
            '<div class="game-stat"><span class="game-stat-label">Correctas</span><span class="game-stat-val" id="game-correct">0</span></div>' +
            '<div class="game-stat"><span class="game-stat-label">Combo</span><span class="game-stat-val game-combo-val" id="game-combo">-</span></div>' +
            '<div class="game-stat game-stat-timer"><span class="game-stat-label">Tiempo</span><span class="game-stat-val" id="game-timer">30.0s</span></div>' +
            '</div>' +
            '<div class="game-timer-bar"><div class="game-timer-fill" id="game-timer-fill"></div></div>' +
            '<div class="game-resources">' +
            '<div class="game-resource"><span>Agua</span><div class="game-resource-bar"><div class="game-resource-fill water" id="game-water-fill"></div></div><span id="game-water-text">100%</span></div>' +
            '<div class="game-resource"><span>Energia</span><div class="game-resource-bar"><div class="game-resource-fill energy" id="game-energy-fill"></div></div><span id="game-energy-text">100%</span></div>' +
            '</div>' +
            '<div class="game-main-area">' +
            '<div class="game-plant-col"><div class="game-plant-label">Tu planta</div><div class="game-plant-svg" id="gamePlantSvg"></div></div>' +
            '<div class="game-sensors-col">' +
            '<div class="game-sensor-row"><span>Temp</span><span class="game-sensor-val" id="game-temp">25.0</span><span class="opt-tag">(opt: 25)</span></div>' +
            '<div class="game-sensor-row"><span>HumAmb</span><span class="game-sensor-val" id="game-humamb">65.0</span><span class="opt-tag">(opt: 65)</span></div>' +
            '<div class="game-sensor-row"><span>HumSuelo</span><span class="game-sensor-val" id="game-humsuelo">60.0</span><span class="opt-tag">(opt: 60)</span></div>' +
            '<div class="game-sensor-row"><span>pH</span><span class="game-sensor-val" id="game-ph">6.8</span><span class="opt-tag">(opt: 6.8)</span></div>' +
            '</div></div>' +
            '<div class="game-threat" id="game-threat" style="display:none;"></div>' +
            '<div class="game-feedback" id="game-feedback" style="display:none;"></div>' +
            '<div class="game-actions" id="game-actions" style="display:none;">' +
            '<button class="game-action-btn" onclick="huertoGame.respondToThreat(\'bomba\')"><span class="game-action-icon">&#128167;</span><span class="game-action-label">Regar</span></button>' +
            '<button class="game-action-btn" onclick="huertoGame.respondToThreat(\'ventilador\')"><span class="game-action-icon">&#10052;&#65039;</span><span class="game-action-label">Enfriar</span></button>' +
            '<button class="game-action-btn" onclick="huertoGame.respondToThreat(\'ph\')"><span class="game-action-icon">&#9879;&#65039;</span><span class="game-action-label">pH</span></button>' +
            '<button class="game-action-btn" onclick="huertoGame.respondToThreat(\'proteger\')"><span class="game-action-icon">&#128737;&#65039;</span><span class="game-action-label">Proteger</span></button>' +
            '<button class="game-action-btn" onclick="huertoGame.respondToThreat(\'pulverizador\')"><span class="game-action-icon">&#127796;</span><span class="game-action-label">Humectar</span></button>' +
            '</div>' +
            '<div class="game-status" id="game-status"><div class="game-msg">Presiona para comenzar</div><button class="brutalist-btn game-btn" onclick="huertoGame.startRound()">Iniciar Juego</button></div>' +
            '</div>';
    }

    return { init: init, destroy: destroy };
})();

if (typeof window !== 'undefined') window.GameModule = GameModule;
