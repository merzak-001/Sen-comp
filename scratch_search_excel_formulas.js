const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx', { cellFormula: true });

for (const sName of wb.SheetNames) {
  const ws = wb.Sheets[sName];
  if (!ws) continue;
  for (const cellAddr in ws) {
    if (cellAddr.startsWith('!')) continue;
    const cell = ws[cellAddr];
    if (cell && (
      String(cell.v).includes('356257225') ||
      String(cell.v).includes('213036605') ||
      (cell.f && (cell.f.includes('ZSDU') || cell.f.includes('BAL')))
    )) {
      console.log(`Sheet: ${sName} | Cell: ${cellAddr} | Val: ${cell.v} | Formula: =${cell.f}`);
    }
  }
}
