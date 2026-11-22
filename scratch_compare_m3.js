const XLSX = require('xlsx');
const sqlDb = require('./sqlDb');

(async () => {
  // Let's analyze exact March 2026 numbers
  const p2 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '022026'");
  const p3 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '032026'");

  // Helper
  const getAcc = (p, acc) => p.find(r => r.boal_account === acc) || { debit:0, credit:0, solde:0 };

  // Sales
  const sPF = { m2: getAcc(p2, '88010031'), m3: getAcc(p3, '88010031') };
  const sDiv = { m2: getAcc(p2, '88010039'), m3: getAcc(p3, '88010039') };
  const sMarch = { m2: getAcc(p2, '88010053'), m3: getAcc(p3, '88010053') };
  const sExp = { m2: getAcc(p2, '88030510'), m3: getAcc(p3, '88030510') };

  const netPF = (sPF.m3.credit - sPF.m2.credit) - (sPF.m3.debit - sPF.m2.debit);
  const netDiv = (sDiv.m3.credit - sDiv.m2.credit) - (sDiv.m3.debit - sDiv.m2.debit);
  const netMarch = (sMarch.m3.credit - sMarch.m2.credit) - (sMarch.m3.debit - sMarch.m2.debit);
  const netExp = (sExp.m3.credit - sExp.m2.credit) - (sExp.m3.debit - sExp.m2.debit);

  console.log('--- MONTH 03/2026 SALES (NET HT) ---');
  console.log('88010031 (Ventes Produits Finis):', netPF);
  console.log('88010039 (Ventes Produits Divers):', netDiv);
  console.log('88010053 (Ventes Marchandises):', netMarch);
  console.log('88030510 (Ventes Exportation):', netExp);

  // Clients
  const cDom = { m2: getAcc(p2, '14000010'), m3: getAcc(p3, '14000010') };
  const cADE = { m2: getAcc(p2, '14000030'), m3: getAcc(p3, '14000030') };
  const cGrp = { m2: getAcc(p2, '14050500'), m3: getAcc(p3, '14050500') };
  const cAv = { m2: getAcc(p2, '14060016'), m3: getAcc(p3, '14060016') };

  console.log('\n--- CLIENT MOVEMENTS IN MONTH 03/2026 ---');
  console.log('14000010 (Domestiques):');
  console.log('  Solde M-1:', cDom.m2.solde, 'Solde M:', cDom.m3.solde, 'Delta:', cDom.m3.solde - cDom.m2.solde);
  console.log('  Month Debit:', cDom.m3.debit - cDom.m2.debit, 'Month Credit:', cDom.m3.credit - cDom.m2.credit);

  console.log('14000030 (ADE):');
  console.log('  Solde M-1:', cADE.m2.solde, 'Solde M:', cADE.m3.solde, 'Delta:', cADE.m3.solde - cADE.m2.solde);
  console.log('  Month Debit:', cADE.m3.debit - cADE.m2.debit, 'Month Credit:', cADE.m3.credit - cADE.m2.credit);

  console.log('14050500 (Clients Groupe / Export):');
  console.log('  Solde M-1:', cGrp.m2.solde, 'Solde M:', cGrp.m3.solde, 'Delta:', cGrp.m3.solde - cGrp.m2.solde);
  console.log('  Month Debit:', cGrp.m3.debit - cGrp.m2.debit, 'Month Credit:', cGrp.m3.credit - cGrp.m2.credit);

  console.log('14060016 (Avances Clients):');
  console.log('  Solde M-1:', cAv.m2.solde, 'Solde M:', cAv.m3.solde, 'Delta:', cAv.m3.solde - cAv.m2.solde);
  console.log('  Month Debit:', cAv.m3.debit - cAv.m2.debit, 'Month Credit:', cAv.m3.credit - cAv.m2.credit);

  // Now let's test FBL3N actual cash received in bank for month 3
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
  const ws = wb.Sheets['Feuil1'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];

  const custReceipts = [];
  for (let i = 1; i < data.length; i++) {
    const period = data[i][7];
    if (period === '2026/03' || period === '2026/3') {
      const acct = String(data[i][2] || '');
      const amt = Number(data[i][14]) || 0;
      const type = String(data[i][9] || '');
      const off = String(data[i][6] || '');
      const doc = String(data[i][3] || '');
      const txt = String(data[i][20] || '');

      // Customer payment into bank:
      if (bankAccts.includes(acct) && amt > 0) {
        // Is it customer?
        // Note: dividends (2000002983, 2000002984) and transfers (2000002964) and tax return/fee are not customers
        if (type === 'DZ' || off === '14060016' || txt.includes('RECU') || txt.includes('CHQ') || txt.includes('ENCAISS')) {
          if (!txt.includes('DIVIDENDES') && !txt.includes('COMPTE CPA') && !txt.includes('ACOMPTE')) {
            custReceipts.push({ doc, type, amt, off, txt });
          }
        }
      }
    }
  }

  console.log('\n--- FILTERED CUSTOMER RECEIPTS IN FBL3N (BANK ACCOUNTS) ---');
  let sumFBL3N = 0;
  custReceipts.forEach(r => {
    sumFBL3N += r.amt;
  });
  console.log('Total Customer Receipts in Bank FBL3N:', sumFBL3N);

  // Check the certified targets:
  console.log('Target 1 (scratch_compute_all_months_tft.js): 113,045,437.38');
  console.log('Target 2 (scratch_tft_summary_table.js):      113,048,059.35');

  // Let's see what difference there is:
  console.log('Diff vs Target 1:', sumFBL3N - 113045437.38);
  console.log('Diff vs Target 2:', sumFBL3N - 113048059.35);

  process.exit(0);
})();
