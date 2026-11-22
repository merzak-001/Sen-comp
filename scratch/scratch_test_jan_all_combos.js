const XLSX = require('xlsx');

// Load FBL3N
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

const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
const janBank = janRows.filter(r => bankAccts.includes(r.acct));

// Exclude internal bank transfers
const internalDocs = ['2000002796', '2000002774', '2000002775', '2000002776', '2000002780', '2000002786', '2000002797', '2000002811', '2000002812', '2000002813', '2000002799', '2000002800'];
const externalBank = janBank.filter(r => !internalDocs.includes(r.doc));

const outflows = externalBank.filter(r => r.amt < 0);
console.log('External outflows count:', outflows.length, 'Total sum:', outflows.reduce((s, r) => s + r.amt, 0));

// Distinct buckets:
// 1. G50 Tax check: Doc 2000002785 (-21,681,860.00)
// 2. Net Paie: Doc 2000002781 (-9,242,025.36)
// 3. CNAS: Doc 2000002784 (-4,534,363.84)
// 4. STC Ardjane: Doc 2000002795 (-10,251,221.83)
// 5. Retenue de garantie ETP Rouba: Doc 2000002794 (-309,701.37)
// 6. Innova Rea advance/customer: Doc 2000002819 (-309,754.00)
// 7. Actualisation euro: Doc 100028265 (-47,072.20)
// 8. 2014 Regule: Doc 2000002815 (-41,065.86)
// 9. Bank fees (comms, fees, internet, etc.): docs 2000002801, 2802, 2803, 2804, 2805, 2806, 2807, 2816, 2777, 2778, 2779, 2793, 2808, 2809, 2810 (-62,642.49)
// 10. Local & Foreign Trade Suppliers (SLR 31.04M, Alger Port 13.64M, Jostar 9.46M, Francar 8.06M, Sensus Fr 10.38M, Mobilis 16.7k, Flash Graphic 15.2k, CNRC 36k, CMA CGM 989.6k, Bay Diab 129.2k, Prombati 154.8k, CAAT 406.3k) = -74,338,906.83

// IRG deduction: 3,032,380.00 (from December 2025 G50)

// Let's print the buckets
const sum = arr => arr.reduce((a, b) => a + b, 0);

console.log('Buckets calculated.');
