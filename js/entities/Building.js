// js/entities/Building.js – Building class with production queue and construction
import { Entity } from './Entity.js';
import { STATE, TILE_SIZE, FACTION } from '../constants.js';
import { BUILDINGS, UNITS, RESEARCH } from '../data.js';

export class Building extends Entity {
    constructor(bKey, faction, tx, ty) {
        const data = BUILDINGS[bKey];
        const [tw, th] = data.size;
        const cx = (tx + tw / 2) * TILE_SIZE;
        const cy = (ty + th / 2) * TILE_SIZE;
        super('building', faction, cx, cy);

        this.bKey = bKey;
        this.label = data.label;
        this.icon = data.icon;
        this.tw = tw;
        this.th = th;
        this.tx0 = tx;  // top-left tile
        this.ty0 = ty;

        this.maxHp = data.hp;
        this.hp = data.hp;
        this.armor = data.armor;
        this.sight = data.sight;
        this.dmg = data.dmg || 0;
        this.range = data.range || 0;
        this.attackRate = data.attackRate || 2.0;
        this.attackCooldown = 0;
        this.projectile = data.projectile || null;
        this.isTower = data.isTower || false;
        this.isBase = data.isBase || false;
        this.isWall = data.isWall || false;
        this.foodBonus = data.foodBonus || 0;

        // Construction
        this.buildTime = data.buildTime || 30;
        this.buildProgress = 0; // 0..1
        this.isBuilding = true;
        this.builderRef = null;

        // Production queue
        this.queue = [];    // [{key,timer,total}]
        this.produces = data.produces || [];
        this.researches = data.researches || [];

        // Rally point in world pixels
        this.rallyX = cx + tw * TILE_SIZE * 0.6;
        this.rallyY = cy + th * TILE_SIZE * 0.6;

        // Upgrade path
        this.upgradeTo = data.upgrades?.[0] || null;
        this.upgradeOf = data.upgradeOf || null;
        this.isUpgrading = false;
        this.upgradeTimer = 0;
    }

    get isComplete() { return !this.isBuilding; }

    /** Called each frame */
    update(dt, game) {
        if (this.dead) { this.deathTimer += dt; return; }

        // Construction phase
        if (this.isBuilding) {
            this.buildProgress += dt / this.buildTime;
            if (this.buildProgress >= 1) {
                this.buildProgress = 1;
                this.isBuilding = false;
                // Register food bonus
                if (this.foodBonus) game.economy[this.faction].foodMax += this.foodBonus;
                game.onBuildingComplete(this);
            }
            return;
        }

        // Tower auto-attack
        if (this.isTower && this.attackCooldown <= 0) {
            const target = game.findNearestEnemyInRange(this, this.range * TILE_SIZE);
            if (target) {
                this.attackCooldown = this.attackRate;
                game.spawnProjectile(this, target);
            }
        }
        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        // Production queue
        if (this.queue.length > 0) {
            const item = this.queue[0];
            item.timer += dt;
            if (item.timer >= item.total) {
                this.queue.shift();
                game.onProductionComplete(this, item.key, item.isResearch);
            }
        }
    }

    /** Queue a unit or research */
    queueItem(key, isResearch, game) {
        const data = isResearch ? RESEARCH[key] : UNITS[key];
        if (!data) return false;
        const cost = data.cost;
        const eco = game.economy[this.faction];

        if (eco.gold < (cost.gold || 0) || eco.wood < (cost.wood || 0)) return false;
        if (!isResearch && eco.food >= eco.foodMax) return false;
        if (this.queue.length >= 5) return false;

        // Check research requirements
        if (isResearch && data.requires && !game.research[this.faction][data.requires]) return false;

        eco.gold -= (cost.gold || 0);
        eco.wood -= (cost.wood || 0);

        const food = isResearch ? 0 : (data.cost.food || 0);
        eco.food += food;

        this.queue.push({ key, timer: 0, total: data.trainTime || data.time || 20, isResearch, food });
        return true;
    }

    /** Cancel last item in queue */
    cancelLast(game) {
        if (this.queue.length === 0) return;
        const item = this.queue[this.queue.length - 1];
        const data = item.isResearch ? RESEARCH[item.key] : UNITS[item.key];
        if (data?.cost) {
            const eco = game.economy[this.faction];
            eco.gold += Math.round((data.cost.gold || 0) * 0.75);
            eco.wood += Math.round((data.cost.wood || 0) * 0.75);
            if (!item.isResearch) eco.food -= (item.food || 0);
        }
        this.queue.pop();
    }

    /** Set rally point */
    setRally(wx, wy) {
        this.rallyX = wx;
        this.rallyY = wy;
    }

    getQueueProgress() {
        if (this.queue.length === 0) return 0;
        return Math.min(1, this.queue[0].timer / this.queue[0].total);
    }

    /** Footprint tiles */
    * tiles() {
        for (let dy = 0; dy < this.th; dy++)
            for (let dx = 0; dx < this.tw; dx++)
                yield { tx: this.tx0 + dx, ty: this.ty0 + dy };
    }

    get statusText() {
        if (this.isBuilding) return `🔨 Construction ${Math.round(this.buildProgress * 100)}%`;
        if (this.queue.length) {
            const q = this.queue[0];
            const pct = Math.round(this.getQueueProgress() * 100);
            const isR = q.isResearch;
            const data = isR ? RESEARCH[q.key] : UNITS[q.key];
            return `${isR ? '🔬' : '⚔'} ${data?.label || q.key} ${pct}%`;
        }
        return '⏸ En attente';
    }
}
