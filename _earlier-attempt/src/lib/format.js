// Display formatting. All money is shown in Afghan afghani (AFN).

export const CURRENCY = 'AFN';

export function formatMoney(value) {
  const v = Number.isFinite(value) ? value : 0;
  const rounded = Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;
  const text = rounded.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${v < 0 && rounded !== 0 ? '-' : ''}${CURRENCY} ${text}`;
}

export function formatNumber(value) {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

export function formatCompact(value) {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
}

/** Percentages are null when undefined (e.g. margin with zero revenue) and shown as an em dash. */
export function formatPercent(value) {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;
}

export function formatChange(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}
