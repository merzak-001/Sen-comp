const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx', { cellFormula: true });
const ws = wb.Sheets['TFT 2025'];
for (let r = 3; r <= 35; r++) {
  const note = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v || '';
  const label = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v || '';
  const cell = ws[XLSX.utils.encode_cell({ r, c: 4 })]; // Col index 4 = Mars
  const val = cell ? (cell.f ? '=' + cell.f + ' [' + cell.v + ']' : cell.v) : '';
  if (label || note || val) {
    console.log(`R${r+1} | Note: ${String(note).padEnd(6)} | ${label.padEnd(45)} | Mars: ${val}`);
  }
}
