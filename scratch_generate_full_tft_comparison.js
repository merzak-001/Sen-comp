const XLSX = require('xlsx');

// 1. Load 2025 certified data
const wb25 = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
const ws25 = wb25.Sheets['TFT 2025'];
const tft25 = {};

for (let r = 6; r <= 34; r++) {
  const code = ws25['B' + r] ? String(ws25['B' + r].v).trim() : '';
  const label = ws25['A' + r] ? String(ws25['A' + r].v).trim() : '';
  if (!code && !label) continue;
  const tot = ws25['O' + r] ? Number(ws25['O' + r].v) || 0 : 0;
  const mVals = [];
  for (let c = 2; c <= 13; c++) {
    const col = XLSX.utils.encode_col(c);
    mVals.push(ws25[col + r] ? Number(ws25[col + r].v) || 0 : 0);
  }
  tft25[code || ('header_' + r)] = { code, label, tot, mVals };
}

console.log('--- 2025 FULL CERTIFIED TFT (ANNUAL TOTALS & RECONCILIATION) ---');
Object.values(tft25).forEach(row => {
  if (row.code) {
    console.log(`${row.code.padEnd(4)} | ${row.label.padEnd(45)} | Total: ${row.tot.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
  } else {
    console.log(`\n=== ${row.label} ===`);
  }
});
