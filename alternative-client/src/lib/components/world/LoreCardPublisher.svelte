<script>
  import { getSocket } from '$lib/socket';
  import { api } from '$lib/api';

  export let campaignId = null;

  const CATEGORIES = ['Event','Location','NPC','Item','Faction','World','Other'];

  let title    = '';
  let category = 'Event';
  let content  = '';
  let saving   = false;
  let pushed   = false;

  function pushNow() {
    if (!title.trim() || !content.trim()) return;
    getSocket()?.emit('world:pushLore', { title, category, content });
    pushed = true;
    setTimeout(() => pushed = false, 2000);
  }

  async function saveToLore() {
    if (!title.trim() || !campaignId) return;
    saving = true;
    try {
      await api.post(`/campaigns/${campaignId}/lore`, {
        title, body: content, category: category.toLowerCase(), visibleToPlayers: false,
      });
    } finally { saving = false; }
  }

  async function saveAndPush() { await saveToLore(); pushNow(); }
</script>

<div class="publisher">
  <p class="pub-label">Push Lore Card</p>

  <div class="field">
    <label>Title</label>
    <input bind:value={title} placeholder="The Sealed Door…" />
  </div>
  <div class="field">
    <label>Category</label>
    <select bind:value={category}>
      {#each CATEGORIES as cat}<option value={cat}>{cat}</option>{/each}
    </select>
  </div>
  <div class="field">
    <label>Content</label>
    <textarea bind:value={content} rows="5" placeholder="Describe the scene, discovery, or revelation…"></textarea>
  </div>

  <div class="pub-actions">
    <button class="btn btn-secondary btn-sm" on:click={saveToLore} disabled={saving || !title.trim()}>
      {saving ? 'Saving…' : 'Save to Lore'}
    </button>
    <button class="btn btn-primary btn-sm" on:click={pushNow} disabled={!title.trim() || !content.trim()}>
      {pushed ? 'Revealed!' : 'Reveal Now'}
    </button>
    <button class="btn btn-ghost btn-sm" on:click={saveAndPush} disabled={saving || !title.trim() || !content.trim()}>
      Save &amp; Reveal
    </button>
  </div>
</div>

<style>
  .publisher {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1.125rem;
    margin-bottom: 1rem;
    box-shadow: var(--shadow-sm);
  }

  .pub-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 0.875rem;
  }

  .field { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.625rem; }
  .field label { font-size: 0.8125rem; font-weight: 500; color: var(--text-muted); }
  .field input, .field select, .field textarea {
    font-size: 0.875rem;
    transition: border-color 0.15s;
  }
  .field textarea { resize: vertical; }

  .pub-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.25rem; }
</style>
