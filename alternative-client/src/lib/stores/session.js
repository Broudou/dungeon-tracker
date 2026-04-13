import { writable } from 'svelte/store';

export const session   = writable(null);   // { id, joinKey, phase, status, campaignId }
export const roster    = writable([]);      // connected players
export const identity  = writable(null);   // { role, characterId, displayName }
export const worldFeed = writable([]);     // lore cards pushed this session
export const worldRolls = writable([]);   // skill check history
