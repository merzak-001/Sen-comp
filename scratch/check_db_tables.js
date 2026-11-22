const sqlDb = require('../sqlDb');
(async () => {
  try {
    for (const t of ['FBL3NLineItems', 'GeneralLedgerBalances', 'ChartOfAccounts']) {
      const cols = await sqlDb.query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${t}'`);
      console.log(`\nColumns for ${t}:`);
      console.log(cols.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE})`).join(', '));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();
