const XLSX = require('xlsx');

// Load FBL3N 051026.xlsx
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const janRows = [];
for (let i = 1; i < data.length; i++) {
  if (data[i][7] === '2026/01') {
    janRows.push({
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

console.log(`Total January 2026 rows: ${janRows.length}`);

// Bank accounts
const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
const janBank = janRows.filter(r => bankAccts.includes(r.acct));

console.log(`January bank rows: ${janBank.length}`);
console.log('Total bank inflows (amt > 0):', janBank.filter(r => r.amt > 0).reduce((a, r) => a + r.amt, 0));
console.log('Total bank outflows (amt < 0):', janBank.filter(r => r.amt < 0).reduce((a, r) => a + r.amt, 0));
console.log('Net bank variation in Jan 2026:', janBank.reduce((a, r) => a + r.amt, 0));

console.log('\n--- ALL JANUARY 2026 BANK OUTFLOWS ---');
const janOutflows = janBank.filter(r => r.amt < 0);
janOutflows.forEach((r, idx) => {
  console.log(`${idx+1}. Doc ${r.doc} | Acct ${r.acct} | Type ${r.type} | Off: ${r.off.padEnd(10)} | Amt: ${r.amt.toFixed(2).padStart(14)} | Txt: ${r.txt}`);
});
