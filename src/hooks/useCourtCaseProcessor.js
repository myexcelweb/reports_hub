// src/hooks/useCourtCaseProcessor.js
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { CourtCaseProcessor as Processor } from '../lib/processor';
import {
    filterCases,
    AGE_CAT2_LIST,
    AGE_CAT3_LIST,
    normalizeContested,
    isLokAdalat,
    extractYear,
    normalizeRU
} from '../lib/caseFilters';
import { buildBalanceSheet } from '../lib/balanceSheet';
import { applyDateFilter } from '../lib/dateFilter';  // NEW import

// Helper to sanitize sheet names – replace invalid Excel sheet name characters
const sanitizeSheetName = (name) => {
    if (!name) return 'Sheet';
    return name.replace(/[:\/\\\?\[\]\*]/g, '_');
};

// Helper to extract numeric part from UID (like "CMA SC/46/2024" → "46")
const extractNumberFromUID = (uid) => {
    if (!uid || typeof uid !== 'string') return '';
    const parts = uid.split('/');
    if (parts.length >= 3) return parts[parts.length - 2];
    return uid;
};

// Helper: get last N years from a sorted array
const getLastNYears = (years, n) => {
    const sorted = [...years].sort((a, b) => Number(a) - Number(b));
    return sorted.slice(-n);
};

export const useCourtCaseProcessor = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [processedData, setProcessedData] = useState(null);
    const [finalSummary, setFinalSummary] = useState(null);
    const [notifications, setNotifications] = useState([]);

    const addNotification = (message, variant = 'info') => {
        const id = Date.now() + Math.random();
        setNotifications(prev => [...prev, { id, message, variant }]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
    };

    // ---- Original processFiles (without date filter) ----
    const processFiles = async (files, updateFileStatusesCallback) => {
        if (!files || files.length === 0) {
            addNotification('No files selected. Please choose files first.', 'danger');
            return;
        }

        setIsProcessing(true);
        setFinalSummary(null);
        setProgress(0);
        setProgressText('Starting...');

        const processor = new Processor();
        let allData = [];
        const fileStats = [];
        const totalFiles = files.length;

        for (let i = 0; i < totalFiles; i++) {
            const file = files[i];
            setProgressText(`Reading file ${i + 1}/${totalFiles}: ${file.name}`);
            setProgress(Math.round(((i + 1) / totalFiles) * 50));
            updateFileStatusesCallback(prev => prev.map(fs => fs.name === file.name ? { ...fs, status: 'reading' } : fs));

            try {
                const fileData = await processor.readExcelFile(file);
                if (fileData && fileData.length > 0) {
                    allData = allData.concat(fileData);
                    fileStats.push({ fileName: file.name, status: 'Read', rowCount: fileData.length, error: null });
                    updateFileStatusesCallback(prev => prev.map(fs => fs.name === file.name ? { ...fs, status: 'success', rowCount: fileData.length } : fs));
                } else {
                    fileStats.push({ fileName: file.name, status: 'Empty', rowCount: 0, error: null });
                    updateFileStatusesCallback(prev => prev.map(fs => fs.name === file.name ? { ...fs, status: 'empty' } : fs));
                }
            } catch (fileError) {
                const message = fileError instanceof Error ? fileError.message : String(fileError);
                fileStats.push({ fileName: file.name, status: 'Error', rowCount: 0, error: message });
                updateFileStatusesCallback(prev => prev.map(fs => fs.name === file.name ? { ...fs, status: 'error', error: message } : fs));
            }
        }

        if (allData.length === 0) {
            setFinalSummary({
                fileStats,
                grandTotal: 0,
                duplicatesRemoved: 0,
                uniqueRecords: 0,
                statusSideSummary: { pendingCivil: 0, pendingCriminal: 0, disposeCivil: 0, disposeCriminal: 0 }
            });
            setIsProcessing(false);
            return;
        }

        setProgress(75);
        setProgressText('Processing combined data...');
        const data = processor.processData(allData);
        setProcessedData(data);

        setProgress(90);
        setProgressText('Generating summary...');
        const summary = processor.generateSummary(data);

        const statusSideSummary = {
            pendingCivil: 0,
            pendingCriminal: 0,
            disposeCivil: 0,
            disposeCriminal: 0,
        };
        for (const row of data) {
            if (row.STATUS === 'PENDING') {
                if (row.SIDE === 'CIVIL') statusSideSummary.pendingCivil++;
                else if (row.SIDE === 'CRIMINAL') statusSideSummary.pendingCriminal++;
            } else if (row.STATUS === 'DISPOSE') {
                if (row.SIDE === 'CIVIL') statusSideSummary.disposeCivil++;
                else if (row.SIDE === 'CRIMINAL') statusSideSummary.disposeCriminal++;
            }
        }

        setFinalSummary({
            fileStats,
            grandTotal: summary.initialRecords,
            duplicatesRemoved: summary.duplicatesRemoved,
            uniqueRecords: summary.totalRecordsProcessed,
            statusSideSummary
        });

        setProgress(100);
        setProgressText('Processing complete!');
        setIsProcessing(false);
    };

    // ---- NEW: processFilesWithDates (applies date filter) ----
    const processFilesWithDates = async (files, fromDate, toDate, updateFileStatusesCallback) => {
        if (!files || files.length === 0) {
            addNotification('No files selected. Please choose files first.', 'danger');
            return;
        }

        setIsProcessing(true);
        setFinalSummary(null);
        setProgress(0);
        setProgressText('Starting...');

        const processor = new Processor();
        let allData = [];
        const fileStats = [];
        const totalFiles = files.length;

        for (let i = 0; i < totalFiles; i++) {
            const file = files[i];
            setProgressText(`Reading file ${i + 1}/${totalFiles}: ${file.name}`);
            setProgress(Math.round(((i + 1) / totalFiles) * 50));
            updateFileStatusesCallback(prev => prev.map(fs => fs.name === file.name ? { ...fs, status: 'reading' } : fs));

            try {
                const fileData = await processor.readExcelFile(file);
                if (fileData && fileData.length > 0) {
                    allData = allData.concat(fileData);
                    fileStats.push({ fileName: file.name, status: 'Read', rowCount: fileData.length, error: null });
                    updateFileStatusesCallback(prev => prev.map(fs => fs.name === file.name ? { ...fs, status: 'success', rowCount: fileData.length } : fs));
                } else {
                    fileStats.push({ fileName: file.name, status: 'Empty', rowCount: 0, error: null });
                    updateFileStatusesCallback(prev => prev.map(fs => fs.name === file.name ? { ...fs, status: 'empty' } : fs));
                }
            } catch (fileError) {
                const message = fileError instanceof Error ? fileError.message : String(fileError);
                fileStats.push({ fileName: file.name, status: 'Error', rowCount: 0, error: message });
                updateFileStatusesCallback(prev => prev.map(fs => fs.name === file.name ? { ...fs, status: 'error', error: message } : fs));
            }
        }

        if (allData.length === 0) {
            setFinalSummary({
                fileStats,
                grandTotal: 0,
                duplicatesRemoved: 0,
                uniqueRecords: 0,
                statusSideSummary: { pendingCivil: 0, pendingCriminal: 0, disposeCivil: 0, disposeCriminal: 0 }
            });
            setIsProcessing(false);
            return;
        }

        setProgress(75);
        setProgressText('Processing combined data...');
        const processed = processor.processData(allData);

        // --- Apply date filter ---
        setProgress(85);
        setProgressText('Applying date filter...');
        const { pending, disposed, stats } = applyDateFilter(processed, fromDate, toDate);

        // Merge pending and disposed back into one array for reporting (optional)
        // We'll keep them separate but we can also combine with a flag
        const filteredData = [...pending, ...disposed];
        setProcessedData(filteredData);

        setProgress(90);
        setProgressText('Generating summary...');
        // Compute summary based on filtered data
        const statusSideSummary = {
            pendingCivil: pending.filter(r => r.SIDE === 'CIVIL').length,
            pendingCriminal: pending.filter(r => r.SIDE === 'CRIMINAL').length,
            disposeCivil: disposed.filter(r => r.SIDE === 'CIVIL').length,
            disposeCriminal: disposed.filter(r => r.SIDE === 'CRIMINAL').length,
        };

        setFinalSummary({
            fileStats,
            grandTotal: stats.totalValid,
            // FIX: this used to be `stats.totalOriginal - stats.totalValid`, which is
            // actually the count of records IGNORED because they were registered
            // after the AS-ON (TO) date — not duplicates at all. Real duplicate
            // merging already happened inside processor.processData() above, and
            // the correct count lives on processor.stats.duplicatesRemoved (same
            // value the non-date-filter path already used via summary.duplicatesRemoved).
            duplicatesRemoved: processor.stats.duplicatesRemoved,
            uniqueRecords: filteredData.length,
            statusSideSummary,
            dateFilterStats: stats, // extra detail (includes stats.ignoredAfterRegistration)
        });

        setProgress(100);
        setProgressText('Processing complete!');
        setIsProcessing(false);
    };

    // ---- Download only processed data ----
    const downloadExcel = () => {
        if (!processedData) {
            addNotification('No processed data to download.', 'danger');
            return;
        }
        try {
            const processor = new Processor();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `processed-court-cases-${timestamp}.xlsx`;
            processor.downloadExcel(processedData, fileName);
        } catch (error) {
            addNotification('Failed to download: ' + error.message, 'danger');
        }
    };

    // ---- Download all reports ----
    const downloadAllReports = () => {
        if (!processedData || processedData.length === 0) {
            addNotification('No data to export. Please process files first.', 'danger');
            return;
        }

        try {
            const wb = XLSX.utils.book_new();
            const data = processedData;

            const appendSheet = (rows, rawName) => {
                const sheetName = sanitizeSheetName(rawName);
                const ws = XLSX.utils.aoa_to_sheet(rows);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            };

            // 1. All Data
            const allDataSheet = XLSX.utils.json_to_sheet(data);
            const sheetNameAll = sanitizeSheetName('All Data');
            XLSX.utils.book_append_sheet(wb, allDataSheet, sheetNameAll);

            // 2. Status Analysis
            const statusRows = [];
            const sides = ['CIVIL', 'CRIMINAL'];
            sides.forEach(side => {
                const sideData = filterCases(data, { SIDE: side });
                const pending = sideData.filter(r => r.STATUS === 'PENDING').length;
                const disposed = sideData.filter(r => r.STATUS === 'DISPOSE').length;
                statusRows.push([side, 'Pending', pending]);
                statusRows.push([side, 'Disposed', disposed]);
                statusRows.push([]);
            });
            appendSheet([['Side', 'Status', 'Count'], ...statusRows], 'Status');

            // 3. Disposal Nature
            const natureRows = [];
            sides.forEach(side => {
                const disposed = filterCases(data, { STATUS: 'DISPOSE', SIDE: side });
                const contested = disposed.filter(r => normalizeContested(r['BJ OBJ']) === 'CONTESTED').length;
                const uncontested = disposed.filter(r => normalizeContested(r['BJ OBJ']) === 'UNCONTESTED').length;
                const lokAdalat = disposed.filter(r => isLokAdalat(r)).length;
                natureRows.push([side, 'Contested', contested]);
                natureRows.push([side, 'Uncontested', uncontested]);
                natureRows.push([side, 'Lok Adalat', lokAdalat]);
                natureRows.push([]);
            });
            appendSheet([['Side', 'Nature', 'Count'], ...natureRows], 'Disposal Nature');

            // 4. PART1
            const part1Data = buildPart1SheetData(data);
            appendSheet(part1Data, 'PART1');

            // 5. PART2
            const part2Data = buildPart2SheetData(data);
            appendSheet(part2Data, 'PART2');

            // 6. PART3
            const part3Data = buildPart3SheetData(data);
            appendSheet(part3Data, 'PART3');

            // 7. B1B2 Ready/Unready (both tables)
            const ruData = buildReadyUnreadySheetData(data, 'CIVIL');
            appendSheet(ruData, 'B1B2 Ready-Unready');

            // 8. B1B2 Civil Year-wise
            const ywData = buildYearWiseSheetData(data, 'CIVIL');
            appendSheet(ywData, 'B1B2 Civil Year-wise');

            // 9. B1B2 Criminal Age-wise
            const caData = buildCriminalAgeSheetData(data);
            appendSheet(caData, 'B1B2 Criminal Age');

            // 10. B1B2 Criminal Year-wise
            const ywcData = buildYearWiseSheetData(data, 'CRIMINAL');
            appendSheet(ywcData, 'B1B2 Criminal Year');

            // 11. Balance Sheet - Civil
            const civilBalanceData = buildCivilBalanceSheetData(data);
            appendSheet(civilBalanceData, 'Balance Sheet - Civil');

            // 12. Balance Sheet - Criminal
            const criminalBalanceData = buildCriminalBalanceSheetData(data);
            appendSheet(criminalBalanceData, 'Balance Sheet - Criminal');

            // Write file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `Court-Case-Reports-${timestamp}.xlsx`;
            XLSX.writeFile(wb, fileName);
            addNotification('All reports exported successfully!', 'success');

        } catch (error) {
            addNotification('Failed to export reports: ' + error.message, 'danger');
        }
    };

    // ===== Helper builders (unchanged from original) =====

    // ---- PART1 ----
    function buildPart1SheetData(processedData) {
        const disposedCivil = filterCases(processedData, { STATUS: 'DISPOSE', SIDE: 'CIVIL' });
        const pivot1 = {};
        const laCounts = {};
        disposedCivil.forEach(row => {
            const cat2 = row.CAT2 || 'UNKNOWN';
            const age = row['AGE CAT2'] || 'UNKNOWN';
            if (!AGE_CAT2_LIST.includes(age)) return;
            const key = `${age}_${normalizeContested(row['BJ OBJ']) === 'CONTESTED' ? 'BJ' : 'OBJ'}`;
            pivot1[cat2] ??= {};
            pivot1[cat2][key] = (pivot1[cat2][key] || 0) + 1;
            if (isLokAdalat(row['DIS NATURE'])) {
                laCounts[cat2] = (laCounts[cat2] || 0) + 1;
            }
        });
        const allCat2 = Object.keys(pivot1).sort();
        const rows = [];
        const header = ['Case Category'];
        AGE_CAT2_LIST.forEach(a => { header.push(`${a}(BJ)`, `${a}(OBJ)`); });
        header.push('TOTAL(BJ)', 'TOTAL(OBJ)', 'GRAND TOTAL', 'Disposal in L.A.');
        rows.push(header);
        let grand1 = { TOTAL_BJ: 0, TOTAL_OBJ: 0, GRAND_TOTAL: 0, LA_TOTAL: 0 };
        AGE_CAT2_LIST.forEach(a => { grand1[`${a}_BJ`] = 0; grand1[`${a}_OBJ`] = 0; });
        allCat2.forEach(cat2 => {
            const row = pivot1[cat2] || {};
            const totalBJ = AGE_CAT2_LIST.reduce((s, a) => s + (row[`${a}_BJ`] || 0), 0);
            const totalOBJ = AGE_CAT2_LIST.reduce((s, a) => s + (row[`${a}_OBJ`] || 0), 0);
            const la = laCounts[cat2] || 0;
            const cols = [cat2];
            AGE_CAT2_LIST.forEach(a => { cols.push(row[`${a}_BJ`] || 0, row[`${a}_OBJ`] || 0); });
            cols.push(totalBJ, totalOBJ, totalBJ + totalOBJ, la);
            rows.push(cols);
            AGE_CAT2_LIST.forEach(a => { grand1[`${a}_BJ`] += row[`${a}_BJ`] || 0; grand1[`${a}_OBJ`] += row[`${a}_OBJ`] || 0; });
            grand1.TOTAL_BJ += totalBJ;
            grand1.TOTAL_OBJ += totalOBJ;
            grand1.GRAND_TOTAL += totalBJ + totalOBJ;
            grand1.LA_TOTAL += la;
        });
        const grandRow = ['GRAND TOTAL'];
        AGE_CAT2_LIST.forEach(a => { grandRow.push(grand1[`${a}_BJ`], grand1[`${a}_OBJ`]); });
        grandRow.push(grand1.TOTAL_BJ, grand1.TOTAL_OBJ, grand1.GRAND_TOTAL, grand1.LA_TOTAL);
        rows.push(grandRow);
        // Second table
        const uncontested = disposedCivil.filter(r => normalizeContested(r['BJ OBJ']) === 'UNCONTESTED');
        const pivot2 = {};
        const allNatures = new Set();
        uncontested.forEach(row => {
            const cat2 = row.CAT2 || 'UNKNOWN';
            const nature = String(row['DIS NATURE'] || 'UNKNOWN').trim();
            allNatures.add(nature);
            pivot2[cat2] ??= {};
            pivot2[cat2][nature] = (pivot2[cat2][nature] || 0) + 1;
        });
        const sortedNatures = Array.from(allNatures).sort();
        rows.push([]);
        const header2 = ['Case Category', ...sortedNatures, 'TOTAL'];
        rows.push(header2);
        const grand2 = Object.fromEntries([...sortedNatures.map(n => [n, 0]), ['TOTAL', 0]]);
        allCat2.forEach(cat2 => {
            const row = pivot2[cat2] || {};
            const total = sortedNatures.reduce((s, n) => s + (row[n] || 0), 0);
            const cols = [cat2];
            sortedNatures.forEach(n => { cols.push(row[n] || 0); grand2[n] += row[n] || 0; });
            cols.push(total);
            grand2.TOTAL += total;
            rows.push(cols);
        });
        const grandRow2 = ['GRAND TOTAL'];
        sortedNatures.forEach(n => grandRow2.push(grand2[n]));
        grandRow2.push(grand2.TOTAL);
        rows.push(grandRow2);
        return rows;
    }

    // ---- PART2 ----
    function buildPart2SheetData(processedData) {
        const disposedCivil = filterCases(processedData, { STATUS: 'DISPOSE', SIDE: 'CIVIL' });
        const pivot = {};
        const laCounts = {};
        disposedCivil.forEach(row => {
            const cat2 = row.CAT2 || 'UNKNOWN';
            const age = row['AGE CAT3'] || 'UNKNOWN';
            if (!AGE_CAT3_LIST.includes(age)) return;
            const key = `${age}_${normalizeContested(row['BJ OBJ']) === 'CONTESTED' ? 'BJ' : 'OBJ'}`;
            pivot[cat2] ??= {};
            pivot[cat2][key] = (pivot[cat2][key] || 0) + 1;
            if (isLokAdalat(row['DIS NATURE'])) {
                laCounts[cat2] = (laCounts[cat2] || 0) + 1;
            }
        });
        const allCat2 = Object.keys(pivot).sort();
        const rows = [];
        const header = ['Case Category'];
        AGE_CAT3_LIST.forEach(a => { header.push(`${a}(BJ)`, `${a}(OBJ)`); });
        header.push('TOTAL(BJ)', 'TOTAL(OBJ)', 'GRAND TOTAL', 'Disposal in L.A.');
        rows.push(header);
        let grand1 = { TOTAL_BJ: 0, TOTAL_OBJ: 0, GRAND_TOTAL: 0, LA_TOTAL: 0 };
        AGE_CAT3_LIST.forEach(a => { grand1[`${a}_BJ`] = 0; grand1[`${a}_OBJ`] = 0; });
        allCat2.forEach(cat2 => {
            const row = pivot[cat2] || {};
            const totalBJ = AGE_CAT3_LIST.reduce((s, a) => s + (row[`${a}_BJ`] || 0), 0);
            const totalOBJ = AGE_CAT3_LIST.reduce((s, a) => s + (row[`${a}_OBJ`] || 0), 0);
            const la = laCounts[cat2] || 0;
            const cols = [cat2];
            AGE_CAT3_LIST.forEach(a => { cols.push(row[`${a}_BJ`] || 0, row[`${a}_OBJ`] || 0); });
            cols.push(totalBJ, totalOBJ, totalBJ + totalOBJ, la);
            rows.push(cols);
            AGE_CAT3_LIST.forEach(a => { grand1[`${a}_BJ`] += row[`${a}_BJ`] || 0; grand1[`${a}_OBJ`] += row[`${a}_OBJ`] || 0; });
            grand1.TOTAL_BJ += totalBJ;
            grand1.TOTAL_OBJ += totalOBJ;
            grand1.GRAND_TOTAL += totalBJ + totalOBJ;
            grand1.LA_TOTAL += la;
        });
        const grandRow = ['GRAND TOTAL'];
        AGE_CAT3_LIST.forEach(a => { grandRow.push(grand1[`${a}_BJ`], grand1[`${a}_OBJ`]); });
        grandRow.push(grand1.TOTAL_BJ, grand1.TOTAL_OBJ, grand1.GRAND_TOTAL, grand1.LA_TOTAL);
        rows.push(grandRow);
        return rows;
    }

    // ---- PART3 ----
    function buildPart3SheetData(processedData) {
        const disposedCriminal = filterCases(processedData, { STATUS: 'DISPOSE', SIDE: 'CRIMINAL' });
        const pivot = {};
        const laCounts = {};
        disposedCriminal.forEach(row => {
            const cat2 = row.CAT2 || 'UNKNOWN';
            const age = row['AGE CAT3'] || 'UNKNOWN';
            if (!AGE_CAT3_LIST.includes(age)) return;
            const key = `${age}_${normalizeContested(row['BJ OBJ']) === 'CONTESTED' ? 'BJ' : 'OBJ'}`;
            pivot[cat2] ??= {};
            pivot[cat2][key] = (pivot[cat2][key] || 0) + 1;
            if (isLokAdalat(row['DIS NATURE'])) {
                laCounts[cat2] = (laCounts[cat2] || 0) + 1;
            }
        });
        const allCat2 = Object.keys(pivot).sort();
        const rows = [];
        const header = ['Case Category'];
        AGE_CAT3_LIST.forEach(a => { header.push(`${a}(BJ)`, `${a}(OBJ)`); });
        header.push('TOTAL(BJ)', 'TOTAL(OBJ)', 'GRAND TOTAL', 'Disposal in L.A.');
        rows.push(header);
        let grand1 = { TOTAL_BJ: 0, TOTAL_OBJ: 0, GRAND_TOTAL: 0, LA_TOTAL: 0 };
        AGE_CAT3_LIST.forEach(a => { grand1[`${a}_BJ`] = 0; grand1[`${a}_OBJ`] = 0; });
        allCat2.forEach(cat2 => {
            const row = pivot[cat2] || {};
            const totalBJ = AGE_CAT3_LIST.reduce((s, a) => s + (row[`${a}_BJ`] || 0), 0);
            const totalOBJ = AGE_CAT3_LIST.reduce((s, a) => s + (row[`${a}_OBJ`] || 0), 0);
            const la = laCounts[cat2] || 0;
            const cols = [cat2];
            AGE_CAT3_LIST.forEach(a => { cols.push(row[`${a}_BJ`] || 0, row[`${a}_OBJ`] || 0); });
            cols.push(totalBJ, totalOBJ, totalBJ + totalOBJ, la);
            rows.push(cols);
            AGE_CAT3_LIST.forEach(a => { grand1[`${a}_BJ`] += row[`${a}_BJ`] || 0; grand1[`${a}_OBJ`] += row[`${a}_OBJ`] || 0; });
            grand1.TOTAL_BJ += totalBJ;
            grand1.TOTAL_OBJ += totalOBJ;
            grand1.GRAND_TOTAL += totalBJ + totalOBJ;
            grand1.LA_TOTAL += la;
        });
        const grandRow = ['GRAND TOTAL'];
        AGE_CAT3_LIST.forEach(a => { grandRow.push(grand1[`${a}_BJ`], grand1[`${a}_OBJ`]); });
        grandRow.push(grand1.TOTAL_BJ, grand1.TOTAL_OBJ, grand1.GRAND_TOTAL, grand1.LA_TOTAL);
        rows.push(grandRow);
        return rows;
    }

    // ---- B1B2 Ready/Unready (two tables) ----
    function buildReadyUnreadySheetData(processedData, side) {
        const filtered = filterCases(processedData, { STATUS: 'PENDING', SIDE: side });
        if (filtered.length === 0) return [['No data']];

        const fullPivot = {};
        const allYearsSet = new Set();
        filtered.forEach(row => {
            const year = extractYear(row.UID);
            if (!year) return;
            allYearsSet.add(year);
            const ru = normalizeRU(row.RU);
            if (!ru) return;
            const cat2 = String(row.CAT2 || 'UNKNOWN').trim();
            fullPivot[cat2] ??= {};
            fullPivot[cat2][year] ??= { READY: 0, UNREADY: 0 };
            fullPivot[cat2][year][ru]++;
        });
        const allYears = Array.from(allYearsSet).sort((a, b) => Number(a) - Number(b));
        const cat2Keys = Object.keys(fullPivot).sort();

        // Table 1: Last 5 Years
        const last5Years = getLastNYears(allYears, 5);
        const preYear = last5Years.length > 0 ? last5Years[0] : null;

        const last5Rows = [];
        const grandLast5 = { preReady: 0, preUnready: 0, READY_TOTAL: 0, UNREADY_TOTAL: 0, GRAND_TOTAL: 0 };
        const yearTotalsLast5 = Object.fromEntries(last5Years.map(y => [y, { READY: 0, UNREADY: 0 }]));

        cat2Keys.forEach(cat2 => {
            const rowData = { cat2, preReady: 0, preUnready: 0, READY_TOTAL: 0, UNREADY_TOTAL: 0, GRAND_TOTAL: 0 };
            allYears.forEach(year => {
                const { READY = 0, UNREADY = 0 } = (fullPivot[cat2] && fullPivot[cat2][year]) || {};
                if (preYear && Number(year) < Number(preYear)) {
                    rowData.preReady += READY;
                    rowData.preUnready += UNREADY;
                    grandLast5.preReady += READY;
                    grandLast5.preUnready += UNREADY;
                } else if (last5Years.includes(year)) {
                    rowData[`${year}_READY`] = READY;
                    rowData[`${year}_UNREADY`] = UNREADY;
                    yearTotalsLast5[year].READY += READY;
                    yearTotalsLast5[year].UNREADY += UNREADY;
                }
            });
            rowData.READY_TOTAL = rowData.preReady + last5Years.reduce((sum, y) => sum + (rowData[`${y}_READY`] || 0), 0);
            rowData.UNREADY_TOTAL = rowData.preUnready + last5Years.reduce((sum, y) => sum + (rowData[`${y}_UNREADY`] || 0), 0);
            rowData.GRAND_TOTAL = rowData.READY_TOTAL + rowData.UNREADY_TOTAL;
            grandLast5.READY_TOTAL += rowData.READY_TOTAL;
            grandLast5.UNREADY_TOTAL += rowData.UNREADY_TOTAL;
            grandLast5.GRAND_TOTAL += rowData.GRAND_TOTAL;
            last5Rows.push(rowData);
        });

        const last5Headers = ['Case Category'];
        last5Headers.push(`pre-${preYear} (R)`, `pre-${preYear} (U)`);
        last5Years.forEach(y => { last5Headers.push(`${y} (R)`, `${y} (U)`); });
        last5Headers.push('TOTAL (R)', 'TOTAL (U)', 'GRAND TOTAL');

        const last5TableRows = [last5Headers];
        last5Rows.forEach(row => {
            const cols = [row.cat2, row.preReady, row.preUnready];
            last5Years.forEach(y => { cols.push(row[`${y}_READY`] || 0, row[`${y}_UNREADY`] || 0); });
            cols.push(row.READY_TOTAL, row.UNREADY_TOTAL, row.GRAND_TOTAL);
            last5TableRows.push(cols);
        });
        const last5GrandRow = ['GRAND TOTAL', grandLast5.preReady, grandLast5.preUnready];
        last5Years.forEach(y => { last5GrandRow.push(yearTotalsLast5[y].READY, yearTotalsLast5[y].UNREADY); });
        last5GrandRow.push(grandLast5.READY_TOTAL, grandLast5.UNREADY_TOTAL, grandLast5.GRAND_TOTAL);
        last5TableRows.push(last5GrandRow);

        // Table 2: All Years
        const fullRows = [];
        const grandFull = { READY_TOTAL: 0, UNREADY_TOTAL: 0, GRAND_TOTAL: 0 };
        const yearTotalsFull = Object.fromEntries(allYears.map(y => [y, { READY: 0, UNREADY: 0 }]));

        cat2Keys.forEach(cat2 => {
            const rowData = { cat2, READY_TOTAL: 0, UNREADY_TOTAL: 0, GRAND_TOTAL: 0 };
            allYears.forEach(year => {
                const { READY = 0, UNREADY = 0 } = (fullPivot[cat2] && fullPivot[cat2][year]) || {};
                rowData[`${year}_READY`] = READY;
                rowData[`${year}_UNREADY`] = UNREADY;
                rowData.READY_TOTAL += READY;
                rowData.UNREADY_TOTAL += UNREADY;
                yearTotalsFull[year].READY += READY;
                yearTotalsFull[year].UNREADY += UNREADY;
            });
            rowData.GRAND_TOTAL = rowData.READY_TOTAL + rowData.UNREADY_TOTAL;
            grandFull.READY_TOTAL += rowData.READY_TOTAL;
            grandFull.UNREADY_TOTAL += rowData.UNREADY_TOTAL;
            grandFull.GRAND_TOTAL += rowData.GRAND_TOTAL;
            fullRows.push(rowData);
        });

        const fullHeaders = ['Case Category'];
        allYears.forEach(y => { fullHeaders.push(`${y} (R)`, `${y} (U)`); });
        fullHeaders.push('TOTAL (R)', 'TOTAL (U)', 'GRAND TOTAL');

        const fullTableRows = [fullHeaders];
        fullRows.forEach(row => {
            const cols = [row.cat2];
            allYears.forEach(y => { cols.push(row[`${y}_READY`] || 0, row[`${y}_UNREADY`] || 0); });
            cols.push(row.READY_TOTAL, row.UNREADY_TOTAL, row.GRAND_TOTAL);
            fullTableRows.push(cols);
        });
        const fullGrandRow = ['GRAND TOTAL'];
        allYears.forEach(y => { fullGrandRow.push(yearTotalsFull[y].READY, yearTotalsFull[y].UNREADY); });
        fullGrandRow.push(grandFull.READY_TOTAL, grandFull.UNREADY_TOTAL, grandFull.GRAND_TOTAL);
        fullTableRows.push(fullGrandRow);

        // Combine both tables
        return [...last5TableRows, [], ...fullTableRows];
    }

    // ---- Year-wise Total (single table) ----
    function buildYearWiseSheetData(processedData, side) {
        const filtered = filterCases(processedData, { STATUS: 'PENDING', SIDE: side });
        const pivot = {};
        filtered.forEach(row => {
            const year = extractYear(row.UID);
            if (!year) return;
            const cat2 = String(row.CAT2 || 'UNKNOWN').trim();
            pivot[cat2] ??= {};
            pivot[cat2][year] = (pivot[cat2][year] || 0) + 1;
        });
        const rows = [];
        const cat2Keys = Object.keys(pivot).sort();
        const years = new Set();
        Object.values(pivot).forEach(catData => Object.keys(catData).forEach(y => years.add(y)));
        const sortedYears = Array.from(years).sort();
        const header = ['Case Category', ...sortedYears, 'TOTAL'];
        rows.push(header);
        const grandTotals = Object.fromEntries([...sortedYears.map(y => [y, 0]), ['TOTAL', 0]]);
        cat2Keys.forEach(cat2 => {
            const row = pivot[cat2];
            const cols = [cat2];
            let total = 0;
            sortedYears.forEach(year => {
                const count = row[year] || 0;
                cols.push(count);
                total += count;
                grandTotals[year] += count;
            });
            cols.push(total);
            grandTotals.TOTAL += total;
            rows.push(cols);
        });
        const grandRow = ['GRAND TOTAL'];
        sortedYears.forEach(year => grandRow.push(grandTotals[year]));
        grandRow.push(grandTotals.TOTAL);
        rows.push(grandRow);
        return rows;
    }

    // ---- Criminal Age-wise (single table) ----
    function buildCriminalAgeSheetData(processedData) {
        const filtered = filterCases(processedData, { STATUS: 'PENDING', SIDE: 'CRIMINAL' });
        const pivot = {};
        filtered.forEach(row => {
            const cat2 = row.CAT2 || 'UNKNOWN';
            const age = row['AGE CAT3'] || 'UNKNOWN';
            pivot[cat2] ??= {};
            pivot[cat2][age] = (pivot[cat2][age] || 0) + 1;
        });
        const rows = [];
        const cat2Keys = Object.keys(pivot).sort();
        const ages = new Set();
        Object.values(pivot).forEach(catData => Object.keys(catData).forEach(a => ages.add(a)));
        const sortedAges = Array.from(ages).sort();
        const header = ['Case Category', ...sortedAges, 'TOTAL'];
        rows.push(header);
        const grandTotals = Object.fromEntries([...sortedAges.map(a => [a, 0]), ['TOTAL', 0]]);
        cat2Keys.forEach(cat2 => {
            const row = pivot[cat2];
            const cols = [cat2];
            let total = 0;
            sortedAges.forEach(age => {
                const count = row[age] || 0;
                cols.push(count);
                total += count;
                grandTotals[age] += count;
            });
            cols.push(total);
            grandTotals.TOTAL += total;
            rows.push(cols);
        });
        const grandRow = ['GRAND TOTAL'];
        sortedAges.forEach(age => grandRow.push(grandTotals[age]));
        grandRow.push(grandTotals.TOTAL);
        rows.push(grandRow);
        return rows;
    }

    // ---- Balance Sheet - Civil ----
    function buildCivilBalanceSheetData(processedData) {
        const civil = buildBalanceSheet(processedData, 'CIVIL');
        const rows = [
            ['Category', 'Year', 'Case Numbers']
        ];
        if (civil && civil.groupedData) {
            Object.keys(civil.groupedData).sort().forEach(cat => {
                const years = Object.keys(civil.groupedData[cat]).sort((a, b) => Number(a) - Number(b));
                years.forEach((year, idx) => {
                    const nums = civil.groupedData[cat][year].map(u => extractNumberFromUID(u)).join(', ');
                    rows.push([idx === 0 ? cat : '', year, nums]);
                });
            });
        }
        if (civil) {
            rows.push([]);
            rows.push(['Total Civil Pending Cases:', civil.totalCases]);
        }
        return rows;
    }

    // ---- Balance Sheet - Criminal ----
    function buildCriminalBalanceSheetData(processedData) {
        const criminal = buildBalanceSheet(processedData, 'CRIMINAL');
        const rows = [
            ['Category', 'Year', 'Case Numbers']
        ];
        if (criminal && criminal.groupedData) {
            Object.keys(criminal.groupedData).sort().forEach(cat => {
                const years = Object.keys(criminal.groupedData[cat]).sort((a, b) => Number(a) - Number(b));
                years.forEach((year, idx) => {
                    const nums = criminal.groupedData[cat][year].map(u => extractNumberFromUID(u)).join(', ');
                    rows.push([idx === 0 ? cat : '', year, nums]);
                });
            });
        }
        if (criminal) {
            rows.push([]);
            rows.push(['Total Criminal Pending Cases:', criminal.totalCases]);
        }
        return rows;
    }

    return {
        isProcessing,
        progress,
        progressText,
        processedData,
        finalSummary,
        notifications,
        setNotifications,
        processFiles,               // original (no date filter)
        processFilesWithDates,      // new (with FROM/TO dates)
        downloadExcel,
        downloadAllReports,
    };
};