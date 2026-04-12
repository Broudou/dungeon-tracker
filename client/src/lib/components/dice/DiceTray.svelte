<script>
  import { getSocket } from '$lib/socket';

  export let open = false;

  const DICE = [4, 6, 8, 10, 12, 20, 100];

  let formula   = '';
  let advantage = false;
  let disadv    = false;
  let isPrivate = false;
  let lastResult = null;

  function addDie(d) {
    formula = formula ? `${formula}+1d${d}` : `1d${d}`;
  }

  function rollD20() { return Math.floor(Math.random() * 20) + 1; }

  function parseDice(expr) {
    // Very simple: only handles NdX+mod or NdX
    const parts = expr.toLowerCase().split('+').map(p => p.trim()).filter(Boolean);
    let total = 0;
    const breakdown = [];
    for (const part of parts) {
      if (part.includes('d')) {
        const [nc, sc] = part.split('d');
        const n = parseInt(nc || '1', 10);
        const s = parseInt(sc, 10);
        if (isNaN(n) || isNaN(s)) continue;
        for (let i = 0; i < n; i++) {
          const r = Math.floor(Math.random() * s) + 1;
          breakdown.push(r);
          total += r;
        }
      } else {
        const mod = parseInt(part, 10);
        if (!isNaN(mod)) { total += mod; breakdown.push(mod); }
      }
    }
    return { total, breakdown };
  }

  function roll() {
    if (!formula.trim()) return;

    let resultValue;
    let detail;

    if (advantage || disadv) {
      const r1 = rollD20();
      const r2 = rollD20();
      const kept = advantage ? Math.max(r1, r2) : Math.min(r1, r2);
      // Apply modifier if any (e.g. "1d20+5")
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
      getSocket()?.emit('roll:public', {
        formula,
        result:   resultValue,
        rollType: 'free',
        context:  `${formula} → ${detail}`,
      });
    }
  }

  function clear() { formula = ''; lastResult = null; }
</script>

{#if open}
  <div class="tray-backdrop" on:click={() => open = false}></div>
  <div class="tray">
    <div class="tray-header">
      <span class="tray-title">🎲 Dice Tray</span>
      <button class="btn btn-ghost btn-sm" on:click={() => open = false}>✕</button>
    </div>

    <div class="dice-row">
      {#each DICE as d}
        <button class="die-btn" on:click={() => addDie(d)}>d{d}</button>
      {/each}
    </div>

    <div class="formula-row">
      <input
        class="formula-input"
        bind:value={formula}
        placeholder="2d6+3"
        on:keydown={e => e.key === 'Enter' && roll()}
      />
      <button class="btn btn-primary btn-sm" on:click={roll} disabled={!formula.trim()}>Roll</button>
      <button class="btn btn-ghost btn-sm" on:click={clear}>Clear</button>
    </div>

    <div class="options-row">
      <label class="opt-label" class:active={advantage}>
        <input type="checkbox" bind:checked={advantage} on:change={() => { if(advantage) disadv = false; }} />
        ADV
      </label>
      <label class="opt-label" class:active={disadv}>
        <input type="checkbox" bind:checked={disadv} on:change={() => { if(disadv) advantage = false; }} />
        DIS
      </label>
      <label class="opt-label" class:active={isPrivate}>
        <input type="checkbox" bind:checked={isPrivate} />
        🔒 Private
      </label>
    </div>

    {#if lastResult}
      <div class="last-result">
        <span class="result-formula">{lastResult.formula}</span>
        <span class="result-detail">→ {lastResult.detail}</span>
        <span class="result-total">{lastResult.total}</span>
      </div>
    {/if}
  </div>
{/if}

<!-- Floating trigger button -->
<button class="tray-fab" class:open on:click={() => open = !open} title="Dice Tray">
  🎲
</button>

<style>
  .tray-fab {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--color-accent);
    color: #111;
    font-size: 1.4rem;
    border: none;
    cursor: pointer;
    z-index: 60;
    box-shadow: 0 4px 16px rgba(0,0,0,.5);
    transition: transform .15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tray-fab.open { transform: scale(0.9); }
  .tray-fab:hover { transform: scale(1.08); }

  .tray-backdrop {
    position: fixed; inset: 0; z-index: 58;
    background: rgba(0,0,0,.2);
  }
  .tray {
    position: fixed;
    bottom: 5rem;
    right: 1.5rem;
    width: 300px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: 0 4px 24px rgba(0,0,0,.6);
    z-index: 59;
    padding: .75rem;
    display: flex;
    flex-direction: column;
    gap: .6rem;
  }
  .tray-header { display: flex; align-items: center; justify-content: space-between; }
  .tray-title { font-size: .9rem; font-weight: 700; }

  .dice-row { display: flex; gap: .3rem; flex-wrap: wrap; }
  .die-btn {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    padding: .3rem .55rem;
    font-size: .8rem;
    font-weight: 700;
    cursor: pointer;
    transition: border-color .1s;
  }
  .die-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }

  .formula-row { display: flex; gap: .35rem; }
  .formula-input {
    flex: 1;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    padding: .35rem .6rem;
    font-size: .88rem;
    font-family: 'Courier New', monospace;
  }
  .formula-input:focus { outline: none; border-color: var(--color-accent); }

  .options-row { display: flex; gap: .5rem; }
  .opt-label {
    display: flex; align-items: center; gap: .25rem;
    font-size: .75rem; color: var(--color-text-muted);
    cursor: pointer; padding: 2px 7px;
    border-radius: 999px; border: 1px solid var(--color-border);
  }
  .opt-label.active { border-color: var(--color-accent); color: var(--color-accent); }
  .opt-label input { display: none; }

  .last-result {
    background: var(--color-surface-2);
    border-radius: var(--radius);
    padding: .4rem .6rem;
    display: flex;
    align-items: center;
    gap: .5rem;
    font-size: .82rem;
  }
  .result-formula { color: var(--color-text-muted); }
  .result-detail { color: var(--color-text); flex: 1; }
  .result-total { font-size: 1.2rem; font-weight: 800; color: var(--color-accent); min-width: 2em; text-align: right; }
</style>
