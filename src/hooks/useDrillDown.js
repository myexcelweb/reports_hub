import { useState, useCallback } from 'react';

// Every report table opens a modal with detailed case info.
export function useDrillDown() {
  const [modal, setModal] = useState({ show: false, title: '', rows: [] });

  const open = useCallback((title, rows) => {
    setModal({ show: true, title, rows: rows || [] });
  }, []);

  const close = useCallback(() => {
    setModal(prev => ({ ...prev, show: false }));
  }, []);

  return { modal, open, close };
}