const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

function loadTFT2025() {
  const filePath = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
  const wb = XLSX.readFile(filePath);
  const s = wb.Sheets['TFT 2025'];
  const data = XLSX.utils.sheet_to_json(s, { header: 1 });

  const rows = [];
  for (let i = 4; i <= 33; i++) {
    const r = data[i];
    if (!r) continue;
    const lib = r[0] ? String(r[0]).trim() : '';
    const note = r[1] !== undefined ? String(r[1]).trim() : '';
    const months = [];
    for (let m = 2; m <= 13; m++) {
      months.push(Number(r[m]) || 0);
    }
    const tot = Number(r[14]) || 0;
    rows.push({ rowIndex: i, note, lib, months, tot });
  }
  return rows;
}

const rawRows = loadTFT2025();
console.log('Loaded rows count:', rawRows.length);
console.log('Sample Note 401:', rawRows.find(r => r.note === '401'));
console.log('Sample Note 408 (A):', rawRows.find(r => r.note === '408'));
console.log('Sample Note 416 (B):', rawRows.find(r => r.note === '416'));
console.log('Sample Note 422 (C):', rawRows.find(r => r.note === '422'));
console.log('Sample Note 424:', rawRows.find(r => r.note === '424'));
console.log('Sample Note 425 (Ouv):', rawRows.find(r => r.note === '425'));
console.log('Sample Note 426 (Clot):', rawRows.find(r => r.note === '426'));
