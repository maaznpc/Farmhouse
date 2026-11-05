import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initialState } from '../dist/model.js';

// DOM event harness: tests production handlers without a browser dependency.
class Element {
  constructor(id){this.id=id;this.listeners={};this.dataset={};this.hidden=false;this.value='';this.checked=true;this.disabled=false;this.style={};this.tagName='DIV';this.attributes={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};this.captured=new Set();}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  fire(type,extra={}){const e={target:this,preventDefault(){},...extra};for(const fn of this.listeners[type]||[])fn(e);return e;}
  setAttribute(k,v){this.attributes[k]=v;}
  get valueAsNumber(){return this.value===''?NaN:Number(this.value);}
  closest(selector){if(selector==='[data-block]'&&this.dataset.block)return this;if(selector==='[data-resize]'&&this.dataset.resize)return this;if(selector==='[data-variant]'&&this.dataset.variant)return this;if(selector==='[data-select]'&&this.dataset.select)return this;if(selector==='[data-use]'&&this.dataset.use)return this;if(selector==='[data-add]'&&this.dataset.add!==undefined)return this;return this.parent?.closest(selector)||null;}
  focus(){this.focused=true;}
  scrollIntoView(){this.scrolled=true;}
  showModal(){this.open=true;}
  querySelector(){return new Element('queried-block');}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);}
  createSVGPoint(){return {x:0,y:0,matrixTransform(matrix){return {x:this.x*matrix.a+matrix.e,y:this.y*matrix.d+matrix.f};}};}
  getScreenCTM(){return {inverse(){return {a:.2,d:.2,e:-4,f:-6};}};}
}
let run=0;
async function setup(raw=null,failStorage=false){
  const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,new Element(id)]));
  for(const [tag,id] of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) elements[id].hidden=/\shidden(?:\s|>)/.test(tag);
  const doc=new Element('document');doc.getElementById=id=>{assert.ok(elements[id],'Known DOM id '+id);return elements[id];};
  globalThis.document=doc;globalThis.CSS={escape:s=>s};
  const store=new Map();if(raw!==null)store.set('fieldwork-farmhouse-v1',raw);
  globalThis.localStorage={getItem:k=>{if(failStorage)throw Error('disabled');return store.get(k)||null;},setItem:(k,v)=>{if(failStorage)throw Error('quota');store.set(k,v);}};
  await import('../dist/app.js?run='+(++run));
  const state=()=>JSON.parse(store.get('fieldwork-farmhouse-v1'));
  const spaces=()=>{const s=state();return s.variants.find(v=>v.id===s.active).spaces;};
  const target=dataset=>{const e=new Element('target');e.dataset=dataset;return e;};
  const click=(id,dataset)=>elements[id].fire('click',dataset?{target:target(dataset)}:{});
  const input=(key,value)=>{elements['space-'+key].value=String(value);elements['space-'+key].fire('change');};
  const pointer=(type,id,x,y,resize=false)=>{const t=target({block:id});const handle=target({resize:id});handle.parent=t;elements.plot.fire(type,{target:resize?handle:t,pointerId:1,button:0,clientX:x*5+20,clientY:y*5+30});};
  return {elements,store,state,spaces,target,click,input,pointer,doc};
}
test('initial render, dimensions, type, rename, rotate, removal and undo/redo',async()=>{
  const a=await setup();
  assert.equal(a.elements['covered-value'].textContent,'974');assert.equal(a.elements['open-value'].textContent,'3,526');
  // Widening the home overlaps utility by 20 sq ft: union must avoid double counting.
  a.input('w',35);assert.equal(a.spaces()[0].w,35);assert.equal(a.elements['covered-value'].textContent,'1,079');
  a.click('rotate');assert.equal(a.spaces()[0].w,25);assert.equal(a.spaces()[0].h,35);
  a.input('name','Weekend house');assert.equal(a.spaces()[0].name,'Weekend house');
  a.input('kind','garden');assert.equal(a.elements['covered-value'].textContent,'224');
  a.click('delete');assert.equal(a.spaces().length,5);
  a.click('undo');assert.equal(a.spaces().length,6);
  a.click('redo');assert.equal(a.spaces().length,5);
  assert.equal(a.elements['save-status'].textContent,'Saved on this browser');
});
test('scaled dragging, resize, plot limits, cancel and overlap reporting',async()=>{
  const a=await setup();
  a.pointer('pointerdown','home',10,10);a.pointer('pointermove','home',15.4,12.2);a.pointer('pointerup','home',15.4,12.2);
  assert.equal(a.spaces()[0].x,10);assert.equal(a.spaces()[0].y,7);
  a.click('undo');assert.equal(a.spaces()[0].x,5);
  a.pointer('pointerdown','home',35,30,true);a.pointer('pointermove','home',45,40,true);a.pointer('pointerup','home',45,40,true);
  assert.equal(a.spaces()[0].w,40);assert.equal(a.spaces()[0].h,35);assert.match(a.elements['layout-check'].innerHTML,/overlap/);
  a.pointer('pointerdown','home',10,10);a.pointer('pointermove','home',200,200);a.pointer('pointerup','home',200,200);
  assert.equal(a.spaces()[0].x,10);assert.equal(a.spaces()[0].y,55);
  a.pointer('pointerdown','home',12,60);a.pointer('pointermove','home',0,0);a.pointer('pointercancel','home',0,0);
  assert.equal(a.spaces()[0].x,10);assert.equal(a.spaces()[0].y,55);
  a.input('w',200);assert.equal(a.spaces()[0].w,50);assert.equal(a.spaces()[0].x,0);
  a.input('h',90);a.click('rotate');assert.equal(a.spaces()[0].w,50);assert.match(a.elements.toast.textContent,/too long to rotate/);
  a.input('w','');assert.equal(a.spaces()[0].w,50);
});
test('adding, keyboard moves, separate variant edits, compare and road positions',async()=>{
  const a=await setup();
  a.click('add-toggle');assert.equal(a.elements['add-menu'].hidden,false);
  a.click('catalog-list',{add:'3'});assert.equal(a.spaces().length,7);assert.equal(a.elements['add-menu'].hidden,true);
  a.click('space-list',{select:'home'});
  a.elements.plot.fire('keydown',{target:a.target({block:'home'}),key:'ArrowRight',shiftKey:true});assert.equal(a.spaces()[0].x,10);
  a.click('variant-list',{variant:'pool'});assert.equal(a.state().active,'pool');a.input('name','Pool house');
  a.click('variant-list',{variant:'garden'});assert.equal(a.spaces()[0].x,10);assert.equal(a.spaces().length,7);
  a.elements.roads.value='frontLeft';a.elements.roads.fire('change');assert.equal(a.state().roads,'frontLeft');assert.match(a.elements.plot.innerHTML,/LEFT ROAD/);assert.doesNotMatch(a.elements.plot.innerHTML,/REAR ROAD/);
  a.click('compare-toggle');assert.equal(a.elements['compare-panel'].hidden,false);assert.match(a.elements['comparison-cards'].innerHTML,/Pool house|Pool courtyard/);
  a.click('comparison-cards',{use:'pool'});assert.equal(a.state().active,'pool');assert.equal(a.spaces()[0].name,'Pool house');assert.equal(a.elements['compare-panel'].hidden,true);
  a.elements['show-grid'].checked=false;a.elements['show-grid'].fire('change');assert.doesNotMatch(a.elements.plot.innerHTML,/<rect[^>]*fill="url\(#grid\)"/);
});
test('edits restore after reload; reset is scoped and can be undone; bad / unavailable storage is safe',async()=>{
  let a=await setup();a.input('w',33);a.click('variant-list',{variant:'pool'});a.input('name','Edited pool home');
  const saved=JSON.stringify(a.state());a=await setup(saved);assert.equal(a.elements['space-name'].value,'Edited pool home');
  a.click('reset');assert.equal(a.elements['reset-dialog'].open,true);
  a.elements['reset-dialog'].returnValue='cancel';a.elements['reset-dialog'].fire('close');assert.equal(a.spaces()[0].name,'Edited pool home');
  a.elements['reset-dialog'].returnValue='reset';a.elements['reset-dialog'].fire('close');assert.equal(a.spaces()[0].name,'Main house');
  a.click('undo');assert.equal(a.spaces()[0].name,'Edited pool home');a.click('variant-list',{variant:'garden'});assert.equal(a.spaces()[0].w,33);
  const broken=await setup('malformed');assert.equal(broken.elements['covered-value'].textContent,'974');
  const noStorage=await setup(null,true);noStorage.input('w',31);assert.equal(noStorage.elements['selected-area'].textContent,'775 sq ft');assert.equal(noStorage.elements['save-status'].textContent,'Browser saving unavailable');
});
test('labels are escaped, and empty layouts can be edited and repopulated',async()=>{
  const empty=initialState();empty.variants[0].spaces=[];
  const a=await setup(JSON.stringify(empty));assert.equal(a.elements['empty-inspector'].hidden,false);assert.equal(a.elements['free-value'].textContent,'4,500');
  a.click('catalog-list',{add:'0'});a.input('name','<img src=x onerror=alert(1)>');assert.match(a.elements['space-list'].innerHTML,/&lt;img/);assert.doesNotMatch(a.elements['space-list'].innerHTML,/<img/);
});
