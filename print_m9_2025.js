const XLSX = require('xlsx');

const filePath = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(filePath, { cellFormula: true });
const ws = wb.Sheets['TFT 2025'];

console.log('=== SEPTEMBER 2025 (MONTH 9 - COL 10) IN TFT 2025 ===');
for (let r = 5; r <= 35; r++) {
  const note = ws[XLSX.utils.encode_cell({r, c: 1})]?.v;
  const label = ws[XLSX.utils.encode_cell({r, c: 0})]?.v;
  const c9 = ws[XLSX.utils.encode_cell({r, c: 10})]; // Col 10 is Month 9
  if (c9 && c9.v !== undefined) {
    const val = Number(c9.v);
    console.log(`[${String(note).padEnd(4)}] ${label.padEnd(45)}: ${val.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(18)} DA`);
  }
}
