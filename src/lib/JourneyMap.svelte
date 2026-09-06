<script>
  import { onMount } from 'svelte';
  import data from './journey.json';

  let mapEl;

  // hotel / overnight glyph
  const BED = '<svg viewBox="0 0 24 24"><path d="M7 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9a4 4 0 0 0-4-4z"/></svg>';

  // Optional — unlocks the Stadia basemaps. Empty is fine (those styles just won't load).
  const STADIA_KEY = import.meta.env.VITE_STADIA_API_KEY || '';

  const TILES = {
    topo: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', max: 18, attr: 'Tiles © Esri — Esri, HERE, Garmin, USGS, OSM' },
    gray: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', max: 16, attr: 'Tiles © Esri' },
    natgeo: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', max: 16, attr: 'Tiles © Esri — National Geographic' },
    imagery: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', max: 18, attr: 'Tiles © Esri — Maxar, Earthstar Geographics' },
    street: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', max: 18, attr: 'Tiles © Esri — HERE, Garmin, USGS' },
    terrain: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}', max: 13, attr: 'Tiles © Esri — USGS, Esri, DeLorme' },
    ocean: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', max: 16, attr: 'Tiles © Esri — GEBCO, NOAA' },
    opentopo: { url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png', max: 17, attr: '© OpenTopoMap (CC-BY-SA) © OpenStreetMap' },
    osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attr: '© OpenStreetMap contributors' },
    cyclosm: { url: 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', max: 18, attr: 'CyclOSM © OpenStreetMap contributors' },
    hot: { url: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', max: 19, attr: '© OpenStreetMap contributors · HOT' },
    // Stadia Maps (needs VITE_STADIA_API_KEY)
    watercolor: { url: `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=${STADIA_KEY}`, max: 16, attr: '© Stadia Maps © Stamen Design © OpenStreetMap' },
    stamen: { url: `https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png?api_key=${STADIA_KEY}`, max: 18, attr: '© Stadia Maps © Stamen Design © OpenStreetMap' },
    outdoors: { url: `https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}.png?api_key=${STADIA_KEY}`, max: 20, attr: '© Stadia Maps © OpenMapTiles © OpenStreetMap' },
    smooth: { url: `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png?api_key=${STADIA_KEY}`, max: 20, attr: '© Stadia Maps © OpenMapTiles © OpenStreetMap' }
  };

  // road-class -> casing / line widths
  const RW = { motorway: { c: 11, w: 6.5 }, a: { c: 8.5, w: 4.6 }, b: { c: 6, w: 3 }, minor: { c: 5, w: 2.3 } };

  // selectable road-colour palettes (?roads=)
  const PALETTES = {
    cobalt: { motorway: '#0b2f6b', a: '#2f6fe0', b: '#0e9488', minor: '#f08a24' },
    signage: { motorway: '#1f5fb4', a: '#178a4c', b: '#d99a1c', minor: '#7f8a90' },
    berry: { motorway: '#6b21a8', a: '#c026d3', b: '#e11d75', minor: '#f59e0b' },
    ember: { motorway: '#7c2d12', a: '#ea580c', b: '#0d9488', minor: '#4d7c0f' }
  };

  onMount(async () => {
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

    const params = new URLSearchParams(location.search);
    // Stadia styles need a key; without one, fall back to a free look-alike so forks still render.
    const STADIA = { watercolor: 'opentopo', stamen: 'opentopo', outdoors: 'opentopo', smooth: 'gray' };
    let styleKey = params.get('style') || 'topo';
    if (STADIA[styleKey] && !STADIA_KEY) {
      console.warn(`[journey-atlas] basemap "${styleKey}" needs VITE_STADIA_API_KEY — falling back to "${STADIA[styleKey]}". See .env.example.`);
      styleKey = STADIA[styleKey];
    }
    const tile = TILES[styleKey] || TILES.topo;
    const pal = PALETTES[params.get('roads')] || PALETTES.cobalt;

    // enlarged blow-up insets come from the data file
    const blowups = !!params.get('blowups');
    const INSETS = blowups ? (data.insets || []) : [];

    const map = L.map(mapEl, { zoomControl: false, attributionControl: true, zoomSnap: 0.25, inertia: false, keyboard: false });
    L.tileLayer(tile.url, { maxZoom: tile.max, detectRetina: true, attribution: tile.attr }).addTo(map);

    const bounds = [];
    // driving route — white casing then coloured line, width by road class
    for (const d of data.drives) for (const s of d.segs) {
      L.polyline(s.line, { color: '#ffffff', weight: RW[s.cls].c, opacity: 0.85, lineJoin: 'round', lineCap: 'round' }).addTo(map);
      for (const p of s.line) bounds.push(p);
    }
    for (const d of data.drives) for (const s of d.segs) {
      L.polyline(s.line, { color: pal[s.cls], weight: RW[s.cls].w, opacity: 0.97, lineJoin: 'round', lineCap: 'round' }).addTo(map);
    }

    // subtle direction-of-travel chevrons along the route (in travel order)
    const dkm = (a, b) => Math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 111 * Math.cos(a[0] * Math.PI / 180));
    const bearing = (a, b) => {
      const p1 = a[0] * Math.PI / 180, p2 = b[0] * Math.PI / 180, dl = (b[1] - a[1]) * Math.PI / 180;
      const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
      return Math.atan2(y, x) * 180 / Math.PI;
    };
    const arrow = (deg) => `<div class="dir" style="transform:rotate(${deg}deg)"><svg viewBox="0 0 22 22"><path d="M11 3.5 L17.5 16.5 L11 12.8 L4.5 16.5 Z"/></svg></div>`;
    for (const d of data.drives) {
      const line = [];
      d.segs.forEach((s, i) => line.push(...(i ? s.line.slice(1) : s.line)));
      let acc = 0;
      for (let i = 1; i < line.length; i++) {
        const step = dkm(line[i - 1], line[i]);
        if (step > 15) { acc = 0; continue; }
        acc += step;
        if (acc >= 55) {
          acc = 0;
          L.marker(line[i - 1], { interactive: false, zIndexOffset: 250,
            icon: L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: arrow(bearing(line[i - 1], line[i])) }) }).addTo(map);
        }
      }
    }
    for (const f of (data.ferries || [])) {
      L.polyline([f.a, f.b], { color: '#ef5f38', weight: 3.5, opacity: 0.95, dashArray: '2 10', lineCap: 'round' }).addTo(map);
      bounds.push(f.a, f.b);
    }
    for (const s of data.stays) bounds.push([s.lat, s.lon]);
    for (const p of data.pois) bounds.push([p.lat, p.lon]);

    map.fitBounds(bounds, blowups
      ? { paddingTopLeft: [500, 150], paddingBottomRight: [225, 60] }
      : { paddingTopLeft: [545, 150], paddingBottomRight: [130, 55] });

    // ---------- label placement (greedy, obstacle-aware) ----------
    const CW = 1600, CH = 1200;
    const obstacles = [
      { x: 18, y: 18, w: 410, h: 100 },   // title (top-left, with subtitle)
      { x: 18, y: 120, w: 520, h: 250 },  // ferry table
      { x: 525, y: 30, w: 370, h: 300 },  // weather table
      { x: 18, y: 1000, w: 306, h: 200 }  // miles legend + map credit
    ];
    for (const ins of INSETS) obstacles.push({ x: ins.cx - ins.r, y: ins.cy - ins.r, w: ins.r * 2, h: ins.r * 2 });
    const overlap = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
    const inside = (r) => r.x >= 8 && r.y >= 8 && r.x + r.w <= CW - 8 && r.y + r.h <= CH - 8;
    const pt = (lat, lon) => map.latLngToContainerPoint([lat, lon]);
    function place(px, py, w, h, gap) {
      const cand = [
        { x: px + gap, y: py - h / 2 }, { x: px - gap - w, y: py - h / 2 },
        { x: px - w / 2, y: py - gap - h }, { x: px - w / 2, y: py + gap },
        { x: px + gap, y: py - gap - h }, { x: px + gap, y: py + gap },
        { x: px - gap - w, y: py - gap - h }, { x: px - gap - w, y: py + gap },
        { x: px + gap * 2, y: py - h / 2 }, { x: px - gap * 2 - w, y: py - h / 2 }
      ];
      for (const c of cand) {
        const r = { x: c.x, y: c.y, w, h };
        if (inside(r) && !obstacles.some((o) => overlap(r, o))) return r;
      }
      return null;
    }

    const ferryPix = (data.ferries || []).map((f) => ({ f, p: pt((f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2) }));
    for (const { p } of ferryPix) obstacles.push({ x: p.x - 18, y: p.y - 13, w: 36, h: 26 });
    const stayPix = data.stays.map((s, i) => ({ s, i, p: pt(s.lat, s.lon) }));
    for (const { p } of stayPix) obstacles.push({ x: p.x - 15, y: p.y - 15, w: 30, h: 30 });
    const poiPix = data.pois.map((s) => ({ s, p: pt(s.lat, s.lon) }));
    for (const { p } of poiPix) obstacles.push({ x: p.x - 9, y: p.y - 9, w: 18, h: 18 });

    for (const { f } of ferryPix) {
      L.marker([(f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2], { interactive: false, zIndexOffset: 400,
        icon: L.divIcon({ className: '', iconSize: [30, 22], iconAnchor: [15, 11], html: `<div class="ferry-badge">&#9972;<i>${f.num}</i></div>` }) }).addTo(map);
    }
    for (const { s, i, p } of stayPix) {
      const w = s.area.length * 8.6 + 22, h = 26;
      const r = place(p.x, p.y, w, h, 18) || { x: p.x + 18, y: p.y - h / 2, w, h };
      obstacles.push(r);
      const dx = r.x - (p.x - 15), dy = r.y - (p.y - 15), ra = r.x + r.w / 2 < p.x ? 'ra' : '';
      L.marker([s.lat, s.lon], { interactive: false, zIndexOffset: 600,
        icon: L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15],
          html: `<div class="stay-pin">${i + 1}<span class="hotel-badge">${BED}</span></div><div class="pin-label town ${ra}" style="left:${dx}px;top:${dy}px"><b>${s.area}</b></div>` }) }).addTo(map);
    }
    // POIs: dot ALWAYS shown; label only when it fits (no overlap, no clutter)
    for (const { s, p } of poiPix) {
      const w = s.name.length * 7.1 + 6, h = 22;
      const r = place(p.x, p.y, w, h, 13);
      let html = `<div class="poi-dot"></div>`;
      if (r) { obstacles.push(r); const dx = r.x - (p.x - 8), dy = r.y - (p.y - 8), ra = r.x + r.w / 2 < p.x ? 'ra' : '';
        html += `<div class="poi-label ${ra}" style="left:${dx}px;top:${dy}px">${s.name}</div>`; }
      L.marker([s.lat, s.lon], { interactive: false, zIndexOffset: 300,
        icon: L.divIcon({ className: '', iconSize: [16, 16], iconAnchor: [8, 8], html }) }).addTo(map);
    }

    // ---------- enlarged blow-up insets ----------
    if (INSETS.length) {
      const parent = mapEl.parentElement;
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'leaders');
      parent.appendChild(svg);
      const drawInsetRoute = (m) => {
        for (const d of data.drives) for (const s of d.segs)
          L.polyline(s.line, { color: '#fff', weight: RW[s.cls].c * 0.8, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(m);
        for (const d of data.drives) for (const s of d.segs)
          L.polyline(s.line, { color: pal[s.cls], weight: RW[s.cls].w * 0.85, opacity: 0.97, lineCap: 'round', lineJoin: 'round' }).addTo(m);
        for (const f of (data.ferries || [])) L.polyline([f.a, f.b], { color: '#ef5f38', weight: 3, opacity: 0.95, dashArray: '2 9', lineCap: 'round' }).addTo(m);
      };
      for (const ins of INSETS) {
        const pReal = map.latLngToContainerPoint(ins.center);
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', pReal.x); line.setAttribute('y1', pReal.y);
        line.setAttribute('x2', ins.cx); line.setAttribute('y2', ins.cy); line.setAttribute('class', 'leader');
        svg.appendChild(line);
        const ring = document.createElementNS(svgNS, 'circle');
        ring.setAttribute('cx', pReal.x); ring.setAttribute('cy', pReal.y); ring.setAttribute('r', 6); ring.setAttribute('class', 'leader-dot');
        svg.appendChild(ring);

        const div = document.createElement('div');
        div.className = 'inset';
        div.style.cssText = `left:${ins.cx - ins.r}px;top:${ins.cy - ins.r}px;width:${ins.r * 2}px;height:${ins.r * 2}px`;
        parent.appendChild(div);
        const im = L.map(div, { zoomControl: false, attributionControl: false, inertia: false, dragging: false, scrollWheelZoom: false, keyboard: false }).setView(ins.center, ins.zoom);
        L.tileLayer(tile.url, { maxZoom: tile.max, detectRetina: true }).addTo(im);
        drawInsetRoute(im);
        // hotels (overnight bases) — bed icon
        for (const s of data.stays) L.marker([s.lat, s.lon], { interactive: false, zIndexOffset: 600,
          icon: L.divIcon({ className: '', iconSize: [24, 24], iconAnchor: [12, 12], html: `<div class="mini-hotel">${BED}</div>` }) }).addTo(im);
        // orange sight POIs — numbered where they belong to this blow-up
        const near = data.pois.filter((p) => dkm([p.lat, p.lon], ins.center) < ins.poiKm);
        const numOf = new Map(near.map((p, i) => [p.name, i + 1]));
        for (const p of data.pois) {
          const n = numOf.get(p.name);
          L.marker([p.lat, p.lon], { interactive: false, zIndexOffset: n ? 550 : 500,
            icon: L.divIcon({ className: '', iconSize: n ? [20, 20] : [12, 12], iconAnchor: n ? [10, 10] : [6, 6],
              html: n ? `<div class="mini-num">${n}</div>` : `<div class="mini-poi"></div>` }) }).addTo(im);
        }

        // caption card: title + hotel(s) + numbered key of the orange POIs
        const hotelsNear = data.stays.filter((s) => s.hotel && dkm([s.lat, s.lon], ins.center) < ins.poiKm);
        const vert = ins.capMode === 'vert';
        const panel = document.createElement('div');
        panel.className = vert ? 'bubble-cap vert' : 'bubble-cap';
        panel.style.cssText = vert
          ? `left:${ins.cx + 46}px;top:${ins.cy + ins.r + 12}px`
          : `left:${ins.cx}px;top:${ins.cy + ins.r + 8}px;transform:translateX(-50%)`;
        panel.innerHTML =
          `<div class="bubble-title">${ins.title}</div>` +
          (hotelsNear.length ? `<div class="bubble-hotels"><span class="bed">${BED}</span>${hotelsNear.map((s) => s.hotel).join(' &middot; ')}</div>` : '') +
          (near.length ? `<div class="bubble-pois">${near.map((p, i) => `<span><i>${i + 1}</i>${p.name}</span>`).join('')}</div>` : '');
        parent.appendChild(panel);
      }
    }

    // ---------- optional wry callout note ----------
    if (data.note) {
      const NS = 'http://www.w3.org/2000/svg';
      const anc = pt(data.note.anchor[0], data.note.anchor[1]);
      const tip = pt(data.note.tip[0], data.note.tip[1]);
      const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'note-svg');
      const ln = document.createElementNS(NS, 'path');
      ln.setAttribute('d', `M ${anc.x} ${anc.y} Q ${(anc.x + tip.x) / 2 + 30} ${(anc.y + tip.y) / 2 - 26} ${tip.x} ${tip.y}`);
      ln.setAttribute('class', 'note-leader'); s.appendChild(ln);
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', tip.x); dot.setAttribute('cy', tip.y); dot.setAttribute('r', 4.5); dot.setAttribute('class', 'note-dot'); s.appendChild(dot);
      mapEl.parentElement.appendChild(s);
      const tag = document.createElement('div'); tag.className = 'note-tag';
      tag.style.cssText = `left:${anc.x}px;top:${anc.y}px`;
      tag.innerHTML = `<b>${data.note.title}</b>${data.note.sub ? `<span>${data.note.sub}</span>` : ''}`;
      mapEl.parentElement.appendChild(tag);
    }

    // ---------- optional "onward journey" tag arcing off the bottom edge ----------
    if (data.finale) {
      const NS = 'http://www.w3.org/2000/svg';
      const eP = pt(data.finale.from[0], data.finale.from[1]);
      const dx = data.finale.dx ?? 180;
      const p0 = { x: eP.x, y: eP.y };
      const p1 = { x: eP.x + dx, y: 1265 };
      const cP = { x: eP.x + dx + 45, y: (eP.y + 1265) / 2 - 30 };
      const at = (t) => { const u = 1 - t; return { x: u * u * p0.x + 2 * u * t * cP.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * cP.y + t * t * p1.y }; };
      const tan = (t) => Math.atan2(2 * (1 - t) * (cP.y - p0.y) + 2 * t * (p1.y - cP.y), 2 * (1 - t) * (cP.x - p0.x) + 2 * t * (p1.x - cP.x)) * 180 / Math.PI;
      const fsvg = document.createElementNS(NS, 'svg');
      fsvg.setAttribute('class', 'finale');
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', `M ${p0.x} ${p0.y} Q ${cP.x} ${cP.y} ${p1.x} ${p1.y}`);
      path.setAttribute('class', 'finale-path');
      fsvg.appendChild(path);
      const pl = at(0.42), deg = tan(0.42) + 90;
      const plane = document.createElementNS(NS, 'g');
      plane.setAttribute('transform', `translate(${pl.x} ${pl.y}) rotate(${deg}) scale(1.75)`);
      plane.setAttribute('class', 'finale-mark');
      const pp = document.createElementNS(NS, 'path');
      pp.setAttribute('d', 'M0,-11 L2.2,-3.5 L11,2.5 L2.2,3 L1.6,8.5 L4.2,10.5 L0,9.3 L-4.2,10.5 L-1.6,8.5 L-2.2,3 L-11,2.5 L-2.2,-3.5 Z');
      plane.appendChild(pp);
      fsvg.appendChild(plane);
      mapEl.parentElement.appendChild(fsvg);

      const tag = document.createElement('div');
      tag.className = 'finale-tag';
      const rightEdge = eP.x > 1250;   // keep the tag on-canvas for right-edge starts
      tag.style.cssText = `left:${rightEdge ? eP.x - 14 : eP.x + 34}px;top:${eP.y + 40}px${rightEdge ? ';transform:translateX(-100%)' : ''}`;
      tag.innerHTML = data.finale.label;
      mapEl.parentElement.appendChild(tag);
    }

    // signal to the renderer (Playwright) that tiles have settled
    let settleTimer;
    const done = () => { window.__mapReady = true; };
    map.eachLayer((layer) => { if (layer.on && layer._url) layer.on('load', () => { clearTimeout(settleTimer); settleTimer = setTimeout(done, 600); }); });
    setTimeout(done, INSETS.length ? 9000 : 6000);
  });
</script>

<div class="map" bind:this={mapEl}></div>

<style>
  .map { position: absolute; inset: 0; width: 1600px; height: 1200px; background: #eef1ee; }
  :global(.leaflet-container) { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif; background: #dce6e8; }
  :global(.leaflet-control-attribution) { font-size: 11px; background: rgba(255, 255, 255, 0.7); color: #6b6b6b; padding: 2px 6px; border-radius: 6px 0 0 0; }

  :global(.stay-pin) { position: relative; width: 26px; height: 26px; border-radius: 50%; background: #1f9a5f; color: #fff; border: 3px solid #fff; box-shadow: 0 3px 7px rgba(20,40,30,.35); font-size: 14px; font-weight: 700; line-height: 20px; text-align: center; }
  :global(.hotel-badge) { position: absolute; top: -8px; right: -9px; width: 17px; height: 17px; border-radius: 50%; background: #4b3ba6; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(30,20,60,.4); display: flex; align-items: center; justify-content: center; }
  :global(.hotel-badge svg) { width: 12px; height: 12px; fill: #fff; }
  :global(.pin-label) { position: absolute; white-space: nowrap; background: rgba(255,255,255,.95); border-radius: 9px; padding: 4px 9px; box-shadow: 0 2px 8px rgba(60,55,45,.2); display: flex; flex-direction: column; line-height: 1.15; }
  :global(.pin-label.ra) { align-items: flex-end; text-align: right; }
  :global(.pin-label b) { font-size: 14.5px; font-weight: 700; color: #2a2722; }
  :global(.pin-label.town) { flex-direction: row; align-items: baseline; gap: 7px; padding: 4px 11px; }
  :global(.pin-label.town b) { font-size: 15px; }

  :global(.poi-dot) { width: 13px; height: 13px; border-radius: 50%; background: #e8a01e; border: 2.5px solid #fff; box-shadow: 0 2px 5px rgba(90,60,10,.4); }
  :global(.poi-label) { position: absolute; white-space: nowrap; font-size: 13px; font-weight: 600; color: #6b4e12; text-shadow: 0 1px 2px #fff,0 -1px 2px #fff,1px 0 2px #fff,-1px 0 2px #fff; }
  :global(.poi-label.ra) { text-align: right; }

  :global(.ferry-badge) { display: flex; align-items: center; gap: 2px; background: #ef5f38; color: #fff; font-size: 13px; font-weight: 700; padding: 2px 8px; border-radius: 20px; border: 2px solid #fff; box-shadow: 0 2px 6px rgba(120,40,20,.35); white-space: nowrap; }
  :global(.ferry-badge i) { font-style: normal; }

  :global(.dir) { width: 22px; height: 22px; }
  :global(.dir svg) { width: 15px; height: 15px; display: block; margin: 3.5px auto; }
  :global(.dir path) { fill: #ffffff; stroke: #33414c; stroke-width: 1.6; stroke-linejoin: round; opacity: 0.92; }

  :global(.leaders) { position: absolute; inset: 0; width: 1600px; height: 1200px; z-index: 450; pointer-events: none; }
  :global(.leader) { stroke: #2f4a58; stroke-width: 2; stroke-dasharray: 3 6; opacity: 0.6; }
  :global(.leader-dot) { fill: #2f4a58; opacity: 0.85; }
  :global(.inset) { position: absolute; z-index: 470; border-radius: 50%; overflow: hidden; border: 5px solid #fff; box-shadow: 0 10px 30px rgba(40, 45, 55, 0.35); }

  :global(.note-svg) { position: absolute; inset: 0; width: 1600px; height: 1200px; z-index: 455; pointer-events: none; }
  :global(.note-leader) { fill: none; stroke: #c2410c; stroke-width: 2; stroke-dasharray: 1 8; stroke-linecap: round; opacity: 0.8; }
  :global(.note-dot) { fill: #c2410c; stroke: #fff; stroke-width: 1.6; }
  :global(.note-tag) { position: absolute; z-index: 465; transform: translate(-50%, -50%); white-space: nowrap; background: rgba(255, 250, 244, 0.95); border: 1px solid rgba(194, 65, 12, 0.35); border-radius: 12px; padding: 5px 12px; box-shadow: 0 4px 12px rgba(80, 40, 20, 0.18); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif; text-align: center; line-height: 1.25; }
  :global(.note-tag b) { display: block; font-size: 13.5px; font-weight: 800; color: #9a3412; }
  :global(.note-tag span) { display: block; font-size: 12px; font-weight: 600; color: #b4592f; font-style: italic; }

  :global(.finale) { position: absolute; inset: 0; width: 1600px; height: 1200px; z-index: 460; pointer-events: none; overflow: hidden; }
  :global(.finale-path) { fill: none; stroke: #d8452a; stroke-width: 3.4; stroke-linecap: round; stroke-dasharray: 1 13; opacity: 0.95; }
  :global(.finale-mark) { fill: #d8452a; stroke: #fff; stroke-width: 1.6; stroke-linejoin: round; }
  :global(.finale-tag) { position: absolute; z-index: 465; white-space: nowrap; background: rgba(255, 255, 255, 0.94); border-radius: 999px; padding: 5px 13px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif; font-size: 13.5px; font-weight: 700; color: #b23a22; box-shadow: 0 4px 12px rgba(40, 45, 55, 0.25); }

  :global(.bubble-cap) { position: absolute; z-index: 480; box-sizing: border-box; width: max-content; max-width: 500px; padding: 7px 16px 9px; background: rgba(255, 255, 255, 0.94); border-radius: 16px; box-shadow: 0 6px 18px rgba(40, 45, 55, 0.28); }
  :global(.bubble-title) { text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif; font-size: 19px; font-weight: 800; color: #2a3a44; }
  :global(.bubble-hotels) { margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif; font-size: 13.5px; font-weight: 700; color: #4b3ba6; }
  :global(.bubble-hotels .bed) { display: inline-flex; width: 18px; height: 18px; border-radius: 50%; background: #4b3ba6; align-items: center; justify-content: center; flex: none; }
  :global(.bubble-hotels .bed svg) { width: 12px; height: 12px; fill: #fff; }
  :global(.bubble-pois) { margin-top: 5px; display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif; }
  :global(.bubble-cap.vert) { width: max-content; max-width: 200px; padding: 8px 13px 9px; }
  :global(.bubble-cap.vert .bubble-title) { text-align: left; font-size: 17px; }
  :global(.bubble-cap.vert .bubble-hotels) { justify-content: flex-start; margin-top: 3px; }
  :global(.bubble-cap.vert .bubble-pois) { flex-direction: column; flex-wrap: nowrap; align-items: flex-start; gap: 3px; margin-top: 5px; }
  :global(.bubble-cap.vert .bubble-pois span) { font-size: 13.5px; }
  :global(.bubble-pois span) { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: #4a473e; }
  :global(.bubble-pois i) { width: 17px; height: 17px; border-radius: 50%; background: #e8a01e; color: #fff; flex: none; box-shadow: 0 0 0 1.5px #fff; font-size: 11px; font-weight: 800; font-style: normal; line-height: 17px; text-align: center; }
  :global(.mini-hotel) { width: 24px; height: 24px; border-radius: 50%; background: #4b3ba6; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(30,20,60,.45); display: flex; align-items: center; justify-content: center; }
  :global(.mini-hotel svg) { width: 15px; height: 15px; fill: #fff; }
  :global(.mini-num) { width: 20px; height: 20px; border-radius: 50%; background: #e8a01e; color: #fff; border: 2.5px solid #fff; box-shadow: 0 1px 5px rgba(90,60,10,.45); font-size: 12px; font-weight: 800; line-height: 15px; text-align: center; }
  :global(.mini-poi) { width: 10px; height: 10px; border-radius: 50%; background: #e8a01e; border: 2.5px solid #fff; box-shadow: 0 1px 4px rgba(90,60,10,.4); }
</style>
