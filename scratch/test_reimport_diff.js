const reconciliationManager = require('../reconciliationManager');
const path = require('path');

(async () => {
  try {
    const fbl3nPath = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx';
    console.log('Testing re-import with diff detection...');
    const result = await reconciliationManager.importFBL3NWithDiff(fbl3nPath, { importMode: 'month' });
    console.log('Success:', result.success);
    console.log('Diffs per period:');
    result.diffs.forEach(d => {
      console.log(`- ${d.periodLabel}: action=${d.action}, identical=${d.isIdentical}, oldCount=${d.oldCount}, newCount=${d.newCount}, diffCount=${d.diffCount}, diffSum=${d.diffSum} DZD`);
    });
    console.log('\nNotifications generated:');
    console.log(result.notifications);
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
})();
