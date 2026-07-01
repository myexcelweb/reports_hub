import { useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';

// ─── Icon helper (feather-style, matches App.jsx) ───────────────────────────
const Icon = ({ d, size = 20, color = 'currentColor', strokeWidth = 2, ...rest }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
        <path d={d} />
    </svg>
);

const UploadCloudIcon = (p) => <Icon {...p} d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M12 12v9M9 17l3-3 3 3" />;
const FileTextIcon = (p) => <Icon {...p} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6M9 9h1" />;
const CheckCircleIcon = (p) => <Icon {...p} d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" />;
const AlertTriangleIcon = (p) => <Icon {...p} d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />;
const InfoIcon = (p) => <Icon {...p} d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01" />;
const XIcon = (p) => <Icon {...p} d="M18 6 6 18M6 6l12 12" />;
const ZapIcon = (p) => <Icon {...p} d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />;
const ShieldIcon = (p) => <Icon {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
const LinkIcon = (p) => <Icon {...p} d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />;

// ─── Helpers for file detection ─────────────────────────────────────────────
const KNOWN_COLUMNS = [
    'case no.',
    'next date',
    'act section',
    'cases',
    'date of decision',
    'nature of disposal',
    'disposal nature',
];

const safeString = (cell) => {
    if (cell === null || cell === undefined) return '';
    return String(cell).trim();
};

const findHeaderRow = (rows) => {
    for (let rowIdx = 0; rowIdx < Math.min(rows.length, 30); rowIdx++) {
        const row = rows[rowIdx] || [];
        for (const cell of row) {
            const str = safeString(cell);
            if (str && KNOWN_COLUMNS.includes(str.toLowerCase())) {
                return rowIdx;
            }
        }
    }
    return -1;
};

const detectFileType = (headers) => {
    const normalised = headers.map(h => safeString(h).toLowerCase());
    const has = (col) => normalised.includes(col.toLowerCase());

    if (has('Case No.')) {
        if (has('Next Date')) {
            return 'PENDING QUERIYBUILDER';
        } else {
            return 'DISPOSE QURYBUILDER';
        }
    } else if (has('Cases')) {
        if (has('Date of Decision')) {
            return 'DISPOSE DASHBOARD';
        } else {
            return 'PENDING DESHBOARD';
        }
    }
    return null;
};

const readExcelMetadata = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

                let headerRowIdx = findHeaderRow(rows);
                let headers = [];
                let rowCount = 0;

                if (headerRowIdx === -1) {
                    headerRowIdx = 0;
                    headers = rows[0] || [];
                    rowCount = rows.filter((r, idx) => idx > 0 && r.some(cell => safeString(cell) !== '')).length;
                } else {
                    headers = rows[headerRowIdx] || [];
                    rowCount = rows.filter((r, idx) => idx > headerRowIdx && r.some(cell => safeString(cell) !== '')).length;
                }

                resolve({ headers, rowCount });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

// ─── Component ──────────────────────────────────────────────────────────────
export default function UploadScreen({
    fileItems,
    setFileItems,
    warnings,
    setWarnings,
    isDragging,
    setIsDragging,
    isProcessing,
    progress,
    progressText,
    notify,
    onProcess,
    onRemoveFile,
}) {
    const fileInputRef = useRef(null);

    // ── Compute warnings ──
    const computeWarnings = (items) => {
        const warningsList = [];
        const counts = {
            'PENDING QUERIYBUILDER': 0,
            'PENDING DESHBOARD': 0,
            'DISPOSE QURYBUILDER': 0,
            'DISPOSE DASHBOARD': 0,
        };
        const rowCounts = {
            'PENDING QUERIYBUILDER': [],
            'PENDING DESHBOARD': [],
            'DISPOSE QURYBUILDER': [],
            'DISPOSE DASHBOARD': [],
        };
        const unknownFiles = [];

        items.forEach(item => {
            if (item.type) {
                if (counts.hasOwnProperty(item.type)) {
                    counts[item.type]++;
                    if (item.rowCount !== undefined) {
                        rowCounts[item.type].push(item.rowCount);
                    }
                } else {
                    unknownFiles.push(item.name);
                }
            } else {
                unknownFiles.push(item.name);
            }
        });

        if (unknownFiles.length > 0) {
            warningsList.push({
                type: 'error',
                title: 'Unrecognised file type',
                message: `We couldn't classify ${unknownFiles.length > 1 ? 'these files' : 'this file'}: ${unknownFiles.join(', ')}. Please confirm ${unknownFiles.length > 1 ? "they're" : "it's"} an original, unmodified CIS export before processing.`,
            });
        }

        const displayName = (type) => {
            const map = {
                'PENDING QUERIYBUILDER': 'PENDING Query Builder',
                'PENDING DESHBOARD': 'PENDING Dashboard',
                'DISPOSE QURYBUILDER': 'DISPOSE Query Builder',
                'DISPOSE DASHBOARD': 'DISPOSE Dashboard',
            };
            return map[type] || type;
        };

        const pairs = [
            { type1: 'PENDING QUERIYBUILDER', type2: 'PENDING DESHBOARD' },
            { type1: 'DISPOSE QURYBUILDER', type2: 'DISPOSE DASHBOARD' },
        ];
        pairs.forEach(({ type1, type2 }) => {
            if (counts[type1] > 0 && counts[type2] === 0) {
                const title = `${displayName(type2)} file missing`;
                const message =
                    `You've uploaded the ${displayName(type1)} file — now add the matching ${displayName(type2)} file so both sides can be cross-checked.`;
                warningsList.push({ type: 'error', title, message });
            }
            if (counts[type2] > 0 && counts[type1] === 0) {
                const title = `${displayName(type1)} file missing`;
                const message =
                    `You've uploaded the ${displayName(type2)} file — now add the matching ${displayName(type1)} file so both sides can be cross-checked.`;
                warningsList.push({ type: 'error', title, message });
            }
        });

        const checkMismatch = (type1, type2) => {
            if (counts[type1] > 0 && counts[type2] > 0) {
                const rows1 = rowCounts[type1][0];
                const rows2 = rowCounts[type2][0];
                if (rows1 !== undefined && rows2 !== undefined && rows1 !== rows2) {
                    warningsList.push({
                        type: 'error',
                        title: 'Entry counts don\u2019t match',
                        message: `${displayName(type1)} has ${rows1} entries but ${displayName(type2)} has ${rows2}. Please double-check both files cover the same date range before processing.`,
                    });
                }
            }
        };
        checkMismatch('PENDING QUERIYBUILDER', 'PENDING DESHBOARD');
        checkMismatch('DISPOSE QURYBUILDER', 'DISPOSE DASHBOARD');

        const totalPending = counts['PENDING QUERIYBUILDER'] + counts['PENDING DESHBOARD'];
        const totalDisposed = counts['DISPOSE QURYBUILDER'] + counts['DISPOSE DASHBOARD'];
        if (totalPending > 0 && totalDisposed === 0) {
            warningsList.push({
                type: 'info',
                title: null,
                message: 'Only PENDING files are uploaded, so DISPOSED statements will be left blank in the report.',
            });
        }
        if (totalDisposed > 0 && totalPending === 0) {
            warningsList.push({
                type: 'info',
                title: null,
                message: 'Only DISPOSED files are uploaded, so PENDING statements will be left blank in the report.',
            });
        }

        return warningsList;
    };

    useEffect(() => {
        const newWarnings = computeWarnings(fileItems);
        setWarnings(newWarnings);
    }, [fileItems]);

    const handleFileSelection = async (selectedFiles) => {
        const accepted = Array.from(selectedFiles).filter(f =>
            f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
        );
        if (accepted.length === 0) {
            notify('Only .xlsx and .xls files are accepted', 'danger');
            return;
        }

        const newItems = [];
        for (const file of accepted) {
            try {
                const { headers, rowCount } = await readExcelMetadata(file);
                const type = detectFileType(headers);
                newItems.push({
                    file,
                    name: file.name,
                    type,
                    rowCount,
                    status: 'pending',
                    size: file.size,
                });
            } catch (err) {
                newItems.push({
                    file,
                    name: file.name,
                    type: null,
                    rowCount: 0,
                    status: 'error',
                    size: file.size,
                    readError: true,
                });
            }
        }

        if (newItems.length > 0) {
            setFileItems(prev => [...prev, ...newItems]);
            notify(`${newItems.length} file(s) added`, 'success');
        }
    };

    const instructionItems = [
        { label: 'Pending', tone: 'pending', detail: 'Dashboard file' },
        { label: 'Pending', tone: 'pending', detail: 'Query Builder file' },
        { label: 'Disposed', tone: 'disposed', detail: 'Dashboard file', hint: 'Same date range as Query Builder' },
        { label: 'Disposed', tone: 'disposed', detail: 'Query Builder file', hint: 'Same date range as Dashboard' },
    ];

    return (
        <>
            {/* ─── Embedded CSS ─── */}
            <style>{`
        .upload-wrapper {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: calc(100vh - 160px);
        }
        .upload-hero {
          text-align: center;
          padding: 1rem 0 0.5rem;
        }
        .upload-hero-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(0,194,178,.1);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 0.5rem;
        }
        .upload-hero h2 {
          font-size: 1.55rem;
          font-weight: 800;
          letter-spacing: -.03em;
          color: var(--navy, #0F1E35);
          margin-bottom: 0.2rem;
        }
        .upload-hero p {
          color: var(--muted, #64748B);
          font-size: .87rem;
          margin-top: 0.1rem;
        }

        /* ── Instructions card ── */
        .upload-instructions {
          background: var(--white, #FFFFFF);
          border-radius: 14px;
          border: 1px solid var(--border, #E2E8F0);
          padding: 1rem 1.15rem;
          margin-bottom: 0.85rem;
          box-shadow: 0 2px 10px rgba(15,30,53,.05);
          flex-shrink: 0;
        }
        .upload-instructions-head {
          display: flex;
          align-items: center;
          gap: .5rem;
          margin-bottom: 0.7rem;
        }
        .upload-instructions-head .head-icon {
          width: 26px;
          height: 26px;
          border-radius: 7px;
          background: rgba(0,194,178,.12);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .upload-instructions h5 {
          font-weight: 700;
          color: var(--navy, #0F1E35);
          font-size: 0.88rem;
          letter-spacing: -.01em;
        }
        .instructions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          margin-bottom: 0.7rem;
        }
        .instruction-item {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          background: var(--slate, #F0F4F8);
          border-radius: 9px;
          padding: 0.55rem 0.7rem;
        }
        .instruction-item .item-top {
          display: flex;
          align-items: center;
          gap: .45rem;
        }
        .instruction-item .item-check {
          color: var(--teal, #00C2B2);
          flex-shrink: 0;
        }
        .instruction-item .item-badge {
          font-size: .62rem;
          font-weight: 800;
          letter-spacing: .04em;
          text-transform: uppercase;
          padding: 0.15rem 0.45rem;
          border-radius: 99px;
          flex-shrink: 0;
        }
        .instruction-item .item-badge.badge-pending {
          background: rgba(0,194,178,.14);
          color: #007A70;
        }
        .instruction-item .item-badge.badge-disposed {
          background: rgba(245,166,35,.16);
          color: #92600C;
        }
        .instruction-item .item-detail {
          font-size: .8rem;
          font-weight: 600;
          color: var(--text, #1A202C);
        }
        .instruction-item .item-hint {
          display: flex;
          align-items: center;
          gap: .35rem;
          font-size: .7rem;
          color: var(--muted, #64748B);
          padding-top: 0.35rem;
          margin-top: 0.05rem;
          border-top: 1px dashed var(--border, #E2E8F0);
        }
        .instruction-item .item-hint svg {
          flex-shrink: 0;
          opacity: .7;
        }
        .instructions-footnote {
          display: flex;
          align-items: flex-start;
          gap: .4rem;
          font-size: .74rem;
          color: var(--muted, #64748B);
          line-height: 1.45;
        }
        .instructions-footnote svg {
          flex-shrink: 0;
          margin-top: 2px;
          color: var(--muted, #64748B);
        }
        .instructions-note {
          display: flex;
          align-items: center;
          gap: .4rem;
          font-size: .74rem;
          color: #92400E;
          background: #FFFBEB;
          border: 1px solid #FDE68A;
          border-radius: 8px;
          padding: 0.45rem 0.65rem;
          margin-top: 0.6rem;
        }
        @media (max-width: 600px) {
          .instructions-grid {
            grid-template-columns: 1fr;
          }
        }

        /* ── Dropzone ── */
        .dropzone {
          border: 2px dashed var(--border, #E2E8F0);
          border-radius: 14px;
          padding: 1.6rem 1.5rem;
          text-align: center;
          cursor: pointer;
          transition: all .22s;
          background: var(--white, #FFFFFF);
          flex-shrink: 0;
        }
        .dropzone:hover,
        .dropzone.dragging {
          border-color: var(--teal, #00C2B2);
          background: rgba(0,194,178,.05);
          transform: translateY(-1px);
          box-shadow: 0 6px 22px rgba(0,194,178,.12);
        }
        .dropzone-icon {
          width: 52px;
          height: 52px;
          background: rgba(0,194,178,.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 0.6rem;
          color: var(--teal, #00C2B2);
        }
        .dropzone h3 {
          font-size: 1.02rem;
          font-weight: 700;
          color: var(--text, #1A202C);
          margin-bottom: 0.15rem;
          letter-spacing: -.01em;
        }
        .dropzone p {
          font-size: .8rem;
          color: var(--muted, #64748B);
          margin-top: 0.1rem;
        }

        /* ── File chips ── */
        .file-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.65rem;
          flex-shrink: 0;
          max-height: 96px;
          overflow-y: auto;
          padding: 2px;
        }
        .file-chip {
          display: flex;
          align-items: center;
          gap: .45rem;
          background: var(--white, #FFFFFF);
          border: 1px solid var(--border, #E2E8F0);
          border-radius: 99px;
          padding: .35rem .5rem .35rem .5rem;
          font-size: .76rem;
          font-weight: 500;
          color: var(--text, #1A202C);
          box-shadow: 0 1px 4px rgba(0,0,0,.05);
          transition: box-shadow .15s, border-color .15s;
        }
        .file-chip:hover {
          border-color: var(--teal, #00C2B2);
          box-shadow: 0 2px 10px rgba(0,194,178,.12);
        }
        .file-chip .chip-icon-wrap {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: rgba(16,185,129,.12);
          color: var(--green, #10B981);
        }
        .file-chip.chip-unknown-file .chip-icon-wrap {
          background: rgba(245,166,35,.14);
          color: var(--amber, #F5A623);
        }
        .file-chip .chip-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 130px;
        }
        .file-chip .chip-size {
          color: var(--muted, #64748B);
          font-size: .68rem;
          flex-shrink: 0;
        }
        .file-chip .chip-unknown {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 0.66rem;
          font-weight: 600;
          color: var(--amber, #F5A623);
          margin-left: 0.1rem;
          flex-shrink: 0;
        }
        .chip-remove {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--muted, #64748B);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color .15s, background .15s;
          padding: 3px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .chip-remove:hover {
          color: var(--white, #fff);
          background: var(--red, #EF4444);
        }

        /* ── Warning / info cards ── */
        .warning-box {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          margin-top: 0.85rem;
          flex-shrink: 0;
        }
        .warning-card {
          border-radius: 10px;
          padding: 0.7rem 0.9rem;
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          box-shadow: 0 1px 6px rgba(0,0,0,.04);
        }
        .warning-card .card-icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .warning-card .card-body {
          flex: 1;
          min-width: 0;
        }
        .warning-card .card-title {
          font-weight: 700;
          font-size: .82rem;
          margin-bottom: 0.1rem;
          letter-spacing: -.005em;
        }
        .warning-card .card-message {
          font-size: .78rem;
          line-height: 1.4;
          font-weight: 400;
        }
        .warning-card.card-warning {
          background: #FFFBEB;
          border: 1px solid #FDE68A;
        }
        .warning-card.card-warning .card-icon {
          background: rgba(245,166,35,.18);
          color: #B45309;
        }
        .warning-card.card-warning .card-title { color: #92400E; }
        .warning-card.card-warning .card-message { color: #92400E; }

        .warning-card.card-info {
          background: #ECFEFF;
          border: 1px solid #A5F3FC;
        }
        .warning-card.card-info .card-icon {
          background: rgba(6,182,212,.16);
          color: #0E7490;
        }
        .warning-card.card-info .card-message {
          color: #155E75;
        }

        /* ── Process button ── */
        .process-wrapper {
          margin-top: auto;
          padding-top: 0.75rem;
          position: sticky;
          bottom: 0;
          background: var(--slate, #F0F4F8);
          z-index: 5;
          padding-bottom: 0.25rem;
        }
        .btn-primary {
          background: linear-gradient(135deg, var(--teal, #00C2B2), var(--teal-d, #009D90));
          color: var(--navy, #0F1E35);
          border: none;
          border-radius: 12px;
          padding: .75rem 1.5rem;
          font-size: .92rem;
          font-weight: 700;
          cursor: pointer;
          transition: all .18s;
          display: flex;
          align-items: center;
          gap: .55rem;
          letter-spacing: -.01em;
          width: 100%;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0,194,178,.22);
        }
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1.5px);
          box-shadow: 0 8px 22px rgba(0,194,178,.32);
        }
        .btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn-primary:disabled {
          opacity: .45;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .progress-wrap {
          background: #E2E8F0;
          border-radius: 99px;
          height: 6px;
          overflow: hidden;
        }
        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, var(--teal, #00C2B2), var(--amber, #F5A623));
          border-radius: 99px;
          transition: width .35s ease;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: .75; }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .mt-sm { margin-top: .5rem; }
        .flex { display: flex; }
        .items-center { align-items: center; }
      `}</style>

            {/* ─── JSX ─── */}
            <div className="upload-wrapper">
                <div className="upload-hero">
                    <div className="upload-hero-icon">
                        <UploadCloudIcon size={22} color="var(--teal, #00C2B2)" />
                    </div>
                    <h2>Upload Court Case Files</h2>
                    <p>Drop your Excel files below — we'll handle deduplication and analytics automatically.</p>
                </div>

                <div className="upload-instructions">
                    <div className="upload-instructions-head">
                        <div className="head-icon">
                            <FileTextIcon size={14} color="var(--teal, #00C2B2)" />
                        </div>
                        <h5>Upload Instructions</h5>
                    </div>

                    <div className="instructions-grid">
                        {instructionItems.map((it, i) => (
                            <div key={i} className="instruction-item">
                                <div className="item-top">
                                    <CheckCircleIcon size={14} className="item-check" />
                                    <span className={`item-badge badge-${it.tone}`}>{it.label}</span>
                                    <span className="item-detail">{it.detail}</span>
                                </div>
                                {it.hint && (
                                    <div className="item-hint">
                                        <LinkIcon size={11} />
                                        <span>{it.hint}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <p className="instructions-footnote">
                        <InfoIcon size={13} />
                        <span>Upload only original CIS-downloaded files. Any Excel file is accepted — we'll flag it if we can't classify it.</span>
                    </p>

                    <div className="instructions-note">
                        <ShieldIcon size={13} />
                        <span>Please don't edit or reformat files before uploading — this can break classification.</span>
                    </div>
                </div>

                <div
                    className={`dropzone ${isDragging ? 'dragging' : ''}`}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => { e.preventDefault(); setIsDragging(false); handleFileSelection(e.dataTransfer.files); }}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" multiple
                        className="d-none" style={{ display: 'none' }}
                        onChange={e => e.target.files && handleFileSelection(e.target.files)} />

                    <div className="dropzone-icon">
                        <UploadCloudIcon size={24} />
                    </div>
                    <h3>Drag & drop Excel files here</h3>
                    <p>or click to browse · .xlsx and .xls supported</p>
                </div>

                {fileItems.length > 0 && (
                    <div className="file-chips">
                        {fileItems.map((item, i) => (
                            <div key={i} className={`file-chip ${!item.type ? 'chip-unknown-file' : ''}`}>
                                <span className="chip-icon-wrap">
                                    <FileTextIcon size={12} />
                                </span>
                                <span className="chip-name" title={item.name}>{item.name}</span>
                                <span className="chip-size">{(item.size / 1024).toFixed(0)} KB</span>
                                {!item.type && (
                                    <span className="chip-unknown">
                                        <AlertTriangleIcon size={11} /> unknown
                                    </span>
                                )}
                                <button className="chip-remove" onClick={() => onRemoveFile(i)} title="Remove file">
                                    <XIcon size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {warnings.length > 0 && (
                    <div className="warning-box">
                        {warnings.map((w, idx) => {
                            if (w.type === 'info') {
                                return (
                                    <div key={idx} className="warning-card card-info">
                                        <span className="card-icon"><InfoIcon size={15} /></span>
                                        <div className="card-body">
                                            <div className="card-message">{w.message}</div>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div key={idx} className="warning-card card-warning">
                                    <span className="card-icon"><AlertTriangleIcon size={15} /></span>
                                    <div className="card-body">
                                        {w.title && <div className="card-title">{w.title}</div>}
                                        <div className="card-message">{w.message}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="process-wrapper">
                    <button
                        className="btn-primary"
                        disabled={isProcessing || fileItems.length === 0}
                        onClick={onProcess}
                    >
                        {isProcessing ? (
                            <><ZapIcon size={16} className="spin" />Processing…</>
                        ) : (
                            <><ZapIcon size={16} />Process {fileItems.length > 0 ? `${fileItems.length} File${fileItems.length > 1 ? 's' : ''}` : 'Files'}</>
                        )}
                    </button>

                    {isProcessing && (
                        <div className="mt-sm">
                            <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '.25rem', fontSize: '.75rem', color: 'var(--muted)' }}>
                                <span>{progressText}</span>
                                <strong style={{ color: 'var(--teal)' }}>{progress}%</strong>
                            </div>
                            <div className="progress-wrap">
                                <div className="progress-bar" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
