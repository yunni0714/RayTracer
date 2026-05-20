// laserEngine.js — 레이저 물리 시뮬레이션 + Canvas 그리기
import { GRID_SIZE, CELL_SIZE, mapData } from './dragAndDrop.js';

// --- Canvas ---
const canvas = document.getElementById('laserCanvas');
const ctx = canvas.getContext('2d');

export function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = (CELL_SIZE * GRID_SIZE) * dpr;
    canvas.height = (CELL_SIZE * GRID_SIZE) * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${CELL_SIZE * GRID_SIZE}px`;
    canvas.style.height = `${CELL_SIZE * GRID_SIZE}px`;
}

// --- 상태 ---
export let isLaserOn = false;

// --- 방향 벡터 (45도 간격) ---
const DIRS = {
    0: { dx: 1, dy: 0 }, 45: { dx: 1, dy: 1 }, 90: { dx: 0, dy: 1 }, 135: { dx: -1, dy: 1 },
    180: { dx: -1, dy: 0 }, 225: { dx: -1, dy: -1 }, 270: { dx: 0, dy: -1 }, 315: { dx: 1, dy: -1 }
};

// --- 반사각 계산 ---
export function calculateReflection(inDir, surfaceAngle) {
    return (2 * surfaceAngle - inDir + 720) % 360;
}

// --- 레이저 선 그리기 ---
export function drawLine(startX, startY, endX, endY, stopAtEdge = false) {
    let offset = CELL_SIZE / 2;
    let x1 = startX * CELL_SIZE + offset, y1 = startY * CELL_SIZE + offset;
    let x2 = endX * CELL_SIZE + offset, y2 = endY * CELL_SIZE + offset;

    if (stopAtEdge) {
        x2 = (startX + endX) / 2 * CELL_SIZE + offset;
        y2 = (startY + endY) / 2 * CELL_SIZE + offset;
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

// --- Canvas 초기화 ---
export function clearLaser() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

// --- 실시간 레이저 시뮬레이션 루프 ---
export function simulateLaser() {
    clearLaser();
    let beams = [];
    let visited = new Set();

    // 모든 Ray 기물에서 빔 발사
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (mapData[r][c] && mapData[r][c].type === 'ray') {
                beams.push({ x: c, y: r, dir: (mapData[r][c].rotation + 270) % 360 });
            }
        }
    }
    if (beams.length === 0) return;

    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ff3333";
    ctx.lineCap = "round";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "red";

    while (beams.length > 0) {
        let currentBeam = beams.shift();
        let cx = currentBeam.x, cy = currentBeam.y, cDir = currentBeam.dir;
        let nextX = cx + DIRS[cDir].dx, nextY = cy + DIRS[cDir].dy;

        if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
            drawLine(cx, cy, nextX, nextY, true);
            continue;
        }

        let stateKey = `${nextX},${nextY},${cDir}`;
        if (visited.has(stateKey)) continue;
        visited.add(stateKey);

        let item = mapData[nextY][nextX];

        if (!item) {
            drawLine(cx, cy, nextX, nextY, false);
            beams.push({ x: nextX, y: nextY, dir: cDir });
        }
        else if (item.type === 'block') {
            drawLine(cx, cy, nextX, nextY, false);
            beams.push({ x: nextX, y: nextY, dir: cDir });
        }
        else if (item.type === 'ray' || item.type === 'target') {
            drawLine(cx, cy, nextX, nextY, false);
        }
        else if (item.type === 'mirror_45') {
            drawLine(cx, cy, nextX, nextY, false);
            let surfaceAngle = (337.5 + item.rotation) % 360;
            beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, surfaceAngle) });
        }
        else if (item.type === 'half_mirror_45') {
            drawLine(cx, cy, nextX, nextY, false);
            let surfaceAngle = (337.5 + item.rotation) % 360;
            beams.push({ x: nextX, y: nextY, dir: cDir });
            beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, surfaceAngle) });
        }
        else if (['single_mirror', 'target_mirror_a', 'target_mirror_b', 'target_mirror'].includes(item.type)) {
            let normal = (225 + item.rotation) % 360;
            let surfaceAngle = (135 + item.rotation) % 360;
            let rel = (cDir - normal + 360) % 360;
            if (rel > 90 && rel < 270) {
                drawLine(cx, cy, nextX, nextY, false);
                beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, surfaceAngle) });
            } else {
                drawLine(cx, cy, nextX, nextY, true);
            }
        }
        else if (['diag_single_mirror_a'].includes(item.type)) {
            let normal = (112.5 + item.rotation) % 360;
            let surfaceAngle = (202.5 + item.rotation) % 360;
            let rel = (cDir - normal + 360) % 360;
            if (rel > 90 && rel < 270) {
                drawLine(cx, cy, nextX, nextY, false);
                beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, surfaceAngle) });
            } else {
                drawLine(cx, cy, nextX, nextY, true);
            }
        }
        else if (['diag_single_mirror_b'].includes(item.type)) {
            let normal = (67.5 + item.rotation) % 360;
            let surfaceAngle = (157.5 + item.rotation) % 360;
            let rel = (cDir - normal + 360) % 360;
            if (rel > 90 && rel < 270) {
                drawLine(cx, cy, nextX, nextY, false);
                beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, surfaceAngle) });
            } else {
                drawLine(cx, cy, nextX, nextY, true);
            }
        }
        else if (item.type === 'v_target_mirror' || ['v_target_mirror_a', 'v_target_mirror_b'].includes(item.type)) {
            let normal = (270 + item.rotation) % 360;
            let surfaceAngle = (0 + item.rotation) % 360;
            let rel = (cDir - normal + 360) % 360;
            if (rel > 90 && rel < 270) {
                drawLine(cx, cy, nextX, nextY, false);
                beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, surfaceAngle) });
            } else {
                drawLine(cx, cy, nextX, nextY, true);
            }
        }
        else if (['v_single_mirror'].includes(item.type)) {
            let normal = (90 + item.rotation) % 360;
            let surfaceAngle = (0 + item.rotation) % 360;
            let rel = (cDir - normal + 360) % 360;
            if (rel > 90 && rel < 270) {
                drawLine(cx, cy, nextX, nextY, false);
                beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, surfaceAngle) });
            } else {
                drawLine(cx, cy, nextX, nextY, true);
            }
        }
        else if (item.type === 'mirror') {
            drawLine(cx, cy, nextX, nextY, false);
            let surfaceAngle = (135 + item.rotation) % 360;
            beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, surfaceAngle) });
        }
        else if (item.type === 'half_mirror') {
            drawLine(cx, cy, nextX, nextY, false);
            let surfaceAngle = (135 + item.rotation) % 360;
            beams.push({ x: nextX, y: nextY, dir: cDir });
            beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, surfaceAngle) });
        }
        else if (item.type === 'v_mirror') {
            drawLine(cx, cy, nextX, nextY, false);
            let surfaceAngle = (0 + item.rotation) % 360;
            beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, surfaceAngle) });
        }
        else if (item.type === 'v_half_mirror') {
            drawLine(cx, cy, nextX, nextY, false);
            let surfaceAngle = (0 + item.rotation) % 360;
            beams.push({ x: nextX, y: nextY, dir: cDir });
            beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, surfaceAngle) });
        }
        else if (item.type === 'tunnel') {
            let tunnelRot = item.rotation % 180;
            if ((tunnelRot % 180 === 0 && (cDir === 90 || cDir === 270)) ||
                (tunnelRot % 180 === 90 && (cDir === 180 || cDir === 0))) {
                drawLine(cx, cy, nextX, nextY, false);
                beams.push({ x: nextX, y: nextY, dir: cDir });
            } else {
                drawLine(cx, cy, nextX, nextY, true);
            }
        }
    }
}

// --- 토글 ---
export function toggleLaser() {
    isLaserOn = !isLaserOn;
    const btn = document.getElementById('laserToggleBtn');
    if (isLaserOn) {
        btn.innerHTML = "🟢 실시간 레이저 끄기 (ON)";
        btn.style.backgroundColor = "#27ae60";
        simulateLaser();
    } else {
        btn.innerHTML = "🔴 실시간 레이저 켜기 (OFF)";
        btn.style.backgroundColor = "#e74c3c";
        clearLaser();
    }
}

// --- 현재 상태로 다시 그리기 ---
export function refreshLaser() {
    if (isLaserOn) simulateLaser();
    else clearLaser();
}
