const sqlDb = require('../sqlDb');
(async () => {
  const r = await sqlDb.query("SELECT doc_number, posting_date, fiscal_year, fiscal_month, amount_local, text_desc FROM FBL3NLineItems WHERE account = '90000000' AND doc_number <> ''");
  console.log('Real GL transactions for 90000000:', r);
  
  // Now check account 90000000:
  // Transaction amount: 1449229005.85
  // Balance row: debit = 1449229005.85
  // Exact match!
  console.log('Balance movement was: 1449229005.85. GL movement is: ' + r[0].amount_local + '. MATCH = ' + (r[0].amount_local === 1449229005.85));
  process.exit(0);
})();
