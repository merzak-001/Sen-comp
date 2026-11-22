const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx', { cellFormula: true });
const ws = wb.Sheets['TFT 2025'];

console.log('--- ALL FORMULAS IN TFT 2025 ---');
for (let r = 5; r <= 35; r++) {
  const note = ws[XLSX.utils.encode_cell({r, c: 1})]?.v;
  const label = ws[XLSX.utils.encode_cell({r, c: 0})]?.v;
  if (!label && !note) continue;
  
  let formulas = [];
  for (let c = 2; c <= 14; c++) {
    const cell = ws[XLSX.utils.encode_cell({r, c})];
    if (cell) {
      if (cell.f) {
        formulas.push(`M${c-1}: =${cell.f} (${cell.v})`);
      } else {
        formulas.push(`M${c-1}: ${cell.v}`);
      }
    }
  }
  console.log(`\n[${note || 'HDR'}] ${label}`);
  console.log(formulas.slice(0, 6).join(' | '));
  if (formulas.length > 6) {
    console.log(formulas.slice(6).join(' | '));
  }
}
