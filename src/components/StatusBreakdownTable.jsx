import { useMemo, useState } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { FileEarmarkExcel, FileEarmarkPdf } from 'react-bootstrap-icons';
import { filterCases } from '../lib/caseFilters';
import { useDrillDown } from '../hooks/useDrillDown';
import CaseListModal from './common/CaseListModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Pending vs Disposed, broken down by case category, split Civil / Criminal.
export default function StatusBreakdownTable({ processedData }) {
  const { modal, open, close } = useDrillDown();
  const [busy, setBusy] = useState(null);

  const report = useMemo(() => {
    if (!processedData) return null;
    const counts = {};
    for (const row of processedData) {
      const cat2 = row.CAT2 || 'Unknown';
      counts[cat2] ??= { pendingCivil: 0, disposedCivil: 0, pendingCriminal: 0, disposedCriminal: 0 };
      const bucket = row.SIDE === 'CIVIL' ? counts[cat2] : row.SIDE === 'CRIMINAL' ? counts[cat2] : null;
      if (!bucket) continue;
      const pendingKey = row.SIDE === 'CIVIL' ? 'pendingCivil' : 'pendingCriminal';
      const disposedKey = row.SIDE === 'CIVIL' ? 'disposedCivil' : 'disposedCriminal';
      if (row.STATUS === 'PENDING') bucket[pendingKey]++;
      else if (row.STATUS === 'DISPOSE') bucket[disposedKey]++;
    }

    const buildSide = (pendingKey, disposedKey) => {
      const rows = Object.entries(counts)
        .map(([cat2, c]) => ({ cat2, pending: c[pendingKey], disposed: c[disposedKey] }))
        .filter(r => r.pending > 0 || r.disposed > 0)
        .sort((a, b) => a.cat2.localeCompare(b.cat2));
      const totals = rows.reduce((acc, r) => ({ pending: acc.pending + r.pending, disposed: acc.disposed + r.disposed }), { pending: 0, disposed: 0 });
      return { rows, totals };
    };

    return { civil: buildSide('pendingCivil', 'disposedCivil'), criminal: buildSide('pendingCriminal', 'disposedCriminal') };
  }, [processedData]);

  if (!report) return null;

  // ---- Drill‑down (pass full rows) ----
  const showCases = (side, cat2, status) => {
    const rows = filterCases(processedData, { SIDE: side.toUpperCase(), STATUS: status.toUpperCase(), ...(cat2 ? { CAT2: cat2 } : {}) });
    open(`${status} ${side} Cases ${cat2 ? `for Category: ${cat2}` : '(All Categories)'}`, rows);
  };

  // ---- Export helpers ----
  const buildTableData = (sideData, title) => {
    const headers = ['Case Category', 'Pending', 'Disposed'];
    const rows = sideData.rows.map(r => [r.cat2, r.pending, r.disposed]);
    const grandRow = ['Total', sideData.totals.pending, sideData.totals.disposed];
    return { headers, rows, grandRow };
  };

  const exportExcel = async () => {
    setBusy('excel');
    try {
      const wb = XLSX.utils.book_new();

      const civil = buildTableData(report.civil);
      const civilData = [civil.headers, ...civil.rows, civil.grandRow];
      const wsCivil = XLSX.utils.aoa_to_sheet(civilData);
      XLSX.utils.book_append_sheet(wb, wsCivil, 'Civil');

      const criminal = buildTableData(report.criminal);
      const criminalData = [criminal.headers, ...criminal.rows, criminal.grandRow];
      const wsCriminal = XLSX.utils.aoa_to_sheet(criminalData);
      XLSX.utils.book_append_sheet(wb, wsCriminal, 'Criminal');

      XLSX.writeFile(wb, `Status-Analysis.xlsx`);
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

      addTable(buildTableData(report.civil), 'Civil Cases – Status');
      doc.addPage();
      addTable(buildTableData(report.criminal), 'Criminal Cases – Status');
      doc.save('Status-Analysis.pdf');
    } catch (err) {
      alert('Failed to export PDF: ' + err.message);
    } finally {
      setBusy(null);
    }
  };

  // ---- Render ----
  const SideTable = ({ title, side, data }) => (
    <div>
      <h5 className="text-center">{title}</h5>
      <Table striped bordered hover responsive size="sm">
        <thead className="table-dark">
          <tr><th>Case Category</th><th className="text-center">Pending</th><th className="text-center">Disposed</th></tr>
        </thead>
        <tbody>
          {data.rows.map(({ cat2, pending, disposed }) => (
            <tr key={cat2}>
              <td>{cat2}</td>
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(side, cat2, 'Pending')}>{pending}</Button></td>
              <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(side, cat2, 'Dispose')}>{disposed}</Button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="table-secondary fw-bold">
            <td>Total</td>
            <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(side, null, 'Pending')}>{data.totals.pending}</Button></td>
            <td className="text-center"><Button variant="link" size="sm" onClick={() => showCases(side, null, 'Dispose')}>{data.totals.disposed}</Button></td>
          </tr>
        </tfoot>
      </Table>
    </div>
  );

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
        <Col md={6} className="mb-4"><SideTable title="Civil Cases" side="Civil" data={report.civil} /></Col>
        <Col md={6} className="mb-4"><SideTable title="Criminal Cases" side="Criminal" data={report.criminal} /></Col>
      </Row>

      <CaseListModal show={modal.show} title={modal.title} rows={modal.rows} onClose={close} />
    </>
  );
}