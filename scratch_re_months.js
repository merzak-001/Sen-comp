const sql = require('./sqlDb');

async function reverseEngineerMonths() {
  console.log('=== REVERSE ENGINEERING AUGUST & SEPTEMBER 2026 WITH ACCOUNTANT FORMULA ===\n');

  // Accounts
  const clientAccounts = ['14000010', '14000030', '14050500'];
  const advanceAccount = '14060016';
  const salesAccounts = ['88010031', '88010039', '88010053', '88030510'];

  // Let's get monthly movements for each account
  const rows = await sql.query(`
    SELECT fiscal_month, account, doc_type, amount_local, doc_number, text_desc
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account IN ('${[...clientAccounts, advanceAccount, ...salesAccounts].join("','")}')
    ORDER BY fiscal_month, doc_number
  `);

  console.log(`Loaded ${rows.length} rows for client, advance, and sales accounts.`);

  // Check which months exist
  const months = [...new Set(rows.map(r => r.fiscal_month))].sort((a,b) => a-b);
  console.log('Months present:', months);

  // Initial balances at 01/01/2026
  let balClients = 20880897.29 + 236216347.00 + 25003795.52; // 282,101,039.81
  let balAvance = -3055742.13;

  console.log(`Initial Client Receivables (01/01/2026): ${balClients.toLocaleString('fr-FR')} DA`);
  console.log(`Initial Advance Balance (01/01/2026): ${balAvance.toLocaleString('fr-FR')} DA\n`);

  for (let m = 1; m <= 10; m++) {
    const mRows = rows.filter(r => r.fiscal_month === m);
    
    // Sales in Month m (Accounts 880*)
    // Credit is negative in SAP, so sales revenue = -amount_local
    const mSalesRows = mRows.filter(r => salesAccounts.includes(r.account));
    const salesHT = mSalesRows.reduce((acc, r) => acc - Number(r.amount_local), 0);
    const salesTTC = salesHT * 1.19;

    // Client Receivables in Month m
    const mClientRows = mRows.filter(r => clientAccounts.includes(r.account));
    const prevClients = balClients;
    const clientMovements = mClientRows.reduce((acc, r) => acc + Number(r.amount_local), 0);
    balClients += clientMovements;
    const varCreances = prevClients - balClients; // (Creances M-1 - Creances M)

    // Advance in Month m (Account 14060016)
    const mAdvRows = mRows.filter(r => r.account === advanceAccount);
    const prevAdv = balAvance;
    const advMovements = mAdvRows.reduce((acc, r) => acc + Number(r.amount_local), 0);
    balAvance += advMovements;
    // In BAL NOV / BAL DEC: Avance Client formula was: +E163 - I163 + F163 (i.e. Net increase in credit of advances = new advance money received)
    // When client pays advance: Credit 14060016 (negative amount_local).
    // So positive advance cash received = -advMovements
    const avanceReceived = -advMovements;

    // Accountant Formula 1: CA TTC + (Creances M-1 - Creances M) + Avances clients reçues
    const formula1 = salesTTC + varCreances + avanceReceived;

    // Direct Cash Settlements on Client Accounts (Credit to 140* from DZ and ZP)
    const clientPayments = mClientRows.filter(r => r.amount_local < 0);
    const sumClientPayments = clientPayments.reduce((acc, r) => acc - Number(r.amount_local), 0);

    console.log(`--- MOIS ${m} ---`);
    console.log(`  CA Facturé HT: ${salesHT.toLocaleString('fr-FR')} DA | CA TTC: ${salesTTC.toLocaleString('fr-FR')} DA`);
    console.log(`  Créances M-1: ${prevClients.toLocaleString('fr-FR')} | Créances M: ${balClients.toLocaleString('fr-FR')} | Var (M-1 - M): ${varCreances.toLocaleString('fr-FR')}`);
    console.log(`  Avances reçues: ${avanceReceived.toLocaleString('fr-FR')} DA`);
    console.log(`  => FORMULE COMPTABLE 401: ${formula1.toLocaleString('fr-FR')} DA`);
    console.log(`  => Règlements directs sur comptes clients (Crédit 140*): ${sumClientPayments.toLocaleString('fr-FR')} DA`);

    if (m === 8) {
      console.log(`  >>> TARGET COMPTABLE AOÛT : 348 430 299,60 DA`);
      console.log(`  >>> Ecart avec Formule 1: ${(formula1 - 348430299.60).toLocaleString('fr-FR')} DA`);
      console.log(`  >>> Ecart avec Règlements directs: ${(sumClientPayments - 348430299.60).toLocaleString('fr-FR')} DA`);
    }
    if (m === 9) {
      console.log(`  >>> TARGET COMPTABLE SEPTEMBRE : 210 951 817,50 DA`);
      console.log(`  >>> Ecart avec Formule 1: ${(formula1 - 210951817.50).toLocaleString('fr-FR')} DA`);
      console.log(`  >>> Ecart avec Règlements directs: ${(sumClientPayments - 210951817.50).toLocaleString('fr-FR')} DA`);
    }
    console.log('');
  }

  process.exit(0);
}

reverseEngineerMonths();
