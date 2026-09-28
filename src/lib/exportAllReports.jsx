// "Download Excel" on the Reports tab: every report in one workbook.
//
// Each report component is rendered off-screen and its tables are exported
// with the same exporter the per-report buttons use, so every sheet matches
// what the report shows on screen (same headers, rows and totals).

import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { REPORTS } from '../components/reportsRegistry';
import { collectTables, exportTablesToExcel } from './reportExport';
import { timestamp } from './exportFile';

export function collectAllReportTables(processedData) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;width:1600px;visibility:hidden;';
  document.body.appendChild(host);

  const sheets = [];
  try {
    REPORTS.forEach(report => {
      const el = document.createElement('div');
      host.appendChild(el);
      const root = createRoot(el);
      flushSync(() => root.render((report.renderAll || report.render)(processedData)));
      const tables = collectTables(el, report.label);
      tables.forEach((t, i) => {
        sheets.push({
          ...t,
          reportTitle: report.label,
          sheetName: tables.length === 1 ? report.short : `${report.short} - ${t.sheetName || i + 1}`,
        });
      });
      root.unmount();
      el.remove();
    });
  } finally {
    host.remove();
  }
  return sheets;
}

export async function exportAllReportsToExcel(processedData) {
  const sheets = collectAllReportTables(processedData);
  await exportTablesToExcel(sheets, {
    reportTitle: 'Court Case Reports',
    fileName: `Court-Case-Reports-${timestamp()}.xlsx`,
  });
}
