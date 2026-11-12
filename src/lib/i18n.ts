import type { Lang } from './types';
import { TL } from './tl';

/**
 * Words on screen. The English text is the key. Taglish is looked up in tl.ts.
 * A text with no Taglish entry stays in English. `{name}` style holes are filled from `vars`.
 */
export function translate(lang: Lang, text: string, vars?: Record<string, string | number>): string {
  const base = lang === 'tl' ? (TL[text] ?? text) : text;
  return vars ? base.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : base;
}

export type T = (text: string, vars?: Record<string, string | number>) => string;
