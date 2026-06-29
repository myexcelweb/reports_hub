import { Fragment, useMemo, useState } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import { FileEarmarkExcel, FileEarmarkPdf } from 'react-bootstrap-icons';
import { AGE_CAT3_LIST, normalizeContested, filterCases } from '../lib/caseFilters';
import { useDrillDown } from '../hooks/useDrillDown';
import CaseListModal from './common/CaseListModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const isSpecialCategory = (cat2) => {
  if (!cat2) return false;
  const upper = cat2.trim().toUpperCase();
  return upper.startsWith('CMA') || upper.startsWith('EXE');
};

const isLokAdalat = (disNature) => {
  if (!disNature) return false;
  return disNature.toUpperCase().includes('LOK ADALAT');
};

export default function AgeBreakdownTable({
  processedData,
  status,
  side,
  emptyLabel,
  highlightSpecial = false,
  highlightNonSpecial = false,
  includeLA = false,
  showExport = false,
  bjObjSplit = false,
}) {
  const { modal, open, close } = useDrillDown();
  const [busy, setBusy] = useState(null);

  const data = useMemo(() => {
    const filtered = filterCases(processedData, { STATUS: status, SIDE: side });
    if (filtered.length === 0) return null;

    if (!bjObjSplit) {
      // Simple mode (unchanged)
      const pivot = {};
      const laCounts = {};
      filtered.forEach(row => {
        const cat2 = row.CAT2 || 'UNKNOWN';
        const age = row['AGE CAT3'] || 'UNKNOWN';
        pivot[cat2] ??= Object.fromEntries([...AGE_CAT3_LIST.map(a => [a, 0]), ['TOTAL', 0]]);
        if (AGE_CAT3_LIST.includes(age)) pivot[cat2][age]++;
        pivot[cat2].TOTAL++;
        if (includeLA && isLokAdalat(row['DIS NATURE'])) {
          laCounts[cat2] = (laCounts[cat2] || 0) + 1;
        }
      });
      const grandTotal = Object.fromEntries([...AGE_CAT3_LIST.map(a => [a, 0]), ['TOTAL', 0]]);
      const grandLA = { LA: 0 };
      Object.values(pivot).forEach(row => {
        AGE_CAT3_LIST.forEach(a => { grandTotal[a] += row[a] || 0; });
        grandTotal.TOTAL += row.TOTAL;
      });
      if (includeLA) {
        Object.values(laCounts).forEach(c => { grandLA.LA += c; });
      }
      const enrichedPivot = {};
      Object.keys(pivot).forEach(cat2 => {
        enrichedPivot[cat2] = { ...pivot[cat2], LA: laCounts[cat2] || 0 };
      });
      return { mode: 'simple', pivot: enrichedPivot, grandTotal, grandLA, cat2Keys: Object.keys(enrichedPivot).sort() };
    } else {
      // BJ/OBJ split mode
      const allCat2 = new Set();
      const pivot1 = {};
      const laCounts = {};
      filtered.forEach(row => {
        const cat2 = row.CAT2 || 'UNKNOWN';
        allCat2.add(cat2);
        const age = row['AGE CAT3'] || 'UNKNOWN';
        if (!AGE_CAT3_LIST.includes(age)) return;
        const key = `${age}_${normalizeContested(row['BJ OBJ']) === 'CONTESTED' ? 'BJ' : 'OBJ'}`;
        pivot1[cat2] ??= {};
        pivot1[cat2][key] = (pivot1[cat2][key] || 0) + 1;
        if (includeLA && isLokAdalat(row['DIS NATURE'])) {
          laCounts[cat2] = (laCounts[cat2] || 0) + 1;
        }
      });
      const table1 = {};
      allCat2.forEach(cat2 => {
        const row = pivot1[cat2] || {};
        const totalBJ = AGE_CAT3_LIST.reduce((s, a) => s + (row[`${a}_BJ`] || 0), 0);
        const totalOBJ = AGE_CAT3_LIST.reduce((s, a) => s + (row[`${a}_OBJ`] || 0), 0);
        table1[cat2] = { ...row, TOTAL_BJ: totalBJ, TOTAL_OBJ: totalOBJ, GRAND_TOTAL: totalBJ + totalOBJ, LA_TOTAL: laCounts[cat2] || 0 };
      });
      const grand1 = { TOTAL_BJ: 0, TOTAL_OBJ: 0, GRAND_TOTAL: 0, LA_TOTAL: 0 };
      AGE_CAT3_LIST.forEach(a => { grand1[`${a}_BJ`] = 0; grand1[`${a}_OBJ`] = 0; });
      Object.values(table1).forEach(row => {
        AGE_CAT3_LIST.forEach(a => { grand1[`${a}_BJ`] += row[`${a}_BJ`] || 0; grand1[`${a}_OBJ`] += row[`${a}_OBJ`] || 0; });
        grand1.TOTAL_BJ += row.TOTAL_BJ;
        grand1.TOTAL_OBJ += row.TOTAL_OBJ;
        grand1.GRAND_TOTAL += row.GRAND_TOTAL;
        grand1.LA_TOTAL += row.LA_TOTAL;
      });
      return { mode: 'bjobj', pivot: table1, grandTotal: grand1, grandLA: { LA: grand1.LA_TOTAL }, cat2Keys: Array.from(allCat2).sort() };
    }
  }, [processedData, status, side, includeLA, bjObjSplit]);

  if (!data) return <p className="text-muted">{emptyLabel}</p>;

  const { mode, pivot, grandTotal, grandLA, cat2Keys } = data;

  // ---- Drill‑down functions (pass full row objects) ----
  const showCases = (cat2, age, bjType) => {
    if (mode === 'bjobj') {
      const filters = { STATUS: status, SIDE: side, CAT2: cat2, ...(age ? { 'AGE CAT3': age } : {}) };
      const rows = filterCases(processedData, filters).filter(row => !bjType || normalizeContested(row['BJ OBJ']) === bjType);
      const label = bjType === 'CONTESTED' ? 'BJ' : bjType === 'UNCONTESTED' ? 'OBJ' : 'Grand Total';
      const statusLabel = status === 'DISPOSE' ? 'Disposed' : 'Pending';
      const sideLabel = side === 'CIVIL' ? 'Civil' : 'Criminal';
      open(`${statusLabel} ${sideLabel} - ${cat2}${age ? ` (${age})` : ''} (${label})`, rows);
    } else {
      const rows = filterCases(processedData, { STATUS: status, SIDE: side, CAT2: cat2, ...(age ? { 'AGE CAT3': age } : {}) });
      const label = status === 'DISPOSE' ? 'Disposed' : 'Pending';
      const sideLabel = side === 'CIVIL' ? 'Civil' : 'Criminal';
      open(`${label} ${sideLabel} Cases - ${cat2}${age ? ` (${age})` : ''}`, rows);
    }
  };

  const showLA = (cat2) => {
    const rows = filterCases(processedData, { STATUS: status, SIDE: side, CAT2: cat2 })
      .filter(row => isLokAdalat(row['DIS NATURE']));
    const label = status === 'DISPOSE' ? 'Disposed' : 'Pending';
    const sideLabel = side === 'CIVIL' ? 'Civil' : 'Criminal';
    open(`${label} ${sideLabel} Cases - ${cat2} (Lok Adalat)`, rows);
  };

  const getCategoryStyle = (cat2) => {
    let isRed = false;
    if (highlightSpecial) {
      isRed = isSpecialCategory(cat2);
    } else if (highlightNonSpecial) {
      isRed = !isSpecialCategory(cat2);
    }
    return isRed ? { color: 'red' } : { color: '#10B981', fontWeight: 'bold' };
  };

  // ---- Export helpers (unchanged) ----
  const buildTableData = () => {
    if (mode === 'bjobj') {
      const headers = ['Case Category'];
      AGE_CAT3_LIST.forEach(a => { headers.push(`${a}(BJ)`, `${a}(OBJ)`); });
      headers.push('TOTAL(BJ)', 'TOTAL(OBJ)', 'GRAND TOTAL');
      if (includeLA) headers.push('Disposal in L.A.');
      const rows = cat2Keys.map(cat2 => {
        const row = pivot[cat2];
        const cols = [cat2];
        AGE_CAT3_LIST.forEach(a => { cols.push(row[`${a}_BJ`] || 0, row[`${a}_OBJ`] || 0); });
        cols.push(row.TOTAL_BJ, row.TOTAL_OBJ, row.GRAND_TOTAL);
        if (includeLA) cols.push(row.LA_TOTAL || 0);
        return cols;
      });
      const grandRow = ['GRAND TOTAL'];
      AGE_CAT3_LIST.forEach(a => { grandRow.push(grandTotal[`${a}_BJ`] || 0, grandTotal[`${a}_OBJ`] || 0); });
      grandRow.push(grandTotal.TOTAL_BJ, grandTotal.TOTAL_OBJ, grandTotal.GRAND_TOTAL);
      if (includeLA) grandRow.push(grandLA.LA);
      return { headers, rows, grandRow };
    } else {
      // simple mode
      const headers = ['Case Category', ...AGE_CAT3_LIST, 'TOTAL'];
      if (includeLA) headers.push('Disposal in L.A.');
      const rows = cat2Keys.map(cat2 => {
        const row = pivot[cat2];
        const cols = [cat2];
        AGE_CAT3_LIST.forEach(a => cols.push(row[a] || 0));
        cols.push(row.TOTAL);
        if (includeLA) cols.push(row.LA || 0);
        return cols;
      });
      const grandRow = ['GRAND TOTAL'];
      AGE_CAT3_LIST.forEach(a => grandRow.push(grandTotal[a] || 0));
      grandRow.push(grandTotal.TOTAL);
      if (includeLA) grandRow.push(grandLA.LA);
      return { headers, rows, grandRow };
    }
  };

  const exportExcel = async () => {
    setBusy('excel');
    try {
      const wb = XLSX.utils.book_new();
      const { headers, rows, grandRow } = buildTableData();
      const data = [headers, ...rows, grandRow];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      const sideLabel = side === 'CIVIL' ? 'Civil' : 'Criminal';
      const statusLabel = status === 'DISPOSE' ? 'Disposed' : 'Pending';
      XLSX.writeFile(wb, `${sideLabel}-${statusLabel}-AgeBreakdown.xlsx`);
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
      const sideLabel = side === 'CIVIL' ? 'Civil' : 'Criminal';
      const statusLabel = status === 'DISPOSE' ? 'Disposed' : 'Pending';
      doc.setFontSize(14);
      doc.text(`${sideLabel} ${statusLabel} Cases – Age CAT3 Breakdown`, 14, 30);
      doc.autoTable({
        head: [headers],
        body: rows.concat([grandRow]),
        startY: 50,
        theme: 'striped',
        headStyles: { fillColor: [15, 30, 53] },
        styles: { fontSize: 8 },
        margin: { left: 10, right: 10 },
      });
      doc.save(`${sideLabel}-${statusLabel}-AgeBreakdown.pdf`);
    } catch (err) {
      alert('Failed to export PDF: ' + err.message);
    } finally {
      setBusy(null);
    }
  };

  // ---- Render ----
  return (
    <>
      {showExport && (
        <div className="d-flex justify-content-end gap-2 mb-3">
          <Button variant="success" size="sm" disabled={busy === 'excel'} onClick={exportExcel}>
            <FileEarmarkExcel className="me-1" />{busy === 'excel' ? 'Generating...' : 'Download Excel'}
          </Button>
          <Button variant="danger" size="sm" disabled={busy === 'pdf'} onClick={exportPdf}>
            <FileEarmarkPdf className="me-1" />{busy === 'pdf' ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
      )}

      <Table striped bordered hover responsive>
        <thead className="table-dark">
          {mode === 'bjobj' ? (
            <>
              <tr>
                <th rowSpan={2}>Case Category</th>
                {AGE_CAT3_LIST.map(age => (
                  <th key={age} colSpan={2} className="text-center">{age}</th>
                ))}
                <th colSpan={2} className="text-center">TOTAL</th>
                <th rowSpan={2} className="text-center">GRAND TOTAL</th>
                {includeLA && <th rowSpan={2} className="text-center">Disposal in L.A.</th>}
              </tr>
              <tr>
                {AGE_CAT3_LIST.map(age => (
                  <Fragment key={age}>
                    <th className="text-center">BJ</th>
                    <th className="text-center">OBJ</th>
                  </Fragment>
                ))}
                <th className="text-center">BJ</th>
                <th className="text-center">OBJ</th>
              </tr>
            </>
          ) : (
            <tr>
              <th>Case Category</th>
              {AGE_CAT3_LIST.map(a => <th key={a}>{a}</th>)}
              <th>TOTAL</th>
              {includeLA && <th>Disposal in L.A.</th>}
            </tr>
          )}
        </thead>
        <tbody>
          {cat2Keys.map(cat2 => {
            const row = pivot[cat2];
            const style = getCategoryStyle(cat2);
            if (mode === 'bjobj') {
              return (
                <tr key={cat2}>
                  <td style={style}>{cat2}</td>
                  {AGE_CAT3_LIST.map(age => (
                    <Fragment key={age}>
                      <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(cat2, age, 'CONTESTED')}>{row[`${age}_BJ`] || 0}</Button></td>
                      <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(cat2, age, 'UNCONTESTED')}>{row[`${age}_OBJ`] || 0}</Button></td>
                    </Fragment>
                  ))}
                  <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(cat2, null, 'CONTESTED')}><strong>{row.TOTAL_BJ}</strong></Button></td>
                  <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(cat2, null, 'UNCONTESTED')}><strong>{row.TOTAL_OBJ}</strong></Button></td>
                  <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(cat2, null, null)}><strong>{row.GRAND_TOTAL}</strong></Button></td>
                  {includeLA && (
                    <td className="text-center"><Button variant="link" size="sm" onClick={() => showLA(cat2)}>{row.LA_TOTAL || 0}</Button></td>
                  )}
                </tr>
              );
            } else {
              // simple mode
              return (
                <tr key={cat2}>
                  <td style={style}>{cat2}</td>
                  {AGE_CAT3_LIST.map(a => (
                    <td key={a} className="text-center"><Button variant="link" size="sm" onClick={() => showCases(cat2, a)}>{row[a] || 0}</Button></td>
                  ))}
                  <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(cat2, null)}><strong>{row.TOTAL}</strong></Button></td>
                  {includeLA && (
                    <td className="text-center"><Button variant="link" size="sm" onClick={() => showLA(cat2)}>{row.LA || 0}</Button></td>
                  )}
                </tr>
              );
            }
          })}
        </tbody>
        <tfoot>
          <tr className="table-secondary fw-bold">
            <td>GRAND TOTAL</td>
            {mode === 'bjobj' ? (
              <>
                {AGE_CAT3_LIST.map(age => (
                  <Fragment key={age}>
                    <td className="text-center">{grandTotal[`${age}_BJ`] || 0}</td>
                    <td className="text-center">{grandTotal[`${age}_OBJ`] || 0}</td>
                  </Fragment>
                ))}
                <td className="text-center">{grandTotal.TOTAL_BJ}</td>
                <td className="text-center">{grandTotal.TOTAL_OBJ}</td>
                <td className="text-center">{grandTotal.GRAND_TOTAL}</td>
                {includeLA && <td className="text-center">{grandLA.LA}</td>}
              </>
            ) : (
              <>
                {AGE_CAT3_LIST.map(a => <td key={a} className="text-center">{grandTotal[a]}</td>)}
                <td className="text-center">{grandTotal.TOTAL}</td>
                {includeLA && <td className="text-center">{grandLA.LA}</td>}
              </>
            )}
          </tr>
        </tfoot>
      </Table>

      <CaseListModal show={modal.show} title={modal.title} rows={modal.rows} onClose={close} />
    </>
  );
}