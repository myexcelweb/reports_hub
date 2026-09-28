import { useMemo } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import { FileEarmarkExcel, FileEarmarkPdf } from 'react-bootstrap-icons';
import { extractYear, filterCases } from '../lib/caseFilters';
import { useDrillDown } from '../hooks/useDrillDown';
import CaseListModal from './common/CaseListModal';
import { useReportExport } from '../hooks/useReportExport';

export default function PendingYearTotalTable({ processedData, side, sideLabel, emptyLabel }) {
  const { modal, open, close } = useDrillDown();
  const { ref: exportRef, busy, exportExcel, exportPdf } = useReportExport({ reportTitle: `B1B2-${sideLabel} — Pending Year-wise Total`, fileBase: `${sideLabel}-YearWiseTotal` });

  const data = useMemo(() => {
    const filtered = filterCases(processedData, { STATUS: 'PENDING', SIDE: side });
    if (filtered.length === 0) return null;

    const pivot = {};
    const years = new Set();
    filtered.forEach(row => {
      const year = extractYear(row['CASE NO'], row.CNR);
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
      (year ? extractYear(row['CASE NO'], row.CNR) === year : true)
    );
    const title = cat2 && year ? `${cat2} - ${year}`
      : cat2 ? `All Pending ${sideLabel} Cases - ${cat2}`
        : year ? `All Pending ${sideLabel} Cases - ${year}`
          : `All Pending ${sideLabel} Cases`;
    open(title, matches);  // <-- pass full rows
  };

  return (
    <div ref={exportRef}>
      <div className="d-flex justify-content-end gap-2 mb-3">
        <Button variant="success" size="sm" disabled={busy === 'excel'} onClick={exportExcel}>
          <FileEarmarkExcel className="me-1" />{busy === 'excel' ? 'Generating...' : 'Download Excel'}
        </Button>
        <Button variant="danger" size="sm" disabled={busy === 'pdf'} onClick={exportPdf}>
          <FileEarmarkPdf className="me-1" />{busy === 'pdf' ? 'Generating...' : 'Download PDF'}
        </Button>
      </div>

      <Table striped bordered hover responsive data-export-sheet={`${sideLabel} Year-wise`}>
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
    </div>
  );
}