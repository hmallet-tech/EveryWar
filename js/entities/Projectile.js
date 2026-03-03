// js/entities/Projectile.js
import { PROJ_SPEED } from '../constants.js';

export class Projectile {
    constructor(sx, sy, target, dmg, type, splash, attackerFaction, attackerRef) {
        this.x = sx; this.y = sy;
        this.target = target;
        this.dmg = dmg;
        this.type = type;      // 'arrow','fireball','lightning'
        this.splash = splash || 0;
        this.faction = attackerFaction;
        this.attacker = attackerRef;
        this.dead = false;
        this.speed = type === 'fireball' ? 160 : type === 'lightning' ? 300 : PROJ_SPEED;
        // For lightning: instant hit
        if (type === 'lightning') this.speed = 9999;
    }

    update(dt, game) {
        if (this.dead) return;
        if (!this.target || this.target.dead) {
            this.dead = true; return;
        }
        const dx = this.target.x - this.x, dy = this.target.y - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 8) {
            // Hit!
            const dmg = Math.max(1, this.dmg);
            this.target.takeDamage(dmg);
            if (this.splash > 0) {
                game.entities.forEach(e => {
                    if (e !== this.target && !e.dead && e.faction !== this.faction) {
                        const sd = Math.hypot(e.x - this.target.x, e.y - this.target.y);
                        if (sd <= this.splash * 32) e.takeDamage(Math.round(dmg * 0.5));
                    }
                });
            }
            // Lightning chain
            if (this.type === 'lightning' && game.research[this.faction]?.lightning_chain) {
                let hits = 2, last = this.target;
                game.entities.forEach(e => {
                    if (hits > 0 && !e.dead && e.faction !== this.faction && e !== last) {
                        const cd = Math.hypot(e.x - last.x, e.y - last.y);
                        if (cd < 128) { e.takeDamage(Math.round(dmg * 0.5)); hits--; last = e; }
                    }
                });
            }
            game.spawnEffect(this.target.x, this.target.y, this.type);
            this.dead = true;
        } else {
            this.x += (dx / d) * this.speed * dt;
            this.y += (dy / d) * this.speed * dt;
        }
    }
}
