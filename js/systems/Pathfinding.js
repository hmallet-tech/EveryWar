// js/systems/Pathfinding.js – A* with binary heap priority queue
import { MAP_W, MAP_H } from '../constants.js';

// Binary min-heap keyed on f score
class Heap {
    constructor() { this.data = []; }
    push(node) {
        this.data.push(node);
        this._up(this.data.length - 1);
    }
    pop() {
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) { this.data[0] = last; this._down(0); }
        return top;
    }
    _up(i) {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.data[p].f <= this.data[i].f) break;
            [this.data[p], this.data[i]] = [this.data[i], this.data[p]]; i = p;
        }
    }
    _down(i) {
        const n = this.data.length;
        while (true) {
            let m = i, l = 2 * i + 1, r = 2 * i + 2;
            if (l < n && this.data[l].f < this.data[m].f) m = l;
            if (r < n && this.data[r].f < this.data[m].f) m = r;
            if (m === i) break;
            [this.data[m], this.data[i]] = [this.data[i], this.data[m]]; i = m;
        }
    }
    get size() { return this.data.length; }
}

const DIRS = [
    [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
    [-1, -1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [1, 1, 1.414]
];

export class Pathfinder {
    constructor(tileMap) {
        this.map = tileMap;
        this._gScore = new Float32Array(MAP_W * MAP_H);
        this._visited = new Uint8Array(MAP_W * MAP_H);
        this._parent = new Int32Array(MAP_W * MAP_H);
    }

    /** Find path from tile (sx,sy) to (ex,ey).
     *  Returns array of {tx,ty} waypoints, or null if no path.
     *  maxTiles = search budget to avoid hang on large maps.
     */
    find(sx, sy, ex, ey, maxTiles = 2000) {
        if (!this.map.isPassable(ex, ey)) {
            // Try nearest passable to target
            const alt = this.map.findNearestPassable(ex, ey, 4);
            if (!alt) return null;
            ex = alt.tx; ey = alt.ty;
        }
        if (sx === ex && sy === ey) return [];

        const g = this._gScore;
        const visited = this._visited;
        const parent = this._parent;
        g.fill(Infinity); visited.fill(0); parent.fill(-1);

        const startIdx = sy * MAP_W + sx;
        g[startIdx] = 0;
        const h = (tx, ty) => Math.sqrt((tx - ex) ** 2 + (ty - ey) ** 2);
        const heap = new Heap();
        heap.push({ f: h(sx, sy), tx: sx, ty: sy });

        let iters = 0;
        while (heap.size > 0 && iters++ < maxTiles) {
            const { tx, ty } = heap.pop();
            const idx = ty * MAP_W + tx;
            if (visited[idx]) continue;
            visited[idx] = 1;
            if (tx === ex && ty === ey) return this._reconstruct(ex, ey);

            for (const [dx, dy, dc] of DIRS) {
                const nx = tx + dx, ny = ty + dy;
                if (!this.map.isPassable(nx, ny)) continue;
                const nidx = ny * MAP_W + nx;
                if (visited[nidx]) continue;
                const ng = g[idx] + dc * this.map.getCost(nx, ny);
                if (ng < g[nidx]) {
                    g[nidx] = ng;
                    parent[nidx] = idx;
                    heap.push({ f: ng + h(nx, ny), tx: nx, ty: ny });
                }
            }
        }
        // No path found – return direct line attempt
        return null;
    }

    _reconstruct(ex, ey) {
        const path = [];
        let idx = ey * MAP_W + ex;
        while (idx >= 0 && this._parent[idx] !== -1) {
            path.push({ tx: idx % MAP_W, ty: Math.floor(idx / MAP_W) });
            idx = this._parent[idx];
        }
        path.reverse();
        // Smooth path: remove collinear points
        return this._smooth(path);
    }

    _smooth(path) {
        if (path.length <= 2) return path;
        const out = [path[0]];
        let i = 0;
        while (i < path.length - 1) {
            // try to jump ahead
            let j = path.length - 1;
            while (j > i + 1) {
                if (this._lineOfSight(path[i].tx, path[i].ty, path[j].tx, path[j].ty)) break;
                j--;
            }
            out.push(path[j]);
            i = j;
        }
        return out;
    }

    _lineOfSight(x0, y0, x1, y1) {
        let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
        let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        while (true) {
            if (!this.map.isPassable(x0, y0)) return false;
            if (x0 === x1 && y0 === y1) return true;
            const e2 = err * 2;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
    }
}
