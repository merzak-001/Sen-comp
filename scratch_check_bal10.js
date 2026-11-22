const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/balance 102026.xls');
const ws = wb.Sheets['Sheet1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('Searching client and sales accounts in balance 102026.xls...');

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (!row || row.length < 5) continue;
  const acct = String(row[3] || '');
  const desc = String(row[5] || '');
  if (
    acct.startsWith('411') || acct.startsWith('419') || acct.startsWith('140') ||
    acct.startsWith('70') || desc.includes('CLIENT') || desc.includes('VENTE') || desc.includes('AVANCE')
  ) {
    console.log(`Row ${i} | Acct: ${acct.padEnd(10)} | ${desc.padEnd(25)} | Report: ${row[9]} | M-1: ${row[11]} | Débit: ${row[13]} | Crédit: ${row[15]} | Solde Cum: ${row[16]}`);
  }
}
