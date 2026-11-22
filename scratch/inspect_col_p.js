const XLSX = require('xlsx');
const p = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(p);
const ws = wb.Sheets['TFT 2025'];
for (let r = 6; r <= 36; r++) {
  const libelle = ws['A' + r]?.v || '';
  const note = ws['B' + r]?.v || '';
  const colP = ws['P' + r]?.v || '';
  const colQ = ws['Q' + r]?.v || '';
  const colR = ws['R' + r]?.v || '';
  const ann2025 = ws['O' + r]?.v || 0;
  if (libelle || note) {
    console.log('[R' + r + '] Note: ' + String(note).padEnd(5) + ' | Année: ' + String(ann2025).padStart(16) + ' | ' + libelle.slice(0, 45).padEnd(45) + ' | Source: ' + colP + (colQ ? ' | ' + colQ : '') + (colR ? ' | ' + colR : ''));
  }
}
