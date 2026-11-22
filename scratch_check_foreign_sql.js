const sqlDb = require('./sqlDb');

(async () => {
  const m8 = await sqlDb.query(`
    SELECT account, doc_number, amount_local, text_desc, counterparty_account 
    FROM FBL3NLineItems 
    WHERE fiscal_year = 2026 AND fiscal_month = 8 AND doc_type = 'DZ' AND (counterparty_account = '38147' OR text_desc LIKE '%SENSUS FRANCE%' OR text_desc LIKE '%DEVIS SENSUS%')
  `);
  console.log('Month 8 foreign receipts in SQL:');
  console.log(m8);
  process.exit(0);
})();
