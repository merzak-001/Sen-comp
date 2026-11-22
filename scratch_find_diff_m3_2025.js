const sqlDb = require('./sqlDb');

(async () => {
  const p3 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '032025'");
  const p2 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '022025'");

  console.log('Target:', 242430317.89);
  console.log('Option 1:', 242444112.07);
  const diff = 242444112.07 - 242430317.89;
  console.log('Difference:', diff); // 13,794.18

  // Let's check accounts in p3 with solde or debit/credit close to 13794.18 or related to TVA/timbre/clients
  const matches = p3.filter(r => {
    const deb = Number(r.debit || 0);
    const crd = Number(r.credit || 0);
    const sld = Number(r.solde || 0);
    return Math.abs(deb - diff) < 100 || Math.abs(crd - diff) < 100 || Math.abs(sld - diff) < 100 ||
           (r.account_desc && (r.account_desc.includes('TIMBRE') || r.account_desc.includes('CHANGE') || r.account_desc.includes('AVANCE')));
  });

  console.log('\nPotential accounts related to diff or timbre/change:');
  matches.forEach(m => {
    const m2 = p2.find(x => x.boal_account === m.boal_account) || { solde:0 };
    console.log(`${m.boal_account} | ${m.scf_account} | ${m.account_desc} | Deb: ${m.debit} | Crd: ${m.credit} | Solde M-1: ${m2.solde} | Solde M: ${m.solde} | Delta: ${m.solde - m2.solde}`);
  });

  process.exit(0);
})();
