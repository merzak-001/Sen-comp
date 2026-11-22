const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
const ws = wb.Sheets['TFT 2025'];
const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });

const r403 = excelData.find(x => String(x[1]).trim() === '403');
const r404 = excelData.find(x => String(x[1]).trim() === '404');
const r405 = excelData.find(x => String(x[1]).trim() === '405');

console.log('Row 403 (Personnel):', r403.slice(2, 16));
if (r404) console.log('Row 404 (Intérêts):', r404.slice(2, 16));
if (r405) console.log('Row 405 (Impôts):', r405.slice(2, 16));
