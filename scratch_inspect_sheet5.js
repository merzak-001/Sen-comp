const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
const ws = wb.Sheets['5'];

console.log('--- ALL ROWS IN SHEET 5 ---');
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
for (let r = 0; r < data.length; r++) {
  const row = data[r];
  if (row && row.some(cell => cell !== undefined && cell !== '')) {
    const formulas = [];
    for (let c = 0; c < 15; c++) {
      const cell = ws[XLSX.utils.encode_cell({r, c})];
      if (cell && cell.f) {
        formulas.push(XLSX.utils.encode_col(c) + ': =' + cell.f + ' (' + cell.v + ')');
      }
    }
    console.log(`L${r+1}: [${row.slice(0, 4).join(' | ')}] | Form: ${formulas.join(' ; ')} | RowVals: ${row.slice(4, 12).filter(v => v !== undefined).join(' | ')}`);
  }
}
