// js/ui/Minimap.js – Renders 192x192 minimap on a separate canvas
import { FOG } from '../constants.js';
import { FACTION_COLOR } from '../data.js';
import { MapConfig } from '../mapConfig.js';

const MM = 192; // minimap canvas size

export class Minimap {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this._dirty = true;
        this._lastFogUpdate = 0;

        canvas.title = 'Cliquez pour centrer la vue';
        canvas.style.cursor = 'crosshair';

        canvas.addEventListener('mousedown', e => this._onClick(e));
        canvas.addEventListener('mousemove', e => {
            if (e.buttons === 1) this._onClick(e);
        });
    }

    get scaleX() { return MM / MapConfig.W; }
    get scaleY() { return MM / MapConfig.H; }

    _onClick(e) {
        const r = this.canvas.getBoundingClientRect();
        const mx = (e.clientX - r.left) / r.width;
        const my = (e.clientY - r.top) / r.height;
        const wx = mx * MapConfig.W * 32, wy = my * MapConfig.H * 32;
        this.game.camera.centerOn(wx, wy);
    }

    update(dt) {
        this._lastFogUpdate += dt;
        if (this._lastFogUpdate > 0.5) { this._dirty = true; this._lastFogUpdate = 0; }
    }

    render() {
        const ctx = this.ctx;
        const g = this.game;
        const sx = this.scaleX, sy = this.scaleY;
        const W = MapConfig.W, H = MapConfig.H;

        ctx.clearRect(0, 0, MM, MM);

        // Background (unexplored = very dark)
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, MM, MM);

        // Draw terrain
        const fog = g.fog;
        const tm = g.tileMap;
        const colors = { 0: '#3a6632', 1: '#1a4a8a', 2: '#1e4a1e', 3: '#5a5a5a', 4: '#c8a000', 5: '#c8a864', 6: '#0e2e6a', 7: '#886644' };
        for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
            const st = fog.getState(tx, ty);
            if (st === FOG.UNEXPLORED) continue;
            const tile = tm.getTile(tx, ty);
            if (!tile) continue;
            ctx.fillStyle = st === FOG.EXPLORED
                ? this._darken(colors[tile.type] || '#3a6632')
                : (colors[tile.type] || '#3a6632');
            ctx.fillRect(tx * sx, ty * sy, Math.ceil(sx) + 1, Math.ceil(sy) + 1);
        }

        // Draw entities
        g.entities.forEach(e => {
            if (e.dead) return;
            const etx = Math.floor(e.x / 32), ety = Math.floor(e.y / 32);
            if (fog.getState(etx, ety) !== FOG.VISIBLE) return;
            const px = e.x / 32 * sx, py = e.y / 32 * sy;
            const color = FACTION_COLOR[e.faction] || '#888';
            if (e.type === 'building') {
                ctx.fillStyle = color;
                ctx.fillRect(px - 1, py - 1, e.tw * sx + 2, e.th * sy + 2);
            } else {
                ctx.fillStyle = color;
                const r = e.isHero ? 2.5 : 1.8;
                ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
            }
        });

        // Camera viewport rect
        const cam = g.camera;
        const vx = (cam.x / 32) * sx, vy = (cam.y / 32) * sy;
        const vw = (cam.viewW / 32) * sx, vh = (cam.viewH / 32) * sy;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(vx, vy, vw, vh);

        // Border
        ctx.strokeStyle = 'rgba(200,150,0,0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, MM - 2, MM - 2);
    }

    _darken(hex) {
        return hex + '88';
    }
}
