// js/constants.js – Game-wide constants

export const TILE_SIZE = 32;
export const MAP_W = 128;
export const MAP_H = 128;

export const TILE = {
  GRASS:0, WATER:1, FOREST:2, MOUNTAIN:3,
  GOLD_MINE:4, SAND:5, DEEP_WATER:6, ROAD:7
};

export const FOG = { UNEXPLORED:0, EXPLORED:1, VISIBLE:2 };

export const STATE = {
  IDLE:'idle', MOVING:'moving', ATTACKING:'attacking',
  HARVESTING:'harvesting', RETURNING:'returning',
  CONSTRUCTING:'constructing', DEAD:'dead', HOLD:'hold'
};

export const FACTION = { HUMAN:'human', ORC:'orc', NEUTRAL:'neutral' };

export const RESOURCE = { GOLD:'gold', WOOD:'wood', FOOD:'food' };

export const CAM_SPEED  = 380; // px/s
export const CAM_EDGE   = 22;  // px from edge

export const AI_RATE = { easy:5000, normal:2500, hard:1200 };

export const PROJ_SPEED = 220; // px/s
export const DEATH_TIME = 2000; // ms before cleanup

export const GAME_SPEEDS = [0.5,1,2,3];
export const SPEED_LABELS = ['×½','×1','×2','×3'];

export const START_GOLD  = 500;
export const START_WOOD  = 200;
export const FOOD_START  = 10;
export const HARVEST_CARRY = 10;      // per trip
export const HARVEST_TICK  = 1.2;     // seconds per harvest action
export const HARVEST_RETURN_RANGE = 3;// tiles from TH to deposit

export const SIGHT_BONUS = 0; // global sight range modifier

export const BUILD_PREVIEW_OK   = 'rgba(0,220,0,0.25)';
export const BUILD_PREVIEW_BAD  = 'rgba(220,0,0,0.25)';

export const COLOR = {
  SEL:'#00ff44', SEL_BG:'rgba(0,255,68,.04)',
  ATK:'rgba(255,80,0,.6)',
  HP_H:'#00dd00', HP_M:'#ddcc00', HP_L:'#dd2200',
  FOG_UNX:'rgba(0,0,0,1)', FOG_EXP:'rgba(0,0,0,0.62)',
  TILE:{
    0:'#3a6632', 1:'#1a4a8a', 2:'#1e4a1e',
    3:'#5a5a5a', 4:'#c8a000', 5:'#c8a864',
    6:'#0e2e6a', 7:'#886644'
  },
  HUMAN:'#4488ff', ORC:'#ff4422',
};

// Max units per faction
export const MAX_FOOD = 50;

// Building sizes in tiles (w,h)
export const BSIZE = {
  town_hall:[4,4], barracks:[3,3], farm:[2,2],
  blacksmith:[2,2], tower:[1,2], wall:[1,1],
  mage_tower:[2,3], mine:[1,1],
};

// Key codes
export const KEY = {
  W:87,A:65,S:83,D:68,F:70,H:72,G:71,
  ESCAPE:27,SPACE:32,ENTER:13,
  PLUS:187,MINUS:189, NUMPLUS:107, NUMMINUS:109,
};
