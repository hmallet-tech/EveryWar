// js/world/TileMap.js – 2D tile grid with pathfinding support
import { TILE, TILE_SIZE } from '../constants.js';
import { MapConfig } from '../mapConfig.js';

export class TileMap {
    constructor() {
        const W = MapConfig.W, H = MapConfig.H;
        this.w = W;
        this.h = H;
        // tiles[y][x] = { type, variant, goldLeft, hasTree }
        this.tiles = Array.from({ length: H }, () =>
            Array.from({ length: W }, () => ({ type: TILE.GRASS, variant: 0, goldLeft: 0, woodLeft: 0, hasTree: true }))
        );
        // pathfinding cost grid (0 = impassable)
        this.passable = new Uint8Array(W * H);
        this.moveCost = new Float32Array(W * H);
        // which tiles have occupants (for collision)
        this.occupied = new Int32Array(W * H).fill(-1); // entity id or -1
    }

    setTile(tx, ty, type, variant = 0) {
        if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
        const t = this.tiles[ty][tx];
        t.type = type;
        t.variant = variant;
        const idx = ty * this.w + tx;
        if (type === TILE.WATER || type === TILE.DEEP_WATER || type === TILE.MOUNTAIN) {
            this.passable[idx] = 0;
            this.moveCost[idx] = 999;
        } else if (type === TILE.FOREST) {
            this.passable[idx] = 1;
            this.moveCost[idx] = 2.0;
        } else {
            this.passable[idx] = 1;
            this.moveCost[idx] = 1.0;
        }
    }

    getTile(tx, ty) {
        if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return null;
        return this.tiles[ty][tx];
    }

    isPassable(tx, ty) {
        if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return false;
        return this.passable[ty * this.w + tx] === 1;
    }

    getCost(tx, ty) {
        if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return 999;
        return this.moveCost[ty * this.w + tx];
    }

    isOccupied(tx, ty) {
        if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return true;
        return this.occupied[ty * this.w + tx] !== -1;
    }

    setOccupied(tx, ty, entityId) {
        if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
        this.occupied[ty * this.w + tx] = entityId;
    }

    clearOccupied(tx, ty, entityId) {
        if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
        const idx = ty * this.w + tx;
        if (this.occupied[idx] === entityId) this.occupied[idx] = -1;
    }

    /** Block a rect of tiles (for buildings) */
    blockRect(tx, ty, tw, th, entityId) {
        for (let r = 0; r < th; r++) for (let c = 0; c < tw; c++) {
            const x = tx + c, y = ty + r;
            this.setOccupied(x, y, entityId);
            const idx = y * this.w + x;
            this.passable[idx] = 0;
            this.moveCost[idx] = 999;
        }
    }

    unblockRect(tx, ty, tw, th, entityId) {
        for (let r = 0; r < th; r++) for (let c = 0; c < tw; c++) {
            const x = tx + c, y = ty + r;
            const tile = this.getTile(x, y);
            if (!tile) continue;
            this.clearOccupied(x, y, entityId);
            const idx = y * this.w + x;
            if (tile.type !== TILE.WATER && tile.type !== TILE.DEEP_WATER && tile.type !== TILE.MOUNTAIN) {
                this.passable[idx] = 1;
                this.moveCost[idx] = tile.type === TILE.FOREST ? 2.0 : 1.0;
            }
        }
    }

    /** Find nearest passable tile to (tx,ty), max radius */
    findNearestPassable(tx, ty, radius = 5) {
        for (let r = 0; r <= radius; r++) {
            for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                if (this.isPassable(tx + dx, ty + dy) && !this.isOccupied(tx + dx, ty + dy))
                    return { tx: tx + dx, ty: ty + dy };
            }
        }
        return null;
    }

    /** Check if rect (tw x th) at (tx,ty) is free for building */
    canPlaceBuilding(tx, ty, tw, th) {
        for (let r = 0; r < th; r++) for (let c = 0; c < tw; c++) {
            const x = tx + c, y = ty + r;
            const t = this.getTile(x, y);
            if (!t) return false;
            if (t.type === TILE.WATER || t.type === TILE.DEEP_WATER || t.type === TILE.MOUNTAIN || t.type === TILE.GOLD_MINE) return false;
            if (this.isOccupied(x, y)) return false;
        }
        return true;
    }

    /** World pixel → tile */
    worldToTile(wx, wy) {
        return { tx: Math.floor(wx / TILE_SIZE), ty: Math.floor(wy / TILE_SIZE) };
    }

    /** Tile center → world pixel */
    tileCenter(tx, ty) {
        return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
    }

    /** Harvest a tree at tx,ty – takes 10 wood per trip, disappears at 0. */
    harvestTree(tx, ty, amount = 10) {
        const t = this.getTile(tx, ty);
        if (!t || t.type !== TILE.FOREST) return 0;
        if (!t.woodLeft || t.woodLeft <= 0) t.woodLeft = 100;
        const taken = Math.min(amount, t.woodLeft);
        t.woodLeft -= taken;
        if (t.woodLeft <= 0) {
            t.hasTree = false;
            t.type = TILE.GRASS;
            const idx = ty * this.w + tx;
            this.passable[idx] = 1;
            this.moveCost[idx] = 1.0;
        }
        return taken;
    }

    harvestGold(tx, ty, amount) {
        const t = this.getTile(tx, ty);
        if (!t || t.type !== TILE.GOLD_MINE) return 0;
        const taken = Math.min(amount, t.goldLeft);
        t.goldLeft -= taken;
        if (t.goldLeft <= 0) {
            t.type = TILE.MOUNTAIN;
            const idx = ty * this.w + tx;
            this.passable[idx] = 0;
            this.moveCost[idx] = 999;
        }
        return taken;
    }
}
