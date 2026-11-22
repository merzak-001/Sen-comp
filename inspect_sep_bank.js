const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

const bankAccounts = ['11867005', '11867001', '11867007', '11867009', '11867311', '11867010', '11867011', '11861001', '512100000', '512500000'];

const sepBankRows = rows.filter(r => {
  const acct = String(r['Compte'] || '').trim();
  const ym = String(r['Année/Mois'] || '').trim();
  return ym === '2026/09' && (bankAccounts.includes(acct) || acct.startsWith('1186'));
});

console.log('September bank movements count:', sepBankRows.length);

let totalIn = 0;
let totalOut = 0;

const categorized = {
  clients: [],
  fournisseurs: [],
  personnel: [],
  impots: [],
  fraisFin: [],
  invest: [],
  virementsInternes: [],
  autres: []
};

sepBankRows.forEach(r => {
  const acct = String(r['Compte']).trim();
  const piece = String(r['Nº pièce'] || '').trim();
  const cpart = String(r['Compte contrepartie'] || '').trim();
  const docType = String(r['Type de pièce'] || '').trim();
  const text = String(r['Texte'] || '').trim();
  const amt = Number(r['Montant en devise interne']) || 0;
  
  if (amt > 0) totalIn += amt;
  else totalOut += Math.abs(amt);

  console.log(`PIECE:${piece.padEnd(10)} | BANK:${acct} | CPART:${cpart.padEnd(10)} | TYPE:${docType} | AMT:${amt.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)} | TEXT:${text}`);
});

console.log('\nTOTAL IN (Debits):', totalIn.toLocaleString('fr-FR', {minimumFractionDigits: 2}));
console.log('TOTAL OUT (Credits):', totalOut.toLocaleString('fr-FR', {minimumFractionDigits: 2}));
console.log('NET VARIATION:', (totalIn - totalOut).toLocaleString('fr-FR', {minimumFractionDigits: 2}));
