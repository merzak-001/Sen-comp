const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const may = [];
for (let i = 1; i < data.length; i++) {
  if (data[i][7] === '2026/05') {
    may.push({
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

const bank = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
const outflows = may.filter(r => bank.includes(r.acct) && r.amt < 0);

// Exclude internal bank transfers
const nonInternal = outflows.filter(r => !['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '763435'].includes(r.off));

// Exclude personnel & taxes
const r403_405_off = ['17300228', '17760022', '17800017', '17470301', '17470313', '17470311'];
const nonStaffTax = nonInternal.filter(r => !r403_405_off.includes(r.off));

// Exclude pure bank charges
const r404_off = ['44010110', '44010114', '26020100'];
const supplierCandidates = nonStaffTax.filter(r => !r404_off.includes(r.off) && !r.txt.includes('FRAIS') && !r.txt.includes('AGIOS') && !r.txt.includes('EXTRAIT'));

console.log('Supplier candidates in May:');
supplierCandidates.forEach(r => {
  console.log(`Doc ${r.doc} | Off: ${r.off.padEnd(10)} | Amt: ${r.amt.toFixed(2).padStart(14)} | Txt: ${r.txt}`);
});

const sumSuppliers = supplierCandidates.reduce((a, r) => a + r.amt, 0);
console.log('Sum suppliers in May:', sumSuppliers);
console.log('Target 402:         ', -116818574.84);
console.log('Diff:               ', sumSuppliers - (-116818574.84));
