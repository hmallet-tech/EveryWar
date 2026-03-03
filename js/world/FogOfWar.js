// js/world/FogOfWar.js – Per-tile fog state tracking
import { FOG } from '../constants.js';
import { MapConfig } from '../mapConfig.js';

export class FogOfWar {
    constructor() {
        this.w = MapConfig.W;
        this.h = MapConfig.H;
        // 0=unexplored, 1=explored(dark), 2=visible
        this.state = new Uint8Array(this.w * this.h).fill(FOG.UNEXPLORED);
        this._dirty = true;
    }

    reset() {
        this.state.fill(FOG.UNEXPLORED);
        this._dirty = true;
    }

    getState(tx, ty) {
        if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return FOG.UNEXPLORED;
        return this.state[ty * this.w + tx];
    }

    isVisible(tx, ty) {
        return this.getState(tx, ty) === FOG.VISIBLE;
    }

    isExplored(tx, ty) {
        return this.getState(tx, ty) >= FOG.EXPLORED;
    }

    /** Update fog from a list of {wx,wy,sight} sight sources */
    update(sightSources) {
        for (let i = 0; i < this.state.length; i++) {
            if (this.state[i] === FOG.VISIBLE) this.state[i] = FOG.EXPLORED;
        }
        for (const { tx, ty, sight } of sightSources) {
            this._revealCircle(tx, ty, sight);
        }
        this._dirty = true;
    }

    _revealCircle(cx, cy, r) {
        const r2 = r * r;
        const minX = Math.max(0, cx - r);
        const maxX = Math.min(this.w - 1, cx + r);
        const minY = Math.max(0, cy - r);
        const maxY = Math.min(this.h - 1, cy + r);
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= r2) {
                this.state[y * this.w + x] = FOG.VISIBLE;
            }
        }
    }

    render(ctx, camera, tileSize) {
        const viewW = camera.viewW;
        const viewH = camera.viewH;

        const startTX = Math.max(0, Math.floor(camera.x / tileSize));
        const startTY = Math.max(0, Math.floor(camera.y / tileSize));
        const endTX = Math.min(this.w - 1, Math.ceil((camera.x + viewW) / tileSize));
        const endTY = Math.min(this.h - 1, Math.ceil((camera.y + viewH) / tileSize));

        for (let ty = startTY; ty <= endTY; ty++) {
            for (let tx = startTX; tx <= endTX; tx++) {
                const st = this.state[ty * this.w + tx];
                if (st === FOG.VISIBLE) continue;
                const sx = tx * tileSize - camera.x;
                const sy = ty * tileSize - camera.y;
                ctx.fillStyle = st === FOG.UNEXPLORED ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0.6)';
                ctx.fillRect(sx, sy, tileSize + 1, tileSize + 1);
            }
        }
    }
}


