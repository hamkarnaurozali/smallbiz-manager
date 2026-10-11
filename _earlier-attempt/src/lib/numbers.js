// Number parsing and rounding helpers.
// Users may type Persian/Arabic-Indic digits (e.g. ۱۲۰۰), so we normalise them first.

export function normalizeDigits(value) {
  return String(value)
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
    .replace(/\s+/g, '');
}

/**
 * Parse user input into a non-negative number. Returns NaN when invalid.
 * Commas are accepted ONLY as proper thousands separators ("1,200"), so that
 * "12,5" is rejected instead of silently becoming 125.
 */
export function parseNumber(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  if (input === null || input === undefined) return NaN;
  let s = normalizeDigits(input);
  if (s === '') return NaN;
  if (/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) s = s.replace(/,/g, '');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export function hasAtMostDecimals(n, decimals) {
  const f = 10 ** decimals;
  return Math.abs(n * f - Math.round(n * f)) < 1e-6;
}
