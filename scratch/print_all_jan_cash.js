const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const bankRows = [];
for (let i = 1; i < data.length; i++) {
  const period = data[i][7];
  const acct = String(data[i][2]);
  if (period === '2026/01' && (acct.startsWith('512') || acct.startsWith('210') || acct.startsWith('531'))) {
    bankRows.push({
      acct,
      doc: String(data[i][3]),
      ref: String(data[i][4]),
      type: String(data[i][9]),
      date: data[i][11],
      amt: Number(data[i][14]) || 0,
      txt: String(data[i][20] || '')
    });
  }
}

console.log('Total Jan 2026 cash/bank rows:', bankRows.length);
const debits = bankRows.filter(r => r.amt > 0);
const credits = bankRows.filter(r => r.amt < 0);
console.log('Inflows (amt > 0):', debits.length, 'sum =', debits.reduce((s, r) => s + r.amt, 0));
console.log('Outflows (amt < 0):', credits.length, 'sum =', credits.reduce((s, r) => s + r.amt, 0));

console.log('\n--- ALL JAN 2026 OUTFLOWS (amt < 0) ---');
credits.sort((a,b) => a.amt - b.amt).forEach(r => {
  console.log(`${r.doc} | ${r.acct} | ${r.amt.toFixed(2).padStart(15)} | ${r.txt.padEnd(45)} | Ref: ${r.ref}`);
});

console.log('\n--- ALL JAN 2026 INFLOWS (amt > 0) ---');
debits.sort((a,b) => b.amt - a.amt).forEach(r => {
  console.log(`${r.doc} | ${r.acct} | ${r.amt.toFixed(2).padStart(15)} | ${r.txt.padEnd(45)} | Ref: ${r.ref}`);
});
