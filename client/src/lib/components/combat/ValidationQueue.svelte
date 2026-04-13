<script>
  /** DM-only fixed panel showing pending player action submissions. */
  import { getSocket } from '$lib/socket';

  export let actions = [];

  let collapsed  = false;
  let modifying  = null;
  let modifyDesc = '';

  function approve(action) {
    getSocket()?.emit('combat:approveAction', { actionId: action.actionId });
  }

  function reject(action) {
    const reason = prompt('Reason for rejection (optional):') ?? '';
    getSocket()?.emit('combat:rejectAction', { actionId: action.actionId, reason });
  }

  function startModify(action) { modifying = action.actionId; modifyDesc = action.description; }

  function approveModified(action) {
    getSocket()?.emit('combat:approveAction', {
      actionId: action.actionId,
      override: { ...action.params, description: modifyDesc },
    });
    modifying = null;
  }
</script>

{#if actions.length > 0}
  <div class="queue">
    <div class="queue-head">
      <span class="queue-title">Pending ({actions.length})</span>
      <button class="btn btn-ghost btn-sm" on:click={() => collapsed = !collapsed}>
        {collapsed ? '▲' : '▼'}
      </button>
    </div>

    {#if !collapsed}
      <div class="queue-body">
        {#each actions.slice(0, 4) as action (action.actionId)}
          <div class="q-item">
            <div class="q-info">
              <span class="q-who">{action.submitterName}</span>
              <span class="q-what">
                {#if modifying === action.actionId}
                  <input class="q-edit" bind:value={modifyDesc} />
                {:else}
                  {action.description}
                {/if}
              </span>
            </div>
            <div class="q-btns">
              {#if modifying === action.actionId}
                <button class="btn btn-primary btn-sm" on:click={() => approveModified(action)}>Confirm</button>
                <button class="btn btn-ghost btn-sm" on:click={() => modifying = null}>Cancel</button>
              {:else}
                <button class="btn btn-secondary btn-sm" on:click={() => approve(action)} title="Approve" aria-label="Approve">✓</button>
                <button class="btn btn-danger btn-sm" on:click={() => reject(action)} title="Reject" aria-label="Reject">✗</button>
                <button class="btn btn-ghost btn-sm" on:click={() => startModify(action)} title="Modify" aria-label="Modify">✎</button>
              {/if}
            </div>
          </div>
        {/each}
        {#if actions.length > 4}
          <p class="overflow-note">+{actions.length - 4} more pending…</p>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .queue {
    position: fixed;
    bottom: 1.25rem;
    left: 1.25rem;
    width: 300px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    z-index: 50;
    overflow: hidden;
  }

  .queue-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
  }

  .queue-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text);
  }

  .queue-body { display: flex; flex-direction: column; }

  .q-item {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .q-item:last-child { border-bottom: none; }

  .q-info { display: flex; flex-direction: column; gap: 0.1rem; }
  .q-who  { font-size: 0.75rem; font-weight: 700; color: var(--text); }
  .q-what { font-size: 0.8125rem; color: var(--text-muted); line-height: 1.4; }
  .q-btns { display: flex; gap: 0.25rem; }

  .q-edit {
    font-size: 0.8125rem;
    width: 100%;
    padding: 0.2rem 0.4rem;
  }

  .overflow-note {
    font-size: 0.75rem;
    color: var(--text-faint);
    text-align: center;
    padding: 0.35rem;
    font-style: italic;
  }
</style>
