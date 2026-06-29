// --- ENHANCED processor.js with Smart Merge Detection ---

import * as XLSX from 'xlsx';
import DuplicateRemover from './duplicate-remover.js';
import { determineSide } from './side.js';

/** @typedef {Object.<string, any>} DataRow */

export class CourtCaseProcessor {
	constructor() {
		this.today = new Date();
		this.columnMapping = {
			'SR. NO.': 'SR NO',
			CASES: 'UID',
			'PARTY NAME': 'NAME',
			'REGISTRATION DATE': 'DATE OF REG',
			'DATE OF REGISTRATION': 'DATE OF REG',
			'DATE OF DECISION': 'DATE OF DIS',
			'CONTESTED/UNCONTESTED': 'BJ OBJ',
			'DISPOSAL NATURE': 'DIS NATURE',
			NATURE: 'NATURE',
			AGE: 'SYS AGE',
			'READY / UNREADY / STAYED': 'RU',
			'NEXT DATE': 'NEXT DATE',
			'NEXT PURPOSE': 'STAGE',
			'ON SAME STAGE SINCE': 'SAME STAGE',
			'DORMANT CASE/SINE DIE CASE': 'DF',
			'DELAY REASON': 'DEALY REASON',
			'CASE NO.': 'UID',
			'PETITIONER NAME VS RESPONDENT NAME': 'NAME',
			ADVOCATE: 'ADV',
			'NATURE OF DISPOSAL': 'DIS NATURE',
			'ACT SECTION': 'ACT',
			PURPOSE: 'STAGE'
		};
		/** @type {DataRow[] | null} */
		this.processedData = null;
		/** @type {Record<string, number>} */
		this.stats = {
			totalRecords: 0,
			duplicatesFound: 0,
			duplicatesRemoved: 0,
			pendingRemoved: 0,
			disposeKept: 0,
			invalidDatesCount: 0
		};
		this.duplicateRemover = new DuplicateRemover();
	}

	/**
	 * Reads an Excel file using xlsx, with ENHANCED merge-handling logic.
	 * Intelligently detects and skips merged title rows.
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
						return resolve([]); // Resolve with empty array if sheet is empty
					}

					// --- ENHANCED MERGE-HANDLING LOGIC ---
					const range = XLSX.utils.decode_range(worksheet['!ref']);
					let headerRowIndex = range.s.r;

					// Strategy 1: Check if first row has merges (likely a title)
					const merges = worksheet['!merges'] || [];
					const firstRowHasMerges = merges.some(merge => merge.s.r === 0);

					if (firstRowHasMerges) {
						console.log('✓ Detected merged cells in first row - treating as title');
						headerRowIndex = 1; // Skip first row
					}

					// Strategy 2: Look for first row with multiple distinct column headers
					// This catches cases where title row isn't merged but is still a title
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

						// A proper header row should have:
						// 1. Multiple non-empty cells (>3)
						// 2. Distinct values (not repeated title text)
						if (non_empty_count > 3 && distinctValues.size > 3) {
							if (non_empty_count > maxNonEmptyCount) {
								maxNonEmptyCount = non_empty_count;
								bestHeaderRow = R;
							}
							break; // Found a good header row
						}
					}

					// Use the best header row we found
					headerRowIndex = bestHeaderRow;

					console.log(`📋 Using row ${headerRowIndex} as header (0-indexed)`);

					/** @type {DataRow[]} */
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
	 * Creates and downloads the Excel file using the xlsx library.
	 * NOW ONLY CONTAINS THE PROCESSED DATA SHEET - NO PIVOT TABLES OR BALANCE SHEETS
	 * @param {DataRow[]} data
	 * @param {string} fileName
	 */
	downloadExcel(data, fileName) {
		if (!data) throw new Error('No processed data to download.');
		try {
			const workbook = XLSX.utils.book_new();

			// ONLY add the main processed data sheet
			const mainWorksheet = XLSX.utils.json_to_sheet(data, { dateNF: 'dd-mm-yyyy' });
			XLSX.utils.book_append_sheet(workbook, mainWorksheet, 'Processed Data');

			// PIVOT TABLES AND BALANCE SHEETS REMOVED - ONLY PROCESSED DATA

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

	/** @param {string | undefined | null} uid */
	extractCat1(uid) {
		if (!uid) return 'UNKNOWN';
		const uidStr = String(uid).trim();
		const slashPos = uidStr.indexOf('/');
		return slashPos > 0 ? uidStr.substring(0, slashPos).toUpperCase() : 'UNKNOWN';
	}

	/** @param {string} act */
	checkIpcSpecial(act) {
		if (!act) return '';
		const actStr = String(act);
		const ipcCodes = ['409', '467', '465', '468', '471'];
		const hasIpcSpecialCode =
			actStr.includes('INDIAN PENAL CODE') &&
			ipcCodes.some((code) => new RegExp(`(^|[^0-9])${code}([^0-9]|$)`).test(actStr));
		const bnsCodes = ['316', '336', '338', '340'];
		const hasBnsCode =
			actStr.includes('THE BHARATIYA NYAYA SANHITA') &&
			bnsCodes.some((code) => new RegExp(`\\b${code}(\\([0-9]\\))?`).test(actStr));
		return hasIpcSpecialCode || hasBnsCode ? 'IPC SPECIAL' : '';
	}

	/** @param {string} act */
	checkCaseAgainstWomen(act) {
		if (!act) return '';
		const actStr = String(act);
		const ipcCodes = ['498'];
		const hasIpcSpecialCode =
			actStr.includes('INDIAN PENAL CODE') &&
			ipcCodes.some((code) => new RegExp(`(^|[^0-9])${code}([^0-9]|$)`).test(actStr));
		const bnsCodes = ['84'];
		const hasBnsCode =
			actStr.includes('THE BHARATIYA NYAYA SANHITA') &&
			bnsCodes.some((code) => new RegExp(`\\b${code}(\\([0-9]\\))?`).test(actStr));
		return hasIpcSpecialCode || hasBnsCode ? 'CASE AGAINST WOMEN' : '';
	}

	/** @param {DataRow} row */
	createCat2(row) {
		const cat1 = String(row['CAT1'] || '').trim();
		const nature = String(row['NATURE'] || '').trim();
		const ipcSpecial = String(row['IPC SPECIAL'] || '').trim();
		const parts = [cat1, nature, ipcSpecial].filter((part) => part !== '');
		return parts.length > 0 ? parts.join('/') : 'UNKNOWN';
	}

	/** @param {DataRow[]} data */
	mapColumnNames(data) {
		return data.map((row) => {
			/** @type {DataRow} */
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

	/** @param {DataRow[]} data */
	processData(data) {
		this.stats.totalRecords = data ? data.length : 0;
		if (!data || data.length === 0) {
			this.processedData = [];
			return [];
		}
		try {
			let processed = this.mapColumnNames(data);
			processed = this.addStatusColumn(processed);
			processed = this.duplicateRemover.removeDuplicates(processed, 'UID');
			const dupStats = this.duplicateRemover.getStats();
			this.stats.duplicatesFound = dupStats.duplicatesFound;
			this.stats.duplicatesRemoved = dupStats.duplicatesRemoved;
			this.stats.pendingRemoved = dupStats.pendingRemoved;
			this.stats.disposeKept = dupStats.disposeKept;
			processed = this.calculateAges(processed);
			processed = this.assignAgeCategories(processed);
			processed = processed.map((row) => {
				const uid = row['UID'] || '';
				row['CAT1'] = this.extractCat1(uid);
				row['SIDE'] = determineSide(row['CAT1']);
				row['IPC SPECIAL'] = this.checkIpcSpecial(row['ACT']);
				row['CASE AGAINST WOMEN'] = this.checkCaseAgainstWomen(row['ACT']);
				row['CAT2'] = this.createCat2(row);
				return row;
			});
			this.processedData = processed;
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
			pendingCases: data.filter((row) => row.STATUS === 'PENDING').length,
			disposedCases: data.filter((row) => row.STATUS === 'DISPOSE').length,
			civilCases: data.filter((row) => row.SIDE === 'CIVIL').length,
			criminalCases: data.filter((row) => row.SIDE === 'CRIMINAL').length,
			unknownSideCases: data.filter((row) => row.SIDE === 'UNKNOWN').length,
			avgAgePending: 'NA',
			oldestCase: { age: 0, uid: 'N/A' },
			duplicatesFound: this.stats.duplicatesFound,
			duplicatesRemoved: this.stats.duplicatesRemoved,
			recordsWithInvalidDates: this.stats.invalidDatesCount
		};
		const validPendingCases = data.filter(
			(row) => row.STATUS === 'PENDING' && row.AGE_VALID === true && typeof row.AGE_Y === 'number'
		);
		if (validPendingCases.length > 0) {
			const totalAgeYears = validPendingCases.reduce((sum, row) => sum + (Number(row.AGE_Y) || 0), 0);
			summary.avgAgePending = (totalAgeYears / validPendingCases.length).toFixed(2);

			const oldest = validPendingCases.reduce(
				/**
				 * @param {{age: number, uid: string}} maxAgeCase
				 * @param {DataRow} currentCase
				 */
				(maxAgeCase, currentCase) => {
					const currentAge = Number(currentCase.AGE_Y) || 0;
					if (currentAge > maxAgeCase.age) {
						return { age: currentAge, uid: String(currentCase.UID || 'Unknown UID') };
					}
					return maxAgeCase;
				},
				{ age: -1, uid: '' }
			);

			if (oldest.age !== -1) summary.oldestCase = oldest;
		}
		return summary;
	}
}

// --- END OF FILE processor.js ---

