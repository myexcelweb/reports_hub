// Shared helpers for filtering/parsing case rows.
// Centralised here because the same logic used to be copy-pasted into
// almost every report component.

export const AGE_CAT2_LIST = [
  '0-1 YEAR', '1-2 YEAR', '2-3 YEAR', '3-5 YEAR',
  '5-7 YEAR', '7-10 YEAR', 'MORE THAN 10 YEARS'
];

export const AGE_CAT3_LIST = [
  '0-3 MONTH', '3-6 MONTH', '6-12 MONTH', 'MORE THAN 12 MONTH'
];

// 'BJ/OBJ', 'Contested/Uncontested' style values come from many different
// source columns with inconsistent spellings. One normaliser for all of it.
export function normalizeContested(value) {
  if (value === undefined || value === null) return 'UNCONTESTED';
  const str = String(value).toUpperCase().trim();
  if (str === '') return 'UNCONTESTED';
  if (['CONTESTED', 'CONTEST', 'CONT', 'C/', 'OBJ', 'O/', 'B/', 'BJ'].includes(str)) return 'CONTESTED';
  if (['UNCONTESTED', 'UNCONTEST', 'UC', 'NONCONTEST', 'N/C'].includes(str)) return 'UNCONTESTED';
  if (str.includes('NOT CONTEST') || str.includes('NO CONTEST') || str.includes('N-C')) return 'UNCONTESTED';
  if (str.includes('CONTEST') && !str.includes('UNCONTEST')) return 'CONTESTED';
  return 'UNCONTESTED';
}

export function isLokAdalat(row) {
  return String(row['DIS NATURE'] || '').toUpperCase().includes('LOK ADALAT');
}

export function normalizeRU(ru) {
  const upper = String(ru || '').toUpperCase().trim();
  if (upper === 'R' || upper === 'READY') return 'READY';
  if (upper === 'U' || upper === 'UNREADY') return 'UNREADY';
  return null;
}

// UID format is ".../<number>/<year>". Extract each part safely.
export function parseUID(uid) {
  if (!uid) return { number: 'N/A', year: 'N/A' };
  const parts = String(uid).split('/');
  if (parts.length >= 3) return { number: parts[parts.length - 2], year: parts[parts.length - 1] };
  if (parts.length === 2) return { number: parts[0], year: parts[1] };
  return { number: 'N/A', year: 'N/A' };
}

export function extractYear(uid) {
  const { year } = parseUID(uid);
  return /^\d{4}$/.test(year) ? year : null;
}

// Generic row filter: pass only the keys you care about.
// e.g. matchRow(row, { STATUS: 'PENDING', SIDE: 'CIVIL', CAT2: 'X' })
export function matchRow(row, filters) {
  return Object.entries(filters).every(([key, val]) => val === undefined || val === null || row[key] === val);
}

export function filterCases(data, filters) {
  if (!data) return [];
  return data.filter(row => matchRow(row, filters));
}

export function sortedUids(rows) {
  return rows.map(row => row.UID).sort();
}
