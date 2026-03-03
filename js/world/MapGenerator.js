// js/world/MapGenerator.js – Procedural map generation with noise
import { TILE } from '../constants.js';
import { MapConfig } from '../mapConfig.js';

// Simple Perlin-like noise via value noise + interpolation
function lerp(a, b, t) { return a + t * (b - a); }
function smoothstep(t) { return t * t * (3 - 2 * t); }

class ValueNoise {
    constructor(seed = 42) {
        this.perm = new Uint8Array(512);
        let s = seed;
        const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return ((s >>> 0) / 0xffffffff); };
        const p = Array.from({ length: 256 }, (_, i) => i);
        for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[p[i], p[j]] = [p[j], p[i]]; }
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    grad(hash, x, y) {
        const h = hash & 3; const u = h < 2 ? x : y; const v = h < 2 ? y : x;
        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }
    noise(x, y) {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
        x -= Math.floor(x); y -= Math.floor(y);
        const u = this.fade(x), v = this.fade(y);
        const a = this.perm[X] + Y, b = this.perm[X + 1] + Y;
        return lerp(
            lerp(this.grad(this.perm[a], x, y), this.grad(this.perm[b], x - 1, y), u),
            lerp(this.grad(this.perm[a + 1], x, y - 1), this.grad(this.perm[b + 1], x - 1, y - 1), u),
            v
        );
    }
    octave(x, y, octs = 4, freq = 0.03, amp = 1) {
        let v = 0, a = amp, f = freq, max = 0;
        for (let i = 0; i < octs; i++) { v += this.noise(x * f, y * f) * a; max += a; a *= .5; f *= 2; }
        return v / max;
    }
}

export function generateMap(map, type = 'random', seed) {
    const s = seed || Math.floor(Math.random() * 100000);
    const noise = new ValueNoise(s);
    const W = MapConfig.W, H = MapConfig.H;

    // Generate heightmap
    const h = new Float32Array(W * H);
    const m = new Float32Array(W * H); // moisture

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        h[y * W + x] = noise.octave(x, y, 5, 0.025, 1);
        m[y * W + x] = noise.octave(x + 1000, y + 1000, 4, 0.04, 1);
    }

    if (type === 'islands') {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
            const mask = 1 - Math.min(1, (dx * dx + dy * dy) * 1.2);
            h[y * W + x] = h[y * W + x] * mask - 0.05;
        }
    } else if (type === 'highlands') {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            h[idx] += 0.25;
            h[idx] += noise.octave(x, y, 3, 0.07, 0.35);
            const perpDist = Math.abs((y - x) / Math.sqrt(2));
            if (perpDist < 14) {
                h[idx] = Math.min(h[idx], 0.55);
            }
        }
    }

    // Convert height/moisture to tiles
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ht = h[y * W + x], ms = m[y * W + x];
        let ttype, variant = Math.floor(Math.abs(noise.noise(x * .7, y * .7) * 3));
        if (type === 'highlands') {
            if (ht < 0.05) ttype = TILE.GRASS;
            else if (ht < 0.1) ttype = (ms > 0.2) ? TILE.FOREST : TILE.GRASS;
            else if (ht < 0.48) ttype = (ms > 0.12) ? TILE.FOREST : TILE.GRASS;
            else if (ht < 0.62) ttype = TILE.GRASS;
            else ttype = TILE.MOUNTAIN;
        } else {
            if (ht < -0.15) ttype = TILE.DEEP_WATER;
            else if (ht < 0.0) ttype = TILE.WATER;
            else if (ht < 0.05) ttype = (ms > 0) ? TILE.SAND : TILE.GRASS;
            else if (ht < 0.45) ttype = (ms > 0.1) ? TILE.FOREST : TILE.GRASS;
            else if (ht < 0.65) ttype = TILE.GRASS;
            else ttype = TILE.MOUNTAIN;
        }
        map.setTile(x, y, ttype, variant % 3);
    }

    // Place starting areas — adapt spawn positions to map size
    const starts = [
        { tx: 8, ty: 8 },
        { tx: W - 12, ty: H - 12 }
    ];
    for (const { tx, ty } of starts) {
        for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
            const x = tx + dx, y = ty + dy;
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            const t = map.getTile(x, y);
            if (t.type !== TILE.GRASS) map.setTile(x, y, TILE.GRASS, (Math.abs(dx + dy)) % 3);
        }

        const mx = tx + 6, my = ty + 1;
        map.setTile(mx, my, TILE.GOLD_MINE);
        const gt = map.getTile(mx, my);
        gt.goldLeft = 20000;

        _placeForestPatch(map, tx - 1, ty - 4, 4, 3);
        _placeForestPatch(map, tx + 4, ty + 6, 5, 3);
    }

    // Extra gold mines
    const mineCount = 6;
    const rng = new ValueNoise(s + 1);
    for (let i = 0; i < mineCount; i++) {
        const mx = Math.floor(20 + (rng.noise(i * .3, 0) * 0.5 + 0.5) * (W - 40));
        const my = Math.floor(20 + (rng.noise(0, i * .3) * 0.5 + 0.5) * (H - 40));
        const t = map.getTile(mx, my);
        if (t && t.type === TILE.GRASS && !t.goldLeft) {
            map.setTile(mx, my, TILE.GOLD_MINE);
            t.goldLeft = 15000;
        }
    }

    return { spawn1: starts[0], spawn2: starts[1] };
}

/** Place a guaranteed forest patch, only overwriting grass tiles */
function _placeForestPatch(map, cx, cy, w, h) {
    const W = MapConfig.W, H = MapConfig.H;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const t = map.getTile(x, y);
        if (t && (t.type === TILE.GRASS || t.type === TILE.FOREST)) {
            map.setTile(x, y, TILE.FOREST, 0);
            t.woodLeft = 100;
        }
    }
}

