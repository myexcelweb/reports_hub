import { useId, useMemo, useState } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { FileEarmarkPdf, FileEarmarkExcel } from 'react-bootstrap-icons';
import { buildBalanceSheet } from '../lib/balanceSheet';
import { useReportExport } from '../hooks/useReportExport';
import { normalizeRU, filterCases } from '../lib/caseFilters';

// Helper: extract the numeric part from a Case No like "CMA SC/46/2024" → "46"
const extractNumberFromCaseNo = (caseNo) => {
  if (!caseNo || typeof caseNo !== 'string') return '';
  const parts = caseNo.split('/');
  if (parts.length >= 3) {
    return parts[parts.length - 2];
  }
  return caseNo;
};

// Helper: extract year from Case No or CNR
const extractYearFromCase = (caseNo, cnr) => {
  if (caseNo && typeof caseNo === 'string') {
    const parts = caseNo.split('/');
    if (parts.length >= 3) {
      const y = parts[parts.length - 1];
      if (/^\d{4}$/.test(y)) return y;
    }
  }
  if (cnr && typeof cnr === 'string' && cnr.length >= 4) {
    const y = cnr.slice(-4);
    if (/^\d{4}$/.test(y)) return y;
  }
  return null;
};

const VIEW_LABELS = { CIVIL: 'Civil', CRIMINAL: 'Criminal', CIVIL_RU: 'Civil (Ready/Unready)' };

// Sort full case numbers ("CC/12/2024") by their numeric part.
const byCaseNumber = (a, b) => Number(extractNumberFromCaseNo(a)) - Number(extractNumberFromCaseNo(b));

export default function BalanceSheetView({ processedData, initialView = 'CIVIL' }) {
  const [viewMode, setViewMode] = useState(initialView);
  // Unique radio-group name: several copies of this view can be on the page
  // at once (the "all reports" export renders them off-screen).
  const radioName = `viewMode-${useId()}`;
  const { ref: exportRef, busy, exportExcel, exportPdf } = useReportExport({
    reportTitle: `${VIEW_LABELS[viewMode]} Balance Sheet — Pending Cases`,
    fileBase: `${VIEW_LABELS[viewMode].replace(/[^A-Za-z]+/g, '-').replace(/-$/, '')}-Balance-Sheet`,
  });

  // ---- Normal balance sheets (Civil / Criminal) ----
  const balance = useMemo(() => {
    if (!processedData) return null;
    return {
      CIVIL: buildBalanceSheet(processedData, 'CIVIL'),
      CRIMINAL: buildBalanceSheet(processedData, 'CRIMINAL'),
    };
  }, [processedData]);

  // ---- Ready/Unready balance sheet (Civil only) ----
  const readyUnreadyData = useMemo(() => {
    if (!processedData) return null;
    const pendingCivil = filterCases(processedData, { STATUS: 'PENDING', SIDE: 'CIVIL' });
    if (pendingCivil.length === 0) return null;

    const grouped = {};
    pendingCivil.forEach(row => {
      const cat2 = row.CAT2 || 'UNKNOWN';
      const year = extractYearFromCase(row['CASE NO'], row.CNR);
      if (!year) return;
      const ru = normalizeRU(row.RU);
      if (!ru) return;
      const caseNo = row['CASE NO'] || row.CNR || '';
      grouped[cat2] ??= {};
      grouped[cat2][year] ??= { READY: [], UNREADY: [] };
      if (ru === 'READY') grouped[cat2][year].READY.push(caseNo);
      else grouped[cat2][year].UNREADY.push(caseNo);
    });

    const groupedData = {};
    let totalCases = 0;
    Object.keys(grouped).forEach(cat2 => {
      groupedData[cat2] = {};
      Object.keys(grouped[cat2]).forEach(year => {
        const readyList = grouped[cat2][year].READY.sort(byCaseNumber);
        const unreadyList = grouped[cat2][year].UNREADY.sort(byCaseNumber);
        groupedData[cat2][year] = { READY: readyList, UNREADY: unreadyList };
        totalCases += readyList.length + unreadyList.length;
      });
    });
    return { groupedData, totalCases };
  }, [processedData]);

  // ---- Select current data ----
  let currentData = null;
  let sideLabel = '';
  let isReadyUnready = false;

  if (viewMode === 'CIVIL_RU') {
    currentData = readyUnreadyData;
    sideLabel = 'Civil (Ready/Unready)';
    isReadyUnready = true;
  } else {
    const side = viewMode;
    currentData = balance ? balance[side] : null;
    sideLabel = side === 'CIVIL' ? 'Civil' : 'Criminal';
    isReadyUnready = false;
  }

  // An empty view still renders the view buttons so the user can switch back.
  const { groupedData, totalCases } = currentData || { groupedData: {}, totalCases: 0 };

  // ---- Render ----
  return (
    <div ref={exportRef}>
      <Form.Group className="mb-3">
        <Form.Check
          inline
          label={<span style={{ color: '#000' }}>Civil</span>}
          name={radioName}
          type="radio"
          checked={viewMode === 'CIVIL'}
          onChange={() => setViewMode('CIVIL')}
        />
        <Form.Check
          inline
          label={<span style={{ color: '#000' }}>Criminal</span>}
          name={radioName}
          type="radio"
          checked={viewMode === 'CRIMINAL'}
          onChange={() => setViewMode('CRIMINAL')}
        />
        <Form.Check
          inline
          label={<span style={{ color: '#000' }}>Civil (Ready‑Unready)</span>}
          name={radioName}
          type="radio"
          checked={viewMode === 'CIVIL_RU'}
          onChange={() => setViewMode('CIVIL_RU')}
        />
      </Form.Group>

      <div className="d-flex justify-content-end gap-2 mb-3">
        <Button variant="danger" size="sm" disabled={busy === 'pdf' || totalCases === 0} onClick={exportPdf}>
          <FileEarmarkPdf className="me-1" />{busy === 'pdf' ? 'Generating...' : 'Download PDF'}
        </Button>
        <Button variant="success" size="sm" disabled={busy === 'excel' || totalCases === 0} onClick={exportExcel}>
          <FileEarmarkExcel className="me-1" />{busy === 'excel' ? 'Generating...' : 'Download Excel'}
        </Button>
      </div>

      {totalCases === 0 ? (
        <p className="text-muted">No pending {sideLabel.toLowerCase()} cases found.</p>
      ) : (
        <Table striped bordered hover responsive size="sm"
          data-export-title={`${sideLabel} Balance Sheet — Total Pending Cases: ${totalCases}`}
          data-export-sheet={sideLabel}>
          <thead className="table-dark">
            <tr>
              <th style={{ width: '30%', minWidth: '180px' }}>Category</th>
              <th style={{ width: '15%' }}>Year</th>
              <th>Case Numbers</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(groupedData).sort().map(category => {
              const years = Object.keys(groupedData[category]).sort((a, b) => Number(a) - Number(b));
              return years.map((year, idx) => {
                const yearData = groupedData[category][year];
                let yearLabel = year;
                let caseNumbersDisplay;

                if (isReadyUnready) {
                  const readyCount = yearData.READY.length;
                  const unreadyCount = yearData.UNREADY.length;
                  yearLabel = `${year}(${readyCount}R+${unreadyCount}U=${readyCount + unreadyCount})`;

                  const allItems = [
                    ...yearData.READY.map(cn => ({ uid: cn, status: 'READY' })),
                    ...yearData.UNREADY.map(cn => ({ uid: cn, status: 'UNREADY' })),
                  ];
                  allItems.sort((a, b) => byCaseNumber(a.uid, b.uid));

                  caseNumbersDisplay = allItems.map((item, index) => {
                    const num = extractNumberFromCaseNo(item.uid);
                    const color = item.status === 'READY' ? '#10B981' : 'red';
                    return (
                      <span key={index} style={{ color, fontWeight: 'bold' }}>
                        {num}
                        {index < allItems.length - 1 && ', '}
                      </span>
                    );
                  });
                } else {
                  const count = yearData.length;
                  yearLabel = `${year}(${count})`;
                  const sorted = yearData
                    .map(cn => extractNumberFromCaseNo(cn))
                    .sort((a, b) => Number(a) - Number(b));
                  caseNumbersDisplay = sorted.map((num, index) => (
                    <span key={index}>
                      {num}
                      {index < sorted.length - 1 && ', '}
                    </span>
                  ));
                }

                return (
                  <tr key={`${category}-${year}`}>
                    {idx === 0 && (
                      <td
                        rowSpan={years.length}
                        style={{
                          wordWrap: 'break-word',
                          maxWidth: '200px',
                          whiteSpace: 'normal',
                        }}
                      >
                        {category}
                      </td>
                    )}
                    <td>{yearLabel}</td>
                    <td className="text-start">{caseNumbersDisplay}</td>
                  </tr>
                );
              });
            })}
          </tbody>
        </Table>
      )}
      <p className="text-muted small">{sideLabel} pending cases: {totalCases}</p>
    </div>
  );
}