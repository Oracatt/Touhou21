import type {RunOptions} from './src/shared-types.js';
declare global {var __TOUHOU21_OPTIONS:RunOptions|undefined;}
import {ProjectApplication} from './src/application.js';
globalThis.__tsstg_game=new ProjectApplication(globalThis.tsstg,globalThis.__TOUHOU21_OPTIONS??{});
