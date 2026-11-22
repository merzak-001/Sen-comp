const sqlDb = require('./sqlDb');

(async () => {
  const pCurr = '012025';
  const pPrev = '122024';

  const rowsCurr = await sqlDb.query("SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '" + pCurr + "'");
  const rowsPrev = await sqlDb.query("SELECT boal_account, solde FROM GeneralLedgerBalances WHERE period_key = '" + pPrev + "'");

  const prevMap = new Map();
  for (const r of rowsPrev) prevMap.set(r.boal_account, Number(r.solde || 0));

  const getDelta = (acc) => {
    const r = rowsCurr.find(x => x.boal_account === acc);
    if (!r) return 0;
    const solde = Number(r.solde || 0);
    const reportInit = Number(r.report_initial || 0);
    const prev = prevMap.has(acc) ? prevMap.get(acc) : reportInit;
    return solde - prev;
  };

  const getDebit = (acc) => {
    const r = rowsCurr.find(x => x.boal_account === acc);
    return r ? Number(r.debit || 0) : 0;
  };

  const getSolde = (acc) => {
    const r = rowsCurr.find(x => x.boal_account === acc);
    return r ? Number(r.solde || 0) : 0;
  };

  // 1. Achats et services
  let sum60_61_62 = 0;
  for (const r of rowsCurr) {
    const scf = r.scf_account || '';
    if (scf.startsWith('60') || scf.startsWith('61') || scf.startsWith('62')) {
      sum60_61_62 += (Number(r.debit || 0) - Number(r.credit || 0));
    }
  }
  const achatsTTC = sum60_61_62 * 1.19;

  // 2. Dettes Fournisseurs (16000010 + 16010800 + 17110102 + 16030110 + 16000007)
  const delta16000010 = getDelta('16000010');
  const delta16010800 = getDelta('16010800');
  const delta17110102 = getDelta('17110102');
  const delta16030110 = getDelta('16030110');
  const delta16000007 = getDelta('16000007');
  const sumDeltaDettes = delta16000010 + delta16010800 + delta17110102 + delta16030110 + delta16000007;

  // 3. Acomptes (15200003)
  const delta15200003 = getDelta('15200003');

  // 4. Caisse (10170200)
  const caisse = getDelta('10170200'); // or debit or credit
  const caisseCredit = rowsCurr.find(x => x.boal_account === '10170200')?.credit || 0;
  const caisseSolde = getSolde('10170200');

  // 5. Accréditifs (11867008)
  const accredSolde = getSolde('11867008');
  const accredDelta = getDelta('11867008');

  console.log('=== TEST VALUES 01/2025 ===');
  console.log('Achats et Services HT:', sum60_61_62);
  console.log('Achats et Services TTC (x1.19):', achatsTTC);
  console.log('Delta 16000010:', delta16000010);
  console.log('Delta 16010800:', delta16010800);
  console.log('Delta 17110102:', delta17110102);
  console.log('Delta 16030110:', delta16030110);
  console.log('Delta 16000007:', delta16000007);
  console.log('Sum Delta Dettes:', sumDeltaDettes);
  console.log('Delta 15200003:', delta15200003);
  console.log('Caisse credit:', caisseCredit, 'solde:', caisseSolde);
  console.log('Accred solde:', accredSolde, 'delta:', accredDelta);

  console.log('\n--- CALCULATING RESULT OF FORMULA ---');
  // Formula: Achats TTC - Dettes + Acomptes - Caisse + Accreditifs
  // Note: dettes in balance sheet are credit (negative).
  // In Row 401: Ventes TTC - Créances (créances are debit/positive).
  // Here, if Dettes are negative, subtracting delta:
  console.log('Achats TTC - sumDeltaDettes + delta15200003 =', achatsTTC - sumDeltaDettes + delta15200003);
  console.log('Achats TTC + sumDeltaDettes + delta15200003 =', achatsTTC + sumDeltaDettes + delta15200003);

  // Now test with Debits (Direct Method):
  const deb16000010 = getDebit('16000010');
  const deb16010800 = getDebit('16010800');
  const deb17110102 = getDebit('17110102');
  const deb16030110 = getDebit('16030110');
  const deb16000007 = getDebit('16000007');
  const deb15200003 = getDebit('15200003');
  const sumDebits = deb16000010 + deb16010800 + deb17110102 + deb16030110 + deb16000007 + deb15200003;
  console.log('\nDirect Debits Fournisseurs:', sumDebits);
  console.log('Target Certified Row 402: -65,059,394.19');
})();
