const XLSX = require('xlsx');

const filePath = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(filePath, { cellFormula: true });
const ws = wb.Sheets['BEA,'];
const range = XLSX.utils.decode_range(ws['!ref']);

console.log('=== BEA, SUB-TOTALS AND LABELS ===');
for (let r = 0; r <= range.e.r; r++) {
  // check columns D to O for labels or formulas
  for (let c = 4; c <= 14; c++) {
    const cell = ws[XLSX.utils.encode_cell({r, c})];
    if (cell && (cell.f || ['paie', 'fourniss', 'etrg', 'IMPOT', 'invest', 'total'].some(k => String(cell.v).toLowerCase().includes(k)))) {
      console.log(`Row ${r+1}: Col ${c} (${XLSX.utils.encode_col(c)}): ${cell.f ? '=' + cell.f : cell.v}`);
    }
  }
}
