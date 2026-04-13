import { writable, derived } from 'svelte/store';

export const combat = writable(null);

export const pendingActions = derived(combat, $c =>
  $c?.pendingActions?.filter(a => a.status === 'pending') ?? []
);

export const currentCombatant = derived(combat, $c => {
  if (!$c || $c.state !== 'active') return null;
  return $c.initiativeOrder?.[$c.currentTurnIndex] ?? null;
});

export function setCombat(state) { combat.set(state); }
