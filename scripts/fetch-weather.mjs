// Fetch REAL historical daily weather for each leg of a past trip and print a
// ready-to-paste `weather` array for journey.json — from the free Open-Meteo
// archive (no API key). Archive data lags ~5 days, so only past dates resolve.
//
//   node scripts/fetch-weather.mjs data/weather-input.json
//
// Input JSON: an array of { date: "YYYY-MM-DD", lat, lon, where }.
// One HTTP call fetches every location at once.

import { readFileSync } from 'node:fs';

const inFile = process.argv[2] || 'data/weather-input.json';
const legs = JSON.parse(readFileSync(inFile, 'utf8'));
if (!legs.length) { console.error('no legs in', inFile); process.exit(1); }

const lats = legs.map((l) => l.lat).join(',');
const lons = legs.map((l) => l.lon).join(',');
const start = legs.reduce((m, l) => (l.date < m ? l.date : m), legs[0].date);
const end = legs.reduce((m, l) => (l.date > m ? l.date : m), legs[0].date);

const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lats}&longitude=${lons}`
  + `&start_date=${start}&end_date=${end}`
  + `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode`
  + `&timezone=auto`;

const icon = (c, rain) => {
  if (c === 0 || c === 1) return '☀️';
  if (c === 2) return '🌤';
  if (c === 3) return '☁️';
  if (c >= 45 && c <= 48) return '🌫️';
  if (rain >= 4) return '🌧';
  if (c >= 51 && c <= 67) return '🌦';
  if (c >= 71 && c <= 77) return '❄️';
  if (c >= 80 && c <= 82) return '🌦';
  if (c >= 95) return '⛈️';
  return '🌥';
};
const f = (c) => Math.round(c * 9 / 5 + 32);

const res = await fetch(url);
const arr = await res.json();
const out = legs.map((leg, i) => {
  const d = Array.isArray(arr) ? arr[i].daily : arr.daily;
  const k = d.time.indexOf(leg.date);
  const lo = Math.round(d.temperature_2m_min[k]);
  const hi = Math.round(d.temperature_2m_max[k]);
  const rain = d.precipitation_sum[k];
  return { d: String(Number(leg.date.slice(8, 10))), where: leg.where,
           icon: icon(d.weathercode[k], rain), t: `${lo}–${hi}°C · ${f(lo)}–${f(hi)}°F` };
});

console.log(JSON.stringify(out, null, 2));
