// js/entities/Entity.js – Base entity class
import { STATE } from '../constants.js';

let _nextId = 1;
export function nextId() { return _nextId++; }
export function resetIds() { _nextId = 1; }

export class Entity {
    constructor(type, faction, x, y) {
        this.id = nextId();
        this.type = type;     // 'unit' | 'building'
        this.faction = faction;
        this.x = x;        // world pixel center
        this.y = y;
        this.hp = 1;
        this.maxHp = 1;
        this.armor = 0;
        this.state = STATE.IDLE;
        this.dead = false;
        this.deathTimer = 0;
        this.sight = 5;        // tiles
        this.sprite = null;     // Canvas or null
        this.selected = false;
    }

    get tx() { return Math.floor(this.x / 32); }
    get ty() { return Math.floor(this.y / 32); }

    takeDamage(raw) {
        const dmg = Math.max(0, raw - this.armor);
        this.hp = Math.max(0, this.hp - dmg);
        if (this.hp <= 0 && !this.dead) this.die();
        return dmg;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    die() {
        this.dead = true;
        this.state = STATE.DEAD;
        this.deathTimer = 0;
    }

    get hpRatio() { return this.maxHp > 0 ? this.hp / this.maxHp : 0; }

    isAlive() { return !this.dead; }

    isEnemy(other) { return other && other.faction !== this.faction && other.faction !== 'neutral'; }
}
