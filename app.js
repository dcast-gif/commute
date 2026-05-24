import { DAYS, LINE_COLOURS } from './config.js';
import { loadState, saveState, recordHistory } from './storage.js';
import { fetchLines, fetchLineStatuses, searchStations, fetchJourney, summariseJourney, lineHealth } from './tfl.js';
import { ensurePermission, notifyChanges } from './notifications.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const state = loadState();
let lines = [];
let pollTimer = null;
let deferredInstall = null;

function toast(message){ const el=$('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2400); }
function fmtTime(iso){ return iso ? new Date(iso).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : 'unknown'; }
function esc(s=''){ return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function lineColour(id){ return LINE_COLOURS[id] || LINE_COLOURS[id?.replace('-line','')] || '#64748b'; }

function renderTabs(){
  const active = location.hash?.replace('#','') || 'home';
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === active));
  $$('[data-tab-link]').forEach(a => a.classList.toggle('active', a.dataset.tabLink === active));
}
function renderTheme(){ document.documentElement.dataset.theme = state.theme; $('#themeToggle').textContent = state.theme === 'dark' ? 'âï¸ Light mode' : 'ð Dark mode'; }
function renderSelectedRoute(){
  $('#selectedRoute').innerHTML = state.from && state.to
    ? `<strong>${esc(state.from.name)}</strong> â <strong>${esc(state.to.name)}</strong>`
    : 'No route selected yet.';
}
function renderLinePicker(){
  $('#linePicker').classList.remove('skeleton-list');
  $('#linePicker').innerHTML = lines.map(line => `<button class="pill ${state.selectedLines.includes(line.id) ? 'active' : ''}" data-line="${line.id}" type="button"><span class="line-dot" style="--line-color:${lineColour(line.id)}"></span>${esc(line.name)}</button>`).join('');
}
function renderRoutes(){
  const list = $('#routesList');
  if(!state.routes.length){ list.className='route-list empty-state'; list.textContent='No saved routes yet.'; return; }
  list.className='route-list';
  list.innerHTML = state.routes.map(r => `<article class="item"><header><div><h3>${esc(r.name)}</h3><p>${esc(r.from?.name || 'Unknown')} â ${esc(r.to?.name || 'Unknown')}</p></div><span class="badge">${r.selectedLines.length} lines</span></header><div class="button-row"><button class="primary" data-load-route="${r.id}">Load</button><button class="danger" data-delete-route="${r.id}">Delete</button></div></article>`).join('');
}
function renderWindows(){
  $('#windowsList').innerHTML = state.windows.map((w,i)=>`<div class="window-row"><label>Start<input type="time" data-window-start="${i}" value="${w.start}"></label><label>End<input type="time" data-window-end="${i}" value="${w.end}"></label><button class="danger" data-remove-window="${i}" type="button">Remove</button></div>`).join('');
}
function renderDays(){
  $('#dayPicker').innerHTML = DAYS.map((d,i)=>`<button class="pill ${state.activeDays.includes(i)?'active':''}" data-day="${i}" type="button">${d}</button>`).join('');
}
function renderSettings(){
  $('#alertsEnabled').checked = state.alertsEnabled;
  $('#pollInterval').value = String(state.pollInterval);
  $('#quietStart').value = state.quietStart;
  $('#quietEnd').value = state.quietEnd;
  renderWindows(); renderDays();
}
function renderHistory(){
  const h = state.history || [];
  const checks = h.length, issueChecks = h.filter(x => x.issueCount > 0).length;
  const goodRate = checks ? Math.round(((checks-issueChecks)/checks)*100) : 0;
  $('#historyStats').innerHTML = `<div class="stat"><strong>${checks}</strong><span>Checks</span></div><div class="stat"><strong>${goodRate}%</strong><span>Clear checks</span></div><div class="stat"><strong>${issueChecks}</strong><span>With issues</span></div>`;
  const list = $('#historyList');
  if(!h.length){ list.className='history-list empty-state'; list.textContent='No checks recorded yet.'; return; }
  list.className='history-list';
  list.innerHTML = h.slice(0,30).map(x=>`<article class="item"><header><div><h3>${new Date(x.at).toLocaleString()}</h3><p>${esc(x.route || 'Manual check')}</p></div><span class="badge ${x.issueCount?'bad':'good'}">${x.issueCount ? `${x.issueCount} issue(s)` : 'Clear'}</span></header>${x.duration ? `<p>Best journey: ${x.duration} minutes, arriving ${fmtTime(x.arrival)}</p>` : ''}</article>`).join('');
}
function renderAll(){ renderTheme(); renderTabs(); renderSelectedRoute(); renderLinePicker(); renderRoutes(); renderSettings(); renderHistory(); saveState(state); }

async function attachStationSearch(inputSel, resultSel, key){
  const input = $(inputSel), results = $(resultSel);
  let timeout;
  input.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      const matches = await searchStations(input.value).catch(()=>[]);
      results.innerHTML = matches.length ? `<div class="result-menu">${matches.map(m=>`<button type="button" data-station='${JSON.stringify(m).replaceAll("'", "&#39;")}'>${esc(m.name)}</button>`).join('')}</div>` : '';
    }, 250);
  });
  results.addEventListener('click', e => {
    const btn = e.target.closest('[data-station]'); if(!btn) return;
    state[key] = JSON.parse(btn.dataset.station); input.value=''; results.innerHTML=''; renderSelectedRoute(); saveState(state);
  });
}

async function checkCommute({silent=false}={}){
  $('#journeySummary').innerHTML = '<span class="badge">Checking TfL...</span>';
  const selected = state.selectedLines.length ? state.selectedLines : lines.map(l=>l.id);
  try{
    const [statuses, journey] = await Promise.all([fetchLineStatuses(selected), state.from && state.to ? fetchJourney(state.from.id, state.to.id).catch(()=>null) : null]);
    const issues = statuses.map(line => ({...line, ...lineHealth(line)})).filter(x => !x.ok);
    const best = summariseJourney(journey);
    $('#lastChecked').textContent = `Last checked: ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
    $('#summaryCard strong').textContent = issues.length ? `${issues.length} issue(s) found` : 'No selected-line issues';
    $('#journeySummary').innerHTML = best ? `<strong>Best route: ${best.duration} minutes</strong><p>Arrives around ${fmtTime(best.arrival)} across ${best.legs} leg(s). ${best.lines.length ? `Likely via ${esc(best.lines.join(', '))}.` : ''}</p>` : 'No journey estimate available yet.';
    $('#statusResults').innerHTML = statuses.map(line => { const h=lineHealth(line); return `<article class="item"><header><div><h3><span class="line-dot" style="--line-color:${lineColour(line.id)}"></span> ${esc(line.name)}</h3><p>${esc(h.reason || h.text)}</p></div><span class="badge ${h.ok?'good':'bad'}">${esc(h.text)}</span></header></article>`; }).join('');
    recordHistory(state, { route: state.from && state.to ? `${state.from.name} â ${state.to.name}` : 'Selected lines', issueCount: issues.length, duration: best?.duration || null, arrival: best?.arrival || null });
    notifyChanges(state, issues.map(i => ({ name:i.name, text:lineHealth(i).text })));
    renderHistory(); saveState(state);
    if(!silent) toast('Commute checked');
  } catch(err){
    $('#journeySummary').textContent = 'TfL check failed. Try again shortly.';
    if(!silent) toast('TfL request failed');
  }
}
function restartPolling(){ clearInterval(pollTimer); if(state.alertsEnabled) pollTimer = setInterval(()=>checkCommute({silent:true}), Number(state.pollInterval)); }

async function init(){
  renderTabs(); renderTheme();
  try { lines = await fetchLines(); } catch { toast('Could not load TfL lines'); lines = []; }
  renderAll();
  attachStationSearch('#fromSearch','#fromResults','from'); attachStationSearch('#toSearch','#toResults','to'); restartPolling();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}

window.addEventListener('hashchange', renderTabs);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('#installApp').classList.remove('hidden'); });
$('#themeToggle').addEventListener('click',()=>{ state.theme = state.theme === 'dark' ? 'light' : 'dark'; renderAll(); });
$('#linePicker').addEventListener('click', e => { const id=e.target.closest('[data-line]')?.dataset.line; if(!id) return; state.selectedLines = state.selectedLines.includes(id) ? state.selectedLines.filter(x=>x!==id) : [...state.selectedLines,id]; renderAll(); });
$('#swapStations').addEventListener('click',()=>{ [state.from,state.to]=[state.to,state.from]; renderAll(); });
$('#checkNow').addEventListener('click',()=>checkCommute());
$('#saveRoute').addEventListener('click',()=>{ const name=$('#routeName').value.trim(); if(!name) return toast('Name the route first'); state.routes.unshift({ id:crypto.randomUUID(), name, from:state.from, to:state.to, selectedLines:state.selectedLines, windows:state.windows, activeDays:state.activeDays }); $('#routeName').value=''; renderAll(); toast('Route saved'); });
$('#routesList').addEventListener('click', e => { const load=e.target.closest('[data-load-route]')?.dataset.loadRoute; const del=e.target.closest('[data-delete-route]')?.dataset.deleteRoute; if(load){ const r=state.routes.find(x=>x.id===load); Object.assign(state,{from:r.from,to:r.to,selectedLines:r.selectedLines,windows:r.windows,activeDays:r.activeDays}); location.hash='#home'; renderAll(); } if(del){ state.routes=state.routes.filter(x=>x.id!==del); renderAll(); } });
$('#alertsEnabled').addEventListener('change', async e => { state.alertsEnabled=e.target.checked && await ensurePermission(); renderAll(); restartPolling(); });
$('#pollInterval').addEventListener('change', e => { state.pollInterval=Number(e.target.value); saveState(state); restartPolling(); });
$('#quietStart').addEventListener('change', e => { state.quietStart=e.target.value; saveState(state); });
$('#quietEnd').addEventListener('change', e => { state.quietEnd=e.target.value; saveState(state); });
$('#addWindow').addEventListener('click',()=>{ state.windows.push({start:'08:00',end:'09:00'}); renderAll(); });
$('#windowsList').addEventListener('input', e => { const i=e.target.dataset.windowStart ?? e.target.dataset.windowEnd; if(i===undefined) return; if(e.target.dataset.windowStart!==undefined) state.windows[i].start=e.target.value; else state.windows[i].end=e.target.value; saveState(state); });
$('#windowsList').addEventListener('click', e => { const i=e.target.closest('[data-remove-window]')?.dataset.removeWindow; if(i!==undefined){ state.windows.splice(Number(i),1); renderAll(); } });
$('#dayPicker').addEventListener('click', e => { const d=e.target.closest('[data-day]')?.dataset.day; if(d===undefined) return; const n=Number(d); state.activeDays = state.activeDays.includes(n) ? state.activeDays.filter(x=>x!==n) : [...state.activeDays,n].sort(); renderAll(); });
$('#testNotification').addEventListener('click', async()=>{ if(await ensurePermission()) new Notification('Commute alerts are working', { body:'You will only be notified when something changes during your alert windows.' }); });
$('#clearHistory').addEventListener('click',()=>{ state.history=[]; renderAll(); });
$('#installApp').addEventListener('click', async()=>{ if(deferredInstall){ deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall=null; $('#installApp').classList.add('hidden'); } });
init();