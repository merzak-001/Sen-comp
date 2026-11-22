const XLSX = require('xlsx');
const path = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx';
const wb = XLSX.readFile(path);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Feuil1']);

console.log('--- EXAMINING MONTH 9 (SEPTEMBER 2026) FULL TFT BREAKDOWN ---');
const sepLines = rows.filter(r => r['Période comptable'] === 9 || r['Année/Mois'] === '2026/09');
const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];

const sepBank = sepLines.filter(r => bankAccounts.includes(String(r['Compte'])));
console.log('Total September bank movements:', sepBank.length);

let sep401 = 210951817.50; // Certified by accountant
let sep402 = 0; // Suppliers
let sep403 = 0; // Paie
let sep404 = 0; // Frais fin
let sep405 = 0; // Impots
let sep410 = 0; // Immo
let sep412 = 0; // Cautions -
let sep413 = 0; // Cautions +
let sep419 = 0; // Dividendes
let sep423 = 0; // Change

for (const r of sepBank) {
  const dt = String(r['Type de pièce'] || '').toUpperCase();
  const amt = r['Montant en devise interne'] || 0;
  const txt = String(r['Texte'] || '').toLowerCase();
  const off = String(r['Compte contrepartie'] || '');

  if (amt < 0) {
    if (txt.includes('salaire') || txt.includes('paie') || txt.includes('cnas') || off.startsWith('173') || off.startsWith('42') || off.startsWith('43')) {
      sep403 += amt;
    } else if (txt.includes('impot') || txt.includes('irg') || txt.includes('tap') || txt.includes('tva') || txt.includes('ibs') || off.startsWith('174') || off.startsWith('44')) {
      sep405 += amt;
    } else if (dt === 'SK') {
      sep404 += amt;
    } else if (txt.includes('caution') || off.startsWith('196') || off.startsWith('275')) {
      sep412 += amt;
    } else if (txt.includes('change') || txt.includes('devise') || r['Compte'] === 11867211) {
      sep423 += amt;
    } else {
      sep402 += amt;
    }
  } else {
    // positive debits (receipts)
    if (txt.includes('caution') || off.startsWith('196') || off.startsWith('275')) {
      sep413 += amt;
    } else if (txt.includes('change') || txt.includes('devise') || r['Compte'] === 11867211) {
      sep423 += amt;
    }
  }
}

console.log('Sep 401 (Clients)       :', sep401.toLocaleString('fr-FR'), 'DA');
console.log('Sep 402 (Fournisseurs)  :', sep402.toLocaleString('fr-FR'), 'DA');
console.log('Sep 403 (Personnel)     :', sep403.toLocaleString('fr-FR'), 'DA');
console.log('Sep 404 (Frais fin.)    :', sep404.toLocaleString('fr-FR'), 'DA');
console.log('Sep 405 (Impôts)        :', sep405.toLocaleString('fr-FR'), 'DA');
console.log('Sep 412 (Cautions -)    :', sep412.toLocaleString('fr-FR'), 'DA');
console.log('Sep 413 (Cautions +)    :', sep413.toLocaleString('fr-FR'), 'DA');
console.log('Sep 423 (Change)        :', sep423.toLocaleString('fr-FR'), 'DA');

const fluxA = sep401 + sep402 + sep403 + sep404 + sep405;
const fluxB = sep410 + sep412 + sep413;
const fluxC = sep419 + sep423;
const varNetSep = fluxA + fluxB + fluxC;

console.log('\nFlux A (Opérationnel)   :', fluxA.toLocaleString('fr-FR'), 'DA');
console.log('Flux B (Investissement) :', fluxB.toLocaleString('fr-FR'), 'DA');
console.log('Flux C (Financement)    :', fluxC.toLocaleString('fr-FR'), 'DA');
console.log('Variation Nette Sep     :', varNetSep.toLocaleString('fr-FR'), 'DA');
