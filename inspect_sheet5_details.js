const XLSX = require('xlsx');

const filePath = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(filePath, { cellFormula: true });
const s5 = wb.Sheets['5'];
const r5 = XLSX.utils.decode_range(s5['!ref']);

console.log('=== SHEET 5: ROWS 38 to 61 (ALL CELLS WITH FORMULA AND VALUE) ===');
for (let r = 37; r <= 60; r++) {
  let rowStr = [];
  for (let c = 0; c <= 15; c++) {
    const addr = XLSX.utils.encode_cell({r, c});
    const cell = s5[addr];
    if (cell && cell.v !== undefined && cell.v !== '') {
      const txt = cell.f ? `=${cell.f} [${cell.v}]` : cell.v;
      rowStr.push(`Col${c}(${addr.slice(0,1)}): ${txt}`);
    }
  }
  if (rowStr.length > 0) {
    console.log(`Row ${r+1}: ` + rowStr.join(' | '));
  }
}
