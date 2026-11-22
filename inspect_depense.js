const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/Downloads/depense 06.2026.xlsx');
console.log('depense 06.2026 sheets:', wb.SheetNames);
for (const s of wb.SheetNames) {
  const ws = wb.Sheets[s];
  console.log(`Sheet: ${s}, ref: ${ws['!ref']}`);
  // print first 5 rows
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let r = 0; r <= Math.min(range.e.r, 5); r++) {
    let row = [];
    for (let c = 0; c <= Math.min(range.e.c, 12); c++) {
      const cell = ws[XLSX.utils.encode_cell({r, c})];
      if (cell) row.push(`C${c}:${cell.v}`);
    }
    console.log(`  R${r+1}: ${row.join(' | ')}`);
  }
}

const wb2 = XLSX.readFile('C:/Users/msai/Downloads/debour 06.2026.xlsx');
console.log('\ndebour 06.2026 sheets:', wb2.SheetNames);
for (const s of wb2.SheetNames) {
  const ws = wb2.Sheets[s];
  console.log(`Sheet: ${s}, ref: ${ws['!ref']}`);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let r = 0; r <= Math.min(range.e.r, 5); r++) {
    let row = [];
    for (let c = 0; c <= Math.min(range.e.c, 12); c++) {
      const cell = ws[XLSX.utils.encode_cell({r, c})];
      if (cell) row.push(`C${c}:${cell.v}`);
    }
    console.log(`  R${r+1}: ${row.join(' | ')}`);
  }
}
