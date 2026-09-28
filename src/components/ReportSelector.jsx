import { useState } from 'react';
import { BarChart, ChevronDown, ChevronLeft, ChevronRight } from 'react-bootstrap-icons';
import { REPORTS, REPORT_GROUPS } from './reportsRegistry';

// Big, obviously-clickable report picker. The report tables rendered below
// are untouched — only the picker around them is styled here (CSS in App.jsx).
export default function ReportSelector({ processedData, id }) {
  const [selectedKey, setSelectedKey] = useState(REPORTS[0]?.key || null);

  const index = Math.max(0, REPORTS.findIndex(r => r.key === selectedKey));
  const report = REPORTS[index];

  const groups = [...REPORT_GROUPS, 'Other']
    .map(group => ({
      group,
      items: REPORTS.filter(r => (REPORT_GROUPS.includes(r.group) ? r.group : 'Other') === group),
    }))
    .filter(g => g.items.length > 0);

  const goTo = (i) => setSelectedKey(REPORTS[i].key);

  return (
    <>
      <div className="report-picker">
        <div className="report-picker-head">
          <label className="report-picker-step" htmlFor={id}>Step 2 · Select Report</label>
          <span className="report-picker-count">{REPORTS.length} reports</span>
        </div>

        <div className="report-picker-row">
          <button type="button" className="report-nav-btn" title="Previous report"
            disabled={index === 0} onClick={() => goTo(index - 1)}>
            <ChevronLeft size={18} />
          </button>

          <div className="report-select-wrap">
            <BarChart size={20} className="report-select-icon" />
            <select id={id} className="report-select" value={report?.key || ''}
              onChange={(e) => setSelectedKey(e.target.value)}>
              {groups.map(({ group, items }) => (
                <optgroup key={group} label={group}>
                  {items.map(r => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="report-select-arrow"><ChevronDown size={20} /></span>
          </div>

          <button type="button" className="report-nav-btn" title="Next report"
            disabled={index === REPORTS.length - 1} onClick={() => goTo(index + 1)}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="report-picker-hint">↑ Click the box to choose another report</div>
        {report?.description && <div className="report-picker-desc">{report.description}</div>}
      </div>

      <div className="report-body">
        {report ? report.render(processedData) : <p className="text-muted">Please select a report.</p>}
      </div>
    </>
  );
}
