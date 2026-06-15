// ============================================================
// GAME.JS - Huerto Challenge: Sobrevivencia
// ============================================================

var GAME_BRIDGE = "https://huerto-puente.onrender.com";

var OPTIMAL = { temp: 25, hum_amb: 65, hum_suelo: 60, ph: 6.8 };

var ROUNDS = [
    { name: "Dia Normal", desc: "Calor + sequia ligera", init: { temp: 32, hum_amb: 40, hum_suelo: 25, ph: 5.0 } },
    { name: "Sequia Severa", desc: "Todo seco, pH alto", init: { temp: 38, hum_amb: 15, hum_suelo: 8, ph: 9.0 } },
    { name: "Noche Fria", desc: "Frio extremo", init: { temp: 8, hum_amb: 90, hum_suelo: 80, ph: 7.0 } },
    { name: "Tormenta", desc: "Exceso de agua", init: { temp: 15, hum_amb: 95, hum_suelo: 90, ph: 6.0 } },
    { name: "Ola de Calor", desc: "Extremo final", init: { temp: 45, hum_amb: 25, hum_suelo: 15, ph: 8.5 } }
];

var PLANT_STAGES = [
    { min: 0,   name: "Semilla marchita", emoji: "\uD83D\uDC80", cssClass: "stage-wilted" },
    { min: 200, name: "Brote debil",      emoji: "\uD83C\uDF31", cssClass: "stage-sprout" },
    { min: 400, name: "Planta joven",     emoji: "\uD83C\uDF3F", cssClass: "stage-small" },
    { min: 600, name: "Planta fuerte",    emoji: "\uD83C\uDF33", cssClass: "stage-strong" },
    { min: 800, name: "Floracion",        emoji: "\uD83C\uDF38", cssClass: "stage-flower" },
    { min: 950, name: "Fruto maduro",     emoji: "\uD83C\uDF4E", cssClass: "stage-fruit" }
];

var THREATS = [
    { type: "sequia",     icon: "\uD83C\uDFDC\uFE0F", label: "Sequia detectada",  sensor: "hum_suelo", bad: 10,  action: "bomba" },
    { type: "calor",      icon: "\uD83D\uDD25",        label: "Calor extremo",     sensor: "temp",      bad: 42, action: "ventilador" },
    { type: "ph_bajo",    icon: "\u2697\uFE0F",        label: "pH muy acido",      sensor: "ph",        bad: 3.8, action: "ph" },
    { type: "ph_alto",    icon: "\u2623\uFE0F",        label: "pH muy alcalino",   sensor: "ph",        bad: 9.5, action: "ph" },
    { type: "plaga",      icon: "\uD83D\uDC1B",        label: "Plaga detectada",   sensor: null,        bad: null, action: "proteger" },
    { type: "hum_baja",   icon: "\uD83C\uDF2C\uFE0F",  label: "Aire muy seco",     sensor: "hum_amb",   bad: 15, action: "pulverizador" }
];

function HuertoChallenge() {
    this.currentRound = 0;
    this.timeLeft = 30;
    this.score = 0;
    this.totalScore = 0;
    this.playing = false;
    this.timer = null;
    this.threatTimer = null;
    this.currentThreat = null;
    this.threatTimeout = null;
    this.correctCount = 0;
    this.totalTaps = 0;
    this.water = 100;
    this.energy = 100;
    this.sensors = { temp: 25, hum_amb: 65, hum_suelo: 60, ph: 6.8 };
    this.plantStage = 0;
    this.history = [];
}

HuertoChallenge.prototype.reset = function() {
    this.currentRound = 0;
    this.totalScore = 0;
    this.score = 0;
    this.playing = false;
    this.correctCount = 0;
    this.totalTaps = 0;
    this.plantStage = 0;
    this.history = [];
    this.updateUI();
    this.showRoundInfo();
};

HuertoChallenge.prototype.startRound = function() {
    var round = ROUNDS[this.currentRound];
    this.sensors = JSON.parse(JSON.stringify(round.init));
    this.timeLeft = 30;
    this.score = 0;
    this.water = 100;
    this.energy = 100;
    this.playing = true;
    this.correctCount = 0;
    this.currentThreat = null;

    this.updateSensorDisplay();
    this.updateUI();
    this.showRoundStart(round);

    var self = this;
    this.timer = setInterval(function() {
        self.timeLeft -= 0.1;
        if (self.timeLeft <= 0) {
            self.timeLeft = 0;
            self.endRound();
        }
        self.updateTimerUI();
    }, 100);

    this.scheduleThreat();
};

HuertoChallenge.prototype.scheduleThreat = function() {
    if (!this.playing) return;
    var self = this;
    var delay = 2000 + Math.random() * 3000;
    this.threatTimer = setTimeout(function() {
        if (self.playing) {
            self.spawnThreat();
        }
    }, delay);
};

HuertoChallenge.prototype.spawnThreat = function() {
    if (!this.playing) return;
    var idx = Math.floor(Math.random() * THREATS.length);
    this.currentThreat = THREATS[idx];
    this.showThreat(this.currentThreat);

    var self = this;
    this.threatTimeout = setTimeout(function() {
        if (self.playing && self.currentThreat) {
            self.missThreat();
        }
    }, 5000);
};

HuertoChallenge.prototype.respondToThreat = function(actionType) {
    if (!this.playing || !this.currentThreat) return;
    if (this.currentThreat.action !== actionType) return;

    if (actionType === 'bomba' && this.water < 15) return;
    if (actionType === 'ventilador' && this.energy < 10) return;
    if (actionType === 'pulverizador' && this.water < 10) return;

    clearTimeout(this.threatTimeout);
    this.totalTaps++;
    this.correctCount++;

    var points = 50;
    this.score += points;
    this.totalScore += points;

    if (actionType === 'bomba') {
        this.water -= 15;
        this.sensors.hum_suelo = Math.min(100, this.sensors.hum_suelo + 8);
    } else if (actionType === 'ventilador') {
        this.energy -= 10;
        this.sensors.temp = Math.max(-5, this.sensors.temp - 4);
    } else if (actionType === 'pulverizador') {
        this.water -= 10;
        this.sensors.hum_amb = Math.min(100, this.sensors.hum_amb + 6);
    } else if (actionType === 'ph') {
        this.energy -= 5;
        this.water -= 5;
        this.sensors.ph = this.sensors.ph < 7 ? Math.min(7.5, this.sensors.ph + 0.5) : Math.max(6.0, this.sensors.ph - 0.5);
    }

    this.currentThreat = null;
    this.updateSensorDisplay();
    this.showActionFeedback(points, true);
    this.updateUI();

    var self = this;
    setTimeout(function() {
        self.hideThreat();
        self.scheduleThreat();
    }, 600);
};

HuertoChallenge.prototype.missThreat = function() {
    this.totalTaps++;
    this.score = Math.max(0, this.score - 20);
    this.totalScore = Math.max(0, this.totalScore - 20);
    this.currentThreat = null;
    this.showActionFeedback(-20, false);
    this.updateUI();
    this.hideThreat();
    this.scheduleThreat();
};

HuertoChallenge.prototype.endRound = function() {
    this.playing = false;
    clearTimeout(this.timer);
    clearTimeout(this.threatTimer);
    clearTimeout(this.threatTimeout);

    var dist = Math.abs(this.sensors.temp - OPTIMAL.temp) +
               Math.abs(this.sensors.hum_amb - OPTIMAL.hum_amb) +
               Math.abs(this.sensors.hum_suelo - OPTIMAL.hum_suelo) +
               Math.abs(this.sensors.ph - OPTIMAL.ph);
    var roundScore = Math.max(0, Math.round(1000 - dist * 10));
    this.score = roundScore;
    this.totalScore += roundScore;

    this.updatePlantStage();
    this.history.push({
        round: this.currentRound + 1,
        name: ROUNDS[this.currentRound].name,
        score: roundScore,
        correct: this.correctCount,
        sensors: JSON.parse(JSON.stringify(this.sensors))
    });

    this.showRoundResult(roundScore);
    this.updateUI();
};

HuertoChallenge.prototype.nextRound = function() {
    this.currentRound++;
    if (this.currentRound >= ROUNDS.length) {
        this.showFinalResult();
    } else {
        this.startRound();
    }
};

HuertoChallenge.prototype.updatePlantStage = function() {
    for (var i = PLANT_STAGES.length - 1; i >= 0; i--) {
        if (this.totalScore >= PLANT_STAGES[i].min) {
            this.plantStage = i;
            break;
        }
    }
    this.updatePlantSVG();
};

HuertoChallenge.prototype.getDistance = function() {
    return Math.abs(this.sensors.temp - OPTIMAL.temp) +
           Math.abs(this.sensors.hum_amb - OPTIMAL.hum_amb) +
           Math.abs(this.sensors.hum_suelo - OPTIMAL.hum_suelo) +
           Math.abs(this.sensors.ph - OPTIMAL.ph);
};

// ============================================================
// UI Updates
// ============================================================

HuertoChallenge.prototype.updateUI = function() {
    var el;
    el = document.getElementById('game-score');
    if (el) el.textContent = this.totalScore;

    el = document.getElementById('game-round');
    if (el) el.textContent = (this.currentRound + 1) + '/' + ROUNDS.length;

    el = document.getElementById('game-correct');
    if (el) el.textContent = this.correctCount;

    el = document.getElementById('game-water-fill');
    if (el) el.style.width = this.water + '%';
    el = document.getElementById('game-water-text');
    if (el) el.textContent = this.water + '%';

    el = document.getElementById('game-energy-fill');
    if (el) el.style.width = this.energy + '%';
    el = document.getElementById('game-energy-text');
    if (el) el.textContent = this.energy + '%';

    this.updatePlantSVG();
};

HuertoChallenge.prototype.updateTimerUI = function() {
    var el = document.getElementById('game-timer');
    if (el) el.textContent = this.timeLeft.toFixed(1) + 's';
    var bar = document.getElementById('game-timer-fill');
    if (bar) bar.style.width = ((this.timeLeft / 30) * 100) + '%';
};

HuertoChallenge.prototype.updateSensorDisplay = function() {
    var el;
    el = document.getElementById('game-temp');
    if (el) el.textContent = this.sensors.temp.toFixed(1);
    el = document.getElementById('game-humamb');
    if (el) el.textContent = this.sensors.hum_amb.toFixed(1);
    el = document.getElementById('game-humsuelo');
    if (el) el.textContent = this.sensors.hum_suelo.toFixed(1);
    el = document.getElementById('game-ph');
    if (el) el.textContent = this.sensors.ph.toFixed(1);
};

HuertoChallenge.prototype.updatePlantSVG = function() {
    var container = document.getElementById('gamePlantSvg');
    if (!container) return;
    container.innerHTML = this.getPlantSVG(this.plantStage);
};

HuertoChallenge.prototype.getPlantSVG = function(stage) {
    switch(stage) {
        case 0: return this.svgWilted();
        case 1: return this.svgSprout();
        case 2: return this.svgSmall();
        case 3: return this.svgStrong();
        case 4: return this.svgFlower();
        case 5: return this.svgFruit();
        default: return this.svgWilted();
    }
};

HuertoChallenge.prototype.svgWilted = function() {
    return '<svg viewBox="0 0 200 300" width="200" height="300">' +
        '<rect x="80" y="270" width="40" height="8" rx="2" fill="#3d2b1f"/>' +
        '<ellipse cx="100" cy="262" rx="14" ry="7" fill="#555"/>' +
        '<line x1="100" y1="262" x2="95" y2="275" stroke="#444" stroke-width="1.5"/>' +
        '<text x="100" y="245" text-anchor="middle" font-size="24">&#128164;</text>' +
        '</svg>';
};

HuertoChallenge.prototype.svgSprout = function() {
    return '<svg viewBox="0 0 200 300" width="200" height="300">' +
        '<rect x="80" y="270" width="40" height="8" rx="2" fill="#3d2b1f"/>' +
        '<line x1="100" y1="270" x2="100" y2="210" stroke="#228B22" stroke-width="3" class="plant-grow">' +
        '<animate attributeName="y2" from="270" to="210" dur="0.6s" fill="freeze"/>' +
        '</line>' +
        '<ellipse cx="90" cy="212" rx="10" ry="6" fill="#90EE90" transform="rotate(-30 90 212)">' +
        '<animate attributeName="rx" from="0" to="10" dur="0.4s" fill="freeze"/>' +
        '</ellipse>' +
        '<ellipse cx="110" cy="218" rx="10" ry="6" fill="#90EE90" transform="rotate(30 110 218)">' +
        '<animate attributeName="rx" from="0" to="10" dur="0.4s" begin="0.2s" fill="freeze"/>' +
        '</ellipse>' +
        '</svg>';
};

HuertoChallenge.prototype.svgSmall = function() {
    return '<svg viewBox="0 0 200 300" width="200" height="300">' +
        '<rect x="80" y="270" width="40" height="8" rx="2" fill="#3d2b1f"/>' +
        '<line x1="100" y1="270" x2="100" y2="160" stroke="#228B22" stroke-width="4">' +
        '<animate attributeName="y2" from="270" to="160" dur="0.5s" fill="freeze"/>' +
        '</line>' +
        '<ellipse cx="75" cy="195" rx="18" ry="10" fill="#32CD32" transform="rotate(-40 75 195)"/>' +
        '<ellipse cx="125" cy="190" rx="18" ry="10" fill="#32CD32" transform="rotate(40 125 190)"/>' +
        '<ellipse cx="80" cy="168" rx="14" ry="8" fill="#228B22" transform="rotate(-30 80 168)"/>' +
        '<ellipse cx="120" cy="165" rx="14" ry="8" fill="#228B22" transform="rotate(30 120 165)"/>' +
        '</svg>';
};

HuertoChallenge.prototype.svgStrong = function() {
    return '<svg viewBox="0 0 200 300" width="200" height="300">' +
        '<rect x="75" y="270" width="50" height="10" rx="3" fill="#3d2b1f"/>' +
        '<line x1="100" y1="270" x2="100" y2="110" stroke="#006400" stroke-width="6">' +
        '<animate attributeName="y2" from="270" to="110" dur="0.5s" fill="freeze"/>' +
        '</line>' +
        '<ellipse cx="60" cy="185" rx="25" ry="14" fill="#228B22" transform="rotate(-50 60 185)"/>' +
        '<ellipse cx="140" cy="180" rx="25" ry="14" fill="#228B22" transform="rotate(50 140 180)"/>' +
        '<ellipse cx="68" cy="145" rx="20" ry="11" fill="#32CD32" transform="rotate(-35 68 145)"/>' +
        '<ellipse cx="132" cy="140" rx="20" ry="11" fill="#32CD32" transform="rotate(35 132 140)"/>' +
        '<ellipse cx="80" cy="118" rx="16" ry="9" fill="#228B22"/>' +
        '<ellipse cx="120" cy="115" rx="16" ry="9" fill="#228B22"/>' +
        '</svg>';
};

HuertoChallenge.prototype.svgFlower = function() {
    return '<svg viewBox="0 0 200 300" width="200" height="300">' +
        '<rect x="72" y="270" width="56" height="10" rx="3" fill="#3d2b1f"/>' +
        '<line x1="100" y1="270" x2="100" y2="80" stroke="#006400" stroke-width="6">' +
        '<animate attributeName="y2" from="270" to="80" dur="0.5s" fill="freeze"/>' +
        '</line>' +
        '<ellipse cx="50" cy="175" rx="28" ry="15" fill="#228B22" transform="rotate(-55 50 175)"/>' +
        '<ellipse cx="150" cy="170" rx="28" ry="15" fill="#228B22" transform="rotate(55 150 170)"/>' +
        '<circle cx="100" cy="72" r="20" fill="#FF69B4">' +
        '<animate attributeName="r" from="0" to="20" dur="0.4s" fill="freeze"/>' +
        '</circle>' +
        '<circle cx="78" cy="62" r="11" fill="#FFB6C1"/>' +
        '<circle cx="122" cy="62" r="11" fill="#FFB6C1"/>' +
        '<circle cx="82" cy="88" r="11" fill="#FFB6C1"/>' +
        '<circle cx="118" cy="88" r="11" fill="#FFB6C1"/>' +
        '<circle cx="100" cy="58" r="7" fill="#FFD700"/>' +
        '</svg>';
};

HuertoChallenge.prototype.svgFruit = function() {
    return '<svg viewBox="0 0 200 300" width="200" height="300">' +
        '<rect x="68" y="270" width="64" height="12" rx="4" fill="#3d2b1f"/>' +
        '<line x1="100" y1="270" x2="100" y2="60" stroke="#006400" stroke-width="7">' +
        '<animate attributeName="y2" from="270" to="60" dur="0.5s" fill="freeze"/>' +
        '</line>' +
        '<ellipse cx="40" cy="165" rx="32" ry="17" fill="#228B22" transform="rotate(-55 40 165)"/>' +
        '<ellipse cx="160" cy="160" rx="32" ry="17" fill="#228B22" transform="rotate(55 160 160)"/>' +
        '<circle cx="72" cy="112" r="24" fill="#FF4444">' +
        '<animate attributeName="r" from="0" to="24" dur="0.3s" fill="freeze"/>' +
        '</circle>' +
        '<circle cx="128" cy="102" r="22" fill="#FF4444">' +
        '<animate attributeName="r" from="0" to="22" dur="0.3s" begin="0.1s" fill="freeze"/>' +
        '</circle>' +
        '<circle cx="100" cy="75" r="28" fill="#FF3333">' +
        '<animate attributeName="r" from="0" to="28" dur="0.3s" begin="0.2s" fill="freeze"/>' +
        '</circle>' +
        '<circle cx="88" cy="65" r="5" fill="rgba(255,255,255,0.4)"/>' +
        '<circle cx="68" cy="103" r="4" fill="rgba(255,255,255,0.3)"/>' +
        '<circle cx="120" cy="93" r="4" fill="rgba(255,255,255,0.3)"/>' +
        '</svg>';
};

// ============================================================
// UI Show/Hide
// ============================================================

HuertoChallenge.prototype.showRoundInfo = function() {
    var el = document.getElementById('game-status');
    if (!el) return;
    if (this.currentRound >= ROUNDS.length) {
        el.innerHTML = '<div class="game-msg game-msg-done">Juego completado! Puntaje final: <strong>' + this.totalScore + '</strong></div>' +
            '<button class="brutalist-btn game-btn" onclick="huertoGame.reset()">Jugar de nuevo</button>';
    } else {
        var r = ROUNDS[this.currentRound];
        el.innerHTML = '<div class="game-msg">Ronda ' + (this.currentRound + 1) + ': <strong>' + r.name + '</strong></div>' +
            '<div class="game-msg-sub">' + r.desc + '</div>' +
            '<div class="game-msg-sub">Lleva los sensoles al valor optimo en 30 segundos</div>' +
            '<button class="brutalist-btn game-btn" onclick="huertoGame.startRound()">Iniciar Ronda</button>';
    }
    document.getElementById('game-actions').style.display = 'none';
    document.getElementById('game-threat').style.display = 'none';
};

HuertoChallenge.prototype.showRoundStart = function(round) {
    var el = document.getElementById('game-status');
    if (el) el.innerHTML = '<div class="game-msg">Ronda ' + (this.currentRound + 1) + ': ' + round.name + ' - EN CURSO</div>';
    document.getElementById('game-actions').style.display = 'grid';
    document.getElementById('game-threat').style.display = 'none';
};

HuertoChallenge.prototype.showThreat = function(threat) {
    var el = document.getElementById('game-threat');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = '<div class="threat-icon">' + threat.icon + '</div>' +
        '<div class="threat-label">' + threat.label + '</div>' +
        '<div class="threat-hint">Toca el boton correcto!</div>';
    el.className = 'game-threat active';
};

HuertoChallenge.prototype.hideThreat = function() {
    var el = document.getElementById('game-threat');
    if (el) {
        el.style.display = 'none';
        el.className = 'game-threat';
    }
};

HuertoChallenge.prototype.showActionFeedback = function(points, correct) {
    var el = document.getElementById('game-feedback');
    if (!el) return;
    el.textContent = (points >= 0 ? '+' : '') + points;
    el.className = 'game-feedback ' + (correct ? 'feedback-good' : 'feedback-bad');
    el.style.display = 'block';
    setTimeout(function() { el.style.display = 'none'; }, 800);
};

HuertoChallenge.prototype.showRoundResult = function(roundScore) {
    document.getElementById('game-actions').style.display = 'none';
    document.getElementById('game-threat').style.display = 'none';
    var el = document.getElementById('game-status');
    if (!el) return;

    var stage = PLANT_STAGES[this.plantStage];
    var dist = this.getDistance();
    var msg = '<div class="game-msg">Ronda ' + (this.currentRound + 1) + ' completada!</div>';
    msg += '<div class="game-result-grid">';
    msg += '<div class="game-result-item"><span class="game-result-label">Puntaje ronda</span><span class="game-result-val">' + roundScore + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Total</span><span class="game-result-val">' + this.totalScore + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Respuestas correctas</span><span class="game-result-val">' + this.correctCount + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Planta</span><span class="game-result-val">' + stage.emoji + ' ' + stage.name + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Distancia al optima</span><span class="game-result-val">' + dist.toFixed(1) + '</span></div>';
    msg += '</div>';

    msg += '<div class="game-sensor-result">';
    msg += '<div class="sensor-result-item"><span>Temp</span><span>' + this.sensors.temp.toFixed(1) + '°C</span><span class="opt">(opt: 25°C)</span></div>';
    msg += '<div class="sensor-result-item"><span>HumAmb</span><span>' + this.sensors.hum_amb.toFixed(1) + '%</span><span class="opt">(opt: 65%)</span></div>';
    msg += '<div class="sensor-result-item"><span>HumSuelo</span><span>' + this.sensors.hum_suelo.toFixed(1) + '%</span><span class="opt">(opt: 60%)</span></div>';
    msg += '<div class="sensor-result-item"><span>pH</span><span>' + this.sensors.ph.toFixed(1) + '</span><span class="opt">(opt: 6.8)</span></div>';
    msg += '</div>';

    if (this.currentRound < ROUNDS.length - 1) {
        msg += '<button class="brutalist-btn game-btn" onclick="huertoGame.nextRound()">Siguiente Ronda</button>';
    } else {
        msg += '<button class="brutalist-btn game-btn" onclick="huertoGame.showFinalResult()">Ver Resultado Final</button>';
    }
    el.innerHTML = msg;
};

HuertoChallenge.prototype.showFinalResult = function() {
    this.playing = false;
    document.getElementById('game-actions').style.display = 'none';
    document.getElementById('game-threat').style.display = 'none';
    var el = document.getElementById('game-status');
    if (!el) return;

    var self = this;
    var stage = PLANT_STAGES[this.plantStage];
    var avgScore = Math.round(this.totalScore / ROUNDS.length);

    var msg = '<div class="game-msg game-msg-final">RESULTADO FINAL</div>';
    msg += '<div class="game-final-plant">' + this.getPlantSVG(this.plantStage) + '</div>';
    msg += '<div class="game-msg-sub">Planta: ' + stage.emoji + ' ' + stage.name + '</div>';
    msg += '<div class="game-result-grid">';
    msg += '<div class="game-result-item"><span class="game-result-label">Puntaje Total</span><span class="game-result-val game-final-score">' + this.totalScore + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Promedio por Ronda</span><span class="game-result-val">' + avgScore + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Total Correctas</span><span class="game-result-val">' + this.correctCount + '</span></div>';
    msg += '</div>';

    msg += '<div class="game-history">';
    msg += '<div class="game-history-title">Historial de Rondas</div>';
    this.history.forEach(function(h) {
        msg += '<div class="game-history-item">';
        msg += '<span>R' + h.round + ' ' + h.name + '</span>';
        msg += '<span>' + h.score + ' pts</span>';
        msg += '</div>';
    });
    msg += '</div>';

    msg += '<div id="gameRanking" class="game-history"><div class="game-history-title">Cargando ranking...</div></div>';
    msg += '<button class="brutalist-btn game-btn" onclick="huertoGame.reset()">Jugar de Nuevo</button>';
    el.innerHTML = msg;

    this.saveScore();
    this.loadRanking();
};


// ============================================================
// SAVE SCORE TO SUPABASE VIA BRIDGE
// ============================================================
HuertoChallenge.prototype.saveScore = function() {
    var stage = PLANT_STAGES[this.plantStage];
    var payload = {
        player_name: this.getPlayerName(),
        total_score: this.totalScore,
        correct_count: this.correctCount,
        rounds_played: this.history.length,
        plant_stage: this.plantStage
    };

    fetch(GAME_BRIDGE + '/api/challenge/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); })
      .then(function(d) { console.log('[GAME] Score guardado:', d); })
      .catch(function(e) { console.log('[GAME] Error guardando score:', e); });
};

HuertoChallenge.prototype.getPlayerName = function() {
    try {
        var auth = JSON.parse(localStorage.getItem('huerto_auth'));
        if (auth && auth.name) return auth.name;
        if (auth && auth.email) return auth.email.split('@')[0];
    } catch(e) {}
    return 'Jugador';
};

// ============================================================
// LOAD RANKING FROM SUPABASE VIA BRIDGE
// ============================================================
HuertoChallenge.prototype.loadRanking = function() {
    var self = this;
    fetch(GAME_BRIDGE + '/api/challenge/ranking?limit=10')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var ranking = data.ranking || [];
            var el = document.getElementById('gameRanking');
            if (!el) return;

            if (ranking.length === 0) {
                el.innerHTML = '<div class="game-history-title">Ranking vacio - se el primero!</div>';
                return;
            }

            var html = '<div class="game-history-title">Top 10 Jugadores</div>';
            ranking.forEach(function(s, i) {
                var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i+1);
                var stageInfo = PLANT_STAGES[s.plant_stage] || PLANT_STAGES[0];
                html += '<div class="game-history-item">';
                html += '<span>' + medal + ' ' + s.player_name + '</span>';
                html += '<span>' + s.total_score + ' pts ' + stageInfo.emoji + '</span>';
                html += '</div>';
            });
            el.innerHTML = html;
        }).catch(function(e) {
            console.log('[GAME] Error cargando ranking:', e);
            var el = document.getElementById('gameRanking');
            if (el) el.innerHTML = '<div class="game-history-title">No se pudo cargar ranking</div>';
        });
};
var huertoGame = new HuertoChallenge();
