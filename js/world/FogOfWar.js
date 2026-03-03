// js/world/FogOfWar.js – Per-tile fog state tracking
import { MAP_W, MAP_H, FOG } from '../constants.js';

export class FogOfWar {
    constructor() {
        this.w = MAP_W;
        this.h = MAP_H;
        // 0=unexplored, 1=explored(dark), 2=visible
        this.state = new Uint8Array(MAP_W * MAP_H).fill(FOG.UNEXPLORED);
        // offscreen canvas for fog rendering
        this._dirty = true;
    }

    reset() {
        this.state.fill(FOG.UNEXPLORED);
        this._dirty = true;
    }

    getState(tx, ty) {
        if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return FOG.UNEXPLORED;
        return this.state[ty * MAP_W + tx];
    }

    isVisible(tx, ty) {
        return this.getState(tx, ty) === FOG.VISIBLE;
    }

    isExplored(tx, ty) {
        return this.getState(tx, ty) >= FOG.EXPLORED;
    }

    /** Update fog from a list of {wx,wy,sight} sight sources */
    update(sightSources) {
        // Reset all VISIBLE → EXPLORED
        for (let i = 0; i < this.state.length; i++) {
            if (this.state[i] === FOG.VISIBLE) this.state[i] = FOG.EXPLORED;
        }
        // Apply each sight source
        for (const { tx, ty, sight } of sightSources) {
            this._revealCircle(tx, ty, sight);
        }
        this._dirty = true;
    }

    _revealCircle(cx, cy, r) {
        const r2 = r * r;
        const minX = Math.max(0, cx - r);
        const maxX = Math.min(MAP_W - 1, cx + r);
        const minY = Math.max(0, cy - r);
        const maxY = Math.min(MAP_H - 1, cy + r);
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= r2) {
                this.state[y * MAP_W + x] = FOG.VISIBLE;
            }
        }
    }

    /** Pre-render the fog overlay to an offscreen canvas.
     *  Returns the canvas. Caller draws it over the game canvas.
     *  tileSize, offsetX, offsetY: camera-adjusted values
     */
    render(ctx, camera, tileSize) {
        const viewW = camera.viewW;
        const viewH = camera.viewH;

        // Determine tile range in view
        const startTX = Math.max(0, Math.floor(camera.x / tileSize));
        const startTY = Math.max(0, Math.floor(camera.y / tileSize));
        const endTX = Math.min(MAP_W - 1, Math.ceil((camera.x + viewW) / tileSize));
        const endTY = Math.min(MAP_H - 1, Math.ceil((camera.y + viewH) / tileSize));

        for (let ty = startTY; ty <= endTY; ty++) {
            for (let tx = startTX; tx <= endTX; tx++) {
                const st = this.state[ty * MAP_W + tx];
                if (st === FOG.VISIBLE) continue; // fully lit
                const sx = tx * tileSize - camera.x;
                const sy = ty * tileSize - camera.y;
                if (st === FOG.UNEXPLORED) {
                    ctx.fillStyle = 'rgba(0,0,0,1)';
                } else {
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                }
                ctx.fillRect(sx, sy, tileSize + 1, tileSize + 1);
            }
        }
    }
}
