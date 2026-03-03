// js/ui/Minimap.js – Renders 192x192 minimap on a separate canvas
import { MAP_W, MAP_H, FOG } from '../constants.js';
import { FACTION_COLOR } from '../data.js';

const MM = 192; // minimap canvas size

export class Minimap {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.scaleX = MM / MAP_W;
        this.scaleY = MM / MAP_H;
        this._imgData = null;
        this._dirty = true;
        this._lastFogUpdate = 0;

        canvas.addEventListener('mousedown', e => this._onClick(e));
        canvas.addEventListener('mousemove', e => {
            if (e.buttons === 1) this._onClick(e);
        });
    }

    _onClick(e) {
        const r = this.canvas.getBoundingClientRect();
        const mx = (e.clientX - r.left) / r.width;
        const my = (e.clientY - r.top) / r.height;
        const wx = mx * MAP_W * 32, wy = my * MAP_H * 32;
        this.game.camera.centerOn(wx, wy);
    }

    update(dt) {
        this._lastFogUpdate += dt;
        if (this._lastFogUpdate > 0.5) { this._dirty = true; this._lastFogUpdate = 0; }
    }

    render() {
        const ctx = this.ctx;
        const g = this.game;
        ctx.clearRect(0, 0, MM, MM);

        const sx = this.scaleX, sy = this.scaleY;

        // Draw terrain
        const fog = g.fog;
        const tm = g.tileMap;
        for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
            const st = fog.getState(tx, ty);
            if (st === FOG.UNEXPLORED) { continue; } // black = default canvas
            const tile = tm.getTile(tx, ty);
            if (!tile) continue;
            const colors = { 0: '#3a6632', 1: '#1a4a8a', 2: '#1e4a1e', 3: '#5a5a5a', 4: '#c8a000', 5: '#c8a864', 6: '#0e2e6a', 7: '#886644' };
            ctx.fillStyle = st === FOG.EXPLORED ? this._darken(colors[tile.type] || '#3a6632') : (colors[tile.type] || '#3a6632');
            ctx.fillRect(tx * sx, ty * sy, Math.ceil(sx) + 1, Math.ceil(sy) + 1);
        }

        // Draw entities
        g.entities.forEach(e => {
            if (e.dead) return;
            const etx = Math.floor(e.x / 32), ety = Math.floor(e.y / 32);
            const st = fog.getState(etx, ety);
            if (st !== FOG.VISIBLE) return;
            const px = e.x / 32 * sx, py = e.y / 32 * sy;
            if (e.type === 'building') {
                ctx.fillStyle = FACTION_COLOR[e.faction] || '#888';
                ctx.fillRect(px - 2, py - 2, e.tw * sx + 2, e.th * sy + 2);
            } else {
                ctx.fillStyle = FACTION_COLOR[e.faction] || '#888';
                ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
            }
        });

        // Camera viewport rect
        const cam = g.camera;
        const vx = (cam.x / 32) * sx, vy = (cam.y / 32) * sy;
        const vw = (cam.viewW / 32) * sx, vh = (cam.viewH / 32) * sy;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(vx, vy, vw, vh);
    }

    _darken(hex) {
        // Return semi-transparent darkened version
        return hex + '88';
    }
}
