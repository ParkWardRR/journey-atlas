<script>
  import { browser } from '$app/environment';
  import '$lib/themes.css';
  import trips from '$lib/trips-index.json';
  import { THEMES, THEME_BY_ID } from '$lib/basemaps.js';

  const STORAGE_KEY = 'atlas-theme';

  // <html data-theme> was set before paint by the inline script in app.html.
  const initialTheme = () => {
    if (!browser) return 'light';
    const attr = document.documentElement.getAttribute('data-theme');
    return THEME_BY_ID[attr] ? attr : 'light';
  };
  let theme = $state(initialTheme());

  $effect(() => {
    if (browser) document.documentElement.setAttribute('data-theme', theme);
  });

  function pickTheme(id) {
    theme = THEME_BY_ID[id] ? id : 'light';
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, theme);
  }

  // Vite turns the committed renders in docs/trips/ into hashed, served assets.
  const thumbMods = import.meta.glob('/docs/trips/*.png', { eager: true, query: '?url', import: 'default' });
  const thumbUrl = (name) => (name ? thumbMods[`/docs/trips/${name}`] : undefined);

  const totalMiles = trips.reduce((n, t) => n + (t.totalMiles || 0), 0);
</script>

<svelte:head>
  <title>All journeys · journey-atlas</title>
  <meta name="description" content="Every starter route in journey-atlas, with a rendered map thumbnail." />
</svelte:head>

<div class="page" style="background:var(--bg-grad);">
  <header class="hero">
    <div class="hero-inner">
      <div class="hero-lead">
        <p class="eyebrow">journey-atlas</p>
        <h1>All journeys</h1>
        <p class="subtitle">
          {trips.length} routes · {totalMiles.toLocaleString()} miles ·
          <a class="inline-link" href="trip">open the interactive view →</a>
        </p>
      </div>

      <div class="theme-picker" role="group" aria-label="Theme">
        {#each THEMES as t}
          <button
            class="theme-chip"
            class:active={theme === t.id}
            style="--chip:{t.swatch}"
            aria-pressed={theme === t.id}
            onclick={() => pickTheme(t.id)}
          >
            <span class="dot"></span>{t.name}
          </button>
        {/each}
      </div>
    </div>
  </header>

  <main class="wrap">
    <ul class="grid">
      {#each trips as t}
        <li class="card">
          <svelte:element
            this={t.thumb ? 'a' : 'div'}
            class="card-inner"
            href={t.thumb ? thumbUrl(t.thumb) : undefined}
            target={t.thumb ? '_blank' : undefined}
            rel={t.thumb ? 'noopener' : undefined}
          >
            <div class="thumb">
              {#if t.thumb}
                <img src={thumbUrl(t.thumb)} alt="Rendered map of {t.title}" loading="lazy" />
              {:else}
                <div class="thumb-empty">No preview yet<span>run <code>npm run render:all</code></span></div>
              {/if}
            </div>
            <div class="card-body">
              <h2>{t.title}</h2>
              {#if t.subtitle}<p class="card-sub">{t.subtitle}</p>{/if}
              <div class="chips">
                <span class="pill">{t.totalMiles.toLocaleString()} mi</span>
                <span class="pill">{t.stays} {t.stays === 1 ? 'stay' : 'stays'}</span>
                <span class="pill">{t.ferries} {t.ferries === 1 ? 'ferry' : 'ferries'}</span>
                <span class="pill">{t.pois} sights</span>
              </div>
            </div>
          </svelte:element>
        </li>
      {/each}
    </ul>

    <footer class="foot">
      <p>Thumbnails rendered with <a href="/">journey-atlas</a> · click a card for the full-size map · basemap tiles © their providers</p>
    </footer>
  </main>
</div>

<style>
  .page { min-height: 100vh; font-family: var(--font-sans); color: var(--text); }
  .hero { padding: 44px 24px 12px; }
  .hero-inner {
    max-width: var(--maxw); margin: 0 auto;
    display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-end; justify-content: space-between;
  }
  .eyebrow { margin: 0 0 4px; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: var(--accent); font-weight: 700; }
  h1 { margin: 0; font-family: var(--heading-font); letter-spacing: var(--heading-spacing); font-size: clamp(30px, 5vw, 46px); }
  .subtitle { margin: 6px 0 0; color: var(--text-muted); font-size: 15px; }
  .inline-link { color: var(--accent); text-decoration: none; font-weight: 600; }
  .inline-link:hover { text-decoration: underline; }

  .theme-picker { display: flex; gap: 6px; flex-wrap: wrap; }
  .theme-chip {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 7px 12px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 600;
    border: 1px solid var(--border); background: var(--panel); color: var(--text);
  }
  .theme-chip.active { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent); }
  .theme-chip .dot { width: 11px; height: 11px; border-radius: 50%; background: var(--chip); box-shadow: 0 0 0 2px var(--panel), 0 0 0 3px var(--border); }

  .wrap { max-width: var(--maxw); margin: 0 auto; padding: 20px 24px 60px; }
  .grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
  .card { display: flex; }
  .card-inner {
    display: flex; flex-direction: column; width: 100%;
    background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius);
    overflow: hidden; box-shadow: var(--shadow); color: inherit; text-decoration: none;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  a.card-inner:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(0,0,0,0.22); }
  .thumb { aspect-ratio: 4 / 3; background: var(--panel-2); }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; filter: var(--tile-filter); }
  .thumb-empty {
    width: 100%; height: 100%; display: flex; flex-direction: column; gap: 6px;
    align-items: center; justify-content: center; color: var(--text-muted); font-size: 14px; text-align: center;
  }
  .thumb-empty span { font-size: 12px; }
  .thumb-empty code { background: var(--panel); padding: 1px 5px; border-radius: 6px; }

  .card-body { padding: 14px 16px 16px; }
  .card-body h2 { margin: 0; font-size: 19px; font-family: var(--heading-font); letter-spacing: var(--heading-spacing); }
  .card-sub { margin: 4px 0 10px; color: var(--text-muted); font-size: 13px; line-height: 1.4; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: var(--panel-2); border: 1px solid var(--border); color: var(--text-muted); }

  .foot { margin-top: 36px; text-align: center; color: var(--text-muted); font-size: 13px; }
  .foot a { color: var(--accent); }
</style>
