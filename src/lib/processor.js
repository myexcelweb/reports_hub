// --- ENHANCED processor.js – CNR as unique key, CASE NO for type/year, Dashboard append ---

import * as XLSX from 'xlsx';
import DuplicateRemover from './duplicate-remover.js';
import { determineSide } from './side.js';
import { normalizeCaseNo, parseCaseNo, extractYear, SOURCE_FILE_KEY, mergeSourceFiles, sourceFileFirst, caseKey } from './caseFilters.js';

/** @typedef {Object.<string, any>} DataRow */

export class CourtCaseProcessor {
	constructor() {
		this.today = new Date();
		// Map source headers → internal standard names.
		// CNR is the unique key. CASE NO holds type/number/year for CAT1.
		this.columnMapping = {
			'SR. NO.': 'SR NO',
			'SR NO.': 'SR NO',
			// Case identifiers
			CASES: 'CASE NO',
			'CASE NO.': 'CASE NO',
			'CASE NO': 'CASE NO',
			CNR: 'CNR',
			// Party / advocate
			'PARTY NAME': 'NAME',
			'PETITIONER NAME VS RESPONDENT NAME': 'NAME',
			ADVOCATE: 'ADV',
			// Dates
			'REGISTRATION DATE': 'DATE OF REG',
			'DATE OF REGISTRATION': 'DATE OF REG',
			'DATE OF DECISION': 'DATE OF DIS',
			// Disposal / status extras (Dashboard optional)
			'CONTESTED/UNCONTESTED': 'BJ OBJ',
			'DISPOSAL NATURE': 'DIS NATURE',
			'NATURE OF DISPOSAL': 'DIS NATURE',
			NATURE: 'NATURE',
			// Pending extras (Dashboard optional)
			AGE: 'SYS AGE',
			'READY / UNREADY / STAYED': 'RU',
			'NEXT DATE': 'NEXT DATE',
			'NEXT PURPOSE': 'STAGE',
			PURPOSE: 'STAGE',
			'ON SAME STAGE SINCE': 'SAME STAGE',
			'DORMANT CASE/SINE DIE CASE': 'DF',
			'DELAY REASON': 'DEALY REASON',
			// Other
			'ACT SECTION': 'ACT',
			DESIGNATION: 'DESIGNATION'
		};
		/** @type {DataRow[] | null} */
		this.processedData = null;
		/** @type {Record<string, number>} */
		this.stats = {
			totalRecords: 0,
			mainRecords: 0,
			duplicatesFound: 0,
			duplicatesRemoved: 0,
			disposeRemoved: 0,
			pendingKept: 0,
			invalidDatesCount: 0,
			dashboardAppended: 0,
			skippedNoKey: 0
		};
		this.duplicateRemover = new DuplicateRemover();
	}

	/**
	 * Reads an Excel file using xlsx, with ENHANCED merge-handling logic.
	 * @param {File} file
	 * @returns {Promise<DataRow[]>}
	 */
	async readExcelFile(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					if (!e.target || !e.target.result) {
						return reject(new Error('Failed to read file buffer.'));
					}
					const arrayBuffer = e.target.result;
					const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

					const sheetName = workbook.SheetNames[0];
					const worksheet = workbook.Sheets[sheetName];
					if (!worksheet || !worksheet['!ref']) {
						return resolve([]);
					}

					const range = XLSX.utils.decode_range(worksheet['!ref']);
					let headerRowIndex = range.s.r;

					const merges = worksheet['!merges'] || [];
					const firstRowHasMerges = merges.some(merge => merge.s.r === 0);

					if (firstRowHasMerges) {
						console.log('✓ Detected merged cells in first row - treating as title');
						headerRowIndex = 1;
					}

					let maxNonEmptyCount = 0;
					let bestHeaderRow = headerRowIndex;

					for (let R = headerRowIndex; R <= Math.min(range.e.r, headerRowIndex + 3); ++R) {
						let non_empty_count = 0;
						let distinctValues = new Set();

						for (let C = range.s.c; C <= range.e.c; ++C) {
							const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
							if (cell && cell.v !== null && cell.v !== '') {
								non_empty_count++;
								distinctValues.add(String(cell.v).trim().toUpperCase());
							}
						}

						if (non_empty_count > 3 && distinctValues.size > 3) {
							if (non_empty_count > maxNonEmptyCount) {
								maxNonEmptyCount = non_empty_count;
								bestHeaderRow = R;
							}
							break;
						}
					}

					headerRowIndex = bestHeaderRow;
					console.log(`📋 Using row ${headerRowIndex} as header (0-indexed)`);

					const jsonData = XLSX.utils.sheet_to_json(worksheet, {
						defval: null,
						range: headerRowIndex
					});

					resolve(jsonData);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					reject(new Error(`Failed to parse ${file.name}: ${message}`));
				}
			};
			reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
			reader.readAsArrayBuffer(file);
		});
	}

	/**
	 * Creates and downloads the Excel file (only processed data sheet).
	 * @param {DataRow[]} data
	 * @param {string} fileName
	 */
	downloadExcel(data, fileName) {
		if (!data) throw new Error('No processed data to download.');
		try {
			const workbook = XLSX.utils.book_new();
			const mainWorksheet = XLSX.utils.json_to_sheet(data.map(sourceFileFirst), { dateNF: 'dd-mm-yyyy' });
			XLSX.utils.book_append_sheet(workbook, mainWorksheet, 'Processed Data');
			const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
			const blob = new Blob([excelBuffer], {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			});
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = fileName;
			document.body.appendChild(link);
			link.click();
			setTimeout(() => {
				document.body.removeChild(link);
				URL.revokeObjectURL(url);
			}, 100);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to create/download Excel file: ${message}`);
		}
	}

	// --- DATA PROCESSING METHODS ---

	/** @param {string | number | Date | null | undefined} dateInput */
	tryConvertDate(dateInput) {
		if (dateInput === null || typeof dateInput === 'undefined' || String(dateInput).trim() === '') {
			return null;
		}
		let date = null;
		try {
			if (dateInput instanceof Date) {
				if (!isNaN(dateInput.getTime())) return dateInput;
			}
			if (typeof dateInput === 'number') {
				if (dateInput > 0) {
					const excelEpoch = Date.UTC(1899, 11, 30);
					const msPerDay = 24 * 60 * 60 * 1000;
					date = new Date(excelEpoch + dateInput * msPerDay);
					if (date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100) date = null;
				}
			} else if (typeof dateInput === 'string') {
				const dateStr = dateInput.trim();
				if (dateStr.includes('-') || dateStr.includes('/')) {
					const parts = dateStr.split(/[-/]/);
					if (parts.length === 3) {
						const day = parseInt(parts[0], 10);
						const month = parseInt(parts[1], 10);
						const year = parseInt(parts[2], 10);
						if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
							const fullYear = year < 100 ? (year >= 51 ? 1900 + year : 2000 + year) : year;
							if (fullYear >= 1900 && fullYear <= 2100)
								date = new Date(Date.UTC(fullYear, month - 1, day));
						}
					}
				}
				if (!date || isNaN(date.getTime())) {
					const genericDate = new Date(dateStr);
					if (!isNaN(genericDate.getTime())) date = genericDate;
					else date = null;
				}
			}
			if (date && isNaN(date.getTime())) date = null;
		} catch (error) {
			console.warn(`Error parsing date: '${dateInput}'`, error);
			date = null;
		}
		return date;
	}

	/** @param {DataRow[]} data */
	calculateAges(data) {
		let invalidDatesCount = 0;
		data.forEach((row) => {
			const regDateInput = row['DATE OF REG'];
			const disDateInput = row['DATE OF DIS'];
			const startDate = this.tryConvertDate(regDateInput);
			let endDate = this.today;
			if (!startDate) {
				invalidDatesCount++;
				row['AGE_D'] = null;
				row['AGE_Y'] = null;
				row['AGE_M'] = null;
				row['AGE_VALID'] = false;
				return;
			}
			if (disDateInput) {
				const disposalDate = this.tryConvertDate(disDateInput);
				if (disposalDate && disposalDate >= startDate) endDate = disposalDate;
			}
			const totalDays = Math.max(0, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
			row['AGE_D'] = Math.round(totalDays);
			row['AGE_Y'] = Number((totalDays / 365.25).toFixed(2));
			row['AGE_M'] = Number((totalDays / 30.44).toFixed(2));
			row['AGE_VALID'] = true;
		});
		this.stats.invalidDatesCount += invalidDatesCount;
		return data;
	}

	/** @param {DataRow[]} data */
	assignAgeCategories(data) {
		return data.map((row) => {
			if (row['AGE_VALID'] === false || row['AGE_Y'] === null || isNaN(row['AGE_Y'])) {
				row['AGE CAT1'] = 'INVALID DATE';
				row['AGE CAT2'] = 'INVALID DATE';
				row['AGE CAT3'] = 'INVALID DATE';
				return row;
			}
			const ageY = row['AGE_Y'];
			const ageM = row['AGE_M'];
			if (ageY <= 5) row['AGE CAT1'] = '0-5YR';
			else if (ageY <= 10) row['AGE CAT1'] = '5-10YR';
			else if (ageY <= 20) row['AGE CAT1'] = '10-20YR';
			else if (ageY <= 30) row['AGE CAT1'] = '20-30YR';
			else row['AGE CAT1'] = '30YR ABOVE';
			if (ageY <= 1) row['AGE CAT2'] = '0-1 YEAR';
			else if (ageY <= 2) row['AGE CAT2'] = '1-2 YEAR';
			else if (ageY <= 3) row['AGE CAT2'] = '2-3 YEAR';
			else if (ageY <= 5) row['AGE CAT2'] = '3-5 YEAR';
			else if (ageY <= 7) row['AGE CAT2'] = '5-7 YEAR';
			else if (ageY <= 10) row['AGE CAT2'] = '7-10 YEAR';
			else row['AGE CAT2'] = 'MORE THAN 10 YEARS';
			if (ageM !== null && !isNaN(ageM)) {
				if (ageM <= 3) row['AGE CAT3'] = '0-3 MONTH';
				else if (ageM <= 6) row['AGE CAT3'] = '3-6 MONTH';
				else if (ageM <= 12) row['AGE CAT3'] = '6-12 MONTH';
				else row['AGE CAT3'] = 'MORE THAN 12 MONTH';
			} else {
				row['AGE CAT3'] = 'UNKNOWN';
			}
			return row;
		});
	}

	/** @param {DataRow[]} data */
	addStatusColumn(data) {
		return data.map((row) => {
			const disDateInput = row['DATE OF DIS'];
			if (disDateInput && String(disDateInput).trim() !== '') {
				const parsedDisDate = this.tryConvertDate(disDateInput);
				row['STATUS'] = parsedDisDate ? 'DISPOSE' : 'PENDING';
			} else {
				row['STATUS'] = 'PENDING';
			}
			return row;
		});
	}

	/**
	 * Extract CAT1 (case type) from Case No. e.g. "MACEX/20/1992" → "MACEX"
	 * @param {string | undefined | null} caseNo
	 */
	extractCat1(caseNo) {
		if (!caseNo) return 'UNKNOWN';
		const { type } = parseCaseNo(caseNo);
		return type && type !== 'N/A' ? type.toUpperCase() : 'UNKNOWN';
	}

	/**
	 * UPDATED: Check for IPC SPECIAL.
	 * Returns 'IPC SPECIAL' ONLY IF:
	 *   (a) ACT contains specific IPC sections (409, 467, 465, 468, 471), OR
	 *       specific BNS sections/subsections (316(5), 336(2), 336(3), 338, 340(2)), AND
	 *   (b) CAT1 is exactly 'CC'.
	 */
	checkIpcSpecial(act, cat1) {
		if (cat1 !== 'CC') return '';
		if (!act) return '';
		const actStr = String(act);
		const ipcCodes = ['409', '467', '465', '468', '471'];
		const hasIpcSpecialCode =
			actStr.includes('INDIAN PENAL CODE') &&
			ipcCodes.some((code) => new RegExp(`(^|[^0-9])${code}([^0-9]|$)`).test(actStr));
		const bnsCodes = ['316\\(5\\)', '336\\(2\\)', '336\\(3\\)', '338', '340\\(2\\)'];
		const hasBnsCode =
			actStr.includes('THE BHARATIYA NYAYA SANHITA') &&
			bnsCodes.some((code) => new RegExp(`\\b${code}\\b`).test(actStr));
		return (hasIpcSpecialCode || hasBnsCode) ? 'IPC SPECIAL' : '';
	}

	/** @param {string} act */
	checkCaseAgainstWomen(act) {
		if (!act) return '';
		const actStr = String(act);
		const ipcCodes = ['498'];
		const hasIpcSpecialCode =
			actStr.includes('INDIAN PENAL CODE') &&
			ipcCodes.some((code) => new RegExp(`(^|[^0-9])${code}([^0-9]|$)`).test(actStr));
		const bnsCodes = ['84', '85'];
		const hasBnsCode =
			actStr.includes('THE BHARATIYA NYAYA SANHITA') &&
			bnsCodes.some((code) => new RegExp(`\\b${code}(\\([0-9]\\))?`).test(actStr));
		return hasIpcSpecialCode || hasBnsCode ? 'CASE AGAINST WOMEN' : '';
	}

	/**
	 * Check for CRMA SPECIAL (MUDDAMAL).
	 */
	checkCrmaSpecial(row) {
		const cat1 = String(row['CAT1'] || '').trim();
		const nature = String(row['NATURE'] || '').trim();
		const act = String(row['ACT'] || '').trim();

		if (cat1 !== 'CRMA J') return '';
		if (nature !== 'Other Misc. Appln.') return '';

		const hasPhrase = act.includes('THE BHARATIYA NAGARIK SURAKSHA SANHITA');
		const hasSection = /\b(497|498|503)\b/.test(act);

		return (hasPhrase && hasSection) ? 'MUDDAMAL' : '';
	}

	createCat2(row) {
		const cat1 = String(row['CAT1'] || '').trim();
		const nature = String(row['NATURE'] || '').trim();
		const ipcSpecial = String(row['IPC SPECIAL'] || '').trim();
		const crmaSpecial = String(row['CRMA SPECIAL'] || '').trim();
		const parts = [cat1, nature, ipcSpecial, crmaSpecial].filter(part => part !== '');
		return parts.length > 0 ? parts.join('/') : 'UNKNOWN';
	}

	renameCat2(cat2) {
		if (!cat2) return cat2;
		if (cat2 === 'CC/IPC/IPC SPECIAL') return 'CC/IPC SPECIAL';
		if (cat2 === 'CRMA J/Appln under Protection of Woman Domestic') return 'CRMA J/DOMESTIC';
		if (cat2 === 'CRMA J/Bail Application') return 'CRMA J/BAIL';
		if (cat2 === 'CRMA J/Other Misc. Appln.') return 'CRMA J/OTHER';
		if (cat2 === 'CRMA J/Other Misc. Appln./MUDDAMAL') return 'CRMA J/MUDDAMAL';
		if (cat2 === 'CMA SC/Appl. for Succession & Probate Certi. and Letter of Administration')
			return 'CMA SC/SUCCESSION-PROBATE-LA';
		return cat2;
	}

	/** @param {DataRow[]} data */
	mapColumnNames(data) {
		return data.map((row) => {
			const mappedRow = {};
			Object.entries(row).forEach(([key, value]) => {
				const trimmedKey = key.trim();
				const upperKey = trimmedKey.toUpperCase();
				const standardKey = this.columnMapping[/** @type {keyof typeof this.columnMapping} */ (upperKey)] || trimmedKey;
				if (!(standardKey in mappedRow)) {
					mappedRow[standardKey] = value;
				}
			});
			return mappedRow;
		});
	}

	/**
	 * Detect whether a row comes from QueryBuilder (has CNR) or Dashboard (no CNR).
	 * @param {DataRow} row
	 * @param {Set<string>} [qbFiles] Files known to be QueryBuilder exports. A row
	 *   from such a file counts as QueryBuilder even if its own CNR cell is blank,
	 *   so it isn't mistaken for a Dashboard row and silently dropped.
	 */
	isQueryBuilderRow(row, qbFiles) {
		if (qbFiles && qbFiles.has(row[SOURCE_FILE_KEY])) return true;
		const cnr = row['CNR'];
		return cnr !== undefined && cnr !== null && String(cnr).trim() !== '';
	}

	/**
	 * Append optional Dashboard columns onto matching QueryBuilder rows.
	 *
	 * Columns appended (only if empty on main row):
	 *   BJ OBJ          ← Contested/Uncontested
	 *   RU              ← Ready / Unready / Stayed
	 *   SAME STAGE      ← On same Stage since
	 *   DEALY REASON    ← Delay Reason
	 *
	 * QueryBuilder rows are the main data; Dashboard rows never become rows
	 * themselves. A PENDING QueryBuilder row only takes values from the Pending
	 * Dashboard, a DISPOSE row only from the Disposed Dashboard (STATUS must
	 * match), so the same Case No. in both Dashboard files can't cross over.
	 *
	 * Match rules:
	 *   Single court (default): match on normalized CASE NO only.
	 *   Multi court:           match on CASE NO + ESTA (from filename).
	 *
	 * @param {DataRow[]} qbRows
	 * @param {DataRow[]} dashRows
	 * @param {boolean} multiCourt
	 * @returns {DataRow[]}
	 */
	appendDashboardColumns(qbRows, dashRows, multiCourt = false) {
		if (!dashRows || dashRows.length === 0) return qbRows;

		const optionalFields = ['BJ OBJ', 'RU', 'SAME STAGE', 'DEALY REASON'];

		/** @type {Object.<string, DataRow[]>} */
		const dashIndex = {};
		dashRows.forEach((row) => {
			const caseKey = normalizeCaseNo(row['CASE NO']);
			if (!caseKey) return;
			const esta = multiCourt ? String(row['ESTA'] || '').trim().toUpperCase() : '';
			const key = multiCourt ? `${caseKey}||${esta}` : caseKey;
			if (!dashIndex[key]) dashIndex[key] = [];
			dashIndex[key].push(row);
		});

		let appended = 0;

		const result = qbRows.map((qb) => {
			const caseKey = normalizeCaseNo(qb['CASE NO']);
			if (!caseKey) return qb;

			const esta = multiCourt ? String(qb['ESTA'] || '').trim().toUpperCase() : '';
			const key = multiCourt ? `${caseKey}||${esta}` : caseKey;
			const candidates = dashIndex[key];
			if (!candidates || candidates.length === 0) return qb;

			const isEmpty = (v) => v === undefined || v === null || String(v).trim() === '';
			const ordered = candidates.filter((d) => d['STATUS'] === qb['STATUS']);
			const usedFiles = [];
			optionalFields.forEach((field) => {
				if (!isEmpty(qb[field])) return;
				const source = ordered.find((d) => !isEmpty(d[field]));
				if (source) {
					qb[field] = source[field];
					usedFiles.push(source[SOURCE_FILE_KEY]);
				}
			});
			if (usedFiles.length > 0) {
				appended++;
				qb[SOURCE_FILE_KEY] = mergeSourceFiles(qb[SOURCE_FILE_KEY], ...usedFiles);
			}
			return qb;
		});

		this.stats.dashboardAppended = appended;
		return result;
	}

	/**
	 * @param {DataRow[]} data
	 * @param {{ multiCourt?: boolean }} [options]
	 */
	processData(data, options = {}) {

		this.stats.totalRecords = data ? data.length : 0;
		this.stats.mainRecords = 0;
		this.stats.dashboardAppended = 0;
		this.stats.skippedNoKey = 0;
		if (!data || data.length === 0) {
			this.processedData = [];
			return [];
		}
		const multiCourt = !!(options && options.multiCourt);

		try {
			let processed = this.mapColumnNames(data);

			// Ensure DATE OF DIS exists
			processed = processed.map(row => {
				if (!('DATE OF DIS' in row)) {
					row['DATE OF DIS'] = null;
				}
				// CIS Dashboard exports "On same Stage since" with no space
				// between the date and the duration ("28-05-20264 months").
				const sameStage = row['SAME STAGE'];
				if (typeof sameStage === 'string') {
					row['SAME STAGE'] = sameStage.replace(/^(\d{2}-\d{2}-\d{4})(?=\d)/, '$1 ');
				}
				return row;
			});

			processed = this.addStatusColumn(processed);

			// Split QueryBuilder (main) vs Dashboard (optional append).
			// A file is QueryBuilder if any of its rows has a CNR.
			const qbFiles = new Set(
				processed.filter((r) => this.isQueryBuilderRow(r) && r[SOURCE_FILE_KEY]).map((r) => r[SOURCE_FILE_KEY])
			);
			const qbRows = processed.filter((r) => this.isQueryBuilderRow(r, qbFiles));
			const dashRows = processed.filter((r) => !this.isQueryBuilderRow(r, qbFiles));

			let mainRows;
			if (qbRows.length > 0) {
				mainRows = this.appendDashboardColumns(qbRows, dashRows, multiCourt);
			} else {
				// Fallback: Dashboard-only upload – use CASE NO as key later
				mainRows = processed;
			}

			// Main rows = QueryBuilder rows (Dashboard rows only fill in columns).
			// For a Dashboard-only upload the Dashboard rows are the main rows.
			this.stats.mainRecords = mainRows.length;

			// Deduplicate by CNR, falling back to normalized CASE NO (+ ESTA in
			// multi-court mode). CNR is already establishment-unique.
			mainRows = this.duplicateRemover.removeDuplicates(mainRows, (row) => caseKey(row, multiCourt));
			const dupStats = this.duplicateRemover.getStats();
			this.stats.duplicatesFound = dupStats.duplicatesFound;
			this.stats.duplicatesRemoved = dupStats.duplicatesRemoved;
			this.stats.disposeRemoved = dupStats.disposeRemoved;
			this.stats.pendingKept = dupStats.pendingKept;
			this.stats.skippedNoKey = dupStats.skippedNoKey;

			mainRows = this.calculateAges(mainRows);
			mainRows = this.assignAgeCategories(mainRows);
			mainRows = mainRows.map((row) => {
				const caseNo = row['CASE NO'] || '';
				const cat1 = this.extractCat1(caseNo);
				row['CAT1'] = cat1;
				row['SIDE'] = determineSide(cat1);
				row['IPC SPECIAL'] = this.checkIpcSpecial(row['ACT'], cat1);
				row['CASE AGAINST WOMEN'] = this.checkCaseAgainstWomen(row['ACT']);
				row['CRMA SPECIAL'] = this.checkCrmaSpecial(row);
				const rawCat2 = this.createCat2(row);
				row['CAT2'] = this.renameCat2(rawCat2);
				// Convenience year field (from Case No, fallback CNR)
				row['YEAR'] = extractYear(caseNo, row['CNR']);
				return row;
			});
			this.processedData = mainRows;
			return this.processedData;
		} catch (error) {
			this.processedData = null;
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to process data: ${message}`);
		}
	}

	/** @param {DataRow[]} data */
	generateSummary(data) {
		if (!data) return {};
		const summary = {
			totalRecordsProcessed: data.length,
			initialRecords: this.stats.totalRecords,
			mainRecords: this.stats.mainRecords,
			pendingCases: data.filter((row) => row.STATUS === 'PENDING').length,
			disposedCases: data.filter((row) => row.STATUS === 'DISPOSE').length,
			civilCases: data.filter((row) => row.SIDE === 'CIVIL').length,
			criminalCases: data.filter((row) => row.SIDE === 'CRIMINAL').length,
			unknownSideCases: data.filter((row) => row.SIDE === 'UNKNOWN').length,
			avgAgePending: 'NA',
			oldestCase: { age: 0, caseNo: 'N/A', cnr: 'N/A' },
			duplicatesFound: this.stats.duplicatesFound,
			duplicatesRemoved: this.stats.duplicatesRemoved,
			recordsWithInvalidDates: this.stats.invalidDatesCount,
			dashboardAppended: this.stats.dashboardAppended,
			skippedNoKey: this.stats.skippedNoKey
		};
		const validPendingCases = data.filter(
			(row) => row.STATUS === 'PENDING' && row.AGE_VALID === true && typeof row.AGE_Y === 'number'
		);
		if (validPendingCases.length > 0) {
			const totalAgeYears = validPendingCases.reduce((sum, row) => sum + (Number(row.AGE_Y) || 0), 0);
			summary.avgAgePending = (totalAgeYears / validPendingCases.length).toFixed(2);

			const oldest = validPendingCases.reduce(
				(maxAgeCase, currentCase) => {
					const currentAge = Number(currentCase.AGE_Y) || 0;
					if (currentAge > maxAgeCase.age) {
						return {
							age: currentAge,
							caseNo: String(currentCase['CASE NO'] || 'Unknown'),
							cnr: String(currentCase.CNR || '')
						};
					}
					return maxAgeCase;
				},
				{ age: -1, caseNo: '', cnr: '' }
			);

			if (oldest.age !== -1) summary.oldestCase = oldest;
		}
		return summary;
	}
}

// --- END OF FILE processor.js ---
