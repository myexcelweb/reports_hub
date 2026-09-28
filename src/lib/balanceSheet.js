import { parseCaseNo } from './caseFilters';

// Build { groupedData: { category: { year: [caseNumbers] } }, totalCases } for one side.
export function buildBalanceSheet(data, side) {
  if (!data || data.length === 0) return { groupedData: {}, totalCases: 0 };

  const rows = data
    .filter(row => row.STATUS === 'PENDING' && row.SIDE === side.toUpperCase())
    .map(row => {
      const caseNo = row['CASE NO'] || '';
      const { number, year } = parseCaseNo(caseNo);
      // Fallback year from CNR last 4 digits
      let y = year;
      if (y === 'N/A' || !/^\d{4}$/.test(y)) {
        const cnr = String(row.CNR || '');
        if (cnr.length >= 4) {
          const cy = cnr.slice(-4);
          if (/^\d{4}$/.test(cy)) y = cy;
        }
      }
      if (y === 'N/A' || !/^\d{4}$/.test(y) || !row.CAT2) return null;
      return { category: String(row.CAT2), number, year: y };
    })
    .filter(Boolean)
    .sort((a, b) =>
      a.category.localeCompare(b.category) ||
      Number(a.year) - Number(b.year) ||
      Number(a.number) - Number(b.number)
    );

  const groupedData = {};
  rows.forEach(({ category, year, number }) => {
    (groupedData[category] ??= {});
    (groupedData[category][year] ??= []).push(number);
  });

  return { groupedData, totalCases: rows.length };
}
