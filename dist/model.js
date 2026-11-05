export const PLOT = Object.freeze({ w: 50, h: 90, area: 4500 });
export const KINDS = {
  covered: { label: 'Covered', fill: '#e5ddcf', stroke: '#96866b' },
  garden: { label: 'Landscape', fill: '#dce7cf', stroke: '#7c9566' },
  water: { label: 'Water', fill: '#cee2e4', stroke: '#6b9da1' },
  paving: { label: 'Hardscape', fill: '#eee3d1', stroke: '#b49872' }
};
const space = (id, name, kind, x, y, w, h) => ({ id, name, kind, x, y, w, h });
export const PRESETS = [
  { id: 'garden', title: 'Garden first', tag: 'More room outdoors', description: 'A compact home at the rear, a generous central lawn, and front parking.', tradeoff: 'Best for outdoor gatherings. A smaller house keeps more of the plot open.',
    spaces: [space('home','Main house','covered',5,5,30,25),space('utility','Utility','covered',38,5,8,10),space('lawn','Main lawn','garden',5,35,35,30),space('gazebo','Gazebo','covered',30,69,12,12),space('parking','Parking','paving',5,70,20,16),space('path','Side path','paving',43,20,5,65)] },
  { id: 'pool', title: 'Pool courtyard', tag: 'Made for hosting', description: 'A side-facing home and pool create an outdoor courtyard, with parking by the front road.', tradeoff: 'Best for entertaining. The pool and terrace use space otherwise available for planting.',
    spaces: [space('home','Main house','covered',3,5,25,34),space('utility','Utility','covered',33,5,10,10),space('pool','Pool','water',32,22,14,28),space('deck','Pool terrace','paving',30,53,17,12),space('lawn','Courtyard lawn','garden',3,44,24,20),space('gazebo','Gazebo','covered',33,69,12,12),space('parking','Parking','paving',3,70,24,16)] },
  { id: 'family', title: 'Family retreat', tag: 'A larger home', description: 'A wider rear home with a front garden, shaded sitting space, and a separate utility corner.', tradeoff: 'Best for longer stays. More covered space means a smaller garden than Garden first.',
    spaces: [space('home','Main house','covered',5,5,40,30),space('utility','Utility','covered',35,40,10,12),space('lawn','Family garden','garden',5,40,25,25),space('gazebo','Gazebo','covered',33,58,12,12),space('parking','Parking','paving',5,72,24,14),space('patio','Patio','paving',33,74,12,12)] }
];
export const CATALOG = [
  { name:'Main house', kind:'covered', w:25, h:25 },
  { name:'Lawn', kind:'garden', w:20, h:20 },
  { name:'Pool', kind:'water', w:12, h:24 },
  { name:'Gazebo', kind:'covered', w:12, h:12 },
  { name:'Parking', kind:'paving', w:20, h:16 },
  { name:'Utility', kind:'covered', w:8, h:10 },
  { name:'Patio / path', kind:'paving', w:12, h:12 }
];
export const ROADS = {
  opposite: ['top','bottom'], sides: ['left','right'],
  frontLeft: ['bottom','left'], frontRight: ['bottom','right'],
  rearLeft: ['top','left'], rearRight: ['top','right']
};
export const clone = value => JSON.parse(JSON.stringify(value));
export function bounded(s) {
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const w = Math.max(4, Math.min(PLOT.w, Math.round(finite(s.w, 10))));
  const h = Math.max(4, Math.min(PLOT.h, Math.round(finite(s.h, 10))));
  return { ...s, w, h, x: Math.max(0, Math.min(PLOT.w-w, Math.round(finite(s.x,0)))), y: Math.max(0, Math.min(PLOT.h-h, Math.round(finite(s.y,0)))) };
}
export function intersects(a,b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}
export function overlaps(spaces) {
  const pairs = [];
  for(let i=0;i<spaces.length;i++) for(let j=i+1;j<spaces.length;j++) if(intersects(spaces[i],spaces[j])) pairs.push([spaces[i],spaces[j]]);
  return pairs;
}
// Sweep-line union counts every square foot once, including nested / overlapping zones.
export function unionArea(spaces) {
  if(!spaces.length) return 0;
  const xs = [...new Set(spaces.flatMap(s=>[s.x,s.x+s.w]))].sort((a,b)=>a-b);
  let area=0;
  for(let i=0;i<xs.length-1;i++) {
    const intervals=spaces.filter(s=>s.x<xs[i+1] && s.x+s.w>xs[i]).map(s=>[s.y,s.y+s.h]).sort((a,b)=>a[0]-b[0]);
    let end=-Infinity, length=0;
    for(const [a,b] of intervals) { if(a>=end){length+=b-a;end=b;} else if(b>end){length+=b-end;end=b;} }
    area+=(xs[i+1]-xs[i])*length;
  }
  return area;
}
export function metrics(spaces) {
  const covered=unionArea(spaces.filter(s=>s.kind==='covered'));
  const allocated=unionArea(spaces);
  return { covered, allocated, open:PLOT.area-covered, unallocated:PLOT.area-allocated, coverage:covered/PLOT.area*100 };
}
export function findPosition(spaces, w, h) {
  for(let y=2;y<=PLOT.h-h;y++) for(let x=2;x<=PLOT.w-w;x++) if(!spaces.some(s=>intersects(s,{x,y,w,h}))) return {x,y};
  return null;
}
export function initialState() { return { version:1, active:'garden', roads:'opposite', variants:PRESETS.map(p=>({id:p.id, spaces:clone(p.spaces)})) }; }
export function hydrate(raw) {
  try {
    const s = typeof raw==='string' ? JSON.parse(raw) : raw;
    if(s?.version!==1 || !PRESETS.some(p=>p.id===s.active) || !ROADS[s.roads] || !Array.isArray(s.variants) || s.variants.length!==3) return null;
    const variants=PRESETS.map(p=>{
      const v=s.variants.find(v=>v.id===p.id);
      if(!v || !Array.isArray(v.spaces) || v.spaces.length>30) throw new Error('Invalid spaces');
      const ids=new Set();
      const spaces=v.spaces.map(r=>{
        if(typeof r.id!=='string' || !r.id || ids.has(r.id) || typeof r.name!=='string' || !KINDS[r.kind] || !['x','y','w','h'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k]))) throw new Error('Invalid geometry');
        ids.add(r.id); return bounded({...r,name:r.name.slice(0,36)});
      });
      return {id:p.id,spaces};
    });
    return { version:1,active:s.active,roads:s.roads,variants };
  } catch { return null; }
}
