<script>
  export let current = 0;
  export let max     = 1;

  $: pct   = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  $: color = pct > 50 ? 'var(--success)' : pct > 25 ? 'var(--warning)' : 'var(--crimson)';
</script>

<div class="hpbar-track">
  <div class="hpbar-fill" style="width:{pct}%; background:{color};"></div>
</div>
<span class="hpbar-label">{current}/{max}</span>

<style>
  .hpbar-track {
    height: 4px;
    background: var(--border-muted);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 2px;
  }
  .hpbar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width .5s ease-out, background .5s ease-out;
  }
  .hpbar-label {
    font-family: 'Courier New', monospace;
    font-size: 0.7rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
</style>
