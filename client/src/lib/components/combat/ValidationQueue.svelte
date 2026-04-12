<script>
  import { getSocket } from '$lib/socket';

  export let actions = [];

  let collapsed  = false;
  let modifying  = null;
  let modifyDesc = '';

  function approve(action) {
    getSocket()?.emit('combat:approveAction', { actionId: action.actionId });
  }

  function reject(action) {
    const reason = prompt('Reason for rejection (optional):') || '';
    getSocket()?.emit('combat:rejectAction', { actionId: action.actionId, reason });
  }

  function startModify(action) {
    modifying  = action.actionId;
    modifyDesc = action.description;
  }

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
    <div class="queue-header">
      <span class="queue-title">Actions Pending ({actions.length})</span>
      <button class="btn btn-ghost btn-sm" on:click={() => collapsed = !collapsed}>
        {collapsed ? '▲' : '▼'}
      </button>
    </div>

    {#if !collapsed}
      <div class="queue-list">
        {#each actions.slice(0, 4) as action (action.actionId)}
          <div class="queue-item">
            <div class="q-desc">
              <span class="q-who">{action.submitterName}</span>
              <span class="q-what">
                {#if modifying === action.actionId}
                  <input class="q-modify-input" bind:value={modifyDesc} />
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
                <button class="btn btn-primary btn-sm" on:click={() => approve(action)} title="Approve">✓</button>
                <button class="btn btn-danger btn-sm" on:click={() => reject(action)} title="Reject">✗</button>
                <button class="btn btn-secondary btn-sm" on:click={() => startModify(action)} title="Modify">✎</button>
              {/if}
            </div>
          </div>
        {/each}
        {#if actions.length > 4}
          <p class="overflow-note">+{actions.length - 4} more…</p>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .queue {
    position: fixed;
    bottom: 1.5rem;
    left: 1.5rem;
    width: 300px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 4px 24px rgba(0,0,0,.6);
    z-index: 50;
    overflow: hidden;
  }

  .queue-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: .45rem .7rem;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border-muted);
  }
  .queue-title {
    font-family: var(--font-heading);
    font-size: .75rem;
    font-weight: 700;
    color: var(--gold);
    letter-spacing: .04em;
  }

  .queue-list { display: flex; flex-direction: column; }
  .queue-item {
    padding: .55rem .7rem;
    border-bottom: 1px solid var(--border-muted);
    display: flex; flex-direction: column; gap: .35rem;
  }
  .queue-item:last-child { border-bottom: none; }

  .q-desc { display: flex; flex-direction: column; gap: .1rem; }
  .q-who { font-family: var(--font-heading); font-size: .72rem; font-weight: 700; color: var(--gold); }
  .q-what { font-family: var(--font-body); font-size: .8rem; color: var(--text); line-height: 1.4; }
  .q-btns { display: flex; gap: .25rem; }

  .q-modify-input {
    background: var(--bg-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    padding: .2rem .45rem;
    font-size: .78rem;
    font-family: var(--font-body);
    width: 100%;
  }

  .overflow-note {
    font-family: var(--font-body);
    font-size: .75rem;
    color: var(--text-muted);
    text-align: center;
    padding: .35rem;
    font-style: italic;
  }
</style>
