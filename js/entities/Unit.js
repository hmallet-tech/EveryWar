// js/entities/Unit.js – Full unit with movement, combat, harvesting
import { Entity } from './Entity.js';
import { STATE, TILE_SIZE, HARVEST_CARRY, HARVEST_TICK, DEATH_TIME, FACTION } from '../constants.js';
import { UNITS } from '../data.js';

export class Unit extends Entity {
    constructor(unitKey, faction, wx, wy, researchBonuses = {}) {
        super('unit', faction, wx, wy);
        const data = UNITS[unitKey];
        this.unitKey = unitKey;
        this.label = data.label;
        this.icon = data.icon;

        // Stats (modified by research)
        this.maxHp = data.hp;
        this.hp = data.hp;
        this.dmg = data.dmg + (researchBonuses.dmg || 0);
        this.range = data.range + (researchBonuses.range || 0);
        this.speed = data.speed + (researchBonuses.speed || 0);
        this.sight = data.sight;
        this.armor = data.armor + (researchBonuses.armor || 0);
        this.attackRate = data.attackRate; // seconds between attacks
        this.projectile = data.projectile || null;
        this.splash = (data.splash || 0) + (researchBonuses.splash || 0);
        this.isWorker = data.isWorker || false;
        this.isHero = data.isHero || false;
        this.ability = data.ability || null;
        this.abilityCooldown = 0;

        // Movement
        this.vx = 0; this.vy = 0;
        this.path = [];
        this.pathIndex = 0;
        this.moveTarget = null; // {x,y} world pixel

        // Combat
        this.attackTarget = null; // entity ref
        this.attackCooldown = 0;
        this.attackMove = false; // attack-move mode

        // Harvesting
        this.harvestTarget = null;  // {tx,ty,type}
        this.returnTarget = null;   // building ref (Town Hall)
        this.carryGold = 0;
        this.carryWood = 0;
        this.harvestTimer = 0;

        // Hero XP
        this.xp = 0;
        this.level = 1;

        // Construction
        this.buildTarget = null; // Building being constructed

        // Flocking
        this.groupId = -1;  // control group
        this.flockOffset = { x: 0, y: 0 };

        // Visual
        this.deathAnim = 0;
        this.hitFlash = 0;
        this.wobble = Math.random() * Math.PI * 2; // phase offset for idle wobble
    }

    /** Issue move order to world pixel (wx,wy) */
    moveTo(wx, wy, path) {
        this.state = STATE.MOVING;
        this.path = path || [];
        this.pathIndex = 0;
        this.moveTarget = { x: wx, y: wy };
        this.attackTarget = null;
        this.harvestTarget = null;
        this.attackMove = false;
    }

    /** Issue attack-move (move then attack anything in range) */
    attackMoveTo(wx, wy, path) {
        this.moveTo(wx, wy, path);
        this.attackMove = true;
    }

    /** Issue attack order */
    attackEntity(target) {
        this.attackTarget = target;
        this.harvestTarget = null;
        this.attackMove = false;
        this.state = STATE.ATTACKING;
    }

    /** Begin construction of a building */
    startConstruct(building, path) {
        if (!this.isWorker) return;
        this.buildTarget = building;
        this.path = path || [];
        this.pathIndex = 0;
        this.moveTarget = { x: building.x, y: building.y };
        this.state = STATE.CONSTRUCTING;
        this.harvestTarget = null;
        this.attackTarget = null;
        this._pathTimer = 0; // force immediate path recalculation
    }

    /** Issue harvest order */
    harvest(resourceRef, returnBuilding) {
        if (!this.isWorker) return;
        this.harvestTarget = resourceRef; // {tx,ty,type}
        this.returnTarget = returnBuilding;
        this.harvestTimer = 0;
        this.state = STATE.HARVESTING;
        this.attackTarget = null;
    }

    stop() {
        // Release construction site if assigned
        if (this.buildTarget && this.buildTarget.builderRef === this) {
            this.buildTarget.builderRef = null;
        }
        this.buildTarget = null;
        this.path = [];
        this.pathIndex = 0;
        this.moveTarget = null;
        this.attackTarget = null;
        this.harvestTarget = null;
        this.attackMove = false;
        this.state = STATE.IDLE;
        this.vx = 0; this.vy = 0;
    }

    hold() {
        this.stop();
        this.state = STATE.HOLD;
    }

    update(dt, game) {
        if (this.dead) {
            this.deathTimer += dt;
            return;
        }

        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.abilityCooldown > 0) this.abilityCooldown -= dt;
        this.hitFlash = Math.max(0, this.hitFlash - dt * 4);

        switch (this.state) {
            case STATE.IDLE: this._updateIdle(dt, game); break;
            case STATE.MOVING: this._updateMoving(dt, game); break;
            case STATE.ATTACKING: this._updateAttacking(dt, game); break;
            case STATE.HARVESTING: this._updateHarvesting(dt, game); break;
            case STATE.RETURNING: this._updateReturning(dt, game); break;
            case STATE.HOLD: this._updateHold(dt, game); break;
            case STATE.CONSTRUCTING: this._updateConstructing(dt, game); break;
        }
    }

    _updateConstructing(dt, game) {
        const b = this.buildTarget;
        // Building finished or cancelled?
        if (!b || b.dead) {
            this.buildTarget = null;
            this.state = STATE.IDLE;
            return;
        }
        if (!b.isBuilding) {
            // Construction complete - free the worker
            if (b.builderRef === this) b.builderRef = null;
            this.buildTarget = null;
            this.state = STATE.IDLE;
            return;
        }

        // Check if already close enough to work (use building edge, not center)
        const buildRange = 32 * 2.5;
        // Distance to nearest edge of building rect
        const edgeX = Math.max(b.tx0 * 32, Math.min(this.x, (b.tx0 + b.tw) * 32));
        const edgeY = Math.max(b.ty0 * 32, Math.min(this.y, (b.ty0 + b.th) * 32));
        const edgeDist = Math.hypot(this.x - edgeX, this.y - edgeY);

        if (edgeDist <= buildRange) {
            // On site: stop and contribute to construction
            this.vx = 0; this.vy = 0;
            this.path = [];
            b.buildProgress += dt / b.buildTime; // worker doubles speed
            return;
        }

        // Need to move closer - use pathfinding to best adjacent tile
        this._pathTimer = (this._pathTimer || 0) - dt;
        if (this._pathTimer <= 0 || !this.path || this.pathIndex >= this.path.length) {
            this._pathTimer = 2.0;
            const adj = this._findBuildingSide(b, game);
            if (adj) {
                const path = game.pathfinder.find(this.tx, this.ty, adj.tx, adj.ty);
                if (path && path.length > 0) {
                    this.path = path;
                    this.pathIndex = 0;
                } else {
                    // No path found - try direct movement as fallback
                    this._moveTowards(adj.tx * 32 + 16, adj.ty * 32 + 16, dt, game);
                    return;
                }
            }
        }
        this._stepAlongPath(dt);
    }

    /** Find the nearest passable tile adjacent to a building */
    _findBuildingSide(b, game) {
        const candidates = [];
        const { tx0, ty0, tw, th } = b;
        // All tiles around the building perimeter
        for (let x = tx0 - 1; x <= tx0 + tw; x++) {
            candidates.push({ tx: x, ty: ty0 - 1 });      // top row
            candidates.push({ tx: x, ty: ty0 + th });    // bottom row
        }
        for (let y = ty0; y < ty0 + th; y++) {
            candidates.push({ tx: tx0 - 1, ty: y });      // left col
            candidates.push({ tx: tx0 + tw, ty: y });    // right col
        }
        // Pick the nearest passable tile to this worker
        let best = null, bestDist = Infinity;
        for (const c of candidates) {
            if (!game.tileMap.isPassable(c.tx, c.ty)) continue;
            const wx = c.tx * 32 + 16, wy = c.ty * 32 + 16;
            const d = Math.hypot(this.x - wx, this.y - wy);
            if (d < bestDist) { bestDist = d; best = c; }
        }
        return best;
    }

    _updateIdle(dt, game) {
        // Workers: auto-resume harvesting if they have a known target
        if (this.isWorker && this.harvestTarget && this.returnTarget && !this.returnTarget.dead) {
            const { tx, ty } = this.harvestTarget;
            const tile = game.tileMap.getTile(tx, ty);
            const stillHasResources = tile && (
                (this.harvestTarget.rtype === 'gold' && tile.goldLeft > 0) ||
                (this.harvestTarget.rtype === 'wood' && tile.type === 2)
            );
            if (stillHasResources) {
                this.state = STATE.HARVESTING;
                this.harvestTimer = 0;
                return;
            } else {
                this.harvestTarget = null; // resource depleted
            }
        }
        // Auto-attack nearby enemies if no orders
        const enemy = game.findNearestEnemy(this);
        if (enemy) {
            const dist = this._distTo(enemy);
            const rangePx = this.range * TILE_SIZE;
            if (dist <= rangePx) {
                this.attackEntity(enemy);
            }
        }
    }

    _updateHold(dt, game) {
        // Attack in range but don't move
        if (this.attackCooldown > 0) return;
        const enemy = game.findNearestEnemy(this);
        if (enemy && this._distTo(enemy) <= this.range * TILE_SIZE) {
            this._doAttack(enemy, game);
        }
    }

    _updateMoving(dt, game) {
        // Follow path
        if (this.path.length === 0 || this.pathIndex >= this.path.length) {
            this.state = STATE.IDLE;
            this.vx = 0; this.vy = 0;
            return;
        }
        const wp = this.path[this.pathIndex];
        const tx = wp.tx * TILE_SIZE + TILE_SIZE / 2;
        const ty = wp.ty * TILE_SIZE + TILE_SIZE / 2;
        const dx = tx - this.x, dy = ty - this.y;
        const distSq = dx * dx + dy * dy;
        const arrive = 3;
        if (distSq < arrive * arrive) {
            this.pathIndex++;
            if (this.pathIndex >= this.path.length) {
                this.state = STATE.IDLE;
                this.vx = 0; this.vy = 0;
                return;
            }
        } else {
            const d = Math.sqrt(distSq);
            this.vx = (dx / d) * this.speed;
            this.vy = (dy / d) * this.speed;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
        }

        // Attack-move: check for enemies nearby
        if (this.attackMove) {
            const enemy = game.findNearestEnemy(this);
            if (enemy && this._distTo(enemy) <= this.range * TILE_SIZE) {
                this.attackEntity(enemy);
                return;
            }
        }
    }

    _updateAttacking(dt, game) {
        if (!this.attackTarget || this.attackTarget.dead) {
            // Pick new target
            const enemy = game.findNearestEnemy(this);
            if (enemy) this.attackTarget = enemy;
            else { this.state = STATE.IDLE; return; }
        }
        const dist = this._distTo(this.attackTarget);
        const rangePx = this.range * TILE_SIZE;

        if (dist > rangePx + 8) {
            // Move towards target
            if (!this.moveTarget || this._targetMoved()) {
                const path = game.pathfinder.find(this.tx, this.ty, this.attackTarget.tx, this.attackTarget.ty);
                if (path) {
                    this.path = path;
                    this.pathIndex = 0;
                }
                this.moveTarget = { x: this.attackTarget.x, y: this.attackTarget.y };
            }
            this._stepAlongPath(dt);
        } else {
            this.vx = 0; this.vy = 0;
            if (this.attackCooldown <= 0) {
                this._doAttack(this.attackTarget, game);
            }
        }
    }

    _doAttack(target, game) {
        this.attackCooldown = this.attackRate;
        if (this.projectile) {
            game.spawnProjectile(this, target);
        } else {
            // Melee
            const dmg = Math.max(1, this.dmg);
            target.takeDamage(dmg);
            if (this.splash > 0) {
                // Splash damage
                game.entities.forEach(e => {
                    if (e !== target && !e.dead && e.faction !== this.faction) {
                        const d = Math.hypot(e.x - target.x, e.y - target.y);
                        if (d <= this.splash * TILE_SIZE) e.takeDamage(dmg * 0.5);
                    }
                });
            }
        }
    }

    _updateHarvesting(dt, game) {
        if (!this.harvestTarget) { this.state = STATE.IDLE; return; }
        const { tx, ty, rtype } = this.harvestTarget;
        const tcx = tx * TILE_SIZE + TILE_SIZE / 2;
        const tcy = ty * TILE_SIZE + TILE_SIZE / 2;
        const dist = Math.hypot(this.x - tcx, this.y - tcy);
        const harvestRange = TILE_SIZE * 1.5;

        if (dist > harvestRange) {
            // Move towards resource
            this._moveTowards(tcx, tcy, dt, game);
            return;
        }

        // Harvest action
        this.harvestTimer += dt;
        this.vx = 0; this.vy = 0;
        if (this.harvestTimer >= HARVEST_TICK) {
            this.harvestTimer = 0;
            const tile = game.tileMap.getTile(tx, ty);
            if (rtype === 'gold') {
                const taken = Math.min(HARVEST_CARRY, tile ? tile.goldLeft : 0);
                if (taken <= 0 || !tile || tile.goldLeft <= 0) {
                    this.harvestTarget = null; this.state = STATE.IDLE; return;
                }
                tile.goldLeft -= taken;
                this.carryGold = taken;
                if (tile.goldLeft <= 0) {
                    game.tileMap.setTile(tx, ty, 4); // stays as depleted
                }
            } else if (rtype === 'wood') {
                // Check if tree still has wood left
                const taken = game.tileMap.harvestTree(tx, ty, HARVEST_CARRY);
                if (taken <= 0) {
                    // Tile was exhausted or not a forest anymore
                    this.harvestTarget = null; this.state = STATE.IDLE; return;
                }
                this.carryWood = taken;
            }
            // Return to base
            this.state = STATE.RETURNING;
        }
    }

    _updateReturning(dt, game) {
        if (!this.returnTarget || this.returnTarget.dead) {
            // Find nearest friendly base
            this.returnTarget = game.findNearestBase(this.faction, this.x, this.y);
            if (!this.returnTarget) { this.state = STATE.IDLE; return; }
        }
        const dist = Math.hypot(this.x - this.returnTarget.x, this.y - this.returnTarget.y);
        if (dist < TILE_SIZE * 2.5) {
            // Deposit
            const eco = game.economy[this.faction];
            eco.gold += this.carryGold;
            eco.wood += this.carryWood;
            this.carryGold = 0;
            this.carryWood = 0;
            // Go back to harvest
            if (this.harvestTarget) {
                const { tx, ty, rtype } = this.harvestTarget;
                const t = game.tileMap.getTile(tx, ty);
                const stillHasGold = rtype === 'gold' && t && t.goldLeft > 0;
                // Wood: tile is still FOREST (woodLeft > 0 means tree still standing)
                const stillHasWood = rtype === 'wood' && t && t.type === 2; // TILE.FOREST = 2
                if (stillHasGold || stillHasWood) {
                    this.state = STATE.HARVESTING;
                    this.harvestTimer = 0;
                } else if (rtype === 'wood') {
                    // Find adjacent forest tile if this one is gone
                    const adj = this._findNearbyForest(game);
                    if (adj) {
                        this.harvestTarget = { tx: adj.tx, ty: adj.ty, rtype: 'wood' };
                        this.state = STATE.HARVESTING;
                        this.harvestTimer = 0;
                    } else {
                        this.state = STATE.IDLE;
                        this.harvestTarget = null;
                    }
                } else {
                    this.state = STATE.IDLE;
                    this.harvestTarget = null;
                }
            } else {
                this.state = STATE.IDLE;
            }
        } else {
            this._moveTowards(this.returnTarget.x, this.returnTarget.y, dt, game);
        }
    }

    /** Find nearest forest tile within 8 tiles */
    _findNearbyForest(game) {
        const myTx = this.tx, myTy = this.ty;
        let best = null, bestDist = Infinity;
        for (let dy = -8; dy <= 8; dy++) {
            for (let dx = -8; dx <= 8; dx++) {
                const tx = myTx + dx, ty = myTy + dy;
                const t = game.tileMap.getTile(tx, ty);
                if (t && t.type === 2) { // FOREST
                    const d = Math.abs(dx) + Math.abs(dy);
                    if (d < bestDist) { bestDist = d; best = { tx, ty }; }
                }
            }
        }
        return best;
    }

    _moveTowards(tx, ty, dt, game) {
        const dx = tx - this.x, dy = ty - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) return;
        this.vx = (dx / d) * this.speed;
        this.vy = (dy / d) * this.speed;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    _stepAlongPath(dt) {
        if (!this.path || this.pathIndex >= this.path.length) return;
        const wp = this.path[this.pathIndex];
        const tx = wp.tx * TILE_SIZE + TILE_SIZE / 2;
        const ty = wp.ty * TILE_SIZE + TILE_SIZE / 2;
        const dx = tx - this.x, dy = ty - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 3) { this.pathIndex++; return; }
        this.vx = (dx / d) * this.speed; this.vy = (dy / d) * this.speed;
        this.x += this.vx * dt; this.y += this.vy * dt;
    }

    _targetMoved() {
        if (!this.moveTarget || !this.attackTarget) return true;
        const dx = this.attackTarget.x - this.moveTarget.x;
        const dy = this.attackTarget.y - this.moveTarget.y;
        return dx * dx + dy * dy > TILE_SIZE * TILE_SIZE * 4;
    }

    _distTo(other) {
        return Math.hypot(this.x - other.x, this.y - other.y);
    }

    /** Activate hero ability */
    useAbility(game) {
        if (this.abilityCooldown > 0) return false;
        if (this.ability === 'heal') {
            // Heal nearby allies
            game.entities.forEach(e => {
                if (!e.dead && e.faction === this.faction && e.type === 'unit') {
                    const d = this._distTo(e);
                    if (d < TILE_SIZE * 5) e.heal(Math.round(e.maxHp * 0.25));
                }
            });
            this.abilityCooldown = 30;
            game.spawnEffect(this.x, this.y, 'heal');
            return true;
        }
        if (this.ability === 'summon_wolves') {
            // Summon 2 temporary wolves near hero
            for (let i = 0; i < 2; i++) {
                const wx = this.x + (i ? 1 : -1) * TILE_SIZE * 1.5;
                const unit = game.spawnUnit('footman', this.faction, wx, this.y);
                if (unit) { unit.deathTimer = -30; unit.maxHp = 80; unit.hp = 80; } // temp wolves
            }
            this.abilityCooldown = 40;
            game.spawnEffect(this.x, this.y, 'summon');
            return true;
        }
        return false;
    }

    get statusText() {
        if (this.state === STATE.CONSTRUCTING) return `🔨 En construction${this.buildTarget ? ` (${this.buildTarget.label})` : ''}`;
        if (this.state === STATE.HARVESTING) return `⛏ Récolt.${this.carryGold ? '🪙' : ''}${this.carryWood ? '🪵' : ''}`;
        if (this.state === STATE.RETURNING) return '🏠 Retour à la base';
        if (this.state === STATE.MOVING) return '🚶 En déplacement';
        if (this.state === STATE.ATTACKING) return `⚔ Attaque ${this.attackTarget?.label || ''}`;
        if (this.state === STATE.HOLD) return '✋ En garde';
        return '⏸ En attente';
    }
}
