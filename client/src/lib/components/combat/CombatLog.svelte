<script>
  import { afterUpdate } from 'svelte';
  import { getSocket } from '$lib/socket';

  export let entries = [];
  export let isDM    = false;

  let el;
  let dmNote = '';

  afterUpdate(() => {
    if (el) el.scrollTop = el.scrollHeight;
  });

  const TYPE_COLOR = {
    damage:   '#e94560',
    heal:     '#4caf50',
    condition:'#9b59b6',
    roll:     '#f1c40f',
    action:   'var(--color-accent)',
    dm_note:  '#5dade2',
    system:   'var(--color-text-muted)',
  };

  function sendNote() {
    const msg = dmNote.trim();
    if (!msg) return;
    getSocket()?.emit('combat:dmNote', { message: msg });
    dmNote = '';
  }
</script>

<div class="log-wrapper">
  <div class="log-scroll" bind:this={el}>
    {#each entries as entry}
      <div class="log-entry" style="--type-color:{TYPE_COLOR[entry.type] || 'var(--color-text-muted)'}">
        <span class="log-time">{new Date(entry.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
        <span class="log-msg">{entry.message}</span>
      </div>
    {:else}
      <p class="empty">Combat log will appear here when combat starts.</p>
    {/each}
  </div>

  {#if isDM}
    <form class="dm-note-form" on:submit|preventDefault={sendNote}>
      <input
        class="dm-note-input"
        bind:value={dmNote}
        placeholder="Add DM note to log…"
        maxlength="200"
      />
      <button class="btn btn-ghost btn-sm" type="submit">Send</button>
    </form>
  {/if}
</div>

<style>
  .log-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .log-scroll {
    flex: 1;
    overflow-y: auto;
    padding: .5rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-family: 'Courier New', monospace;
    font-size: .78rem;
  }
  .log-entry {
    display: flex;
    gap: .5rem;
    align-items: flex-start;
    padding: 2px 4px;
    border-left: 3px solid var(--type-color);
    padding-left: 6px;
    border-radius: 0 3px 3px 0;
  }
  .log-time {
    color: var(--color-text-muted);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .log-msg {
    color: var(--color-text);
    line-height: 1.4;
    word-break: break-word;
  }
  .empty {
    color: var(--color-text-muted);
    font-size: .85rem;
    text-align: center;
    padding: 2rem;
    font-family: var(--font);
  }
  .dm-note-form {
    display: flex;
    gap: .5rem;
    padding: .5rem;
    border-top: 1px solid var(--color-border);
  }
  .dm-note-input {
    flex: 1;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    padding: .35rem .6rem;
    font-size: .85rem;
  }
  .dm-note-input::placeholder { color: var(--color-text-muted); }
  .dm-note-input:focus { outline: none; border-color: var(--color-accent); }
</style>
