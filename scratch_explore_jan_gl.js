const XLSX = require('xlsx');

// Load FBL3N 2026 data
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

console.log(`January 2026 total rows: ${janRows.length}`);

// Group by account category:
const byCategory = {};
for (const r of janRows) {
  const prefix = r.acct.substring(0, 3);
  byCategory[prefix] = (byCategory[prefix] || 0) + r.amt;
}
console.log('January movements by 3-digit account prefix:');
Object.entries(byCategory).sort((a,b) => a[0].localeCompare(b[0])).forEach(([p, val]) => {
  console.log(`  ${p}: ${val.toFixed(2)}`);
});

// Let's inspect Class 6 (Expenses) in Jan 2026:
const class6 = janRows.filter(r => r.acct.startsWith('6'));
console.log(`Class 6 rows in Jan: ${class6.length}, Total = ${class6.reduce((a, r) => a + r.amt, 0)}`);

// Let's inspect Class 40 (Suppliers):
const accts40 = janRows.filter(r => r.acct.startsWith('19') || r.acct.startsWith('40') || r.acct.startsWith('152'));
console.log(`Supplier accts rows in Jan: ${accts40.length}`);
const byAcct40 = {};
accts40.forEach(r => byAcct40[r.acct] = (byAcct40[r.acct] || 0) + r.amt);
console.log('Supplier accounts net movements in Jan:');
console.log(byAcct40);

// Let's inspect Personnel accounts (42 / 43 / 173 / 177):
const acctsStaff = janRows.filter(r => r.acct.startsWith('42') || r.acct.startsWith('43') || r.acct.startsWith('173') || r.acct.startsWith('177'));
const byStaff = {};
acctsStaff.forEach(r => byStaff[r.acct] = (byStaff[r.acct] || 0) + r.amt);
console.log('Staff accounts net movements in Jan:');
console.log(byStaff);

// Let's inspect Tax accounts (44 / 174 / 178):
const acctsTax = janRows.filter(r => r.acct.startsWith('44') || r.acct.startsWith('174') || r.acct.startsWith('178'));
const byTax = {};
acctsTax.forEach(r => byTax[r.acct] = (byTax[r.acct] || 0) + r.amt);
console.log('Tax accounts net movements in Jan:');
console.log(byTax);
