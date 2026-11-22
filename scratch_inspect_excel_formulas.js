const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
console.log('Sheet names:', wb.SheetNames);

wb.SheetNames.forEach(sName => {
  const ws = wb.Sheets[sName];
  console.log(`\n--- Sheet: ${sName} ---`);
  // Check if row 403 has formulas
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z50');
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
      const cell = ws[cellRef];
      if (cell && (cell.v === 403 || cell.v === '403')) {
        console.log(`Found '403' at ${cellRef}:`, cell);
        // print entire row
        for (let col = range.s.c; col <= range.e.c; ++col) {
          const cRef = XLSX.utils.encode_cell({ c: col, r: R });
          const cCell = ws[cRef];
          if (cCell) {
            console.log(`  ${cRef}: val = ${cCell.v}, formula = ${cCell.f || 'NONE'}`);
          }
        }
      }
    }
  }
});
