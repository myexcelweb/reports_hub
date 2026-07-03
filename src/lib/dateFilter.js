// src/lib/dateFilter.js

/**
 * Applies the C# date‑filtering logic to processed data.
 * 
 * @param {Array} processedData – Array of row objects from processor (must have STATUS, DATE OF REG, DATE OF DIS, UID, etc.)
 * @param {Date} fromDate – start of disposal range
 * @param {Date} toDate   – end of disposal range; also used as AS ON DATE for pending cutoff
 * @returns {Object} { pending: Array, disposed: Array, stats: Object }
 */
export function applyDateFilter(processedData, fromDate, toDate) {
    const asOnDate = toDate; // as per updated C# logic

    // 1. Ignore records registered AFTER asOnDate
    const validRecords = processedData.filter(row => {
        const regDate = parseDate(row['DATE OF REG']);
        return regDate && regDate <= asOnDate;
    });

    // Separate by current STATUS (set by processor)
    const pending = validRecords.filter(r => r.STATUS === 'PENDING');
    const disposed = validRecords.filter(r => r.STATUS === 'DISPOSE');

    // 2. Disposed but decided AFTER asOnDate → move to pending (highlighted)
    const movedToPending = disposed
        .filter(r => {
            const disDate = parseDate(r['DATE OF DIS']);
            return disDate && disDate > asOnDate;
        })
        .map(r => ({
            ...r,
            STATUS: 'PENDING',
            IsStillPendingFromDisposed: true,
            NextDate: r['DATE OF DIS'],
            Purpose: 'Pending as on date (decision after AS ON DATE)',
            // This row is now treated as PENDING, so it shouldn't still carry a
            // disposal date — that field only made sense while it was DISPOSE.
            // The original date is preserved in NextDate above (hidden from the
            // UI via META_FIELDS) in case anything needs it for reference later.
            'DATE OF DIS': null
        }));

    // 3. Disposed that are decided ON or BEFORE asOnDate, and within FROM‑TO range
    const keptDisposed = disposed.filter(r => {
        const disDate = parseDate(r['DATE OF DIS']);
        return disDate && disDate <= asOnDate && disDate >= fromDate && disDate <= toDate;
    });

    // Combine and deduplicate by UID (Case No.)
    const finalPending = deduplicateByUID([...pending, ...movedToPending]);
    const finalDisposed = deduplicateByUID(keptDisposed);

    // Stats
    const stats = {
        totalOriginal: processedData.length,
        totalValid: validRecords.length,
        pendingAfterFilter: finalPending.length,
        disposedAfterFilter: finalDisposed.length,
        movedFromDisposed: movedToPending.length,
        ignoredAfterRegistration: processedData.length - validRecords.length,
    };

    return { pending: finalPending, disposed: finalDisposed, stats };
}

// ----- helpers -----

function parseDate(value) {
    if (!value) return null;
    let d = null;
    if (typeof value === 'string') {
        // try dd-MM-yyyy or other common formats
        const parts = value.trim().split(/[-/]/);
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                d = new Date(year, month, day);
            }
        }
        if (!d || isNaN(d.getTime())) {
            d = new Date(value);
        }
    } else if (value instanceof Date) {
        d = value;
    } else if (typeof value === 'number') {
        // Excel date number
        const excelEpoch = new Date(1899, 11, 30);
        d = new Date(excelEpoch.getTime() + value * 86400000);
    }
    return (d && !isNaN(d.getTime())) ? d : null;
}

function deduplicateByUID(records) {
    const seen = new Set();
    const result = [];
    records.forEach(r => {
        const uid = (r.UID || '').trim();
        if (uid && !seen.has(uid)) {
            seen.add(uid);
            result.push(r);
        }
    });
    return result;
}