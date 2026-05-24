export const TFL_BASE = 'https://api.tfl.gov.uk';
export const LINE_MODES = ['tube', 'dlr', 'overground', 'elizabeth-line'];
export const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const DEFAULT_STATE = {
  theme: 'dark',
  selectedLines: [],
  from: null,
  to: null,
  routes: [],
  windows: [{ start: '07:00', end: '09:30' }, { start: '17:00', end: '19:00' }],
  activeDays: [0,1,2,3,4],
  alertsEnabled: false,
  pollInterval: 300000,
  quietStart: '22:00',
  quietEnd: '07:00',
  lastNotificationHash: '',
  snoozedUntil: 0,
  history: []
};
export const LINE_COLOURS = {
  bakerloo:'#B36305', central:'#E32017', circle:'#FFD300', district:'#00782A', hammersmith_city:'#F3A9BB', jubilee:'#A0A5A9', metropolitan:'#9B0056', northern:'#000000', piccadilly:'#003688', victoria:'#0098D4', waterloo_city:'#95CDBA', dlr:'#00A4A7', 'london-overground':'#EE7C0E', 'elizabeth':'#6950a1'
};
