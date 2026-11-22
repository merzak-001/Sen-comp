const XLSX = require('xlsx');
const p = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(p);
const ws1 = wb.Sheets['TFT 2025'];

const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc', 'TOTAL'];

console.log('Month | Note 424 (Var) | Note 425 (Ouv) | Note 426 (Clôt) | Clôt - Ouv | Diff (427 - 424)');
for (let c = 2; c <= 14; c++) {
  const col = XLSX.utils.encode_col(c);
  const mLabel = months[c - 2];
  const r424 = ws1[col + 31]?.v;
  const r425 = ws1[col + 32]?.v;
  const r426 = ws1[col + 33]?.v;
  const r427 = ws1[col + 34]?.v;
  const diff = (r426 - r425);
  const delta = diff - r424;
  console.log(`${mLabel.padEnd(5)} | ${String(r424).padStart(18)} | ${String(r425).padStart(18)} | ${String(r426).padStart(18)} | ${diff.toFixed(2).padStart(18)} | ${delta.toFixed(4).padStart(10)}`);
}
