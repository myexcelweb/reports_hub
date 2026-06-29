// --- JSDOC TYPE DEFINITIONS ---
/**
 * A generic type representing a single row of data from the Excel sheet.
 * @typedef {Object.<string, any>} DataRow
 */

export default class DuplicateRemover {
	constructor() {
		/** @type {{duplicatesFound: number, duplicatesRemoved: number, pendingRemoved: number, disposeKept: number}} */
		this.stats = {
			duplicatesFound: 0,
			duplicatesRemoved: 0,
			pendingRemoved: 0,
			disposeKept: 0
		};
	}

	/**
	 * @param {DataRow[]} data The array of data rows to process.
	 * @param {string} [uidField='UID'] The field to use as the unique identifier.
	 * @returns {DataRow[]} The processed data with duplicates removed/merged.
	 */
	removeDuplicates(data, uidField = 'UID') {
		this.stats = {
			duplicatesFound: 0,
			duplicatesRemoved: 0,
			pendingRemoved: 0,
			disposeKept: 0
		};

		if (!data || data.length === 0) {
			return [];
		}

		/** @type {Object.<string, DataRow[]>} */
		const uidGroups = {};

		// Group data by UID
		data.forEach((row) => {
			const uid = row && row[uidField] ? String(row[uidField]).trim() : '';
			if (uid === '') {
				console.warn('Row found with empty or missing UID:', row);
				return;
			}
			if (!uidGroups[uid]) {
				uidGroups[uid] = [];
			}
			uidGroups[uid].push(row);
		});

		// Process each group
		const processedData = Object.values(uidGroups).map((group) => {
			if (group.length > 1) {
				this.stats.duplicatesFound += group.length - 1;

				// Check if any entry has 'DISPOSE' status
				const disposeEntries = group.filter(
					(row) => row && row['STATUS'] && String(row['STATUS']).toUpperCase() === 'DISPOSE'
				);

				/** @type {DataRow} */
				const mergedEntry = {};

				// Determine status to keep (DISPOSE preferred)
				if (disposeEntries.length > 0) {
					mergedEntry['STATUS'] = 'DISPOSE';
					this.stats.disposeKept += 1;
				} else {
					mergedEntry['STATUS'] = group[0]['STATUS'] || '';
				}

				// Add the UID field first
				mergedEntry[uidField] = group[0][uidField];

				// Merge all non-empty fields from all entries
				group.forEach((entry) => {
					Object.keys(entry).forEach((key) => {
						if (key === uidField || key === 'STATUS') return;

						// FIX for eslint: no-prototype-builtins
						const isFieldMissingInMerge = !Object.prototype.hasOwnProperty.call(mergedEntry, key);

						if (
							entry[key] !== undefined &&
							entry[key] !== null &&
							entry[key] !== '' &&
							(isFieldMissingInMerge ||
								mergedEntry[key] === undefined ||
								mergedEntry[key] === null ||
								mergedEntry[key] === '')
						) {
							mergedEntry[key] = entry[key];
						}
					});
				});

				// Update stats
				this.stats.duplicatesRemoved += group.length - 1;
				this.stats.pendingRemoved += group.filter(
					(r) =>
						r['STATUS'] !== mergedEntry['STATUS'] &&
						(!r['STATUS'] || String(r['STATUS']).toUpperCase() !== 'DISPOSE')
				).length;

				return mergedEntry;
			}
			return group[0]; // If only one entry, return it as is
		});

		return processedData.filter(Boolean);
	}

	getStats() {
		return this.stats;
	}
}

