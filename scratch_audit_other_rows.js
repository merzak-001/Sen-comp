const XLSX = require('xlsx');

// Let's inspect the accountant's formulas and logic across 2025 and compare with 2026
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
const wsTFT = wb.Sheets['TFT 2025'];

console.log('--- AUDITING ROWS 403, 404, 405 FOR 2025 ---');
const r403 = [];
const r404 = [];
const r405 = [];

for (let c = 2; c <= 13; c++) {
  const col = XLSX.utils.encode_col(c);
  r403.push(Number(wsTFT[col + '9'].v));
  r404.push(Number(wsTFT[col + '10'].v));
  r405.push(Number(wsTFT[col + '11'].v));
}

console.log('2025 Row 403 (Personnel):', r403);
console.log('2025 Row 404 (Bank fees):', r404);
console.log('2025 Row 405 (Taxes):    ', r405);
