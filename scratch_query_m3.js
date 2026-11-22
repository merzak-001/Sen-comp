const sqlDb = require('./sqlDb');

(async () => {
  try {
    const p2 = await sqlDb.query("SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '022026'");
    const p3 = await sqlDb.query("SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '032026'");

    console.log('Total accounts in 022026:', p2.length, 'in 032026:', p3.length);

    // Sales accounts (SCF 70% or BOAL 88%)
    const sales2 = p2.filter(r => (r.scf_account && r.scf_account.startsWith('70')) || (r.boal_account && r.boal_account.startsWith('88')));
    const sales3 = p3.filter(r => (r.scf_account && r.scf_account.startsWith('70')) || (r.boal_account && r.boal_account.startsWith('88')));

    console.log('\n=================== SALES ACCOUNTS (03/2026) ===================');
    let totalSalesNetHT = 0;
    let localSalesHT = 0;
    let foreignSalesHT = 0;

    sales3.forEach(s => {
      const s2 = sales2.find(x => x.boal_account === s.boal_account);
      const mDebit = Number(s.debit || 0) - Number(s2 ? s2.debit || 0 : 0);
      const mCredit = Number(s.credit || 0) - Number(s2 ? s2.credit || 0 : 0);
      const mNet = mCredit - mDebit; // Credit increases sales revenue

      if (mDebit !== 0 || mCredit !== 0) {
        console.log(`${s.boal_account} | SCF: ${s.scf_account} | ${s.account_desc.padEnd(35)} | M-Debit: ${mDebit.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | M-Credit: ${mCredit.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Net M: ${mNet.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
        totalSalesNetHT += mNet;
        if (s.boal_account.startsWith('8803') || s.scf_account.startsWith('70003')) {
          foreignSalesHT += mNet;
        } else {
          localSalesHT += mNet;
        }
      }
    });

    console.log(`\nLocal Sales Net HT: ${localSalesHT.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
    console.log(`Foreign Sales Net HT: ${foreignSalesHT.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
    console.log(`Total Sales Net HT: ${totalSalesNetHT.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
    console.log(`Local Sales TTC (+19% TVA): ${(localSalesHT * 1.19).toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);

    // Client Accounts
    console.log('\n=================== CLIENT & RECEIVABLE ACCOUNTS ===================');
    const clients = p3.filter(r => 
      (r.boal_account && (r.boal_account.startsWith('140') || r.boal_account.startsWith('280'))) ||
      (r.scf_account && (r.scf_account.startsWith('411') || r.scf_account.startsWith('418') || r.scf_account.startsWith('419')))
    );

    clients.forEach(c => {
      const c2 = p2.find(x => x.boal_account === c.boal_account);
      const solde2 = Number(c2 ? c2.solde || 0 : 0);
      const solde3 = Number(c.solde || 0);
      const delta = solde3 - solde2;
      const mDebit = Number(c.debit || 0) - Number(c2 ? c2.debit || 0 : 0);
      const mCredit = Number(c.credit || 0) - Number(c2 ? c2.credit || 0 : 0);

      if (solde2 !== 0 || solde3 !== 0 || mDebit !== 0 || mCredit !== 0) {
        console.log(`${c.boal_account} | SCF: ${c.scf_account} | ${c.account_desc.padEnd(30)} | Solde Feb: ${solde2.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Solde Mar: ${solde3.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Delta: ${delta.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | M-Debit: ${mDebit.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | M-Credit: ${mCredit.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
      }
    });

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
