const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx', { cellFormula: true });
const ws = wb.Sheets['TFT 2025'];
const range = XLSX.utils.decode_range(ws['!ref']);

console.log('--- COLUMNS 11 to 14 of TFT 2025 ---');
for (let r = 5; r <= 35; r++) {
  let label = ws[XLSX.utils.encode_cell({r, c: 0})]?.v || '';
  let note = ws[XLSX.utils.encode_cell({r, c: 1})]?.v || '';
  let m11 = ws[XLSX.utils.encode_cell({r, c: 12})];
  let m12 = ws[XLSX.utils.encode_cell({r, c: 13})];
  let f12 = m12?.f ? ('=' + m12.f) : (m12?.v ?? '');
  let f11 = m11?.f ? ('=' + m11.f) : (m11?.v ?? '');
  console.log(`${note} | ${label.padEnd(45)} | M11: ${f11} | M12: ${f12}`);
}

console.log('\n--- INSPECTING SHEET "5" ---');
const s5 = wb.Sheets['5'];
const r5 = XLSX.utils.decode_range(s5['!ref']);
console.log('Sheet 5 Range:', s5['!ref']);
for (let r = 0; r <= Math.min(r5.e.r, 70); r++) {
  let rowStr = [];
  for (let c = 0; c <= Math.min(r5.e.c, 15); c++) {
    const cell = s5[XLSX.utils.encode_cell({r, c})];
    if (cell) {
      rowStr.push(`C${c}: ${cell.f ? '=' + cell.f : cell.v}`);
    }
  }
  if (rowStr.length > 0) {
    console.log(`R${r + 1}: ${rowStr.join(' | ')}`);
  }
}
