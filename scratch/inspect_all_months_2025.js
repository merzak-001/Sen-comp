const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx', { cellFormula: true });
const ws = wb.Sheets['TFT 2025'];

console.log('--- TFT 2025 ALL MONTHS ---');
for (let r = 5; r <= 15; r++) {
  const note = ws[XLSX.utils.encode_cell({r, c: 1})]?.v || '';
  const label = ws[XLSX.utils.encode_cell({r, c: 0})]?.v || '';
  console.log(`\nRow ${r+1} (Note ${note} - ${label}):`);
  for (let c = 2; c <= 14; c++) {
    const header = ws[XLSX.utils.encode_cell({r: 3, c})]?.v || XLSX.utils.encode_col(c);
    const cell = ws[XLSX.utils.encode_cell({r, c})];
    const val = cell ? (cell.f ? '=' + cell.f : cell.v) : 'empty';
    console.log(`  ${header} (Col ${XLSX.utils.encode_col(c)}): ${val}`);
  }
}
