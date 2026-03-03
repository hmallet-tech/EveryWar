// js/systems/Formation.js – Unit formation layouts
// Ctrl+F cycles: line → wedge → circle → scatter

export const FORMATION_TYPES = ['line', 'wedge', 'circle', 'scatter'];

/**
 * Compute formation offsets for N units around a centroid (cx,cy).
 * Returns array of {x,y} world-pixel offsets (relative to centroid).
 */
export function computeFormation(type, count, unitSize = 32) {
    const offsets = [];
    const gap = unitSize * 1.4;

    switch (type) {
        case 'line': {
            // Horizontal line, up to 8 wide, then next row
            const cols = Math.min(count, 8);
            for (let i = 0; i < count; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                offsets.push({
                    x: (col - (cols - 1) / 2) * gap,
                    y: row * gap
                });
            }
            break;
        }
        case 'wedge': {
            // V-shape / arrow pointing forward (north)
            let placed = 0;
            let row = 0;
            while (placed < count) {
                const inRow = row === 0 ? 1 : row * 2;
                const colsInRow = Math.min(inRow, count - placed);
                for (let c = 0; c < colsInRow; c++) {
                    offsets.push({
                        x: (c - (colsInRow - 1) / 2) * gap,
                        y: row * gap
                    });
                    placed++;
                    if (placed >= count) break;
                }
                row++;
            }
            break;
        }
        case 'circle': {
            if (count === 1) { offsets.push({ x: 0, y: 0 }); break; }
            // Inner ring then outer ring
            const innerCount = Math.min(count, 8);
            const outerCount = count - innerCount;
            const r1 = innerCount <= 1 ? 0 : gap * innerCount / (2 * Math.PI);
            for (let i = 0; i < innerCount; i++) {
                const angle = (i / innerCount) * Math.PI * 2;
                offsets.push({ x: Math.cos(angle) * r1, y: Math.sin(angle) * r1 });
            }
            if (outerCount > 0) {
                const r2 = r1 + gap * 1.5;
                for (let i = 0; i < outerCount; i++) {
                    const angle = (i / outerCount) * Math.PI * 2;
                    offsets.push({ x: Math.cos(angle) * r2, y: Math.sin(angle) * r2 });
                }
            }
            break;
        }
        case 'scatter':
        default: {
            // Random spread – just a grid with small random jitter
            const cols = Math.ceil(Math.sqrt(count));
            for (let i = 0; i < count; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                offsets.push({
                    x: (col - (cols - 1) / 2) * gap + (Math.random() - 0.5) * gap * 0.5,
                    y: (row - (cols - 1) / 2) * gap + (Math.random() - 0.5) * gap * 0.5
                });
            }
        }
    }
    return offsets;
}

/**
 * Issue a formation move order for selected units.
 * target = {x,y} world pixel (click point / centroid)
 */
export function moveInFormation(units, targetX, targetY, formationType, pathfinder, tileMap) {
    if (!units.length) return;
    const offsets = computeFormation(formationType, units.length);
    units.forEach((unit, i) => {
        const ox = offsets[i]?.x || 0;
        const oy = offsets[i]?.y || 0;
        const dx = Math.round((targetX + ox) / 32) * 32;
        const dy = Math.round((targetY + oy) / 32) * 32;
        const { tx: stx, ty: sty } = tileMap.worldToTile(unit.x, unit.y);
        const { tx: etx, ty: ety } = tileMap.worldToTile(dx, dy);
        const nearest = tileMap.findNearestPassable(etx, ety);
        if (!nearest) return;
        const path = pathfinder.find(stx, sty, nearest.tx, nearest.ty, 512);
        unit.moveTo(nearest.tx * 32 + 16, nearest.ty * 32 + 16, path);
        unit.flockOffset = { x: ox, y: oy }; // store for flocking
    });
}
