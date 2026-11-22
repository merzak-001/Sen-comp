const XLSX = require('xlsx');
const p = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(p);
const wsBal = wb.Sheets['BAL DEC'];
const rowsBal = XLSX.utils.sheet_to_json(wsBal, { header: 1 });
console.log('BAL DEC row count:', rowsBal.length);
console.log('Header rows:', rowsBal.slice(0, 6));

// Check bank sheets: '5', 'BEA,', 'EUR,'
for (const s of ['5', 'BEA,', 'EUR,']) {
  const ws = wb.Sheets[s];
  const rows = XLSX.utils.sheet_to_json(ws);
  console.log(`Sheet ${s}: ${rows.length} transactions, sample:`, rows[0]);
}
