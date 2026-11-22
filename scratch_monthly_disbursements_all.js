const XLSX = require('xlsx');

// Let's analyze all months of 2026 for rows 402, 403, 404, 405
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const monthsData = {};
for (let m = 1; m <= 9; m++) monthsData[m] = [];

for (let i = 1; i < data.length; i++) {
  const period = data[i][7];
  if (!period || !period.startsWith('2026/')) continue;
  const m = parseInt(period.split('/')[1], 10);
  if (m >= 1 && m <= 9) {
    monthsData[m].push({
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

const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];

console.log('--- MONTHLY ANALYSIS OF 402, 403, 404, 405 IN 2026 ---');

for (let m = 1; m <= 9; m++) {
  const rows = monthsData[m];
  const outflows = rows.filter(r => bankAccts.includes(r.acct) && r.amt < 0);
  
  // 1. G50 Tax check:
  const g50Rows = outflows.filter(r => r.txt.toLowerCase().includes('g50') || ['17800017', '17460003', '17460004'].includes(r.off));
  const g50Total = g50Rows.reduce((a, r) => a + r.amt, 0);
  
  // 2. Net Paie & CNAS:
  const paieRows = outflows.filter(r => r.txt.toLowerCase().includes('paie') || r.txt.toLowerCase().includes('salaire') || r.off === '17300228');
  const paieTotal = paieRows.reduce((a, r) => a + r.amt, 0);
  
  const cnasRows = outflows.filter(r => r.txt.toLowerCase().includes('cnas') || r.off === '17760022');
  const cnasTotal = cnasRows.reduce((a, r) => a + r.amt, 0);

  // 3. Bank fees (404):
  const feeRows = outflows.filter(r => ['44010110', '44010114', '26020100'].includes(r.off) || (r.txt.toLowerCase().includes('frais') && !r.txt.toLowerCase().includes('mission') && !r.txt.toLowerCase().includes('vehic')));
  const feeTotal = feeRows.reduce((a, r) => a + r.amt, 0);

  console.log(`Month ${m}: Outflows count = ${outflows.length} | G50 Check = ${g50Total.toFixed(2)} | Paie = ${paieTotal.toFixed(2)} | CNAS = ${cnasTotal.toFixed(2)} | Fees = ${feeTotal.toFixed(2)}`);
}
