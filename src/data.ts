// The bundled catalogue: offline source of truth (README section 2).
import recipesJson from '../data/recipes.json';
import synonyms from '../data/synonyms.json';
import { buildIndex } from './canonicalize.ts';
import type { Recipe } from './merge.ts';

export const RECIPES = (recipesJson as Recipe[]).slice().sort((a, b) => a.name.localeCompare(b.name));
export const BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
export const INDEX = buildIndex(synonyms);

/** D1 chips, in wireframe order. Keys are the data's category values. */
export const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'ulam na karne', label: 'Meat', icon: '🍖' },
  { key: 'ulam na isda', label: 'Seafood', icon: '🐟' },
  { key: 'sabaw', label: 'Soups', icon: '🍲' },
  { key: 'gulay', label: 'Vegetables', icon: '🥬' },
  { key: 'pancit at kanin', label: 'Noodles & rice', icon: '🍜' },
  { key: 'pulutan at meryenda', label: 'Snacks', icon: '🍡' },
  { key: 'panghimagas', label: 'Desserts', icon: '🍮' },
];
const CAT = new Map(CATEGORIES.map((c) => [c.key, c]));
export const categoryLabel = (key: string) => CAT.get(key)?.label ?? key;
export const categoryIcon = (key: string) => CAT.get(key)?.icon ?? '🍽️';
