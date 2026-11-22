const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  console.log('=== INVESTIGATING DECEMBER 2025 (PERIOD 122025) ===\n');

  const p11 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '112025'");
  const p12 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '122025'");

  console.log(`Loaded 112025 (${p11.length} accounts) and 122025 (${p12.length} accounts).`);

  const getAcc = (p, boal) => p.find(r => r.boal_account === boal) || { debit:0, credit:0, solde:0, report_initial:0 };

  // 1. Sales in Month 12/2025
  const s31 = getAcc(p12, '88010031');
  const s33 = getAcc(p12, '88010033');
  const s53 = getAcc(p12, '88010053');
  const s39 = getAcc(p12, '88010039');
  const sExp = getAcc(p12, '88030510');

  const ht31 = Number(s31.credit || 0) - Number(s31.debit || 0);
  const ht33 = Number(s33.credit || 0) - Number(s33.debit || 0);
  const ht53 = Number(s53.credit || 0) - Number(s53.debit || 0);
  const ht39 = Number(s39.credit || 0) - Number(s39.debit || 0);
  const htExp = Number(sExp.credit || 0) - Number(sExp.debit || 0);

  const localSalesHT = ht31 + ht33 + ht53 + ht39;
  const localSalesTTC = localSalesHT * 1.19;

  console.log('--- 1. SALES ACCOUNTS IN 12/2025 ---');
  console.log(`88010031 (Ventes PF):      Deb: ${s31.debit} | Crd: ${s31.credit} | Net: ${ht31}`);
  console.log(`88010033 (Ventes Pièces):  Deb: ${s33.debit} | Crd: ${s33.credit} | Net: ${ht33}`);
  console.log(`88010053 (Ventes March.):  Deb: ${s53.debit} | Crd: ${s53.credit} | Net: ${ht53}`);
  console.log(`88010039 (Ventes Divers):  Deb: ${s39.debit} | Crd: ${s39.credit} | Net: ${ht39}`);
  console.log(`88030510 (Ventes Export):  Deb: ${sExp.debit} | Crd: ${sExp.credit} | Net: ${htExp}`);
  console.log(`Total Local Sales HT:      ${localSalesHT}`);
  console.log(`Total Local Sales TTC:     ${localSalesTTC}`);

  // Also check all other Class 70 in 12/2025
  const other70 = p12.filter(r => (r.scf_account && r.scf_account.startsWith('70')) || (r.boal_account && r.boal_account.startsWith('88')));
  console.log('\n--- ALL CLASS 70 / 88* ACCOUNTS IN 12/2025 ---');
  other70.forEach(s => {
    console.log(`${s.boal_account} | ${s.scf_account} | ${s.account_desc} | Deb: ${s.debit} | Crd: ${s.credit} | Solde: ${s.solde}`);
  });

  // 2. Client Accounts in 12/2025 vs 11/2025
  const c10_11 = getAcc(p11, '14000010');
  const c10_12 = getAcc(p12, '14000010');
  const d10 = Number(c10_12.solde || 0) - Number(c10_11.solde || 0);

  const c30_11 = getAcc(p11, '14000030');
  const c30_12 = getAcc(p12, '14000030');
  const d30 = Number(c30_12.solde || 0) - Number(c30_11.solde || 0);

  const c16_11 = getAcc(p11, '14060016');
  const c16_12 = getAcc(p12, '14060016');
  const d16 = Number(c16_12.solde || 0) - Number(c16_11.solde || 0);

  const cExp_11 = getAcc(p11, '14050500');
  const cExp_12 = getAcc(p12, '14050500');
  const dExp = Number(cExp_12.solde || 0) - Number(cExp_11.solde || 0);

  console.log('\n--- 2. CLIENT ACCOUNTS IN 12/2025 vs 11/2025 ---');
  console.log(`14000010 (Domestiques): Solde 11: ${c10_11.solde} | Solde 12: ${c10_12.solde} | Delta: ${d10} | Deb: ${c10_12.debit} | Crd: ${c10_12.credit}`);
  console.log(`14000030 (ADE):         Solde 11: ${c30_11.solde} | Solde 12: ${c30_12.solde} | Delta: ${d30} | Deb: ${c30_12.debit} | Crd: ${c30_12.credit}`);
  console.log(`14060016 (Avances):     Solde 11: ${c16_11.solde} | Solde 12: ${c16_12.solde} | Delta: ${d16} | Deb: ${c16_12.debit} | Crd: ${c16_12.credit}`);
  console.log(`14050500 (Export):      Solde 11: ${cExp_11.solde} | Solde 12: ${cExp_12.solde} | Delta: ${dExp} | Deb: ${cExp_12.debit} | Crd: ${cExp_12.credit}`);

  const deltaRecAdv = d10 + d30 + d16;
  const foreignCredit = Number(cExp_12.credit || 0);

  const rawCalc = localSalesTTC - deltaRecAdv + foreignCredit;
  const target = 356257225.23;
  const diff = rawCalc - target;

  console.log('\n--- 3. COMPARISON ---');
  console.log(`Formula Calculated 401: ${rawCalc}`);
  console.log(`Certified Target 401:   ${target}`);
  console.log(`Difference:             ${diff}`);

  process.exit(0);
})();
