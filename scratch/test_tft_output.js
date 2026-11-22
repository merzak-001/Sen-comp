const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const candidates = [
  'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx',
  'C:/Users/msai/Documents/OS-appro/TFT  DEC 2025.xlsx'
];

function loadTFT2025FromExcel() {
  let filePath = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { filePath = p; break; }
  }
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets['TFT 2025'];
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
    rows.push({ rowIndex: i, note, label: lib, months, tot });
  }
  return rows;
}

const tftData = loadTFT2025FromExcel();
console.log('2025 Annual KPI:');
const a = tftData.find(r => r.note === '408').tot;
const b = tftData.find(r => r.note === '416').tot;
const c = tftData.find(r => r.note === '422').tot;
const varT = tftData.find(r => r.note === '424').tot;
const ouv = tftData.find(r => r.note === '425').tot;
const clot = tftData.find(r => r.note === '426').tot;
console.log({ a, b, c, varT, ouv, clot, diff: (clot - ouv) - varT });

console.log('\n2025 Month 10 (Octobre) KPI:');
const a10 = tftData.find(r => r.note === '408').months[9];
const b10 = tftData.find(r => r.note === '416').months[9];
const c10 = tftData.find(r => r.note === '422').months[9];
const var10 = tftData.find(r => r.note === '424').months[9];
const ouv10 = tftData.find(r => r.note === '425').months[9];
const clot10 = tftData.find(r => r.note === '426').months[9];
console.log({ a10, b10, c10, var10, ouv10, clot10, diff: (clot10 - ouv10) - var10 });
