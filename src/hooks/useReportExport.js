import { useRef, useState } from 'react';
import { exportReportElement } from '../lib/reportExport';
import { timestamp } from '../lib/exportFile';

// Wires a report's Download Excel / Download PDF buttons to the shared
// exporter. Put `ref` on the element that wraps the report's tables.
// meta: { reportTitle, fileBase }
export function useReportExport(meta) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(null); // 'excel' | 'pdf' | null

  const run = async (type) => {
    setBusy(type);
    try {
      const ext = type === 'excel' ? 'xlsx' : 'pdf';
      await exportReportElement(type, ref.current, {
        reportTitle: meta.reportTitle,
        fileName: `${meta.fileBase}-${timestamp()}.${ext}`,
      });
    } catch (err) {
      alert(`Failed to export ${type === 'excel' ? 'Excel' : 'PDF'}: ${err.message}`);
    } finally {
      setBusy(null);
    }
  };

  return { ref, busy, exportExcel: () => run('excel'), exportPdf: () => run('pdf') };
}
