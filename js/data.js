// js/data.js – All unit, building, research data tables
import { FACTION } from './constants.js';

// ─── UNIT DATA ────────────────────────────────────────────────────────────────
// hp, dmg, range(tiles), speed(px/s), sight(tiles), armor, cost{gold,wood,food},
// trainTime(s), icon, label, attackRate(s), isWorker, isHero, projectile

export const UNITS = {
    // === HUMAN FACTION ===
    peasant: {
        faction: FACTION.HUMAN, label: 'Paysan', icon: '👷',
        hp: 60, dmg: 6, range: 1, speed: 90, sight: 5, armor: 0,
        cost: { gold: 75, wood: 0, food: 1 }, trainTime: 15, attackRate: 1.5,
        isWorker: true,
        desc: 'Récolte les ressources et construit des édifices'
    },
    footman: {
        faction: FACTION.HUMAN, label: 'Fantassin', icon: '⚔️',
        hp: 120, dmg: 18, range: 1, speed: 80, sight: 5, armor: 2,
        cost: { gold: 135, wood: 0, food: 1 }, trainTime: 18, attackRate: 1.4,
        desc: 'Infanterie polyvalente, efficace au corps à corps'
    },
    archer: {
        faction: FACTION.HUMAN, label: 'Archer', icon: '🏹',
        hp: 80, dmg: 15, range: 5, speed: 85, sight: 7, armor: 0,
        cost: { gold: 135, wood: 50, food: 1 }, trainTime: 20, attackRate: 1.8,
        projectile: 'arrow',
        desc: 'Attaque à distance, vulnérable en mêlée'
    },
    knight: {
        faction: FACTION.HUMAN, label: 'Chevalier', icon: '🐴',
        hp: 200, dmg: 26, range: 1, speed: 140, sight: 5, armor: 4,
        cost: { gold: 250, wood: 80, food: 2 }, trainTime: 30, attackRate: 1.2,
        requires: 'blacksmith_upgrade2',
        desc: 'Cavalier puissant, rapide et résistant'
    },
    mage: {
        faction: FACTION.HUMAN, label: 'Mage', icon: '🔮',
        hp: 60, dmg: 35, range: 6, speed: 75, sight: 7, armor: 0,
        cost: { gold: 200, wood: 100, food: 1 }, trainTime: 25, attackRate: 2.5,
        projectile: 'fireball',
        splash: 2,
        requires: 'mage_tower',
        desc: 'Lance des boules de feu, dégâts de zone'
    },
    paladin: {
        faction: FACTION.HUMAN, label: 'Paladin', icon: '✨',
        hp: 350, dmg: 30, range: 1, speed: 100, sight: 7, armor: 5,
        cost: { gold: 500, wood: 200, food: 3 }, trainTime: 45, attackRate: 1.0,
        isHero: true, ability: 'heal',
        requires: 'castle',
        desc: 'Héros des humains – Peut soigner les unités alliées'
    },

    // === ORC FACTION ===
    grunt: {
        faction: FACTION.ORC, label: 'Grunt', icon: '🪓',
        hp: 60, dmg: 6, range: 1, speed: 90, sight: 5, armor: 0,
        cost: { gold: 75, wood: 0, food: 1 }, trainTime: 15, attackRate: 1.5,
        isWorker: true,
        desc: 'Worker orc – récolte et construction'
    },
    berserker: {
        faction: FACTION.ORC, label: 'Berserker', icon: '💢',
        hp: 150, dmg: 22, range: 1, speed: 75, sight: 5, armor: 1,
        cost: { gold: 135, wood: 0, food: 1 }, trainTime: 20, attackRate: 1.6,
        desc: 'Guerrier furieux – plus de dégâts mais moins de défense'
    },
    goblin_archer: {
        faction: FACTION.ORC, label: 'Archer Gobelin', icon: '🏹',
        hp: 65, dmg: 13, range: 6, speed: 90, sight: 8, armor: 0,
        cost: { gold: 135, wood: 50, food: 1 }, trainTime: 20, attackRate: 1.7,
        projectile: 'arrow',
        desc: 'Portée légèrement supérieure, mais fragile'
    },
    worg_rider: {
        faction: FACTION.ORC, label: 'Worg Rider', icon: '🐺',
        hp: 180, dmg: 24, range: 1, speed: 160, sight: 5, armor: 3,
        cost: { gold: 250, wood: 80, food: 2 }, trainTime: 30, attackRate: 1.1,
        requires: 'blacksmith_upgrade2',
        desc: 'Plus rapide que le chevalier humain'
    },
    shaman: {
        faction: FACTION.ORC, label: 'Chaman', icon: '⚡',
        hp: 70, dmg: 28, range: 6, speed: 75, sight: 7, armor: 0,
        cost: { gold: 200, wood: 100, food: 1 }, trainTime: 25, attackRate: 2.2,
        projectile: 'lightning',
        requires: 'altar',
        desc: 'Foudre chaînante sur plusieurs cibles'
    },
    beastmaster: {
        faction: FACTION.ORC, label: 'Beastmaster', icon: '🦁',
        hp: 380, dmg: 34, range: 1, speed: 105, sight: 7, armor: 4,
        cost: { gold: 500, wood: 200, food: 3 }, trainTime: 45, attackRate: 0.9,
        isHero: true, ability: 'summon_wolves',
        requires: 'fortress',
        desc: 'Héros orc – Invoque deux loups temporaires'
    },
};

// ─── BUILDING DATA ─────────────────────────────────────────────────────────
// For each faction variant we use a "base type" to drive logic

export const BUILDINGS = {
    // === HUMAN ===
    town_hall: {
        faction: FACTION.HUMAN, label: 'Town Hall', icon: '🏰',
        hp: 1200, armor: 5, sight: 7,
        cost: { gold: 1200, wood: 800 }, buildTime: 120,
        size: [4, 4], isBase: true,
        produces: ['peasant'],
        upgrades: ['keep'],
        desc: 'Centre de commandement humain'
    },
    keep: {
        faction: FACTION.HUMAN, label: 'Keep', icon: '🏯',
        hp: 1600, armor: 6, sight: 9,
        cost: { gold: 2000, wood: 1000 }, buildTime: 150,
        size: [4, 4], isBase: true, upgradeOf: 'town_hall',
        produces: ['peasant'],
        upgrades: ['castle'],
        desc: 'Town Hall amélioré – débloque chevalier et mage'
    },
    castle: {
        faction: FACTION.HUMAN, label: 'Castle', icon: '🏰',
        hp: 2000, armor: 8, sight: 10,
        cost: { gold: 2500, wood: 1200 }, buildTime: 180,
        size: [4, 4], isBase: true, upgradeOf: 'keep',
        produces: ['peasant', 'paladin'],
        desc: 'Forteresse ultime – invocation du Paladin'
    },
    barracks: {
        faction: FACTION.HUMAN, label: 'Caserne', icon: '⚔️',
        hp: 800, armor: 3, sight: 6,
        cost: { gold: 700, wood: 450 }, buildTime: 70,
        size: [3, 3],
        produces: ['footman', 'archer'],
        requires: 'town_hall',
        desc: 'Entraîne le fantassin et l\'archer'
    },
    farm: {
        faction: FACTION.HUMAN, label: 'Ferme', icon: '🌾',
        hp: 400, armor: 0, sight: 4,
        cost: { gold: 500, wood: 250 }, buildTime: 40,
        size: [2, 2], foodBonus: 4,
        desc: 'Fournit +4 de nourriture'
    },
    blacksmith: {
        faction: FACTION.HUMAN, label: 'Forgeron', icon: '⚒️',
        hp: 700, armor: 3, sight: 5,
        cost: { gold: 800, wood: 450 }, buildTime: 60,
        size: [2, 2],
        researches: ['weapon1', 'weapon2', 'weapon3', 'armor1', 'armor2', 'armor3', 'cavalry_training'],
        requires: 'barracks',
        desc: 'Améliorations offensives et défensives'
    },
    tower: {
        faction: FACTION.HUMAN, label: 'Tour de Défense', icon: '🗼',
        hp: 500, armor: 5, sight: 9,
        cost: { gold: 550, wood: 200 }, buildTime: 35,
        size: [1, 2],
        dmg: 20, range: 7, attackRate: 2.0,
        projectile: 'arrow',
        isTower: true,
        requires: 'barracks',
        desc: 'Défense statique à longue portée'
    },
    mage_tower: {
        faction: FACTION.HUMAN, label: 'Tour des Mages', icon: '🔮',
        hp: 600, armor: 2, sight: 7,
        cost: { gold: 1000, wood: 600 }, buildTime: 90,
        size: [2, 3],
        produces: ['mage'],
        researches: ['magic_range', 'splash_upgrade'],
        requires: 'keep',
        desc: 'Forme les mages et améliore la magie'
    },
    wall: {
        faction: FACTION.HUMAN, label: 'Mur', icon: '🧱',
        hp: 350, armor: 8, sight: 3,
        cost: { gold: 200, wood: 100 }, buildTime: 15,
        size: [1, 1], isWall: true,
        desc: 'Fortification passive'
    },

    // === ORC ===
    great_hall: {
        faction: FACTION.ORC, label: 'Grande Salle', icon: '🔥',
        hp: 1200, armor: 5, sight: 7,
        cost: { gold: 1200, wood: 800 }, buildTime: 120,
        size: [4, 4], isBase: true,
        produces: ['grunt'],
        upgrades: ['stronghold'],
        desc: 'Centre de commandement orc'
    },
    stronghold: {
        faction: FACTION.ORC, label: 'Forteresse Orc', icon: '💀',
        hp: 1600, armor: 6, sight: 9,
        cost: { gold: 2000, wood: 1000 }, buildTime: 150,
        size: [4, 4], isBase: true, upgradeOf: 'great_hall',
        produces: ['grunt'],
        upgrades: ['fortress'],
        desc: 'Grande Salle améliorée'
    },
    fortress: {
        faction: FACTION.ORC, label: 'Citadelle Orc', icon: '🏚️',
        hp: 2000, armor: 8, sight: 10,
        cost: { gold: 2500, wood: 1200 }, buildTime: 180,
        size: [4, 4], isBase: true, upgradeOf: 'stronghold',
        produces: ['grunt', 'beastmaster'],
        desc: 'Citadelle ultime – invoque le Beastmaster'
    },
    orc_barracks: {
        faction: FACTION.ORC, label: 'Corps de Garde', icon: '🪓',
        hp: 800, armor: 3, sight: 6,
        cost: { gold: 700, wood: 450 }, buildTime: 70,
        size: [3, 3],
        produces: ['berserker', 'goblin_archer'],
        requires: 'great_hall',
        desc: 'Entraîne le Berserker et l\'Archer Gobelin'
    },
    pig_farm: {
        faction: FACTION.ORC, label: 'Enclos à Cochons', icon: '🐷',
        hp: 400, armor: 0, sight: 4,
        cost: { gold: 500, wood: 250 }, buildTime: 40,
        size: [2, 2], foodBonus: 4,
        desc: 'Fournit +4 de nourriture'
    },
    forge: {
        faction: FACTION.ORC, label: 'Forge Orc', icon: '🔨',
        hp: 700, armor: 3, sight: 5,
        cost: { gold: 800, wood: 450 }, buildTime: 60,
        size: [2, 2],
        researches: ['weapon1', 'weapon2', 'weapon3', 'armor1', 'armor2', 'armor3', 'cavalry_training'],
        requires: 'orc_barracks',
        desc: 'Améliorations de combat orcs'
    },
    watch_tower: {
        faction: FACTION.ORC, label: 'Tour de Guet', icon: '🗼',
        hp: 500, armor: 5, sight: 9,
        cost: { gold: 550, wood: 200 }, buildTime: 35,
        size: [1, 2],
        dmg: 18, range: 7, attackRate: 1.8,
        projectile: 'arrow',
        isTower: true,
        requires: 'orc_barracks',
        desc: 'Tour défensive orc'
    },
    altar: {
        faction: FACTION.ORC, label: 'Autel des Tempêtes', icon: '⚡',
        hp: 600, armor: 2, sight: 7,
        cost: { gold: 1000, wood: 600 }, buildTime: 90,
        size: [2, 3],
        produces: ['shaman'],
        researches: ['magic_range', 'lightning_chain'],
        requires: 'stronghold',
        desc: 'Forme les Chamans orcs'
    },
    orc_wall: {
        faction: FACTION.ORC, label: 'Pieux', icon: '🪵',
        hp: 300, armor: 6, sight: 3,
        cost: { gold: 200, wood: 100 }, buildTime: 15,
        size: [1, 1], isWall: true,
        desc: 'Barricade de bois'
    },
};

// ─── RESEARCH DATA ──────────────────────────────────────────────────────────
export const RESEARCH = {
    weapon1: { label: 'Armes +1', icon: '⚔️', cost: { gold: 300, wood: 0 }, time: 40, effect: { dmg: +3 }, desc: '+3 dégâts à toutes les unités' },
    weapon2: { label: 'Armes +2', icon: '⚔️', cost: { gold: 600, wood: 0 }, time: 60, effect: { dmg: +3 }, requires: 'weapon1', desc: '+3 dégâts supplémentaires' },
    weapon3: { label: 'Armes +3', icon: '⚔️', cost: { gold: 1000, wood: 0 }, time: 90, effect: { dmg: +4 }, requires: 'weapon2', desc: '+4 dégâts supplémentaires' },
    armor1: { label: 'Armure +1', icon: '🛡️', cost: { gold: 300, wood: 0 }, time: 40, effect: { armor: +2 }, desc: '+2 armure à toutes les unités' },
    armor2: { label: 'Armure +2', icon: '🛡️', cost: { gold: 600, wood: 0 }, time: 60, effect: { armor: +2 }, requires: 'armor1', desc: '+2 armure supplémentaire' },
    armor3: { label: 'Armure +3', icon: '🛡️', cost: { gold: 1000, wood: 0 }, time: 90, effect: { armor: +3 }, requires: 'armor2', desc: '+3 armure supplémentaire' },
    cavalry_training: {
        label: 'Monture de guerre', icon: '🐴', cost: { gold: 1000, wood: 0 }, time: 80, effect: { speed: +20 },
        desc: 'Cavaliers +20 vitesse de déplacement', requires: 'armor1'
    },
    magic_range: { label: 'Portée Magique', icon: '✨', cost: { gold: 800, wood: 200 }, time: 60, effect: { range: +1 }, desc: 'Mages et chamans +1 portée' },
    splash_upgrade: {
        label: 'Onde de Choc', icon: '💥', cost: { gold: 1200, wood: 400 }, time: 80, effect: { splash: +1 },
        desc: 'Rayon de splash +1 pour les lanceurs de sorts', requires: 'magic_range'
    },
    lightning_chain: {
        label: 'Foudre en Chaîne', icon: '⚡', cost: { gold: 1200, wood: 400 }, time: 80, effect: { chain: 2 },
        desc: 'La foudre rebondit sur 2 cibles supplémentaires', requires: 'magic_range'
    },
    blacksmith_upgrade2: {
        label: 'Maîtrise de l\'acier', icon: '⚒️', cost: { gold: 1500, wood: 0 }, time: 100, effect: {},
        desc: 'Débloque Chevalier et Worg Rider', requires: 'weapon2'
    },
};

// ─── MAPS: factions to building/unit lists ──────────────────────────────────
export const FACTION_DATA = {
    human: {
        buildings: ['town_hall', 'keep', 'castle', 'barracks', 'farm', 'blacksmith', 'tower', 'mage_tower', 'wall'],
        workers: ['peasant'],
        baseBuilding: 'town_hall',
        barracks: 'barracks',
        farm: 'farm',
        smith: 'blacksmith',
        upgradedBase1: 'keep',
        upgradedBase2: 'castle',
    },
    orc: {
        buildings: ['great_hall', 'stronghold', 'fortress', 'orc_barracks', 'pig_farm', 'forge', 'watch_tower', 'altar', 'orc_wall'],
        workers: ['grunt'],
        baseBuilding: 'great_hall',
        barracks: 'orc_barracks',
        farm: 'pig_farm',
        smith: 'forge',
        upgradedBase1: 'stronghold',
        upgradedBase2: 'fortress',
    }
};

// Colors for each faction
export const FACTION_COLOR = {
    human: '#4888ff',
    orc: '#ff4422'
};
