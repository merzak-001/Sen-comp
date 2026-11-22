const sqlDb = require('../sqlDb');

(async () => {
  try {
    // 1. Check personnel accounts (Compte 11867... paie or SCF 421 / 63...)
    const personnel = await sqlDb.query(`
      SELECT account, COUNT(id) as cnt, SUM(amount_local) as tot
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND (account LIKE '42%' OR account LIKE '63%' OR text_desc LIKE '%PAIE%' OR text_desc LIKE '%SALAIRE%')
      GROUP BY account;
    `);
    console.log('Personnel candidates in 2026:', personnel);

    // 2. Check financial fees / agios (account 66... or text_desc LIKE '%FRAIS BANC%')
    const frais = await sqlDb.query(`
      SELECT account, COUNT(id) as cnt, SUM(amount_local) as tot
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND (account LIKE '66%' OR text_desc LIKE '%FRAIS BANC%' OR text_desc LIKE '%COMMISSION%')
      GROUP BY account;
    `);
    console.log('Frais financiers in 2026:', frais);

    // 3. Check taxes paid (account 44... or text_desc LIKE '%IMPOT%' or '%IBS%' or '%TAP%')
    const impots = await sqlDb.query(`
      SELECT account, COUNT(id) as cnt, SUM(amount_local) as tot
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND (text_desc LIKE '%IMPOT%' OR text_desc LIKE '%IBS%' OR text_desc LIKE '%TAXE%')
      GROUP BY account;
    `);
    console.log('Impôts in 2026:', impots);

    // 4. Check treasury accounts (Classe 5 / 11867...) at opening and closing 2026
    const treso = await sqlDb.query(`
      SELECT account, SUM(amount_local) as solde
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND (account LIKE '11867%' OR account LIKE '15200003%')
      GROUP BY account;
    `);
    console.log('Trésorerie mouvement in 2026:', treso);

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
})();
