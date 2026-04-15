import { writable } from 'svelte/store';

// { formula: string, label: string, context: string }
export const diceSuggestion = writable(null);

export function setSuggestion(formula, label, context = '') {
  diceSuggestion.set({ formula, label, context });
}

export function clearSuggestion() {
  diceSuggestion.set(null);
}
