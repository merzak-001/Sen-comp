const fbl3nManager = require('../fbl3nManager');
const balanceManager = require('../balanceManager');
const sqlDb = require('../sqlDb');

(async () => {
  try {
    console.log('Testing FBL3N & Balance parsing & DB loading...');
    
    // 1. Balance import
    console.log('\n--- Importing Balance 102026 ---');
    const bal10Res = await balanceManager.importFromOSAppro();
    console.log('Balance import results:', bal10Res);
    
    // 2. FBL3N import
    console.log('\n--- Importing FBL3N 051026 ---');
    const fblRes = await fbl3nManager.importFromExcel(fbl3nManager.defaultFilePath, { importMode: 'all' });
    console.log('FBL3N import result: inserted', fblRes.inserted, 'rows, periods:', fblRes.periods);

    // 3. Check counts
    const glCount = await sqlDb.query('SELECT COUNT(*) AS c FROM FBL3NLineItems');
    const balCount = await sqlDb.query('SELECT COUNT(*) AS c FROM GeneralLedgerBalances');
    console.log(`\nDB State: FBL3N = ${glCount[0]?.c} rows, Balances = ${balCount[0]?.c} rows`);

  } catch (e) {
    console.error('Test error:', e);
  }
  process.exit(0);
})();
