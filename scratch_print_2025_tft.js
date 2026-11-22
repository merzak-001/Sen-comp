const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
const ws = wb.Sheets['TFT 2025'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('--- 2025 CERTIFIED TFT MONTHLY DATA ---');
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
console.log('Row | Label | ' + months.join(' | ') + ' | Total');

for (let r = 5; r <= 33; r++) {
  const row = data[r];
  if (!row) continue;
  const label = String(row[0] || '').substring(0, 30);
  const code = row[1] || '';
  if (!code) continue;
  const vals = [];
  for (let c = 2; c <= 13; c++) {
    vals.push(Number(row[c]) ? Number(row[c]).toFixed(0) : '0');
  }
  const tot = Number(row[14]) ? Number(row[14]).toFixed(0) : '0';
  console.log(`${code.toString().padEnd(4)} | ${label.padEnd(30)} | ${vals.join(' | ')} | ${tot}`);
}
