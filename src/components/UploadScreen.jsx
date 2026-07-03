import { useRef, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import cisGuideImage from '../assets/cis-file-download-guide.png';
import './UploadScreen.css';

// ─── Icon helper ─────────────────────────────────────────────────────────────
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
const ImageIcon = (p) => <Icon {...p} d="M3 3h18v18H3zM8.5 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM21 15l-5-5L5 21" />;
const ChevronDownIcon = (p) => <Icon {...p} d="m6 9 6 6 6-6" />;
const CalendarIcon = (p) => <Icon {...p} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />;
const HelpCircleIcon = (p) => <Icon {...p} d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01" />;

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
    onProcess,                  // original – no date filter
    onProcessWithDates,         // new – with date filter
    onRemoveFile,
}) {
    const fileInputRef = useRef(null);
    const [guideOpen, setGuideOpen] = useState(false);
    const [showExample, setShowExample] = useState(false);

    // ── Date state (store as YYYY-MM-DD strings for <input type="date">) ──
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

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

    // ── Parse date from YYYY-MM-DD to Date ──
    const parseDateFromInput = (value) => {
        if (!value) return null;
        const parts = value.split('-');
        if (parts.length !== 3) return null;
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
        const date = new Date(y, m, d);
        return (date && !isNaN(date.getTime())) ? date : null;
    };

    // ── Process handler ──
    const handleProcessClick = () => {
        if (fileItems.length === 0) {
            notify('No files to process. Please upload files first.', 'danger');
            return;
        }

        const from = parseDateFromInput(fromDate);
        const to = parseDateFromInput(toDate);

        if (from && to) {
            if (to < from) {
                notify('TO date cannot be before FROM date.', 'danger');
                return;
            }
            onProcessWithDates(from, to);
        } else {
            if (fromDate || toDate) {
                notify('Both dates must be filled to apply filter. Skipping date filter.', 'warning');
            }
            onProcess();
        }
    };

    const instructionItems = [
        { label: 'Pending — Dashboard file' },
        { label: 'Pending — Query Builder file' },
        { label: 'Disposed — Dashboard file', hint: 'must use the same date range as the Disposed Query Builder file' },
        { label: 'Disposed — Query Builder file', hint: 'must use the same date range as the Disposed Dashboard file' },
    ];

    return (
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

                <ul className="file-type-list">
                    {instructionItems.map((it, i) => (
                        <li key={i}>
                            <CheckCircleIcon size={13} className="item-check" />
                            <span>{it.label}</span>
                            {it.hint && <span className="item-hint">({it.hint})</span>}
                        </li>
                    ))}
                </ul>

                <div className="important-label">Important:</div>
                <ul className="instructions-points">
                    <li>
                        <InfoIcon size={13} />
                        <span>Upload only original files downloaded from CIS Software.</span>
                    </li>
                    <li>
                        <FileTextIcon size={13} />
                        <span>Only Excel (.xlsx or .xls) files are accepted.</span>
                    </li>
                    <li>
                        <ShieldIcon size={13} />
                        <span>Do not edit or reformat the files before uploading, as this may cause incorrect processing or classification.</span>
                    </li>
                </ul>

                <button
                    type="button"
                    className="guide-toggle"
                    onClick={() => setGuideOpen(o => !o)}
                    aria-expanded={guideOpen}
                >
                    <ImageIcon size={14} />
                    <span>{guideOpen ? 'Hide' : 'View'} CIS Software file download guide</span>
                    <ChevronDownIcon size={14} className={`chevron ${guideOpen ? 'open' : ''}`} />
                </button>

                {guideOpen && (
                    <div className="guide-image-wrap">
                        <img
                            src={cisGuideImage}
                            alt="Guide showing where to download Pending and Disposed Dashboard and Query Builder reports from CIS Software"
                            className="guide-image"
                        />
                    </div>
                )}
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

            {/* ─── Process wrapper with date inputs ─── */}
            <div className="process-wrapper">
                <div className="date-input-row">
                    <label>
                        <CalendarIcon size={14} />
                        FROM
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            disabled={isProcessing}
                        />
                    </label>
                    <label>
                        <CalendarIcon size={14} />
                        TO
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            disabled={isProcessing}
                        />
                    </label>
                    <button
                        type="button"
                        className="help-btn"
                        onClick={() => setShowExample(!showExample)}
                        title="Show date filter example"
                    >
                        <HelpCircleIcon size={16} color="#00C2B2" />   {/* ← teal */}
                    </button>
                    <span className="date-hint">
                        <span className="optional">Optional</span> – leave blank to skip filter
                    </span>
                </div>

                {showExample && (
                    <div className="example-popup">
                        <h6>📘 Date Filter Example</h6>
                        <div className="example-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Mode</th>
                                        <th>Uploaded File</th>
                                        <th>Output</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><strong>Without Filter</strong></td>
                                        <td>Disposed: 01-04-2026 to 03-07-2026<br />Pending: As on 03-07-2026</td>
                                        <td>Disposed: 01-04-2026 to 03-07-2026 (No change)<br />Pending: As on 03-07-2026 (No change)</td>
                                    </tr>
                                    <tr>
                                        <td><strong>With Filter</strong><br />(FROM: 01-04-2026<br />TO: 30-06-2026)</td>
                                        <td>Disposed: 01-04-2026 to 03-07-2026<br />Pending: As on 03-07-2026</td>
                                        <td>Disposed: 01-04-2026 to <span className="highlight">30-06-2026</span><br />Pending: As on <span className="highlight">30-06-2026</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="example-note">
                            <span className="highlight">TO</span> becomes the new <strong>AS‑ON</strong> date; cases disposed after TO are moved to pending.
                        </p>
                        <button className="close-example" onClick={() => setShowExample(false)}>
                            ×   {/* ← red and highlighted */}
                        </button>
                    </div>
                )}

                <button
                    className="btn-primary"
                    disabled={isProcessing || fileItems.length === 0}
                    onClick={handleProcessClick}
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
    );
}