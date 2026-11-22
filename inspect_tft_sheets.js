const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx', { cellFormula: true });
console.log('Sheet names:', wb.SheetNames);

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) return;
  console.log(`\n=== SHEET: ${sheetName} ===`);
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  for (let r = 0; r < Math.min(data.length, 35); r++) {
    const row = data[r];
    if (row && row.length > 0) {
      const nonNull = row.filter(c => c !== null && c !== undefined && c !== '');
      if (nonNull.length > 0) {
        console.log(`R${r+1}:`, row.slice(0, 5));
      }
    }
  }
});
