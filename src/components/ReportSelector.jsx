import { useMemo, useState, useEffect } from 'react';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import { BarChart } from 'react-bootstrap-icons';
import { REPORTS } from './reportsRegistry';

export default function ReportSelector({ processedData }) {
  const [selectedKey, setSelectedKey] = useState(REPORTS[0]?.key || null);

  const stats = useMemo(() => {
    if (!processedData) return { total: 0, pending: 0, disposed: 0 };
    const pending = processedData.filter(r => r.STATUS === 'PENDING').length;
    const disposed = processedData.filter(r => r.STATUS === 'DISPOSE').length;
    return { total: processedData.length, pending, disposed };
  }, [processedData]);

  useEffect(() => {
    if (processedData && !selectedKey && REPORTS.length > 0) {
      setSelectedKey(REPORTS[0].key);
    }
  }, [processedData, selectedKey]);

  const report = REPORTS.find(r => r.key === selectedKey) || REPORTS[0];

  return (
    <div className="mt-5">
      <div className="d-flex align-items-center gap-2 mb-4">
        <BarChart size={22} className="text-primary" />
        <h4 className="mb-0 text-white">Detailed Case Analysis</h4>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3 col-sm-6"><Card body className="text-center"><div className="fs-4 fw-bold">{stats.total}</div><div className="text-muted small">Total Cases</div></Card></div>
        <div className="col-md-3 col-sm-6"><Card body className="text-center"><div className="fs-4 fw-bold text-warning">{stats.pending}</div><div className="text-muted small">Pending</div></Card></div>
        <div className="col-md-3 col-sm-6"><Card body className="text-center"><div className="fs-4 fw-bold text-success">{stats.disposed}</div><div className="text-muted small">Disposed</div></Card></div>
        <div className="col-md-3 col-sm-6"><Card body className="text-center"><div className="fs-4 fw-bold text-info">{((stats.disposed / stats.total) * 100 || 0).toFixed(1)}%</div><div className="text-muted small">Disposal Rate</div></Card></div>
      </div>

      {/* "Select Report" section – now appears below stats */}
      <Card body>
        <Form.Group className="mb-3" controlId="report-select">
          <Form.Label className="fw-semibold" style={{ color: '#0F1E35', fontWeight: '800' }}>
            📊 Select Report
          </Form.Label>
          <Form.Select value={selectedKey || ''} onChange={(e) => setSelectedKey(e.target.value)}>
            {REPORTS.map(r => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </Form.Select>
          <Form.Text muted>{report?.description || 'Select a report from the list.'}</Form.Text>
        </Form.Group>

        <hr />
        {report ? report.render(processedData) : <p className="text-muted">Please select a report.</p>}
      </Card>
    </div>
  );
}