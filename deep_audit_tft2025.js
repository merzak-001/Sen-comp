const XLSX = require('xlsx');

const filePath = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(filePath, { cellFormula: true });

console.log('=== WORKBOOK SHEETS ===');
console.log(wb.SheetNames);

// Inspect each sheet's dimensions, non-empty cell count, and title/header
wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) {
    console.log(`Sheet "${sheetName}": EMPTY`);
    return;
  }
  const range = XLSX.utils.decode_range(ws['!ref']);
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;
  
  // Find formulas in this sheet
  let formulaCount = 0;
  let sampleFormulas = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({r, c})];
      if (cell && cell.f) {
        formulaCount++;
        if (sampleFormulas.length < 5) {
          sampleFormulas.push(`${XLSX.utils.encode_cell({r, c})}: =${cell.f} (${cell.v})`);
        }
      }
    }
  }
  
  // First 3 non-empty rows
  let firstRows = [];
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 5); r++) {
    let rText = [];
    for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 8); c++) {
      const cell = ws[XLSX.utils.encode_cell({r, c})];
      if (cell) rText.push(`C${c}:${cell.v}`);
    }
    if (rText.length > 0) firstRows.push(`R${r+1}: ` + rText.join(' | '));
  }

  console.log(`\n--- Sheet: "${sheetName}" (${rowCount} rows, ${colCount} cols, ${formulaCount} formulas) ---`);
  if (firstRows.length > 0) console.log(firstRows.slice(0, 3).join('\n'));
  if (sampleFormulas.length > 0) console.log('Sample formulas: ' + sampleFormulas.join('; '));
});
