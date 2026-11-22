const XLSX = require('xlsx');

// Let's check balance 102026.xls to see the official monthly or opening/closing bank balances
const wbBal = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/balance 102026.xls');
console.log('balance 102026 sheets:', wbBal.SheetNames);
const wsBal = wbBal.Sheets[wbBal.SheetNames[0]];
const balData = XLSX.utils.sheet_to_json(wsBal, { header: 1 });

console.log('--- BANK ACCOUNTS IN BALANCE 102026.XLS ---');
for (let r = 0; r < balData.length; r++) {
  const row = balData[r];
  if (!row) continue;
  const acct = String(row[1] || row[0] || '');
  if (acct.startsWith('51') || acct.startsWith('53') || acct.startsWith('54') || acct.startsWith('1186') || acct.startsWith('1017')) {
    console.log(`R${r+1}:`, row.slice(0, 10));
  }
}
