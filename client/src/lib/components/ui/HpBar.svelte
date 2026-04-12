<script>
  export let current = 0;
  export let max     = 1;

  $: pct   = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  $: color = pct > 50 ? 'var(--hp-green)' : pct > 25 ? 'var(--hp-yellow)' : 'var(--hp-red)';
</script>

<div class="hpbar-track">
  <div class="hpbar-fill" style="width:{pct}%; background:{color};"></div>
</div>
<span class="hpbar-label">{current} / {max}</span>

<style>
  .hpbar-track {
    height: 6px;
    background: var(--color-border);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 2px;
  }
  .hpbar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.5s ease-out, background 0.5s ease-out;
  }
  .hpbar-label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  :global(:root) {
    --hp-green:  #4caf50;
    --hp-yellow: #ff9800;
    --hp-red:    #e94560;
  }
</style>
