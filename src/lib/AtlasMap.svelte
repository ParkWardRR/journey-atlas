<script>
  import { onMount } from 'svelte';
  import { TILES, PALETTES, ROAD_WEIGHTS as RW, resolveStyle } from '$lib/basemaps.js';

  // Responsive, interactive Leaflet map for the web UI. Rebuilds cleanly on
  // any prop change (the parent wraps it in a {#key} block).
  let { data, style = 'topo', palette = 'cobalt', dark = false } = $props();

  let mapEl;

  const BED = '<svg viewBox="0 0 24 24"><path d="M7 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9a4 4 0 0 0-4-4z"/></svg>';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  onMount(() => {
    let map;
    let onResize;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !mapEl) return;

      const tile = TILES[resolveStyle(style)];
      const pal = PALETTES[palette] || PALETTES.cobalt;

      map = L.map(mapEl, { scrollWheelZoom: true, zoomSnap: 0.25, attributionControl: true });
      L.tileLayer(tile.url, { maxZoom: tile.max, detectRetina: true, attribution: tile.attr }).addTo(map);

      const bounds = [];

      // driving route — white casing then coloured line, width by class
      for (const d of data.drives || []) for (const s of d.segs) {
        L.polyline(s.line, { color: '#fff', weight: RW[s.cls].c, opacity: 0.85, lineJoin: 'round', lineCap: 'round' }).addTo(map);
        for (const p of s.line) bounds.push(p);
      }
      for (const d of data.drives || []) for (const s of d.segs) {
        L.polyline(s.line, { color: pal[s.cls], weight: RW[s.cls].w, opacity: 0.97, lineJoin: 'round', lineCap: 'round' })
          .addTo(map)
          .bindPopup(`<b>${esc(d.label)}</b><br><span class="pop-sub">${esc(s.cls)}</span>`);
      }

      // ferries — dashed sea-legs, clickable
      for (const f of data.ferries || []) {
        L.polyline([f.a, f.b], { color: '#ef5f38', weight: 3.5, opacity: 0.95, dashArray: '2 10', lineCap: 'round' })
          .addTo(map)
          .bindPopup(`<b>⛴ ${esc(f.short)}</b><br>${esc(f.vessel)}<br><span class="pop-sub">${esc(f.size)} · ${esc(f.dur)}</span>`);
        bounds.push(f.a, f.b);
      }

      // overnight stays — numbered pins with popup
      (data.stays || []).forEach((s, i) => {
        bounds.push([s.lat, s.lon]);
        L.marker([s.lat, s.lon], {
          zIndexOffset: 600,
          icon: L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15], html: `<div class="stay-pin">${i + 1}<span class="hotel-badge">${BED}</span></div>` })
        }).addTo(map).bindPopup(
          `<b>${esc(s.area)}</b>` +
          (s.hotel ? `<br>🛏 ${esc(s.hotel)}` : '') +
          (s.dates ? `<br><span class="pop-sub">${esc(s.dates)}</span>` : '')
        );
      });

      // sights / POIs — dots with popup
      for (const p of data.pois || []) {
        bounds.push([p.lat, p.lon]);
        L.marker([p.lat, p.lon], {
          zIndexOffset: 300,
          icon: L.divIcon({ className: '', iconSize: [16, 16], iconAnchor: [8, 8], html: `<div class="poi-dot"></div>` })
        }).addTo(map).bindPopup(`<b>📍 ${esc(p.name)}</b>`);
      }

      if (bounds.length) map.fitBounds(bounds, { padding: [50, 50] });
      else map.setView([41.5, 20], 6);

      // keep the map correctly sized inside a responsive layout
      setTimeout(() => map && map.invalidateSize(), 60);
      onResize = () => map && map.invalidateSize();
      window.addEventListener('resize', onResize);
    })();

    return () => {
      cancelled = true;
      if (onResize) window.removeEventListener('resize', onResize);
      if (map) map.remove();
    };
  });
</script>

<div class="atlas-map" class:dark bind:this={mapEl}></div>

<style>
  .atlas-map {
    width: 100%;
    height: 100%;
    background: var(--panel-2, #dce6e8);
  }
  .atlas-map.dark :global(.leaflet-tile) { filter: var(--tile-filter, none); }

  :global(.leaflet-container) {
    font-family: var(--font-sans);
    background: var(--panel-2, #dce6e8);
    border-radius: inherit;
  }
  :global(.leaflet-popup-content) { font-family: var(--font-sans); font-size: 13px; line-height: 1.35; }
  :global(.leaflet-popup-content b) { font-size: 13.5px; }
  :global(.pop-sub) { color: #8a8172; font-size: 12px; }

  :global(.stay-pin) { position: relative; width: 26px; height: 26px; border-radius: 50%; background: #1f9a5f; color: #fff; border: 3px solid #fff; box-shadow: 0 3px 7px rgba(20, 40, 30, 0.35); font-size: 14px; font-weight: 700; line-height: 20px; text-align: center; }
  :global(.hotel-badge) { position: absolute; top: -8px; right: -9px; width: 17px; height: 17px; border-radius: 50%; background: #4b3ba6; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(30, 20, 60, 0.4); display: flex; align-items: center; justify-content: center; }
  :global(.hotel-badge svg) { width: 12px; height: 12px; fill: #fff; }
  :global(.poi-dot) { width: 13px; height: 13px; border-radius: 50%; background: #e8a01e; border: 2.5px solid #fff; box-shadow: 0 2px 5px rgba(90, 60, 10, 0.4); }
</style>
