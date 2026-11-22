const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];

const m3Rows = [];
for (let i = 1; i < data.length; i++) {
  const period = data[i][7];
  if (period === '2026/03' || period === '2026/3') {
    m3Rows.push({
      acct: String(data[i][2] || ''),
      doc: String(data[i][3] || ''),
      ref: String(data[i][4] || ''),
      off: String(data[i][6] || ''),
      type: String(data[i][9] || ''),
      amt: Number(data[i][14]) || 0,
      txt: String(data[i][20] || '')
    });
  }
}

console.log('Total FBL3N lines in Month 03/2026:', m3Rows.length);

// Bank lines in Month 3
const bankLines = m3Rows.filter(r => bankAccts.includes(r.acct));
console.log('Bank lines in Month 3:', bankLines.length);

const bankReceipts = bankLines.filter(r => r.amt > 0);
console.log('\n--- BANK RECEIPTS (amt > 0) IN MONTH 3 ---');
let totalReceipts = 0;
bankReceipts.forEach(r => {
  console.log(`Doc: ${r.doc} | Type: ${r.type} | Amt: ${r.amt.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Off: ${r.off} | Txt: ${r.txt}`);
  totalReceipts += r.amt;
});
console.log(`Total Bank Receipts M3: ${totalReceipts.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);

// Check customer lines in Month 3
const clientLines = m3Rows.filter(r => r.acct.startsWith('140') || r.off.startsWith('140'));
console.log('\n--- FBL3N CLIENT RELATED LINES IN MONTH 3 ---');
clientLines.forEach(r => {
  console.log(`Acct: ${r.acct} | Doc: ${r.doc} | Type: ${r.type} | Amt: ${r.amt.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Off: ${r.off} | Txt: ${r.txt}`);
});
