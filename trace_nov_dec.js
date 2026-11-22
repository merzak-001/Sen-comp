const XLSX = require('xlsx');

const filePath = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(filePath, { cellFormula: true });
const ws = wb.Sheets['TFT 2025'];

console.log('=== ROW BY ROW TRACING FOR MONTH 11 (NOV) AND MONTH 12 (DEC) ===');

for (let r = 5; r <= 35; r++) {
  const note = ws[XLSX.utils.encode_cell({r, c: 1})]?.v;
  const label = ws[XLSX.utils.encode_cell({r, c: 0})]?.v;
  if (!label && !note) continue;
  
  const cNov = ws[XLSX.utils.encode_cell({r, c: 12})]; // Col 12 is M11
  const cDec = ws[XLSX.utils.encode_cell({r, c: 13})]; // Col 13 is M12
  
  const novVal = cNov ? (cNov.f ? `=${cNov.f}` : cNov.v) : '';
  const decVal = cDec ? (cDec.f ? `=${cDec.f}` : cDec.v) : '';
  
  console.log(`[${String(note).padEnd(4)}] ${label.padEnd(45)} | NOV: ${String(novVal).padEnd(25)} | DEC: ${String(decVal)}`);
}
