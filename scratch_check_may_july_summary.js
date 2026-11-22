const sql = require('./sqlDb');

async function checkMayJuly() {
  for (const m of [5, 7, 10]) {
    console.log(`\n=================== MONTH ${m} ===================`);
    
    // Sales
    const sales = await sql.query(`
      SELECT account, SUM(amount_local) as total
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND fiscal_month = ${m} AND account LIKE '88%'
      GROUP BY account
    `);
    console.log('Sales:');
    console.table(sales);

    // Receivables
    const rec = await sql.query(`
      SELECT account, 
             SUM(CASE WHEN amount_local > 0 THEN amount_local ELSE 0 END) as debit,
             SUM(CASE WHEN amount_local < 0 THEN amount_local ELSE 0 END) as credit,
             SUM(amount_local) as net
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND fiscal_month = ${m} AND account IN ('14000010', '14000030', '14050500')
      GROUP BY account
    `);
    console.log('Receivables:');
    console.table(rec);

    // Advances
    const adv = await sql.query(`
      SELECT SUM(amount_local) as net_adv
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND fiscal_month = ${m} AND account = '14060016'
    `);
    console.log('Advances 14060016 net:', adv[0].net_adv);

    // Direct credits to 140* (actual client payments credited in month m)
    const directCredits = await sql.query(`
      SELECT SUM(amount_local) as client_payments
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND fiscal_month = ${m} AND account IN ('14000010', '14000030') AND amount_local < 0
    `);
    console.log('Direct domestic client credits (receipts):', -Number(directCredits[0].client_payments));

    // Foreign payments in bank
    const foreign = await sql.query(`
      SELECT doc_number, doc_type, account, amount_local, text_desc, counterparty_account
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND fiscal_month = ${m}
        AND doc_type = 'DZ' AND amount_local > 0
        AND (counterparty_account = '38147' OR text_desc LIKE '%SENSUS FRANCE%' OR text_desc LIKE '%DEVIS SENSUS%')
    `);
    console.log('Foreign DZ rows:');
    console.table(foreign);
  }

  process.exit(0);
}

checkMayJuly();
