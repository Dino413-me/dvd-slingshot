// ====== GLOBAL ELEMENTS ======
const dvd = document.getElementById("dvd");
const bounceCountEl = document.getElementById("bounceCount");
const speedSelect = document.getElementById("speedSelect");
const speedInput = document.getElementById("speedInput");

const aimCanvas = document.getElementById("aimLine");
const aimCtx = aimCanvas.getContext("2d");

const floodCanvas = document.getElementById("floodCanvas");
const floodCtx = floodCanvas.getContext("2d");

const effects = document.getElementById("effects");
const flash = document.getElementById("flash");
const warningEl = document.getElementById("warning");

const modeSelectScreen = document.getElementById("modeSelectScreen");
const exitBtn = document.getElementById("exitBtn");
const uiPanel = document.getElementById("uiPanel");
const classicUI = document.getElementById("classicUI");
const floodUI = document.getElementById("floodUI");
const infinityUI = document.getElementById("infinityUI");

const floodModeSelect = document.getElementById("floodModeSelect");
const timerOptions = document.getElementById("timerOptions");
const timerPreset = document.getElementById("timerPreset");
const timerCustom = document.getElementById("timerCustom");
const coveragePercentEl = document.getElementById("coveragePercent");

const infinityStyleSelect = document.getElementById("infinityStyle");

// ====== MODE STATE ======
let currentMode = null; // "classic", "flood", "infinity"

// ====== COMMON STATE ======
let dragging = false;
let offsetX = 0, offsetY = 0;

let baseVX = 0;
let baseVY = 0;
let vx = 0;
let vy = 0;

let bounceCount = 0;
let animating = false;
let speedMultiplier = 1;

let hue = 0;
let rainbowBackgroundHue = 180;

let infinityRunning = false;
let floodRunning = false;
let floodTimerId = null;
let floodTimeLeft = 0;

// ====== RESIZE HANDLERS ======
function resizeCanvases() {
    aimCanvas.width = window.innerWidth;
    aimCanvas.height = window.innerHeight;
    floodCanvas.width = window.innerWidth;
    floodCanvas.height = window.innerHeight;
}
resizeCanvases();
window.addEventListener("resize", resizeCanvases);

// ====== CENTER DVD ======
function centerDVD() {
    dvd.style.left = (window.innerWidth / 2 - dvd.clientWidth / 2) + "px";
    dvd.style.top = (window.innerHeight / 2 - dvd.clientHeight / 2) + "px";
}
centerDVD();

// ====== COLOR CYCLE ======
function updateColor() {
    hue = (hue + 1) % 360;
    dvd.style.background = `hsl(${hue}, 100%, 50%)`;

    if (currentMode === "infinity") {
        const style = infinityStyleSelect.value;
        if (style === "rainbowOpposites") {
            rainbowBackgroundHue = (hue + 180) % 360;
            document.body.style.background = `hsl(${rainbowBackgroundHue}, 100%, 10%)`;
        } else {
            document.body.style.background = "#000";
        }
    } else {
        document.body.style.background = "#000";
    }
}
setInterval(updateColor, 40);

// ====== SPEED HELPERS ======
function getSpeedMultiplier() {
    const custom = parseFloat(speedInput.value);
    if (!isNaN(custom) && custom > 0) return custom;
    const val = speedSelect.value;
    if (val === "instant") return "instant";
    return parseFloat(val);
}

speedSelect.addEventListener("change", () => {
    const val = speedSelect.value;
    if (currentMode !== "classic") return;
    if (val === "instant") {
        animating = false;
        runInstantWithWarning();
        return;
    }
    const s = getSpeedMultiplier();
    if (s !== "instant") speedMultiplier = s;
});

speedInput.addEventListener("input", () => {
    if (currentMode !== "classic") return;
    const s = getSpeedMultiplier();
    if (s === "instant") return;
    speedMultiplier = s;
});

// ====== AIM LINE ======
function drawAimLine(x1, y1, x2, y2) {
    aimCtx.clearRect(0, 0, aimCanvas.width, aimCanvas.height);
    aimCtx.setLineDash([4, 6]);
    aimCtx.strokeStyle = "white";
    aimCtx.lineWidth = 2;
    aimCtx.beginPath();
    aimCtx.moveTo(x1, y1);
    aimCtx.lineTo(x2, y2);
    aimCtx.stroke();
}

function clearAimLine() {
    aimCtx.clearRect(0, 0, aimCanvas.width, aimCanvas.height);
}

// ====== POINTER HELPERS ======
function getClientPos(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
        return { x: e.clientX, y: e.clientY };
    }
}

// ====== DRAGGING (CLASSIC + FLOOD + INFINITY) ======
function handleDown(e) {
    if (!currentMode) return;
    e.preventDefault();
    const pos = getClientPos(e);
    dragging = true;
    animating = false;
    baseVX = baseVY = 0;
    bounceCount = 0;
    bounceCountEl.textContent = 0;

    offsetX = pos.x - dvd.offsetLeft;
    offsetY = pos.y - dvd.offsetTop;

    if (currentMode === "flood") {
        // reset coverage when starting a new shot
        resetFloodCoverage();
    }
}

dvd.addEventListener("mousedown", handleDown);
dvd.addEventListener("touchstart", handleDown, { passive: false });

function handleMove(e) {
    if (!dragging || !currentMode) return;
    e.preventDefault();
    const pos = getClientPos(e);

    dvd.style.left = (pos.x - offsetX) + "px";
    dvd.style.top = (pos.y - offsetY) + "px";

    if (currentMode === "classic") {
        drawAimLine(
            window.innerWidth / 2,
            window.innerHeight / 2,
            dvd.offsetLeft + dvd.clientWidth / 2,
            dvd.offsetTop + dvd.clientHeight / 2
        );
    } else {
        clearAimLine();
    }
}

document.addEventListener("mousemove", handleMove);
document.addEventListener("touchmove", handleMove, { passive: false });

function handleUp(e) {
    if (!dragging || !currentMode) return;
    e.preventDefault();
    dragging = false;
    clearAimLine();

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const bx = dvd.offsetLeft + dvd.clientWidth / 2;
    const by = dvd.offsetTop + dvd.clientHeight / 2;

    baseVX = (cx - bx) * 0.15;
    baseVY = (cy - by) * 0.15;

    if (currentMode === "classic") {
        const s = getSpeedMultiplier();
        if (s === "instant") {
            runInstantWithWarning();
        } else {
            speedMultiplier = s;
            showCornerWarningIfNeeded(bx, by, baseVX, baseVY);
            animating = true;
            requestAnimationFrame(updateClassic);
        }
    } else if (currentMode === "flood") {
        startFloodShot(bx, by, baseVX, baseVY);
    } else if (currentMode === "infinity") {
        startInfinityShot(bx, by, baseVX, baseVY);
    }
}

document.addEventListener("mouseup", handleUp);
document.addEventListener("touchend", handleUp, { passive: false });

// ====== TRAIL ======
function spawnTrail() {
    const t = document.createElement("div");
    t.className = "trail";
    t.style.left = dvd.style.left;
    t.style.top = dvd.style.top;
    t.style.background = dvd.style.background;
    t.style.opacity = "0.4";
    document.body.appendChild(t);

    setTimeout(() => {
        t.style.transition = "opacity 0.4s";
        t.style.opacity = "0";
        setTimeout(() => t.remove(), 400);
    }, 10);
}

// ====== CELEBRATION ======
function celebrate() {
    flash.style.transition = "none";
    flash.style.opacity = "1";
    setTimeout(() => {
        flash.style.transition = "opacity 0.5s";
        flash.style.opacity = "0";
    }, 50);

    for (let i = 0; i < 40; i++) {
        const p = document.createElement("div");
        p.style.position = "absolute";
        p.style.width = "6px";
        p.style.height = "6px";
        p.style.background = `hsl(${Math.random()*360},100%,50%)`;
        p.style.left = dvd.offsetLeft + dvd.clientWidth/2 + "px";
        p.style.top = dvd.offsetTop + dvd.clientHeight/2 + "px";
        p.style.borderRadius = "50%";
        p.style.pointerEvents = "none";
        effects.appendChild(p);

        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 6;

        let vx = Math.cos(angle) * speed;
        let vy = Math.sin(angle) * speed;

        let life = 30 + Math.random()*20;

        function animateParticle() {
            p.style.left = (parseFloat(p.style.left) + vx) + "px";
            p.style.top = (parseFloat(p.style.top) + vy) + "px";
            vy += 0.2;
            life--;

            if (life > 0) requestAnimationFrame(animateParticle);
            else p.remove();
        }
        animateParticle();
    }
}

// ====== WARNING ======
function showWarning(text) {
    warningEl.textContent = text;
    warningEl.style.opacity = "1";
    setTimeout(() => {
        warningEl.style.opacity = "0";
    }, 1500);
}

// ====== CORNER PREDICTION ======
function willEverHitCorner(startX, startY, vx, vy) {
    let x = startX;
    let y = startY;
    const wMin = dvd.clientWidth / 2;
    const hMin = dvd.clientHeight / 2;
    const wMax = window.innerWidth - wMin;
    const hMax = window.innerHeight - hMin;

    for (let i = 0; i < 2000; i++) {
        let tx = vx > 0 ? (wMax - x) / vx : (wMin - x) / vx;
        let ty = vy > 0 ? (hMax - y) / vy : (hMin - y) / vy;

        if (!isFinite(tx) && !isFinite(ty)) break;

        let t = Math.min(tx, ty);
        if (t <= 0) break;

        x += vx * t;
        y += vy * t;

        let hitV = Math.abs(x - wMin) < 0.5 || Math.abs(x - wMax) < 0.5;
        let hitH = Math.abs(y - hMin) < 0.5 || Math.abs(y - hMax) < 0.5;

        if (hitV && hitH) return true;

        if (hitV) vx *= -1;
        if (hitH) vy *= -1;
    }
    return false;
}

function showCornerWarningIfNeeded(startX, startY, vx, vy) {
    const canHit = willEverHitCorner(startX, startY, vx, vy);
    if (!canHit) {
        showWarning("This shot will never hit a corner.");
    }
}

// ====== INSTANT MODE (CLASSIC) ======
function runInstantWithWarning() {
    const bx = dvd.offsetLeft + dvd.clientWidth / 2;
    const by = dvd.offsetTop + dvd.clientHeight / 2;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    let vx = (cx - bx) * 0.15;
    let vy = (cy - by) * 0.15;

    const canHit = willEverHitCorner(bx, by, vx, vy);
    if (!canHit) {
        showWarning("This shot will never hit a corner.");
        centerDVD();
        return;
    }

    runInstant(bx, by, vx, vy);
}

function runInstant(startX, startY, vx, vy) {
    let x = startX;
    let y = startY;

    const wMin = dvd.clientWidth / 2;
    const hMin = dvd.clientHeight / 2;
    const wMax = window.innerWidth - wMin;
    const hMax = window.innerHeight - hMin;

    let bounces = 0;

    for (let i = 0; i < 2000; i++) {
        let tx = vx > 0 ? (wMax - x) / vx : (wMin - x) / vx;
        let ty = vy > 0 ? (hMax - y) / vy : (hMin - y) / vy;

        if (!isFinite(tx) && !isFinite(ty)) break;

        let t = Math.min(tx, ty);
        if (t <= 0) break;

        x += vx * t;
        y += vy * t;

        let hitV = Math.abs(x - wMin) < 0.5 || Math.abs(x - wMax) < 0.5;
        let hitH = Math.abs(y - hMin) < 0.5 || Math.abs(y - hMax) < 0.5;

        if (hitV) bounces++;
        if (hitH) bounces++;

        if (hitV && hitH) {
            dvd.style.left = (x - dvd.clientWidth / 2) + "px";
            dvd.style.top = (y - dvd.clientHeight / 2) + "px";
            bounceCountEl.textContent = bounces;
            celebrate();
            setTimeout(() => centerDVD(), 600);
            return;
        }

        if (hitV) vx *= -1;
        if (hitH) vy *= -1;
    }

    bounceCountEl.textContent = bounces;
    showWarning("This shot will never hit a corner.");
    centerDVD();
}

// ====== CLASSIC MODE LOOP ======
function updateClassic() {
    if (!animating || currentMode !== "classic") return;

    const s = getSpeedMultiplier();
    if (s === "instant") {
        animating = false;
        runInstantWithWarning();
        return;
    }
    speedMultiplier = s;
    vx = baseVX * speedMultiplier;
    vy = baseVY * speedMultiplier;

    spawnTrail();

    let x = dvd.offsetLeft + vx;
    let y = dvd.offsetTop + vy;

    const maxX = window.innerWidth - dvd.clientWidth;
    const maxY = window.innerHeight - dvd.clientHeight;

    let hitCorner = false;

    if (x <= 0 || x >= maxX) {
        baseVX *= -1;
        bounceCount++;
    }
    if (y <= 0 || y >= maxY) {
        baseVY *= -1;
        bounceCount++;
    }

    if ((x <= 0 || x >= maxX) && (y <= 0 || y >= maxY)) {
        hitCorner = true;
    }

    bounceCountEl.textContent = bounceCount;

    dvd.style.left = Math.max(0, Math.min(maxX, x)) + "px";
    dvd.style.top = Math.max(0, Math.min(maxY, y)) + "px";

    if (hitCorner) {
        animating = false;
        celebrate();
        setTimeout(() => centerDVD(), 600);
        return;
    }

    requestAnimationFrame(updateClassic);
}

// ====== FLOOD MODE ======
function resetFloodCoverage() {
    floodCtx.clearRect(0, 0, floodCanvas.width, floodCanvas.height);
    coveragePercentEl.textContent = "0%";
}

function updateFloodCoverage() {
    const x = dvd.offsetLeft;
    const y = dvd.offsetTop;
    const w = dvd.clientWidth;
    const h = dvd.clientHeight;

    floodCtx.fillStyle = `hsl(${hue}, 100%, 40%)`;
    floodCtx.fillRect(x, y, w, h);

    const imgData = floodCtx.getImageData(0, 0, floodCanvas.width, floodCanvas.height).data;
    let painted = 0;
    for (let i = 3; i < imgData.length; i += 4) {
        if (imgData[i] !== 0) painted++;
    }
    const total = floodCanvas.width * floodCanvas.height;
    const percent = ((painted / total) * 100).toFixed(1);
    coveragePercentEl.textContent = percent + "%";
}

function startFloodShot(startX, startY, vx0, vy0) {
    floodRunning = true;
    baseVX = vx0;
    baseVY = vy0;
    animating = true;

    const mode = floodModeSelect.value;
    if (mode === "timer") {
        let t = parseFloat(timerCustom.value);
        if (isNaN(t) || t <= 0) {
            t = parseFloat(timerPreset.value);
        }
        floodTimeLeft = t;
        if (floodTimerId) clearInterval(floodTimerId);
        floodTimerId = setInterval(() => {
            floodTimeLeft -= 0.1;
            if (floodTimeLeft <= 0) {
                clearInterval(floodTimerId);
                floodTimerId = null;
                endFlood("Time up!");
            }
        }, 100);
    }

    requestAnimationFrame(updateFlood);
}

function updateFlood() {
    if (!animating || currentMode !== "flood") return;

    vx = baseVX;
    vy = baseVY;

    let x = dvd.offsetLeft + vx;
    let y = dvd.offsetTop + vy;

    const maxX = window.innerWidth - dvd.clientWidth;
    const maxY = window.innerHeight - dvd.clientHeight;

    let hitCorner = false;

    if (x <= 0 || x >= maxX) {
        baseVX *= -1;
    }
    if (y <= 0 || y >= maxY) {
        baseVY *= -1;
    }

    if ((x <= 0 || x >= maxX) && (y <= 0 || y >= maxY)) {
        hitCorner = true;
    }

    dvd.style.left = Math.max(0, Math.min(maxX, x)) + "px";
    dvd.style.top = Math.max(0, Math.min(maxY, y)) + "px";

    updateFloodCoverage();

    const mode = floodModeSelect.value;
    if (mode === "corner" && hitCorner) {
        endFlood("Corner hit!");
        return;
    }

    requestAnimationFrame(updateFlood);
}

function endFlood(reason) {
    animating = false;
    floodRunning = false;
    if (floodTimerId) {
        clearInterval(floodTimerId);
        floodTimerId = null;
    }
    showWarning(reason + " Coverage: " + coveragePercentEl.textContent);
    setTimeout(() => {
        resetFloodCoverage();
        centerDVD();
    }, 800);
}

// ====== INFINITY MODE ======
function startInfinityShot(startX, startY, vx0, vy0) {
    infinityRunning = true;
    baseVX = vx0;
    baseVY = vy0;
    animating = true;
    requestAnimationFrame(updateInfinity);
}

function updateInfinity() {
    if (!animating || currentMode !== "infinity") return;

    vx = baseVX;
    vy = baseVY;

    spawnTrail();

    let x = dvd.offsetLeft + vx;
    let y = dvd.offsetTop + vy;

    const maxX = window.innerWidth - dvd.clientWidth;
    const maxY = window.innerHeight - dvd.clientHeight;

    if (x <= 0 || x >= maxX) {
        baseVX *= -1;
    }
    if (y <= 0 || y >= maxY) {
        baseVY *= -1;
    }

    dvd.style.left = Math.max(0, Math.min(maxX, x)) + "px";
    dvd.style.top = Math.max(0, Math.min(maxY, y)) + "px";

    requestAnimationFrame(updateInfinity);
}

function stopInfinityMode() {
    if (currentMode !== "infinity") return;
    animating = false;
    infinityRunning = false;
    centerDVD();
}

// ====== MODE SWITCHING ======
function hideAllUI() {
    classicUI.style.display = "none";
    floodUI.style.display = "none";
    infinityUI.style.display = "none";
    uiPanel.style.display = "none";
    exitBtn.style.display = "none";
}

function resetAllState() {
    animating = false;
    dragging = false;
    floodRunning = false;
    infinityRunning = false;
    if (floodTimerId) {
        clearInterval(floodTimerId);
        floodTimerId = null;
    }
    clearAimLine();
    resetFloodCoverage();
    centerDVD();
    document.body.style.background = "#000";
}

function enterClassic() {
    resetAllState();
    currentMode = "classic";
    modeSelectScreen.style.display = "none";
    uiPanel.style.display = "block";
    classicUI.style.display = "block";
    exitBtn.style.display = "block";
}

function enterFlood() {
    resetAllState();
    currentMode = "flood";
    modeSelectScreen.style.display = "none";
    uiPanel.style.display = "block";
    floodUI.style.display = "block";
    exitBtn.style.display = "block";
    resetFloodCoverage();
}

function enterInfinity() {
    resetAllState();
    currentMode = "infinity";
    modeSelectScreen.style.display = "none";
    uiPanel.style.display = "block";
    infinityUI.style.display = "block";
    exitBtn.style.display = "block";
}

function returnToMenu() {
    resetAllState();
    currentMode = null;
    hideAllUI();
    modeSelectScreen.style.display = "flex";
}

// ====== FLOOD MODE UI ======
floodModeSelect.addEventListener("change", () => {
    if (floodModeSelect.value === "timer") {
        timerOptions.style.display = "inline-block";
    } else {
        timerOptions.style.display = "none";
    }
});

// init
hideAllUI();
modeSelectScreen.style.display = "flex";
