const sqlDb = require('./sqlDb');

(async () => {
  for (const m of ['012025', '112025', '122025']) {
    const rows = await sqlDb.query("SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '" + m + "'");
    const getVal = (acc, field) => {
      const r = rows.find(x => x.boal_account === acc);
      return r ? Number(r[field] || 0) : 0;
    };
    
    // Fourniss debits:
    const d1600_10 = getVal('16000010', 'debit');
    const d1601_08 = getVal('16010800', 'debit');
    const d1711_02 = getVal('17110102', 'debit');
    const d1603_10 = getVal('16030110', 'debit');
    const d1600_07 = getVal('16000007', 'debit');
    const d1520_03 = getVal('15200003', 'debit');
    const sumFourniss = d1600_10 + d1601_08 + d1711_02 + d1603_10 + d1600_07 + d1520_03;

    // caisse:
    const caisseDeb = getVal('10170200', 'debit');
    const caisseCred = getVal('10170200', 'credit');

    // accredtif 11867008:
    const accSolde = getVal('11867008', 'solde');
    const accDelta = getVal('11867008', 'solde') - getVal('11867008', 'report_initial');

    console.log('--- Month ' + m + ' ---');
    console.log('Fourniss Debits:', sumFourniss.toLocaleString('fr-FR'));
    console.log('Caisse Debit:', caisseDeb.toLocaleString('fr-FR'), 'Credit:', caisseCred.toLocaleString('fr-FR'));
    console.log('Accred Solde:', accSolde.toLocaleString('fr-FR'), 'Delta:', accDelta.toLocaleString('fr-FR'));
  }
})();
