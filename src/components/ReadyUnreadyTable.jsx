import { Fragment, useMemo, useState } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import { FileEarmarkExcel, FileEarmarkPdf } from 'react-bootstrap-icons';
import { extractYear, normalizeRU, filterCases } from '../lib/caseFilters';
import { useDrillDown } from '../hooks/useDrillDown';
import CaseListModal from './common/CaseListModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Helper: get last N years from a sorted array
const getLastNYears = (years, n) => {
  const sorted = [...years].sort((a, b) => Number(a) - Number(b));
  return sorted.slice(-n);
};

export default function ReadyUnreadyTable({ processedData, side = 'CIVIL', sideLabel = 'Civil', emptyLabel }) {
  const { modal, open, close } = useDrillDown();
  const [busy, setBusy] = useState(null);

  // ---- Compute both tables ----
  const tables = useMemo(() => {
    const filtered = filterCases(processedData, { STATUS: 'PENDING', SIDE: side });
    if (filtered.length === 0) return null;

    const fullPivot = {};
    const allYearsSet = new Set();
    filtered.forEach(row => {
      const year = extractYear(row.UID);
      if (!year) return;
      allYearsSet.add(year);
      const ru = normalizeRU(row.RU);
      if (!ru) return;
      const cat2 = String(row.CAT2 || 'UNKNOWN').trim();
      fullPivot[cat2] ??= {};
      fullPivot[cat2][year] ??= { READY: 0, UNREADY: 0 };
      fullPivot[cat2][year][ru]++;
    });
    if (Object.keys(fullPivot).length === 0) return null;

    const allYears = Array.from(allYearsSet).sort((a, b) => Number(a) - Number(b));
    const last5Years = getLastNYears(allYears, 5);
    const preYear = last5Years.length > 0 ? last5Years[0] : null;

    const cat2Keys = Object.keys(fullPivot).sort();

    const buildRows = () => {
      const fullRows = [];
      const last5Rows = [];
      const grandFull = { READY_TOTAL: 0, UNREADY_TOTAL: 0, GRAND_TOTAL: 0 };
      const grandLast5 = { preReady: 0, preUnready: 0, READY_TOTAL: 0, UNREADY_TOTAL: 0, GRAND_TOTAL: 0 };
      const yearTotalsFull = Object.fromEntries(allYears.map(y => [y, { READY: 0, UNREADY: 0 }]));
      const yearTotalsLast5 = Object.fromEntries(last5Years.map(y => [y, { READY: 0, UNREADY: 0 }]));

      cat2Keys.forEach(cat2 => {
        const rowFull = { cat2, READY_TOTAL: 0, UNREADY_TOTAL: 0, GRAND_TOTAL: 0 };
        const rowLast5 = { cat2, preReady: 0, preUnready: 0, READY_TOTAL: 0, UNREADY_TOTAL: 0, GRAND_TOTAL: 0 };

        allYears.forEach(year => {
          const { READY = 0, UNREADY = 0 } = fullPivot[cat2][year] || {};
          rowFull[`${year}_READY`] = READY;
          rowFull[`${year}_UNREADY`] = UNREADY;
          rowFull.READY_TOTAL += READY;
          rowFull.UNREADY_TOTAL += UNREADY;
          yearTotalsFull[year].READY += READY;
          yearTotalsFull[year].UNREADY += UNREADY;

          // For last5: aggregate all years before preYear
          if (preYear && Number(year) < Number(preYear)) {
            rowLast5.preReady += READY;
            rowLast5.preUnready += UNREADY;
            grandLast5.preReady += READY;
            grandLast5.preUnready += UNREADY;
          } else if (last5Years.includes(year)) {
            rowLast5[`${year}_READY`] = READY;
            rowLast5[`${year}_UNREADY`] = UNREADY;
            yearTotalsLast5[year].READY += READY;
            yearTotalsLast5[year].UNREADY += UNREADY;
          }
        });

        rowFull.GRAND_TOTAL = rowFull.READY_TOTAL + rowFull.UNREADY_TOTAL;
        grandFull.READY_TOTAL += rowFull.READY_TOTAL;
        grandFull.UNREADY_TOTAL += rowFull.UNREADY_TOTAL;
        grandFull.GRAND_TOTAL += rowFull.GRAND_TOTAL;

        rowLast5.READY_TOTAL = rowLast5.preReady + last5Years.reduce((sum, y) => sum + (rowLast5[`${y}_READY`] || 0), 0);
        rowLast5.UNREADY_TOTAL = rowLast5.preUnready + last5Years.reduce((sum, y) => sum + (rowLast5[`${y}_UNREADY`] || 0), 0);
        rowLast5.GRAND_TOTAL = rowLast5.READY_TOTAL + rowLast5.UNREADY_TOTAL;
        grandLast5.READY_TOTAL += rowLast5.READY_TOTAL;
        grandLast5.UNREADY_TOTAL += rowLast5.UNREADY_TOTAL;
        grandLast5.GRAND_TOTAL += rowLast5.GRAND_TOTAL;

        fullRows.push(rowFull);
        last5Rows.push(rowLast5);
      });

      return {
        fullRows,
        grandFull,
        grandFullYear: yearTotalsFull,
        last5Rows,
        grandLast5,
        grandLast5Year: yearTotalsLast5,
        allYears,
        last5Years,
        preYear,
      };
    };

    return buildRows();
  }, [processedData, side]);

  if (!tables) return <p className="text-muted">{emptyLabel}</p>;

  const {
    fullRows,
    grandFull,
    grandFullYear,
    allYears,
    last5Rows,
    grandLast5,
    grandLast5Year,
    last5Years,
    preYear,
  } = tables;

  // ---- Drill‑down (passes full rows) ----
  const showCases = (cat2, year, status) => {
    const matches = (processedData || []).filter(row => {
      if (row.STATUS !== 'PENDING' || row.SIDE !== side) return false;
      if (cat2 && row.CAT2 !== cat2) return false;
      if (status && normalizeRU(row.RU) !== status) return false;
      if (year === 'pre') {
        const yr = extractYear(row.UID);
        return yr && Number(yr) < Number(preYear);
      } else if (year) {
        return extractYear(row.UID) === year;
      }
      return true;
    });
    const title = [cat2, year === 'pre' ? `Before ${preYear}` : year, status].filter(Boolean).join(' - ') || `All Pending ${sideLabel} Cases`;
    open(title, matches);   // <-- pass full rows, not UIDs
  };

  // ---- Export helpers (order: Last5 first, then All) ----
  const buildLast5TableData = () => {
    const headers = ['Case Category', `pre-${preYear} (R)`, `pre-${preYear} (U)`, ...last5Years.flatMap(y => [`${y} (R)`, `${y} (U)`]), 'TOTAL (R)', 'TOTAL (U)', 'GRAND TOTAL'];
    const rows = last5Rows.map(row => {
      const cols = [row.cat2, row.preReady, row.preUnready];
      last5Years.forEach(y => { cols.push(row[`${y}_READY`] || 0, row[`${y}_UNREADY`] || 0); });
      cols.push(row.READY_TOTAL, row.UNREADY_TOTAL, row.GRAND_TOTAL);
      return cols;
    });
    const grandRow = ['GRAND TOTAL', grandLast5.preReady, grandLast5.preUnready];
    last5Years.forEach(y => { grandRow.push(grandLast5Year[y].READY, grandLast5Year[y].UNREADY); });
    grandRow.push(grandLast5.READY_TOTAL, grandLast5.UNREADY_TOTAL, grandLast5.GRAND_TOTAL);
    return { headers, rows, grandRow };
  };

  const buildFullTableData = () => {
    const headers = ['Case Category', ...allYears.flatMap(y => [`${y} (R)`, `${y} (U)`]), 'TOTAL (R)', 'TOTAL (U)', 'GRAND TOTAL'];
    const rows = fullRows.map(row => {
      const cols = [row.cat2];
      allYears.forEach(y => { cols.push(row[`${y}_READY`] || 0, row[`${y}_UNREADY`] || 0); });
      cols.push(row.READY_TOTAL, row.UNREADY_TOTAL, row.GRAND_TOTAL);
      return cols;
    });
    const grandRow = ['GRAND TOTAL'];
    allYears.forEach(y => { grandRow.push(grandFullYear[y].READY, grandFullYear[y].UNREADY); });
    grandRow.push(grandFull.READY_TOTAL, grandFull.UNREADY_TOTAL, grandFull.GRAND_TOTAL);
    return { headers, rows, grandRow };
  };

  const exportExcel = async () => {
    setBusy('excel');
    try {
      const wb = XLSX.utils.book_new();

      const last5 = buildLast5TableData();
      const last5Data = [last5.headers, ...last5.rows, last5.grandRow];
      const wsLast5 = XLSX.utils.aoa_to_sheet(last5Data);
      XLSX.utils.book_append_sheet(wb, wsLast5, 'Last 5 Years');

      const full = buildFullTableData();
      const fullData = [full.headers, ...full.rows, full.grandRow];
      const wsFull = XLSX.utils.aoa_to_sheet(fullData);
      XLSX.utils.book_append_sheet(wb, wsFull, 'All Years');

      XLSX.writeFile(wb, `${sideLabel}-ReadyUnready-Combined.xlsx`);
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

      const addTable = (data, title) => {
        const { headers, rows, grandRow } = data;
        doc.setFontSize(14);
        doc.text(title, 14, doc.lastAutoTable ? doc.lastAutoTable.finalY + 30 : 30);
        doc.autoTable({
          head: [headers],
          body: rows.concat([grandRow]),
          startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 50,
          theme: 'striped',
          headStyles: { fillColor: [15, 30, 53] },
          styles: { fontSize: 8 },
          margin: { left: 10, right: 10 },
        });
      };

      addTable(buildLast5TableData(), `${sideLabel} Pending Cases – Last 5 Years (pre-${preYear} aggregated)`);
      doc.addPage();
      addTable(buildFullTableData(), `${sideLabel} Pending Cases – All Years`);

      doc.save(`${sideLabel}-ReadyUnready-Combined.pdf`);
    } catch (err) {
      alert('Failed to export PDF: ' + err.message);
    } finally {
      setBusy(null);
    }
  };

  // ---- Render: Last5 first, then All Years ----
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

      {/* Table 1: Last 5 Years + pre‑year */}
      <h5 className="mt-4">Last 5 Years (pre-{preYear} aggregated) – Ready / Unready</h5>
      <Table striped bordered hover responsive>
        <thead className="table-dark">
          <tr>
            <th rowSpan={2}>Case Category</th>
            <th colSpan={2} className="text-center">pre-{preYear}</th>
            {last5Years.map(y => (
              <th key={y} colSpan={2} className="text-center">{y}</th>
            ))}
            <th colSpan={2} className="text-center">TOTAL</th>
            <th rowSpan={2} className="text-center">GRAND TOTAL</th>
          </tr>
          <tr>
            <th className="text-center">(R)</th>
            <th className="text-center">(U)</th>
            {last5Years.map(y => (
              <Fragment key={y}>
                <th className="text-center">(R)</th>
                <th className="text-center">(U)</th>
              </Fragment>
            ))}
            <th className="text-center">(R)</th>
            <th className="text-center">(U)</th>
          </tr>
        </thead>
        <tbody>
          {last5Rows.map(row => (
            <tr key={row.cat2}>
              <td>{row.cat2}</td>
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(row.cat2, 'pre', 'READY')}>{row.preReady}</Button></td>
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(row.cat2, 'pre', 'UNREADY')}>{row.preUnready}</Button></td>
              {last5Years.map(year => (
                <Fragment key={year}>
                  <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(row.cat2, year, 'READY')}>{row[`${year}_READY`] || 0}</Button></td>
                  <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(row.cat2, year, 'UNREADY')}>{row[`${year}_UNREADY`] || 0}</Button></td>
                </Fragment>
              ))}
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(row.cat2, null, 'READY')}><strong>{row.READY_TOTAL}</strong></Button></td>
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(row.cat2, null, 'UNREADY')}><strong>{row.UNREADY_TOTAL}</strong></Button></td>
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(row.cat2, null, null)}><strong>{row.GRAND_TOTAL}</strong></Button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="table-secondary fw-bold">
            <td>GRAND TOTAL</td>
            <td className="text-center">{grandLast5.preReady}</td>
            <td className="text-center">{grandLast5.preUnready}</td>
            {last5Years.map(year => (
              <Fragment key={year}>
                <td className="text-center">{grandLast5Year[year].READY}</td>
                <td className="text-center">{grandLast5Year[year].UNREADY}</td>
              </Fragment>
            ))}
            <td className="text-center">{grandLast5.READY_TOTAL}</td>
            <td className="text-center">{grandLast5.UNREADY_TOTAL}</td>
            <td className="text-center">{grandLast5.GRAND_TOTAL}</td>
          </tr>
        </tfoot>
      </Table>

      {/* Table 2: All Years */}
      <h5 className="mt-5">All Years – Ready / Unready</h5>
      <Table striped bordered hover responsive>
        <thead className="table-dark">
          <tr>
            <th rowSpan={2}>Case Category</th>
            {allYears.map(y => (
              <th key={y} colSpan={2} className="text-center">{y}</th>
            ))}
            <th colSpan={2} className="text-center">TOTAL</th>
            <th rowSpan={2} className="text-center">GRAND TOTAL</th>
          </tr>
          <tr>
            {allYears.map(y => (
              <Fragment key={y}>
                <th className="text-center">(R)</th>
                <th className="text-center">(U)</th>
              </Fragment>
            ))}
            <th className="text-center">(R)</th>
            <th className="text-center">(U)</th>
          </tr>
        </thead>
        <tbody>
          {fullRows.map(row => (
            <tr key={row.cat2}>
              <td>{row.cat2}</td>
              {allYears.map(year => (
                <Fragment key={year}>
                  <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(row.cat2, year, 'READY')}>{row[`${year}_READY`] || 0}</Button></td>
                  <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(row.cat2, year, 'UNREADY')}>{row[`${year}_UNREADY`] || 0}</Button></td>
                </Fragment>
              ))}
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(row.cat2, null, 'READY')}><strong>{row.READY_TOTAL}</strong></Button></td>
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(row.cat2, null, 'UNREADY')}><strong>{row.UNREADY_TOTAL}</strong></Button></td>
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(row.cat2, null, null)}><strong>{row.GRAND_TOTAL}</strong></Button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="table-secondary fw-bold">
            <td>GRAND TOTAL</td>
            {allYears.map(year => (
              <Fragment key={year}>
                <td className="text-center">{grandFullYear[year].READY}</td>
                <td className="text-center">{grandFullYear[year].UNREADY}</td>
              </Fragment>
            ))}
            <td className="text-center">{grandFull.READY_TOTAL}</td>
            <td className="text-center">{grandFull.UNREADY_TOTAL}</td>
            <td className="text-center">{grandFull.GRAND_TOTAL}</td>
          </tr>
        </tfoot>
      </Table>

      <CaseListModal show={modal.show} title={modal.title} rows={modal.rows} onClose={close} />
    </>
  );
}