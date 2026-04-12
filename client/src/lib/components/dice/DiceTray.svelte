<script>
  import { getSocket } from '$lib/socket';

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
          breakdown.push(r); total += r;
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
      <span class="tray-title">Dice Tray</span>
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
      <label class:active={advantage}>
        <input type="checkbox" bind:checked={advantage} on:change={() => { if(advantage) disadv = false; }} />
        Adv
      </label>
      <label class:active={disadv}>
        <input type="checkbox" bind:checked={disadv} on:change={() => { if(disadv) advantage = false; }} />
        Dis
      </label>
      <label class:active={isPrivate}>
        <input type="checkbox" bind:checked={isPrivate} />
        Private
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

<button class="tray-fab" class:open on:click={() => open = !open} title="Dice Tray">
  ⚄
</button>

<style>
  .tray-fab {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    width: 48px; height: 48px;
    border-radius: 50%;
    background: var(--surface-2);
    border: 2px solid var(--border);
    color: var(--gold);
    font-size: 1.3rem;
    cursor: pointer;
    z-index: 60;
    box-shadow: 0 4px 16px rgba(0,0,0,.5);
    transition: transform .15s, border-color .15s;
    display: flex; align-items: center; justify-content: center;
  }
  .tray-fab:hover, .tray-fab.open { border-color: var(--gold-dim); transform: scale(1.06); }

  .tray-backdrop { position: fixed; inset: 0; z-index: 58; }

  .tray {
    position: fixed;
    bottom: 5.5rem;
    right: 1.5rem;
    width: 290px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 4px 24px rgba(0,0,0,.6);
    z-index: 59;
    padding: .7rem;
    display: flex; flex-direction: column; gap: .55rem;
  }

  .tray-header { display: flex; align-items: center; justify-content: space-between; }
  .tray-title {
    font-family: var(--font-heading);
    font-size: .88rem;
    font-weight: 700;
    color: var(--gold);
    letter-spacing: .06em;
  }

  .dice-row { display: flex; gap: .3rem; flex-wrap: wrap; }
  .die-btn {
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--font-heading);
    font-size: .75rem;
    font-weight: 700;
    letter-spacing: .04em;
    padding: .28rem .5rem;
    cursor: pointer;
    transition: border-color .1s, color .1s;
  }
  .die-btn:hover { border-color: var(--gold-dim); color: var(--gold); }

  .formula-row { display: flex; gap: .3rem; }
  .formula-input {
    flex: 1;
    background: var(--bg-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    padding: .32rem .55rem;
    font-family: 'Courier New', monospace;
    font-size: .88rem;
  }
  .formula-input:focus { outline: none; border-color: var(--gold-dim); }

  .options-row { display: flex; gap: .4rem; }
  .options-row label {
    display: flex; align-items: center; gap: .2rem;
    font-family: var(--font-heading); font-size: .68rem; letter-spacing: .06em;
    color: var(--text-muted); cursor: pointer;
    padding: 2px 7px; border-radius: 999px;
    border: 1px solid var(--border-muted); transition: all .1s;
  }
  .options-row label.active { border-color: var(--gold-dim); color: var(--gold); }
  .options-row input { display: none; }

  .last-result {
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    padding: .38rem .55rem;
    display: flex; align-items: center; gap: .45rem;
  }
  .result-formula { font-family: var(--font-body); font-size: .78rem; color: var(--text-muted); }
  .result-detail  { font-family: var(--font-body); font-size: .82rem; color: var(--text); flex: 1; }
  .result-total   { font-family: var(--font-heading); font-size: 1.15rem; font-weight: 800; color: var(--gold); min-width: 2em; text-align: right; }
</style>
