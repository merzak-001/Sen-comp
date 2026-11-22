const reconciliationManager = require('../reconciliationManager');

(async () => {
  try {
    console.log('Testing Reconciliation for 2026 / Period 102026...');
    const result = await reconciliationManager.reconcile(2026, 10, '102026');
    console.log('\n--- Reconciliation Result ---');
    console.log('Reconciled:', result.reconciled);
    console.log('Total Accounts:', result.totalAccounts);
    console.log('Matched Count:', result.matchedCount);
    console.log('Mismatched Count:', result.mismatchedCount);
    console.log('Total GL Net:', result.totalGLNet);
    console.log('Total Bal Net:', result.totalBalNet);
    console.log('Total Discrepancy:', result.totalDiscrepancy);
    console.log('\nTop 5 Discrepancies:');
    result.topMismatches.slice(0, 5).forEach(m => {
      console.log(`- Account ${m.boal} (${m.scf}) ${m.desc}: GL=${m.glNet}, Bal=${m.balNetMvt}, Diff=${m.diffNet} DZD [inGL=${m.inGL}, inBal=${m.inBalance}]`);
    });
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
})();
