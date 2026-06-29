import { useState, useMemo, useRef, useEffect } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import { FileEarmarkExcel, FileEarmarkPdf, ArrowsFullscreen, FullscreenExit } from 'react-bootstrap-icons';
import { exportRowsToExcel, exportRowsToPdf, timestamp } from '../lib/exportFile';

export default function AllDataTable({ processedData }) {
  const [busy, setBusy] = useState(null); // 'excel' | 'pdf' | null
  const [searchTerms, setSearchTerms] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportMode, setExportMode] = useState('filtered'); // 'filtered' | 'all'
  const containerRef = useRef(null);

  if (!processedData || processedData.length === 0) {
    return <p className="text-muted text-center">No processed data to display.</p>;
  }

  const columns = Object.keys(processedData[0] || {});

  // ---- Real-time filtering ----
  const filteredData = useMemo(() => {
    const hasActiveFilter = Object.values(searchTerms).some(t => t.trim() !== '');
    if (!hasActiveFilter) return processedData;

    return processedData.filter(row =>
      columns.every(col => {
        const term = searchTerms[col]?.trim() || '';
        if (term === '') return true;
        const cellValue = row[col] != null ? String(row[col]) : '';
        return cellValue.toLowerCase().includes(term.toLowerCase());
      })
    );
  }, [processedData, searchTerms, columns]);

  const isFiltered = filteredData.length !== processedData.length;

  // ---- Update search term ----
  const handleSearchChange = (col, value) => {
    setSearchTerms(prev => ({ ...prev, [col]: value }));
  };

  const clearFilters = () => setSearchTerms({});

  // ---- Export ----
  const handleExport = async (type) => {
    setBusy(type);
    try {
      const dataToExport = exportMode === 'filtered' ? filteredData : processedData;
      const label = exportMode === 'filtered' && isFiltered ? 'Filtered' : 'All';
      if (type === 'excel') {
        await exportRowsToExcel(dataToExport, `${label}-Data-${timestamp()}.xlsx`, 'Processed Data');
      } else {
        await exportRowsToPdf(dataToExport, columns, `${label}-Data-${timestamp()}.pdf`);
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
            <label className="btn btn-outline-secondary" htmlFor="exportAll">
              All ({processedData.length})
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
              {columns.map(col => (
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
              {columns.map(col => (
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
                <td colSpan={columns.length} className="text-center text-muted py-3">
                  No matching records found.
                </td>
              </tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr key={idx}>
                  {columns.map(col => (
                    <td key={col}>{row[col] != null ? String(row[col]) : ''}</td>
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
