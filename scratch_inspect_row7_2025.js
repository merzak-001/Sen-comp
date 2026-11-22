const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
const ws = wb.Sheets['TFT 2025'];

for (let c = 2; c <= 13; c++) {
  const col = XLSX.utils.encode_col(c);
  const cell = ws[col + '7'];
  console.log('Month ' + (c-1) + ' (' + col + '7): Val = ' + (cell ? cell.v : '') + ' | Formula = ' + (cell && cell.f ? cell.f : 'direct value'));
}

// Also check row 8 (402), row 9 (403), row 10 (404), row 11 (405) in Dec (col N)
console.log('\n--- DECEMBER (Col N) FORMULAS FOR ALL ROWS ---');
for (let r = 7; r <= 34; r++) {
  const cell = ws['N' + r];
  const label = ws['A' + r] ? ws['A' + r].v : '';
  const code = ws['B' + r] ? ws['B' + r].v : '';
  if (cell) {
    console.log(`L${r} | ${code} | ${String(label).padEnd(35)} | Val = ${cell.v} | Form = ${cell.f || 'none'}`);
  }
}
