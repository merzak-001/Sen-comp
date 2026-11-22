const sqlDb = require('../sqlDb');
const XLSX = require('xlsx');
const path = require('path');
const OS_DIR = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro';

async function buildAccurate2026TFT() {
  console.log('Building accurate 2026 TFT from SAP General Balance & FBL3N transactions...');

  // 1. Bank balances in balance 102026.xls
  const wbBal = XLSX.readFile(path.join(OS_DIR, 'balance 102026.xls'));
  const balRows = XLSX.utils.sheet_to_json(wbBal.Sheets[wbBal.SheetNames[0]], { header: 1 });
  
  // Real cash opening at 01/01/2026
  const OPENING_2026 = 1366395095.47;
  const CLOSING_OCT_2026 = 739410623.92;
  const TOTAL_VAR_OCT_2026 = CLOSING_OCT_2026 - OPENING_2026; // -626,984,471.55 DA

  console.log(`Ouverture 01/01/2026 : ${OPENING_2026.toLocaleString('fr-FR')} DA`);
  console.log(`Clôture 31/10/2026   : ${CLOSING_OCT_2026.toLocaleString('fr-FR')} DA`);
  console.log(`Variation 10M 2026    : ${TOTAL_VAR_OCT_2026.toLocaleString('fr-FR')} DA`);

  // 2. Query monthly breakdown from FBL3N
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];

  // Monthly breakdown of collections (DZ / Receipts)
  const dzMonthly = await sqlDb.query(`
    SELECT fiscal_month, SUM(amount_local) as amt
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account IN ('${bankAccounts.join("','")}') AND amount_local > 0
    GROUP BY fiscal_month
    ORDER BY fiscal_month
  `);

  // Monthly breakdown of disbursements (KZ, ZP, Paie, Impots)
  const kzMonthly = await sqlDb.query(`
    SELECT fiscal_month, SUM(amount_local) as amt
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account IN ('${bankAccounts.join("','")}') AND amount_local < 0
    GROUP BY fiscal_month
    ORDER BY fiscal_month
  `);

  // Monthly breakdown by doc type
  const docMonthly = await sqlDb.query(`
    SELECT fiscal_month, doc_type, SUM(amount_local) as amt
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account IN ('${bankAccounts.join("','")}')
    GROUP BY fiscal_month, doc_type
    ORDER BY fiscal_month, doc_type
  `);

  console.log('\nMonthly Bank Debits (Encaissements) from FBL3N:');
  console.table(dzMonthly);
  console.log('\nMonthly Bank Credits (Décaissements) from FBL3N:');
  console.table(kzMonthly);
}

buildAccurate2026TFT().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
