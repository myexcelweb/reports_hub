import { useMemo } from 'react';
import Table from 'react-bootstrap/Table';

const valueOf = (value) => String(value ?? '').trim() || '(Not specified)';

function summarize(rows, field) {
  const counts = new Map();
  rows.forEach(row => {
    const key = valueOf(row[field]);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function SummarySection({ title, rows }) {
  return (
    <section className="mb-4">
      <h3 className="h6 fw-bold">{title}</h3>
      <Table striped bordered hover responsive size="sm">
        <thead><tr><th>{title}</th><th className="text-end">Cases</th></tr></thead>
        <tbody>
          {rows.map(({ name, count }) => <tr key={name}><td>{name}</td><td className="text-end">{count}</td></tr>)}
        </tbody>
        <tfoot><tr className="fw-bold"><td>Total</td><td className="text-end">{rows.reduce((sum, row) => sum + row.count, 0)}</td></tr></tfoot>
      </Table>
    </section>
  );
}

export default function CrmaSummaryTable({ processedData }) {
  const summary = useMemo(() => {
    const cases = (processedData || []).filter(row => String(row['CAT1'] || '').trim().toUpperCase().startsWith('CRMA'));
    return {
      total: cases.length,
      act: summarize(cases, 'ACT'),
      type: summarize(cases, 'CAT1'),
      category: summarize(cases, 'CAT2'),
      nature: summarize(cases, 'NATURE'),
    };
  }, [processedData]);

  if (!summary.total) return <p className="text-muted text-center">No CRMA cases found in the processed data.</p>;

  return (
    <div>
      <div className="alert alert-info">Total CRMA cases: <strong>{summary.total}</strong></div>
      <SummarySection title="Act-wise" rows={summary.act} />
      <SummarySection title="Case type-wise" rows={summary.type} />
      <SummarySection title="Category-wise" rows={summary.category} />
      <SummarySection title="Nature-wise" rows={summary.nature} />
    </div>
  );
}
