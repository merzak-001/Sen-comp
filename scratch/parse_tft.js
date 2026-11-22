const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const candidates = [
  'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx',
  'C:/Users/msai/Documents/OS-appro/TFT  DEC 2025.xlsx'
];

let targetFile = null;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    targetFile = p;
    break;
  }
}

if (!targetFile) {
  console.error('File not found in candidates:', candidates);
  process.exit(1);
}

console.log('Loading file:', targetFile);
const wb = XLSX.readFile(targetFile);
console.log('Sheet names:', wb.SheetNames);
const s = wb.Sheets['TFT 2025'];
const data = XLSX.utils.sheet_to_json(s, { header: 1 });

console.log('Total rows:', data.length);
data.forEach((r, idx) => {
  if (r && (r[0] !== undefined || r[1] !== undefined)) {
    const libelle = r[0] !== undefined ? String(r[0]).trim() : '';
    const note = r[1] !== undefined ? String(r[1]).trim() : '';
    const tot2025 = r[14] !== undefined ? r[14] : '';
    if (libelle || note) {
      console.log(`R${idx} | Note: ${note} | Lib: ${libelle.substring(0, 45)} | Tot2025: ${tot2025}`);
    }
  }
});
