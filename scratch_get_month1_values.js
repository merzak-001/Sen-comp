const sqlDb = require('./sqlDb');

(async () => {
  const pCurr = '012025';
  const pPrev = '122024';

  const rCurr = await sqlDb.query("SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '" + pCurr + "'");
  const rPrev = await sqlDb.query("SELECT boal_account, solde FROM GeneralLedgerBalances WHERE period_key = '" + pPrev + "'");

  const prevMap = new Map();
  for (const r of rPrev) prevMap.set(r.boal_account, Number(r.solde || 0));

  const getAcc = (acc) => {
    const c = rCurr.find(r => r.boal_account === acc) || {};
    const solde = Number(c.solde || 0);
    const reportInit = Number(c.report_initial || 0);
    const prev = prevMap.has(acc) ? prevMap.get(acc) : reportInit;
    const delta = solde - prev;
    const debit = Number(c.debit || 0);
    const credit = Number(c.credit || 0);
    return { acc, desc: c.account_desc, debit, credit, prev, solde, delta };
  };

  const suppl = ['16000010', '16010800', '17110102', '16030110', '16000007', '15200003'];
  console.log('=== SUPPLIER ACCOUNTS (01/2025) ===');
  for (const a of suppl) {
    const info = getAcc(a);
    console.log(`${info.acc} (${info.desc}) => Debit: ${info.debit.toFixed(2)} | Credit: ${info.credit.toFixed(2)} | Opening: ${info.prev.toFixed(2)} | Closing: ${info.solde.toFixed(2)} | Delta: ${info.delta.toFixed(2)}`);
  }

  // Check sum of purchases & services
  let sum60_61_62 = 0;
  for (const r of rCurr) {
    const scf = r.scf_account || '';
    if (scf.startsWith('60') || scf.startsWith('61') || scf.startsWith('62')) {
      sum60_61_62 += (Number(r.debit || 0) - Number(r.credit || 0));
    }
  }
  console.log('\nTotal Purchases & Services HT (Class 60+61+62):', sum60_61_62.toFixed(2));
  console.log('Total TTC (* 1.19):', (sum60_61_62 * 1.19).toFixed(2));
})();
