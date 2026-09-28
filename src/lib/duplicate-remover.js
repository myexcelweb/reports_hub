import { SOURCE_FILE_KEY, mergeSourceFiles } from './caseFilters.js';

// --- JSDOC TYPE DEFINITIONS ---
/**
 * A generic type representing a single row of data from the Excel sheet.
 * @typedef {Object.<string, any>} DataRow
 */

export default class DuplicateRemover {
	constructor() {
		/** @type {{duplicatesFound: number, duplicatesRemoved: number, disposeRemoved: number, pendingKept: number}} */
		this.stats = {
			duplicatesFound: 0,
			duplicatesRemoved: 0,
			disposeRemoved: 0,
			pendingKept: 0,
			skippedNoKey: 0
		};
	}

	/**
	 * Remove duplicates based on a case key (see caseKey() in caseFilters.js).
	 * Rules:
	 * - Same key + same STATUS → keep only one (merge non-empty fields).
	 * - Same key + different STATUS → keep only the PENDING entry.
	 * - No key at all → row skipped and counted in stats.skippedNoKey.
	 * @param {DataRow[]} data The array of data rows to process.
	 * @param {(row: DataRow) => string} getKey Returns the unique key for a row ('' = none).
	 * @returns {DataRow[]} The processed data with duplicates removed/merged.
	 */
	removeDuplicates(data, getKey) {
		this.stats = {
			duplicatesFound: 0,
			duplicatesRemoved: 0,
			disposeRemoved: 0,
			pendingKept: 0,
			skippedNoKey: 0
		};

		if (!data || data.length === 0) {
			return [];
		}

		// Map keeps upload order (plain-object keys that look like numbers get reordered)
		/** @type {Map<string, DataRow[]>} */
		const groups = new Map();

		data.forEach((row) => {
			const key = row ? getKey(row) : '';
			if (key === '') {
				this.stats.skippedNoKey++;
				console.warn('Row skipped — no CNR or CASE NO:', row);
				return;
			}
			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key).push(row);
		});

		// Process each group
		const processedData = [...groups.values()].map((group) => {
			if (group.length === 1) {
				return group[0];
			}

			this.stats.duplicatesFound += group.length - 1;

			const pendingEntries = group.filter(
				(row) => row && row['STATUS'] && String(row['STATUS']).toUpperCase() === 'PENDING'
			);
			const disposeEntries = group.filter(
				(row) => row && row['STATUS'] && String(row['STATUS']).toUpperCase() === 'DISPOSE'
			);

			/** @type {DataRow[]} */
			let entriesToMerge;

			// Different status → keep only PENDING
			if (pendingEntries.length > 0 && disposeEntries.length > 0) {
				entriesToMerge = pendingEntries;
				this.stats.pendingKept += 1;
				this.stats.disposeRemoved += disposeEntries.length;
			} else if (pendingEntries.length > 0) {
				entriesToMerge = pendingEntries;
			} else if (disposeEntries.length > 0) {
				entriesToMerge = disposeEntries;
			} else {
				entriesToMerge = group;
			}

			/** @type {DataRow} */
			const mergedEntry = {};

			if (pendingEntries.length > 0 && (disposeEntries.length > 0 || entriesToMerge === pendingEntries)) {
				mergedEntry['STATUS'] = 'PENDING';
			} else if (disposeEntries.length > 0) {
				mergedEntry['STATUS'] = 'DISPOSE';
			} else {
				mergedEntry['STATUS'] = group[0]['STATUS'] || '';
			}

			entriesToMerge.forEach((entry) => {
				Object.keys(entry).forEach((k) => {
					if (k === 'STATUS') return;

					const isFieldMissingInMerge = !Object.prototype.hasOwnProperty.call(mergedEntry, k);

					if (
						entry[k] !== undefined &&
						entry[k] !== null &&
						entry[k] !== '' &&
						(isFieldMissingInMerge ||
							mergedEntry[k] === undefined ||
							mergedEntry[k] === null ||
							mergedEntry[k] === '')
					) {
						mergedEntry[k] = entry[k];
					}
				});
			});

			// Keep every file this case appeared in (including dropped DISPOSE copies)
			mergedEntry[SOURCE_FILE_KEY] = mergeSourceFiles(...group.map((row) => row[SOURCE_FILE_KEY]));

			this.stats.duplicatesRemoved += group.length - 1;

			return mergedEntry;
		});

		return processedData.filter(Boolean);
	}

	getStats() {
		return this.stats;
	}
}
