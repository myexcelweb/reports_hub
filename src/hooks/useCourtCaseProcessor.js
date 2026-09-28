// src/hooks/useCourtCaseProcessor.js
import { useState } from 'react';
import { CourtCaseProcessor as Processor } from '../lib/processor';
import { applyDateFilter } from '../lib/dateFilter';
import { extractEstaFromFileName, SOURCE_FILE_KEY } from '../lib/caseFilters';

// Tag every row with the file it came from. ESTA (establishment code from the
// file name) is only needed for multi-court matching, so single-court rows
// don't get an ESTA column at all.
const stampRows = (fileData, fileName, multiCourt) => {
    const esta = multiCourt ? extractEstaFromFileName(fileName) : null;
    const rows = fileData.map(row => ({
        ...row,
        ...(multiCourt ? { ESTA: esta || (row.ESTA || null) } : {}),
        [SOURCE_FILE_KEY]: fileName,
    }));
    return { rows, esta };
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

    const warnSkipped = (count) => {
        if (count > 0) {
            addNotification(`${count} row${count > 1 ? 's' : ''} skipped — no CNR or Case No. (blank/total rows in the Excel file?)`, 'warning');
        }
    };

    // ---- Original processFiles (without date filter) ----
    // options: { multiCourt?: boolean }
    const processFiles = async (files, updateFileStatusesCallback, options = {}) => {
        if (!files || files.length === 0) {
            addNotification('No files selected. Please choose files first.', 'danger');
            return;
        }

        const multiCourt = !!(options && options.multiCourt);

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
                    const { rows: stamped, esta } = stampRows(fileData, file.name, multiCourt);
                    allData = allData.concat(stamped);
                    fileStats.push({ fileName: file.name, status: 'Read', rowCount: fileData.length, esta: esta || null, error: null });
                    updateFileStatusesCallback(prev => prev.map(fs => fs.name === file.name ? { ...fs, status: 'success', processedRows: fileData.length, esta: esta || null } : fs));
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
        setProgressText(multiCourt ? 'Processing combined data (multi-court)...' : 'Processing combined data...');
        const data = processor.processData(allData, { multiCourt });
        setProcessedData(data);
        warnSkipped(processor.stats.skippedNoKey);

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
            // Total = main (QueryBuilder) rows, so Total − Duplicates − Skipped = Unique
            grandTotal: summary.mainRecords,
            duplicatesRemoved: summary.duplicatesRemoved,
            uniqueRecords: summary.totalRecordsProcessed,
            skippedNoKey: processor.stats.skippedNoKey,
            statusSideSummary
        });

        setProgress(100);
        setProgressText('Processing complete!');
        setIsProcessing(false);
    };

    // ---- NEW: processFilesWithDates (applies date filter) ----
    // options: { multiCourt?: boolean }
    const processFilesWithDates = async (files, fromDate, toDate, updateFileStatusesCallback, options = {}) => {
        if (!files || files.length === 0) {
            addNotification('No files selected. Please choose files first.', 'danger');
            return;
        }

        const multiCourt = !!(options && options.multiCourt);

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
                    const { rows: stamped, esta } = stampRows(fileData, file.name, multiCourt);
                    allData = allData.concat(stamped);
                    fileStats.push({ fileName: file.name, status: 'Read', rowCount: fileData.length, esta: esta || null, error: null });
                    updateFileStatusesCallback(prev => prev.map(fs => fs.name === file.name ? { ...fs, status: 'success', processedRows: fileData.length, esta: esta || null } : fs));
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
        setProgressText(multiCourt ? 'Processing combined data (multi-court)...' : 'Processing combined data...');
        const processed = processor.processData(allData, { multiCourt });
        warnSkipped(processor.stats.skippedNoKey);

        // --- Apply date filter ---
        setProgress(85);
        setProgressText('Applying date filter...');
        const { pending, disposed, stats } = applyDateFilter(processed, fromDate, toDate, { multiCourt });

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
            grandTotal: processor.stats.mainRecords,
            // Cases the FROM/TO filter left out (registered after TO, or disposed
            // outside FROM–TO) so Total − Duplicates − Skipped − this = Unique.
            dateFilterExcluded: processed.length - filteredData.length,
            // FIX: this used to be `stats.totalOriginal - stats.totalValid`, which is
            // actually the count of records IGNORED because they were registered
            // after the AS-ON (TO) date — not duplicates at all. Real duplicate
            // merging already happened inside processor.processData() above, and
            // the correct count lives on processor.stats.duplicatesRemoved (same
            // value the non-date-filter path already used via summary.duplicatesRemoved).
            duplicatesRemoved: processor.stats.duplicatesRemoved,
            uniqueRecords: filteredData.length,
            skippedNoKey: processor.stats.skippedNoKey,
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

    // ---- Download all reports (one workbook, one sheet per report table) ----
    const downloadAllReports = async () => {
        if (!processedData || processedData.length === 0) {
            addNotification('No data to export. Please process files first.', 'danger');
            return;
        }
        try {
            const { exportAllReportsToExcel } = await import('../lib/exportAllReports');
            await exportAllReportsToExcel(processedData);
            addNotification('All reports exported successfully!', 'success');
        } catch (error) {
            addNotification('Failed to export reports: ' + error.message, 'danger');
        }
    };

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