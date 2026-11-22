const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
const internalDocs = ['2000002796', '2000002774', '2000002775', '2000002776', '2000002780', '2000002786', '2000002797', '2000002811', '2000002812', '2000002813', '2000002799', '2000002800'];

const janBank = [];
for (let i = 1; i < data.length; i++) {
  if (data[i][7] === '2026/01') {
    const acct = String(data[i][2]);
    const doc = String(data[i][3]);
    if (bankAccts.includes(acct) && !internalDocs.includes(doc)) {
      janBank.push({
        acct,
        doc,
        off: String(data[i][6]),
        amt: Number(data[i][14]) || 0,
        txt: String(data[i][20] || '')
      });
    }
  }
}

const byOff = {};
janBank.filter(r => r.amt < 0).forEach(r => {
  byOff[r.off] = (byOff[r.off] || 0) + r.amt;
});

console.log('January 2026 Bank Outflows by Offset account:');
Object.entries(byOff).sort((a,b) => a[1] - b[1]).forEach(([off, amt]) => {
  console.log(`  Off ${off.padEnd(14)}: ${amt.toFixed(2)}`);
});

console.log('\nUser targets for Jan:');
console.log('  Row 401:', 71268189.42);
console.log('  Row 402:', 58476977.38);
console.log('  Row 403:', 26964763.13);
console.log('  Row 404:', 75649.19);
console.log('  Row 405:', 18738627.00);
console.log('  Row 406:', 32987827.28);
