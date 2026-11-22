const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

const bankAccounts = new Set(['11867005', '11867001', '11867007', '11867009', '11867311', '11867010', '11867011', '11861001']);

// Find all entries in 2026/09 where a bank account was credited (money leaving the company)
// or counterparties of bank disbursements
const sepRows = rows.filter(r => String(r['Année/Mois'] || '').trim() === '2026/09');

console.log('--- ALL MONEY OUT IN SEPTEMBER 2026 ---');

// In 11867311 (BEA CC) and 11867005 (CPA CC):
const outEntries = [];

sepRows.forEach(r => {
  const acct = String(r['Compte'] || '').trim();
  const cpart = String(r['Compte contrepartie'] || '').trim();
  const amt = Number(r['Montant en devise interne']) || 0;
  const piece = String(r['Nº pièce'] || '').trim();
  const docType = String(r['Type de pièce'] || '').trim();
  const text = String(r['Texte'] || '').trim();

  // If it is bank account and amount < 0 (credit = payment out)
  if (['11867005', '11867311'].includes(acct) && amt < 0) {
    // Exclude internal bank transfers between 11867009 and 11867311, or 11867005 and 11867007
    if (!bankAccounts.has(cpart)) {
      outEntries.push({ acct, cpart, amt, piece, docType, text });
    }
  }
  // Foreign suppliers direct KZ on 11867009:
  if (acct === '11867009' && amt < 0 && !bankAccounts.has(cpart)) {
    outEntries.push({ acct, cpart, amt, piece, docType, text });
  }
});

console.log(`Found ${outEntries.length} disbursement entries:\n`);

let catTotals = {
  fournisseurs_locaux: 0,
  fournisseurs_etrangers: 0,
  personnel_salaires: 0,
  personnel_cnas: 0,
  impots_g50: 0,
  impots_apprentissage: 0,
  frais_bancaires: 0,
  autres: 0
};

outEntries.forEach(e => {
  let cat = 'autres';
  if (e.cpart === '17300228') {
    cat = 'personnel_salaires';
    catTotals.personnel_salaires += Math.abs(e.amt);
  } else if (e.cpart === '17760022') {
    cat = 'personnel_cnas';
    catTotals.personnel_cnas += Math.abs(e.amt);
  } else if (e.cpart === '17460003') {
    cat = 'impots_g50';
    catTotals.impots_g50 += Math.abs(e.amt);
  } else if (e.cpart === '17470126') {
    cat = 'impots_apprentissage';
    catTotals.impots_apprentissage += Math.abs(e.amt);
  } else if (e.cpart === '15200003' || e.cpart === '16000010' || e.cpart === '16000007') {
    cat = 'fournisseurs_locaux';
    catTotals.fournisseurs_locaux += Math.abs(e.amt);
  } else if (e.text.includes('SIMONFOND') || e.text.includes('JUSTAR') || e.cpart === '1380763' || e.cpart === '1013791') {
    cat = 'fournisseurs_etrangers';
    catTotals.fournisseurs_etrangers += Math.abs(e.amt);
  } else if (['44010110', '44010114', '26020100'].includes(e.cpart)) {
    cat = 'frais_bancaires';
    catTotals.frais_bancaires += Math.abs(e.amt);
  } else {
    catTotals.autres += Math.abs(e.amt);
  }
  console.log(`[${cat.padEnd(22)}] ${e.piece} | Bank:${e.acct} | Cpart:${e.cpart.padEnd(10)} | ${Math.abs(e.amt).toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} | ${e.text}`);
});

console.log('\n--- DISBURSEMENT SUMMARY BY CATEGORY ---');
Object.keys(catTotals).forEach(k => {
  console.log(`${k.padEnd(25)}: ${catTotals[k].toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)} DA`);
});
const totalOutReal = Object.values(catTotals).reduce((a, b) => a + b, 0);
console.log(`TOTAL REAL DISBURSEMENTS: ${totalOutReal.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)} DA`);
