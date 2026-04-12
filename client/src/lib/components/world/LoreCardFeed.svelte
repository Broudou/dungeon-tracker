<script>
  export let cards = [];

  const CAT_COLOR = {
    Event:    'var(--crimson)',
    Location: '#3a7ab8',
    NPC:      '#6a4ab8',
    Item:     'var(--warning)',
    Faction:  '#a03030',
    World:    '#2a8060',
    Other:    'var(--text-dim)',
  };
</script>

<div class="feed">
  {#each [...cards].reverse() as card (card.pushedAt)}
    <div class="lore-card" style="--cat-color:{CAT_COLOR[card.category] || 'var(--text-dim)'}">
      <div class="lore-header">
        <span class="lore-cat">{card.category.toUpperCase()}</span>
        <span class="lore-time">
          {new Date(card.pushedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
        </span>
      </div>
      <h3 class="lore-title">{card.title}</h3>
      <p class="lore-content">{card.content}</p>
    </div>
  {:else}
    <div class="empty">
      <p>The chronicle awaits the Dungeon Master's revelation…</p>
    </div>
  {/each}
</div>

<style>
  .feed { display: flex; flex-direction: column; gap: .75rem; }

  .lore-card {
    background: var(--surface);
    border: 1px solid var(--border-muted);
    border-left: 3px solid var(--cat-color);
    border-radius: var(--radius);
    padding: .9rem 1rem;
    animation: slideIn .3s ease-out;
    box-shadow: 0 2px 8px rgba(0,0,0,.3);
  }

  .lore-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: .4rem;
  }
  .lore-cat {
    font-family: var(--font-heading);
    font-size: .62rem;
    font-weight: 700;
    letter-spacing: .12em;
    color: var(--cat-color);
  }
  .lore-time {
    font-family: 'Courier New', monospace;
    font-size: .68rem;
    color: var(--text-dim);
  }
  .lore-title {
    font-family: var(--font-heading);
    font-size: .95rem;
    font-weight: 700;
    margin-bottom: .45rem;
    color: var(--text);
  }
  .lore-content {
    font-family: var(--font-body);
    font-size: .9rem;
    color: var(--text);
    line-height: 1.7;
    white-space: pre-wrap;
    font-style: italic;
  }

  .empty {
    text-align: center;
    padding: 3rem 1rem;
    font-family: var(--font-body);
    font-style: italic;
    color: var(--text-muted);
  }
</style>
