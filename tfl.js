import { TFL_BASE, LINE_MODES } from './config.js';
async function getJson(path){
  const res = await fetch(`${TFL_BASE}${path}`);
  if(!res.ok) throw new Error(`TfL request failed: ${res.status}`);
  return res.json();
}
export async function fetchLines(){
  return getJson(`/Line/Mode/${LINE_MODES.join(',')}`);
}
export async function fetchLineStatuses(ids){
  if(!ids.length) return [];
  return getJson(`/Line/${ids.join(',')}/Status`);
}
export async function searchStations(query){
  if(!query || query.trim().length < 2) return [];
  const data = await getJson(`/StopPoint/Search/${encodeURIComponent(query.trim())}?modes=${LINE_MODES.join(',')}&maxResults=8`);
  return (data.matches || []).map(m => ({ id: m.id, name: m.name, modes: m.modes || [] }));
}
export async function fetchJourney(fromId, toId){
  if(!fromId || !toId) return null;
  return getJson(`/Journey/JourneyResults/${encodeURIComponent(fromId)}/to/${encodeURIComponent(toId)}?timeIs=Departing`);
}
export function summariseJourney(data){
  const journeys = data?.journeys || [];
  if(!journeys.length) return null;
  const best = journeys.slice().sort((a,b)=>a.duration-b.duration)[0];
  const lines = [...new Set(best.legs.flatMap(l => l.routeOptions?.map(r => r.name) || []).filter(Boolean))];
  return { duration: best.duration, arrival: best.arrivalDateTime, legs: best.legs.length, lines };
}
export function lineHealth(line){
  const statuses = line.lineStatuses || [];
  const issue = statuses.find(s => !/good service/i.test(s.statusSeverityDescription || ''));
  return { ok: !issue, text: issue?.statusSeverityDescription || 'Good service', reason: issue?.reason || '' };
}