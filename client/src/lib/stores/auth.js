import { writable } from 'svelte/store';

/**
 * { loading: true, user: null }   → initial state, auth check in flight
 * { loading: false, user: null }  → not authenticated
 * { loading: false, user: {...} } → authenticated
 */
export const auth = writable({ loading: true, user: null });

export function setUser(user) {
  auth.set({ loading: false, user });
}

export function clearUser() {
  auth.set({ loading: false, user: null });
}
