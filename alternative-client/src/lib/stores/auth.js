import { writable } from 'svelte/store';

export const auth = writable({ loading: true, user: null });

export function setUser(user)  { auth.set({ loading: false, user }); }
export function clearUser()    { auth.set({ loading: false, user: null }); }
