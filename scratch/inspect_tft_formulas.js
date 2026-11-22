const XLSX = require('xlsx');
const p = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(p, { cellFormula: true });
const ws = wb.Sheets['TFT 2025'];

console.log('--- Inspecting Sheet 1 TFT 2025 formulas and references ---');
for (let r = 8; r <= 45; r++) {
  const rowLabel = ws['B' + r]?.v;
  const colC = ws['C' + r]?.v;
  const janF = ws['D' + r]?.f;
  const janV = ws['D' + r]?.v;
  const decF = ws['O' + r]?.f;
  const decV = ws['O' + r]?.v;
  const totF = ws['P' + r]?.f;
  const totV = ws['P' + r]?.v;
  if (rowLabel || colC) {
    console.log(`R${r} [Note ${colC}] ${String(rowLabel).slice(0, 35).padEnd(35)} | Jan: ${janV} (f:${janF || 'val'}) | Dec: ${decV} (f:${decF || 'val'}) | Tot: ${totV} (f:${totF || 'val'})`);
  }
}
