const XLSX = require('xlsx');

const filePath = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(filePath, { cellFormula: true });
const ws = wb.Sheets['TFT 2025'];
const range = XLSX.utils.decode_range(ws['!ref']);

console.log('Sheet Range:', ws['!ref']);
console.log('Cols:', range.s.c, 'to', range.e.c, '| Rows:', range.s.r, 'to', range.e.r);

console.log('\n=== COLUMNS 14 (O) TO END OF TFT 2025 SHEET ===');

for (let r = 0; r <= range.e.r; r++) {
  let rowStr = [];
  const colA = ws[XLSX.utils.encode_cell({r, c: 0})]?.v || '';
  const colB = ws[XLSX.utils.encode_cell({r, c: 1})]?.v || '';
  
  for (let c = 14; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({r, c});
    const cell = ws[addr];
    if (cell && cell.v !== undefined && cell.v !== '') {
      const txt = cell.f ? `=${cell.f} [${cell.v}]` : cell.v;
      rowStr.push(`${XLSX.utils.encode_col(c)}: ${txt}`);
    }
  }
  if (rowStr.length > 0) {
    console.log(`Row ${r+1} [${colB} | ${colA.slice(0, 30)}]: ` + rowStr.join(' | '));
  }
}
