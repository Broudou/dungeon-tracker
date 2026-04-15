<script>
  import { getSocket } from '$lib/socket';
  import { diceSuggestion, clearSuggestion } from '$lib/stores/diceSuggestion';

  function useSuggestion() {
    if ($diceSuggestion) { formula = $diceSuggestion.formula; clearSuggestion(); }
  }

  export let open = false;

  const DICE = [4, 6, 8, 10, 12, 20, 100];

  let formula    = '';
  let advantage  = false;
  let disadv     = false;
  let isPrivate  = false;
  let lastResult = null;

  function addDie(d) {
    formula = formula ? `${formula}+1d${d}` : `1d${d}`;
  }

  function parseDice(expr) {
    const parts = expr.toLowerCase().split('+').map(p => p.trim()).filter(Boolean);
    let total = 0; const breakdown = [];
    for (const part of parts) {
      if (part.includes('d')) {
        const [nc, sc] = part.split('d');
        const n = parseInt(nc || '1', 10);
        const s = parseInt(sc, 10);
        if (isNaN(n) || isNaN(s)) continue;
        for (let i = 0; i < n; i++) { const r = Math.floor(Math.random() * s) + 1; breakdown.push(r); total += r; }
      } else {
        const mod = parseInt(part, 10);
        if (!isNaN(mod)) { total += mod; breakdown.push(mod); }
      }
    }
    return { total, breakdown };
  }

  function roll() {
    if (!formula.trim()) return;
    let resultValue, detail;

    if (advantage || disadv) {
      const r1 = Math.floor(Math.random() * 20) + 1;
      const r2 = Math.floor(Math.random() * 20) + 1;
      const kept = advantage ? Math.max(r1, r2) : Math.min(r1, r2);
      const modMatch = formula.match(/[+-]\d+$/);
      const mod = modMatch ? parseInt(modMatch[0], 10) : 0;
      resultValue = kept + mod;
      detail = `[${r1},${r2}→${kept}]${mod !== 0 ? (mod > 0 ? '+' : '') + mod : ''}=${resultValue}`;
    } else {
      const { total, breakdown } = parseDice(formula);
      resultValue = total;
      detail = breakdown.length > 1 ? `(${breakdown.join('+')})=${total}` : `${total}`;
    }

    lastResult = { formula, detail, total: resultValue };

    if (!isPrivate) {
      getSocket()?.emit('roll:public', { formula, result: resultValue, rollType: 'free', context: `${formula} → ${detail}` });
    }
  }

  function clear() { formula = ''; lastResult = null; }

  function toggleAdv(which) {
    if (which === 'adv') { advantage = !advantage; if (advantage) disadv = false; }
    else { disadv = !disadv; if (disadv) advantage = false; }
  }
</script>

<!-- Floating action button -->
<button
  class="fab"
  class:fab-open={open}
  on:click={() => open = !open}
  title="Dice Tray"
  aria-label="Toggle dice tray"
  aria-expanded={open}
>
  ⚄
</button>

{#if open}
  <!-- Click-outside backdrop -->
  <div class="tray-backdrop" on:click={() => open = false} role="presentation"></div>

  <div class="tray" role="dialog" aria-label="Dice tray">
    <div class="tray-head">
      <span class="tray-title">Dice Tray</span>
      <button class="btn btn-ghost btn-sm" on:click={() => open = false}>✕</button>
    </div>

    <!-- Suggestion banner from ActionPanel -->
    {#if $diceSuggestion}
      <div class="suggestion-banner">
        <div class="sug-info">
          <span class="sug-label">{$diceSuggestion.label}</span>
          <span class="sug-formula">{$diceSuggestion.formula}</span>
          {#if $diceSuggestion.context}<span class="sug-ctx">{$diceSuggestion.context}</span>{/if}
        </div>
        <button class="btn btn-primary btn-sm" on:click={useSuggestion}>Use</button>
        <button class="btn btn-ghost btn-sm" on:click={clearSuggestion}>✕</button>
      </div>
    {/if}

    <!-- Quick-add dice -->
    <div class="dice-row">
      {#each DICE as d}
        <button class="die-btn" on:click={() => addDie(d)}>d{d}</button>
      {/each}
    </div>

    <!-- Formula input -->
    <div class="formula-row">
      <input
        class="formula-input"
        bind:value={formula}
        placeholder="2d6+3"
        aria-label="Dice formula"
        on:keydown={e => e.key === 'Enter' && roll()}
      />
      <button class="btn btn-primary btn-sm" on:click={roll} disabled={!formula.trim()}>Roll</button>
      <button class="btn btn-ghost btn-sm" on:click={clear}>Clear</button>
    </div>

    <!-- Options -->
    <div class="opts-row">
      <button class="opt-btn" class:active={advantage}    on:click={() => toggleAdv('adv')}>Adv</button>
      <button class="opt-btn" class:active={disadv}       on:click={() => toggleAdv('dis')}>Dis</button>
      <button class="opt-btn" class:active={isPrivate}    on:click={() => isPrivate = !isPrivate}>Private</button>
    </div>

    <!-- Last result -->
    {#if lastResult}
      <div class="last-result">
        <span class="res-formula">{lastResult.formula}</span>
        <span class="res-detail">{lastResult.detail}</span>
        <span class="res-total">{lastResult.total}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .fab {
    position: fixed;
    bottom: 1.25rem;
    right: 1.25rem;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    color: var(--text);
    font-size: 1.25rem;
    cursor: pointer;
    z-index: 60;
    box-shadow: var(--shadow-md);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, border-color 0.1s;
  }
  .fab:hover, .fab.fab-open {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .tray-backdrop { position: fixed; inset: 0; z-index: 58; }

  .tray {
    position: fixed;
    bottom: 4.5rem;
    right: 1.25rem;
    width: 280px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    z-index: 59;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .tray-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .tray-title { font-size: 0.875rem; font-weight: 600; }

  .suggestion-banner {
    display: flex; align-items: center; gap: 0.375rem;
    background: var(--surface-2, #f8f7ff);
    border: 1px solid var(--accent, #7c6af7);
    border-radius: var(--radius, 6px);
    padding: 0.375rem 0.5rem;
  }
  .sug-info { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .sug-label   { font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
  .sug-formula { font-size: 0.85rem; font-weight: 600; font-family: monospace; }
  .sug-ctx     { font-size: 0.65rem; color: var(--text-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .dice-row { display: flex; gap: 0.25rem; flex-wrap: wrap; }
  .die-btn {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    transition: all 0.1s;
  }
  .die-btn:hover { border-color: var(--border-strong); background: var(--surface); }

  .formula-row { display: flex; gap: 0.25rem; }
  .formula-input {
    flex: 1;
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 0.875rem;
    padding: 0.3rem 0.5rem;
  }
  .formula-input:focus { outline: none; border-color: var(--border-strong); }

  .opts-row { display: flex; gap: 0.25rem; }
  .opt-btn {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px 8px;
    cursor: pointer;
    transition: all 0.1s;
  }
  .opt-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

  .last-result {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.375rem 0.6rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .res-formula { font-size: 0.75rem; color: var(--text-muted); flex: 0 0 auto; }
  .res-detail  { font-size: 0.8125rem; color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; }
  .res-total   { font-size: 1.125rem; font-weight: 800; color: var(--text); min-width: 2em; text-align: right; }
</style>
