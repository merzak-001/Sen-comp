const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/balance 102026.xls');
const ws = wb.Sheets['Sheet1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('=== BANK ACCOUNTS IN BALANCE 102026.XLS ===');
for (const r of data) {
  if (!r || r.length < 5) continue;
  const acct = String(r[3] || '');
  if (acct.startsWith('1186') || acct.startsWith('1017') || acct.startsWith('512')) {
    console.log(`${acct.padEnd(12)} | ${String(r[5] || '').padEnd(30)} | Report: ${r[9]} | M-1: ${r[11]} | Débit: ${r[13]} | Crédit: ${r[15]} | Solde Cum: ${r[16]}`);
  }
}
