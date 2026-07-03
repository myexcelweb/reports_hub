import { useRef, useState, useEffect } from 'react';
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
  .stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; margin-bottom: 2rem; }
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

  /* ── ✨ HIGHLIGHTED "Select Report" – DARK GREEN BACKGROUND ✨ ── */
  .report-selector-wrapper {
    margin-top: 0.5rem;
    background: #171341 !important;
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    border-left: 2.5px solid var(--teal) !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  }
  .report-selector-wrapper label {
    display: block;
    font-weight: 800 !important;
    font-size: 1.2rem !important;
    color: #0e0d0d !important;
    margin-bottom: 0.5rem;
    letter-spacing: -0.02em;
  }
  .report-selector-wrapper select {
    width: 100%;
    padding: 0.75rem 1.25rem;
    border: 2.5px solid var(--teal) !important;
    border-radius: 10px;
    background-color: #0ca170 !important;
    color: #f1f5f9 !important;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 600;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23cbd5e1' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    background-size: 12px;
    cursor: pointer;
    transition: box-shadow 0.2s, border-color 0.2s;
  }
  .report-selector-wrapper select:focus {
    outline: none;
    border-color: var(--teal-d) !important;
    box-shadow: 0 0 0 4px rgba(0,194,178,0.3);
  }
  .report-selector-wrapper select option {
    background: #1e293b;
    color: #f1f5f9;
  }
  .report-selector-wrapper .helper-text {
    font-size: 0.8rem;
    color: #cbd5e1 !important;
    margin-top: 0.4rem;
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

  @media (max-width: 700px) {
    .stat-grid { grid-template-columns: repeat(2, 1fr); }
    .topnav-tabs { gap: 0; }
    .nav-tab { padding: .45rem .6rem; font-size: .78rem; }
  }
`;

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [fileItems, setFileItems] = useState([]);
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

  useEffect(() => {
    if (processedData && activeTab === 'upload') setActiveTab('reports');
  }, [processedData]);

  const notify = (message, variant = 'info') => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, variant }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4500);
  };

  // ── Process without date filter ──
  const handleProcess = () => {
    if (fileItems.length === 0) return;
    const files = fileItems.map(item => item.file);
    const updateStatus = (fileName, status) => {
      setFileItems(prev =>
        prev.map(item =>
          item.name === fileName ? { ...item, status } : item
        )
      );
    };
    processFiles(files, updateStatus);
  };

  // ── Process with FROM/TO dates ──
  const handleProcessWithDates = (fromDate, toDate) => {
    if (fileItems.length === 0) return;
    const files = fileItems.map(item => item.file);
    const updateStatus = (fileName, status) => {
      setFileItems(prev =>
        prev.map(item =>
          item.name === fileName ? { ...item, status } : item
        )
      );
    };
    processFilesWithDates(files, fromDate, toDate, updateStatus);
  };

  const removeFile = (i) => {
    setFileItems(prev => prev.filter((_, idx) => idx !== i));
    notify('File removed', 'warning');
  };

  const tabs = [
    { key: 'upload', label: 'Data Upload', Icon: UploadIcon },
    { key: 'reports', label: 'Analysis & Reports', Icon: ChartIcon, disabled: !processedData },
    { key: 'detailed', label: 'Detailed Case Analysis', Icon: FileIcon, disabled: !processedData },
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
            {tabs.map(({ key, label, Icon: TabIcon, disabled }) => (
              <button key={key}
                className={`nav-tab ${activeTab === key ? 'active' : ''}`}
                disabled={disabled}
                onClick={() => setActiveTab(key)}
              >
                <TabIcon size={15} />
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
            <UploadScreen
              fileItems={fileItems}
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
            />
          )}

          {/* ═══════════ REPORTS TAB ═══════════ */}
          {activeTab === 'reports' && processedData && (
            <>
              <div className="tab-header">
                <div className="tab-title">Analysis & Reports</div>
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
                  <div className="stat-card c-amber">
                    <div className="stat-num">{finalSummary.duplicatesRemoved}</div>
                    <div className="stat-label">Duplicates Removed</div>
                  </div>
                  <div className="stat-card c-green">
                    <div className="stat-num">{finalSummary.uniqueRecords}</div>
                    <div className="stat-label">Unique Records</div>
                  </div>
                  <div className="stat-card c-teal">
                    <div className="stat-num">
                      {/* FIX: this used to multiply by 100 * 2, which doubled the
                          percentage (e.g. a real 92% would display as 184%,
                          sometimes over 100%). It's just unique/total * 100. */}
                      {((finalSummary.uniqueRecords / finalSummary.grandTotal) * 100).toFixed(1)}%
                    </div>
                    <div className="stat-label">Success Rate</div>
                  </div>
                </div>
              )}

              {/* ── Report content area with HIGHLIGHTED selector ── */}
              <div className="report-content-area">
                <div className="report-selector-wrapper">
                  <ReportSelector
                    processedData={processedData}
                    finalSummary={finalSummary}
                    id="report-select"
                  />
                  <p className="helper-text">
                    BJ/OBJ split by age category, plus disposal‑nature breakdown.
                  </p>
                </div>
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
                      <div className={`status-dot ${item.status === 'done' ? 'done' : item.status === 'error' ? 'error' : 'pending'}`} />
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