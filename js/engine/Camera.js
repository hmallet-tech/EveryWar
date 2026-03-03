// js/engine/Camera.js – Camera system with smooth scrolling + edge-pan
import { TILE_SIZE, MAP_W, MAP_H, CAM_SPEED, CAM_EDGE } from '../constants.js';

export class Camera {
    constructor(viewW, viewH) {
        this.x = 0; this.y = 0;
        this.viewW = viewW;
        this.viewH = viewH;
        this.maxX = MAP_W * TILE_SIZE - viewW;
        this.maxY = MAP_H * TILE_SIZE - viewH;
    }

    resize(w, h) {
        this.viewW = w; this.viewH = h;
        this.maxX = MAP_W * TILE_SIZE - w;
        this.maxY = MAP_H * TILE_SIZE - h;
        this.clamp();
    }

    update(dt, input) {
        const spd = CAM_SPEED * dt;
        const { keys, mousePos } = input;
        let dx = 0, dy = 0;

        // WASD / Arrows
        if (keys['ArrowLeft'] || keys['KeyA']) dx -= spd;
        if (keys['ArrowRight'] || keys['KeyD']) dx += spd;
        if (keys['ArrowUp'] || keys['KeyW']) dy -= spd;
        if (keys['ArrowDown'] || keys['KeyS']) dy += spd;

        // Edge scroll (only if mouse is inside the game canvas)
        if (mousePos && input.mouseInCanvas) {
            if (mousePos.x < CAM_EDGE) dx -= spd;
            if (mousePos.x > this.viewW - CAM_EDGE) dx += spd;
            if (mousePos.y < CAM_EDGE + 44) dy -= spd; // 44 = top-bar height
            if (mousePos.y > this.viewH - CAM_EDGE - 200) dy += spd; // 200 = bottom panel
        }

        this.x += dx;
        this.y += dy;
        this.clamp();
    }

    clamp() {
        this.x = Math.max(0, Math.min(this.x, this.maxX));
        this.y = Math.max(0, Math.min(this.y, this.maxY));
    }

    /** World → Screen pixel */
    toScreen(wx, wy) {
        return { x: wx - this.x, y: wy - this.y };
    }

    /** Screen pixel → World pixel */
    toWorld(sx, sy) {
        return { x: sx + this.x, y: sy + this.y };
    }

    /** Screen pixel → Tile coord */
    screenToTile(sx, sy) {
        const wx = sx + this.x;
        const wy = sy + this.y;
        return { tx: Math.floor(wx / TILE_SIZE), ty: Math.floor(wy / TILE_SIZE) };
    }

    /** Tile coord → screen pixel (top-left of tile) */
    tileToScreen(tx, ty) {
        return { x: tx * TILE_SIZE - this.x, y: ty * TILE_SIZE - this.y };
    }

    /** Is a world rect visible on screen? */
    isVisible(wx, wy, ww, wh) {
        return wx + ww > this.x && wx < this.x + this.viewW &&
            wy + wh > this.y && wy < this.y + this.viewH;
    }

    /** Center camera on world position */
    centerOn(wx, wy) {
        this.x = wx - this.viewW / 2;
        this.y = wy - this.viewH / 2;
        this.clamp();
    }
}
