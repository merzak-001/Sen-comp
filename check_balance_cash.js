const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/balance 102026.xls');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('=== BANK & CASH ACCOUNTS IN balance 102026.xls ===');
let totReport = 0, totDebit = 0, totCredit = 0, totSolde = 0;

rows.forEach((r, idx) => {
  if (!r) return;
  const acct = String(r[3] || '').trim();
  const desc = String(r[5] || '').trim();
  // Cash accounts in SAP 8660
  if (['11867005', '11867001', '11867007', '11867009', '11867311', '11867010', '11867011', '11861001', '11880001'].includes(acct)) {
    const report = Number(r[9]) || 0;
    const debit = Number(r[13]) || 0;
    const credit = Number(r[15]) || 0;
    const solde = Number(r[16]) || 0;
    totReport += report;
    totDebit += debit;
    totCredit += credit;
    totSolde += solde;
    console.log(`Row ${idx+1}: Acct:${acct.padEnd(10)} | Desc:${desc.padEnd(25)} | Report:${report.toLocaleString('fr-FR')} | Debit:${debit.toLocaleString('fr-FR')} | Credit:${credit.toLocaleString('fr-FR')} | Solde:${solde.toLocaleString('fr-FR')}`);
  }
});

console.log('\n--- TOTAL CASH & EQUIVALENTS (TRESORERIE ACTIVE) ---');
console.log('Opening Cash (Report de Solde):', totReport.toLocaleString('fr-FR', { minimumFractionDigits: 2 }));
console.log('Debit Movements              :', totDebit.toLocaleString('fr-FR', { minimumFractionDigits: 2 }));
console.log('Credit Movements             :', totCredit.toLocaleString('fr-FR', { minimumFractionDigits: 2 }));
console.log('Net Movement (Debit - Credit):', (totDebit - totCredit).toLocaleString('fr-FR', { minimumFractionDigits: 2 }));
console.log('Closing Cash (Solde Cumulé)  :', totSolde.toLocaleString('fr-FR', { minimumFractionDigits: 2 }));
