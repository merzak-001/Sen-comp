const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== SUPPLIER BALANCE SHEET ACCOUNTS (40x / 101x / 174x) ===');
  const cols = await sqlDb.query("SELECT TOP 1 * FROM GeneralLedgerBalances");
  console.log('GL Balances columns:', Object.keys(cols[0]));

  const supplBilan = await sqlDb.query(`
    SELECT DISTINCT b.boal_account, b.scf_account, b.account_desc 
    FROM GeneralLedgerBalances b
    WHERE b.scf_account LIKE '401%' 
       OR b.scf_account LIKE '404%' 
       OR b.scf_account LIKE '408%' 
       OR b.scf_account LIKE '409%'
       OR b.boal_account LIKE '101%' 
       OR b.boal_account LIKE '174%'
    ORDER BY b.boal_account
  `);
  console.table(supplBilan);
})();
