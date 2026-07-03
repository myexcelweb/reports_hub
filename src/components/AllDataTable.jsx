import { useState, useMemo, useRef, useEffect } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import { FileEarmarkExcel, FileEarmarkPdf, ArrowsFullscreen, FullscreenExit } from 'react-bootstrap-icons';
import { exportRowsToExcel, exportRowsToPdf, timestamp } from '../lib/exportFile';

// ---- FIX: internal bookkeeping fields written by lib/dateFilter.js ----
// When a case was DISPOSED after the "TO / AS ON" date, applyDateFilter()
// correctly reclassifies it back to STATUS: 'PENDING' (per the C# business
// rule) — but it stamps 3 debug fields onto that row: IsStillPendingFromDisposed,
// NextDate, Purpose. Every other report only reads STATUS/SIDE/CAT2, so those
// fields are invisible there and the numbers "look" fine. AllDataTable is the
// only report that dumps every raw key as a column, so it was the only place
// these leaked out as junk columns — AND the only place you'd see the
// original 'DATE OF DIS' sitting after your TO date on a row now marked
// PENDING, which reads as "the date filter didn't apply" even though it did.
// We hide the raw debug fields from the generic column list and instead
// surface a single, clearly-labeled "FILTER NOTE" column that explains why
// that row looks the way it does.
const META_FIELDS = ['IsStillPendingFromDisposed', 'NextDate', 'Purpose'];

export default function AllDataTable({ processedData }) {
  const [busy, setBusy] = useState(null); // 'excel' | 'pdf' | null
  const [searchTerms, setSearchTerms] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportMode, setExportMode] = useState('filtered'); // 'filtered' | 'all'
  const containerRef = useRef(null);

  if (!processedData || processedData.length === 0) {
    return <p className="text-muted text-center">No processed data to display.</p>;
  }

  // ---- FIX: build column list from the UNION of keys across ALL rows ----
  // Previously this used `Object.keys(processedData[0] || {})`, which only
  // looked at the first row. After the date filter runs, rows are reordered
  // as `[...pending, ...disposed]` and some rows (e.g. cases moved back to
  // "pending" because they were decided after the AS ON DATE) carry extra
  // fields while others may not carry every field. If a row that happens to
  // be missing a given key (e.g. 'DATE OF DIS') lands at index 0, that
  // column disappeared from the whole "All Data" report even though other
  // rows had data for it. Scanning every row prevents any column from being
  // dropped, regardless of row order.
  // ---- FIX 2: exclude internal META_FIELDS from the raw dump (see above) ----
  const { columns, hasMovedRows } = useMemo(() => {
    const seen = new Set();
    const cols = [];
    let moved = false;
    processedData.forEach(row => {
      if (row?.IsStillPendingFromDisposed) moved = true;
      Object.keys(row || {}).forEach(key => {
        if (META_FIELDS.includes(key)) return;
        if (!seen.has(key)) {
          seen.add(key);
          cols.push(key);
        }
      });
    });
    return { columns: cols, hasMovedRows: moved };
  }, [processedData]);

  // Only add the "FILTER NOTE" column when it's actually relevant, so the
  // table doesn't grow an extra empty column when no date filter was used.
  const displayColumns = useMemo(
    () => (hasMovedRows ? [...columns, 'FILTER NOTE'] : columns),
    [columns, hasMovedRows]
  );

  const getCellValue = (row, col) => {
    if (col === 'FILTER NOTE') {
      return row.IsStillPendingFromDisposed
        ? (row.Purpose || 'Moved to Pending — disposed after TO date')
        : '';
    }
    return row[col] != null ? String(row[col]) : '';
  };

  // ---- Real-time filtering ----
  const filteredData = useMemo(() => {
    const hasActiveFilter = Object.values(searchTerms).some(t => t.trim() !== '');
    if (!hasActiveFilter) return processedData;

    return processedData.filter(row =>
      displayColumns.every(col => {
        const term = searchTerms[col]?.trim() || '';
        if (term === '') return true;
        const cellValue = getCellValue(row, col);
        return cellValue.toLowerCase().includes(term.toLowerCase());
      })
    );
  }, [processedData, searchTerms, displayColumns]);

  const isFiltered = filteredData.length !== processedData.length;

  // ---- Update search term ----
  const handleSearchChange = (col, value) => {
    setSearchTerms(prev => ({ ...prev, [col]: value }));
  };

  const clearFilters = () => setSearchTerms({});

  // ---- Export ----
  // NOTE: exports still use the raw processedData / filteredData rows
  // (including the original DATE OF DIS etc.) — only the on-screen META_FIELDS
  // are hidden from the table UI. Exports are unaffected by this fix.
  const handleExport = async (type) => {
    setBusy(type);
    try {
      const dataToExport = exportMode === 'filtered' ? filteredData : processedData;
      const label = exportMode === 'filtered' && isFiltered ? 'Filtered' : 'All';
      if (type === 'excel') {
        await exportRowsToExcel(dataToExport, `${label}-Data-${timestamp()}.xlsx`, 'Processed Data');
      } else {
        await exportRowsToPdf(dataToExport, displayColumns, `${label}-Data-${timestamp()}.pdf`);
      }
    } catch (err) {
      alert(`Failed to generate ${type === 'excel' ? 'Excel' : 'PDF'}: ${err.message}`);
    } finally {
      setBusy(null);
    }
  };

  // ---- Fullscreen toggle ----
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Approximate header row height — adjust if your font/padding differs
  const HEADER_ROW_H = 37;   // px  — column title row
  const FILTER_ROW_H = 45;   // px  — filter-input row

  return (
    <div ref={containerRef} style={{ background: '#fff', padding: '1px 0' }}>

      {/* ── Toolbar ── */}
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2 flex-wrap">

        {/* Left: export-mode toggle + download buttons */}
        <div className="d-flex align-items-center gap-2 flex-wrap">

          {/* Toggle: Filtered / All */}
          <div className="btn-group btn-group-sm" role="group" aria-label="Export scope">
            <input
              type="radio" className="btn-check" name="exportMode"
              id="exportFiltered" autoComplete="off"
              checked={exportMode === 'filtered'}
              onChange={() => setExportMode('filtered')}
            />
            <label className="btn btn-outline-secondary" htmlFor="exportFiltered">
              Filtered ({filteredData.length})
            </label>

            <input
              type="radio" className="btn-check" name="exportMode"
              id="exportAll" autoComplete="off"
              checked={exportMode === 'all'}
              onChange={() => setExportMode('all')}
            />
            {/* FIX: label clarified — this "All" is the date-filtered dataset
                (processedData already had the date filter applied upstream in
                App.jsx), NOT the unfiltered original upload. The old label
                "All" made it easy to mistake this for "date filter ignored". */}
            <label className="btn btn-outline-secondary" htmlFor="exportAll" title="All records in the current date-filtered dataset (search box filters not applied)">
              All Loaded ({processedData.length})
            </label>
          </div>

          <Button variant="success" size="sm" disabled={busy === 'excel'} onClick={() => handleExport('excel')}>
            <FileEarmarkExcel className="me-1" />
            {busy === 'excel' ? 'Generating…' : 'Download Excel'}
          </Button>
          <Button variant="danger" size="sm" disabled={busy === 'pdf'} onClick={() => handleExport('pdf')}>
            <FileEarmarkPdf className="me-1" />
            {busy === 'pdf' ? 'Generating…' : 'Download PDF'}
          </Button>
        </div>

        {/* Right: fullscreen */}
        <Button variant="outline-secondary" size="sm" onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}>
          {isFullscreen ? <FullscreenExit size={18} /> : <ArrowsFullscreen size={18} />}
        </Button>
      </div>

      {/* ── Record count + clear (shown ABOVE the table) ── */}
      <div className="d-flex align-items-center gap-3 mb-1">
        <p className="text-muted small mb-0">
          Showing <strong>{filteredData.length}</strong> of <strong>{processedData.length}</strong> records
          {isFiltered && <span className="text-warning fw-semibold"> (filtered)</span>}
        </p>
        {isFiltered && (
          <Button variant="outline-warning" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}
        {hasMovedRows && (
          <span className="text-muted small">
            ⓘ Rows with a <strong>FILTER NOTE</strong> were disposed after your TO date, so the date filter moved them back to Pending — this is expected.
          </span>
        )}
      </div>

      {/* ── Scrollable table container ── */}
      <div
        style={{
          maxHeight: isFullscreen ? 'calc(100vh - 140px)' : '500px',
          overflowY: 'auto',
          overflowX: 'auto',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
        }}
      >
        <Table striped bordered hover size="sm" className="mb-0"
          style={{ borderCollapse: 'separate', borderSpacing: 0 }}>

          <thead style={{ zIndex: 2 }}>

            {/* ── Row 1: Column headers — sticky at top:0 ── */}
            <tr>
              {displayColumns.map(col => (
                <th
                  key={col}
                  style={{
                    position: 'sticky',
                    top: 0,
                    background: '#212529',   // table-dark colour
                    color: '#fff',
                    zIndex: 3,
                    whiteSpace: 'nowrap',
                    // Bottom border rendered by the cell itself so it doesn't disappear under sticky
                    boxShadow: 'inset 0 -1px 0 #dee2e6',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>

            {/* ── Row 2: Filter inputs — sticky just below header row ── */}
            <tr>
              {displayColumns.map(col => (
                <th
                  key={`filter-${col}`}
                  style={{
                    position: 'sticky',
                    top: HEADER_ROW_H,          // sits directly below the header row
                    background: '#f8f9fa',
                    zIndex: 3,
                    padding: '4px 6px',
                    boxShadow: 'inset 0 -1px 0 #dee2e6',
                  }}
                >
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Filter…"
                    value={searchTerms[col] || ''}
                    onChange={e => handleSearchChange(col, e.target.value)}
                    style={{ minWidth: '60px', fontSize: '0.75rem' }}
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={displayColumns.length} className="text-center text-muted py-3">
                  No matching records found.
                </td>
              </tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr key={idx} className={row.IsStillPendingFromDisposed ? 'table-warning' : undefined}>
                  {displayColumns.map(col => (
                    <td key={col}>{getCellValue(row, col)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}