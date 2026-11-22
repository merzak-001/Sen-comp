const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx', { cellFormula: true });
const ws = wb.Sheets['TFT 2025'];

for (let r = 6; r <= 11; r++) {
  let note = ws[XLSX.utils.encode_cell({r, c: 1})]?.v;
  let label = ws[XLSX.utils.encode_cell({r, c: 0})]?.v;
  console.log(`\nRow ${r+1}: [${note}] ${label}`);
  for (let c = 2; c <= 14; c++) {
    let cell = ws[XLSX.utils.encode_cell({r, c})];
    let colHeader = ws[XLSX.utils.encode_cell({r: 3, c})]?.v;
    let txt = cell ? (cell.f ? `FORMULA(=${cell.f})` : `VAL(${cell.v})`) : 'EMPTY';
    console.log(`  Col ${c} (${colHeader}): ${txt}`);
  }
}
