const XLSX = require('xlsx');
const p = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(p);
const ws1 = wb.Sheets['TFT 2025'];

// Column N in TFT 2025 is December 2025
console.log('--- TFT 2025 Column N (Décembre 2025) Values ---');
const tftDec = {};
for (let r = 7; r <= 34; r++) {
  const note = ws1['B' + r]?.v;
  const val = ws1['N' + r]?.v;
  const lib = ws1['A' + r]?.v;
  if (note) {
    tftDec[note] = val;
    console.log(`Note ${String(note).padEnd(4)}: ${String(val).padStart(18)} | ${lib}`);
  }
}

// Now let's analyze transactions in December bank sheets: '5', 'BEA,', 'EUR,'
const bankSheets = ['5', 'BEA,', 'EUR,'];
const allDecTx = [];
for (const s of bankSheets) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[s]);
  for (const r of rows) {
    allDecTx.push({ sheet: s, ...r });
  }
}
console.log(`\nTotal December bank transactions: ${allDecTx.length}`);

// Group by Doc Type and Counterpart
const byDocType = {};
for (const tx of allDecTx) {
  const dt = tx['Type de pièce'] || 'UNKNOWN';
  const amt = tx['Montant en devise interne'] || 0;
  byDocType[dt] = (byDocType[dt] || 0) + amt;
}
console.log('\nSum of December bank transactions by Document Type:');
for (const [dt, sum] of Object.entries(byDocType)) {
  console.log(`  Type ${dt.padEnd(5)}: ${sum.toLocaleString('fr-FR').padStart(20)} DA`);
}

const totalBankMvt = allDecTx.reduce((a, b) => a + (b['Montant en devise interne'] || 0), 0);
console.log(`\nTotal Bank Movements in Dec: ${totalBankMvt.toLocaleString('fr-FR')} DA`);
console.log(`TFT Note 424 (Dec Variation): ${Number(tftDec['424']).toLocaleString('fr-FR')} DA`);
console.log(`Difference: ${(totalBankMvt - Number(tftDec['424'])).toLocaleString('fr-FR')} DA`);
