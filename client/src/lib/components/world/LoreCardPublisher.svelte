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
    } finally {
      saving = false;
    }
  }

  async function saveAndPush() {
    await saveToLore();
    pushNow();
  }
</script>

<div class="publisher card">
  <div class="card-header">
    <span class="card-title">Push Lore Card</span>
  </div>

  <div class="field">
    <label>Title</label>
    <input bind:value={title} placeholder="The Sealed Door…" />
  </div>

  <div class="field">
    <label>Category</label>
    <select bind:value={category}>
      {#each CATEGORIES as cat}
        <option value={cat}>{cat}</option>
      {/each}
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
  .publisher { margin-bottom: 1rem; }
  .pub-actions { display: flex; gap: .5rem; margin-top: .5rem; flex-wrap: wrap; }
  .field { display: flex; flex-direction: column; gap: .3rem; margin-bottom: .65rem; }
  .field label {
    font-family: var(--font-heading);
    font-size: .68rem;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .field input, .field select, .field textarea {
    background: var(--bg-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    padding: .4rem .6rem;
    font-family: var(--font-body);
    font-size: .88rem;
    transition: border-color .15s;
  }
  .field textarea { resize: vertical; }
  .field input:focus, .field select:focus, .field textarea:focus {
    outline: none;
    border-color: var(--gold-dim);
  }
  .field select option { background: var(--surface); }
</style>
