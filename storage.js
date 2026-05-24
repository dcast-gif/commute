import { DEFAULT_STATE } from './config.js';
const KEY = 'commute.v2';
export function loadState(){
  try { return { ...structuredClone(DEFAULT_STATE), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return structuredClone(DEFAULT_STATE); }
}
export function saveState(state){ localStorage.setItem(KEY, JSON.stringify(state)); }
export function recordHistory(state, snapshot){
  state.history = [{ id: crypto.randomUUID(), at: new Date().toISOString(), ...snapshot }, ...(state.history || [])].slice(0, 120);
  saveState(state);
}
