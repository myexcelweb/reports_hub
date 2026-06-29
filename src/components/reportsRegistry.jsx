import StatusBreakdownTable from './StatusBreakdownTable';
import DisposalNatureTable from './DisposalNatureTable';
import AllDataTable from './AllDataTable';
import DisposalAgeCat2Table from './DisposalAgeCat2Table';
import AgeBreakdownTable from './AgeBreakdownTable';
import ReadyUnreadyTable from './ReadyUnreadyTable';
import PendingYearTotalTable from './PendingYearTotalTable';
import BalanceSheetView from './BalanceSheetView';

export const REPORTS = [
  {
    key: 'status',
    label: 'Status Analysis — Pending vs Disposed',
    description: 'Pending and disposed cases categorised by civil and criminal sides.',
    render: (data) => <StatusBreakdownTable processedData={data} />,
  },
  {
    key: 'disposal-nature',
    label: 'Disposal Analysis — By Nature & Lok Adalat',
    description: 'Disposed cases split by contested / uncontested nature and Lok Adalat.',
    render: (data) => <DisposalNatureTable processedData={data} />,
  },
  {
    key: 'all-data',
    label: 'All Data',
    description: 'Complete processed dataset — view, and download as Excel or PDF.',
    render: (data) => <AllDataTable processedData={data} />,
  },
  {
    key: 'part1',
    label: 'PART1 — Disposed Civil (Age CAT2)',
    description: 'BJ/OBJ split by age category, plus disposal-nature breakdown – includes export.',
    render: (data) => <DisposalAgeCat2Table processedData={data} />,
  },
  {
    key: 'part2',
    label: 'PART2 — Disposed Civil (Age CAT3)',
    description: 'Disposed civil cases with BJ/OBJ split by age category 3 – includes Lok Adalat column and export.',
    render: (data) => (
      <AgeBreakdownTable
        processedData={data}
        status="DISPOSE"
        side="CIVIL"
        emptyLabel="No disposed civil cases found."
        highlightNonSpecial={true}   // red for non‑CMA/EXE, green bold for CMA/EXE
        includeLA={true}
        showExport={true}
        bjObjSplit={true}
      />
    ),
  },
  {
    key: 'part3',
    label: 'PART3 — Disposed Criminal (Age CAT3)',
    description: 'Disposed criminal cases with BJ/OBJ split by age category 3 – includes Lok Adalat column and export.',
    render: (data) => (
      <AgeBreakdownTable
        processedData={data}
        status="DISPOSE"
        side="CRIMINAL"
        emptyLabel="No disposed criminal cases found."
        includeLA={true}
        showExport={true}
        bjObjSplit={true}
      />
    ),
  },
  {
    key: 'b1b2-civil-ready',
    label: 'B1B2-Civil — Ready / Unready',
    description: 'Pending civil cases by readiness status – shows both a full year‑wise view and a compact last‑5‑years + aggregated pre‑year summary.',
    render: (data) => (
      <ReadyUnreadyTable
        processedData={data}
        side="CIVIL"
        sideLabel="Civil"
        emptyLabel="No pending civil cases with valid RU data found."
      />
    ),
  },
  {
    key: 'b1b2-civil-part2',
    label: 'B1B2-Civil — Year-wise Total',
    description: 'Pending civil cases, year-wise totals.',
    render: (data) => (
      <PendingYearTotalTable
        processedData={data}
        side="CIVIL"
        sideLabel="Civil"
        emptyLabel="No pending civil cases found."
      />
    ),
  },
  {
    key: 'b1b2-criminal-part1',
    label: 'B1B2-Criminal — Age-wise Pending',
    description: 'Pending criminal cases grouped by age category 3.',
    render: (data) => (
      <AgeBreakdownTable
        processedData={data}
        status="PENDING"
        side="CRIMINAL"
        emptyLabel="No pending criminal cases found."
      />
    ),
  },
  {
    key: 'b1b2-criminal-part2',
    label: 'B1B2-Criminal — Year-wise Total',
    description: 'Pending criminal cases, year-wise totals.',
    render: (data) => (
      <PendingYearTotalTable
        processedData={data}
        side="CRIMINAL"
        sideLabel="Criminal"
        emptyLabel="No pending criminal cases found."
      />
    ),
  },
  {
    key: 'balance-sheets',
    label: 'Balance Sheets',
    description: 'Pending cases by category & year — view, and download as Excel or PDF.',
    render: (data) => <BalanceSheetView processedData={data} />,
  },
];