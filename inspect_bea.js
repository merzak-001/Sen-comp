const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx', { cellFormula: true });
const ws = wb.Sheets['BEA,'];
if (ws) {
  console.log('BEA, range:', ws['!ref']);
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = 195; r <= Math.min(range.e.r, 225); r++) {
    let rowStr = [];
    for (let c = 0; c <= Math.min(range.e.c, 15); c++) {
      const cell = ws[XLSX.utils.encode_cell({r, c})];
      if (cell) {
        rowStr.push(`C${c}: ${cell.f ? '=' + cell.f : cell.v}`);
      }
    }
    if (rowStr.length > 0) {
      console.log(`R${r + 1}: ${rowStr.join(' | ')}`);
    }
  }
} else {
  console.log('Sheet BEA, not found');
}
