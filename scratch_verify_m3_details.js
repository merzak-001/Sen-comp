const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  console.log('=== VERIFYING MONTH 03/2026 BETWEEN BALANCE AND FBL3N ===\n');

  // 1. BALANCE DATA
  const p2 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '022026'");
  const p3 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '032026'");

  const getAcc = (p, acc) => p.find(r => r.boal_account === acc) || { debit:0, credit:0, solde:0 };

  // Sales
  const s31 = { p2: getAcc(p2, '88010031'), p3: getAcc(p3, '88010031') };
  const s39 = { p2: getAcc(p2, '88010039'), p3: getAcc(p3, '88010039') };
  const s53 = { p2: getAcc(p2, '88010053'), p3: getAcc(p3, '88010053') };

  const s31_net = (s31.p3.credit - s31.p2.credit) - (s31.p3.debit - s31.p2.debit);
  const s39_net = (s39.p3.credit - s39.p2.credit) - (s39.p3.debit - s39.p2.debit);
  const s53_net = (s53.p3.credit - s53.p2.credit) - (s53.p3.debit - s53.p2.debit);
  const totalSalesHT_bal = s31_net + s39_net + s53_net;
  const totalSalesTTC_bal = totalSalesHT_bal * 1.19;

  // Receivables
  const c10 = { p2: getAcc(p2, '14000010'), p3: getAcc(p3, '14000010') };
  const c30 = { p2: getAcc(p2, '14000030'), p3: getAcc(p3, '14000030') };
  const deltaC10 = c10.p3.solde - c10.p2.solde;
  const deltaC30 = c30.p3.solde - c30.p2.solde;
  const deltaRec_bal = deltaC10 + deltaC30;

  // Advances
  const c16 = { p2: getAcc(p2, '14060016'), p3: getAcc(p3, '14060016') };
  const deltaAdv_bal = c16.p3.solde - c16.p2.solde;

  console.log('--- FROM BALANCE ---');
  console.log('88010031 Net HT:', s31_net);
  console.log('88010039 Net HT:', s39_net);
  console.log('88010053 Net HT:', s53_net);
  console.log('Total Local Sales HT (Balance):', totalSalesHT_bal);
  console.log('Total Local Sales TTC (+19% TVA):', totalSalesTTC_bal);
  console.log('14000010 Delta Solde:', deltaC10);
  console.log('14000030 Delta Solde:', deltaC30);
  console.log('Total Delta Receivables (Balance):', deltaRec_bal);
  console.log('14060016 Delta Advances (Balance):', deltaAdv_bal);

  // Note formula:
  // In Jan:
  // Domestic Collections = SalesTTC - DeltaReceivables - DeltaAdvances
  // Let's test both signs of DeltaAdvances:
  console.log('\nFormula (SalesTTC - DeltaRec - DeltaAdv):', totalSalesTTC_bal - deltaRec_bal - deltaAdv_bal);
  console.log('Formula (SalesTTC - DeltaRec + DeltaAdv):', totalSalesTTC_bal - deltaRec_bal + deltaAdv_bal);

  // 2. FROM FBL3N
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
  const ws = wb.Sheets['Feuil1'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const m3Rows = [];
  for (let i = 1; i < data.length; i++) {
    const period = data[i][7];
    if (period === '2026/03' || period === '2026/3') {
      m3Rows.push({
        acct: String(data[i][2] || ''),
        amt: Number(data[i][14]) || 0
      });
    }
  }

  const s31_fbl = m3Rows.filter(r => r.acct === '88010031').reduce((s, r) => s - r.amt, 0);
  const s39_fbl = m3Rows.filter(r => r.acct === '88010039').reduce((s, r) => s - r.amt, 0);
  const s53_fbl = m3Rows.filter(r => r.acct === '88010053').reduce((s, r) => s - r.amt, 0);
  const totalSalesHT_fbl = s31_fbl + s39_fbl + s53_fbl;
  const totalSalesTTC_fbl = totalSalesHT_fbl * 1.19;

  const rec10_fbl = m3Rows.filter(r => r.acct === '14000010').reduce((s, r) => s + r.amt, 0);
  const rec30_fbl = m3Rows.filter(r => r.acct === '14000030').reduce((s, r) => s + r.amt, 0);
  const totalRec_fbl = rec10_fbl + rec30_fbl;

  const adv16_fbl = m3Rows.filter(r => r.acct === '14060016').reduce((s, r) => s + r.amt, 0);

  console.log('\n--- FROM FBL3N ---');
  console.log('88010031 Net HT (FBL3N):', s31_fbl);
  console.log('88010039 Net HT (FBL3N):', s39_fbl);
  console.log('88010053 Net HT (FBL3N):', s53_fbl);
  console.log('Total Local Sales HT (FBL3N):', totalSalesHT_fbl);
  console.log('Total Local Sales TTC (FBL3N):', totalSalesTTC_fbl);
  console.log('14000010 Net (FBL3N):', rec10_fbl);
  console.log('14000030 Net (FBL3N):', rec30_fbl);
  console.log('Total Receivables Net (FBL3N):', totalRec_fbl);
  console.log('14060016 Net (FBL3N):', adv16_fbl);

  const res_fbl = totalSalesTTC_fbl - totalRec_fbl - adv16_fbl;
  console.log('Formula result in FBL3N (salesTTC - rec - adv):', res_fbl);
  console.log('TARGET:', 113048059.35);

  process.exit(0);
})();
