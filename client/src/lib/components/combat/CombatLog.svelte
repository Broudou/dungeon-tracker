<script>
  import { afterUpdate } from 'svelte';
  import { getSocket } from '$lib/socket';

  export let entries = [];
  export let isDM    = false;

  let el;
  let dmNote = '';

  // Auto-scroll to bottom on new entries
  afterUpdate(() => { if (el) el.scrollTop = el.scrollHeight; });

  const TYPE_COLOR = {
    damage:   'var(--danger)',
    heal:     'var(--success)',
    condition:'#7c3aed',
    roll:     'var(--warning)',
    action:   'var(--text-muted)',
    dm_note:  '#2563eb',
    system:   'var(--text-faint)',
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
      <div class="log-row" style="--c: {TYPE_COLOR[entry.type] ?? 'var(--text-faint)'}">
        <span class="log-time">
          {new Date(entry.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
        </span>
        <span class="log-msg">{entry.message}</span>
      </div>
    {:else}
      <p class="log-empty">No events yet.</p>
    {/each}
  </div>

  {#if isDM}
    <form class="note-form" on:submit|preventDefault={sendNote}>
      <input
        class="note-input"
        bind:value={dmNote}
        placeholder="Add a note to the log…"
        maxlength="200"
      />
      <button class="btn btn-secondary btn-sm" type="submit">Log</button>
    </form>
  {/if}
</div>

<style>
  .log-wrapper { display: flex; flex-direction: column; height: 100%; min-height: 0; }

  .log-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0.375rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .log-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    padding: 2px 4px 2px 8px;
    border-left: 2px solid var(--c);
    border-radius: 0 2px 2px 0;
  }

  .log-time {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 0.7rem;
    color: var(--text-faint);
    white-space: nowrap;
    flex-shrink: 0;
    padding-top: 1px;
  }

  .log-msg {
    font-size: 0.8125rem;
    color: var(--text);
    line-height: 1.4;
    word-break: break-word;
  }

  .log-empty {
    font-size: 0.875rem;
    color: var(--text-faint);
    text-align: center;
    padding: 2rem;
    font-style: italic;
  }

  .note-form {
    display: flex;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .note-input { flex: 1; font-size: 0.8125rem; }
</style>
