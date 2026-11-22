-- =====================================================================
-- SENSUS ALGERIE SPA — DATABASE SCHEMA FOR SAP FINANCIAL & PROCUREMENT
-- SQL SERVER (SQLEXPRESS)
-- =====================================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'SensusSAPDB')
BEGIN
    CREATE DATABASE [SensusSAPDB];
END
GO

USE [SensusSAPDB];
GO

-- 1. Chart of Accounts (Equivalence BOAL Group <-> SCF Algeria)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChartOfAccounts')
BEGIN
    CREATE TABLE ChartOfAccounts (
        boal_account NVARCHAR(50) NOT NULL PRIMARY KEY,
        scf_account NVARCHAR(50) NULL,
        description NVARCHAR(255) NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- 2. General Ledger Balances (RFSSLD00 Grand Livre SAP)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'GeneralLedgerBalances')
BEGIN
    CREATE TABLE GeneralLedgerBalances (
        id INT IDENTITY(1,1) PRIMARY KEY,
        period_key NVARCHAR(50) NOT NULL, -- '102026', '2025', etc.
        boal_account NVARCHAR(50) NOT NULL,
        scf_account NVARCHAR(50) NULL,
        account_desc NVARCHAR(255) NULL,
        report_initial DECIMAL(18,2) DEFAULT 0,
        debit DECIMAL(18,2) DEFAULT 0,
        credit DECIMAL(18,2) DEFAULT 0,
        solde DECIMAL(18,2) DEFAULT 0,
        source_file NVARCHAR(100) NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_GL_Account_Period UNIQUE (period_key, boal_account)
    );
END
GO

-- 3. Supplier Invoices (SAP F.41 & FBL3N)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupplierInvoices')
BEGIN
    CREATE TABLE SupplierInvoices (
        piece NVARCHAR(50) NOT NULL PRIMARY KEY,
        affectation NVARCHAR(100) NULL,
        doc_type NVARCHAR(10) NULL,
        supplier_id NVARCHAR(50) NULL,
        supplier_name NVARCHAR(255) NULL,
        date_comptable NVARCHAR(50) NULL,
        month INT NULL,
        year INT NULL,
        currency NVARCHAR(10) DEFAULT 'DZD',
        is_local BIT DEFAULT 1,
        f41_amount DECIMAL(18,2) DEFAULT 0,
        foreign_amount DECIMAL(18,2) NULL,
        category NVARCHAR(50) DEFAULT 'Diver',
        debours DECIMAL(18,2) DEFAULT 0,
        tva DECIMAL(18,2) DEFAULT 0,
        retunie DECIMAL(18,2) DEFAULT 0,
        net_ht DECIMAL(18,2) DEFAULT 0,
        status NVARCHAR(50) DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- 4. Debours & Customs Transit (compte 17300015)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TransitDebours')
BEGIN
    CREATE TABLE TransitDebours (
        id INT IDENTITY(1,1) PRIMARY KEY,
        piece NVARCHAR(50) NULL,
        supplier_name NVARCHAR(255) NULL,
        amount DECIMAL(18,2) DEFAULT 0,
        reference NVARCHAR(255) NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- 5. Fiscal Deductible TVA (compte 1787)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FiscalTVA')
BEGIN
    CREATE TABLE FiscalTVA (
        id INT IDENTITY(1,1) PRIMARY KEY,
        piece NVARCHAR(50) NULL,
        amount DECIMAL(18,2) DEFAULT 0,
        date_comptable NVARCHAR(50) NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- 6. Fiscal Retenue a la source (compte 1971)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FiscalRetenue')
BEGIN
    CREATE TABLE FiscalRetenue (
        id INT IDENTITY(1,1) PRIMARY KEY,
        piece NVARCHAR(50) NULL,
        supplier_name NVARCHAR(255) NULL,
        amount DECIMAL(18,2) DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- 7. Document 9 Observations & Management Comments
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReportObservations')
BEGIN
    CREATE TABLE ReportObservations (
        id INT IDENTITY(1,1) PRIMARY KEY,
        period_key NVARCHAR(50) NOT NULL,
        obs_id NVARCHAR(50) NOT NULL,
        category NVARCHAR(100) NULL,
        text NVARCHAR(MAX) NOT NULL,
        sort_order INT DEFAULT 0,
        is_custom BIT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_Report_Obs UNIQUE (period_key, obs_id)
    );
END
GO

-- 8. Suppliers Master Table (Référentiel Fournisseurs)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Suppliers')
BEGIN
    CREATE TABLE Suppliers (
        supplier_id NVARCHAR(50) NOT NULL PRIMARY KEY,
        supplier_name NVARCHAR(255) NOT NULL,
        category NVARCHAR(50) DEFAULT 'Diver',
        currency NVARCHAR(10) DEFAULT 'DZD',
        is_strategic BIT DEFAULT 0,
        invoice_count INT DEFAULT 0,
        total_volume DECIMAL(18,2) DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );
END
GO
