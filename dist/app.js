import { PLOT, KINDS, PRESETS, CATALOG, ROADS, clone, bounded, metrics, overlaps, findPosition, initialState, hydrate } from './model.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>value.toLocaleString('en-US');
const STORAGE_KEY='fieldwork-farmhouse-v1';
let storageAvailable=true;
let state;
try { state=hydrate(localStorage.getItem(STORAGE_KEY)) || initialState(); } catch { state=initialState();storageAvailable=false; }
let selected=state.variants.find(v=>v.id===state.active).spaces[0]?.id || null;
let showGrid=true, drag=null, toastTimer, compare=false;
const undoStack=[], redoStack=[];
const current=()=>state.variants.find(v=>v.id===state.active);
const selection=()=>current().spaces.find(s=>s.id===selected);
const snapshot=()=>JSON.stringify(state);
function toast(message) {
  $('toast').textContent=message;$('toast').hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);
}
function save() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageAvailable=true; } catch { storageAvailable=false; }
  $('save-status').textContent=storageAvailable?'Saved on this browser':'Browser saving unavailable';
}
function history(before) {
  if(before===snapshot()) return;
  undoStack.push(before);if(undoStack.length>60) undoStack.shift();redoStack.length=0;
}
function change(fn) { const before=snapshot();fn();history(before);save();render(); }
function select(id, focus=false) {
  selected=id;render();
  if(focus) $('plot').querySelector(`[data-block="${CSS.escape(id)}"]`)?.focus();
}
function switchVariant(id) {
  if(!PRESETS.some(p=>p.id===id))return;
  state.active=id;selected=current().spaces[0]?.id||null;save();render();
}
function mini(spaces, small=false) {
  return `<svg viewBox="-2 -2 54 94" class="${small?'variant-mini':''}" aria-hidden="true"><rect x="0" y="0" width="50" height="90" fill="#f8faf3" stroke="#9fac90" stroke-width=".7"/>${spaces.map(s=>`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${KINDS[s.kind].fill}" stroke="${KINDS[s.kind].stroke}" stroke-width=".6"/>`).join('')}</svg>`;
}
function renderPlot() {
  const spaces=current().spaces, collisions=new Set(overlaps(spaces).flatMap(pair=>pair.map(s=>s.id)));
  const roadSides=ROADS[state.roads];
  const road=(side)=>{
    const horizontal=side==='top'||side==='bottom';
    const x=side==='left'?-6:side==='right'?52:0,y=side==='top'?-6:side==='bottom'?92:0;
    const label={top:'REAR ROAD',bottom:'FRONT ROAD',left:'LEFT ROAD',right:'RIGHT ROAD'}[side];
    return `<g aria-hidden="true"><rect x="${x}" y="${y}" width="${horizontal?50:4}" height="${horizontal?4:90}" fill="#e5e9df" rx=".4"/><path d="${horizontal?`M0 ${y+2}h50`:`M${x+2} 0v90`}" stroke="#cbd2c0" stroke-width=".18" stroke-dasharray="1.2 1.2"/><rect x="${horizontal?17:x}" y="${horizontal?y:33}" width="${horizontal?16:4}" height="${horizontal?4:24}" fill="#e5e9df"/><text x="${horizontal?25:x+2.6}" y="${horizontal?y+2.55:45}" ${horizontal?'':`transform="rotate(-90 ${x+2.6} 45)"`} text-anchor="middle" fill="#8e9b80" font-size="1.2" letter-spacing=".3">${label}</text></g>`;
  };
  $('plot').innerHTML=`<defs><pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#dbe2d0" stroke-width=".13"/></pattern><pattern id="grass" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".13" fill="#aac08e" opacity=".6"/></pattern><pattern id="water" width="5" height="3" patternUnits="userSpaceOnUse"><path d="M0 1.5Q1.25 .6 2.5 1.5T5 1.5" fill="none" stroke="#abcdd0" stroke-width=".2"/></pattern></defs>
    ${roadSides.map(road).join('')}
    <path d="M0 -8.5V-7.5M0 -8H50M50 -8.5V-7.5M-8 0H-7M-7.5 0V90M-8 90H-7" fill="none" stroke="#a3af94" stroke-width=".15"/>
    <rect x="21" y="-9.2" width="8" height="2.5" fill="#f5f7f0"/><text x="25" y="-7.4" text-anchor="middle" fill="#82916f" font-size="1.5">50 ft</text>
    <rect x="-9" y="40" width="3" height="10" fill="#f5f7f0"/><text x="-7" y="45" transform="rotate(-90 -7 45)" text-anchor="middle" fill="#82916f" font-size="1.5">90 ft</text>
    <rect x="0" y="0" width="50" height="90" fill="#f9fbf3" stroke="#8c9e78" stroke-width=".4"/>
    ${showGrid?'<rect x="0" y="0" width="50" height="90" fill="url(#grid)" pointer-events="none"/>':''}
    <g aria-hidden="true" fill="#a4b197" font-size="1.2"><text x="0" y="99">REAR ↑</text><path d="M38 99h10m-10-.7v1.4m5-1.4v1.4m5-1.4v1.4" stroke="#91a37c" stroke-width=".2"/><text x="38" y="101">0</text><text x="43" y="101" text-anchor="middle">5</text><text x="48" y="101" text-anchor="end">10 ft</text></g>
    ${[...spaces.filter(s=>s.id!==selected),...spaces.filter(s=>s.id===selected)].map(s=>{
      const color=KINDS[s.kind],active=s.id===selected;
      const name=s.name.length>Math.max(6,s.w*1.7)?s.name.slice(0,Math.max(5,Math.floor(s.w*1.7)-1))+'…':s.name;
      return `<g class="plot-block ${active?'selected-block':''} ${collisions.has(s.id)?'overlapping':''}" data-block="${esc(s.id)}" role="button" tabindex="0" aria-label="${esc(s.name)}, ${s.w} by ${s.h} feet, position ${s.x}, ${s.y}${collisions.has(s.id)?', overlapping':''}" aria-pressed="${active}"><title>${esc(s.name)} · ${s.w} × ${s.h} ft · ${s.w*s.h} sq ft</title><rect class="block-shape" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx=".4" fill="${color.fill}" stroke="${color.stroke}" stroke-width=".18"/>${s.kind==='garden'||s.kind==='water'?`<rect x="${s.x+.3}" y="${s.y+.3}" width="${s.w-.6}" height="${s.h-.6}" fill="url(#${s.kind==='garden'?'grass':'water'})" pointer-events="none"/>`:''}${s.kind==='covered'?`<path d="M${s.x+.9} ${s.y+.9}h${s.w-1.8}v${s.h-1.8}h-${s.w-1.8}Z" fill="none" stroke="${color.stroke}" stroke-width=".12" opacity=".5"/>`:''}<text class="plot-label" x="${s.x+s.w/2}" y="${s.y+s.h/2-.25}" text-anchor="middle" style="font-size:${s.w<8?1.05:1.55}px">${esc(name)}</text><text class="plot-dimension" x="${s.x+s.w/2}" y="${s.y+s.h/2+2.05}" text-anchor="middle" style="font-size:${s.w<8?.95:1.25}px">${s.w} × ${s.h} ft</text>${active?`<rect x="${s.x+s.w-2.1}" y="${s.y+s.h-2.1}" width="4.2" height="4.2" data-resize="${esc(s.id)}" fill="transparent"/><rect class="resize-handle" data-resize="${esc(s.id)}" x="${s.x+s.w-.9}" y="${s.y+s.h-.9}" width="1.8" height="1.8" rx=".2"/>`:''}</g>`;
    }).join('')}`;
}
function renderMetrics() {
  const m=metrics(current().spaces);
  $('covered-value').textContent=number(m.covered);$('open-value').textContent=number(m.open);$('free-value').textContent=number(m.unallocated);
  $('coverage-text').textContent=`${m.coverage.toFixed(1)}% of your plot is covered`;
}
function renderChecks() {
  const pairs=overlaps(current().spaces);
  $('check-icon').classList.toggle('warning',!!pairs.length);$('check-icon').textContent=pairs.length?'!':'✓';
  $('layout-check').innerHTML=pairs.length?`<p class="check-warning">${pairs.length} overlap${pairs.length===1?'':'s'} to review</p><ul class="check-issues">${pairs.map(([a,b])=>`<li>${esc(a.name)} + ${esc(b.name)}</li>`).join('')}</ul><p class="check-detail">Overlaps are allowed while planning. Areas count shared space only once.</p>`:`<p class="check-good">All spaces fit without overlaps.</p><p class="check-detail">Inside the plot boundary. Access paths and setbacks are not assessed.</p>`;
}
function renderInspector() {
  const s=selection();$('selected-inspector').hidden=!s;$('empty-inspector').hidden=!!s;
  if(!s)return;
  $('selected-title').textContent=s.name;$('selected-icon').style.background=KINDS[s.kind].fill;$('selected-icon').style.borderColor=KINDS[s.kind].stroke;
  for(const key of ['name','kind','w','h','x','y']) $('space-'+key).value=s[key];
  $('space-x').max=PLOT.w-s.w;$('space-y').max=PLOT.h-s.h;
  $('selected-area').textContent=number(s.w*s.h)+' sq ft';
}
function renderCompare() {
  if(!compare)return;
  $('comparison-cards').innerHTML=PRESETS.map(p=>{
    const v=state.variants.find(v=>v.id===p.id),m=metrics(v.spaces),pairs=overlaps(v.spaces);
    return `<article class="compare-card ${p.id===state.active?'current':''}"><div class="mini-plan-wrap">${mini(v.spaces)}</div><h3>${p.title}</h3><p>${p.tradeoff}</p><div class="compare-metrics"><span>Covered<strong>${number(m.covered)} sq ft</strong></span><span>Open to sky<strong>${number(m.open)} sq ft</strong></span><span>Unallocated<strong>${number(m.unallocated)} sq ft</strong></span><span>Spaces<strong>${v.spaces.length}</strong></span></div><span class="compare-flag ${pairs.length?'warning':''}">${pairs.length?pairs.length+' overlap'+(pairs.length===1?'':'s'):'✓ No overlaps'}</span><button class="button ${p.id===state.active?'dark':''}" data-use="${p.id}">${p.id===state.active?'Continue this layout':'Edit this layout'} ↗</button></article>`;
  }).join('');
}
function render() {
  const preset=PRESETS.find(p=>p.id===state.active);
  if(!selection())selected=current().spaces[0]?.id||null;
  $('plan-title').textContent=preset.title;$('variant-note').textContent=preset.tradeoff;$('space-count').textContent=current().spaces.length+' spaces';$('roads').value=state.roads;
  $('variant-list').innerHTML=PRESETS.map((p,i)=>`<button class="variant-button ${p.id===state.active?'active':''}" data-variant="${p.id}" aria-pressed="${p.id===state.active}">${mini(state.variants.find(v=>v.id===p.id).spaces,true)}<span class="variant-copy"><strong>${p.title}</strong><small>${p.tag}</small></span><span class="variant-number">0${i+1}</span></button>`).join('');
  $('space-list').innerHTML=current().spaces.map(s=>`<button class="space-row ${s.id===selected?'selected':''}" data-select="${esc(s.id)}" aria-pressed="${s.id===selected}"><span class="space-swatch" style="background:${KINDS[s.kind].fill};border-color:${KINDS[s.kind].stroke}"></span><span class="space-label">${esc(s.name)}</span><span class="space-size">${s.w} × ${s.h}</span></button>`).join('');
  renderPlot();renderMetrics();renderInspector();renderChecks();renderCompare();
  $('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;
  $('save-status').textContent=storageAvailable?'Saved on this browser':'Browser saving unavailable';
}
function updateSelected(patch) {
  const s=selection();if(!s)return;
  change(()=>Object.assign(s,bounded({...s,...patch})));
}
function restoreHistory(from,to) {
  if(!from.length)return;
  to.push(snapshot());state=hydrate(from.pop())||initialState();selected=current().spaces[0]?.id||null;save();render();
}
function addSpace(index) {
  if(current().spaces.length>=30) {toast('Keep the plan focused: up to 30 spaces per layout.');return;}
  const item=CATALOG[index];if(!item)return;
  const position=findPosition(current().spaces,item.w,item.h);
  change(()=>{
    const id='space-'+(globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2));
    current().spaces.push({...item,id,...(position||{x:2,y:2})});selected=id;
  });
  $('add-menu').hidden=true;$('add-toggle').setAttribute('aria-expanded','false');
  toast(position?item.name+' added. Drag it or edit its dimensions.':'No clear area fits this size. Space added with overlap; resize or move it.');
}
// Pointer coordinates use the SVG transformation, preserving true scale on every viewport.
function coordinates(event) {
  const point=$('plot').createSVGPoint();point.x=event.clientX;point.y=event.clientY;
  return point.matrixTransform($('plot').getScreenCTM().inverse());
}
$('plot').addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  const block=event.target.closest('[data-block]');if(!block)return;
  const id=block.dataset.block, mode=event.target.closest('[data-resize]')?'resize':'move', p=coordinates(event);
  selected=id;const s=selection();
  drag={id,mode,start:p,original:clone(s),before:snapshot(),pointerId:event.pointerId};
  $('plot').setPointerCapture(event.pointerId);render();event.preventDefault();
});
$('plot').addEventListener('pointermove',event=>{
  if(!drag || event.pointerId!==drag.pointerId)return;
  const p=coordinates(event),dx=p.x-drag.start.x,dy=p.y-drag.start.y,o=drag.original;
  const patch=drag.mode==='move'?{x:o.x+dx,y:o.y+dy}:{w:Math.max(4,Math.min(PLOT.w-o.x,o.w+dx)),h:Math.max(4,Math.min(PLOT.h-o.y,o.h+dy))};
  const s=current().spaces.find(s=>s.id===drag.id);Object.assign(s,bounded({...o,...patch}));
  renderPlot();renderMetrics();renderInspector();renderChecks();
});
function finishDrag(event,cancel=false) {
  if(!drag || event.pointerId!==drag.pointerId)return;
  if(cancel) Object.assign(current().spaces.find(s=>s.id===drag.id),drag.original);else history(drag.before);
  const pointer=drag.pointerId;drag=null;
  if($('plot').hasPointerCapture(pointer))$('plot').releasePointerCapture(pointer);
  save();render();
}
$('plot').addEventListener('pointerup',event=>finishDrag(event));
$('plot').addEventListener('pointercancel',event=>finishDrag(event,true));
$('plot').addEventListener('lostpointercapture',event=>finishDrag(event));
$('plot').addEventListener('click',event=>{
  const block=event.target.closest('[data-block]');if(block && selected!==block.dataset.block)select(block.dataset.block);
});
$('plot').addEventListener('keydown',event=>{
  const block=event.target.closest('[data-block]');if(!block)return;
  const key=event.key,delta=event.shiftKey?5:1;
  if(key==='Enter'||key===' '){event.preventDefault();select(block.dataset.block);$('space-name').focus();return;}
  const movement={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]}[key];
  if(movement) {
    event.preventDefault();selected=block.dataset.block;const s=selection();updateSelected({x:s.x+movement[0],y:s.y+movement[1]});
    $('plot').querySelector(`[data-block="${CSS.escape(selected)}"]`)?.focus();
  }
});
$('variant-list').addEventListener('click',event=>{const b=event.target.closest('[data-variant]');if(b)switchVariant(b.dataset.variant);});
$('space-list').addEventListener('click',event=>{const b=event.target.closest('[data-select]');if(b)select(b.dataset.select);});
$('comparison-cards').addEventListener('click',event=>{const b=event.target.closest('[data-use]');if(b){switchVariant(b.dataset.use);setCompare(false);$('plan-title').scrollIntoView({behavior:'smooth',block:'center'});}});
for(const key of ['w','h','x','y']) $('space-'+key).addEventListener('change',()=>{
  const input=$('space-'+key),val=input.valueAsNumber;
  if(!Number.isFinite(val)){renderInspector();toast('Enter a dimension in whole feet.');return;}
  const s=selection(),next=bounded({...s,[key]:val});
  if(next[key]!==val || next.x!==s.x || next.y!==s.y)toast('Adjusted to whole feet and kept inside the 50 × 90 ft plot.');
  updateSelected({[key]:val});
});
$('space-name').addEventListener('change',()=>{const name=$('space-name').value.trim().slice(0,36);if(name)updateSelected({name});else renderInspector();});
$('space-kind').addEventListener('change',()=>{if(KINDS[$('space-kind').value])updateSelected({kind:$('space-kind').value});});
$('rotate').addEventListener('click',()=>{
  const s=selection();if(!s)return;
  if(s.h>PLOT.w || s.w>PLOT.h){toast('This space is too long to rotate within the 50 ft plot width.');return;}
  updateSelected({w:s.h,h:s.w});
});
$('delete').addEventListener('click',()=>{if(!selection())return;change(()=>{current().spaces=current().spaces.filter(s=>s.id!==selected);selected=null;});});
$('undo').addEventListener('click',()=>restoreHistory(undoStack,redoStack));
$('redo').addEventListener('click',()=>restoreHistory(redoStack,undoStack));
$('show-grid').addEventListener('change',()=>{showGrid=$('show-grid').checked;renderPlot();});
$('roads').addEventListener('change',()=>{if(ROADS[$('roads').value])change(()=>state.roads=$('roads').value);});
$('add-toggle').setAttribute('aria-expanded','false');
$('add-toggle').addEventListener('click',()=>{$('add-menu').hidden=!$('add-menu').hidden;$('add-toggle').setAttribute('aria-expanded',String(!$('add-menu').hidden));});
$('catalog-list').innerHTML=CATALOG.map((s,i)=>`<button class="catalog-button" data-add="${i}">${s.name}<span>${s.w} × ${s.h} ft ＋</span></button>`).join('');
$('catalog-list').addEventListener('click',event=>{const b=event.target.closest('[data-add]');if(b)addSpace(Number(b.dataset.add));});
function setCompare(value) {compare=value;$('compare-panel').hidden=!value;$('compare-toggle').setAttribute('aria-expanded',String(value));renderCompare();if(value)$('compare-panel').scrollIntoView({behavior:'smooth',block:'start'});}
$('compare-toggle').setAttribute('aria-expanded','false');
$('compare-toggle').addEventListener('click',()=>setCompare(!compare));
$('compare-close').addEventListener('click',()=>setCompare(false));
$('reset').addEventListener('click',()=>$('reset-dialog').showModal());
$('reset-dialog').addEventListener('close',()=>{if($('reset-dialog').returnValue==='reset')change(()=>{current().spaces=clone(PRESETS.find(p=>p.id===state.active).spaces);selected=current().spaces[0].id;});});
document.addEventListener('keydown',event=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z') {event.preventDefault();event.shiftKey?restoreHistory(redoStack,undoStack):restoreHistory(undoStack,redoStack);}
});
render();
