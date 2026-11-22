const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
const ws = wb.Sheets['TFT 2025'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

for (let r = 0; r < data.length; r++) {
  const row = data[r];
  if (row && row.some(cell => cell !== undefined && cell !== '')) {
    const code = row[0] || '';
    const label = row[1] || '';
    // Let's find any cell with a formula in this row
    const formulas = [];
    for (let c = 0; c < 20; c++) {
      const cell = ws[XLSX.utils.encode_cell({r, c})];
      if (cell && cell.f) {
        formulas.push(XLSX.utils.encode_col(c) + ': =' + cell.f);
      }
    }
    const val = row[15] !== undefined ? row[15] : (row[14] !== undefined ? row[14] : '');
    console.log(`R${r+1} | ${code} | ${String(label).padEnd(45)} | Val: ${val} | Formulas: ${formulas.join(' ; ')}`);
  }
}
