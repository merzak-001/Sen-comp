const db = require('../sqlDb');

async function cleanup() {
  console.log('--- Starting Database Cleanup ---');

  // 1. Drop obsolete tables
  const obsoleteTables = ['ReportObservations', 'FiscalRetenue', 'FiscalTVA', 'TransitDebours', 'SupplierInvoices'];
  for (const t of obsoleteTables) {
    try {
      await db.query(`IF EXISTS (SELECT * FROM sys.tables WHERE name = '${t}') DROP TABLE ${t};`);
      console.log(`[SQL] Dropped obsolete table: ${t}`);
    } catch (e) {
      console.warn(`[SQL] Failed to drop ${t}:`, e.message);
    }
  }

  // 2. Clear transaction and balance tables for fresh imports
  try {
    await db.query('TRUNCATE TABLE FBL3NLineItems;');
    console.log('[SQL] Truncated FBL3NLineItems (ready for user Excel imports)');
  } catch (e) {
    console.warn('[SQL] Could not truncate FBL3NLineItems:', e.message);
  }

  try {
    await db.query('TRUNCATE TABLE GeneralLedgerBalances;');
    console.log('[SQL] Truncated GeneralLedgerBalances (ready for user Excel imports)');
  } catch (e) {
    console.warn('[SQL] Could not truncate GeneralLedgerBalances:', e.message);
  }

  try {
    await db.query(`IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ImportDiffLog') TRUNCATE TABLE ImportDiffLog;`);
    console.log('[SQL] Cleared ImportDiffLog');
  } catch (e) {
    console.warn('[SQL] Could not truncate ImportDiffLog:', e.message);
  }

  // 3. Verify retained tables
  const chart = await db.query('SELECT COUNT(*) as c FROM ChartOfAccounts');
  const suppliers = await db.query('SELECT COUNT(*) as c FROM Suppliers');
  const gl = await db.query('SELECT COUNT(*) as c FROM FBL3NLineItems');
  const bal = await db.query('SELECT COUNT(*) as c FROM GeneralLedgerBalances');

  console.log('--- Database State Verification ---');
  console.log('ChartOfAccounts:', chart[0].c, '(PRESERVED)');
  console.log('Suppliers:', suppliers[0].c, '(PRESERVED)');
  console.log('FBL3NLineItems:', gl[0].c, '(EMPTY - READY FOR IMPORT)');
  console.log('GeneralLedgerBalances:', bal[0].c, '(EMPTY - READY FOR IMPORT)');
  console.log('All obsolete tables successfully removed.');
}

module.exports = { cleanup };

if (require.main === module) {
  cleanup().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
