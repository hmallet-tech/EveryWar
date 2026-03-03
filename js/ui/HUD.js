// js/ui/HUD.js – HUD manager: resource bar, selection panel, command card, alerts
import { BUILDINGS, UNITS, RESEARCH, FACTION_DATA } from '../data.js';
import { FACTION } from '../constants.js';

export class HUD {
    constructor(game) {
        this.game = game;
        this.alerts = [];
        this.tooltip = null;

        // DOM references
        this.$ = id => document.getElementById(id);
        this._goldVal = this.$('gold-val');
        this._woodVal = this.$('wood-val');
        this._foodVal = this.$('food-val');
        this._foodMax = this.$('food-max');
        this._timeVal = this.$('time-val');
        this._alertBanner = this.$('alert-banner');
        this._selPortrait = this.$('sel-portrait');
        this._selName = this.$('sel-name');
        this._selHpWrap = this.$('sel-hp-bar-wrap');
        this._selHpBar = this.$('sel-hp-bar');
        this._selStats = this.$('sel-stats');
        this._selStatus = this.$('sel-status');
        this._multiList = this.$('multi-sel-list');
        this._cmdCard = this.$('cmd-card');
        this._alertsBox = this.$('alerts-box');
        this._selRect = this.$('sel-rect');
        this._speedBtn = this.$('btn-speed');
    }

    update(dt) {
        const g = this.game;
        const eco = g.economy[g.playerFaction];

        // Resources
        this._goldVal.textContent = Math.floor(eco.gold);
        this._woodVal.textContent = Math.floor(eco.wood);
        this._foodVal.textContent = eco.food;
        this._foodMax.textContent = Math.min(eco.foodMax, 50);

        // Color food warning
        const foodEl = document.getElementById('res-food');
        foodEl.style.color = eco.food >= eco.foodMax ? '#ff6666' : '';

        // Time
        this._timeVal.textContent = this._formatTime(g.elapsedTime);

        // Speed button
        this._speedBtn.textContent = `▶ ×${[.5, 1, 2, 3][g.speedIndex]}`;

        // Selection panel
        this._updateSelectionPanel();

        // Alerts cleanup
        this._cleanAlerts();
    }

    _formatTime(s) {
        const m = Math.floor(s / 60), sec = Math.floor(s % 60);
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }

    _updateSelectionPanel() {
        const sel = this.game.selection.selected;
        if (sel.length === 0) {
            this._selPortrait.textContent = '–';
            this._selName.textContent = 'Aucune sélection';
            this._selStats.innerHTML = '';
            this._selStatus.textContent = '';
            this._selHpWrap.classList.add('hidden');
            this._multiList.innerHTML = '';
            this._cmdCard.innerHTML = '';
            return;
        }

        if (sel.length === 1) {
            const e = sel[0];
            this._selPortrait.textContent = e.icon || (e.type === 'building' ? '🏠' : '⚔️');
            this._selName.textContent = e.label;
            this._selHpWrap.classList.remove('hidden');

            const pct = e.hpRatio * 100;
            this._selHpBar.style.width = pct + '%';
            this._selHpBar.className = pct > 66 ? 'hp-high' : pct > 33 ? 'hp-med' : 'hp-low';

            // Stats
            if (e.type === 'unit') {
                this._selStats.innerHTML =
                    `❤️ ${Math.ceil(e.hp)}/${e.maxHp} &nbsp;⚔ ${e.dmg} &nbsp;🛡 ${e.armor}<br>` +
                    `👁 ${e.sight} tiles &nbsp;💨 ${Math.round(e.speed)}`;
            } else {
                this._selStats.innerHTML =
                    `❤️ ${Math.ceil(e.hp)}/${e.maxHp} &nbsp;🛡 ${e.armor}` +
                    (e.queue?.length ? `<br>📦 File: ${e.queue.length}/5` : '');
                if (e.isBuilding) {
                    const pct2 = Math.round(e.buildProgress * 100);
                    this._selStats.innerHTML += `<br>🔨 Construction: ${pct2}%`;
                }
            }
            this._selStatus.textContent = e.statusText || '';
            this._multiList.innerHTML = '';
            this._buildCommandCard(e);
        } else {
            // Multi-selection
            const first = sel[0];
            this._selPortrait.textContent = first.icon || '⚔️';
            this._selName.textContent = `${sel.length} entités sélectionnées`;
            this._selHpWrap.classList.add('hidden');
            this._selStats.innerHTML = '';
            this._selStatus.textContent = '';

            // Multi-unit icons
            this._multiList.innerHTML = '';
            sel.slice(0, 12).forEach(e => {
                const div = document.createElement('div');
                div.className = 'ms-icon';
                div.textContent = e.icon || '⚔️';
                div.title = e.label;
                const hp = document.createElement('div');
                hp.className = 'ms-hp ' + (e.hpRatio > 0.66 ? 'hp-high' : e.hpRatio > 0.33 ? 'hp-med' : 'hp-low');
                hp.style.width = Math.round(e.hpRatio * 100) + '%';
                div.appendChild(hp);
                div.onclick = () => { this.game.selection.select([e]); };
                this._multiList.appendChild(div);
            });
            this._buildMultiCommandCard(sel);
        }
    }

    _buildCommandCard(entity) {
        this._cmdCard.innerHTML = '';
        const g = this.game;
        const fd = FACTION_DATA[g.playerFaction];

        const addBtn = (icon, label, key, hotkey, action, disabled = false, cost = '') => {
            const btn = document.createElement('button');
            btn.className = 'cmd-btn' + (disabled ? ' disabled' : '');
            btn.innerHTML = `<span class="ck">${hotkey}</span><span class="ci">${icon}</span><span class="cl">${label}</span>${cost ? `<span class="cc">${cost}</span>` : ''}`;
            if (!disabled) btn.onclick = action;
            this._cmdCard.appendChild(btn);
        };

        const eco = g.economy[g.playerFaction];

        if (entity.type === 'unit') {
            addBtn('🚶', 'Déplacer', 'move', 'M', () => { g.selection.commandMode = 'move'; });
            addBtn('⚔️', 'Attaquer', 'attack', 'A', () => { g.selection.commandMode = 'attack'; });
            addBtn('✋', 'Stop', 'stop', 'S', () => { g.selection.selected.forEach(u => u.stop ? u.stop() : null); });
            addBtn('🛡', 'Garde', 'hold', 'H', () => { g.selection.selected.forEach(u => u.hold ? u.hold() : null); });

            if (entity.isWorker) {
                addBtn('⛏', 'Récolter', 'harvest', '', () => { g.selection.commandMode = 'harvest'; });
                // Build submenu
                addBtn('🔨', 'Construire', 'build', 'B', () => { g.openBuildMenu(); });
            }
            if (entity.isHero && entity.ability) {
                const cd = entity.abilityCooldown > 0;
                addBtn('✨', 'Capacité', 'ability', 'E', () => { entity.useAbility(g); }, cd,
                    cd ? `${Math.ceil(entity.abilityCooldown)}s` : '');
            }

        } else if (entity.type === 'building') {
            if (entity.isBuilding) {
                addBtn('❌', 'Annuler', 'cancel', '', () => {
                    g.removeBuilding(entity, true);
                });
                return;
            }
            // Production buttons
            (entity.produces || []).forEach(uk => {
                const ud = UNITS[uk];
                if (!ud) return;
                const disabled = !this._canTrain(uk, eco, g);
                const cost = `🪙${ud.cost.gold}${ud.cost.wood ? ` 🪵${ud.cost.wood}` : ''}`;
                addBtn(ud.icon, ud.label, '', ud.label[0].toUpperCase(), () => {
                    entity.queueItem(uk, false, g);
                }, disabled, cost);
            });
            // Research buttons
            (entity.researches || []).forEach(rk => {
                const rd = RESEARCH[rk];
                if (!rd) return;
                const done = g.research[g.playerFaction][rk];
                const inQ = entity.queue.some(q => q.key === rk && q.isResearch);
                const disabled = done || inQ || !this._canResearch(rk, eco, g);
                const cost = `🪙${rd.cost.gold}`;
                addBtn(rd.icon, rd.label, '', '', () => {
                    entity.queueItem(rk, true, g);
                }, disabled, done ? '✓' : cost);
            });
            // Rally point
            if (entity.produces?.length) {
                addBtn('🏳️', 'Ralliement', 'rally', '', () => { g.selection.commandMode = 'rally'; });
            }
            // Cancel last in queue
            if (entity.queue?.length) {
                addBtn('❌', 'Annuler file', '', '-', () => { entity.cancelLast(g); });
            }
        }
    }

    _buildMultiCommandCard(sel) {
        this._cmdCard.innerHTML = '';
        const addBtn = (icon, label, action) => {
            const btn = document.createElement('button');
            btn.className = 'cmd-btn';
            btn.innerHTML = `<span class="ci">${icon}</span><span class="cl">${label}</span>`;
            btn.onclick = action;
            this._cmdCard.appendChild(btn);
        };
        const g = this.game;
        addBtn('⚔️', 'Attaquer', () => { g.selection.commandMode = 'attack'; });
        addBtn('🚶', 'Déplacer', () => { g.selection.commandMode = 'move'; });
        addBtn('✋', 'Stop', () => { sel.forEach(u => u.stop && u.stop()); });
        addBtn('🛡', 'Garde', () => { sel.forEach(u => u.hold && u.hold()); });
    }

    _canTrain(uk, eco, g) {
        const ud = UNITS[uk]; if (!ud) return false;
        if (ud.requires && !g.research[g.playerFaction][ud.requires]) return false;
        return eco.gold >= (ud.cost.gold || 0) && eco.wood >= (ud.cost.wood || 0) && eco.food < eco.foodMax;
    }
    _canResearch(rk, eco, g) {
        const rd = RESEARCH[rk]; if (!rd) return false;
        if (rd.requires && !g.research[g.playerFaction][rd.requires]) return false;
        return eco.gold >= (rd.cost.gold || 0) && eco.wood >= (rd.cost.wood || 0);
    }

    /** Show drag selection rect (DOM overlay) */
    showSelRect(rect) {
        if (!rect) { this._selRect.style.display = 'none'; return; }
        Object.assign(this._selRect.style, {
            display: 'block', left: rect.x + 'px', top: rect.y + 'px',
            width: rect.w + 'px', height: rect.h + 'px'
        });
    }

    addAlert(msg, type = 'danger') {
        const el = document.createElement('div');
        el.className = `alert ${type}`;
        el.textContent = msg;
        this._alertsBox.appendChild(el);
        setTimeout(() => el.remove(), 3200);
    }

    _cleanAlerts() {
        // Auto-cleaned by setTimeout above
    }

    setBannerAlert(msg) {
        const b = this._alertBanner;
        if (!b) return;
        b.textContent = msg;
        b.classList.toggle('hidden', !msg);
    }
}
