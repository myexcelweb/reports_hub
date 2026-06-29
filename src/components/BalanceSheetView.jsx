import { useMemo, useState } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { FileEarmarkPdf, FileEarmarkExcel } from 'react-bootstrap-icons';
import { buildBalanceSheet, downloadBalanceSheetPdf, downloadBalanceSheetExcel } from '../lib/balanceSheet';
import { normalizeRU, filterCases } from '../lib/caseFilters';

// Helper: extract the numeric part from a UID like "CMA SC/46/2024" → "46"
const extractNumberFromUID = (uid) => {
  if (!uid || typeof uid !== 'string') return '';
  const parts = uid.split('/');
  if (parts.length >= 3) {
    return parts[parts.length - 2];
  }
  return uid;
};

// Helper: extract year from UID (last 4 characters)
const extractYearFromUID = (uid) => {
  if (!uid || typeof uid !== 'string') return null;
  const year = uid.slice(-4);
  return /^\d{4}$/.test(year) ? year : null;
};

export default function BalanceSheetView({ processedData }) {
  const [viewMode, setViewMode] = useState('CIVIL');
  const [busy, setBusy] = useState(null);

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
      const year = extractYearFromUID(row.UID);
      if (!year) return;
      const ru = normalizeRU(row.RU);
      if (!ru) return;
      const uid = row.UID || '';
      grouped[cat2] ??= {};
      grouped[cat2][year] ??= { READY: [], UNREADY: [] };
      if (ru === 'READY') grouped[cat2][year].READY.push(uid);
      else grouped[cat2][year].UNREADY.push(uid);
    });

    const groupedData = {};
    let totalCases = 0;
    Object.keys(grouped).forEach(cat2 => {
      groupedData[cat2] = {};
      Object.keys(grouped[cat2]).forEach(year => {
        const readyList = grouped[cat2][year].READY.sort((a, b) => Number(a) - Number(b));
        const unreadyList = grouped[cat2][year].UNREADY.sort((a, b) => Number(a) - Number(b));
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
    if (!balance) return <p className="text-muted">No processed data available.</p>;
    currentData = balance[side];
    sideLabel = side === 'CIVIL' ? 'Civil' : 'Criminal';
    isReadyUnready = false;
  }

  if (!currentData) return <p className="text-muted">No data for this view.</p>;

  const { groupedData, totalCases } = currentData;

  // ---- Export ----
  const handleDownload = async (type) => {
    setBusy(type);
    try {
      let exportData;
      if (isReadyUnready) {
        exportData = {};
        Object.keys(groupedData).forEach(cat2 => {
          exportData[cat2] = {};
          Object.keys(groupedData[cat2]).forEach(year => {
            const { READY, UNREADY } = groupedData[cat2][year];
            exportData[cat2][year] = [...READY, ...UNREADY].sort((a, b) => Number(a) - Number(b));
          });
        });
      } else {
        exportData = groupedData;
      }

      if (type === 'pdf') {
        await downloadBalanceSheetPdf(exportData, totalCases, sideLabel);
      } else {
        await downloadBalanceSheetExcel(exportData, sideLabel);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  // ---- Render ----
  return (
    <div>
      <Form.Group className="mb-3">
        <Form.Check
          inline
          label={<span style={{ color: '#000' }}>Civil</span>}
          name="viewMode"
          type="radio"
          checked={viewMode === 'CIVIL'}
          onChange={() => setViewMode('CIVIL')}
        />
        <Form.Check
          inline
          label={<span style={{ color: '#000' }}>Criminal</span>}
          name="viewMode"
          type="radio"
          checked={viewMode === 'CRIMINAL'}
          onChange={() => setViewMode('CRIMINAL')}
        />
        <Form.Check
          inline
          label={<span style={{ color: '#000' }}>Civil (Ready‑Unready)</span>}
          name="viewMode"
          type="radio"
          checked={viewMode === 'CIVIL_RU'}
          onChange={() => setViewMode('CIVIL_RU')}
        />
      </Form.Group>

      <div className="d-flex justify-content-end gap-2 mb-3">
        <Button variant="danger" size="sm" disabled={busy === 'pdf'} onClick={() => handleDownload('pdf')}>
          <FileEarmarkPdf className="me-1" />{busy === 'pdf' ? 'Generating...' : 'Download PDF'}
        </Button>
        <Button variant="success" size="sm" disabled={busy === 'excel'} onClick={() => handleDownload('excel')}>
          <FileEarmarkExcel className="me-1" />{busy === 'excel' ? 'Generating...' : 'Download Excel'}
        </Button>
      </div>

      {totalCases === 0 ? (
        <p className="text-muted">No pending {sideLabel.toLowerCase()} cases found.</p>
      ) : (
        <Table striped bordered hover responsive size="sm">
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
                    ...yearData.READY.map(uid => ({ uid, status: 'READY' })),
                    ...yearData.UNREADY.map(uid => ({ uid, status: 'UNREADY' })),
                  ];
                  allItems.sort((a, b) => Number(a.uid) - Number(b.uid));

                  caseNumbersDisplay = allItems.map((item, index) => {
                    const num = extractNumberFromUID(item.uid);
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
                    .map(uid => extractNumberFromUID(uid))
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
                    <td>{caseNumbersDisplay}</td>
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