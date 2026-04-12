import { writable, derived } from 'svelte/store';

// Full combat state from server
export const combat = writable(null);

// Pending validation queue (DM only)
export const pendingActions = derived(combat, $c =>
  $c?.pendingActions?.filter(a => a.status === 'pending') ?? []
);

// Current combatant on active turn
export const currentCombatant = derived(combat, $c => {
  if (!$c || $c.state !== 'active') return null;
  return $c.initiativeOrder?.[$c.currentTurnIndex] ?? null;
});

export function setCombat(state) {
  combat.set(state);
}
