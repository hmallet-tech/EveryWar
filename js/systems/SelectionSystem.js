// js/systems/SelectionSystem.js – Unit selection, groups, drag-box
import { TILE_SIZE } from '../constants.js';

export class SelectionSystem {
    constructor() {
        this.selected = [];           // array of entity refs
        this.groups = {};           // 1-9: array of entity refs
        this.buildMode = null;         // {bKey, tw, th} if placing building
        this.commandMode = null;       // 'attack' | 'harvest' | null
    }

    clear() { this.selected.forEach(e => e.selected = false); this.selected = []; }

    select(entities) {
        this.clear();
        this.selected = entities.filter(e => !e.dead);
        this.selected.forEach(e => e.selected = true);
    }

    add(entity) {
        if (entity.dead || this.selected.includes(entity)) return;
        entity.selected = true;
        this.selected.push(entity);
    }

    remove(entity) {
        entity.selected = false;
        this.selected = this.selected.filter(e => e !== entity);
    }

    /** Select all units of same type currently visible on screen */
    selectSameTypeOnScreen(unitKey, entities, camera) {
        const matches = entities.filter(e =>
            !e.dead && e.type === 'unit' && e.unitKey === unitKey &&
            camera.isVisible(e.x - 16, e.y - 16, 32, 32)
        );
        this.select(matches);
    }

    /** Assign control group */
    assignGroup(num, entities) {
        this.groups[num] = entities.filter(e => !e.dead);
    }

    /** Recall control group */
    recallGroup(num) {
        const g = this.groups[num];
        if (!g) return null;
        const alive = g.filter(e => !e.dead);
        this.groups[num] = alive;
        if (alive.length) { this.select(alive); return alive; }
        return null;
    }

    /** Drag-box select: rect in screen coords */
    dragSelect(rect, entities, fogOfWar, camera, playerFaction) {
        const matches = entities.filter(e => {
            if (e.dead || e.faction !== playerFaction) return false;
            const sx = e.x - camera.x;
            const sy = e.y - camera.y;
            return sx >= rect.x && sx <= rect.x + rect.w &&
                sy >= rect.y && sy <= rect.y + rect.h;
        });
        // Prefer units over buildings
        const units = matches.filter(e => e.type === 'unit');
        const result = units.length ? units : matches;
        this.select(result);
        return result;
    }

    /** Get selection centroid in world coords */
    centroid() {
        if (!this.selected.length) return null;
        let sx = 0, sy = 0;
        this.selected.forEach(e => { sx += e.x; sy += e.y; });
        return { x: sx / this.selected.length, y: sy / this.selected.length };
    }

    get isSingle() { return this.selected.length === 1; }
    get isEmpty() { return this.selected.length === 0; }
    get hasUnits() { return this.selected.some(e => e.type === 'unit'); }
    get hasWorkers() { return this.selected.some(e => e.type === 'unit' && e.isWorker); }
    get onlyBuildings() { return this.selected.every(e => e.type === 'building'); }
    get first() { return this.selected[0] || null; }
}
