<script>
  export let cards = [];

  const CAT_COLOR = {
    Event:    'var(--color-accent)',
    Location: '#5dade2',
    NPC:      '#a29bfe',
    Item:     '#ffd27a',
    Faction:  '#ff7675',
    World:    '#55efc4',
    Other:    'var(--color-text-muted)',
  };
</script>

<div class="feed">
  {#each [...cards].reverse() as card (card.pushedAt)}
    <div class="lore-card" style="--cat-color:{CAT_COLOR[card.category] || 'var(--color-text-muted)'}">
      <div class="lore-header">
        <span class="lore-cat">◆ {card.category.toUpperCase()}</span>
        <span class="lore-time">{new Date(card.pushedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
      </div>
      <h3 class="lore-title">{card.title}</h3>
      <p class="lore-content">{card.content}</p>
    </div>
  {:else}
    <div class="empty">
      <p>Waiting for the Dungeon Master to reveal the world…</p>
    </div>
  {/each}
</div>

<style>
  .feed { display: flex; flex-direction: column; gap: .75rem; }
  .lore-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left: 4px solid var(--cat-color);
    border-radius: var(--radius);
    padding: 1rem 1.1rem;
    animation: slideIn 0.3s ease-out;
  }
  @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
  .lore-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: .4rem; }
  .lore-cat { font-size: .7rem; font-weight: 700; color: var(--cat-color); letter-spacing: .1em; }
  .lore-time { font-size: .7rem; color: var(--color-text-muted); }
  .lore-title { font-size: 1rem; font-weight: 700; margin-bottom: .5rem; }
  .lore-content { font-size: .88rem; color: var(--color-text); line-height: 1.65; white-space: pre-wrap; }
  .empty { text-align: center; padding: 3rem 1rem; color: var(--color-text-muted); font-style: italic; }
</style>
