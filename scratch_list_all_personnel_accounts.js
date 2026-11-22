const sqlDb = require('./sqlDb');

(async () => {
  const accs = await sqlDb.query(`
    SELECT DISTINCT boal_account, scf_account, description 
    FROM ChartOfAccounts 
    WHERE boal_account LIKE '173%' 
       OR boal_account LIKE '1757%'
       OR boal_account LIKE '1776%'
       OR boal_account = '17460003'
       OR boal_account LIKE '174703%'
       OR boal_account = '43290061'
       OR boal_account = '44010088'
       OR scf_account LIKE '42%'
       OR scf_account LIKE '43%'
    ORDER BY boal_account
  `);
  console.log(`Total Personnel Accounts in Chart of Accounts: ${accs.length}`);
  console.table(accs);
})();
