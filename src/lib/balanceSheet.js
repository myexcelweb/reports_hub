import { parseUID } from './caseFilters';
import { timestamp } from './exportFile';

// Build { groupedData: { category: { year: [caseNumbers] } }, totalCases } for one side.
export function buildBalanceSheet(data, side) {
  if (!data || data.length === 0) return { groupedData: {}, totalCases: 0 };

  const rows = data
    .filter(row => row.STATUS === 'PENDING' && row.SIDE === side.toUpperCase())
    .map(row => {
      const { number, year } = parseUID(row.UID);
      if (year === 'N/A' || !row.CAT2) return null;
      return { category: String(row.CAT2), number, year };
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

export async function downloadBalanceSheetPdf(groupedData, totalCases, sideLabel) {
  if (totalCases === 0) throw new Error(`No pending ${sideLabel.toLowerCase()} cases to export.`);
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF('l', 'mm', 'a4');
  const margin = 10;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let y = 20;

  doc.setFontSize(16).setFont(undefined, 'bold');
  doc.text(`${sideLabel.toUpperCase()} BALANCE SHEET`, pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10).setFont(undefined, 'normal');
  doc.text(`Total Pending Cases: ${totalCases}`, pageWidth / 2, y, { align: 'center' });
  y += 10;

  Object.keys(groupedData).sort().forEach(category => {
    const years = Object.keys(groupedData[category]).sort((a, b) => Number(a) - Number(b));
    if (y > pageHeight - 20) { doc.addPage('l', 'a4'); y = 20; }
    doc.setFontSize(12).setFont(undefined, 'bold');
    doc.text(`Category: ${category}`, margin, y);
    y += 6;

    years.forEach(year => {
      const numbers = groupedData[category][year].sort((a, b) => Number(a) - Number(b));
      if (y > pageHeight - 15) { doc.addPage('l', 'a4'); y = 20; }
      doc.setFontSize(10).setFont(undefined, 'normal');
      doc.text(`${year}: ${numbers.join(', ')}`, margin + 5, y);
      y += 5;
    });
    y += 5;
  });

  doc.save(`${sideLabel}-Balance-Sheet-${timestamp()}.pdf`);
}

export async function downloadBalanceSheetExcel(groupedData, sideLabel) {
  if (Object.keys(groupedData).length === 0) throw new Error(`No pending ${sideLabel.toLowerCase()} cases to export.`);
  const XLSX = await import('xlsx');
  const rows = [];
  Object.keys(groupedData).sort().forEach(category => {
    const years = Object.keys(groupedData[category]).sort((a, b) => Number(a) - Number(b));
    rows.push([category, '', '']);
    years.forEach(year => {
      const numbers = groupedData[category][year].sort((a, b) => Number(a) - Number(b));
      rows.push(['', year, numbers.join(', ')]);
    });
    rows.push([]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 50 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `${sideLabel.toUpperCase()} BALANCE SHEET`);
  XLSX.writeFile(workbook, `${sideLabel}-Balance-Sheet-${timestamp()}.xlsx`);
}
