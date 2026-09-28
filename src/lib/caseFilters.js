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

/**
 * Case No. format is "TYPE/NUMBER/YEAR" e.g. "CMA SC/46/2024" or "MACEX/20/1992".
 * Extract each part safely.
 * @param {string} caseNo
 * @returns {{ type: string, number: string, year: string }}
 */
export function parseCaseNo(caseNo) {
  if (!caseNo) return { type: 'N/A', number: 'N/A', year: 'N/A' };
  const parts = String(caseNo).trim().split('/');
  if (parts.length >= 3) {
    // Type may itself contain spaces (e.g. "CMA SC")
    const year = parts[parts.length - 1];
    const number = parts[parts.length - 2];
    const type = parts.slice(0, parts.length - 2).join('/').trim();
    return { type: type || 'N/A', number, year };
  }
  if (parts.length === 2) {
    return { type: parts[0], number: 'N/A', year: parts[1] };
  }
  return { type: String(caseNo), number: 'N/A', year: 'N/A' };
}

/** @deprecated Use parseCaseNo – kept for any residual callers */
export function parseUID(uid) {
  return parseCaseNo(uid);
}

/**
 * Extract 4-digit year from Case No. (preferred) or fall back to CNR last 4 digits.
 * @param {string} caseNo
 * @param {string} [cnr]
 * @returns {string|null}
 */
export function extractYear(caseNo, cnr) {
  const { year } = parseCaseNo(caseNo);
  if (/^\d{4}$/.test(year)) return year;
  // Fallback: CNR ends with 4-digit year
  if (cnr) {
    const cnrStr = String(cnr).trim();
    if (cnrStr.length >= 4) {
      const y = cnrStr.slice(-4);
      if (/^\d{4}$/.test(y)) return y;
    }
  }
  return null;
}

/**
 * How to get case type and year from CNR / Case No:
 *
 * CNR format (16 chars typical):
 *   Positions 1-2  : State code   (e.g. GJ = Gujarat)
 *   Positions 3-4  : District code (e.g. PB = Porbandar)
 *   Positions 5-6  : Establishment code
 *   Positions 7-12 : Case serial number (zero-padded)
 *   Positions 13-16: Year (4 digits)
 *
 * Case TYPE is NOT reliably encoded in CNR in a human-readable form.
 * Always use the Case No. field (e.g. "SC/1/2025") for CAT1 / case type.
 * Year can be taken from Case No. last segment OR from CNR last 4 digits.
 */

// Generic row filter: pass only the keys you care about.
// e.g. matchRow(row, { STATUS: 'PENDING', SIDE: 'CIVIL', CAT2: 'X' })
export function matchRow(row, filters) {
  return Object.entries(filters).every(([key, val]) => val === undefined || val === null || row[key] === val);
}

export function filterCases(data, filters) {
  if (!data) return [];
  return data.filter(row => matchRow(row, filters));
}

export function sortedCaseNos(rows) {
  return rows.map(row => row['CASE NO'] || row.CNR || '').sort();
}

/** @deprecated */
export function sortedUids(rows) {
  return sortedCaseNos(rows);
}

/**
 * Normalize a case number for matching across formats.
 * e.g. "CMA DC/22/2000" and "cma dc/22/2000" → same key
 */
export function normalizeCaseNo(caseNo) {
  if (!caseNo) return '';
  return String(caseNo).trim().toUpperCase().replace(/\s+/g, ' ');
}


/**
 * Unique key for a case, used for duplicate removal (processor + date filter).
 *   - CNR when present (already unique across establishments).
 *   - Otherwise normalized CASE NO, plus ESTA in multi-court mode so the same
 *     Case No. from two courts isn't merged into one case.
 * Returns '' when the row has neither CNR nor CASE NO.
 */
export function caseKey(row, multiCourt = false) {
  const cnr = String(row?.CNR ?? '').trim().toUpperCase();
  if (cnr) return cnr;
  const caseNo = normalizeCaseNo(row?.['CASE NO']);
  if (!caseNo) return '';
  const esta = multiCourt ? String(row?.ESTA ?? '').trim().toUpperCase() : '';
  return esta ? `CASE:${caseNo}||${esta}` : `CASE:${caseNo}`;
}

/** Column that records which uploaded file(s) a row came from. */
export const SOURCE_FILE_KEY = 'SOURCE FILE NAME';

/**
 * Union of two ", "-joined file-name lists, order preserved, no repeats.
 * e.g. mergeSourceFiles('a.xlsx', 'b.xlsx, a.xlsx') → 'a.xlsx, b.xlsx'
 */
export function mergeSourceFiles(...lists) {
  const names = [];
  lists.forEach(list => {
    String(list || '').split(', ').forEach(name => {
      if (name && !names.includes(name)) names.push(name);
    });
  });
  return names.join(', ');
}

/** Return a copy of the row with SOURCE FILE NAME as the first key (for exports). */
export function sourceFileFirst(row) {
  if (!row || !(SOURCE_FILE_KEY in row)) return row;
  const { [SOURCE_FILE_KEY]: source, ...rest } = row;
  return { [SOURCE_FILE_KEY]: source, ...rest };
}

/** Known establishment codes embedded in uploaded filenames (multi-court mode). */
export const ESTA_CODES = ['PBR', 'APP', 'SUB', 'RAN', 'KUT'];

/**
 * Detect establishment code from a filename.
 * Looks for whole-word tokens: PBR, APP, SUB, RAN, KUT (case-insensitive).
 * e.g. "Pending_QueryBuilder_PBR_2026.xlsx" → "PBR"
 * @param {string} fileName
 * @returns {string|null}
 */
export function extractEstaFromFileName(fileName) {
  if (!fileName) return null;
  const upper = String(fileName).toUpperCase();
  // Split on non-alphanumeric so "PBR_pending.xlsx" / "pending-PBR.xlsx" / "PBR.xlsx" all work
  const tokens = upper.split(/[^A-Z0-9]+/).filter(Boolean);
  for (const code of ESTA_CODES) {
    if (tokens.includes(code)) return code;
  }
  // Also allow substring match as fallback (e.g. "PBRDistrict_...")
  for (const code of ESTA_CODES) {
    if (upper.includes(code)) return code;
  }
  return null;
}
