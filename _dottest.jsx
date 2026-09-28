import fs from 'fs';
import * as XLSX from 'xlsx';
const { JSDOM } = globalThis.__nodeRequire('C:/Users/parim/AppData/Local/Temp/lint/node_modules/jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
for (const k of ['document','navigator','HTMLElement','Node','NodeFilter','getComputedStyle','MutationObserver']) { try { globalThis[k] = dom.window[k]; } catch {} }
globalThis.window = dom.window;
globalThis.FileReader = class { readAsArrayBuffer(f){ f.arrayBuffer().then(b=>{ this.result=b; this.onload?.({target:{result:b}}); }); } };
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { useCourtCaseProcessor } = await import('./src/hooks/useCourtCaseProcessor.js');

const dir = '../sample of uplodble files';
const files = fs.readdirSync(dir).map(n => new File([fs.readFileSync(dir + '/' + n)], n));
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'S');
files.push(new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], 'empty.xlsx'));
files.push(new File([new Uint8Array([1, 2, 3, 4, 5])], 'broken.xlsx'));
// upload-time items, as UploadScreen creates them (rowCount = upload-time count)
const initial = files.map(f => ({ file: f, name: f.name, status: 'pending', rowCount: 10, size: f.size }));

let api, items;
function Harness() {
  const [fileItems, setFileItems] = React.useState(initial);
  api = useCourtCaseProcessor(); items = fileItems;
  api.setFileItems = setFileItems;
  return null;
}
const root = createRoot(document.createElement('div'));
await act(async () => root.render(<Harness />));
console.log('before:', items.map(i => i.status).join(', '));
await act(async () => { await api.processFiles(items.map(i => i.file), api.setFileItems, {}); });
items.forEach(i => console.log('  ', i.name.padEnd(40), 'status=' + i.status, '| processedRows=' + (i.processedRows ?? '-'), '| upload rowCount kept=' + i.rowCount, i.error ? '| error=' + i.error.slice(0, 50) : ''));
