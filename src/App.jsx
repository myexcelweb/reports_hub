import { useRef, useState, useEffect, useMemo } from 'react';
import { useCourtCaseProcessor } from './hooks/useCourtCaseProcessor';
import ReportSelector from './components/ReportSelector';
import UploadScreen from './components/UploadScreen';

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20, color = 'currentColor', ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d={d} />
  </svg>
);

const UploadIcon = (p) => <Icon {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />;
const ChartIcon = (p) => <Icon {...p} d="M3 3v18h18M18 9l-5 5-4-4-4 4" />;
const FileIcon = (p) => <Icon {...p} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />;
const TrashIcon = (p) => <Icon {...p} d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />;
const CheckIcon = (p) => <Icon {...p} d="M20 6L9 17l-5-5" />;
const XIcon = (p) => <Icon {...p} d="M18 6L6 18M6 6l12 12" />;
const DownloadIcon = (p) => <Icon {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />;
const PlusIcon = (p) => <Icon {...p} d="M12 5v14M5 12h14" />;
const ExternalLinkIcon = (p) => <Icon {...p} d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />;

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy:   #0F1E35;
    --teal:   #00C2B2;
    --teal-d: #009D90;
    --amber:  #F5A623;
    --slate:  #F0F4F8;
    --border: #E2E8F0;
    --text:   #1A202C;
    --muted:  #64748B;
    --white:  #FFFFFF;
    --red:    #EF4444;
    --green:  #10B981;
  }

  body { font-family: 'Inter', system-ui, sans-serif; background: var(--slate); color: var(--text); min-height: 100vh; }

  /* ── App Shell ── */
  .app-shell { display: flex; flex-direction: column; min-height: 100vh; }

  /* ── Top Nav ── */
  .topnav {
    background: var(--navy);
    padding: 0 2rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    height: 64px;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 2px 20px rgba(0,0,0,.4);
  }
  .topnav-brand {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    text-decoration: none;
    letter-spacing: -.02em;
    line-height: 1.2;
  }
  .topnav-brand .brand-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--white);
  }
  .topnav-brand .brand-title span { color: var(--teal); }
  .topnav-brand .brand-sub {
    font-size: 0.6rem;
    color: rgba(255,255,255,.45);
    font-weight: 400;
    letter-spacing: 0.02em;
  }
  .topnav-tabs { display: flex; gap: .25rem; margin-left: 2rem; }
  .nav-tab {
    display: flex; align-items: center; gap: .45rem;
    padding: .45rem 1rem; border-radius: 6px;
    font-size: .85rem; font-weight: 500;
    color: rgba(255,255,255,.55);
    background: none; border: none; cursor: pointer;
    transition: all .18s;
  }
  .nav-tab:hover:not(:disabled) { color: var(--white); background: rgba(255,255,255,.07); }
  .nav-tab.active { color: var(--white); background: rgba(0,194,178,.18); border-bottom: 2px solid var(--teal); border-radius: 6px 6px 0 0; }
  .nav-tab:disabled { opacity: .35; cursor: not-allowed; }
  .nav-badge { background: var(--teal); color: var(--navy); font-size: .65rem; font-weight: 700; padding: 1px 6px; border-radius: 99px; }
  .topnav-right { margin-left: auto; display: flex; align-items: center; gap: .75rem; }
  .topnav-tagline { font-size: .72rem; color: rgba(255,255,255,.35); letter-spacing: .05em; text-transform: uppercase; }
  .topnav-main-link {
    font-size: .78rem;
    color: rgba(255,255,255,.7);
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: .4rem;
    padding: .3rem .8rem;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,.15);
    transition: all .18s;
    background: transparent;
    font-weight: 500;
  }
  .topnav-main-link:hover {
    color: var(--white);
    background: rgba(255,255,255,.08);
    border-color: rgba(255,255,255,.3);
  }

  /* ── Main Content – FULL WIDTH ── */
  .main-content {
    flex: 1;
    padding: 1rem;
    max-width: 100%;
    margin: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  .btn-primary {
    background: var(--teal); color: var(--navy);
    border: none; border-radius: 10px;
    padding: .6rem 1.5rem; font-size: .9rem; font-weight: 700;
    cursor: pointer; transition: all .18s; display: flex; align-items: center; gap: .5rem;
    letter-spacing: -.01em;
    width: 100%;
    justify-content: center;
  }
  .btn-primary:hover:not(:disabled) { background: var(--teal-d); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,194,178,.3); }
  .btn-primary:disabled { opacity: .45; cursor: not-allowed; transform: none; }

  .btn-outline {
    background: transparent; color: var(--teal);
    border: 1.5px solid var(--teal); border-radius: 10px;
    padding: .6rem 1.2rem; font-size: .88rem; font-weight: 600;
    cursor: pointer; transition: all .18s; display: flex; align-items: center; gap: .5rem;
  }
  .btn-outline:hover { background: rgba(0,194,178,.07); }

  /* ── Stat Cards ── */
  .stat-grid { display: grid; grid-template-columns: repeat(6,1fr); gap: 1rem; margin-bottom: 1.5rem; }
  .stat-card {
    background: var(--white); border-radius: 14px;
    padding: 1.25rem 1rem; text-align: center;
    border: 1px solid var(--border);
    box-shadow: 0 2px 8px rgba(0,0,0,.04);
    transition: transform .18s;
  }
  .stat-card:hover { transform: translateY(-2px); }
  .stat-num { font-size: 2rem; font-weight: 800; letter-spacing: -.04em; line-height: 1; }
  .stat-label { font-size: .75rem; color: var(--muted); font-weight: 500; margin-top: .35rem; text-transform: uppercase; letter-spacing: .04em; }
  .stat-card.c-blue  .stat-num { color: #3B82F6; }
  .stat-card.c-amber .stat-num { color: var(--amber); }
  .stat-card.c-green .stat-num { color: var(--green); }
  .stat-card.c-teal  .stat-num { color: var(--teal); }
  .stat-card.c-navy  .stat-num { color: var(--navy); }
  .stat-card.c-red   .stat-num { color: var(--red); }
  .stat-card.c-red   { border-top-color: var(--red); }
  .stat-card { border-top: 3px solid var(--border); }
  .stat-card.c-blue  { border-top-color: #3B82F6; }
  .stat-card.c-amber { border-top-color: var(--amber); }
  .stat-card.c-green { border-top-color: var(--green); }
  .stat-card.c-teal  { border-top-color: var(--teal); }
  .stat-card.c-navy  { border-top-color: var(--navy); }

  .skipped-note {
    background: rgba(245,166,35,.1); border: 1px solid rgba(245,166,35,.45); color: #92400E;
    border-radius: 10px; padding: .6rem 1rem; font-size: .83rem; margin: -.5rem 0 1.25rem;
  }

  /* ── Multi-court reminder tag ── */
  .mode-tag {
    display: inline-flex; align-items: center; gap: .35rem;
    background: rgba(245,166,35,.15); color: #B45309;
    border: 1px solid rgba(245,166,35,.55);
    font-size: .72rem; font-weight: 700; letter-spacing: .03em; text-transform: uppercase;
    padding: .2rem .6rem; border-radius: 99px; margin-left: .75rem; vertical-align: middle;
  }

  /* ── Report content area ── */
  .report-content-area {
    background: var(--white); border-radius: 16px;
    border: 1px solid var(--border);
    padding: 1.75rem;
    min-height: 260px;
    box-shadow: 0 2px 10px rgba(0,0,0,.05);
  }
  .report-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; min-height: 220px;
    color: var(--muted); text-align: center; gap: .5rem;
  }
  .report-empty h4 { font-size: 1rem; font-weight: 600; color: var(--text); }
  .report-empty p  { font-size: .83rem; }

 /* ── Tab Header row ── */
.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.75rem;
  background: var(--navy) !important;
  padding: 0.75rem 1.25rem;
  border-radius: 10px;
}
.tab-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #ffffff !important;
}

  /* ── File list (detailed tab) ── */
  .file-list { background: var(--white); border-radius: 14px; border: 1px solid var(--border); overflow: hidden; }
  .file-list-header { padding: .85rem 1.25rem; background: var(--slate); border-bottom: 1px solid var(--border); font-size: .8rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .file-row { display: flex; align-items: center; gap: 1rem; padding: .85rem 1.25rem; border-bottom: 1px solid var(--border); transition: background .12s; }
  .file-row:last-child { border-bottom: none; }
  .file-row:hover { background: var(--slate); }
  .file-row-icon { flex-shrink: 0; width: 36px; height: 36px; border-radius: 8px; background: rgba(16,185,129,.1); display: flex; align-items: center; justify-content: center; }
  .file-row-info { flex: 1; min-width: 0; }
  .file-row-name { font-size: .88rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .file-row-size { font-size: .74rem; color: var(--muted); margin-top: 2px; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .status-dot.done    { background: var(--green); }
  .status-dot.pending { background: var(--amber); }
  .status-dot.error   { background: var(--red); }
  .status-dot.idle    { background: #CBD5E1; }
  .file-status { display: flex; align-items: center; gap: .4rem; flex-shrink: 0; max-width: 45%; }
  .file-status-label { font-size: .74rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* ── Notifications ── */
  .notifications { position: fixed; top: 1rem; right: 1rem; z-index: 999; display: flex; flex-direction: column; gap: .5rem; max-width: 360px; }
  .notif {
    display: flex; align-items: center; gap: .75rem;
    background: var(--white); border-radius: 12px;
    padding: .75rem 1rem; box-shadow: 0 4px 20px rgba(0,0,0,.12);
    border-left: 4px solid var(--teal);
    font-size: .85rem; font-weight: 500;
    animation: slide-in .25s ease;
  }
  .notif.danger  { border-color: var(--red); }
  .notif.success { border-color: var(--green); }
  .notif.warning { border-color: var(--amber); }
  .notif-close { margin-left: auto; background: none; border: none; cursor: pointer; color: var(--muted); display: flex; }
  @keyframes slide-in { from { opacity:0; transform: translateX(20px); } to { opacity:1; transform:none; } }

  /* ── Empty state ── */
  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; text-align: center; gap: .75rem; }
  .empty-state h3 { font-size: 1.15rem; font-weight: 700; color: var(--navy); }
  .empty-state p { color: var(--muted); font-size: .88rem; max-width: 340px; }

  /* ── Footer ── */
  .footer {
    text-align: center;
    padding: 1.5rem;
    font-size: .78rem;
    color: var(--muted);
    border-top: 1px solid var(--border);
    margin-top: auto;
  }
  .footer a {
    color: var(--teal);
    text-decoration: none;
  }
  .footer a:hover { text-decoration: underline; }

  /* ── Report picker (big, obviously a dropdown) ── */
  .report-picker {
    background: linear-gradient(135deg, rgba(0,194,178,.08), rgba(15,30,53,.04));
    border: 1px solid rgba(0,194,178,.35);
    border-radius: 14px;
    padding: 1.1rem 1.25rem 1rem;
    margin-bottom: 1.5rem;
  }
  .report-picker-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: .6rem; }
  .report-picker-step {
    font-size: .78rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
    color: var(--navy); margin: 0;
  }
  .report-picker-count {
    font-size: .72rem; font-weight: 600; color: var(--teal-d);
    background: rgba(0,194,178,.12); padding: .15rem .6rem; border-radius: 99px;
  }
  .report-picker-row { display: flex; align-items: stretch; gap: .6rem; }
  .report-select-wrap {
    position: relative; flex: 1; border-radius: 12px;
    animation: picker-pulse 1.4s ease-out 2;
  }
  .report-select-icon {
    position: absolute; left: 1rem; top: 50%; transform: translateY(-50%);
    color: var(--teal-d); pointer-events: none;
  }
  .report-select {
    width: 100%; height: 56px;
    padding: 0 4.25rem 0 3rem;
    border: 2.5px solid var(--teal); border-radius: 12px;
    background: var(--white); color: var(--navy);
    font-family: inherit; font-size: 1.05rem; font-weight: 700;
    appearance: none; -webkit-appearance: none;
    cursor: pointer; transition: box-shadow .18s, border-color .18s;
    box-shadow: 0 2px 10px rgba(0,194,178,.15);
  }
  .report-select:hover { border-color: var(--teal-d); box-shadow: 0 0 0 4px rgba(0,194,178,.18); }
  .report-select:focus { outline: none; border-color: var(--teal-d); box-shadow: 0 0 0 4px rgba(0,194,178,.3); }
  .report-select optgroup { font-weight: 800; color: var(--teal-d); font-style: normal; }
  .report-select option { font-weight: 500; color: var(--text); }
  .report-select-arrow {
    position: absolute; right: 0; top: 0; bottom: 0; width: 3.25rem;
    display: flex; align-items: center; justify-content: center;
    background: var(--teal); color: var(--navy);
    border-radius: 0 12px 12px 0; pointer-events: none;
  }
  .report-nav-btn {
    width: 44px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--white); color: var(--navy);
    border: 1.5px solid var(--border); border-radius: 10px;
    cursor: pointer; transition: all .15s;
  }
  .report-nav-btn:hover:not(:disabled) { border-color: var(--teal); color: var(--teal-d); }
  .report-nav-btn:disabled { opacity: .35; cursor: not-allowed; }
  .report-picker-hint { font-size: .75rem; color: var(--muted); margin: .4rem 0 0 3.5rem; }
  .report-picker-desc {
    margin-top: .6rem; padding-top: .6rem; border-top: 1px dashed rgba(0,194,178,.35);
    font-size: .85rem; color: var(--text);
  }
  @keyframes picker-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(0,194,178,.55); }
    100% { box-shadow: 0 0 0 14px rgba(0,194,178,0); }
  }

  /* ── All Data toolbar ── */
  .alldata-toolbar {
    display: flex; justify-content: space-between; align-items: center; gap: .5rem; flex-wrap: wrap;
    background: var(--slate); border: 1px solid var(--border); border-radius: 10px;
    padding: .5rem .75rem; margin-bottom: .6rem;
  }

  /* ── Utils ── */
  .w-full { width: 100%; }
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .items-center { align-items: center; }
  .gap-sm { gap: .5rem; }
  .gap-md { gap: 1rem; }
  .mt-sm { margin-top: .5rem; }
  .mt-md { margin-top: 1rem; }
  .mt-lg { margin-top: 1.5rem; }
  .mt-xl { margin-top: 2rem; }
  .mb-md { margin-bottom: 1rem; }

  @media (max-width: 1100px) {
    .stat-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 700px) {
    .stat-grid { grid-template-columns: repeat(2, 1fr); }
    .report-select { font-size: .9rem; }
    .topnav-tabs { gap: 0; }
    .nav-tab { padding: .45rem .6rem; font-size: .78rem; }
  }
`;

// File status (set by the upload screen and the processor) → dot colour + label
const FILE_STATUS = {
  pending: { dot: 'idle', label: 'Not processed yet' },
  reading: { dot: 'pending', label: 'Reading…' },
  success: { dot: 'done', label: 'Processed' },
  empty: { dot: 'pending', label: 'Empty file — no rows' },
  error: { dot: 'error', label: 'Could not read file' },
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [fileItems, setFileItems] = useState([]);
  const [multiCourt, setMultiCourt] = useState(false); // false = single court (default)
  const [warnings, setWarnings] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const detailInputRef = useRef(null);

  const {
    isProcessing, progress, progressText,
    processedData, finalSummary,
    notifications, setNotifications,
    processFiles,               // original – no date filter
    processFilesWithDates,      // with date filter
    downloadAllReports,
  } = useCourtCaseProcessor();

  // ── Auto‑focus the report selector when the Reports tab is shown ──
  useEffect(() => {
    if (activeTab === 'reports' && processedData) {
      const selectEl = document.getElementById('report-select');
      if (selectEl) selectEl.focus();
    }
  }, [activeTab, processedData]);

  // Jump to Reports once data arrives — only if the user is still on Upload.
  useEffect(() => {
    if (processedData) setActiveTab(tab => (tab === 'upload' ? 'reports' : tab));
  }, [processedData]);

  const caseStats = useMemo(() => {
    const rows = processedData || [];
    const pending = rows.filter(r => r.STATUS === 'PENDING').length;
    const disposed = rows.filter(r => r.STATUS === 'DISPOSE').length;
    return { pending, disposed, rate: rows.length ? (disposed / rows.length) * 100 : 0 };
  }, [processedData]);

  const notify = (message, variant = 'info') => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, variant }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4500);
  };

  // ── Process without date filter ──
  // The processor reports progress by passing an updater function
  // (prev => prev.map(...)), so setFileItems is handed over directly.
  const handleProcess = () => {
    if (fileItems.length === 0) return;
    const files = fileItems.map(item => item.file);
    processFiles(files, setFileItems, { multiCourt });
  };

  // ── Process with FROM/TO dates ──
  const handleProcessWithDates = (fromDate, toDate) => {
    if (fileItems.length === 0) return;
    const files = fileItems.map(item => item.file);
    processFilesWithDates(files, fromDate, toDate, setFileItems, { multiCourt });
  };

  const removeFile = (i) => {
    setFileItems(prev => prev.filter((_, idx) => idx !== i));
    notify('File removed', 'warning');
  };

  const tabs = [
    { key: 'upload', label: 'Data Upload', icon: <UploadIcon size={15} /> },
    { key: 'reports', label: 'Analysis & Reports', icon: <ChartIcon size={15} />, disabled: !processedData },
    { key: 'detailed', label: 'Detailed Case Analysis', icon: <FileIcon size={15} />, disabled: !processedData },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="app-shell">

        {/* ── Notifications ── */}
        <div className="notifications">
          {notifications.map(n => (
            <div key={n.id} className={`notif ${n.variant}`}>
              {n.variant === 'success' && <CheckIcon size={16} color="var(--green)" />}
              {n.variant === 'danger' && <XIcon size={16} color="var(--red)" />}
              {n.message}
              <button className="notif-close"
                onClick={() => setNotifications(p => p.filter(x => x.id !== n.id))}>
                <XIcon size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* ── Top Nav ── */}
        <nav className="topnav">
          <a href="#" className="topnav-brand">
            <div className="brand-title">
              <FileIcon size={18} color="var(--teal)" style={{ marginRight: '6px' }} />
              Reports<span>Hub</span>
            </div>
            <div className="brand-sub">Monthly • Quarterly Statements (પત્રકો).</div>
          </a>
          <div className="topnav-tabs">
            {tabs.map(({ key, label, icon, disabled }) => (
              <button key={key}
                className={`nav-tab ${activeTab === key ? 'active' : ''}`}
                disabled={disabled}
                onClick={() => setActiveTab(key)}
              >
                {icon}
                {label}
                {key === 'reports' && processedData && (
                  <span className="nav-badge">New</span>
                )}
              </button>
            ))}
          </div>
          <div className="topnav-right">
            <span className="topnav-tagline">Duplicate Detection · Reporting</span>
            <a
              href="https://file-pro.netlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="topnav-main-link"
            >
              <ExternalLinkIcon size={14} />
              Main Website
            </a>
          </div>
        </nav>

        {/* ── Main ── */}
        <main className="main-content">

          {/* ═══════════ UPLOAD TAB ═══════════ */}
          {activeTab === 'upload' && (
            <UploadScreen fileItems={fileItems}
              setFileItems={setFileItems}
              warnings={warnings}
              setWarnings={setWarnings}
              isDragging={isDragging}
              setIsDragging={setIsDragging}
              isProcessing={isProcessing}
              progress={progress}
              progressText={progressText}
              notify={notify}
              onProcess={handleProcess}                     // original
              onProcessWithDates={handleProcessWithDates}   // with filter
              onRemoveFile={removeFile}
            multiCourt={multiCourt}
            setMultiCourt={setMultiCourt}
          />
          )}

          {/* ═══════════ REPORTS TAB ═══════════ */}
          {activeTab === 'reports' && processedData && (
            <>
              <div className="tab-header">
                <div className="tab-title">
                  Analysis & Reports
                  {multiCourt && <span className="mode-tag">Multi-court mode</span>}
                </div>
                <button className="btn-outline" onClick={downloadAllReports}>
                  <DownloadIcon size={16} />
                  Download Excel
                </button>
              </div>

              {/* Stat Cards */}
              {finalSummary && (
                <div className="stat-grid">
                  <div className="stat-card c-blue">
                    <div className="stat-num">{finalSummary.grandTotal}</div>
                    <div className="stat-label">Total Records</div>
                  </div>
                  <div className="stat-card c-red">
                    <div className="stat-num">{finalSummary.duplicatesRemoved}</div>
                    <div className="stat-label">Duplicates Removed</div>
                  </div>
                  <div className="stat-card c-green">
                    <div className="stat-num">{finalSummary.uniqueRecords}</div>
                    <div className="stat-label">Unique Records</div>
                  </div>
                  <div className="stat-card c-amber">
                    <div className="stat-num">{caseStats.pending}</div>
                    <div className="stat-label">Pending</div>
                  </div>
                  <div className="stat-card c-navy">
                    <div className="stat-num">{caseStats.disposed}</div>
                    <div className="stat-label">Disposed</div>
                  </div>
                  <div className="stat-card c-teal">
                    <div className="stat-num">{caseStats.rate.toFixed(1)}%</div>
                    <div className="stat-label">Disposal Rate</div>
                  </div>
                </div>
              )}

              {finalSummary?.dateFilterExcluded > 0 && (
                <div className="skipped-note">
                  ⓘ <strong>{finalSummary.dateFilterExcluded}</strong> case{finalSummary.dateFilterExcluded > 1 ? 's are' : ' is'} not
                  counted because of the FROM / TO date filter (registered after the TO date, or disposed outside FROM – TO).
                </div>
              )}

              {finalSummary?.skippedNoKey > 0 && (
                <div className="skipped-note">
                  ⚠ <strong>{finalSummary.skippedNoKey}</strong> row{finalSummary.skippedNoKey > 1 ? 's were' : ' was'} skipped
                  because {finalSummary.skippedNoKey > 1 ? 'they have' : 'it has'} no CNR and no Case No. (usually blank or total rows in the Excel file).
                </div>
              )}

              {/* ── Report content area with HIGHLIGHTED selector ── */}
              <div className="report-content-area">
                <ReportSelector processedData={processedData} id="report-select" />
              </div>
            </>
          )}

          {/* ═══════════ DETAILED TAB ═══════════ */}
          {activeTab === 'detailed' && processedData && (
            <>
              <div className="tab-header">
                <div className="tab-title">Detailed Case Analysis</div>
                <button className="btn-outline" onClick={() => detailInputRef.current?.click()}>
                  <PlusIcon size={16} />
                  Add More Files
                </button>
              </div>
              <input ref={detailInputRef} type="file" accept=".xlsx,.xls" multiple
                style={{ display: 'none' }}
                onChange={() => notify('Please use the Upload tab to add files.', 'info')} />

              <div className="file-list">
                <div className="file-list-header">Uploaded Files · {fileItems.length} total</div>
                {fileItems.length === 0 ? (
                  <div className="report-empty" style={{ minHeight: 120 }}>
                    <p>No files uploaded yet.</p>
                  </div>
                ) : (
                  fileItems.map((item, i) => (
                    <div key={i} className="file-row">
                      <div className="file-row-icon">
                        <FileIcon size={18} color={item.type ? "var(--green)" : "var(--amber)"} />
                      </div>
                      <div className="file-row-info">
                        <div className="file-row-name">{item.name}</div>
                        <div className="file-row-size">
                          {(item.size / 1024).toFixed(0)} KB
                          {!item.type && <span style={{ marginLeft: '0.5rem', color: 'var(--amber)' }}>⚠️ Unknown type</span>}
                        </div>
                      </div>
                      {(() => {
                        const s = FILE_STATUS[item.status] || FILE_STATUS.pending;
                        const label = item.status === 'success' && item.processedRows != null
                          ? `${s.label} · ${item.processedRows} rows`
                          : item.status === 'error' && item.error ? `${s.label}: ${item.error}` : s.label;
                        return (
                          <div className="file-status" title={label}>
                            <span className={`status-dot ${s.dot}`} />
                            <span className="file-status-label">{label}</span>
                          </div>
                        );
                      })()}
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
                        onClick={() => removeFile(i)}>
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-xl">
                <button className="btn-primary w-full"
                  disabled={isProcessing || fileItems.length === 0}
                  onClick={() => setActiveTab('upload')}
                  style={{ justifyContent: 'center' }}
                >
                  {isProcessing ? 'Re-processing…' : 'Go to Upload to Re-Process'}
                </button>
              </div>
            </>
          )}

          {/* ═══════════ FALLBACK ═══════════ */}
          {((activeTab === 'reports' || activeTab === 'detailed') && !processedData) && (
            <div className="empty-state">
              <ChartIcon size={56} color="var(--border)" />
              <h3>No Data Yet</h3>
              <p>Upload and process your Excel files first, then come back here for full analysis.</p>
              <button className="btn-primary mt-md" onClick={() => setActiveTab('upload')}>
                <UploadIcon size={16} /> Go to Upload
              </button>
            </div>
          )}
        </main>

        {/* ── Footer ── */}
        <footer className="footer">
          Designed and developed by <strong>Parimal J. Hodar</strong> ·{' '}
          <a href="mailto:parimalhodar.dev@gmail.com">parimalhodar.dev@gmail.com</a>
        </footer>
      </div>
    </>
  );
}