const sqlDb = require('../sqlDb');
(async () => {
  const r = await sqlDb.query("DELETE FROM FBL3NLineItems WHERE doc_number = '' OR doc_number IS NULL");
  console.log('Cleaned blank rows.');
  const cnt = await sqlDb.query("SELECT COUNT(*) as c FROM FBL3NLineItems");
  console.log('Remaining FBL3N rows:', cnt[0].c);
  process.exit(0);
})();
