<script>
  import { onMount } from 'svelte';
  import JourneyMap from '$lib/JourneyMap.svelte';
  import data from '$lib/journey.json';

  const PALETTES = {
    cobalt: { motorway: '#0b2f6b', a: '#2f6fe0', b: '#0e9488', minor: '#f08a24' },
    signage: { motorway: '#1f5fb4', a: '#178a4c', b: '#d99a1c', minor: '#7f8a90' },
    berry: { motorway: '#6b21a8', a: '#c026d3', b: '#e11d75', minor: '#f59e0b' },
    ember: { motorway: '#7c2d12', a: '#ea580c', b: '#0d9488', minor: '#4d7c0f' }
  };
  // minimal one-line credit per basemap
  const MAP_CREDIT = {
    topo: 'Esri World Topo', gray: 'Esri Light Gray', natgeo: 'National Geographic · Esri',
    imagery: 'Esri World Imagery', street: 'Esri Street Map', terrain: 'Esri Terrain',
    ocean: 'Esri Ocean basemap', opentopo: 'OpenTopoMap', osm: 'OpenStreetMap',
    cyclosm: 'CyclOSM', hot: 'Humanitarian OSM', watercolor: 'Stamen Watercolor · Stadia Maps',
    stamen: 'Stamen Terrain · Stadia Maps', outdoors: 'Stadia Outdoors', smooth: 'Alidade Smooth · Stadia Maps'
  };

  const STADIA_FALLBACK = { watercolor: 'opentopo', stamen: 'opentopo', outdoors: 'opentopo', smooth: 'gray' };
  let pal = PALETTES.cobalt;
  let mapCredit = 'Esri World Topo';

  // compact elevation profile for the legend card (built once; data is static)
  const EW = 300, EH = 34;
  const elev = (data.elevation ?? []).filter((d) => Number.isFinite(d.mi) && Number.isFinite(d.m));
  let elevArea = '', elevLine = '', elevPeak = 0, elevClimb = 0;
  if (elev.length >= 2) {
    const maxMi = Math.max(...elev.map((d) => d.mi));
    const minM = Math.min(...elev.map((d) => d.m)), maxM = Math.max(...elev.map((d) => d.m));
    const yMin = minM > 40 ? minM - 15 : Math.min(0, minM);
    const yMax = maxM + Math.max(15, (maxM - yMin) * 0.08);
    const X = (mi) => (mi / maxMi) * EW;
    const Y = (m) => EH - ((m - yMin) / (yMax - yMin || 1)) * EH;
    elevLine = elev.map((d, i) => `${i ? 'L' : 'M'}${X(d.mi).toFixed(1)},${Y(d.m).toFixed(1)}`).join(' ');
    elevArea = `M0,${EH} ` + elev.map((d) => `L${X(d.mi).toFixed(1)},${Y(d.m).toFixed(1)}`).join(' ') + ` L${EW},${EH} Z`;
    elevPeak = maxM;
    elevClimb = elev.reduce((g, d, i) => g + (i ? Math.max(0, d.m - elev[i - 1].m) : 0), 0);
  }
  onMount(() => {
    const p = new URLSearchParams(location.search);
    pal = PALETTES[p.get('roads')] || PALETTES.cobalt;
    let style = p.get('style') || 'topo';
    if (STADIA_FALLBACK[style] && !import.meta.env.VITE_STADIA_API_KEY) style = STADIA_FALLBACK[style];
    mapCredit = MAP_CREDIT[style] || 'Esri World Topo';
  });
</script>

<svelte:head>
  <title>{data.title}</title>
</svelte:head>

<div class="frame">
  <div id="journey-card" class="card">
    <JourneyMap />

    <!-- title + subtitle -->
    <div class="overlay title-card">
      <h1>{data.title}</h1>
      {#if data.subtitle}<div class="subtitle">{data.subtitle}</div>{/if}
    </div>

    <!-- daily weather -->
    {#if data.weather}
    <div class="overlay wx-card">
      <h2>{'☁'} Daily weather{data.weatherMonth ? ` · ${data.weatherMonth}` : ''}</h2>
      <table><tbody>
        {#each data.weather as w}
          <tr><td class="wd">{w.d}</td><td class="wi">{w.icon}</td><td class="ww">{w.where}</td><td class="wt">{w.t}</td></tr>
        {/each}
      </tbody></table>
    </div>
    {/if}

    <!-- ferry crossings -->
    {#if data.ferries && data.ferries.length}
    <div class="overlay ferry-card">
      <h2>&#9972; Ferry crossings</h2>
      <table><tbody>
        {#each data.ferries as f}
          <tr>
            <td class="fn"><span>{f.num}</span></td>
            <td class="fr">{f.short}</td>
            <td class="fv">{f.vessel}<i>{f.size}</i></td>
            <td class="ft">{f.dur}</td>
          </tr>
        {/each}
      </tbody></table>
    </div>
    {/if}

    <!-- distance + road-class legend — wide, two columns -->
    <div class="overlay legend-card">
      <div class="legtitle">Total distance <b>{data.totalMiles.toLocaleString()}</b></div>
      <div class="roads-grid">
        {#each data.roadStats as r}
          <div class="rrow">
            <span class="rl {r.cls}" style="background:{pal[r.cls]}"></span>
            <span class="rlbl">{r.label}</span>
            <span class="rmi">{r.mi} mi</span>
          </div>
        {/each}
      </div>
      {#if elevLine}
        <div class="elev-strip">
          <svg class="elev-mini" viewBox="0 0 {EW} {EH}" preserveAspectRatio="none">
            <path class="ea" d={elevArea} />
            <path class="el" d={elevLine} />
          </svg>
          <div class="elev-meta"><b>Elevation</b> &#9650; {elevPeak.toLocaleString()} m &middot; &uarr; {Math.round(elevClimb).toLocaleString()} m climb</div>
        </div>
      {/if}
    </div>

    <!-- tiny map credit -->
    <div class="map-credit">Map: {mapCredit}</div>
  </div>
</div>

<style>
  :global(html, body) { margin: 0; padding: 0; background: #e9e6e0; }
  .frame { width: 1600px; height: 1200px; overflow: hidden; }
  .card { position: relative; width: 1600px; height: 1200px; border-radius: 28px; overflow: hidden; background: #eef1ee; }
  .overlay {
    position: absolute; z-index: 500;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
    background: rgba(255, 255, 255, 0.93);
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
    border-radius: 22px; box-shadow: 0 10px 30px rgba(50, 45, 35, 0.18);
  }

  .title-card { top: 40px; left: 40px; padding: 12px 24px 13px; }
  .title-card h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.6px; color: #2a2722; }
  .subtitle { margin-top: 3px; font-size: 13.5px; font-weight: 600; color: #8a8172; letter-spacing: 0.1px; }

  .wx-card { top: 40px; left: 540px; padding: 12px 18px 11px; }
  .wx-card h2 { margin: 0 0 7px; font-size: 15px; font-weight: 800; color: #2f6fb0; letter-spacing: -0.2px; }
  .wx-card table { border-collapse: collapse; }
  .wx-card td { padding: 2px 0; vertical-align: middle; line-height: 1.15; }
  .wd { font-size: 13px; font-weight: 800; color: #9aa0aa; padding-right: 9px !important; text-align: right; }
  .wi { font-size: 15px; padding-right: 9px !important; text-align: center; }
  .ww { font-size: 13.5px; font-weight: 700; color: #2a2722; padding-right: 18px !important; white-space: nowrap; }
  .wt { font-size: 13px; font-weight: 700; color: #2f6fb0; text-align: right; white-space: nowrap; }

  .ferry-card { top: 128px; left: 40px; padding: 14px 20px; }
  .ferry-card h2 { margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #c94a24; }
  .ferry-card table { border-collapse: collapse; }
  .ferry-card td { padding: 3px 0; vertical-align: middle; }
  .fn { padding-right: 9px !important; }
  .fn span { display: flex; width: 20px; height: 20px; border-radius: 50%; background: #ef5f38; color: #fff; font-size: 11px; font-weight: 700; align-items: center; justify-content: center; }
  .fr { font-size: 14.5px; font-weight: 700; color: #2f2c26; padding-right: 16px !important; }
  .fv { font-size: 12.5px; font-weight: 600; color: #5a5346; padding-right: 16px !important; line-height: 1.1; }
  .fv i { display: block; font-style: normal; font-size: 11px; font-weight: 500; color: #9a917f; }
  .ft { font-size: 14px; font-weight: 700; color: #c94a24; text-align: right; white-space: nowrap; }

  .legend-card { bottom: 40px; left: 40px; padding: 14px 24px 15px; }
  .legtitle { font-size: 17px; font-weight: 600; color: #3a382f; padding-bottom: 8px; margin-bottom: 9px; border-bottom: 1px solid #ece7dd; }
  .legtitle b { font-size: 22px; font-weight: 800; color: #2a2722; }
  .legtitle b::after { content: ' mi'; font-size: 13px; font-weight: 600; color: #857c6c; }
  .roads-grid { display: grid; grid-template-columns: auto auto; gap: 8px 36px; }
  .rrow { display: flex; align-items: center; gap: 11px; }
  .rl { display: block; width: 30px; border-radius: 4px; flex: none; }
  .rl.motorway { height: 9px; }
  .rl.a { height: 6px; }
  .rl.b { height: 4px; }
  .rl.minor { height: 2.5px; }
  .rlbl { font-size: 15px; font-weight: 600; color: #4a473e; }
  .rmi { font-size: 15px; font-weight: 700; color: #2a2722; margin-left: auto; padding-left: 16px; white-space: nowrap; }
  .elev-strip { margin-top: 9px; padding-top: 8px; border-top: 1px solid #ece7dd; }
  .elev-mini { display: block; width: 100%; height: 34px; }
  .elev-mini .ea { fill: rgba(14, 148, 136, 0.18); }
  .elev-mini .el { fill: none; stroke: #0e9488; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .elev-meta { margin-top: 5px; font-size: 11.5px; font-weight: 600; color: #6a655a; }
  .elev-meta b { color: #2a2722; font-weight: 700; }

  .map-credit {
    position: absolute; z-index: 500; left: 44px; bottom: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
    font-size: 10px; font-weight: 600; color: rgba(60, 55, 45, 0.5);
    background: rgba(255, 255, 255, 0.28); padding: 2px 7px; border-radius: 7px;
    letter-spacing: 0.1px; white-space: nowrap;
  }
</style>
