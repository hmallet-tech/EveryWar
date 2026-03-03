// js/ui/BuildMenu.js – In-game build submenu triggered by 'B'
// The build menu appears as DOM overlay buttons beside the command card.
import { BUILDINGS, FACTION_DATA } from '../data.js';

export class BuildMenu {
    constructor(game) {
        this.game = game;
        this.open = false;
        this.el = null;
        this._create();
    }

    _create() {
        this.el = document.createElement('div');
        this.el.id = 'build-menu';
        Object.assign(this.el.style, {
            position: 'absolute', bottom: '210px', left: '200px',
            display: 'none',
            flexWrap: 'wrap', gap: '6px', padding: '10px',
            background: 'rgba(10,5,0,0.96)',
            border: '2px solid #6a4800', borderRadius: '6px',
            maxWidth: '500px', zIndex: '20', pointerEvents: 'all'
        });
        document.getElementById('hud').appendChild(this.el);
    }

    show() {
        const g = this.game;
        const fd = FACTION_DATA[g.playerFaction];
        const eco = g.economy[g.playerFaction];
        this.el.innerHTML = '';
        this.open = true;
        this.el.style.display = 'flex';

        fd.buildings.forEach(bKey => {
            const data = BUILDINGS[bKey];
            if (!data || data.isBase) return; // can't manually place base
            const canAfford = eco.gold >= (data.cost.gold || 0) && eco.wood >= (data.cost.wood || 0);
            const btn = document.createElement('button');
            btn.className = 'cmd-btn' + (canAfford ? '' : ' disabled');
            btn.style.width = '70px'; btn.style.height = '70px';
            btn.innerHTML = `
        <span class="ci">${data.icon}</span>
        <span class="cl">${data.label}</span>
        <span class="cc">🪙${data.cost.gold || 0}${data.cost.wood ? ` 🪵${data.cost.wood}` : ''}</span>`;
            btn.title = data.desc || '';
            if (canAfford) {
                btn.onclick = () => {
                    g.startBuild(bKey);
                    this.hide();
                };
            }
            this.el.appendChild(btn);
        });

        // Close button
        const close = document.createElement('button');
        close.className = 'cmd-btn'; close.style.width = '36px'; close.style.height = '70px';
        close.innerHTML = '<span class="ci">✕</span>';
        close.onclick = () => this.hide();
        this.el.appendChild(close);
    }

    hide() {
        this.open = false;
        this.el.style.display = 'none';
    }

    toggle() { this.open ? this.hide() : this.show(); }
}
