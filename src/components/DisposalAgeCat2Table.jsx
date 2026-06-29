import { Fragment, useMemo, useState } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import { FileEarmarkExcel, FileEarmarkPdf } from 'react-bootstrap-icons';
import { AGE_CAT2_LIST, normalizeContested, filterCases } from '../lib/caseFilters';
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

export default function DisposalAgeCat2Table({ processedData }) {
  const { modal, open, close } = useDrillDown();
  const [busy, setBusy] = useState(null);

  const data = useMemo(() => {
    const disposedCivil = filterCases(processedData, { STATUS: 'DISPOSE', SIDE: 'CIVIL' });
    if (disposedCivil.length === 0) return null;

    const allCat2 = new Set();
    const pivot1 = {};
    const laCounts = {};

    disposedCivil.forEach(row => {
      const cat2 = row.CAT2 || 'UNKNOWN';
      allCat2.add(cat2);
      const age = row['AGE CAT2'] || 'UNKNOWN';
      if (!AGE_CAT2_LIST.includes(age)) return;
      const key = `${age}_${normalizeContested(row['BJ OBJ']) === 'CONTESTED' ? 'BJ' : 'OBJ'}`;
      pivot1[cat2] ??= {};
      pivot1[cat2][key] = (pivot1[cat2][key] || 0) + 1;
      if (isLokAdalat(row['DIS NATURE'])) {
        laCounts[cat2] = (laCounts[cat2] || 0) + 1;
      }
    });

    const table1 = {};
    allCat2.forEach(cat2 => {
      const row = pivot1[cat2] || {};
      const totalBJ = AGE_CAT2_LIST.reduce((s, a) => s + (row[`${a}_BJ`] || 0), 0);
      const totalOBJ = AGE_CAT2_LIST.reduce((s, a) => s + (row[`${a}_OBJ`] || 0), 0);
      table1[cat2] = { ...row, TOTAL_BJ: totalBJ, TOTAL_OBJ: totalOBJ, GRAND_TOTAL: totalBJ + totalOBJ, LA_TOTAL: laCounts[cat2] || 0 };
    });

    const grand1 = { TOTAL_BJ: 0, TOTAL_OBJ: 0, GRAND_TOTAL: 0, LA_TOTAL: 0 };
    AGE_CAT2_LIST.forEach(a => { grand1[`${a}_BJ`] = 0; grand1[`${a}_OBJ`] = 0; });
    Object.values(table1).forEach(row => {
      AGE_CAT2_LIST.forEach(a => { grand1[`${a}_BJ`] += row[`${a}_BJ`] || 0; grand1[`${a}_OBJ`] += row[`${a}_OBJ`] || 0; });
      grand1.TOTAL_BJ += row.TOTAL_BJ;
      grand1.TOTAL_OBJ += row.TOTAL_OBJ;
      grand1.GRAND_TOTAL += row.GRAND_TOTAL;
      grand1.LA_TOTAL += row.LA_TOTAL;
    });

    // Second table (DIS NATURE breakdown) unchanged
    const uncontested = disposedCivil.filter(row => normalizeContested(row['BJ OBJ']) === 'UNCONTESTED');
    const pivot2 = {};
    const allNatures = new Set();
    uncontested.forEach(row => {
      const cat2 = row.CAT2 || 'UNKNOWN';
      const nature = String(row['DIS NATURE'] || 'UNKNOWN').trim();
      allNatures.add(nature);
      pivot2[cat2] ??= {};
      pivot2[cat2][nature] = (pivot2[cat2][nature] || 0) + 1;
    });
    const sortedNatures = Array.from(allNatures).sort();

    const table2 = {};
    const grand2 = Object.fromEntries([...sortedNatures.map(n => [n, 0]), ['TOTAL', 0]]);
    allCat2.forEach(cat2 => {
      const row = pivot2[cat2] || {};
      const total = sortedNatures.reduce((s, n) => s + (row[n] || 0), 0);
      table2[cat2] = { ...row, TOTAL: total };
      sortedNatures.forEach(n => { grand2[n] += row[n] || 0; });
      grand2.TOTAL += total;
    });

    return { table1, grand1, sortedNatures, table2, grand2, allCat2: Array.from(allCat2).sort() };
  }, [processedData]);

  if (!data) return <p className="text-muted">No disposed civil cases found.</p>;

  const { table1, grand1, sortedNatures, table2, grand2, allCat2 } = data;

  // ---- Drill‑down functions (pass full row objects) ----
  const showBjObj = (cat2, age, bjType) => {
    const filters = { STATUS: 'DISPOSE', SIDE: 'CIVIL', CAT2: cat2, ...(age ? { 'AGE CAT2': age } : {}) };
    const rows = filterCases(processedData, filters).filter(row => !bjType || normalizeContested(row['BJ OBJ']) === bjType);
    const label = bjType === 'CONTESTED' ? 'BJ' : bjType === 'UNCONTESTED' ? 'OBJ' : 'Grand Total';
    open(`Disposed Civil - ${cat2}${age ? ` (${age})` : ''} (${label})`, rows);
  };

  const showLa = (cat2) => {
    const rows = filterCases(processedData, { STATUS: 'DISPOSE', SIDE: 'CIVIL', CAT2: cat2 })
      .filter(row => isLokAdalat(row['DIS NATURE']));
    open(`Disposed Civil - ${cat2} (Lok Adalat)`, rows);
  };

  const showNature = (cat2, nature) => {
    const filters = { STATUS: 'DISPOSE', SIDE: 'CIVIL', CAT2: cat2, ...(nature ? { 'DIS NATURE': nature } : {}) };
    const rows = filterCases(processedData, filters).filter(row => normalizeContested(row['BJ OBJ']) === 'UNCONTESTED');
    open(`Uncontested Disposed Civil - ${cat2} (${nature || 'All Disposal Natures'})`, rows);
  };

  const getCategoryStyle = (cat2) => {
    const isSpecial = isSpecialCategory(cat2);
    return isSpecial ? { color: 'red' } : { color: '#10B981', fontWeight: 'bold' };
  };

  // ---- Export helpers (unchanged) ----
  const buildTable1Data = () => {
    const headers = ['Case Category'];
    AGE_CAT2_LIST.forEach(a => { headers.push(`${a}(BJ)`, `${a}(OBJ)`); });
    headers.push('TOTAL(BJ)', 'TOTAL(OBJ)', 'GRAND TOTAL', 'Disposal in L.A.');
    const rows = allCat2.map(cat2 => {
      const row = table1[cat2];
      const cols = [cat2];
      AGE_CAT2_LIST.forEach(a => { cols.push(row[`${a}_BJ`] || 0, row[`${a}_OBJ`] || 0); });
      cols.push(row.TOTAL_BJ, row.TOTAL_OBJ, row.GRAND_TOTAL, row.LA_TOTAL);
      return cols;
    });
    const grandRow = ['GRAND TOTAL'];
    AGE_CAT2_LIST.forEach(a => { grandRow.push(grand1[`${a}_BJ`] || 0, grand1[`${a}_OBJ`] || 0); });
    grandRow.push(grand1.TOTAL_BJ, grand1.TOTAL_OBJ, grand1.GRAND_TOTAL, grand1.LA_TOTAL);
    return { headers, rows, grandRow };
  };

  const buildTable2Data = () => {
    const headers = ['Case Category', ...sortedNatures, 'TOTAL'];
    const rows = allCat2.map(cat2 => {
      const row = table2[cat2];
      const cols = [cat2];
      sortedNatures.forEach(n => cols.push(row[n] || 0));
      cols.push(row.TOTAL);
      return cols;
    });
    const grandRow = ['GRAND TOTAL'];
    sortedNatures.forEach(n => grandRow.push(grand2[n] || 0));
    grandRow.push(grand2.TOTAL);
    return { headers, rows, grandRow };
  };

  const exportExcel = async () => {
    setBusy('excel');
    try {
      const wb = XLSX.utils.book_new();
      const t1 = buildTable1Data();
      const data1 = [t1.headers, ...t1.rows, t1.grandRow];
      const ws1 = XLSX.utils.aoa_to_sheet(data1);
      XLSX.utils.book_append_sheet(wb, ws1, 'BJ-OBJ Split');
      const t2 = buildTable2Data();
      const data2 = [t2.headers, ...t2.rows, t2.grandRow];
      const ws2 = XLSX.utils.aoa_to_sheet(data2);
      XLSX.utils.book_append_sheet(wb, ws2, 'Disposal Nature');
      XLSX.writeFile(wb, 'PART1-Disposed-Civil-AgeCAT2.xlsx');
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
      addTable(buildTable1Data(), 'Disposed Civil – BJ/OBJ Split (Age CAT2)');
      doc.addPage();
      addTable(buildTable2Data(), 'Disposed Civil – DIS NATURE Breakdown (Uncontested / OBJ only)');
      doc.save('PART1-Disposed-Civil-AgeCAT2.pdf');
    } catch (err) {
      alert('Failed to export PDF: ' + err.message);
    } finally {
      setBusy(null);
    }
  };

  // ---- Render ----
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

      {/* Table 1: BJ/OBJ split */}
      <div className="mb-4">
        <Table striped bordered hover responsive>
          <thead className="table-dark">
            <tr>
              <th rowSpan={2}>Case Category</th>
              {AGE_CAT2_LIST.map(age => (
                <th key={age} colSpan={2} className="text-center">{age}</th>
              ))}
              <th colSpan={2} className="text-center">TOTAL</th>
              <th rowSpan={2} className="text-center">GRAND TOTAL</th>
              <th rowSpan={2} className="text-center">Disposal in L.A.</th>
            </tr>
            <tr>
              {AGE_CAT2_LIST.map(age => (
                <Fragment key={age}>
                  <th className="text-center">BJ</th>
                  <th className="text-center">OBJ</th>
                </Fragment>
              ))}
              <th className="text-center">BJ</th>
              <th className="text-center">OBJ</th>
            </tr>
          </thead>
          <tbody>
            {allCat2.map(cat2 => {
              const row = table1[cat2];
              const style = getCategoryStyle(cat2);
              return (
                <tr key={cat2}>
                  <td style={style}>{cat2}</td>
                  {AGE_CAT2_LIST.map(age => (
                    <Fragment key={age}>
                      <td className="text-center"><Button variant="link" size="sm" onClick={() => showBjObj(cat2, age, 'CONTESTED')}>{row[`${age}_BJ`] || 0}</Button></td>
                      <td className="text-center"><Button variant="link" size="sm" onClick={() => showBjObj(cat2, age, 'UNCONTESTED')}>{row[`${age}_OBJ`] || 0}</Button></td>
                    </Fragment>
                  ))}
                  <td className="text-center"><Button variant="link" size="sm" onClick={() => showBjObj(cat2, null, 'CONTESTED')}><strong>{row.TOTAL_BJ}</strong></Button></td>
                  <td className="text-center"><Button variant="link" size="sm" onClick={() => showBjObj(cat2, null, 'UNCONTESTED')}><strong>{row.TOTAL_OBJ}</strong></Button></td>
                  <td className="text-center"><Button variant="link" size="sm" onClick={() => showBjObj(cat2, null, null)}><strong>{row.GRAND_TOTAL}</strong></Button></td>
                  <td className="text-center"><Button variant="link" size="sm" onClick={() => showLa(cat2)}>{row.LA_TOTAL || 0}</Button></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="table-secondary fw-bold">
              <td>GRAND TOTAL</td>
              {AGE_CAT2_LIST.map(age => (
                <Fragment key={age}>
                  <td className="text-center">{grand1[`${age}_BJ`]}</td>
                  <td className="text-center">{grand1[`${age}_OBJ`]}</td>
                </Fragment>
              ))}
              <td className="text-center">{grand1.TOTAL_BJ}</td>
              <td className="text-center">{grand1.TOTAL_OBJ}</td>
              <td className="text-center">{grand1.GRAND_TOTAL}</td>
              <td className="text-center">{grand1.LA_TOTAL}</td>
            </tr>
          </tfoot>
        </Table>
      </div>

      {/* Table 2: DIS NATURE breakdown */}
      <div>
        <h6>Disposed Civil – DIS NATURE Breakdown (Uncontested / OBJ only)</h6>
        <Table striped bordered hover responsive>
          <thead className="table-dark">
            <tr><th>Case Category</th>{sortedNatures.map(n => <th key={n}>{n}</th>)}<th>TOTAL</th></tr>
          </thead>
          <tbody>
            {allCat2.map(cat2 => {
              const row = table2[cat2];
              const style = getCategoryStyle(cat2);
              return (
                <tr key={cat2}>
                  <td style={style}>{cat2}</td>
                  {sortedNatures.map(n => (
                    <td key={n} className="text-center"><Button variant="link" size="sm" onClick={() => showNature(cat2, n)}>{row[n] || 0}</Button></td>
                  ))}
                  <td className="text-center"><Button variant="link" size="sm" onClick={() => showNature(cat2, null)}><strong>{row.TOTAL}</strong></Button></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="table-secondary fw-bold">
              <td>GRAND TOTAL</td>
              {sortedNatures.map(n => <td key={n} className="text-center">{grand2[n]}</td>)}
              <td className="text-center">{grand2.TOTAL}</td>
            </tr>
          </tfoot>
        </Table>
      </div>

      <CaseListModal show={modal.show} title={modal.title} rows={modal.rows} onClose={close} />
    </>
  );
}