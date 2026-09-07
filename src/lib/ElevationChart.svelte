<script>
  // Elevation profile: a single-series area chart of metres over cumulative miles.
  // Single series → no legend (the section title names it); 2px line + soft fill
  // anchored to the plot baseline, recessive axes, and a crosshair+tooltip on hover.
  let { data = [] } = $props();

  const W = 760, H = 210;
  const pad = { l: 46, r: 14, t: 14, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const pts = $derived((data ?? []).filter((d) => Number.isFinite(d.mi) && Number.isFinite(d.m)));
  const maxMi = $derived(Math.max(1, ...pts.map((d) => d.mi)));
  const rawMin = $derived(Math.min(...pts.map((d) => d.m)));
  const rawMax = $derived(Math.max(...pts.map((d) => d.m)));
  // pad the y-domain a touch; clamp the floor at 0 (sea level) when we're near it
  const yMin = $derived(rawMin > 40 ? rawMin - 20 : Math.min(0, rawMin));
  const yMax = $derived(rawMax + Math.max(20, (rawMax - yMin) * 0.08));

  const x = (mi) => pad.l + (mi / maxMi) * iw;
  const y = (m) => pad.t + ih - ((m - yMin) / (yMax - yMin || 1)) * ih;

  const linePath = $derived(pts.map((d, i) => `${i ? 'L' : 'M'}${x(d.mi).toFixed(1)},${y(d.m).toFixed(1)}`).join(' '));
  const areaPath = $derived(
    pts.length
      ? `M${x(pts[0].mi).toFixed(1)},${(pad.t + ih).toFixed(1)} `
        + pts.map((d) => `L${x(d.mi).toFixed(1)},${y(d.m).toFixed(1)}`).join(' ')
        + ` L${x(pts[pts.length - 1].mi).toFixed(1)},${(pad.t + ih).toFixed(1)} Z`
      : ''
  );

  // ~4 recessive horizontal gridlines
  const yTicks = $derived.by(() => {
    const n = 4, out = [];
    for (let i = 0; i <= n; i++) out.push(Math.round(yMin + ((yMax - yMin) * i) / n));
    return out;
  });

  const peak = $derived(pts.reduce((a, d) => (d.m > a.m ? d : a), pts[0] ?? { mi: 0, m: 0 }));
  const climb = $derived(pts.reduce((g, d, i) => g + (i ? Math.max(0, d.m - pts[i - 1].m) : 0), 0));

  // hover crosshair + tooltip
  let hover = $state(null);
  function onMove(e) {
    const svg = e.currentTarget;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const mi = Math.max(0, Math.min(maxMi, ((px - pad.l) / iw) * maxMi));
    let best = pts[0], bd = Infinity;
    for (const d of pts) { const dd = Math.abs(d.mi - mi); if (dd < bd) { bd = dd; best = d; } }
    hover = best ?? null;
  }
</script>

{#if pts.length >= 2}
  <div class="elev">
    <div class="elev-summary">
      <span class="pill">Peak {peak.m.toLocaleString()} m</span>
      <span class="pill">+{Math.round(climb).toLocaleString()} m climb</span>
      <span class="pill">{maxMi.toLocaleString()} mi</span>
    </div>
    <svg
      viewBox="0 0 {W} {H}" class="elev-svg" role="img"
      aria-label="Elevation profile: peak {peak.m} metres over {maxMi} miles"
      onpointermove={onMove} onpointerleave={() => (hover = null)}
    >
      <!-- gridlines + y labels -->
      {#each yTicks as t}
        <line class="grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
        <text class="axis" x={pad.l - 8} y={y(t)} text-anchor="end" dominant-baseline="middle">{t}</text>
      {/each}
      <!-- x labels -->
      <text class="axis" x={pad.l} y={H - 6} text-anchor="start">0 mi</text>
      <text class="axis" x={W - pad.r} y={H - 6} text-anchor="end">{maxMi} mi</text>

      <!-- area + line -->
      <path class="area" d={areaPath} />
      <path class="line" d={linePath} />

      <!-- peak marker -->
      <circle class="peak" cx={x(peak.mi)} cy={y(peak.m)} r="3.2" />

      <!-- hover crosshair + tooltip -->
      {#if hover}
        {@const label = `${hover.mi} mi · ${hover.m.toLocaleString()} m`}
        {@const tipW = label.length * 6.3 + 16}
        <line class="cross" x1={x(hover.mi)} x2={x(hover.mi)} y1={pad.t} y2={pad.t + ih} />
        <circle class="dot" cx={x(hover.mi)} cy={y(hover.m)} r="4" />
        <g transform="translate({Math.min(x(hover.mi) + 8, W - pad.r - tipW)},{Math.max(pad.t + 12, y(hover.m) - 8)})">
          <rect class="tip" x="0" y="-14" width={tipW} height="22" rx="6" />
          <text class="tip-txt" x="8" y="1">{label}</text>
        </g>
      {/if}
    </svg>
  </div>
{/if}

<style>
  .elev { width: 100%; }
  .elev-summary { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .pill { font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: var(--panel-2); border: 1px solid var(--border); color: var(--text-muted); }
  .elev-svg { width: 100%; height: auto; display: block; touch-action: none; }

  .grid { stroke: var(--border); stroke-width: 1; opacity: 0.6; }
  .axis { fill: var(--text-muted); font-size: 11px; font-family: var(--font-sans); }
  .area { fill: color-mix(in srgb, var(--accent-2) 22%, transparent); stroke: none; }
  .line { fill: none; stroke: var(--accent-2); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .peak { fill: var(--accent-2); stroke: var(--panel); stroke-width: 2; }

  .cross { stroke: var(--text-muted); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.7; }
  .dot { fill: var(--accent); stroke: var(--panel); stroke-width: 2; }
  .tip { fill: var(--text); opacity: 0.92; }
  .tip-txt { fill: var(--panel); font-size: 11px; font-weight: 600; font-family: var(--font-sans); }
</style>
