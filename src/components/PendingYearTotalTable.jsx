import { useMemo, useState } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import { FileEarmarkExcel, FileEarmarkPdf } from 'react-bootstrap-icons';
import { extractYear, filterCases } from '../lib/caseFilters';
import { useDrillDown } from '../hooks/useDrillDown';
import CaseListModal from './common/CaseListModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function PendingYearTotalTable({ processedData, side, sideLabel, emptyLabel }) {
  const { modal, open, close } = useDrillDown();
  const [busy, setBusy] = useState(null);

  const data = useMemo(() => {
    const filtered = filterCases(processedData, { STATUS: 'PENDING', SIDE: side });
    if (filtered.length === 0) return null;

    const pivot = {};
    const years = new Set();
    filtered.forEach(row => {
      const year = extractYear(row.UID);
      if (!year) return;
      years.add(year);
      const cat2 = String(row.CAT2 || 'UNKNOWN').trim();
      pivot[cat2] ??= {};
      pivot[cat2][year] = (pivot[cat2][year] || 0) + 1;
    });
    if (Object.keys(pivot).length === 0) return null;

    const sortedYears = Array.from(years).sort();
    const grandTotals = Object.fromEntries([...sortedYears.map(y => [y, 0]), ['TOTAL', 0]]);

    const rows = Object.keys(pivot).sort().map(cat2 => {
      const row = { cat2, total: 0 };
      sortedYears.forEach(year => {
        const count = pivot[cat2][year] || 0;
        row[year] = count;
        row.total += count;
        grandTotals[year] += count;
      });
      grandTotals.TOTAL += row.total;
      return row;
    });

    return { rows, sortedYears, grandTotals };
  }, [processedData, side]);

  if (!data) return <p className="text-muted">{emptyLabel}</p>;

  const { rows, sortedYears, grandTotals } = data;

  // ---- Drill‑down: pass full row objects ----
  const showCases = (cat2, year) => {
    const matches = (processedData || []).filter(row =>
      row.STATUS === 'PENDING' && row.SIDE === side &&
      (cat2 ? row.CAT2 === cat2 : true) &&
      (year ? extractYear(row.UID) === year : true)
    );
    const title = cat2 && year ? `${cat2} - ${year}`
      : cat2 ? `All Pending ${sideLabel} Cases - ${cat2}`
        : year ? `All Pending ${sideLabel} Cases - ${year}`
          : `All Pending ${sideLabel} Cases`;
    open(title, matches);  // <-- pass full rows
  };

  // ---- Export ----
  const buildTableData = () => {
    const headers = ['Case Category', ...sortedYears, 'TOTAL'];
    const rowsData = rows.map(row => {
      const cols = [row.cat2];
      sortedYears.forEach(year => cols.push(row[year] || 0));
      cols.push(row.total);
      return cols;
    });
    const grandRow = ['GRAND TOTAL'];
    sortedYears.forEach(year => grandRow.push(grandTotals[year]));
    grandRow.push(grandTotals.TOTAL);
    return { headers, rows: rowsData, grandRow };
  };

  const exportExcel = async () => {
    setBusy('excel');
    try {
      const wb = XLSX.utils.book_new();
      const { headers, rows, grandRow } = buildTableData();
      const data = [headers, ...rows, grandRow];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Year-wise Total');
      XLSX.writeFile(wb, `${sideLabel}-YearWiseTotal.xlsx`);
    } catch (err) {
      alert('Failed to export Excel: ' + err.message);
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = async () => {
    setBusy('pdf');
    try {
      const doc = new jsPDF('landscape', 'pt', 'a4');
      const { headers, rows, grandRow } = buildTableData();
      doc.setFontSize(14);
      doc.text(`${sideLabel} Pending Cases – Year-wise Total`, 14, 30);
      doc.autoTable({
        head: [headers],
        body: rows.concat([grandRow]),
        startY: 50,
        theme: 'striped',
        headStyles: { fillColor: [15, 30, 53] },
        styles: { fontSize: 8 },
        margin: { left: 10, right: 10 },
      });
      doc.save(`${sideLabel}-YearWiseTotal.pdf`);
    } catch (err) {
      alert('Failed to export PDF: ' + err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="d-flex justify-content-end gap-2 mb-3">
        <Button variant="success" size="sm" disabled={busy === 'excel'} onClick={exportExcel}>
          <FileEarmarkExcel className="me-1" />{busy === 'excel' ? 'Generating...' : 'Download Excel'}
        </Button>
        <Button variant="danger" size="sm" disabled={busy === 'pdf'} onClick={exportPdf}>
          <FileEarmarkPdf className="me-1" />{busy === 'pdf' ? 'Generating...' : 'Download PDF'}
        </Button>
      </div>

      <Table striped bordered hover responsive>
        <thead className="table-dark">
          <tr><th className="text-center">Case Category</th>{sortedYears.map(y => <th key={y} className="text-center">{y}</th>)}<th className="text-center">GRAND TOTAL</th></tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.cat2}>
              <td><strong>{row.cat2}</strong></td>
              {sortedYears.map(year => (
                <td key={year} className="text-center">
                  <Button variant="link" size="sm" onClick={() => showCases(row.cat2, year)}>{row[year] || 0}</Button>
                </td>
              ))}
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(row.cat2, null)}><strong className="text-primary">{row.total}</strong></Button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="table-secondary fw-bold">
            <td>GRAND TOTAL</td>
            {sortedYears.map(year => (
              <td key={year} className="text-center">
                <Button variant="link" size="sm" onClick={() => showCases(null, year)}>{grandTotals[year]}</Button>
              </td>
            ))}
            <td className="text-center">
              <Button variant="link" size="sm" onClick={() => showCases(null, null)}><strong className="text-success">{grandTotals.TOTAL}</strong></Button>
            </td>
          </tr>
        </tfoot>
      </Table>

      <CaseListModal show={modal.show} title={modal.title} rows={modal.rows} onClose={close} />
    </>
  );
}