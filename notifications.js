export async function ensurePermission(){
  if(!('Notification' in window)) return false;
  if(Notification.permission === 'granted') return true;
  if(Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}
function inQuietHours(state){
  const now = new Date(); const mins = now.getHours()*60 + now.getMinutes();
  const [sh,sm] = state.quietStart.split(':').map(Number), [eh,em] = state.quietEnd.split(':').map(Number);
  const start = sh*60+sm, end = eh*60+em;
  return start < end ? mins >= start && mins <= end : mins >= start || mins <= end;
}
function inAlertWindow(state){
  const day = (new Date().getDay()+6)%7;
  if(!state.activeDays.includes(day)) return false;
  const mins = new Date().getHours()*60 + new Date().getMinutes();
  return state.windows.some(w => {
    const [sh,sm]=w.start.split(':').map(Number), [eh,em]=w.end.split(':').map(Number);
    return mins >= sh*60+sm && mins <= eh*60+em;
  });
}
export function canNotify(state){ return state.alertsEnabled && Date.now() > (state.snoozedUntil || 0) && !inQuietHours(state) && inAlertWindow(state); }
export function notifyChanges(state, issues){
  if(!canNotify(state) || Notification.permission !== 'granted' || !issues.length) return false;
  const hash = issues.map(i => `${i.name}:${i.text}`).sort().join('|');
  if(hash === state.lastNotificationHash) return false;
  state.lastNotificationHash = hash;
  const title = issues.length === 1 ? `${issues[0].name}: ${issues[0].text}` : `${issues.length} commute issues found`;
  const body = issues.map(i => `${i.name}: ${i.text}`).join('\n').slice(0, 220);
  new Notification(title, { body, tag: 'commute-status', renotify: false });
  return true;
}