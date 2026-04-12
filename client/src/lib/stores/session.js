import { writable } from 'svelte/store';

/**
 * Live session state.
 * { id, joinKey, phase, status, campaignId, campaignName }
 */
export const session  = writable(null);

/**
 * Connected players roster as seen by the socket room.
 * [{ isDM, displayName, characterId }]
 */
export const roster   = writable([]);

/**
 * The current user's role and identity.
 * { role: 'dm' | 'player', characterId, displayName }
 */
export const identity = writable(null);

/**
 * World-phase lore cards pushed by DM during current session.
 * [{ title, category, content, pushedAt }]
 */
export const worldFeed = writable([]);

/**
 * Roll history for the world phase (non-combat).
 * [{ name, formula, result, context, message }]
 */
export const worldRolls = writable([]);
