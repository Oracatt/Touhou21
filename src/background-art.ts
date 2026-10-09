/** Original RGBA material atlases. UV sampling never crops or edits pixels.
 * GameArt owns these borrowed textures, just like portraits and distant art. */
// Measured alpha bounds (threshold 48, two-pixel border, clipped inside each
// quadrant). These UV rectangles remove transparent padding without touching
// pixels, so the foot of a bridge or tree reaches its world-space baseline.
const PIXELS=[
  {ground:[3,3,624,624],landmark:[654,37,1231,594],edge:[7,638,624,1237],detail:[831,648,1056,1230]},
  {ground:[3,3,624,624],landmark:[649,15,1232,610],edge:[13,639,623,1240],detail:[703,684,1213,1138]},
  {ground:[3,3,624,624],landmark:[630,188,1251,441],edge:[17,741,622,1143],detail:[724,722,1176,1161]},
  {ground:[3,3,624,624],landmark:[684,5,1168,622],edge:[18,631,624,1246],detail:[642,634,1248,1239]},
  {ground:[3,3,624,624],landmark:[682,3,1200,621],edge:[23,635,606,1239],detail:[883,635,999,1242]},
  {ground:[3,3,624,624],landmark:[821,3,1060,623],edge:[11,784,624,1101],detail:[811,633,1072,1247]},
  {ground:[3,3,624,624],landmark:[789,3,1092,624],edge:[212,634,430,1248],detail:[808,633,1074,1243]},
];
export const SCENERY_ATLASES=Object.freeze(PIXELS.map((cells,i)=>Object.freeze({stage:i+1,path:`assets/scenery/stage0${i+1}-atlas.png`,width:1254,height:1254,regions:Object.freeze(Object.fromEntries(Object.entries(cells).map(([key,rect])=>[key,Object.freeze(rect.map(v=>v/1254))])))})));
export function sceneryRegion(stage:number,region:string){const rect=SCENERY_ATLASES[stage-1]?.regions[region];if(!rect)throw new RangeError(`Unknown scenery region ${stage}/${region}`);return rect;}

/** Separate low-frequency base and authored pattern images for each Boss.
 * Extra's paper-shikigami midboss retains her own artwork. Every layer has
 * explicit texture, blend, opacity and tint rather than layer-index policy. */
const layer=(value:SpellLayer)=>Object.freeze({...value,drift:Object.freeze(value.drift),rate:Object.freeze(value.rate)});
export interface SpellLayer{rotation:number;angle:number;sway?:number;drift:readonly number[];rate:readonly number[];zoom:number;breath:number;wave:number;grid:number;texture:string;blend:string;opacity:number;tint:number;mirror?:boolean;}
export interface SpellBackgroundStyle{bossId:string;stage:number;motif:string;textures:Readonly<Record<string,string>>;layers:readonly SpellLayer[];}
export const SPELL_BACKGROUND_STYLES:readonly SpellBackgroundStyle[]=Object.freeze([
  {bossId:'akari',stage:1,motif:'copper-flower-seal',tint:0xb8adaaff,layers:[
    {rotation:.00115,angle:.12,drift:[31,43],rate:[.0041,.0028],zoom:.045,breath:.0046,wave:0,grid:1},
    {rotation:-.0019,angle:.55,drift:[48,27],rate:[.0033,.0052],zoom:.065,breath:.0031,wave:0,grid:1},
  ]},
  {bossId:'shizuri',stage:2,motif:'rain-ink-stream',tint:0xb0bec0ff,layers:[
    {rotation:0,angle:-.06,sway:.022,drift:[18,94],rate:[.0044,.0032],zoom:.025,breath:.0031,wave:7,grid:6},
    {rotation:.00019,angle:.04,drift:[33,77],rate:[.0057,-.0048],zoom:.04,breath:.0042,wave:9,grid:6},
  ]},
  {bossId:'watari',stage:3,motif:'water-memory-ripple',tint:0xafbeb7ff,layers:[
    {rotation:.00023,angle:0,sway:.07,drift:[62,39],rate:[.0036,.0041],zoom:.06,breath:.0024,wave:13,grid:6},
    {rotation:-.00056,angle:.39,sway:.04,drift:[39,67],rate:[-.0045,.0031],zoom:.08,breath:.0037,wave:10,grid:6},
  ]},
  {bossId:'shino',stage:4,motif:'purple-brocade-weave',tint:0xb9aec1ff,layers:[
    {rotation:0,angle:.32,sway:.045,drift:[77,29],rate:[.0048,.0031],zoom:.04,breath:.0029,wave:7,grid:6},
    {rotation:-.00064,angle:-.41,sway:.03,drift:[47,73],rate:[-.0039,.0045],zoom:.055,breath:.0041,wave:8,grid:6},
  ]},
  {bossId:'fusae',stage:5,motif:'green-name-seal',tint:0xb0bcb3ff,layers:[
    {rotation:.00048,angle:-.12,drift:[24,81],rate:[.0027,-.0034],zoom:.035,breath:.0041,wave:0,grid:1},
    {rotation:-.00121,angle:.46,drift:[62,34],rate:[.0042,.0024],zoom:.075,breath:.0028,wave:0,grid:1},
  ]},
  {bossId:'kotone',stage:6,motif:'indigo-word-mandala',tint:0xb8b3c2ff,layers:[
    {rotation:-.00087,angle:0,drift:[29,37],rate:[.0021,.0028],zoom:.07,breath:.0033,wave:5,grid:6},
    {rotation:.00174,angle:.35,drift:[44,24],rate:[.0037,-.0031],zoom:.095,breath:.0024,wave:6,grid:6},
  ]},
  {bossId:'mio',stage:7,motif:'inverted-mirror-echo',tint:0xb4b3c5ff,layers:[
    {rotation:-.00091,angle:.17,sway:.04,drift:[47,42],rate:[.0041,.0033],zoom:.065,breath:.0046,wave:10,grid:6},
    {rotation:.00137,angle:-.21,drift:[42,57],rate:[-.0034,.0047],zoom:.085,breath:.0031,wave:12,grid:6,mirror:true},
  ]},
].map(style=>{
  const first=style.layers[0],second=style.layers[1];
  const base={rotation:first.rotation*.18,angle:first.angle*.3,drift:first.drift.map(value=>value*.38),rate:first.rate.map(value=>value*.47),
    zoom:first.zoom*.35,breath:first.breath*.4,wave:0,grid:1,texture:'base',blend:'alpha',opacity:1,tint:0xe4e4e4ff};
  const pattern={...first,texture:'pattern',blend:'alpha',opacity:[.46,.48,.42,.50,.43,.45,.46][style.stage-1],tint:style.tint};
  const echo={...second,texture:'pattern',blend:['add','add','subtract','subtract','subtract','add','add'][style.stage-1],opacity:[.095,.08,.085,.075,.08,.095,.105][style.stage-1],tint:style.tint};
  return Object.freeze({bossId:style.bossId,stage:style.stage,motif:style.motif,
    textures:Object.freeze({base:`assets/spells/${style.bossId}-base.png`,pattern:`assets/spells/${style.bossId}.png`}),
    layers:Object.freeze([base,pattern,echo].map(layer))});
}));
export function spellBackgroundStyle(bossId:string|undefined,stage=1){return SPELL_BACKGROUND_STYLES.find(style=>style.bossId===bossId)??SPELL_BACKGROUND_STYLES[stage-1]??SPELL_BACKGROUND_STYLES[0];}
