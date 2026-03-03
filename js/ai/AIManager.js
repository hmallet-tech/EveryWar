// js/ai/AIManager.js – Finite state machine AI for Orc/Human opponent
import { STATE, TILE_SIZE, AI_RATE, FACTION } from '../constants.js';
import { UNITS, BUILDINGS, FACTION_DATA, RESEARCH } from '../data.js';
import { canAfford } from '../systems/Economy.js';

const AI_STATE = { ECONOMY: 'economy', ATTACK: 'attack', DEFENSE: 'defense' };

export class AIManager {
    constructor(faction, difficulty, game) {
        this.faction = faction;
        this.difficulty = difficulty; // 'easy','normal','hard'
        this.game = game;
        this.state = AI_STATE.ECONOMY;
        this.thinkTimer = 0;
        this.thinkRate = AI_RATE[difficulty] / 1000; // convert ms→s
        this.attackTimer = 0;
        this.attackDelay = difficulty === 'easy' ? 300 : difficulty === 'normal' ? 200 : 120;
        this.rallyPoint = { x: 0, y: 0 };
        this.armySize = difficulty === 'easy' ? 5 : difficulty === 'normal' ? 8 : 12;
        this.armyTarget = null;

        // Resource multiplier (AI gets bonus on easy to be forgiving)
        this.goldMult = difficulty === 'easy' ? 1.5 : 1;
        this.workerTarget = difficulty === 'easy' ? 3 : difficulty === 'normal' ? 5 : 8;
    }

    update(dt) {
        this.thinkTimer += dt;
        if (this.thinkTimer < this.thinkRate) return;
        this.thinkTimer = 0;
        this._think();
    }

    _think() {
        const game = this.game;
        const eco = game.economy[this.faction];
        const fd = FACTION_DATA[this.faction];
        const myBuildings = game.entities.filter(e => e.faction === this.faction && e.type === 'building' && !e.dead && e.isComplete);
        const myUnits = game.entities.filter(e => e.faction === this.faction && e.type === 'unit' && !e.dead);
        const myWorkers = myUnits.filter(e => e.isWorker);
        const myArmy = myUnits.filter(e => !e.isWorker);
        const base = myBuildings.find(b => b.isBase);

        if (!base) return; // No base → we lost

        // Apply gold multiplier for easy mode
        if (this.goldMult > 1) {
            eco.gold = Math.round(eco.gold * this.goldMult * 0.1 + eco.gold * 0.9);
        }

        // === ECONOMY PHASE ===
        // 1. Train workers if needed
        if (myWorkers.length < this.workerTarget && eco.food < eco.foodMax) {
            base.queueItem(fd.workers[0], false, game);
        }

        // 2. Build farms if food is tight
        const foodRemaining = eco.foodMax - eco.food;
        if (foodRemaining <= 2) {
            this._buildBuilding(fd.farm, base, game, eco);
        }

        // 3. Assign idle workers to nearest resource
        myWorkers.filter(w => w.state === STATE.IDLE).forEach(w => {
            this._assignWorker(w, base, game);
        });

        // 4. Build barracks if no barracks yet
        const barracks = myBuildings.filter(b => b.bKey === fd.barracks);
        if (barracks.length === 0) {
            this._buildBuilding(fd.barracks, base, game, eco);
        }

        // 5. Train military units
        barracks.forEach(b => {
            if (b.queue.length < 2) {
                const unit = this._chooseMilitaryUnit(fd, game);
                if (unit) b.queueItem(unit, false, game);
            }
        });

        // 6. Build blacksmith if not present (normal/hard)
        if (this.difficulty !== 'easy') {
            const smith = myBuildings.find(b => b.bKey === fd.smith);
            if (!smith && barracks.length > 0) {
                this._buildBuilding(fd.smith, base, game, eco);
            }
            // Research upgrades
            if (smith && smith.isComplete) {
                for (const r of smith.researches) {
                    if (!game.research[this.faction][r] && !smith.queue.some(q => q.key === r)) {
                        smith.queueItem(r, true, game);
                        break;
                    }
                }
            }
        }

        // 7. Build tower if base is under threat (hard only)
        if (this.difficulty === 'hard') {
            const enemies = game.entities.filter(e => !e.dead && e.faction !== this.faction && e.faction !== 'neutral');
            const thread = enemies.some(e => Math.hypot(e.x - base.x, e.y - base.y) < TILE_SIZE * 15);
            if (thread) {
                this._buildBuilding(this.faction === 'human' ? 'tower' : 'watch_tower', base, game, eco);
            }
        }

        // === UPGRADE BASE ===
        if (base.upgradeTo && !base.queue.some(q => q.key === base.upgradeTo)) {
            const upData = BUILDINGS[base.upgradeTo];
            if (upData && canAfford(eco, upData.cost) && this.difficulty !== 'easy') {
                // TODO: implement building upgrade
            }
        }

        // === ATTACK LOGIC ===
        this.attackTimer += this.thinkRate;
        if (myArmy.length >= this.armySize || this.attackTimer > this.attackDelay) {
            if (myArmy.length >= Math.floor(this.armySize * 0.6)) {
                this._launchAttack(myArmy, game);
                this.attackTimer = 0;
            }
        }

        // === DEFENSE ===
        const enemiesNearBase = game.entities.filter(e =>
            !e.dead && e.faction !== this.faction && e.faction !== 'neutral' &&
            Math.hypot(e.x - base.x, e.y - base.y) < TILE_SIZE * 20
        );
        if (enemiesNearBase.length > 0 && myArmy.length > 0) {
            this.state = AI_STATE.DEFENSE;
            const defenders = myArmy.filter(u => u.state === STATE.IDLE || u.state === STATE.MOVING);
            defenders.forEach(u => {
                const target = enemiesNearBase[0];
                u.attackEntity(target);
            });
        } else if (this.state === AI_STATE.DEFENSE) {
            this.state = AI_STATE.ECONOMY;
        }
    }

    _chooseMilitaryUnit(fd, game) {
        const barracksKey = fd.barracks;
        const b = BUILDINGS[barracksKey];
        if (!b?.produces?.length) return null;
        // Simple choice: cycle between available units
        const prod = b.produces.filter(uk => {
            const ud = UNITS[uk];
            if (!ud) return false;
            if (ud.requires && !game.research[this.faction][ud.requires]) return false;
            const eco = game.economy[this.faction];
            return canAfford(eco, ud.cost) && eco.food < eco.foodMax;
        });
        if (!prod.length) return null;
        return prod[Math.floor(Math.random() * prod.length)];
    }

    _launchAttack(army, game) {
        // Find enemy base
        const enemy = game.entities.find(e => !e.dead && e.faction !== this.faction && e.faction !== 'neutral' && e.type === 'building' && e.isBase);
        if (!enemy) {
            // Attack anything
            const target = game.entities.find(e => !e.dead && e.faction !== this.faction && e.faction !== 'neutral');
            if (!target) return;
            army.forEach(u => u.attackEntity(target));
            return;
        }
        army.forEach((u, i) => {
            const offset = { x: (i % 3 - 1) * TILE_SIZE * 1.5, y: (Math.floor(i / 3) - 1) * TILE_SIZE * 1.5 };
            u.attackEntity(enemy);
        });
    }

    _buildBuilding(bKey, base, game, eco) {
        const data = BUILDINGS[bKey];
        if (!data || !canAfford(eco, data.cost)) return false;
        // Find placement spot near base
        const [tw, th] = data.size;
        const bx = base.tx0, by = base.ty0;
        for (let radius = 4; radius <= 12; radius++) {
            for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                const tx = bx + dx, ty = by + dy;
                if (game.tileMap.canPlaceBuilding(tx, ty, tw, th)) {
                    // Place building (with worker if available)
                    const b = game.placeBuilding(bKey, this.faction, tx, ty);
                    if (b) {
                        eco.gold -= (data.cost.gold || 0);
                        eco.wood -= (data.cost.wood || 0);
                        return true;
                    }
                }
            }
        }
        return false;
    }

    _assignWorker(worker, base, game) {
        // Search in a radius around worker instead of full map scan
        const wtx = worker.tx, wty = worker.ty;
        const SEARCH_R = 35;
        let bestMine = null, bestForest = null;
        let mineD = Infinity, forestD = Infinity;

        const x0 = Math.max(0, wtx - SEARCH_R), x1 = Math.min(127, wtx + SEARCH_R);
        const y0 = Math.max(0, wty - SEARCH_R), y1 = Math.min(127, wty + SEARCH_R);
        for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
                const t = game.tileMap.getTile(tx, ty);
                if (!t) continue;
                const d = Math.abs(tx - wtx) + Math.abs(ty - wty);
                if (t.type === 4 && t.goldLeft > 0 && d < mineD) { mineD = d; bestMine = { tx, ty, rtype: 'gold' }; }
                else if (t.type === 2 && d < forestD) { forestD = d; bestForest = { tx, ty, rtype: 'wood' }; }
            }
        }
        const target = bestMine || bestForest;
        if (target) worker.harvest(target, base);
    }
}
