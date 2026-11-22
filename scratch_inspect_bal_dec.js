const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
const ws = wb.Sheets['BAL DEC'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('BAL DEC row count:', data.length);
data.slice(0, 20).forEach((r, idx) => console.log(`Row ${idx}:`, r));
