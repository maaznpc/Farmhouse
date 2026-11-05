import test from 'node:test';
import assert from 'node:assert/strict';
import { PLOT, PRESETS, bounded, metrics, overlaps, unionArea, findPosition, hydrate, initialState } from '../dist/model.js';

test('all three starting plans fit, do not overlap, and have independently checked areas',()=>{
  const expected={garden:{covered:974,allocated:2669,open:3526,unallocated:1831},pool:{covered:1094,allocated:2554,open:3406,unallocated:1946},family:{covered:1464,allocated:2569,open:3036,unallocated:1931}};
  for(const preset of PRESETS){
    assert.equal(overlaps(preset.spaces).length,0,preset.id);
    for(const s of preset.spaces){assert.ok(s.x>=0&&s.y>=0&&s.x+s.w<=50&&s.y+s.h<=90);}
    const actual=metrics(preset.spaces);
    for(const [key,value] of Object.entries(expected[preset.id])) assert.equal(actual[key],value,preset.id+' '+key);
    assert.equal(actual.covered+actual.open,PLOT.area);
  }
});
test('area is a union: nested, crossing, identical and edge-touching zones count correctly',()=>{
  const a={x:0,y:0,w:10,h:10},b={x:5,y:5,w:10,h:10};
  assert.equal(unionArea([a,b]),175);
  assert.equal(unionArea([a,a,{x:1,y:1,w:2,h:2}]),100);
  assert.equal(unionArea([a,{...a,x:10}]),200);
  assert.equal(overlaps([a,{...a,x:10}]).length,0);
  assert.deepEqual(metrics([{...a,kind:'covered'},{...b,kind:'garden'}]),{covered:100,allocated:175,open:4400,unallocated:4325,coverage:100/45});
  assert.equal(unionArea([]),0);
});
test('sweep-line area agrees with an independent 1 sq ft occupancy oracle',()=>{
  let seed=55;const rand=max=>{seed=(seed*1664525+1013904223)>>>0;return seed%max;};
  for(let trial=0;trial<75;trial++){
    const spaces=Array.from({length:12},()=>bounded({x:rand(50),y:rand(90),w:rand(40)+4,h:rand(75)+4}));
    let occupied=0;
    for(let x=0;x<50;x++)for(let y=0;y<90;y++)if(spaces.some(s=>x>=s.x&&x<s.x+s.w&&y>=s.y&&y<s.y+s.h))occupied++;
    assert.equal(unionArea(spaces),occupied);
  }
});
test('geometry snaps and clamps, placement finds a clear area or reports none',()=>{
  assert.deepEqual(bounded({x:-4,y:89,w:100,h:10}),{x:0,y:80,w:50,h:10});
  assert.deepEqual(bounded({x:4.6,y:5.4,w:9.7,h:2}),{x:5,y:5,w:10,h:4});
  assert.deepEqual(findPosition([],10,10),{x:2,y:2});
  assert.equal(findPosition([{x:0,y:0,w:50,h:90}],4,4),null);
});
test('persisted layouts are validated and malformed data falls back safely',()=>{
  const s=initialState();assert.deepEqual(hydrate(JSON.stringify(s)),s);
  assert.equal(hydrate('{bad'),null);assert.equal(hydrate(null),null);
  s.variants[0].spaces[0].w=Infinity;assert.equal(hydrate(s),null);
  const d=initialState();d.variants[0].spaces[1].id=d.variants[0].spaces[0].id;assert.equal(hydrate(d),null);
});
