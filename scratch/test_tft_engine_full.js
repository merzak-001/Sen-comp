const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const TFT_FILE_CANDIDATES = [
  'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx',
  'C:/Users/msai/Documents/OS-appro/TFT  DEC 2025.xlsx',
  path.join(__dirname, '../data/TFT  DEC 2025.xlsx')
];

function getTFTFilePath() {
  for (const p of TFT_FILE_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return TFT_FILE_CANDIDATES[0];
}

function loadTFT2025FromExcel() {
  const filePath = getTFTFilePath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier TFT 2025 introuvable : ${filePath}`);
  }
  const wb = XLSX.readFile(filePath);
  const sheetName = 'TFT 2025';
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Feuille '${sheetName}' introuvable dans ${filePath}`);
  }

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const rows = [];

  for (let i = 4; i <= 33; i++) {
    const r = data[i];
    if (!r) continue;
    const lib = r[0] ? String(r[0]).trim() : '';
    const note = r[1] !== undefined ? String(r[1]).trim() : '';
    if (!lib && !note) continue;

    const months = [];
    for (let m = 2; m <= 13; m++) {
      months.push(Number(r[m]) || 0);
    }
    const tot = Number(r[14]) || 0;
    rows.push({
      rowIndex: i,
      note,
      label: lib,
      months,
      tot
    });
  }

  return rows;
}

const parsed = loadTFT2025FromExcel();
console.log('Successfully parsed', parsed.length, 'rows');
parsed.forEach(r => console.log(`Note ${r.note}: ${r.label.substring(0, 35)} => Tot: ${r.tot}`));
