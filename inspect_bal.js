const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx', { cellFormula: true });
console.log('--- SHEET BAL DEC ---');
const bd = wb.Sheets['BAL DEC'];
if (bd) {
  const range = XLSX.utils.decode_range(bd['!ref']);
  console.log('Range:', bd['!ref']);
  for (let r = 0; r <= Math.min(range.e.r, 20); r++) {
    let rowStr = [];
    for (let c = 0; c <= Math.min(range.e.c, 10); c++) {
      const cell = bd[XLSX.utils.encode_cell({r, c})];
      if (cell) rowStr.push(`C${c}: ${cell.f ? '=' + cell.f : cell.v}`);
    }
    if (rowStr.length > 0) console.log(`R${r + 1}: ${rowStr.join(' | ')}`);
  }
}
console.log('--- SHEET 8 ---');
const s8 = wb.Sheets['8'];
if (s8) {
  const range = XLSX.utils.decode_range(s8['!ref']);
  console.log('Range:', s8['!ref']);
  for (let r = 0; r <= Math.min(range.e.r, 20); r++) {
    let rowStr = [];
    for (let c = 0; c <= Math.min(range.e.c, 10); c++) {
      const cell = s8[XLSX.utils.encode_cell({r, c})];
      if (cell) rowStr.push(`C${c}: ${cell.f ? '=' + cell.f : cell.v}`);
    }
    if (rowStr.length > 0) console.log(`R${r + 1}: ${rowStr.join(' | ')}`);
  }
}
