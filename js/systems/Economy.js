// js/systems/Economy.js – Resource manager per faction
import { START_GOLD, START_WOOD, FOOD_START, MAX_FOOD } from '../constants.js';

export function createEconomy() {
    return {
        human: { gold: START_GOLD, wood: START_WOOD, food: 0, foodMax: FOOD_START },
        orc: { gold: START_GOLD, wood: START_WOOD, food: 0, foodMax: FOOD_START },
    };
}

export function canAfford(eco, cost) {
    return eco.gold >= (cost.gold || 0) && eco.wood >= (cost.wood || 0);
}

export function spend(eco, cost) {
    eco.gold -= (cost.gold || 0);
    eco.wood -= (cost.wood || 0);
}

export function refund(eco, cost, ratio = 0.75) {
    eco.gold += Math.round((cost.gold || 0) * ratio);
    eco.wood += Math.round((cost.wood || 0) * ratio);
}
