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
export function sceneryRegion(stage,region){const rect=SCENERY_ATLASES[stage-1]?.regions[region];if(!rect)throw new RangeError(`Unknown scenery region ${stage}/${region}`);return rect;}
