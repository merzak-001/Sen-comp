const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('Total rows in FBL3N 051026.xlsx:', data.length);
const periods = {};
for (let i = 1; i < data.length; i++) {
  const p = data[i][7]; // Année/Mois
  if (p) periods[p] = (periods[p] || 0) + 1;
}
console.log('Periods in FBL3N 051026.xlsx:');
console.table(periods);

process.exit(0);
