// Shared basemap / road-palette / theme config used by the interactive web UI.
// (The fixed-size poster page keeps its own inline copy so PNG rendering stays
// self-contained.)

const STADIA_KEY = import.meta.env.VITE_STADIA_API_KEY || '';

export const TILES = {
  topo: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', max: 18, attr: 'Tiles © Esri — Esri, HERE, Garmin, USGS, OSM', label: 'Esri World Topo' },
  gray: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', max: 16, attr: 'Tiles © Esri', label: 'Esri Light Gray' },
  natgeo: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', max: 16, attr: 'Tiles © Esri — National Geographic', label: 'National Geographic' },
  imagery: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', max: 18, attr: 'Tiles © Esri — Maxar, Earthstar Geographics', label: 'Esri World Imagery' },
  street: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', max: 18, attr: 'Tiles © Esri — HERE, Garmin, USGS', label: 'Esri Street Map' },
  terrain: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}', max: 13, attr: 'Tiles © Esri — USGS, Esri, DeLorme', label: 'Esri Terrain' },
  ocean: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', max: 16, attr: 'Tiles © Esri — GEBCO, NOAA', label: 'Esri Ocean' },
  opentopo: { url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png', max: 17, attr: '© OpenTopoMap (CC-BY-SA) © OpenStreetMap', label: 'OpenTopoMap' },
  osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attr: '© OpenStreetMap contributors', label: 'OpenStreetMap' },
  cyclosm: { url: 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', max: 18, attr: 'CyclOSM © OpenStreetMap contributors', label: 'CyclOSM' },
  hot: { url: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', max: 19, attr: '© OpenStreetMap contributors · HOT', label: 'Humanitarian OSM' },
  // Stadia Maps (needs VITE_STADIA_API_KEY — falls back to a keyless look-alike)
  watercolor: { url: `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=${STADIA_KEY}`, max: 16, attr: '© Stadia Maps © Stamen Design © OpenStreetMap', label: 'Stamen Watercolor' },
  stamen: { url: `https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png?api_key=${STADIA_KEY}`, max: 18, attr: '© Stadia Maps © Stamen Design © OpenStreetMap', label: 'Stamen Terrain' },
  outdoors: { url: `https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}.png?api_key=${STADIA_KEY}`, max: 20, attr: '© Stadia Maps © OpenMapTiles © OpenStreetMap', label: 'Stadia Outdoors' },
  smooth: { url: `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png?api_key=${STADIA_KEY}`, max: 20, attr: '© Stadia Maps © OpenMapTiles © OpenStreetMap', label: 'Alidade Smooth' }
};

// Stadia styles need a key; without one, fall back to a free look-alike.
export const STADIA_FALLBACK = { watercolor: 'opentopo', stamen: 'opentopo', outdoors: 'opentopo', smooth: 'gray' };

export const HAS_STADIA_KEY = !!STADIA_KEY;

/** Resolve a requested basemap to one that will actually load. */
export function resolveStyle(styleKey) {
  if (STADIA_FALLBACK[styleKey] && !STADIA_KEY) return STADIA_FALLBACK[styleKey];
  return TILES[styleKey] ? styleKey : 'topo';
}

// road-class -> casing / line widths
export const ROAD_WEIGHTS = { motorway: { c: 11, w: 6.5 }, a: { c: 8.5, w: 4.6 }, b: { c: 6, w: 3 }, minor: { c: 5, w: 2.3 } };

export const PALETTES = {
  cobalt: { motorway: '#0b2f6b', a: '#2f6fe0', b: '#0e9488', minor: '#f08a24' },
  signage: { motorway: '#1f5fb4', a: '#178a4c', b: '#d99a1c', minor: '#7f8a90' },
  berry: { motorway: '#6b21a8', a: '#c026d3', b: '#e11d75', minor: '#f59e0b' },
  ember: { motorway: '#7c2d12', a: '#ea580c', b: '#0d9488', minor: '#4d7c0f' }
};

// user-facing basemap dropdown (grouped)
export const BASEMAP_OPTIONS = [
  'topo', 'gray', 'natgeo', 'imagery', 'street', 'terrain', 'ocean',
  'opentopo', 'osm', 'cyclosm', 'hot',
  'watercolor', 'stamen', 'outdoors', 'smooth'
];

export const PALETTE_OPTIONS = ['cobalt', 'signage', 'berry', 'ember'];

// Curated themes — each suggests a default basemap + road palette (overridable).
export const THEMES = [
  { id: 'light', name: 'Daylight', basemap: 'topo', palette: 'cobalt', swatch: '#2f6fe0' },
  { id: 'night', name: 'Night', basemap: 'topo', palette: 'cobalt', swatch: '#58a6ff' },
  { id: 'vintage', name: 'Vintage', basemap: 'watercolor', palette: 'ember', swatch: '#b45309' },
  { id: 'minimal', name: 'Minimal', basemap: 'gray', palette: 'signage', swatch: '#111827' }
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));
