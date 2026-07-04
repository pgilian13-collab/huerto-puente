// ============================================================
// GAME.JS - Huerto Challenge v2: Sobrevivencia Extrema
// ============================================================
// Sensors drift passively toward danger every tick.
// Threats actively push sensors worse if ignored.
// Combos reward consecutive correct responses.
// Water/Energy regenerate slowly but deplete on actions.
// ============================================================

var GAME_BRIDGE = "https://huerto-puente.onrender.com";

var OPTIMAL = { temp: 25, hum_amb: 65, hum_suelo: 60, ph: 6.8 };

var ROUNDS = [
    { name: "Dia Normal",     desc: "Calor ligero + sequia leve",      time: 35, driftSpeed: 1.0, threatRate: 4000, init: { temp: 30, hum_amb: 45, hum_suelo: 30, ph: 5.5 } },
    { name: "Sequia Severa",  desc: "Todo seco, pH disparado",         time: 30, driftSpeed: 1.3, threatRate: 3500, init: { temp: 36, hum_amb: 20, hum_suelo: 10, ph: 8.8 } },
    { name: "Noche Fria",     desc: "Frio extremo, humedad al maximo", time: 30, driftSpeed: 1.2, threatRate: 3000, init: { temp: 5,  hum_amb: 92, hum_suelo: 85, ph: 6.5 } },
    { name: "Tormenta",       desc: "Exceso de agua + viento",         time: 28, driftSpeed: 1.5, threatRate: 2800, init: { temp: 12, hum_amb: 97, hum_suelo: 95, ph: 5.8 } },
    { name: "Ola de Calor",   desc: "Extremo total - 45C",             time: 25, driftSpeed: 1.8, threatRate: 2500, init: { temp: 45, hum_amb: 15, hum_suelo: 8,  ph: 9.2 } }
];

var PLANT_STAGES = [
    { min: 0,   name: "Semilla marchita", cssClass: "stage-wilted" },
    { min: 300, name: "Brote debil",      cssClass: "stage-sprout" },
    { min: 700, name: "Planta joven",     cssClass: "stage-small" },
    { min: 1200,name: "Planta fuerte",    cssClass: "stage-strong" },
    { min: 1800,name: "Floracion",        cssClass: "stage-flower" },
    { min: 2500,name: "Fruto maduro",     cssClass: "stage-fruit" }
];

var THREATS = [
    { type: "sequia",     icon: "\uD83C\uDFDC\uFE0F", label: "Sequia extrema!",      sensor: "hum_suelo", damage: -12, action: "bomba",       hint: "Regar" },
    { type: "calor",      icon: "\uD83D\uDD25",        label: "Ola de calor!",        sensor: "temp",      damage: 6,   action: "ventilador",   hint: "Enfriar" },
    { type: "frio",       icon: "\u2744\uFE0F",        label: "Frio polar!",          sensor: "temp",      damage: -8,  action: "ventilador",   hint: "Calentar" },
    { type: "ph_bajo",    icon: "\u2697\uFE0F",        label: "pH muy acido!",        sensor: "ph",        damage: -1.2,action: "ph",           hint: "Ajustar pH" },
    { type: "ph_alto",    icon: "\u2623\uFE0F",        label: "pH muy alcalino!",     sensor: "ph",        damage: 1.5, action: "ph",           hint: "Ajustar pH" },
    { type: "hum_baja",   icon: "\uD83C\uDF2C\uFE0F",  label: "Aire deshidratado!",   sensor: "hum_amb",   damage: -10, action: "pulverizador", hint: "Humectar" },
    { type: "hum_alta",   icon: "\uD83C\uDF27\uFE0F",  label: "Humedad letal!",       sensor: "hum_amb",   damage: 8,   action: "ventilador",   hint: "Ventilar" },
    { type: "plaga",      icon: "\uD83D\uDC1B",        label: "Plaga invasora!",      sensor: null,        damage: null,action: "proteger",     hint: "Proteger" }
];

var DANGER_ZONES = {
    temp:     { min: 10, max: 35 },
    hum_amb:  { min: 25, max: 85 },
    hum_suelo:{ min: 20, max: 80 },
    ph:       { min: 5.5, max: 8.0 }
};

function HuertoChallenge() {
    this.currentRound = 0;
    this.timeLeft = 35;
    this.maxTime = 35;
    this.score = 0;
    this.totalScore = 0;
    this.playing = false;
    this.timer = null;
    this.threatTimer = null;
    this.currentThreat = null;
    this.threatTimeout = null;
    this.correctCount = 0;
    this.missCount = 0;
    this.totalTaps = 0;
    this.water = 100;
    this.energy = 100;
    this.maxWater = 100;
    this.maxEnergy = 100;
    this.sensors = { temp: 25, hum_amb: 65, hum_suelo: 60, ph: 6.8 };
    this.sensorColors = { temp: '', hum_amb: '', hum_suelo: '', ph: '' };
    this.plantStage = 0;
    this.history = [];
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;
    this.driftTimer = null;
    this.threatCount = 0;
    this.sensorsFixed = 0;
    this.roundActive = false;
}

HuertoChallenge.prototype.reset = function() {
    this.currentRound = 0;
    this.totalScore = 0;
    this.score = 0;
    this.playing = false;
    this.correctCount = 0;
    this.missCount = 0;
    this.totalTaps = 0;
    this.plantStage = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.history = [];
    this.updateUI();
    this.showRoundInfo();
};

HuertoChallenge.prototype.startRound = function() {
    var round = ROUNDS[this.currentRound];
    this.sensors = JSON.parse(JSON.stringify(round.init));
    this.timeLeft = round.time;
    this.maxTime = round.time;
    this.score = 0;
    this.water = 100;
    this.energy = 100;
    this.playing = true;
    this.roundActive = true;
    this.correctCount = 0;
    this.missCount = 0;
    this.currentThreat = null;
    this.threatCount = 0;
    this.sensorsFixed = 0;
    this.combo = 0;
    this.multiplier = 1;

    this.updateSensorDisplay();
    this.updateUI();
    this.showRoundStart(round);

    var self = this;

    // Main timer: 100ms ticks
    this.timer = setInterval(function() {
        self.timeLeft -= 0.1;
        if (self.timeLeft <= 0) {
            self.timeLeft = 0;
            self.endRound();
        }
        self.updateTimerUI();
    }, 100);

    // Sensor drift: every 800ms, sensors drift toward danger
    this.driftTimer = setInterval(function() {
        if (!self.roundActive) return;
        self.applyDrift(round.driftSpeed);
        self.regenerateResources();
        self.updateSensorDisplay();
        self.updateUI();
    }, 800);

    this.scheduleThreat(round.threatRate);
};

HuertoChallenge.prototype.applyDrift = function(speed) {
    var drift = 0.4 * speed;
    // Sensors drift away from optimal naturally
    if (this.sensors.temp > OPTIMAL.temp) {
        this.sensors.temp += drift * (0.3 + Math.random() * 0.4);
    } else {
        this.sensors.temp -= drift * (0.3 + Math.random() * 0.4);
    }
    if (this.sensors.hum_suelo > OPTIMAL.hum_suelo) {
        this.sensors.hum_suelo -= drift * (0.5 + Math.random() * 0.5);
    } else {
        this.sensors.hum_suelo += drift * (0.5 + Math.random() * 0.5);
    }
    // pH drifts slowly
    if (this.sensors.ph > OPTIMAL.ph) {
        this.sensors.ph += drift * 0.05 * (Math.random() > 0.5 ? 1 : -1);
    } else {
        this.sensors.ph -= drift * 0.05 * (Math.random() > 0.5 ? 1 : -1);
    }
    // Humidity ambient drifts slightly
    if (this.sensors.hum_amb > OPTIMAL.hum_amb) {
        this.sensors.hum_amb -= drift * 0.2;
    } else {
        this.sensors.hum_amb += drift * 0.2;
    }

    // Clamp all values
    this.sensors.temp = Math.max(-5, Math.min(55, this.sensors.temp));
    this.sensors.hum_amb = Math.max(0, Math.min(100, this.sensors.hum_amb));
    this.sensors.hum_suelo = Math.max(0, Math.min(100, this.sensors.hum_suelo));
    this.sensors.ph = Math.max(2, Math.min(12, this.sensors.ph));

    // Score bonus for being close to optimal
    var dist = this.getDistance();
    if (dist < 10) {
        this.score += Math.round(3 * this.multiplier);
        this.totalScore += Math.round(3 * this.multiplier);
        this.sensorsFixed++;
    }
};

HuertoChallenge.prototype.regenerateResources = function() {
    this.water = Math.min(this.maxWater, this.water + 0.8);
    this.energy = Math.min(this.maxEnergy, this.energy + 0.6);
};

HuertoChallenge.prototype.scheduleThreat = function(rate) {
    if (!this.playing) return;
    var self = this;
    var delay = (rate || 4000) + Math.random() * 2000;
    this.threatTimer = setTimeout(function() {
        if (self.playing && self.roundActive) {
            self.spawnThreat();
        }
    }, delay);
};

HuertoChallenge.prototype.spawnThreat = function() {
    if (!this.playing || !this.roundActive) return;
    var idx = Math.floor(Math.random() * THREATS.length);
    this.currentThreat = THREATS[idx];
    this.threatCount++;
    this.showThreat(this.currentThreat);

    var self = this;
    // Threat auto-misses after 4 seconds
    this.threatTimeout = setTimeout(function() {
        if (self.playing && self.currentThreat) {
            self.missThreat();
        }
    }, 4000);
};

HuertoChallenge.prototype.respondToThreat = function(actionType) {
    if (!this.playing || !this.roundActive || !this.currentThreat) return;
    if (this.currentThreat.action !== actionType) return;

    // Resource check
    if (actionType === 'bomba' && this.water < 15) return;
    if (actionType === 'ventilador' && this.energy < 10) return;
    if (actionType === 'pulverizador' && this.water < 10) return;
    if (actionType === 'ph' && (this.energy < 5 || this.water < 5)) return;
    if (actionType === 'proteger' && this.energy < 8) return;

    clearTimeout(this.threatTimeout);
    this.totalTaps++;
    this.correctCount++;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    // Multiplier: 1x base, +0.5x per 3 combo streak
    this.multiplier = 1 + Math.floor(this.combo / 3) * 0.5;

    // Base points * multiplier
    var basePoints = 50;
    var points = Math.round(basePoints * this.multiplier);
    this.score += points;
    this.totalScore += points;

    // Apply resource cost
    if (actionType === 'bomba') {
        this.water -= 15;
        this.sensors.hum_suelo = Math.min(100, this.sensors.hum_suelo + 12);
    } else if (actionType === 'ventilador') {
        this.energy -= 10;
        this.sensors.temp = Math.max(-5, this.sensors.temp - 6);
        this.sensors.hum_amb = Math.max(0, this.sensors.hum_amb - 3);
    } else if (actionType === 'pulverizador') {
        this.water -= 10;
        this.sensors.hum_amb = Math.min(100, this.sensors.hum_amb + 10);
    } else if (actionType === 'ph') {
        this.energy -= 5;
        this.water -= 5;
        this.sensors.ph = this.sensors.ph < 7
            ? Math.min(7.5, this.sensors.ph + 0.8)
            : Math.max(6.0, this.sensors.ph - 0.8);
    } else if (actionType === 'proteger') {
        this.energy -= 8;
    }

    this.currentThreat = null;
    this.updateSensorDisplay();
    this.showActionFeedback(points, true, this.combo);
    this.updateUI();

    var self = this;
    setTimeout(function() {
        self.hideThreat();
        if (self.roundActive) {
            self.scheduleThreat(ROUNDS[self.currentRound].threatRate);
        }
    }, 400);
};

HuertoChallenge.prototype.missThreat = function() {
    this.totalTaps++;
    this.missCount++;
    this.combo = 0;
    this.multiplier = 1;

    var penalty = 25;
    this.score = Math.max(0, this.score - penalty);
    this.totalScore = Math.max(0, this.totalScore - penalty);

    // Missed threat actively damages sensors
    if (this.currentThreat && this.currentThreat.sensor) {
        var sensor = this.currentThreat.sensor;
        var dmg = this.currentThreat.damage;
        if (typeof dmg === 'number') {
            this.sensors[sensor] += dmg;
            this.sensors.temp = Math.max(-5, Math.min(55, this.sensors.temp));
            this.sensors.hum_amb = Math.max(0, Math.min(100, this.sensors.hum_amb));
            this.sensors.hum_suelo = Math.max(0, Math.min(100, this.sensors.hum_suelo));
            this.sensors.ph = Math.max(2, Math.min(12, this.sensors.ph));
        }
    }

    this.currentThreat = null;
    this.showActionFeedback(-penalty, false, 0);
    this.updateSensorDisplay();
    this.updateUI();
    this.hideThreat();

    var self = this;
    if (this.roundActive) {
        this.scheduleThreat(ROUNDS[this.currentRound].threatRate);
    }
};

HuertoChallenge.prototype.endRound = function() {
    this.playing = false;
    this.roundActive = false;
    clearInterval(this.timer);
    clearInterval(this.driftTimer);
    clearTimeout(this.threatTimer);
    clearTimeout(this.threatTimeout);

    var dist = this.getDistance();
    var proximityScore = Math.max(0, Math.round(1000 - dist * 15));
    var bonusScore = this.correctCount * 30;
    var comboBonus = this.maxCombo * 10;
    var roundScore = proximityScore + bonusScore + comboBonus;
    this.score = roundScore;
    this.totalScore += roundScore;

    this.updatePlantStage();
    this.history.push({
        round: this.currentRound + 1,
        name: ROUNDS[this.currentRound].name,
        score: roundScore,
        correct: this.correctCount,
        missed: this.missCount,
        maxCombo: this.maxCombo,
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
};

HuertoChallenge.prototype.getDistance = function() {
    return Math.abs(this.sensors.temp - OPTIMAL.temp) +
           Math.abs(this.sensors.hum_amb - OPTIMAL.hum_amb) +
           Math.abs(this.sensors.hum_suelo - OPTIMAL.hum_suelo) +
           Math.abs(this.sensors.ph - OPTIMAL.ph);
};

HuertoChallenge.prototype.getSensorStatus = function(key) {
    var val = this.sensors[key];
    var zone = DANGER_ZONES[key];
    if (val < zone.min || val > zone.max) return 'danger';
    var mid = (zone.min + zone.max) / 2;
    var range = (zone.max - zone.min) / 2;
    var dist = Math.abs(val - mid) / range;
    if (dist > 0.7) return 'warning';
    return 'ok';
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

    el = document.getElementById('game-combo');
    if (el) el.textContent = this.combo > 0 ? 'x' + this.multiplier.toFixed(1) : '-';

    el = document.getElementById('game-water-fill');
    if (el) el.style.width = this.water + '%';
    el = document.getElementById('game-water-text');
    if (el) el.textContent = Math.round(this.water) + '%';

    el = document.getElementById('game-energy-fill');
    if (el) el.style.width = this.energy + '%';
    el = document.getElementById('game-energy-text');
    if (el) el.textContent = Math.round(this.energy) + '%';

    this.updatePlantSVG();
};

HuertoChallenge.prototype.updateTimerUI = function() {
    var el = document.getElementById('game-timer');
    if (el) el.textContent = this.timeLeft.toFixed(1) + 's';
    var bar = document.getElementById('game-timer-fill');
    if (bar) bar.style.width = ((this.timeLeft / this.maxTime) * 100) + '%';
    // Flash red when low
    if (bar && this.timeLeft < 8) {
        bar.style.background = '#ef4444';
    } else if (bar) {
        bar.style.background = '';
    }
};

HuertoChallenge.prototype.updateSensorDisplay = function() {
    var keys = ['temp', 'hum_amb', 'hum_suelo', 'ph'];
    var ids = { temp: 'game-temp', hum_amb: 'game-humamb', hum_suelo: 'game-humsuelo', ph: 'game-ph' };
    var units = { temp: '\u00B0C', hum_amb: '%', hum_suelo: '%', ph: '' };
    var decimals = { temp: 1, hum_amb: 1, hum_suelo: 1, ph: 1 };

    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var el = document.getElementById(ids[k]);
        if (el) {
            el.textContent = this.sensors[k].toFixed(decimals[k]) + units[k];
            var status = this.getSensorStatus(k);
            el.className = 'game-sensor-val sensor-' + status;
        }
    }
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
    return '<svg viewBox="0 0 200 300" width="100%" height="100%">' +
        '<rect x="80" y="270" width="40" height="8" rx="2" fill="#3d2b1f"/>' +
        '<ellipse cx="100" cy="262" rx="14" ry="7" fill="#555"/>' +
        '<line x1="100" y1="262" x2="95" y2="275" stroke="#444" stroke-width="1.5"/>' +
        '<text x="100" y="235" text-anchor="middle" font-size="40">&#128164;</text>' +
        '</svg>';
};

HuertoChallenge.prototype.svgSprout = function() {
    return '<svg viewBox="0 0 200 300" width="100%" height="100%">' +
        '<rect x="80" y="270" width="40" height="8" rx="2" fill="#3d2b1f"/>' +
        '<line x1="100" y1="270" x2="100" y2="200" stroke="#228B22" stroke-width="3">' +
        '<animate attributeName="y2" from="270" to="200" dur="0.6s" fill="freeze"/>' +
        '</line>' +
        '<ellipse cx="85" cy="202" rx="12" ry="7" fill="#90EE90" transform="rotate(-30 85 202)"/>' +
        '<ellipse cx="115" cy="208" rx="12" ry="7" fill="#90EE90" transform="rotate(30 115 208)"/>' +
        '</svg>';
};

HuertoChallenge.prototype.svgSmall = function() {
    return '<svg viewBox="0 0 200 300" width="100%" height="100%">' +
        '<rect x="80" y="270" width="40" height="8" rx="2" fill="#3d2b1f"/>' +
        '<line x1="100" y1="270" x2="100" y2="155" stroke="#228B22" stroke-width="4"/>' +
        '<ellipse cx="72" cy="190" rx="20" ry="11" fill="#32CD32" transform="rotate(-40 72 190)"/>' +
        '<ellipse cx="128" cy="185" rx="20" ry="11" fill="#32CD32" transform="rotate(40 128 185)"/>' +
        '<ellipse cx="78" cy="162" rx="16" ry="9" fill="#228B22" transform="rotate(-30 78 162)"/>' +
        '<ellipse cx="122" cy="158" rx="16" ry="9" fill="#228B22" transform="rotate(30 122 158)"/>' +
        '</svg>';
};

HuertoChallenge.prototype.svgStrong = function() {
    return '<svg viewBox="0 0 200 300" width="100%" height="100%">' +
        '<rect x="75" y="270" width="50" height="10" rx="3" fill="#3d2b1f"/>' +
        '<line x1="100" y1="270" x2="100" y2="105" stroke="#006400" stroke-width="6"/>' +
        '<ellipse cx="55" cy="180" rx="28" ry="15" fill="#228B22" transform="rotate(-50 55 180)"/>' +
        '<ellipse cx="145" cy="175" rx="28" ry="15" fill="#228B22" transform="rotate(50 145 175)"/>' +
        '<ellipse cx="65" cy="140" rx="22" ry="12" fill="#32CD32" transform="rotate(-35 65 140)"/>' +
        '<ellipse cx="135" cy="135" rx="22" ry="12" fill="#32CD32" transform="rotate(35 135 135)"/>' +
        '<ellipse cx="80" cy="112" rx="18" ry="10" fill="#228B22"/>' +
        '<ellipse cx="120" cy="108" rx="18" ry="10" fill="#228B22"/>' +
        '</svg>';
};

HuertoChallenge.prototype.svgFlower = function() {
    return '<svg viewBox="0 0 200 300" width="100%" height="100%">' +
        '<rect x="72" y="270" width="56" height="10" rx="3" fill="#3d2b1f"/>' +
        '<line x1="100" y1="270" x2="100" y2="78" stroke="#006400" stroke-width="6"/>' +
        '<ellipse cx="48" cy="170" rx="30" ry="16" fill="#228B22" transform="rotate(-55 48 170)"/>' +
        '<ellipse cx="152" cy="165" rx="30" ry="16" fill="#228B22" transform="rotate(55 152 165)"/>' +
        '<circle cx="100" cy="70" r="22" fill="#FF69B4"/>' +
        '<circle cx="76" cy="58" r="12" fill="#FFB6C1"/>' +
        '<circle cx="124" cy="58" r="12" fill="#FFB6C1"/>' +
        '<circle cx="80" cy="86" r="12" fill="#FFB6C1"/>' +
        '<circle cx="120" cy="86" r="12" fill="#FFB6C1"/>' +
        '<circle cx="100" cy="54" r="8" fill="#FFD700"/>' +
        '</svg>';
};

HuertoChallenge.prototype.svgFruit = function() {
    return '<svg viewBox="0 0 200 300" width="100%" height="100%">' +
        '<rect x="68" y="270" width="64" height="12" rx="4" fill="#3d2b1f"/>' +
        '<line x1="100" y1="270" x2="100" y2="55" stroke="#006400" stroke-width="7"/>' +
        '<ellipse cx="38" cy="160" rx="34" ry="18" fill="#228B22" transform="rotate(-55 38 160)"/>' +
        '<ellipse cx="162" cy="155" rx="34" ry="18" fill="#228B22" transform="rotate(55 162 155)"/>' +
        '<circle cx="70" cy="108" r="26" fill="#FF4444"/>' +
        '<circle cx="130" cy="98" r="24" fill="#FF4444"/>' +
        '<circle cx="100" cy="70" r="30" fill="#FF3333"/>' +
        '<circle cx="86" cy="60" r="6" fill="rgba(255,255,255,0.4)"/>' +
        '<circle cx="66" cy="100" r="5" fill="rgba(255,255,255,0.3)"/>' +
        '<circle cx="122" cy="90" r="5" fill="rgba(255,255,255,0.3)"/>' +
        '</svg>';
};

// ============================================================
// UI Show/Hide
// ============================================================

HuertoChallenge.prototype.showRoundInfo = function() {
    var el = document.getElementById('game-status');
    if (!el) return;
    if (this.currentRound >= ROUNDS.length) {
        el.innerHTML = '<div class="game-msg game-msg-done">Juego completado! Puntaje: <strong>' + this.totalScore + '</strong></div>' +
            '<button class="brutalist-btn game-btn" onclick="huertoGame.reset()">Jugar de nuevo</button>';
    } else {
        var r = ROUNDS[this.currentRound];
        el.innerHTML = '<div class="game-msg">Ronda ' + (this.currentRound + 1) + ': <strong>' + r.name + '</strong></div>' +
            '<div class="game-msg-sub">' + r.desc + '</div>' +
            '<div class="game-msg-sub">Mantene los sensores en zona verde + responde amenazas</div>' +
            '<div class="game-msg-sub">Combos correctos dan x' + (1 + Math.floor(3/3)*0.5).toFixed(1) + '+ multiplicador</div>' +
            '<button class="brutalist-btn game-btn" onclick="huertoGame.startRound()">Iniciar Ronda</button>';
    }
    var actionsEl = document.getElementById('game-actions');
    var threatEl = document.getElementById('game-threat');
    if (actionsEl) actionsEl.style.display = 'none';
    if (threatEl) threatEl.style.display = 'none';
};

HuertoChallenge.prototype.showRoundStart = function(round) {
    var el = document.getElementById('game-status');
    if (el) el.innerHTML = '<div class="game-msg">Ronda ' + (this.currentRound + 1) + ': ' + round.name + ' - EN CURSO</div>';
    var actionsEl = document.getElementById('game-actions');
    var threatEl = document.getElementById('game-threat');
    if (actionsEl) actionsEl.style.display = 'grid';
    if (threatEl) threatEl.style.display = 'none';
};

HuertoChallenge.prototype.showThreat = function(threat) {
    var el = document.getElementById('game-threat');
    if (!el) return;
    el.style.display = 'flex';
    el.innerHTML = '<div class="threat-icon">' + threat.icon + '</div>' +
        '<div class="threat-info">' +
        '<div class="threat-label">' + threat.label + '</div>' +
        '<div class="threat-hint">' + threat.hint + '</div>' +
        '</div>';
    el.className = 'game-threat active threat-' + threat.type;
};

HuertoChallenge.prototype.hideThreat = function() {
    var el = document.getElementById('game-threat');
    if (el) {
        el.style.display = 'none';
        el.className = 'game-threat';
    }
};

HuertoChallenge.prototype.showActionFeedback = function(points, correct, combo) {
    var el = document.getElementById('game-feedback');
    if (!el) return;
    var text = (points >= 0 ? '+' : '') + points;
    if (combo > 1) text += ' x' + this.multiplier.toFixed(1);
    el.textContent = text;
    el.className = 'game-feedback ' + (correct ? 'feedback-good' : 'feedback-bad');
    el.style.display = 'block';
    setTimeout(function() { el.style.display = 'none'; }, 600);
};

HuertoChallenge.prototype.showRoundResult = function(roundScore) {
    var actionsEl = document.getElementById('game-actions');
    var threatEl = document.getElementById('game-threat');
    if (actionsEl) actionsEl.style.display = 'none';
    if (threatEl) threatEl.style.display = 'none';
    var el = document.getElementById('game-status');
    if (!el) return;

    var stage = PLANT_STAGES[this.plantStage];
    var dist = this.getDistance();

    var msg = '<div class="game-msg">Ronda ' + (this.currentRound + 1) + ' completada!</div>';
    msg += '<div class="game-result-grid">';
    msg += '<div class="game-result-item"><span class="game-result-label">Puntaje ronda</span><span class="game-result-val game-val-highlight">' + roundScore + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Total acumulado</span><span class="game-result-val">' + this.totalScore + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Correctas</span><span class="game-result-val">' + this.correctCount + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Fallidas</span><span class="game-result-val">' + this.missCount + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Max Combo</span><span class="game-result-val">' + this.maxCombo + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Planta</span><span class="game-result-val">' + stage.name + '</span></div>';
    msg += '</div>';

    msg += '<div class="game-sensor-result">';
    msg += '<div class="sensor-result-item"><span>Temp</span><span>' + this.sensors.temp.toFixed(1) + '\u00B0C</span><span class="opt">(opt: 25\u00B0C)</span></div>';
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
    var actionsEl = document.getElementById('game-actions');
    var threatEl = document.getElementById('game-threat');
    if (actionsEl) actionsEl.style.display = 'none';
    if (threatEl) threatEl.style.display = 'none';
    var el = document.getElementById('game-status');
    if (!el) return;

    var stage = PLANT_STAGES[this.plantStage];
    var avgScore = Math.round(this.totalScore / ROUNDS.length);

    var grade = 'F';
    if (this.totalScore >= 3000) grade = 'S+';
    else if (this.totalScore >= 2500) grade = 'S';
    else if (this.totalScore >= 2000) grade = 'A';
    else if (this.totalScore >= 1500) grade = 'B';
    else if (this.totalScore >= 1000) grade = 'C';
    else if (this.totalScore >= 500) grade = 'D';

    var msg = '<div class="game-msg game-msg-final">RESULTADO FINAL - RANGO: ' + grade + '</div>';
    msg += '<div class="game-final-plant">' + this.getPlantSVG(this.plantStage) + '</div>';
    msg += '<div class="game-msg-sub">' + stage.name + '</div>';
    msg += '<div class="game-result-grid">';
    msg += '<div class="game-result-item"><span class="game-result-label">Puntaje Total</span><span class="game-result-val game-final-score">' + this.totalScore + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Promedio/Ronda</span><span class="game-result-val">' + avgScore + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Correctas</span><span class="game-result-val">' + this.correctCount + '</span></div>';
    msg += '<div class="game-result-item"><span class="game-result-label">Max Combo</span><span class="game-result-val">' + this.maxCombo + '</span></div>';
    msg += '</div>';

    msg += '<div class="game-history">';
    msg += '<div class="game-history-title">Historial de Rondas</div>';
    this.history.forEach(function(h) {
        msg += '<div class="game-history-item">';
        msg += '<span>R' + h.round + ' ' + h.name + '</span>';
        msg += '<span>' + h.score + ' pts | Combo: ' + h.maxCombo + '</span>';
        msg += '</div>';
    });
    msg += '</div>';

    msg += '<div id="gameRanking" class="game-history"><div class="game-history-title">Cargando ranking...</div></div>';
    msg += '<button class="brutalist-btn game-btn" onclick="huertoGame.reset()">Jugar de Nuevo</button>';
    el.innerHTML = msg;

    this.saveScore();
    this.loadRanking();
};

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
                var medal = i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : i === 2 ? '\uD83E\uDD49' : '#' + (i+1);
                var stageInfo = PLANT_STAGES[s.plant_stage] || PLANT_STAGES[0];
                html += '<div class="game-history-item">';
                html += '<span>' + medal + ' ' + s.player_name + '</span>';
                html += '<span>' + s.total_score + ' pts</span>';
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
