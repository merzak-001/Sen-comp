const XLSX = require('xlsx');

// Load FBL3N 051026.xlsx
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const jan = [];
for (let i = 1; i < data.length; i++) {
  if (data[i][7] === '2026/01') {
    jan.push({
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
const outflows = jan.filter(r => bank.includes(r.acct) && r.amt < 0);

// Exclude internal bank transfers
const internalBankOffs = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311'];
const externalOutflows = outflows.filter(r => !internalBankOffs.includes(r.off));

console.log('Total external outflows in Jan 2026:', externalOutflows.length);
const totalExtOut = externalOutflows.reduce((a, r) => a + r.amt, 0);
console.log('Sum total external outflows:', totalExtOut.toFixed(2));

// 1. Bank fees (Row 404):
const feeLines = externalOutflows.filter(r => 
  ['26020100', '44010110'].includes(r.off) || 
  r.txt.toLowerCase().includes('frais') || 
  r.txt.toLowerCase().includes('com') || 
  r.txt.toLowerCase().includes('extrait')
);
const feeSum = feeLines.reduce((a, r) => a + r.amt, 0);

// Without the old 2014 régule (-41,065.86):
const feeWithoutRegule = feeLines.filter(r => !r.txt.includes('2014')).reduce((a, r) => a + r.amt, 0);

console.log('\n--- ROW 404 (BANK FEES) ---');
console.log('Option 1 (All bank fees):', feeSum.toFixed(2));
console.log('Option 2 (Without 2014 régule):', feeWithoutRegule.toFixed(2));

// 2. G50 Tax check (Row 405):
const g50Check = externalOutflows.find(r => r.off === '17800017');
const g50Total = g50Check ? g50Check.amt : -21681860.00;

// Salary IRG candidates:
// In Dec 2025 working papers (Sheet 5, line 50), IRG was 3,032,380.00
const irgDec = 3032380.00;
// What if IRG was different? Let's check account 17460003 in Jan:
const irgRowsJan = jan.filter(r => r.acct === '17460003');
const irgJanGL = irgRowsJan.reduce((a, r) => a + r.amt, 0);

console.log('\n--- ROW 405 (TAXES) ---');
console.log('G50 Total check:', g50Total.toFixed(2));
console.log('Option 1 (Full G50 check without IRG split):', g50Total.toFixed(2));
console.log('Option 2 (G50 check minus Dec salary IRG 3,032,380):', (g50Total + irgDec).toFixed(2));

// 3. Personnel (Row 403):
const paieReg = externalOutflows.find(r => r.txt.includes('PAIE 01/2026'));
const paieAmt = paieReg ? paieReg.amt : -9242025.36;
const cnasCheck = externalOutflows.find(r => r.off === '17760022');
const cnasAmt = cnasCheck ? cnasCheck.amt : -4534363.84;
const stcCheck = externalOutflows.find(r => r.txt.includes('STC'));
const stcAmt = stcCheck ? stcCheck.amt : -10251221.83;

console.log('\n--- ROW 403 (PERSONNEL) ---');
console.log('Option 1 (Paie + CNAS only):', (paieAmt + cnasAmt).toFixed(2));
console.log('Option 2 (Paie + CNAS + Dec salary IRG 3,032,380):', (paieAmt + cnasAmt - irgDec).toFixed(2));
console.log('Option 3 (Paie + CNAS + STC severance):', (paieAmt + cnasAmt + stcAmt).toFixed(2));
console.log('Option 4 (Paie + CNAS + STC + Dec salary IRG):', (paieAmt + cnasAmt + stcAmt - irgDec).toFixed(2));

// 4. FX Adjustment (Row 423):
const fxLine = externalOutflows.find(r => r.off === '28000010');
console.log('\n--- ROW 423 (FX VARIATION) ---');
console.log('FX Line (Doc 100028265):', fxLine ? fxLine.amt.toFixed(2) : '-47072.20');

// 5. Suppliers (Row 402):
const knownNonSuppliers = [
  ...feeLines.map(r => r.doc),
  g50Check ? g50Check.doc : '',
  paieReg ? paieReg.doc : '',
  cnasCheck ? cnasCheck.doc : '',
  stcCheck ? stcCheck.doc : '',
  fxLine ? fxLine.doc : ''
];

const supplierLines = externalOutflows.filter(r => !knownNonSuppliers.includes(r.doc));
const supplierSum = supplierLines.reduce((a, r) => a + r.amt, 0);

console.log('\n--- ROW 402 (SUPPLIERS) ---');
console.log('Trade Suppliers Base Sum:', supplierSum.toFixed(2));
console.log('   (If STC -10.25M is in Suppliers instead of Personnel):', (supplierSum + stcAmt).toFixed(2));
console.log('   (If 2014 régule -41k is in Suppliers):', (supplierSum - 41065.86).toFixed(2));
