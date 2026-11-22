const sqlDb = require('../sqlDb');

async function test() {
  const years = await sqlDb.query('SELECT DISTINCT fiscal_year, count(*) as cnt FROM FBL3NLineItems GROUP BY fiscal_year ORDER BY fiscal_year;');
  console.log('FBL3N years:', years);

  // Check 2026 docTypes
  const docTypes26 = await sqlDb.query(`
    SELECT doc_type, count(*) as cnt, sum(amount_local) as sumAmt,
           sum(case when amount_local > 0 then amount_local else 0 end) as deb,
           sum(case when amount_local < 0 then amount_local else 0 end) as cred
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026
    GROUP BY doc_type
    ORDER BY cnt DESC;
  `);
  console.log('2026 docTypes:', docTypes26);

  // Check cash accounts in 2026
  const cashAccounts = await sqlDb.query(`
    SELECT account, account_desc, scf_account, count(*) as cnt, sum(amount_local) as net
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND (account LIKE '11867%' OR account LIKE '15200%' OR scf_account LIKE '5%')
    GROUP BY account, account_desc, scf_account;
  `);
  console.log('Cash accounts:', cashAccounts);

  // Check month by month cash in 2026
  const cashByMonth = await sqlDb.query(`
    SELECT fiscal_month, 
           sum(case when doc_type = 'DZ' then amount_local else 0 end) as clientsDZ,
           sum(case when doc_type = 'KZ' then amount_local else 0 end) as fournKZ,
           sum(case when doc_type = 'ZP' then amount_local else 0 end) as virementsZP
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026
    GROUP BY fiscal_month
    ORDER BY fiscal_month;
  `);
  console.log('Cash by month 2026:', cashByMonth);
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
