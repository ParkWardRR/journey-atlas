<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import '$lib/themes.css';
  import data from '$lib/journey.json';
  import AtlasMap from '$lib/AtlasMap.svelte';
  import {
    THEMES, THEME_BY_ID, TILES, BASEMAP_OPTIONS, PALETTE_OPTIONS,
    PALETTES, resolveStyle, HAS_STADIA_KEY, STADIA_FALLBACK
  } from '$lib/basemaps.js';

  const STORAGE_KEY = 'atlas-theme';

  // The inline script in app.html already set <html data-theme> from storage /
  // system preference before paint — start from that so there's no flash.
  const initialTheme = () => {
    if (!browser) return 'light';
    const attr = document.documentElement.getAttribute('data-theme');
    return THEME_BY_ID[attr] ? attr : 'light';
  };

  let theme = $state(initialTheme());
  let style = $state('topo');
  let palette = $state('cobalt');
  let ready = $state(false); // gate the map until we know the container has a size

  // Keep <html data-theme> in sync when the theme changes at runtime.
  $effect(() => {
    if (browser) document.documentElement.setAttribute('data-theme', theme);
  });

  const dark = $derived(theme === 'night');
  const resolvedStyle = $derived(resolveStyle(style));
  const mapCredit = $derived(TILES[resolvedStyle]?.label ?? 'Esri World Topo');
  const usingFallback = $derived(!!STADIA_FALLBACK[style] && !HAS_STADIA_KEY);
  // Basemap label, flagging Stadia styles that will fall back without a key.
  const basemapLabel = (b) =>
    TILES[b].label + (STADIA_FALLBACK[b] && !HAS_STADIA_KEY ? ' — needs key' : '');

  // ── derived trip stats ───────────────────────────────────────
  const roadLabels = { motorway: 'Motorway', a: 'A-road', b: 'B-road', minor: 'Single-track / minor' };
  const stats = $derived([
    { label: 'Total distance', value: (data.totalMiles ?? 0).toLocaleString(), unit: 'mi' },
    { label: 'Overnight stays', value: (data.stays?.length ?? 0), unit: data.stays?.length === 1 ? 'stop' : 'stops' },
    { label: 'Ferry crossings', value: (data.ferries?.length ?? 0), unit: data.ferries?.length === 1 ? 'leg' : 'legs' },
    { label: 'Sights', value: (data.pois?.length ?? 0), unit: 'POIs' }
  ]);
  const maxRoadMi = $derived(Math.max(1, ...(data.roadStats ?? []).map((r) => r.mi)));

  function applyTheme(id, { keepBasemap = false } = {}) {
    const t = THEME_BY_ID[id] ?? THEME_BY_ID.light;
    theme = t.id;
    if (!keepBasemap) {
      style = t.basemap;
      palette = t.palette;
    }
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, t.id);
  }

  onMount(() => {
    // theme is already resolved (app.html + initialTheme); set this theme's
    // default basemap + palette and persist the choice, then reveal the map.
    applyTheme(theme);
    ready = true;
  });
</script>

<svelte:head>
  <title>{data.title} · journey-atlas</title>
  {#if data.subtitle}<meta name="description" content={data.subtitle} />{/if}
</svelte:head>

<div class="page" style="background:var(--bg-grad);">
  <header class="hero">
    <div class="hero-inner">
      <div class="hero-lead">
        <p class="eyebrow"><a class="eyebrow-link" href="gallery">journey-atlas</a> · <a class="eyebrow-link" href="gallery">all journeys →</a></p>
        <h1>{data.title}</h1>
        {#if data.subtitle}<p class="subtitle">{data.subtitle}</p>{/if}
      </div>

      <div class="controls" aria-label="Appearance controls">
        <div class="theme-picker" role="group" aria-label="Theme">
          {#each THEMES as t}
            <button
              class="theme-chip"
              class:active={theme === t.id}
              style="--chip:{t.swatch}"
              aria-pressed={theme === t.id}
              onclick={() => applyTheme(t.id)}
            >
              <span class="dot"></span>{t.name}
            </button>
          {/each}
        </div>

        <div class="selects">
          <label>
            <span>Basemap</span>
            <select bind:value={style}>
              {#each BASEMAP_OPTIONS as b}
                <option value={b}>{basemapLabel(b)}</option>
              {/each}
            </select>
          </label>
          <label>
            <span>Roads</span>
            <select bind:value={palette}>
              {#each PALETTE_OPTIONS as p}
                <option value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
              {/each}
            </select>
          </label>
        </div>
      </div>
    </div>
  </header>

  <main class="wrap">
    <!-- Interactive map -->
    <section class="map-shell">
      {#if ready}
        {#key `${resolvedStyle}-${palette}-${dark}`}
          <AtlasMap {data} style={resolvedStyle} {palette} {dark} />
        {/key}
      {/if}
      <div class="map-credit">Map: {mapCredit}{#if usingFallback} · keyless fallback{/if}</div>
    </section>

    <!-- Stat tiles -->
    <section class="stats">
      {#each stats as s}
        <div class="tile">
          <div class="tile-value">{s.value}<span>{s.unit}</span></div>
          <div class="tile-label">{s.label}</div>
        </div>
      {/each}
    </section>

    <!-- Itinerary -->
    {#if data.stays?.length}
      <section class="block">
        <h2 class="block-title">Itinerary</h2>
        <ol class="timeline">
          {#each data.stays as s, i}
            <li class="stop">
              <span class="stop-num">{i + 1}</span>
              <div class="stop-body">
                <div class="stop-head">
                  <h3>{s.area}</h3>
                  {#if s.dates}<span class="stop-date">{s.dates}</span>{/if}
                </div>
                {#if s.hotel}<p class="stop-hotel">🛏 {s.hotel}</p>{/if}
              </div>
            </li>
          {/each}
        </ol>
      </section>
    {/if}

    <div class="two-col">
      <!-- Sights -->
      {#if data.pois?.length}
        <section class="block">
          <h2 class="block-title">Sights along the way</h2>
          <ul class="chips">
            {#each data.pois as p}
              <li class="chip"><span class="chip-dot"></span>{p.name}</li>
            {/each}
          </ul>
        </section>
      {/if}

      <!-- Ferries -->
      {#if data.ferries?.length}
        <section class="block">
          <h2 class="block-title">Ferry crossings</h2>
          <ul class="ferries">
            {#each data.ferries as f}
              <li class="ferry">
                <span class="ferry-num">{f.num}</span>
                <div>
                  <div class="ferry-route">{f.short}</div>
                  <div class="ferry-meta">{f.vessel} · {f.size}</div>
                </div>
                <span class="ferry-dur">{f.dur}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>

    <!-- Weather -->
    {#if data.weather?.length}
      <section class="block">
        <h2 class="block-title">Daily weather{data.weatherMonth ? ` · ${data.weatherMonth}` : ''}</h2>
        <div class="wx-grid">
          {#each data.weather as w}
            <div class="wx">
              <div class="wx-day">{w.d}</div>
              <div class="wx-icon">{w.icon}</div>
              <div class="wx-where">{w.where}</div>
              <div class="wx-temp">{w.t}</div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Road breakdown -->
    {#if data.roadStats?.length}
      <section class="block">
        <h2 class="block-title">Distance by road class</h2>
        <div class="roads">
          {#each data.roadStats as r}
            <div class="road-row">
              <span class="road-label">{r.label ?? roadLabels[r.cls] ?? r.cls}</span>
              <span class="road-bar">
                <span class="road-fill" style="width:{(r.mi / maxRoadMi) * 100}%;background:{PALETTES[palette][r.cls] ?? 'var(--text-muted)'}"></span>
              </span>
              <span class="road-mi">{r.mi} mi</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <footer class="foot">
      <p>Built with <a href="/">journey-atlas</a> · basemap tiles © their providers · weather © Open-Meteo</p>
    </footer>
  </main>
</div>

<style>
  :global(html, body) { margin: 0; padding: 0; }

  .page { min-height: 100vh; font-family: var(--font-sans); }

  /* ── hero ── */
  .hero { padding: 40px 24px 8px; }
  .hero-inner {
    max-width: var(--maxw); margin: 0 auto;
    display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-end; justify-content: space-between;
  }
  .eyebrow { margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent); }
  .eyebrow-link { color: inherit; text-decoration: none; }
  .eyebrow-link:hover { text-decoration: underline; }
  h1 { margin: 0; font-family: var(--heading-font); font-size: clamp(30px, 5vw, 46px); font-weight: 800; letter-spacing: var(--heading-spacing); line-height: 1.05; }
  .subtitle { margin: 10px 0 0; font-size: 16px; font-weight: 500; color: var(--text-muted); max-width: 46ch; }

  .controls { display: flex; flex-direction: column; gap: 12px; align-items: flex-end; }
  .theme-picker { display: flex; flex-wrap: wrap; gap: 6px; }
  .theme-chip {
    display: inline-flex; align-items: center; gap: 7px;
    border: 1px solid var(--border); background: var(--panel); color: var(--text);
    padding: 7px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.05s;
  }
  .theme-chip .dot { width: 11px; height: 11px; border-radius: 50%; background: var(--chip); box-shadow: 0 0 0 2px var(--panel), 0 0 0 3px var(--border); }
  .theme-chip:hover { border-color: var(--accent); }
  .theme-chip:active { transform: translateY(1px); }
  .theme-chip.active { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent); }

  .selects { display: flex; gap: 10px; }
  .selects label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--text-muted); }
  .selects select {
    font-family: var(--font-sans); font-size: 13px; font-weight: 600; color: var(--text);
    background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 7px 10px; cursor: pointer;
  }

  .wrap { max-width: var(--maxw); margin: 0 auto; padding: 20px 24px 60px; }

  /* ── map ── */
  .map-shell {
    position: relative; height: min(66vh, 640px); border-radius: var(--radius); overflow: hidden;
    border: 1px solid var(--border); box-shadow: var(--shadow); background: var(--panel-2);
  }
  .map-credit {
    position: absolute; left: 12px; bottom: 12px; z-index: 500;
    font-size: 11px; font-weight: 600; color: var(--text);
    background: color-mix(in srgb, var(--panel) 85%, transparent);
    padding: 3px 9px; border-radius: 8px; border: 1px solid var(--border); backdrop-filter: blur(4px);
  }

  /* ── stat tiles ── */
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 22px 0; }
  .tile { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 18px; box-shadow: var(--shadow); }
  .tile-value { font-family: var(--heading-font); font-size: 32px; font-weight: 800; letter-spacing: -1px; line-height: 1; }
  .tile-value span { font-size: 14px; font-weight: 600; color: var(--text-muted); margin-left: 5px; letter-spacing: 0; }
  .tile-label { margin-top: 8px; font-size: 13px; font-weight: 600; color: var(--text-muted); }

  /* ── generic block ── */
  .block { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; box-shadow: var(--shadow); margin-bottom: 20px; }
  .block-title { margin: 0 0 16px; font-family: var(--heading-font); font-size: 20px; font-weight: 800; letter-spacing: var(--heading-spacing); }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
  .two-col .block { margin-bottom: 0; }

  /* ── timeline ── */
  .timeline { list-style: none; margin: 0; padding: 0; }
  .stop { position: relative; display: flex; gap: 16px; padding-bottom: 20px; }
  .stop:not(:last-child)::before { content: ''; position: absolute; left: 15px; top: 34px; bottom: 0; width: 2px; background: var(--border); }
  .stop-num { flex: none; width: 32px; height: 32px; border-radius: 50%; background: var(--accent); color: #fff; font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; z-index: 1; }
  .stop-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .stop-head h3 { margin: 4px 0 0; font-size: 17px; font-weight: 700; }
  .stop-date { font-size: 13px; font-weight: 700; color: var(--accent-2); }
  .stop-hotel { margin: 4px 0 0; font-size: 14px; color: var(--text-muted); }

  /* ── chips (sights) ── */
  .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { display: inline-flex; align-items: center; gap: 7px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 999px; padding: 7px 13px; font-size: 13.5px; font-weight: 600; }
  .chip-dot { width: 9px; height: 9px; border-radius: 50%; background: #e8a01e; }

  /* ── ferries ── */
  .ferries { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .ferry { display: flex; align-items: center; gap: 12px; }
  .ferry-num { flex: none; width: 24px; height: 24px; border-radius: 50%; background: #ef5f38; color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .ferry-route { font-size: 14.5px; font-weight: 700; }
  .ferry-meta { font-size: 12.5px; color: var(--text-muted); }
  .ferry-dur { margin-left: auto; font-size: 14px; font-weight: 700; color: #c94a24; white-space: nowrap; }

  /* ── weather ── */
  .wx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
  .wx { background: var(--panel-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 14px; text-align: center; }
  .wx-day { font-size: 12px; font-weight: 800; color: var(--text-muted); }
  .wx-icon { font-size: 26px; line-height: 1.2; }
  .wx-where { font-size: 13.5px; font-weight: 700; }
  .wx-temp { font-size: 12px; font-weight: 600; color: var(--accent); margin-top: 2px; }

  /* ── road bars ── */
  .roads { display: flex; flex-direction: column; gap: 12px; }
  .road-row { display: grid; grid-template-columns: 160px 1fr 60px; align-items: center; gap: 12px; }
  .road-label { font-size: 14px; font-weight: 600; }
  .road-bar { height: 12px; border-radius: 999px; background: var(--panel-2); overflow: hidden; }
  .road-fill { display: block; height: 100%; border-radius: 999px; }
  .road-mi { font-size: 14px; font-weight: 700; text-align: right; }

  .foot { margin-top: 32px; text-align: center; font-size: 13px; color: var(--text-muted); }
  .foot a { color: var(--accent); }

  @media (max-width: 760px) {
    .hero-inner { flex-direction: column; align-items: stretch; }
    .controls { align-items: stretch; }
    .theme-picker { justify-content: flex-start; }
    .stats { grid-template-columns: repeat(2, 1fr); }
    .two-col { grid-template-columns: 1fr; }
    .road-row { grid-template-columns: 110px 1fr 54px; }
  }
</style>
