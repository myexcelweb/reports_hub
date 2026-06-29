import { useState, useMemo, useRef, useEffect } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import { FileEarmarkExcel, FileEarmarkPdf, ArrowsFullscreen, FullscreenExit } from 'react-bootstrap-icons';
import { exportRowsToExcel, exportRowsToPdf, timestamp } from '../lib/exportFile';

export default function AllDataTable({ processedData }) {
  const [busy, setBusy] = useState(null); // 'excel' | 'pdf' | null
  const [searchTerms, setSearchTerms] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  if (!processedData || processedData.length === 0) {
    return <p className="text-muted text-center">No processed data to display.</p>;
  }

  const columns = Object.keys(processedData[0] || {});

  // ---- Real‑time filtering ----
  const filteredData = useMemo(() => {
    const hasActiveFilter = Object.values(searchTerms).some(term => term.trim() !== '');
    if (!hasActiveFilter) return processedData;

    return processedData.filter(row => {
      return columns.every(col => {
        const term = searchTerms[col]?.trim() || '';
        if (term === '') return true;
        const cellValue = row[col] != null ? String(row[col]) : '';
        return cellValue.toLowerCase().includes(term.toLowerCase());
      });
    });
  }, [processedData, searchTerms, columns]);

  // ---- Update search term ----
  const handleSearchChange = (col, value) => {
    setSearchTerms(prev => ({ ...prev, [col]: value }));
  };

  // ---- Export (uses filtered data) ----
  const handleExport = async (type) => {
    setBusy(type);
    try {
      const dataToExport = filteredData;
      if (type === 'excel') {
        await exportRowsToExcel(dataToExport, `All-Data-${timestamp()}.xlsx`, 'Processed Data');
      } else {
        await exportRowsToPdf(dataToExport, columns, `All-Data-${timestamp()}.pdf`);
      }
    } catch (err) {
      alert(`Failed to generate ${type === 'excel' ? 'Excel' : 'PDF'}: ${err.message}`);
    } finally {
      setBusy(null);
    }
  };

  // ---- Full‑screen toggle ----
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // Listen to fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ---- Render ----
  return (
    <div ref={containerRef} style={{ background: '#fff', padding: '1px 0' }}>
      {/* Toolbar */}
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
        <div className="d-flex gap-2">
          <Button variant="success" size="sm" disabled={busy === 'excel'} onClick={() => handleExport('excel')}>
            <FileEarmarkExcel className="me-1" />{busy === 'excel' ? 'Generating...' : 'Download Excel'}
          </Button>
          <Button variant="danger" size="sm" disabled={busy === 'pdf'} onClick={() => handleExport('pdf')}>
            <FileEarmarkPdf className="me-1" />{busy === 'pdf' ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
        >
          {isFullscreen ? <FullscreenExit size={18} /> : <ArrowsFullscreen size={18} />}
        </Button>
      </div>

      {/* Table container – height adapts when fullscreen */}
      <div
        style={{
          maxHeight: isFullscreen ? 'calc(100vh - 140px)' : '500px',
          overflow: 'auto',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
        }}
      >
        <Table striped bordered hover responsive size="sm" className="mb-0">
          <thead className="table-dark sticky-top" style={{ zIndex: 2 }}>
            {/* Column headers */}
            <tr>
              {columns.map(col => <th key={col}>{col}</th>)}
            </tr>
            {/* Filter inputs row – sticky as well */}
            <tr style={{ background: '#f8f9fa' }}>
              {columns.map(col => (
                <th key={`filter-${col}`} style={{ padding: '4px 6px', background: '#f8f9fa' }}>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Filter..."
                    value={searchTerms[col] || ''}
                    onChange={(e) => handleSearchChange(col, e.target.value)}
                    style={{ minWidth: '60px', fontSize: '0.75rem' }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, idx) => (
              <tr key={idx}>
                {columns.map(col => (
                  <td key={col}>{row[col] != null ? String(row[col]) : ''}</td>
                ))}
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center text-muted">
                  No matching records found.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Record count */}
      <p className="text-muted small mt-2">
        Showing {filteredData.length} of {processedData.length} records
        {filteredData.length !== processedData.length && ' (filtered)'}
      </p>
    </div>
  );
}