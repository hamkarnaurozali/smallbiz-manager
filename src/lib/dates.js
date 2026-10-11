// All dates are local calendar days stored as "YYYY-MM-DD" strings.
const pad = (n) => String(n).padStart(2, '0')

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayStr() {
  return toDateStr(new Date())
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = parseDate(s)
  return toDateStr(d) === s
}

export function addDays(s, n) {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export function diffDays(a, b) {
  return Math.round((parseDate(a) - parseDate(b)) / 86400000)
}

// Monday of the week containing the date.
export function weekStart(s) {
  const d = parseDate(s)
  const shift = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - shift)
  return toDateStr(d)
}

export function monthKey(s) {
  return s.slice(0, 7)
}

export function monthStart(s) {
  return `${monthKey(s)}-01`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function shortDate(s) {
  const [, m, d] = s.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
