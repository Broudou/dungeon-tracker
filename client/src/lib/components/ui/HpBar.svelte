<script>
  /** Compact horizontal HP bar — used in monster cards and party sidebars. */
  export let current = 0;
  export let max     = 0;

  $: pct   = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  $: color = pct > 0.5 ? 'var(--hp-high)' : pct > 0.25 ? 'var(--hp-med)' : 'var(--hp-low)';
</script>

<div class="bar-track" role="meter" aria-valuenow={current} aria-valuemax={max} aria-label="HP">
  <div class="bar-fill" style="width: {pct * 100}%; background: {color};"></div>
</div>

<style>
  .bar-track {
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
    width: 100%;
  }
  .bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease, background 0.3s ease;
  }
</style>
