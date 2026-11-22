const XLSX = require('xlsx');

// Load FBL3N 051026.xlsx for 2026/05
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const mayRows = [];
for (let i = 1; i < data.length; i++) {
  if (data[i][7] === '2026/05') {
    mayRows.push({
      acct: String(data[i][2]),
      doc: String(data[i][3]),
      ref: String(data[i][4]),
      off: String(data[i][6]),
      type: String(data[i][9]),
      amt: Number(data[i][14]) || 0,
      txt: String(data[i][20] || '')
    });
  }
}

console.log(`May 2026 rows loaded: ${mayRows.length}`);

// Targets for May 2026:
const target402 = -116818574.84;
const target403 = -26107976.41;
const target404 = -618508.96;
const target405 = -15032851.00;

console.log('Targets:', { target402, target403, target404, target405 });

// Check bank accounts in May:
const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
const bankOutflows = mayRows.filter(r => bankAccts.includes(r.acct) && r.amt < 0);
console.log(`Total bank outflows in May: ${bankOutflows.length} rows, Sum = ${bankOutflows.reduce((a, r) => a + r.amt, 0)}`);

// Look at unique counterparty accounts in bankOutflows:
const byOff = {};
bankOutflows.forEach(r => {
  byOff[r.off] = (byOff[r.off] || 0) + r.amt;
});
console.log('Bank Outflows by Offset account:');
Object.entries(byOff).sort((a, b) => a[1] - b[1]).forEach(([off, amt]) => {
  console.log(`  Off ${off.padEnd(12)}: ${amt.toFixed(2)}`);
});
