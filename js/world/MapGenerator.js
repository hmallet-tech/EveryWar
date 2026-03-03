// js/world/MapGenerator.js – Procedural map generation with noise
import { TILE, MAP_W, MAP_H } from '../constants.js';

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

    // Generate heightmap
    const h = new Float32Array(MAP_W * MAP_H);
    const m = new Float32Array(MAP_W * MAP_H); // moisture

    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
        h[y * MAP_W + x] = noise.octave(x, y, 5, 0.025, 1);
        m[y * MAP_W + x] = noise.octave(x + 1000, y + 1000, 4, 0.04, 1);
    }

    // Island mask (fade edges to water)
    if (type === 'islands') {
        for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
            const dx = (x - MAP_W / 2) / (MAP_W / 2), dy = (y - MAP_H / 2) / (MAP_H / 2);
            const mask = 1 - Math.min(1, (dx * dx + dy * dy) * 1.2);
            h[y * MAP_W + x] = h[y * MAP_W + x] * mask - 0.05;
        }
    } else if (type === 'highlands') {
        // More mountains
        for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
            h[y * MAP_W + x] += noise.octave(x, y, 3, 0.08, 0.4);
        }
    }

    // Convert height/moisture to tiles
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
        const ht = h[y * MAP_W + x], ms = m[y * MAP_W + x];
        let ttype, variant = Math.floor(Math.abs(noise.noise(x * .7, y * .7) * 3));
        if (ht < -0.15) ttype = TILE.DEEP_WATER;
        else if (ht < 0.0) ttype = TILE.WATER;
        else if (ht < 0.05) ttype = (ms > 0) ? TILE.SAND : TILE.GRASS;
        else if (ht < 0.45) ttype = (ms > 0.1) ? TILE.FOREST : TILE.GRASS;
        else if (ht < 0.65) ttype = TILE.GRASS;
        else ttype = TILE.MOUNTAIN;
        map.setTile(x, y, ttype, variant % 3);
    }

    // Place starting areas (top-left and bottom-right quadrants) – ensure clear
    const starts = [
        { tx: 8, ty: 8 },
        { tx: MAP_W - 12, ty: MAP_H - 12 }
    ];
    for (const { tx, ty } of starts) {
        for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
            const x = tx + dx, y = ty + dy;
            if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) continue;
            const t = map.getTile(x, y);
            if (t.type !== TILE.GRASS) map.setTile(x, y, TILE.GRASS, (Math.abs(dx + dy)) % 3);
        }
        // Place gold mine nearby
        const mx = tx + 7, my = ty + 2;
        map.setTile(mx, my, TILE.GOLD_MINE);
        const gt = map.getTile(mx, my);
        gt.goldLeft = 2000;
        // Place forest patch
        for (let dy = -2; dy <= 2; dy++) for (let dx = 8; dx <= 14; dx++) {
            const ft = map.getTile(tx + dx, ty + dy);
            if (ft && ft.type === TILE.GRASS) map.setTile(tx + dx, ty + dy, TILE.FOREST, 0);
        }
    }

    // Extra gold mines scattered around
    const mineCount = 6;
    const rng = new ValueNoise(s + 1);
    for (let i = 0; i < mineCount; i++) {
        const mx = Math.floor(20 + (rng.noise(i * .3, 0) * 0.5 + 0.5) * (MAP_W - 40));
        const my = Math.floor(20 + (rng.noise(0, i * .3) * 0.5 + 0.5) * (MAP_H - 40));
        const t = map.getTile(mx, my);
        if (t && t.type === TILE.GRASS && !t.goldLeft) {
            map.setTile(mx, my, TILE.GOLD_MINE);
            t.goldLeft = 1500;
        }
    }

    return { spawn1: starts[0], spawn2: starts[1] };
}
