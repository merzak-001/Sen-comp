const XLSX = require('xlsx');

const filePath = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(filePath, { cellFormula: true });
const ws = wb.Sheets['5,'];

console.log('=== SHEET 5, (NOVEMBER 2025): ROWS 25 to 50 ===');
for (let r = 24; r <= 49; r++) {
  let rowStr = [];
  for (let c = 0; c <= 15; c++) {
    const addr = XLSX.utils.encode_cell({r, c});
    const cell = ws[addr];
    if (cell && cell.v !== undefined && cell.v !== '') {
      const txt = cell.f ? `=${cell.f} [${cell.v}]` : cell.v;
      rowStr.push(`Col${c}(${addr.slice(0,1)}): ${txt}`);
    }
  }
  if (rowStr.length > 0) {
    console.log(`Row ${r+1}: ` + rowStr.join(' | '));
  }
}
