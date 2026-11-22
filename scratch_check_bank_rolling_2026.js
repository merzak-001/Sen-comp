const XLSX = require('xlsx');

// Check opening cash for 2026:
// In balance 102026.xls or FBL3N, let's check bank balances:
// Bank accounts: 11867005, 11867007, 11867009, 11867210, 11867211, 11867310, 11867311, 10170200
const wb25 = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
const ws25 = wb25.Sheets['TFT 2025'];
const closing2025 = Number(ws25['N33'].v); // Row 33 Col N = Dec Closing Cash
console.log('Certified Closing Cash 2025 (Dec 31, 2025):', closing2025.toLocaleString('en-US', {minimumFractionDigits: 2}));

// Now let's check the bank balances movement in 2026:
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
const netBankByMonth = {};
for (let m = 1; m <= 9; m++) netBankByMonth[m] = 0;

for (let i = 1; i < data.length; i++) {
  const period = data[i][7];
  if (!period || !period.startsWith('2026/')) continue;
  const m = parseInt(period.split('/')[1], 10);
  if (m >= 1 && m <= 9) {
    const acct = String(data[i][2]);
    if (bankAccts.includes(acct)) {
      netBankByMonth[m] += Number(data[i][14]) || 0;
    }
  }
}

console.log('\n--- 2026 BANK ACCOUNTS NET VARIATION (Row 424 / 427) ---');
let runningCash = closing2025;
for (let m = 1; m <= 9; m++) {
  const mOuv = runningCash;
  const netVar = netBankByMonth[m];
  runningCash += netVar;
  const mClot = runningCash;
  console.log(`Month ${m}: Ouv = ${mOuv.toLocaleString('en-US', {minimumFractionDigits: 2})} | Net Var = ${netVar.toLocaleString('en-US', {minimumFractionDigits: 2})} | Clot = ${mClot.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
}
