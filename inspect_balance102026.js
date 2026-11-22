const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/balance 102026.xls');
console.log('balance 102026 sheets:', wb.SheetNames);
const ws = wb.Sheets[wb.SheetNames[0]];
const range = XLSX.utils.decode_range(ws['!ref']);
console.log('ref:', ws['!ref']);
for (let r = 0; r <= 25; r++) {
  let row = [];
  for (let c = 0; c <= Math.min(range.e.c, 10); c++) {
    const cell = ws[XLSX.utils.encode_cell({r, c})];
    if (cell) row.push(`C${c}:${cell.v}`);
  }
  if (row.length > 0) console.log(`R${r+1}: ${row.join(' | ')}`);
}
