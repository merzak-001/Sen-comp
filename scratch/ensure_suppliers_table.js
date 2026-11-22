const fs = require('fs');
const path = require('path');
const db = require('../sqlDb');

async function main() {
  const suppliersPath = path.join(__dirname, '..', 'data', 'suppliers.json');
  const suppliersRaw = JSON.parse(fs.readFileSync(suppliersPath, 'utf8'));
  const suppliers = Object.values(suppliersRaw);
  console.log('Suppliers to preserve in SQL Server:', suppliers.length);

  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Suppliers')
    BEGIN
      CREATE TABLE Suppliers (
        supplier_id NVARCHAR(50) PRIMARY KEY,
        supplier_name NVARCHAR(255) NOT NULL,
        category NVARCHAR(50) NULL,
        strategic BIT DEFAULT 0,
        invoice_count INT DEFAULT 0,
        total_spent DECIMAL(18,2) DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
      );
      CREATE INDEX IX_Suppliers_Category ON Suppliers(category);
    END
  `);

  for (const s of suppliers) {
    const sId = String(s.supplierId || s.id || '').replace(/'/g, "''");
    const sName = String(s.supplierName || s.name || '').replace(/'/g, "''");
    const sCat = String(s.defaultCategory || s.category || '').replace(/'/g, "''");
    const sStrat = s.isStrategic ? 1 : 0;
    const sInvCount = Number(s.invoiceCount) || 0;
    const sSpent = Number(s.totalSpent) || 0;

    await db.query(`
      MERGE Suppliers AS target
      USING (SELECT '${sId}' AS supplier_id) AS source
      ON target.supplier_id = source.supplier_id
      WHEN MATCHED THEN
        UPDATE SET 
          supplier_name = '${sName}',
          category = '${sCat}',
          strategic = ${sStrat},
          invoice_count = ${sInvCount},
          total_spent = ${sSpent},
          updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (supplier_id, supplier_name, category, strategic, invoice_count, total_spent)
        VALUES ('${sId}', '${sName}', '${sCat}', ${sStrat}, ${sInvCount}, ${sSpent});
    `);
  }

  const count = await db.query('SELECT COUNT(*) as c FROM Suppliers');
  console.log('Suppliers table ready in SensusSAPDB with rows:', count[0].c);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
