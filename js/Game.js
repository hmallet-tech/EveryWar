// js/Game.js – Main game orchestrator
import { Camera } from './engine/Camera.js';
import { Input } from './engine/Input.js';
import { makeTileSprites, makeUnitSprite, makeBuildingSpriteSync, makeProjectileSprite } from './engine/Sprites.js';
import { TileMap } from './world/TileMap.js';
import { FogOfWar } from './world/FogOfWar.js';
import { generateMap } from './world/MapGenerator.js';
import { Pathfinder } from './systems/Pathfinding.js';
import { SelectionSystem } from './systems/SelectionSystem.js';
import { createEconomy } from './systems/Economy.js';
import { Unit } from './entities/Unit.js';
import { Building } from './entities/Building.js';
import { Projectile } from './entities/Projectile.js';
import { AIManager } from './ai/AIManager.js';
import { HUD } from './ui/HUD.js';
import { Minimap } from './ui/Minimap.js';
import { WeatherSystem, WEATHER_TYPE } from './systems/Weather.js';
import { FORMATION_TYPES, moveInFormation } from './systems/Formation.js';
import {
    playMeleeHit, playRangedHit, playDeath, playConstruct, playBuildComplete,
    playUnitReady, playGoldClink, playWoodChop, playAlert, playExplosion,
    playLightning, playResearch, playClick
} from './engine/Audio.js';
import {
    TILE_SIZE, MAP_W, MAP_H, FOG, STATE, FACTION, GAME_SPEEDS, COLOR,
    DEATH_TIME, BSIZE
} from './constants.js';
import { BUILDINGS, UNITS, RESEARCH, FACTION_DATA, FACTION_COLOR } from './data.js';
import { resetIds } from './entities/Entity.js';
import { MapConfig } from './mapConfig.js';

export class Game {
    constructor(canvas, playerFaction, aiDifficulty, mapType, enableWeather = true) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.playerFaction = playerFaction;
        this.aiFaction = playerFaction === 'human' ? 'orc' : 'human';
        this.aiDifficulty = aiDifficulty;
        this.mapType = mapType;
        this.enableWeather = enableWeather;

        this.running = false;
        this.paused = false;
        this.over = false;
        this.winner = null;
        this.speedIndex = 1; // index into GAME_SPEEDS
        this.elapsedTime = 0;
        this.stats = { playerKills: 0, aiKills: 0, goldMined: 0, woodMined: 0 };

        // Map / world
        this.tileMap = new TileMap();
        this.fog = new FogOfWar();
        this.tileSprites = makeTileSprites();
        this.projSprites = {};
        ['arrow', 'fireball', 'lightning'].forEach(t => {
            this.projSprites[t] = makeProjectileSprite(t);
        });

        // Pathfinding
        this.pathfinder = new Pathfinder(this.tileMap);

        // Economy
        this.economy = createEconomy();

        // Research state: faction → { resKey: true }
        this.research = {
            [playerFaction]: {},
            [this.aiFaction]: {}
        };

        // Entities
        this.entities = [];  // all entities (units + buildings)
        this.projectiles = [];
        this.effects = [];  // visual effects {x,y,type,timer}

        // Systems
        this.selection = new SelectionSystem();

        // Build mode
        this.buildMode = null; // { bKey, tw, th }
        this.buildPreview = { valid: false, tx: 0, ty: 0 };

        // Camera
        const W = canvas.width, H = canvas.height;
        this.camera = new Camera(W, H);
        this.input = new Input(canvas);

        // Preload unit/building sprites
        this.unitSprites = {};
        this.buildingSprites = {};
        this._preloadSprites();

        // UI
        this.hud = new HUD(this);
        this.minimap = new Minimap(document.getElementById('minimap-canvas'), this);

        // AI
        this.ai = null;

        // Event callback
        this.onGameOver = null;
        this.onAlert = null;

        // Control groups
        this._ctrlGroups = {};

        this._fogTimer = 0;

        // Weather
        this.weather = new WeatherSystem(canvas);
        this._weatherTimer = 0;
        this._nextWeatherIn = 90 + Math.random() * 60; // first event in 90-150s

        // Formation cycling
        this.formationIndex = 0; // index into FORMATION_TYPES

        // Voice alerts (Speech API)
        this._voiceAlerts = new Set();
        this._lastVoiceAlert = 0;
    }

    /** Text-to-speech alert (throttled to 1 per 8s per topic) */
    voiceAlert(text, topic = 'generic') {
        if (!window.speechSynthesis) return;
        const now = this.elapsedTime;
        const key = `${topic}_${Math.floor(now / 8)}`;
        if (this._voiceAlerts.has(key)) return;
        this._voiceAlerts.add(key);
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = 'fr-FR';
        utt.rate = 1.1;
        utt.volume = 0.8;
        speechSynthesis.speak(utt);
    }

    _preloadSprites() {
        const factions = ['human', 'orc'];
        factions.forEach(f => {
            const fc = FACTION_COLOR[f];
            Object.keys(UNITS).forEach(uk => {
                const key = `${uk}_${f}`;
                this.unitSprites[key] = makeUnitSprite(uk, fc);
            });
            Object.keys(BUILDINGS).forEach(bk => {
                const data = BUILDINGS[bk];
                const [tw, th] = data.size;
                const key = `${bk}_${f}`;
                this.buildingSprites[key] = makeBuildingSpriteSync(bk, fc, tw * TILE_SIZE, th * TILE_SIZE);
            });
        });
    }

    init() {
        resetIds();
        const { spawn1, spawn2 } = generateMap(this.tileMap, this.mapType);

        // Place player base
        const pfd = FACTION_DATA[this.playerFaction];
        const pb = this.placeBuilding(pfd.baseBuilding, this.playerFaction, spawn1.tx, spawn1.ty, true);
        // Spawn 3 workers near player base
        for (let i = 0; i < 3; i++) {
            const wx = (spawn1.tx + 2 + i) * TILE_SIZE + TILE_SIZE / 2;
            this.spawnUnit(pfd.workers[0], this.playerFaction, wx, (spawn1.ty + 5) * TILE_SIZE + TILE_SIZE / 2);
        }
        // Center camera on player base
        if (pb) this.camera.centerOn(pb.x, pb.y);

        // Auto-harvest: send player workers to nearest gold mine
        const playerMine = { tx: spawn1.tx + 7, ty: spawn1.ty + 2, rtype: 'gold' };
        const playerWorkers = this.entities.filter(e => e.faction === this.playerFaction && e.isWorker);
        playerWorkers.forEach(w => { if (pb) w.harvest(playerMine, pb); });

        // Place AI base
        const afd = FACTION_DATA[this.aiFaction];
        const ab = this.placeBuilding(afd.baseBuilding, this.aiFaction, spawn2.tx, spawn2.ty, true);
        // AI workers
        const aiWorkers = [];
        for (let i = 0; i < 3; i++) {
            const wx = (spawn2.tx + 2 + i) * TILE_SIZE + TILE_SIZE / 2;
            const w = this.spawnUnit(afd.workers[0], this.aiFaction, wx, (spawn2.ty + 5) * TILE_SIZE + TILE_SIZE / 2);
            aiWorkers.push(w);
        }
        // Auto-harvest: AI workers also start mining immediately
        const aiMine = { tx: spawn2.tx + 7, ty: spawn2.ty + 2, rtype: 'gold' };
        aiWorkers.forEach(w => { if (ab) w.harvest(aiMine, ab); });

        // Initial farm
        this.placeBuilding(pfd.farm, this.playerFaction,
            spawn1.tx + 5, spawn1.ty + 5, true);

        // AI
        this.ai = new AIManager(this.aiFaction, this.aiDifficulty, this);

        // Update fog immediately
        this._updateFog();
        this.minimap.update(0);

        this.running = true;
    }

    // ─── MAIN LOOP ──────────────────────────────────────────────────────────────
    tick(rawDt) {
        if (!this.running || this.over) return;
        if (this.paused) { this._render(); return; }

        const speed = GAME_SPEEDS[this.speedIndex];
        const dt = Math.min(rawDt, 0.1) * speed;

        this.elapsedTime += dt;

        // Input
        this._handleInput(rawDt);

        // Update entities
        this.entities.forEach(e => { if (!e.dead || e.deathTimer < DEATH_TIME / 1000) e.update(dt, this); });
        this.projectiles.forEach(p => p.update(dt, this));
        this.effects.forEach(ef => { ef.timer -= dt; });

        // Track kills before cleanup
        this.entities.forEach(e => {
            if (e.dead && !e._killCounted) {
                e._killCounted = true;
                if (e.faction === this.aiFaction) this.stats.playerKills++;
                else if (e.faction === this.playerFaction) this.stats.aiKills++;
                // Deselect dead entities
                if (e.selected) { e.selected = false; this.selection.remove(e); }
            }
        });

        // Cleanup dead
        this.entities = this.entities.filter(e => !e.dead || e.deathTimer < DEATH_TIME / 1000 + 0.5);
        this.projectiles = this.projectiles.filter(p => !p.dead);
        this.effects = this.effects.filter(e => e.timer > 0);

        // Camera
        this.camera.update(rawDt, this.input);

        // Fog
        this._fogTimer += dt;
        if (this._fogTimer > 0.25) { this._fogTimer = 0; this._updateFog(); }

        // AI
        this.ai?.update(dt);

        // Weather
        if (this.enableWeather) {
            this.weather.update(dt);
            this._weatherTimer += dt;
            if (this._weatherTimer >= this._nextWeatherIn) {
                this._weatherTimer = 0;
                this._nextWeatherIn = 60 + Math.random() * 90;
                this._triggerRandomWeather();
            }
        }

        // Voice alerts
        this._checkVoiceAlerts();

        // Victory check
        this._checkVictory();

        // HUD & Minimap
        this.hud.update(dt);
        this.minimap.update(dt);

        // Flush input
        this.input.flush();

        // Render
        this._render();
    }

    _triggerRandomWeather() {
        const types = [WEATHER_TYPE.RAIN, WEATHER_TYPE.FOG, WEATHER_TYPE.NONE];
        const t = types[Math.floor(Math.random() * types.length)];
        if (t === WEATHER_TYPE.NONE) { this.weather.clearWeather(); return; }
        const intensity = 0.4 + Math.random() * 0.5;
        const duration = 30 + Math.random() * 60;
        this.weather.setWeather(t, intensity, duration);
        const label = t === WEATHER_TYPE.RAIN ? 'Pluie' : 'Brouillard';
        this.hud?.addAlert(`☁ ${label} !`, 'weather');
    }

    _checkVoiceAlerts() {
        const eco = this.economy[this.playerFaction];
        // Low food
        if (eco.foodMax - eco.food <= 2) {
            this.voiceAlert('Nourriture faible !', 'food');
        }
        // Under attack (player entity took damage recently)
        const underAttack = this.entities.some(e =>
            e.faction === this.playerFaction && !e.dead && e.hitFlash > 0.1
        );
        if (underAttack) {
            this.voiceAlert('Sous le feu ennemi !', 'attack');
            playAlert();
        }
    }

    // ─── INPUT HANDLING ─────────────────────────────────────────────────────────
    _handleInput(dt) {
        const inp = this.input;
        const sel = this.selection;

        // Escape
        if (inp.isKeyDown('Escape')) {
            if (this.buildMode) { this.buildMode = null; this.canvas.style.cursor = 'default'; }
            else if (sel.commandMode) { sel.commandMode = null; this.canvas.style.cursor = 'default'; }
            else if (sel.selected.length) { sel.clear(); }
            else { this.paused = true; document.getElementById('pause-overlay')?.classList.remove('hidden'); }
        }

        // Speed controls
        if (inp.isKeyDown('Equal') || inp.isKeyDown('NumpadAdd')) {
            this.speedIndex = Math.min(3, this.speedIndex + 1);
        }
        if (inp.isKeyDown('Minus') || inp.isKeyDown('NumpadSubtract')) {
            this.speedIndex = Math.max(0, this.speedIndex - 1);
        }

        // Center on selection
        if (inp.isKeyDown('Space')) {
            const c = sel.centroid();
            if (c) this.camera.centerOn(c.x, c.y);
        }

        // Control groups
        for (let i = 1; i <= 9; i++) {
            const key = 'Digit' + i;
            if (inp.isKeyDown(key)) {
                if (inp.isKey('ControlLeft') || inp.isKey('ControlRight')) {
                    sel.assignGroup(i, sel.selected.filter(e => !e.dead));
                } else {
                    const g = sel.recallGroup(i);
                    if (g?.length) { const c = sel.centroid(); if (c) this.camera.centerOn(c.x, c.y); }
                }
            }
        }

        // Unit commands via keyboard
        if (sel.hasUnits) {
            if (inp.isKeyDown('KeyA')) { sel.commandMode = 'attack'; this.canvas.style.cursor = 'crosshair'; playClick(); }
            if (inp.isKeyDown('KeyS')) sel.selected.forEach(u => u.stop && u.stop());
            if (inp.isKeyDown('KeyH')) sel.selected.forEach(u => u.hold && u.hold());
            if (inp.isKeyDown('KeyM')) { sel.commandMode = 'move'; this.canvas.style.cursor = 'crosshair'; playClick(); }
            // Ctrl+F: cycle formation
            if (inp.isKeyDown('KeyF') && (inp.isKey('ControlLeft') || inp.isKey('ControlRight'))) {
                this.formationIndex = (this.formationIndex + 1) % FORMATION_TYPES.length;
                const fname = FORMATION_TYPES[this.formationIndex];
                const labels = { line: 'Ligne', wedge: 'Coin', circle: 'Cercle', scatter: 'Dispersé' };
                this.hud?.addAlert(`⬛ Formation : ${labels[fname]}`, 'formation');
            }
        }

        // Build mode shortcuts
        if (sel.hasWorkers && !this.buildMode) {
            if (inp.isKeyDown('KeyB')) { this.openBuildMenu(); playClick(); }
        }

        // Mouse clicks
        const mp = inp.mousePos;
        const mw = this.camera.toWorld(mp.x, mp.y);
        const mt = this.camera.screenToTile(mp.x, mp.y);

        // Left mouse button UP (select or command)
        if (inp.isLMBUp()) {
            if (this.buildMode) {
                if (this.buildPreview.valid) {
                    this._placePlayerBuilding(this.buildPreview.tx, this.buildPreview.ty);
                }
                this.buildMode = null;
                this.canvas.style.cursor = 'default';
            } else if (inp.isDragging) {
                const rect = inp.getDragRect();
                if (rect && rect.w > 4 && rect.h > 4) {
                    sel.dragSelect(rect, this.entities, this.fog, this.camera, this.playerFaction);
                }
                inp.clearDrag();
            } else if (!inp.isDblClick()) {
                // Single click
                const clicked = this._entityAt(mw.x, mw.y, this.playerFaction);
                const clickedEnemy = this._entityAt(mw.x, mw.y, this.aiFaction);
                if (inp.isKey('ShiftLeft') || inp.isKey('ShiftRight')) {
                    if (clicked) sel.add(clicked);
                } else {
                    if (clicked) sel.select([clicked]);
                    else if (!clickedEnemy) sel.clear();
                }
            }
        }

        // Double click – select same type of unit on screen
        if (inp.isDblClick()) {
            const clicked = this._entityAt(mw.x, mw.y, this.playerFaction);
            if (clicked?.type === 'unit') {
                sel.selectSameTypeOnScreen(clicked.unitKey, this.entities, this.camera);
            }
            inp.clearDrag();
        }

        // Right mouse button – command
        if (inp.isRMBDown()) {
            this._handleRightClick(mw.x, mw.y, mt.tx, mt.ty);
        }

        // Left click in command mode
        if (inp.isLMBDown() && sel.commandMode) {
            const mode = sel.commandMode;
            sel.commandMode = null;
            this.canvas.style.cursor = 'default';
            if (mode === 'attack') {
                const target = this._entityAt(mw.x, mw.y, this.aiFaction);
                if (target) sel.selected.forEach(u => u.type === 'unit' && u.attackEntity(target));
                else this._issueAttackMove(mw.x, mw.y);
            } else if (mode === 'move') {
                this._issueMoveOrder(mw.x, mw.y);
            } else if (mode === 'rally') {
                sel.selected.forEach(b => { if (b.type === 'building') b.setRally(mw.x, mw.y); });
            } else if (mode === 'harvest') {
                const tile = this.tileMap.getTile(mt.tx, mt.ty);
                if (tile) {
                    const rtype = tile.type === 4 ? 'gold' : 'wood';
                    const base = this.findNearestBase(this.playerFaction, mw.x, mw.y);
                    sel.selected.filter(u => u.isWorker).forEach(w => {
                        w.harvest({ tx: mt.tx, ty: mt.ty, rtype }, base);
                    });
                }
            }
        }

        // Drag selection rect display
        if (inp.buttons[0] && !this.buildMode && !sel.commandMode) {
            const rect = inp.getDragRect();
            this.hud.showSelRect(rect);
        } else {
            this.hud.showSelRect(null);
        }

        // Build preview
        if (this.buildMode) {
            const { tw, th } = this.buildMode;
            const tx = mt.tx - Math.floor(tw / 2);
            const ty = mt.ty - Math.floor(th / 2);
            this.buildPreview = {
                tx, ty,
                valid: this.tileMap.canPlaceBuilding(tx, ty, tw, th) &&
                    this.fog.isExplored(tx, ty)
            };
            this.canvas.style.cursor = 'crosshair';
        }
    }

    _handleRightClick(wx, wy, tx, ty) {
        const sel = this.selection;
        if (!sel.selected.length) return;

        // Cancel command mode
        if (sel.commandMode) { sel.commandMode = null; this.canvas.style.cursor = 'default'; return; }
        if (this.buildMode) { this.buildMode = null; this.canvas.style.cursor = 'default'; return; }

        const target = this._entityAt(wx, wy, this.aiFaction);
        const tile = this.tileMap.getTile(tx, ty);

        if (target && target.faction !== this.playerFaction) {
            // Attack
            sel.selected.filter(u => u.type === 'unit').forEach(u => u.attackEntity(target));
        } else if (tile?.type === 4 && sel.hasWorkers) {
            // Mine gold
            const base = this.findNearestBase(this.playerFaction, wx, wy);
            sel.selected.filter(u => u.isWorker).forEach(w => {
                w.harvest({ tx, ty, rtype: 'gold' }, base);
            });
        } else if (tile?.type === 2 && sel.hasWorkers) {
            // Harvest wood
            const base = this.findNearestBase(this.playerFaction, wx, wy);
            sel.selected.filter(u => u.isWorker).forEach(w => {
                w.harvest({ tx, ty, rtype: 'wood' }, base);
            });
        } else {
            // Move
            this._issueMoveOrder(wx, wy);
        }
    }

    _issueMoveOrder(wx, wy) {
        const sel = this.selection;
        const movingUnits = sel.selected.filter(u => u.type === 'unit');
        if (!movingUnits.length) return;
        const ttx = Math.floor(wx / TILE_SIZE), tty = Math.floor(wy / TILE_SIZE);
        movingUnits.forEach((u, i) => {
            // Offset for formation
            const offset = { x: (i % 3 - 1) * TILE_SIZE, y: (Math.floor(i / 3) - 1) * TILE_SIZE };
            const path = this.pathfinder.find(u.tx, u.ty, ttx, tty);
            u.moveTo(wx + offset.x, wy + offset.y, path || []);
        });
        // Show move cursor flash
        this.effects.push({ x: wx, y: wy, type: 'move', timer: .5 });
    }

    _issueAttackMove(wx, wy) {
        const sel = this.selection;
        const movingUnits = sel.selected.filter(u => u.type === 'unit');
        const ttx = Math.floor(wx / TILE_SIZE), tty = Math.floor(wy / TILE_SIZE);
        movingUnits.forEach((u, i) => {
            const path = this.pathfinder.find(u.tx, u.ty, ttx, tty);
            u.attackMoveTo(wx, wy, path || []);
        });
    }

    // ─── ENTITY QUERIES ─────────────────────────────────────────────────────────
    _entityAt(wx, wy, faction) {
        // Find entity at world position, prefer units over buildings
        const r = 20;
        const units = this.entities.filter(e =>
            !e.dead && e.faction === faction && e.type === 'unit' &&
            Math.abs(e.x - wx) < r && Math.abs(e.y - wy) < r
        );
        if (units.length) return units[0];
        const buildings = this.entities.filter(e =>
            !e.dead && e.faction === faction && e.type === 'building' &&
            wx >= e.tx0 * TILE_SIZE && wx <= (e.tx0 + e.tw) * TILE_SIZE &&
            wy >= e.ty0 * TILE_SIZE && wy <= (e.ty0 + e.th) * TILE_SIZE
        );
        return buildings[0] || null;
    }

    findNearestEnemy(entity) {
        let best = null, bd = Infinity;
        this.entities.forEach(e => {
            if (e.dead || e.faction === entity.faction || e.faction === FACTION.NEUTRAL) return;
            const d = Math.hypot(e.x - entity.x, e.y - entity.y);
            if (d < bd) { bd = d; best = e; }
        });
        return best;
    }

    findNearestEnemyInRange(entity, rangePx) {
        let best = null, bd = Infinity;
        this.entities.forEach(e => {
            if (e.dead || e.faction === entity.faction || e.faction === FACTION.NEUTRAL) return;
            const d = Math.hypot(e.x - entity.x, e.y - entity.y);
            if (d <= rangePx && d < bd) { bd = d; best = e; }
        });
        return best;
    }

    findNearestBase(faction, wx, wy) {
        let best = null, bd = Infinity;
        this.entities.forEach(e => {
            if (e.dead || e.faction !== faction || e.type !== 'building' || !e.isBase || !e.isComplete) return;
            const d = Math.hypot(e.x - wx, e.y - wy);
            if (d < bd) { bd = d; best = e; }
        });
        return best;
    }

    // ─── SPAWN / PLACE ──────────────────────────────────────────────────────────
    spawnUnit(unitKey, faction, wx, wy) {
        const eco = this.economy[faction];
        const u = new Unit(unitKey, faction, wx, wy, this._getResearchBonuses(faction));
        u.sprite = this.unitSprites[`${unitKey}_${faction}`] || null;
        this.entities.push(u);
        return u;
    }

    placeBuilding(bKey, faction, tx, ty, instant = false) {
        const data = BUILDINGS[bKey];
        if (!data) return null;
        const [tw, th] = data.size;
        if (!this.tileMap.canPlaceBuilding(tx, ty, tw, th) && !instant) return null;

        const b = new Building(bKey, faction, tx, ty);
        b.sprite = this.buildingSprites[`${bKey}_${faction}`] || null;
        if (instant) { b.isBuilding = false; b.buildProgress = 1; if (b.foodBonus) this.economy[faction].foodMax += b.foodBonus; }

        this.tileMap.blockRect(tx, ty, tw, th, b.id);
        this.entities.push(b);
        return b;
    }

    _placePlayerBuilding(tx, ty) {
        if (!this.buildMode) return;
        const { bKey, tw, th } = this.buildMode;
        const data = BUILDINGS[bKey];
        if (!data) return;
        const eco = this.economy[this.playerFaction];
        if (eco.gold < (data.cost.gold || 0) || eco.wood < (data.cost.wood || 0)) {
            this.hud.addAlert('⚠ Ressources insuffisantes', 'warn'); return;
        }
        if (!this.tileMap.canPlaceBuilding(tx, ty, tw, th)) {
            this.hud.addAlert('⚠ Emplacement invalide', 'warn'); return;
        }
        eco.gold -= (data.cost.gold || 0);
        eco.wood -= (data.cost.wood || 0);
        const b = this.placeBuilding(bKey, this.playerFaction, tx, ty, false);
        if (!b) return;
        // Assign the currently selected worker (or any idle worker) to build
        const selectedWorker = this.selection.selected.find(e => !e.dead && e.isWorker && e.state !== STATE.CONSTRUCTING);
        const idleWorker = this.entities.find(e => !e.dead && e.faction === this.playerFaction && e.isWorker && e.state === STATE.IDLE);
        const worker = selectedWorker || idleWorker;
        if (worker) {
            const path = this.pathfinder.find(worker.tx, worker.ty, b.tx0, b.ty0);
            worker.startConstruct(b, path);
            b.builderRef = worker;
        }
        playConstruct();
        this.hud.addAlert(`🔨 Construction de ${b.label}`, 'info');
    }

    removeBuilding(b, refund75 = false) {
        if (refund75) {
            const data = BUILDINGS[b.bKey];
            const eco = this.economy[b.faction];
            eco.gold += Math.round((data.cost.gold || 0) * 0.75);
            eco.wood += Math.round((data.cost.wood || 0) * 0.75);
        }
        this.tileMap.unblockRect(b.tx0, b.ty0, b.tw, b.th, b.id);
        if (b.foodBonus && b.isComplete) this.economy[b.faction].foodMax = Math.max(10, this.economy[b.faction].foodMax - b.foodBonus);
        b.dead = true;
    }

    spawnProjectile(attacker, target) {
        const uk = attacker.unitKey || null;
        const bk = attacker.bKey || null;
        const projType = attacker.projectile || 'arrow';
        const dmg = attacker.dmg;
        const splash = attacker.splash || 0;
        const p = new Projectile(attacker.x, attacker.y, target, dmg, projType, splash, attacker.faction, attacker);
        this.projectiles.push(p);
    }

    spawnEffect(x, y, type) {
        this.effects.push({ x, y, type, timer: 0.6 });
    }

    openBuildMenu() {
        // For now: cycle through buildings player can build with workers
        // In full version this opens a submenu
        const fd = FACTION_DATA[this.playerFaction];
        // Simple: set build mode to barracks if not built
        const buildings = [fd.barracks, fd.farm, fd.smith, 'tower', 'mage_tower'];
        const available = buildings.find(bk => {
            const d = BUILDINGS[bk];
            return d && d.faction === this.playerFaction;
        }) || fd.farm;
        const data = BUILDINGS[available];
        if (!data) return;
        this.buildMode = { bKey: available, tw: data.size[0], th: data.size[1] };
        this.hud.addAlert(`Placez: ${data.label}`, 'info');
    }

    // Build specific building
    startBuild(bKey) {
        const data = BUILDINGS[bKey];
        if (!data) return;
        if (data.faction !== this.playerFaction) return;
        this.buildMode = { bKey, tw: data.size[0], th: data.size[1] };
    }

    // ─── CALLBACKS ──────────────────────────────────────────────────────────────
    onBuildingComplete(b) {
        playBuildComplete();
        if (b.faction === this.playerFaction) {
            this.hud.addAlert(`✅ ${b.label} terminé !`, 'good');
        }
    }

    onProductionComplete(b, key, isResearch) {
        if (isResearch) {
            this.research[b.faction][key] = true;
            this._applyResearch(b.faction, key);
            if (b.faction === this.playerFaction) {
                playResearch();
                this.hud.addAlert(`🔬 ${RESEARCH[key]?.label} terminé !`, 'good');
            }
        } else {
            // Spawn unit at rally point
            let rx = b.rallyX, ry = b.rallyY;
            // Find passable spot near rally
            const rtx = Math.floor(rx / TILE_SIZE), rty = Math.floor(ry / TILE_SIZE);
            const spot = this.tileMap.findNearestPassable(rtx, rty, 4);
            if (spot) { rx = spot.tx * TILE_SIZE + TILE_SIZE / 2; ry = spot.ty * TILE_SIZE + TILE_SIZE / 2; }
            const unit = this.spawnUnit(key, b.faction, rx, ry);
            if (b.faction === this.playerFaction) this.hud.addAlert(`⚔ ${unit.label} prêt !`, 'good');
            // Update food cost
            this.economy[b.faction].food = this._countFood(b.faction);
        }
    }

    _countFood(faction) {
        return this.entities.filter(e => !e.dead && e.faction === faction && e.type === 'unit' && !e.isHero)
            .reduce((s, u) => { const d = UNITS[u.unitKey]; return s + (d?.cost?.food || 0); }, 0);
    }

    _applyResearch(faction, key) {
        const rd = RESEARCH[key]; if (!rd?.effect) return;
        // Apply bonuses to all existing units of this faction
        this.entities.filter(e => !e.dead && e.faction === faction && e.type === 'unit').forEach(u => {
            if (rd.effect.dmg) u.dmg += rd.effect.dmg;
            if (rd.effect.armor) u.armor += rd.effect.armor;
            if (rd.effect.speed) u.speed += rd.effect.speed;
            if (rd.effect.range) u.range += rd.effect.range;
        });
    }

    _getResearchBonuses(faction) {
        const bonuses = { dmg: 0, armor: 0, speed: 0, range: 0, splash: 0 };
        const done = this.research[faction];
        Object.keys(done).forEach(k => {
            const rd = RESEARCH[k];
            if (!rd?.effect) return;
            Object.keys(bonuses).forEach(b => { if (rd.effect[b]) bonuses[b] += rd.effect[b]; });
        });
        return bonuses;
    }

    // ─── FOG OF WAR ─────────────────────────────────────────────────────────────
    _updateFog() {
        const sources = [];
        this.entities.filter(e => !e.dead && e.faction === this.playerFaction).forEach(e => {
            sources.push({ tx: e.tx, ty: e.ty, sight: e.sight });
        });
        this.fog.update(sources);
    }

    // ─── VICTORY CHECK ──────────────────────────────────────────────────────────
    _checkVictory() {
        const playerBases = this.entities.filter(e => !e.dead && e.faction === this.playerFaction && e.type === 'building' && e.isBase);
        const aiBases = this.entities.filter(e => !e.dead && e.faction === this.aiFaction && e.type === 'building' && e.isBase);
        if (aiBases.length === 0) { this._endGame(this.playerFaction); }
        else if (playerBases.length === 0) { this._endGame(this.aiFaction); }
    }

    _endGame(winner) {
        if (this.over) return;
        this.over = true;
        this.winner = winner;
        this.onGameOver?.(winner === this.playerFaction);
    }

    // ─── RENDER ─────────────────────────────────────────────────────────────────
    _render() {
        const ctx = this.ctx;
        const cam = this.camera;
        const W = this.canvas.width, H = this.canvas.height;
        ctx.clearRect(0, 0, W, H);

        // 1. Tiles
        this._renderTiles(ctx, cam);

        // 2. Buildings (under-construction: with transparency)
        this._renderBuildings(ctx, cam);

        // 3. Units (Y-sorted)
        const visible = [...this.entities.filter(e => !e.dead && e.type === 'unit'),
        ...this.projectiles.filter(p => !p.dead)];
        visible.sort((a, b) => a.y - b.y);
        visible.forEach(e => {
            if (e instanceof Projectile) this._renderProjectile(ctx, cam, e);
            else this._renderUnit(ctx, cam, e);
        });

        // 4. Effects
        this.effects.forEach(ef => this._renderEffect(ctx, cam, ef));

        // 5. Fog of War
        this.fog.render(ctx, cam, TILE_SIZE);

        // 5.5 Weather overlay (rain / fog of war)
        this.weather.render(ctx);

        // 6. Selection rings & health bars (drawn OVER fog on player's units)
        this._renderSelectionHints(ctx, cam);

        // 7. Build preview
        if (this.buildMode) this._renderBuildPreview(ctx, cam);

        // 8. Minimap
        this.minimap.render();
    }

    _renderTiles(ctx, cam) {
        const startX = Math.max(0, Math.floor(cam.x / TILE_SIZE));
        const startY = Math.max(0, Math.floor(cam.y / TILE_SIZE));
        const endX = Math.min(MAP_W - 1, Math.ceil((cam.x + cam.viewW) / TILE_SIZE));
        const endY = Math.min(MAP_H - 1, Math.ceil((cam.y + cam.viewH) / TILE_SIZE));

        for (let ty = startY; ty <= endY; ty++) for (let tx = startX; tx <= endX; tx++) {
            const tile = this.tileMap.getTile(tx, ty);
            if (!tile) continue;
            const sx = tx * TILE_SIZE - cam.x, sy = ty * TILE_SIZE - cam.y;
            const sprites = this.tileSprites[tile.type];
            if (sprites) {
                ctx.drawImage(sprites[tile.variant % sprites.length], sx, sy);
            } else {
                ctx.fillStyle = '#3a6632'; ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    _renderBuildings(ctx, cam) {
        this.entities.filter(e => e.type === 'building' && !e.dead).forEach(b => {
            const sx = b.tx0 * TILE_SIZE - cam.x, sy = b.ty0 * TILE_SIZE - cam.y;
            if (!cam.isVisible(b.tx0 * TILE_SIZE, b.ty0 * TILE_SIZE, b.tw * TILE_SIZE, b.th * TILE_SIZE)) return;
            const fogSt = this.fog.getState(b.tx0, b.ty0);
            if (fogSt < 1) return; // unexplored

            ctx.save();
            if (b.isBuilding) ctx.globalAlpha = 0.5 + 0.5 * (b.buildProgress);
            if (b.sprite) { ctx.drawImage(b.sprite, sx, sy, b.tw * TILE_SIZE, b.th * TILE_SIZE); }
            else {
                ctx.fillStyle = FACTION_COLOR[b.faction] || '#888';
                ctx.fillRect(sx, sy, b.tw * TILE_SIZE - 1, b.th * TILE_SIZE - 1);
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(b.icon || '🏠', sx + b.tw * TILE_SIZE / 2, sy + b.th * TILE_SIZE / 2 + 10);
            }
            ctx.restore();

            // Construction progress bar
            if (b.isBuilding) {
                const bw = b.tw * TILE_SIZE;
                ctx.fillStyle = '#222'; ctx.fillRect(sx, sy - 6, bw, 4);
                ctx.fillStyle = '#ff8800'; ctx.fillRect(sx, sy - 6, bw * b.buildProgress, 4);
            }

            // HP bar (always show)
            const hw = b.tw * TILE_SIZE;
            ctx.fillStyle = '#111'; ctx.fillRect(sx, sy - 4, hw, 3);
            const hpC = b.hpRatio > 0.66 ? '#00cc00' : b.hpRatio > 0.33 ? '#cccc00' : '#cc2200';
            ctx.fillStyle = hpC; ctx.fillRect(sx, sy - 4, hw * b.hpRatio, 3);

            // Selection ring
            if (b.selected) {
                ctx.strokeStyle = COLOR.SEL; ctx.lineWidth = 2;
                ctx.strokeRect(sx - 1, sy - 1, b.tw * TILE_SIZE + 2, b.th * TILE_SIZE + 2);
            }

            // Production progress bar
            if (b.queue?.length && !b.isBuilding) {
                const pct = b.getQueueProgress();
                ctx.fillStyle = '#004488'; ctx.fillRect(sx, sy + b.th * TILE_SIZE, hw, 4);
                ctx.fillStyle = '#0088ff'; ctx.fillRect(sx, sy + b.th * TILE_SIZE, hw * pct, 4);
            }
        });
    }

    _renderUnit(ctx, cam, u) {
        const sx = u.x - cam.x, sy = u.y - cam.y;
        if (sx < -32 || sx > cam.viewW + 32 || sy < -32 || sy > cam.viewH + 32) return;
        const fogSt = this.fog.getState(u.tx, u.ty);
        if (fogSt < 1 && u.faction !== this.playerFaction) return; // hide enemies in fog

        ctx.save();
        if (u.dead) { ctx.globalAlpha = Math.max(0, 1 - u.deathTimer / (DEATH_TIME / 1000)); }
        if (u.hitFlash > 0) { ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.6; ctx.filter = 'brightness(3)'; }

        if (u.sprite) {
            ctx.drawImage(u.sprite, sx - 16, sy - 16, 32, 32);
        } else {
            ctx.fillStyle = FACTION_COLOR[u.faction] || '#888';
            ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        if (!u.dead) {
            // HP bar
            const hw = 28;
            ctx.fillStyle = '#111'; ctx.fillRect(sx - hw / 2, sy - 20, hw, 3);
            const hpC = u.hpRatio > 0.66 ? '#00cc00' : u.hpRatio > 0.33 ? '#cccc00' : '#cc2200';
            ctx.fillStyle = hpC; ctx.fillRect(sx - hw / 2, sy - 20, hw * u.hpRatio, 3);

            // Carrying indicator
            if (u.carryGold > 0 || u.carryWood > 0) {
                ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(u.carryGold > 0 ? '🪙' : '🪵', sx, sy - 22);
            }
        }
    }

    _renderProjectile(ctx, cam, p) {
        const sx = p.x - cam.x, sy = p.y - cam.y;
        if (!p.target) return;
        const tx = p.target.x - cam.x, ty = p.target.y - cam.y;
        const angle = Math.atan2(ty - sy, tx - sx);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        if (p.type === 'arrow') {
            ctx.fillStyle = '#8b6020'; ctx.fillRect(-5, -1, 10, 2);
            ctx.fillStyle = '#bbb'; ctx.fillRect(4, -2, 4, 4);
        } else if (p.type === 'fireball') {
            ctx.fillStyle = 'rgba(255,100,0,0.9)';
            ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,220,0,0.7)';
            ctx.beginPath(); ctx.arc(-2, 0, 3, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke();
        }
        ctx.restore();
    }

    _renderEffect(ctx, cam, ef) {
        const sx = ef.x - cam.x, sy = ef.y - cam.y;
        const alpha = Math.min(1, ef.timer * 2);
        ctx.save(); ctx.globalAlpha = alpha;
        switch (ef.type) {
            case 'arrow': case 'fireball':
                ctx.fillStyle = 'rgba(255,120,0,0.6)';
                const r = ef.type === 'fireball' ? 18 : 10;
                ctx.beginPath(); ctx.arc(sx, sy, r * (1 - ef.timer / 0.6), 0, Math.PI * 2); ctx.fill();
                break;
            case 'heal':
                ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(sx, sy, 30 * (1 - ef.timer / 0.6), 0, Math.PI * 2); ctx.stroke();
                break;
            case 'move':
                ctx.strokeStyle = 'rgba(0,255,80,0.4)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.stroke();
                break;
            case 'summon':
                ctx.fillStyle = 'rgba(255,200,0,0.4)';
                ctx.beginPath(); ctx.arc(sx, sy, 20, 0, Math.PI * 2); ctx.fill();
                break;
        }
        ctx.restore();
    }

    _renderSelectionHints(ctx, cam) {
        this.selection.selected.forEach(e => {
            if (e.dead) return;
            const sx = e.x - cam.x, sy = e.y - cam.y;
            if (e.type === 'unit') {
                ctx.strokeStyle = COLOR.SEL; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.ellipse(sx, sy + 10, 14, 6, 0, 0, Math.PI * 2); ctx.stroke();
            }
        });
    }

    _renderBuildPreview(ctx, cam) {
        const { tw, th } = this.buildMode;
        const { tx, ty, valid } = this.buildPreview;
        const sx = tx * TILE_SIZE - cam.x, sy = ty * TILE_SIZE - cam.y;
        const w = tw * TILE_SIZE, h = th * TILE_SIZE;
        ctx.fillStyle = valid ? 'rgba(0,220,0,0.25)' : 'rgba(220,0,0,0.25)';
        ctx.fillRect(sx, sy, w, h);
        ctx.strokeStyle = valid ? '#00ff44' : '#ff4444';
        ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
        ctx.strokeRect(sx, sy, w, h); ctx.setLineDash([]);
    }

    resume() { this.paused = false; }
    pause() { this.paused = true; }
}
