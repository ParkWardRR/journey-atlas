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

  let pal = PALETTES.cobalt;
  let mapCredit = 'Esri World Topo';
  onMount(() => {
    const p = new URLSearchParams(location.search);
    pal = PALETTES[p.get('roads')] || PALETTES.cobalt;
    mapCredit = MAP_CREDIT[p.get('style')] || 'Esri World Topo';
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

    <!-- distance + road-class legend -->
    <div class="overlay legend-card">
      <div class="legtitle">Total distance <b>{data.totalMiles.toLocaleString()}</b></div>
      <table class="roads"><tbody>
        {#each data.roadStats as r}
          <tr>
            <td><span class="rl {r.cls}" style="background:{pal[r.cls]}"></span></td>
            <td class="rlbl">{r.label}</td>
            <td class="rmi">{r.mi} mi</td>
          </tr>
        {/each}
      </tbody></table>
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

  .legend-card { bottom: 40px; left: 40px; padding: 18px 22px; }
  .legtitle { font-size: 17px; font-weight: 600; color: #3a382f; padding-bottom: 9px; margin-bottom: 7px; border-bottom: 1px solid #ece7dd; }
  .legtitle b { font-size: 22px; font-weight: 800; color: #2a2722; }
  .legtitle b::after { content: ' mi'; font-size: 13px; font-weight: 600; color: #857c6c; }
  .roads { border-collapse: collapse; }
  .roads td { padding: 4px 0; vertical-align: middle; }
  .rl { display: block; width: 30px; border-radius: 4px; }
  .rl.motorway { height: 9px; }
  .rl.a { height: 6px; }
  .rl.b { height: 4px; }
  .rl.minor { height: 2.5px; }
  .rlbl { font-size: 15px; font-weight: 600; color: #4a473e; padding: 0 20px 0 12px; }
  .rmi { font-size: 15px; font-weight: 700; color: #2a2722; text-align: right; padding-right: 18px; }

  .map-credit {
    position: absolute; z-index: 500; left: 44px; bottom: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
    font-size: 10px; font-weight: 600; color: rgba(60, 55, 45, 0.5);
    background: rgba(255, 255, 255, 0.28); padding: 2px 7px; border-radius: 7px;
    letter-spacing: 0.1px; white-space: nowrap;
  }
</style>
