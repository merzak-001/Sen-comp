const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '032025'");
  
  // Search for 13794 or 11591 or check if difference is an exact line
  const diff = 13794.18;
  rows.forEach(r => {
    ['debit', 'credit', 'solde', 'report_initial'].forEach(col => {
      const val = Math.abs(Number(r[col] || 0));
      if (Math.abs(val - diff) < 1 || Math.abs(val - 11591.75) < 1) {
        console.log(`Found match in ${r.boal_account} (${r.account_desc}) [${col}]: ${val}`);
      }
    });
  });

  process.exit(0);
})();
