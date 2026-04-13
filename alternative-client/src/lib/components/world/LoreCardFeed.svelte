<script>
  export let cards = [];

  // Maps category to a CSS custom property or color value
  const CAT_COLOR = {
    Event:    'var(--cat-event)',
    Location: 'var(--cat-location)',
    NPC:      'var(--cat-npc)',
    Item:     'var(--cat-item)',
    Faction:  'var(--cat-faction)',
    World:    'var(--cat-world)',
    Other:    'var(--cat-other)',
  };
</script>

<div class="feed">
  {#each [...cards].reverse() as card (card.pushedAt)}
    <article class="lore-card" style="--cat: {CAT_COLOR[card.category] ?? 'var(--cat-other)'}">
      <header class="lore-head">
        <span class="lore-cat">{card.category.toUpperCase()}</span>
        <time class="lore-time" datetime={card.pushedAt}>
          {new Date(card.pushedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
        </time>
      </header>
      <h3 class="lore-title">{card.title}</h3>
      <p class="lore-body">{card.content}</p>
    </article>
  {:else}
    <div class="empty">
      <p class="text-muted text-sm">No lore cards revealed yet.</p>
    </div>
  {/each}
</div>

<style>
  .feed { display: flex; flex-direction: column; gap: 0.75rem; }

  .lore-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 3px solid var(--cat);
    border-radius: var(--radius-md);
    padding: 0.875rem 1rem;
    box-shadow: var(--shadow-sm);
    animation: card-in 0.25s ease-out;
  }
  @keyframes card-in { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }

  .lore-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.375rem;
  }

  .lore-cat {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--cat);
  }

  .lore-time {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 0.7rem;
    color: var(--text-faint);
  }

  .lore-title {
    font-size: 0.9375rem;
    font-weight: 700;
    margin-bottom: 0.4rem;
    color: var(--text);
  }

  .lore-body {
    font-size: 0.875rem;
    color: var(--text-muted);
    line-height: 1.65;
    white-space: pre-wrap;
  }

  .empty {
    text-align: center;
    padding: 2.5rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
</style>
