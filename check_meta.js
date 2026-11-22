const XLSX = require('xlsx');

const filePath = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(filePath, { cellFormula: true });

console.log('Workbook Sheet Visibility:');
if (wb.Workbook && wb.Workbook.Sheets) {
  wb.Workbook.Sheets.forEach(s => console.log(s));
} else {
  console.log('No Workbook.Sheets metadata');
}

// Check sheet names
console.log('All sheet names:', wb.SheetNames);

// In TFT 2025 sheet, print all text, headers, and formulas in rows 1 to 45
const ws = wb.Sheets['TFT 2025'];
console.log('\n--- TFT 2025 HEADERS (Row 1 to 5) ---');
for (let r = 0; r < 5; r++) {
  let row = [];
  for (let c = 0; c <= 15; c++) {
    const cell = ws[XLSX.utils.encode_cell({r, c})];
    if (cell && cell.v !== undefined) {
      row.push(`C${c}: ${cell.v}`);
    }
  }
  console.log(`R${r+1}: ${row.join(' | ')}`);
}
