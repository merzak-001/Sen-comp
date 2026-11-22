const sqlDb = require('./sqlDb');

(async () => {
  const tables = await sqlDb.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
  console.log('Tables in DB:', tables.map(x => x.TABLE_NAME));

  for (const t of tables) {
    try {
      const cnt = await sqlDb.query(`SELECT COUNT(*) as c FROM [${t.TABLE_NAME}]`);
      console.log(`  - ${t.TABLE_NAME}: ${cnt[0].c} rows`);
    } catch (e) {
      console.log(`  - ${t.TABLE_NAME}: error`);
    }
  }
})();
