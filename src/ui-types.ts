export interface BackgroundGame{frame?:number;paused?:boolean;spell?:{active:boolean;id?:number;captureIndex?:number;age?:{current:number}};context?:{boss?:{bossId?:string}|null}}
export interface StageIdentity{id:number;background?:string;}
export interface SpellVisualCard{key:string;bossId:string;style:number;born:number;retired:number|null;retireAlpha:number;phase:number;}
export interface VisibleSpellCard extends SpellVisualCard{age:number;opacity:number;}
export type MeshVertex=[number,number,number,number,number];export type MeshVertex3D=[number,number,number,number,number,number];
export interface PanelOptions{tag?:string;alpha?:number;light?:number;flip?:boolean;v0?:number;v1?:number;yaw?:number;region?:string;rise?:number;}
