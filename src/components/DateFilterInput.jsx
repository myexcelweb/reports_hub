// src/components/DateFilterInput.jsx
import { useState } from 'react';

export default function DateFilterInput({ onApply, isProcessing, disabled }) {
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!fromDate || !toDate) {
            alert('Please enter both FROM and TO dates.');
            return;
        }
        // Convert to Date objects for the processor
        const from = parseDateString(fromDate);
        const to = parseDateString(toDate);
        if (!from || !to) {
            alert('Invalid date format. Use DD-MM-YYYY.');
            return;
        }
        if (to < from) {
            alert('TO date cannot be before FROM date.');
            return;
        }
        onApply(from, to);
    };

    const parseDateString = (str) => {
        const parts = str.split('-');
        if (parts.length !== 3) return null;
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
        return new Date(y, m, d);
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label>
                FROM date (DD-MM-YYYY):
                <input
                    type="text"
                    placeholder="01-04-2026"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    disabled={disabled}
                    style={{ marginLeft: '0.5rem', padding: '0.4rem', borderRadius: '6px', border: '1px solid #ccc' }}
                />
            </label>
            <label>
                TO date (DD-MM-YYYY):
                <input
                    type="text"
                    placeholder="30-04-2026"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    disabled={disabled}
                    style={{ marginLeft: '0.5rem', padding: '0.4rem', borderRadius: '6px', border: '1px solid #ccc' }}
                />
            </label>
            <button
                type="submit"
                disabled={disabled || isProcessing}
                className="btn-primary"
                style={{ padding: '0.4rem 1.2rem', width: 'auto' }}
            >
                {isProcessing ? 'Processing...' : 'Apply Filter & Process'}
            </button>
        </form>
    );
}