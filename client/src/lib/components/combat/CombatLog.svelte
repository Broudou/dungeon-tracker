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
    damage:   'var(--crimson)',
    heal:     'var(--success)',
    condition:'#7a4ab8',
    roll:     'var(--warning)',
    action:   'var(--gold-dim)',
    dm_note:  '#3a6b8b',
    system:   'var(--text-dim)',
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
      <div class="log-entry" style="--type-color:{TYPE_COLOR[entry.type] || 'var(--text-dim)'}">
        <span class="log-time">
          {new Date(entry.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
        </span>
        <span class="log-msg">{entry.message}</span>
      </div>
    {:else}
      <p class="empty">The chronicle awaits the first blow…</p>
    {/each}
  </div>

  {#if isDM}
    <form class="dm-note-form" on:submit|preventDefault={sendNote}>
      <input
        class="dm-note-input"
        bind:value={dmNote}
        placeholder="Add DM note to chronicle…"
        maxlength="200"
      />
      <button class="btn btn-ghost btn-sm" type="submit">Record</button>
    </form>
  {/if}
</div>

<style>
  .log-wrapper { display: flex; flex-direction: column; height: 100%; min-height: 0; }

  .log-scroll {
    flex: 1;
    overflow-y: auto;
    padding: .4rem .5rem;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .log-entry {
    display: flex;
    gap: .45rem;
    align-items: flex-start;
    padding: 2px 4px 2px 7px;
    border-left: 2px solid var(--type-color);
    border-radius: 0 2px 2px 0;
  }

  .log-time {
    font-family: 'Courier New', monospace;
    font-size: .68rem;
    color: var(--text-dim);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .log-msg {
    font-family: var(--font-body);
    font-size: .82rem;
    color: var(--text);
    line-height: 1.4;
    word-break: break-word;
  }

  .empty {
    font-family: var(--font-body);
    font-style: italic;
    color: var(--text-muted);
    font-size: .85rem;
    text-align: center;
    padding: 2rem 1rem;
  }

  .dm-note-form {
    display: flex;
    gap: .4rem;
    padding: .4rem .5rem;
    border-top: 1px solid var(--border-muted);
  }

  .dm-note-input {
    flex: 1;
    background: var(--bg-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    padding: .3rem .55rem;
    font-family: var(--font-body);
    font-size: .82rem;
  }
  .dm-note-input::placeholder { color: var(--text-dim); }
  .dm-note-input:focus { outline: none; border-color: var(--gold-dim); }
</style>
