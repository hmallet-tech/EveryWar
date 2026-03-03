// js/main.js – Bootstrap: menus, game lifecycle

import { Game } from './Game.js';
import { BuildMenu } from './ui/BuildMenu.js';
import { MapConfig } from './mapConfig.js';

// ─── DOM helpers ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function show(id) { $(id)?.classList.remove('hidden'); }
function hide(id) { $(id)?.classList.add('hidden'); }
function showS(id) { $(id) && ($(id).style.display = 'flex'); }
function hideEl(el) { el && (el.style.display = 'none'); }

// ─── State ──────────────────────────────────────────────────────────────────
let game = null;
let animFrame = null;
let lastT = 0;
let buildMenu = null;

let selectedFaction = 'human';
let selectedDiff = 'easy';
let selectedMap = 'random';
let selectedSize = 'medium';

// ─── Loading sequence ────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    const bar = $('loading-bar');
    const text = $('loading-text');

    const steps = [
        ['Initialisation du moteur…', 20],
        ['Chargement des sprites…', 50],
        ['Génération des ressources…', 75],
        ['Préparation de l\'interface…', 95],
        ['Prêt !', 100],
    ];
    for (const [msg, pct] of steps) {
        text.textContent = msg;
        bar.style.width = pct + '%';
        await delay(160);
    }
    await delay(200);
    $('loading-screen').style.opacity = '0';
    await delay(600);
    $('loading-screen').style.display = 'none';
    show('main-menu');
    _bindMenus();
});

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── MENU BINDINGS ───────────────────────────────────────────────────────────
function _bindMenus() {
    // Main menu
    $('btn-play').onclick = () => { hide('main-menu'); show('setup-screen'); };
    $('btn-help').onclick = () => { hide('main-menu'); show('help-screen'); };
    $('btn-help-back').onclick = () => { hide('help-screen'); show('main-menu'); };

    // Setup screen – factions
    document.querySelectorAll('.faction-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.faction-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedFaction = card.dataset.faction;
        });
    });

    // Difficulty
    document.querySelectorAll('.choice-btn[data-diff]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.choice-btn[data-diff]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDiff = btn.dataset.diff;
        });
    });

    // Map type
    document.querySelectorAll('.choice-btn[data-map]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.choice-btn[data-map]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedMap = btn.dataset.map;
        });
    });

    // Map size
    document.querySelectorAll('.choice-btn[data-size]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.choice-btn[data-size]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedSize = btn.dataset.size;
        });
    });

    $('btn-back').onclick = () => { hide('setup-screen'); show('main-menu'); };
    $('btn-start').onclick = () => { hide('setup-screen'); _startGame(); };

    // In-game controls (delegated – buttons created before game starts)
    document.addEventListener('click', e => {
        const id = e.target?.id;
        if (id === 'btn-pause') _togglePause();
        if (id === 'btn-resume') _resumeGame();
        if (id === 'btn-speed') _cycleSpeed();
        if (id === 'btn-esc-menu') _togglePause();
        if (id === 'btn-to-menu') _quitToMenu();
        if (id === 'btn-play-again') _playAgain();
        if (id === 'btn-end-menu') _quitToMenu();
    });

    // Keyboard shortcut for build menu in-game
    window.addEventListener('keydown', e => {
        if (!game || game.paused || game.over) return;
        if (e.code === 'KeyB' && game.selection.hasWorkers) {
            e.preventDefault();
            buildMenu?.toggle();
        }
        if (e.code === 'Escape' && buildMenu?.open) {
            buildMenu.hide();
        }
    });
}

// ─── GAME START ──────────────────────────────────────────────────────────────
function _startGame() {
    const canvas = $('game-canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    show('game-screen');
    hide('end-screen');
    hide('pause-overlay');

    // Destroy old game
    if (animFrame) cancelAnimationFrame(animFrame);
    game = null;

    // Apply map size BEFORE creating Game (TileMap/FogOfWar read MapConfig at construction)
    MapConfig.setSize(selectedSize);

    game = new Game(canvas, selectedFaction, selectedDiff, selectedMap);

    // Wire build menu
    buildMenu = new BuildMenu(game);
    // Patch openBuildMenu in game to use the real build menu
    game.openBuildMenu = () => buildMenu.toggle();

    game.onGameOver = (won) => { _showEndScreen(won); };
    game.onAlert = (msg, type) => { game.hud?.addAlert(msg, type); };

    game.init();
    lastT = performance.now();
    _loop(lastT);

    // Resize handler
    window.onresize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        game.camera.resize(canvas.width, canvas.height);
    };
}

function _loop(ts) {
    const dt = (ts - lastT) / 1000;
    lastT = ts;
    game?.tick(dt);
    animFrame = requestAnimationFrame(_loop);
}

// ─── PAUSE ───────────────────────────────────────────────────────────────────
function _togglePause() {
    if (!game || game.over) return;
    if (game.paused) { _resumeGame(); }
    else { game.pause(); show('pause-overlay'); }
}
function _resumeGame() {
    if (!game) return;
    game.resume();
    hide('pause-overlay');
}

// ─── SPEED ───────────────────────────────────────────────────────────────────
function _cycleSpeed() {
    if (!game) return;
    game.speedIndex = (game.speedIndex + 1) % 4;
}

// ─── QUIT ────────────────────────────────────────────────────────────────────
function _quitToMenu() {
    if (animFrame) cancelAnimationFrame(animFrame);
    game = null;
    hide('game-screen');
    hide('pause-overlay');
    hide('end-screen');
    show('main-menu');
    window.onresize = null;
}

function _playAgain() {
    hide('end-screen');
    _startGame();
}

// ─── END SCREEN ──────────────────────────────────────────────────────────────
function _showEndScreen(won) {
    const title = $('end-title');
    title.textContent = won ? '🏆 Victoire !' : '💀 Défaite !';
    title.className = won ? 'victory' : 'defeat';

    // Stats
    const t = game?.elapsedTime || 0;
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    const st = game?.stats || {};
    $('end-stats').innerHTML = `
    ⏱ Durée de partie&nbsp;:&nbsp;<strong>${m}:${String(s).padStart(2, '0')}</strong><br>
    ⚔ Unités éliminées&nbsp;:&nbsp;<strong>${st.playerKills || 0}</strong><br>
    💀 Pertes subies&nbsp;:&nbsp;<strong>${st.aiKills || 0}</strong><br>
    🪙 Or récolté total&nbsp;:&nbsp;<strong>${Math.floor(game?.economy[game.playerFaction]?.gold || 0)}</strong><br>
    🪵 Bois récolté total&nbsp;:&nbsp;<strong>${Math.floor(game?.economy[game.playerFaction]?.wood || 0)}</strong>
  `;
    show('end-screen');
}
