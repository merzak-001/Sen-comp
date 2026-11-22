IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FBL3NLineItems')
BEGIN
    CREATE TABLE FBL3NLineItems (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        account VARCHAR(50),
        doc_number VARCHAR(50),
        reference NVARCHAR(100),
        supplier_id VARCHAR(50),
        counterparty_account VARCHAR(50),
        year_month VARCHAR(20),
        fiscal_year INT,
        fiscal_month INT,
        doc_type VARCHAR(10),
        posting_date DATE,
        doc_date DATE,
        posting_period INT,
        posting_key VARCHAR(10),
        amount_local DECIMAL(18, 2),
        currency_local VARCHAR(10) DEFAULT 'DZD',
        amount_doc DECIMAL(18, 2),
        currency_doc VARCHAR(10) DEFAULT 'DZD',
        tax_code VARCHAR(10),
        clearing_doc VARCHAR(50),
        text_desc NVARCHAR(500),
        assignment NVARCHAR(100),
        created_at DATETIME DEFAULT GETDATE()
    );

    CREATE INDEX IX_FBL3N_YearMonth ON FBL3NLineItems(year_month);
    CREATE INDEX IX_FBL3N_Account ON FBL3NLineItems(account);
    CREATE INDEX IX_FBL3N_DocNumber ON FBL3NLineItems(doc_number);
    CREATE INDEX IX_FBL3N_Year ON FBL3NLineItems(fiscal_year);
    CREATE INDEX IX_FBL3N_Month ON FBL3NLineItems(fiscal_month);
END
GO
