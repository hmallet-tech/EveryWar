// js/engine/Sprites.js – Procedural pixel-art sprite generation
// All sprites are pre-rendered to offscreen canvases for performance.
import { TILE_SIZE } from '../constants.js';

const S = TILE_SIZE; // 32

function mk(w = S, h = S) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return { c, g: c.getContext('2d') };
}

function rect(g, x, y, w, h, fill, stroke) {
    g.fillStyle = fill; g.fillRect(x, y, w, h);
    if (stroke) { g.strokeStyle = stroke; g.strokeRect(x + .5, y + .5, w - 1, h - 1); }
}

function circle(g, cx, cy, r, fill) {
    g.fillStyle = fill; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
}

// ─── TILE SPRITES ──────────────────────────────────────────────────────────
const TILE_VARIANTS = 3;

export function makeTileSprites() {
    const sprites = {};

    // GRASS (type 0) – green with slight noise
    sprites[0] = Array.from({ length: TILE_VARIANTS }, (_, v) => {
        const { c, g } = mk(); const base = '#3a6632';
        const vars = ['#3a6632', '#3d6e35', '#366030'];
        rect(g, 0, 0, S, S, vars[v]);
        // tiny grass blades
        g.strokeStyle = '#2d5028'; g.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            const bx = Math.round((i * 5 + v * 3) % S), by = Math.round((i * 7 + v * 4) % S);
            g.beginPath(); g.moveTo(bx, by + 4); g.lineTo(bx, by); g.stroke();
        }
        return c;
    });

    // WATER (type 1)
    sprites[1] = Array.from({ length: TILE_VARIANTS }, (_, v) => {
        const { c, g } = mk();
        rect(g, 0, 0, S, S, '#1a4a8a');
        g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const wy = (i * 9 + v * 4) % S;
            g.beginPath(); g.moveTo(0, wy); g.bezierCurveTo(8, wy - 3, 16, wy + 3, S, wy); g.stroke();
        }
        return c;
    });

    // FOREST (type 2)
    sprites[2] = Array.from({ length: TILE_VARIANTS }, (_, v) => {
        const { c, g } = mk();
        rect(g.canvas ? { fillRect: () => { } } : g, 0, 0, S, S, '#1e4a1e', null);
        g.fillStyle = '#1e4a1e'; g.fillRect(0, 0, S, S);
        const trees = [[8, 14, 7], [24, 12, 5], [16, 22, 6]];
        trees.forEach(([tx, ty, r], i) => {
            if (i === 1 && v === 0) return;
            g.fillStyle = '#2a6622'; g.beginPath(); g.arc(tx, ty, r + 1, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#386030'; g.beginPath(); g.arc(tx - 1, ty - 1, r, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#825a30'; g.fillRect(tx - 1, ty + r - 1, 2, 4);
        });
        return c;
    });

    // MOUNTAIN (type 3)
    sprites[3] = Array.from({ length: TILE_VARIANTS }, (_, v) => {
        const { c, g } = mk();
        rect(g, 0, 0, S, S, '#4a4a4a');
        g.fillStyle = '#666';
        g.beginPath(); g.moveTo(4, S); g.lineTo(16 + v * 3, 4); g.lineTo(S - 4, S); g.fill();
        g.fillStyle = '#888';
        g.beginPath(); g.moveTo(16 + v * 3, 4); g.lineTo(22 + v * 2, 16); g.lineTo(10 + v, 18); g.fill();
        g.fillStyle = '#ddd'; // snow cap
        g.beginPath(); g.moveTo(16 + v * 3, 4); g.lineTo(20 + v * 2, 12); g.lineTo(12 + v, 12); g.fill();
        return c;
    });

    // GOLD MINE (type 4)
    sprites[4] = Array.from({ length: 1 }, () => {
        const { c, g } = mk();
        rect(g, 0, 0, S, S, '#7a6020');
        // Mine entrance
        rect(g, 8, 10, 16, 14, '#2a1a00', '#6a4800');
        rect(g, 11, 14, 10, 10, '#0a0500');
        // Gold sparkles
        g.fillStyle = '#ffd700';
        [[5, 5], [24, 8], [6, 22], [26, 20]].forEach(([px, py]) => {
            g.fillRect(px, py, 3, 1); g.fillRect(px + 1, py - 1, 1, 3);
        });
        // Label
        g.fillStyle = '#ffd700'; g.font = 'bold 8px monospace'; g.textAlign = 'center';
        g.fillText('ORE', S / 2, 8);
        return c;
    });

    // SAND (type 5)
    sprites[5] = Array.from({ length: TILE_VARIANTS }, (_, v) => {
        const { c, g } = mk();
        rect(g, 0, 0, S, S, '#c8a864');
        g.fillStyle = '#b89854';
        for (let i = 0; i < 4; i++) g.fillRect((i * 8 + v * 3) % S, (i * 6 + v * 2) % S, 2, 1);
        return c;
    });

    // DEEP WATER (type 6)
    sprites[6] = Array.from({ length: TILE_VARIANTS }, (_, v) => {
        const { c, g } = mk();
        rect(g, 0, 0, S, S, '#0e2e6a');
        g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, (v * 7) % S); g.lineTo(S, (v * 7 + 3) % S); g.stroke();
        return c;
    });

    // ROAD (type 7)
    sprites[7] = Array.from({ length: 1 }, () => {
        const { c, g } = mk();
        rect(g, 0, 0, S, S, '#886644');
        g.strokeStyle = '#6a4a30'; g.lineWidth = 1;
        g.strokeRect(.5, .5, S - 1, S - 1);
        return c;
    });

    return sprites;
}

// ─── UNIT SPRITES ──────────────────────────────────────────────────────────
// Returns a canvas for a unit type + faction color

export function makeUnitSprite(unitKey, factionColor) {
    const { c, g } = mk(S, S);
    const fc = factionColor;
    const dark = '#0a0500';

    // Draw based on unit type
    switch (unitKey) {
        case 'peasant':
        case 'grunt':
            drawWorker(g, fc);
            break;
        case 'footman':
        case 'berserker':
            drawSoldier(g, fc, unitKey === 'berserker');
            break;
        case 'archer':
        case 'goblin_archer':
            drawArcher(g, fc, unitKey === 'goblin_archer');
            break;
        case 'knight':
            drawKnight(g, fc);
            break;
        case 'worg_rider':
            drawWorgRider(g, fc);
            break;
        case 'mage':
            drawMage(g, fc);
            break;
        case 'shaman':
            drawShaman(g, fc);
            break;
        case 'paladin':
            drawPaladin(g, fc);
            break;
        case 'beastmaster':
            drawBeastmaster(g, fc);
            break;
        default:
            drawWorker(g, fc);
    }
    return c;
}

function drawBody(g, x, y, bodyColor, headColor) {
    // Shadow
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(S / 2 + 1, S - 3, 8, 3, 0, 0, Math.PI * 2); g.fill();
    // Legs
    g.fillStyle = '#3a2010';
    g.fillRect(x + 2, y + 16, 5, 10);
    g.fillRect(x + 11, y + 16, 5, 10);
    // Body
    g.fillStyle = bodyColor;
    g.fillRect(x, y + 8, 18, 10);
    // Head
    g.fillStyle = headColor || '#c8956c';
    g.beginPath(); g.arc(x + 9, y + 5, 5, 0, Math.PI * 2); g.fill();
}

function drawWorker(g, fc) {
    drawBody(g, 7, 8, fc, '#c8956c');
    // Tool
    g.strokeStyle = '#8b6020'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(20, 10); g.lineTo(26, 4); g.stroke();
    g.fillStyle = '#888'; g.fillRect(22, 3, 5, 3);
}
function drawSoldier(g, fc, isBerserk) {
    drawBody(g, 7, 7, fc, isBerserk ? '#88aa44' : '#c8956c');
    // Sword
    g.strokeStyle = '#ccc'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(22, 9); g.lineTo(28, 3); g.stroke();
    // Shield
    g.fillStyle = isBerserk ? '#882211' : '#2244aa';
    g.fillRect(3, 10, 5, 9);
    // Helmet
    g.fillStyle = '#888869';
    g.beginPath(); g.arc(16, 10, 5, Math.PI, .5 * Math.PI, true); g.fill();
}
function drawArcher(g, fc, isGoblin) {
    drawBody(g, 7, 8, isGoblin ? '#556622' : fc, isGoblin ? '#88aa44' : '#c8956c');
    // Bow
    g.strokeStyle = '#8b6020'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(22, 16, 8, -Math.PI / 2, Math.PI / 2, false); g.stroke();
    // Arrow
    g.strokeStyle = '#888'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(14, 16); g.lineTo(22, 16); g.stroke();
    g.fillStyle = '#888'; g.fillRect(22, 15, 3, 2);
}
function drawKnight(g, fc) {
    // Horse body
    g.fillStyle = '#7a5030';
    g.beginPath(); g.ellipse(18, 20, 12, 8, 0, 0, Math.PI * 2); g.fill();
    // Horse legs
    g.fillStyle = '#5a3820'; g.lineWidth = 2;
    [[8, 28], [13, 30], [22, 30], [27, 28]].forEach(([hx, hy]) => {
        g.fillRect(hx - 1, hy - 5, 3, 8);
    });
    // Rider
    g.fillStyle = fc; g.fillRect(12, 8, 10, 14);
    g.fillStyle = '#c8956c'; g.beginPath(); g.arc(17, 6, 5, 0, Math.PI * 2); g.fill();
    // Helmet
    g.fillStyle = '#999'; g.fillRect(14, 2, 8, 6); g.fillRect(15, 8, 6, 3);
    // Lance
    g.strokeStyle = '#8b6020'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(22, 6); g.lineTo(S + 2, 0); g.stroke();
}
function drawWorgRider(g, fc) {
    // Worg (wolf) body – dark
    g.fillStyle = '#444';
    g.beginPath(); g.ellipse(17, 21, 11, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#333';
    g.beginPath(); g.moveTo(4, 16); g.lineTo(10, 10); g.lineTo(14, 16); g.fill(); // head
    g.fillStyle = '#555'; g.fillRect(4, 18, 3, 9); g.fillRect(16, 22, 3, 8);
    // Rider
    g.fillStyle = fc; g.fillRect(11, 9, 10, 13);
    g.fillStyle = '#88aa44'; g.beginPath(); g.arc(16, 7, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#445522'; g.fillRect(12, 3, 8, 5);
    // Axe
    g.strokeStyle = '#aaa'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(22, 8); g.lineTo(28, 4); g.stroke();
    g.fillStyle = '#888'; g.fillRect(25, 2, 5, 5);
}
function drawMage(g, fc) {
    drawBody(g, 7, 8, '#3a1a6a', '#c8956c');
    // Robe
    g.fillStyle = fc;
    g.beginPath(); g.moveTo(7, 12); g.lineTo(25, 12); g.lineTo(28, S - 3); g.lineTo(4, S - 3); g.fill();
    // Hat
    g.fillStyle = '#1a0a4a';
    g.beginPath(); g.moveTo(16, 0); g.lineTo(22, 12); g.lineTo(10, 12); g.fill();
    g.fillStyle = '#2a0a7a'; g.fillRect(8, 11, 16, 3);
    // Staff
    g.strokeStyle = '#8b6020'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(24, 10); g.lineTo(26, S - 2); g.stroke();
    // Orb
    circle(g, 24, 9, 4, 'rgba(100,100,255,0.8)');
    circle(g, 23, 8, 2, 'rgba(150,150,255,0.6)');
}
function drawShaman(g, fc) {
    drawBody(g, 7, 8, '#2a4a22', '#88aa44');
    // Robe
    g.fillStyle = '#1a3a18';
    g.beginPath(); g.moveTo(7, 12); g.lineTo(25, 12); g.lineTo(27, S - 3); g.lineTo(5, S - 3); g.fill();
    // Headdress
    g.fillStyle = '#aa4400'; g.fillRect(10, 2, 12, 5);
    g.fillStyle = '#cc6600';
    [[11, 2], [14, 0], [17, 1], [20, 2]].forEach(([fx, fy]) => g.fillRect(fx, fy, 2, 4));
    // Staff + lightning
    g.strokeStyle = '#6a5010'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(24, 10); g.lineTo(26, S - 2); g.stroke();
    g.strokeStyle = '#ffff00'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(24, 9); g.lineTo(20, 13); g.lineTo(24, 16); g.lineTo(20, 19); g.stroke();
}
function drawPaladin(g, fc) {
    drawBody(g, 6, 7, '#ffd700', '#ffe8c0');
    // Armour details
    g.strokeStyle = '#c8a000'; g.lineWidth = 1;
    g.strokeRect(6.5, 7.5, 18, 10);
    // Cross emblem
    g.fillStyle = '#fff'; g.fillRect(13, 8, 4, 10); g.fillRect(8, 11, 14, 4);
    // Large helm
    g.fillStyle = '#d4aa00'; g.fillRect(10, 0, 12, 8);
    g.fillRect(9, 8, 14, 3);
    g.fillStyle = '#f0d060'; g.fillRect(12, 1, 8, 4);
    // Shield
    g.fillStyle = '#ffd700'; g.beginPath();
    g.moveTo(4, 9); g.lineTo(4, 20); g.lineTo(9, 24); g.lineTo(9, 10); g.fill();
    g.strokeStyle = '#c8a000'; g.lineWidth = 1; g.strokeRect(4.5, 9.5, 5, 14);
}
function drawBeastmaster(g, fc) {
    drawBody(g, 5, 7, '#882211', '#88aa44');
    // Big armour
    g.fillStyle = '#6a1a00'; g.fillRect(4, 8, 20, 12);
    g.strokeStyle = '#994400'; g.lineWidth = 1;
    g.strokeRect(4.5, 8.5, 19, 11);
    // Horned helm
    g.fillStyle = '#553311'; g.fillRect(8, 0, 14, 8);
    g.fillStyle = '#775533';
    // Horns
    g.beginPath(); g.moveTo(8, 2); g.lineTo(4, S * .25 - 8); g.lineTo(10, 4); g.fill();
    g.beginPath(); g.moveTo(22, 2); g.lineTo(S - 4, S * .25 - 8); g.lineTo(20, 4); g.fill();
    // Big axe
    g.strokeStyle = '#bbb'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(S - 4, 13); g.lineTo(S - 6, S - 2); g.stroke();
    g.fillStyle = '#999';
    g.beginPath(); g.moveTo(S - 3, 8); g.lineTo(S + 2, 14); g.lineTo(S - 8, 16); g.fill();
}

// ─── BUILDING SPRITES ──────────────────────────────────────────────────────
// Sync version (no dynamic import needed)
export function makeBuildingSpriteSync(bKey, factionColor, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const fc = factionColor;
    switch (bKey) {
        case 'town_hall': drawTownHall(g, fc, false); break;
        case 'keep': drawTownHall(g, fc, true); break;
        case 'castle': drawCastle(g, fc); break;
        case 'great_hall': drawGreatHall(g, fc, false); break;
        case 'stronghold': drawGreatHall(g, fc, true); break;
        case 'fortress': drawFortress(g, fc); break;
        case 'barracks':
        case 'orc_barracks': drawBarracks(g, fc, bKey === 'orc_barracks'); break;
        case 'farm':
        case 'pig_farm': drawFarm(g, fc, bKey === 'pig_farm'); break;
        case 'blacksmith':
        case 'forge': drawSmith(g, fc, bKey === 'forge'); break;
        case 'tower':
        case 'watch_tower': drawTower(g, fc, bKey === 'watch_tower'); break;
        case 'mage_tower':
        case 'altar': drawMageTower(g, fc, bKey === 'altar'); break;
        case 'wall':
        case 'orc_wall': drawWall(g, fc, bKey === 'orc_wall'); break;
        default:
            g.fillStyle = fc; g.fillRect(0, 0, w, h);
            g.strokeStyle = '#000'; g.strokeRect(0, 0, w, h);
    }
    return c;
}

function drawTownHall(g, fc, isKeep) {
    const W = S * 4, H = S * 4;
    // Foundation
    g.fillStyle = '#7a6040'; g.fillRect(4, 20, W - 8, H - 22);
    // Main building
    g.fillStyle = isKeep ? '#8888aa' : '#6688aa';
    g.fillRect(8, 14, W - 16, H - 18);
    // Walls
    g.fillStyle = '#aabbcc'; g.fillRect(8, 14, 6, H - 18); g.fillRect(W - 14, 14, 6, H - 18);
    // Tower tops
    g.fillStyle = isKeep ? '#9999bb' : '#7799bb';
    g.fillRect(4, 8, 12, 12); g.fillRect(W - 16, 8, 12, 12);
    // Battlements
    g.fillStyle = '#ccddee';
    for (let i = 0; i < 3; i++) { g.fillRect(4 + i * 4, 4, 3, 5); g.fillRect(W - 16 + i * 4, 4, 3, 5); }
    // Roof
    g.fillStyle = '#8b0000';
    g.beginPath(); g.moveTo(W / 2, 2); g.lineTo(W - 10, 20); g.lineTo(10, 20); g.fill();
    g.fillStyle = '#aa0000';
    g.beginPath(); g.moveTo(W / 2, 2); g.lineTo(W / 2 + 6, 20); g.lineTo(W / 2 - 6, 20); g.fill();
    // Banner
    g.fillStyle = fc; g.fillRect(W / 2 - 2, 2, 4, 18);
    // Gate
    g.fillStyle = '#1a0e00'; g.fillRect(W / 2 - 6, H - 18, 12, 18);
    g.fillStyle = '#2a1800'; g.fillRect(W / 2 - 4, H - 16, 8, 14);
    // Windows
    g.fillStyle = 'rgba(200,180,100,0.5)';
    [[W / 2 - 14, 22], [W / 2 + 8, 22], [W / 2 - 14, 36], [W / 2 + 8, 36]].forEach(([wx, wy]) => {
        g.beginPath(); g.arc(wx + 3, wy + 5, 4, 0, Math.PI * 2); g.fill();
    });
    if (isKeep) {
        g.strokeStyle = '#ccddee'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(2, 20); g.lineTo(W - 2, 20); g.stroke();
    }
}

function drawCastle(g, fc) {
    drawTownHall(g, fc, true);
    // Extra towers on top
    g.fillStyle = '#99aacc';
    g.fillRect(0, 4, 10, 16); g.fillRect(S * 4 - 10, 4, 10, 16);
    g.fillStyle = '#ccddef';
    for (let i = 0; i < 2; i++) { g.fillRect(i * 4, 0, 3, 5); g.fillRect(S * 4 - 8 + i * 4, 0, 3, 5); }
    // Gold flag
    g.fillStyle = '#ffd700'; g.fillRect(S * 2 - 2, 0, 4, 14);
    g.beginPath(); g.moveTo(S * 2 + 2, 0); g.lineTo(S * 2 + 10, 6); g.lineTo(S * 2 + 2, 10); g.fill();
}

function drawGreatHall(g, fc, isSh) {
    const W = S * 4, H = S * 4;
    g.fillStyle = '#5a4030'; g.fillRect(4, 20, W - 8, H - 22);
    g.fillStyle = isSh ? '#664422' : '#553311'; g.fillRect(8, 16, W - 16, H - 18);
    // Skulls/bones decoration
    g.fillStyle = '#cc2200';
    g.fillRect(8, 16, 6, H - 18); g.fillRect(W - 14, 16, 6, H - 18);
    g.fillStyle = isSh ? '#7a5535' : '#664422';
    g.fillRect(4, 10, 12, 12); g.fillRect(W - 16, 10, 12, 12);
    // Spikes on top
    g.fillStyle = '#444';
    for (let i = 0; i < 5; i++) {
        const sx = 6 + i * 10;
        g.beginPath(); g.moveTo(sx, 2); g.lineTo(sx + 4, 12); g.lineTo(sx + 8, 2); g.fill();
    }
    // Fire/lava roof
    g.fillStyle = '#cc2200';
    g.beginPath(); g.moveTo(W / 2, 4); g.lineTo(W - 8, 18); g.lineTo(8, 18); g.fill();
    g.fillStyle = '#ff5500';
    for (let i = 0; i < 5; i++) {
        const fx = 10 + i * 16, fr = 5 + i % 2 * 2;
        g.beginPath(); g.ellipse(fx, 18, fr, fr * .6, 0, 0, Math.PI * 2); g.fill();
    }
    // Banner
    g.fillStyle = fc; g.fillRect(W / 2 - 2, 4, 4, 14);
    // Gate with dark arch
    g.fillStyle = '#0a0500'; g.fillRect(W / 2 - 7, H - 18, 14, 18);
    g.beginPath(); g.arc(W / 2, H - 18, 7, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(255,60,0,0.3)';
    g.beginPath(); g.arc(W / 2, H - 18, 5, Math.PI, 0); g.fill();
}

function drawFortress(g, fc) {
    drawGreatHall(g, fc, true);
    g.fillStyle = '#441100';
    g.fillRect(0, 6, 10, 18); g.fillRect(S * 4 - 10, 6, 10, 18);
    g.fillStyle = '#aa0000';
    for (let i = 0; i < 2; i++) { g.fillRect(i * 4, 2, 3, 5); g.fillRect(S * 4 - 8 + i * 4, 2, 3, 5); }
    g.fillStyle = '#ff3300'; g.fillRect(S * 2 - 2, 2, 4, 12);
    g.beginPath(); g.moveTo(S * 2 + 2, 2); g.lineTo(S * 2 + 10, 7); g.lineTo(S * 2 + 2, 10); g.fill();
}

function drawBarracks(g, fc, isOrc) {
    const W = S * 3, H = S * 3;
    g.fillStyle = isOrc ? '#5a3010' : '#447799'; g.fillRect(4, 16, W - 8, H - 18);
    g.fillStyle = isOrc ? '#442208' : '#336688'; g.fillRect(0, 12, W, 8);
    // Roof
    g.fillStyle = isOrc ? '#330000' : '#224488';
    g.beginPath(); g.moveTo(W / 2, 2); g.lineTo(W + 2, 14); g.lineTo(-2, 14); g.fill();
    g.fillStyle = fc; g.fillRect(W / 2 - 2, 2, 4, 12);
    // Door
    g.fillStyle = '#2a1a00'; g.fillRect(W / 2 - 6, H - 16, 12, 16);
    g.beginPath(); g.arc(W / 2, H - 16, 6, Math.PI, 0); g.fill();
    // Windows
    g.fillStyle = 'rgba(200,180,100,0.4)';
    [[10, 20], [W - 18, 20]].forEach(([wx, wy]) => {
        g.fillRect(wx, wy, 8, 8);
        g.strokeStyle = '#444'; g.lineWidth = 1; g.strokeRect(wx + .5, wy + .5, 7, 7);
    });
    // Crossed swords emblem
    g.strokeStyle = '#ccc'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(W / 2 - 8, 8); g.lineTo(W / 2 + 8, 14); g.stroke();
    g.beginPath(); g.moveTo(W / 2 + 8, 8); g.lineTo(W / 2 - 8, 14); g.stroke();
}

function drawFarm(g, fc, isPig) {
    const W = S * 2, H = S * 2;
    // Ground
    g.fillStyle = '#5a8040'; g.fillRect(0, 0, W, H);
    // Field rows
    g.strokeStyle = '#4a7030'; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        g.beginPath(); g.moveTo(0, 10 + i * 12); g.lineTo(W, 10 + i * 12); g.stroke();
    }
    // Silo
    g.fillStyle = '#cc8822'; g.fillRect(34, 4, 14, H - 6);
    g.fillStyle = '#bb7712';
    g.beginPath(); g.arc(41, 4, 7, Math.PI, 0); g.fill();
    if (isPig) {
        // Pig pen
        g.strokeStyle = '#8b6020'; g.lineWidth = 2;
        g.strokeRect(4, 4, 28, H - 8);
        g.fillStyle = '#ff88aa'; g.beginPath(); g.ellipse(12, 20, 5, 4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ff9988'; g.beginPath(); g.ellipse(12, 18, 3, 2.5, 0, 0, Math.PI * 2); g.fill();
    } else {
        // Crops
        g.fillStyle = '#aacc22';
        for (let r = 0; r < 3; r++) for (let ci = 0; ci < 3; ci++)
            g.fillRect(6 + ci * 10, 12 + r * 12, 4, 8);
    }
}

function drawSmith(g, fc, isForge) {
    const W = S * 2, H = S * 2;
    g.fillStyle = isForge ? '#442200' : '#557799'; g.fillRect(0, 8, W, H - 8);
    // Roof
    g.fillStyle = isForge ? '#330000' : '#446688';
    g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W + 2, 10); g.lineTo(-2, 10); g.fill();
    // Chimney with smoke
    g.fillStyle = '#555'; g.fillRect(40, 0, 8, 14);
    // (Smoke drawn in game loop)
    // Anvil
    g.fillStyle = '#888'; g.fillRect(8, 28, 20, 8);
    g.fillRect(12, 20, 12, 10);
    // Fire glow
    g.fillStyle = 'rgba(255,100,0,0.6)'; g.beginPath(); g.arc(42, 14, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,200,0,0.5)'; g.beginPath(); g.arc(42, 14, 2, 0, Math.PI * 2); g.fill();
    // Door
    g.fillStyle = '#1a0a00'; g.fillRect(W / 2 - 5, H - 16, 10, 16);
}

function drawTower(g, fc, isWatch) {
    const W = S * 1, H = S * 2;
    g.fillStyle = '#7a7070'; g.fillRect(0, 8, W, H - 8);
    g.fillStyle = '#6a6060'; g.fillRect(2, 4, W - 4, H - 4);
    // Battlements
    g.fillStyle = '#9a9090';
    for (let i = 0; i < 2; i++) g.fillRect(i * 14 + 2, 0, 6, 8);
    // Arrow slit
    g.fillStyle = '#1a0a00'; g.fillRect(W / 2 - 1, H * .4, 2, 6);
    // Faction color flag
    g.fillStyle = fc; g.fillRect(W - 4, 2, 3, 10);
    if (isWatch) {
        g.fillStyle = '#8b6020'; g.fillRect(0, 4, W, 4);
    }
}

function drawMageTower(g, fc, isAltar) {
    const W = S * 2, H = S * 3;
    if (isAltar) {
        // Stone altar
        g.fillStyle = '#444'; g.fillRect(4, H - 16, W - 8, 14);
        g.fillStyle = '#333'; g.fillRect(0, H - 8, W, 8);
        // Flame columns
        g.fillStyle = 'rgba(255,80,0,0.8)';
        g.beginPath(); g.ellipse(8, H - 18, 4, 8, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(W - 8, H - 18, 4, 8, 0, 0, Math.PI * 2); g.fill();
        // Lightning orb
        g.fillStyle = 'rgba(100,100,255,0.7)'; g.beginPath(); g.arc(W / 2, 20, 14, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(200,200,255,0.5)'; g.beginPath(); g.arc(W / 2, 20, 8, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#ffff00'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(W / 2, 6); g.lineTo(W / 2 - 6, 20); g.lineTo(W / 2 + 4, 14); g.lineTo(W / 2 - 2, 28); g.stroke();
    } else {
        g.fillStyle = '#6655aa'; g.fillRect(6, 12, W - 12, H - 14);
        g.fillStyle = '#4444aa'; g.fillRect(0, 8, W, 8);
        g.fillStyle = '#8866cc'; g.fillRect(4, 4, W - 8, 6);
        // Pointed roof
        g.fillStyle = '#331166';
        g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W + 2, 10); g.lineTo(-2, 10); g.fill();
        // Orb on top
        g.fillStyle = 'rgba(100,200,255,0.8)'; g.beginPath(); g.arc(W / 2, 2, 5, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(200,230,255,0.5)'; g.beginPath(); g.arc(W / 2, 2, 3, 0, Math.PI * 2); g.fill();
        // Stars
        g.fillStyle = '#ffff88';
        [[W / 2 - 10, 20], [W / 2 + 10, 24], [W / 2, 32], [W / 2 - 8, 38], [W / 2 + 8, 40]].forEach(([sx, sy]) => {
            g.beginPath(); g.arc(sx, sy, 2, 0, Math.PI * 2); g.fill();
        });
        // Door arch
        g.fillStyle = '#1a0a00'; g.fillRect(W / 2 - 4, H - 14, 8, 14);
        g.beginPath(); g.arc(W / 2, H - 14, 4, Math.PI, 0); g.fill();
    }
}

function drawWall(g, fc, isOrc) {
    const W = S, H = S;
    g.fillStyle = isOrc ? '#5a4020' : '#888899'; g.fillRect(0, 0, W, H);
    // Battlements
    g.fillStyle = isOrc ? '#6a5030' : '#9999aa';
    for (let i = 0; i < 2; i++) g.fillRect(i * 18, 0, 10, 8);
    // Mortar lines
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 16); g.lineTo(W, 16); g.stroke();
    g.beginPath(); g.moveTo(16, 16); g.lineTo(16, H); g.stroke();
}

// ─── PROJECTILE SPRITES ─────────────────────────────────────────────────────
export function makeProjectileSprite(type) {
    const { c, g } = mk(12, 4);
    switch (type) {
        case 'arrow':
            g.fillStyle = '#8b6020'; g.fillRect(0, 1, 10, 2);
            g.fillStyle = '#ccc'; g.fillRect(9, 0, 3, 4);
            break;
        case 'fireball':
            g.fillStyle = 'rgba(255,100,0,0.9)'; g.beginPath(); g.arc(6, 2, 4, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(255,220,0,0.7)'; g.beginPath(); g.arc(5, 2, 2, 0, Math.PI * 2); g.fill();
            break;
        case 'lightning':
            g.strokeStyle = '#ffff00'; g.lineWidth = 2;
            g.beginPath(); g.moveTo(0, 2); g.lineTo(4, 0); g.lineTo(6, 4); g.lineTo(10, 1); g.lineTo(12, 2); g.stroke();
            break;
        default:
            g.fillStyle = '#ccc'; g.beginPath(); g.arc(6, 2, 3, 0, Math.PI * 2); g.fill();
    }
    return c;
}
