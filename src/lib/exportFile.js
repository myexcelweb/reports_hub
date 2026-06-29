// Shared file-export helpers. Same Excel/PDF download code used to be
// re-written in every report component; now it lives in one place.

export function timestamp() {
  return new Date().toISOString().slice(0, 10);
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export an array of plain objects as a single-sheet workbook.
export async function exportRowsToExcel(rows, fileName, sheetName = 'Sheet1') {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, { dateNF: 'dd-mm-yyyy' });
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

// Export an array-of-arrays (free-form layout) as a single-sheet workbook.
export async function exportAoaToExcel(aoa, fileName, sheetName = 'Sheet1', colWidths = null) {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  if (colWidths) worksheet['!cols'] = colWidths.map(w => ({ wch: w }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

// Export an array of objects as a landscape PDF table (uses jsPDF + autotable).
export async function exportRowsToPdf(rows, columns, fileName) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF('l', 'mm', 'a4');
  autoTable(doc, {
    columns: columns.map(col => ({ header: col, dataKey: col })),
    body: rows.map(row => {
      const out = {};
      columns.forEach(col => { out[col] = row[col] != null ? String(row[col]) : ''; });
      return out;
    }),
    startY: 10,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    margin: { horizontal: 10 },
  });
  doc.save(fileName);
}
