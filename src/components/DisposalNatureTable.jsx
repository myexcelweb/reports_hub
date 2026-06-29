import { useMemo, useState } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Alert from 'react-bootstrap/Alert';
import { FileEarmarkExcel, FileEarmarkPdf } from 'react-bootstrap-icons';
import { normalizeContested, isLokAdalat, filterCases } from '../lib/caseFilters';
import { useDrillDown } from '../hooks/useDrillDown';
import CaseListModal from './common/CaseListModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Disposed cases split by Contested / Uncontested(Regular) / Uncontested(Lok Adalat).
export default function DisposalNatureTable({ processedData }) {
  const { modal, open, close } = useDrillDown();
  const [busy, setBusy] = useState(null);

  const report = useMemo(() => {
    if (!processedData) return null;
    const counts = {};
    for (const row of processedData) {
      if (row.STATUS !== 'DISPOSE') continue;
      const cat2 = row.CAT2 || 'Unknown';
      counts[cat2] ??= { contestedCivil: 0, uncontestedRCivil: 0, uncontestedLACivil: 0, contestedCriminal: 0, uncontestedRCriminal: 0, uncontestedLACriminal: 0 };
      const contested = normalizeContested(row['BJ OBJ']) === 'CONTESTED';
      const lokAdalat = isLokAdalat(row);
      const suffix = row.SIDE === 'CIVIL' ? 'Civil' : row.SIDE === 'CRIMINAL' ? 'Criminal' : null;
      if (!suffix) continue;
      if (contested) counts[cat2][`contested${suffix}`]++;
      else counts[cat2][`uncontested${lokAdalat ? 'LA' : 'R'}${suffix}`]++;
    }

    const buildSide = (suffix) => {
      const rows = Object.entries(counts)
        .map(([cat2, c]) => ({
          cat2,
          contested: c[`contested${suffix}`],
          uncontestedR: c[`uncontestedR${suffix}`],
          uncontestedLA: c[`uncontestedLA${suffix}`],
          total: c[`contested${suffix}`] + c[`uncontestedR${suffix}`] + c[`uncontestedLA${suffix}`],
        }))
        .filter(r => r.total > 0)
        .sort((a, b) => a.cat2.localeCompare(b.cat2));
      const totals = rows.reduce((acc, r) => ({
        contested: acc.contested + r.contested,
        uncontestedR: acc.uncontestedR + r.uncontestedR,
        uncontestedLA: acc.uncontestedLA + r.uncontestedLA,
        total: acc.total + r.total,
      }), { contested: 0, uncontestedR: 0, uncontestedLA: 0, total: 0 });
      return { rows, totals };
    };

    return { civil: buildSide('Civil'), criminal: buildSide('Criminal') };
  }, [processedData]);

  if (!report) return null;

  // ---- Drill‑down (pass full rows) ----
  const showCases = (side, cat2, contestedFilter, detail) => {
    const rows = (processedData || []).filter(row => {
      if (row.SIDE !== side.toUpperCase() || row.STATUS !== 'DISPOSE') return false;
      if (cat2 && row.CAT2 !== cat2) return false;
      if (!contestedFilter) return true;
      const isContested = normalizeContested(row['BJ OBJ']) === 'CONTESTED';
      if (contestedFilter === 'Contested') return isContested;
      if (isContested) return false;
      if (!detail) return true;
      return detail === 'Lok Adalat' ? isLokAdalat(row) : !isLokAdalat(row);
    });
    const detailLabel = contestedFilter === 'Uncontested' && detail ? `(${detail}) ` : '';
    const title = `${contestedFilter ? `${contestedFilter} ` : ''}${detailLabel}${side} Disposed Cases ${cat2 ? `for Category: ${cat2}` : '(All Categories)'}`;
    open(title, rows);
  };

  // ---- Export helpers ----
  const buildTableData = (data, title) => {
    const headers = ['Case Category', 'BJ', 'OBJ', 'OBJ(LA)', 'Total'];
    const rows = data.rows.map(r => [r.cat2, r.contested, r.uncontestedR, r.uncontestedLA, r.total]);
    const grandRow = ['Total', data.totals.contested, data.totals.uncontestedR, data.totals.uncontestedLA, data.totals.total];
    return { headers, rows, grandRow };
  };

  const exportExcel = async () => {
    setBusy('excel');
    try {
      const wb = XLSX.utils.book_new();

      const civil = buildTableData(report.civil);
      const civilData = [civil.headers, ...civil.rows, civil.grandRow];
      const wsCivil = XLSX.utils.aoa_to_sheet(civilData);
      XLSX.utils.book_append_sheet(wb, wsCivil, 'Civil (Disposed)');

      const criminal = buildTableData(report.criminal);
      const criminalData = [criminal.headers, ...criminal.rows, criminal.grandRow];
      const wsCriminal = XLSX.utils.aoa_to_sheet(criminalData);
      XLSX.utils.book_append_sheet(wb, wsCriminal, 'Criminal (Disposed)');

      XLSX.writeFile(wb, `Disposal-Nature-Analysis.xlsx`);
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
          styles: { fontSize: 10 },
          margin: { left: 10, right: 10 },
        });
      };

      addTable(buildTableData(report.civil), 'Civil (Disposed) – Nature Breakdown');
      doc.addPage();
      addTable(buildTableData(report.criminal), 'Criminal (Disposed) – Nature Breakdown');
      doc.save('Disposal-Nature-Analysis.pdf');
    } catch (err) {
      alert('Failed to export PDF: ' + err.message);
    } finally {
      setBusy(null);
    }
  };

  // ---- Render ----
  const SideTable = ({ title, side, data }) => {
    if (data.rows.length === 0) {
      return (<><h5 className="text-center">{title}</h5><Alert variant="secondary" className="text-center">No disposed cases to report.</Alert></>);
    }
    return (
      <div>
        <h5 className="text-center">{title}</h5>
        <Table striped bordered hover responsive size="sm">
          <thead className="table-dark">
            <tr><th>Case Category</th><th className="text-center">BJ</th><th className="text-center">OBJ</th><th className="text-center">OBJ(LA)</th><th className="text-center">Total</th></tr>
          </thead>
          <tbody>
            {data.rows.map(({ cat2, contested, uncontestedR, uncontestedLA, total }) => (
              <tr key={cat2}>
                <td>{cat2}</td>
                <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(side, cat2, 'Contested')}>{contested}</Button></td>
                <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(side, cat2, 'Uncontested', 'Regular')}>{uncontestedR}</Button></td>
                <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(side, cat2, 'Uncontested', 'Lok Adalat')}>{uncontestedLA}</Button></td>
                <td className="text-center fw-bold"><Button variant="link" size="sm" onClick={() => showCases(side, cat2, null)}>{total}</Button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="table-secondary fw-bold">
              <td>Total</td>
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(side, null, 'Contested')}>{data.totals.contested}</Button></td>
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(side, null, 'Uncontested', 'Regular')}>{data.totals.uncontestedR}</Button></td>
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(side, null, 'Uncontested', 'Lok Adalat')}>{data.totals.uncontestedLA}</Button></td>
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(side, null, null)}>{data.totals.total}</Button></td>
            </tr>
          </tfoot>
        </Table>
      </div>
    );
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

      <Row>
        <Col md={6} className="mb-4"><SideTable title="Civil (Disposed)" side="Civil" data={report.civil} /></Col>
        <Col md={6} className="mb-4"><SideTable title="Criminal (Disposed)" side="Criminal" data={report.criminal} /></Col>
      </Row>

      <CaseListModal show={modal.show} title={modal.title} rows={modal.rows} onClose={close} />
    </>
  );
}