import express, { type Request, type Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import * as XLSX from 'xlsx';

import * as parser from './parser';
import storage, { type InvoiceFilterOptions } from './storage';
import reportingEngine from './reportingEngine';
import sqlDb from './sqlDb';
import fbl3nManager, { type FBL3NLineItemFilters } from './fbl3nManager';
import balanceManager from './balanceManager';
import reconciliationManager from './reconciliationManager';
import type { AuthUser, ExpenseCategory } from '../types/domain';

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const DIST_PUBLIC = path.join(ROOT_DIR, 'dist', 'public');
const LEGACY_PUBLIC = path.join(ROOT_DIR, 'public');
const STATIC_DIR = fs.existsSync(DIST_PUBLIC) ? DIST_PUBLIC : LEGACY_PUBLIC;

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(
  express.static(STATIC_DIR, {
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  })
);

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 100 * 1024 * 1024 }
});

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

interface AuthUserWithPassword extends AuthUser {
  password: string;
}

const AUTH_USERS: Record<string, AuthUserWithPassword> = {
  admin: {
    password: '0505',
    username: 'admin',
    displayName: 'Administrateur',
    role: 'admin',
    allowedPages: ['*']
  },
  'khaled.kaddour': {
    password: '1010',
    username: 'khaled.kaddour',
    displayName: 'Khaled Kaddour',
    role: 'user',
    allowedPages: [
      'page-bilan',
      'page-tcr',
      'page-balance',
      'page-tft',
      'page-parametres',
      'page-import'
    ]
  }
};

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = (req.body || {}) as { username?: string; password?: string };
  const cleanU = (username || '').trim().toLowerCase();
  const cleanP = (password || '').trim();

  let matchedUser: AuthUserWithPassword | null = null;
  if (cleanU === 'admin' && cleanP === '0505') {
    matchedUser = AUTH_USERS['admin'];
  } else if ((cleanU === 'khaled.kaddour' || cleanU === 'khaled') && cleanP === '1010') {
    matchedUser = AUTH_USERS['khaled.kaddour'];
  }

  if (matchedUser) {
    const token = Buffer.from(`${matchedUser.username}:${Date.now()}`).toString('base64');
    return res.json({
      success: true,
      token,
      user: {
        username: matchedUser.username,
        displayName: matchedUser.displayName,
        role: matchedUser.role,
        allowedPages: matchedUser.allowedPages
      }
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Identifiant ou mot de passe incorrect'
  });
});

app.get('/api/auth/me', (_req: Request, res: Response) => {
  res.json({ success: true, authenticated: true });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Déconnecté avec succès' });
});

app.post('/api/admin/restart', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Redémarrage du serveur en cours...' });
  setTimeout(() => {
    process.exit(0);
  }, 500);
});

app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    totalInvoices: storage.invoices.size,
    totalSuppliers: storage.suppliers.size,
    history: storage.history
  });
});

app.get('/api/suppliers', (_req: Request, res: Response) => {
  try {
    const list = storage.getSuppliersList();
    res.json({
      success: true,
      total: list.length,
      suppliers: list
    });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

app.post('/api/suppliers/:id', (req: Request, res: Response) => {
  try {
    const supplierId = String(req.params.id);
    const { category, isFixed, supplierName } = req.body as {
      category?: string;
      isFixed?: boolean;
      supplierName?: string;
    };
    const result = storage.updateSupplier({
      supplierId,
      category,
      isFixed,
      supplierName
    });
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    res.status(400).json({ error: errMsg(err) });
  }
});

app.post('/api/import-default', (_req: Request, res: Response) => {
  try {
    const osApproDir =
      'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro';
    const f41Path = path.join(osApproDir, 'F.41 05102026.xlsx');
    const fbl3nPath = path.join(osApproDir, 'FBL3N 051026.xlsx');

    if (!fs.existsSync(f41Path)) {
      return res
        .status(404)
        .json({ error: `Fichier F.41 introuvable dans OS-appro: ${f41Path}` });
    }
    if (!fs.existsSync(fbl3nPath)) {
      return res
        .status(404)
        .json({ error: `Fichier FBL3N introuvable dans OS-appro: ${fbl3nPath}` });
    }

    console.time('import-default');
    console.log('Parsing F.41...');
    const f41List = parser.parseF41(f41Path);

    console.log('Parsing FBL3N...');
    const fbl3nMap = parser.parseFBL3N(fbl3nPath);

    console.log(`Matching ${f41List.length} F.41 invoices with FBL3N...`);
    const result = storage.importData(f41List, fbl3nMap, 'F.41 05102026 & FBL3N 051026');
    console.timeEnd('import-default');

    return res.json({
      success: true,
      message: 'Importation et rapprochement réussis !',
      ...result
    });
  } catch (err) {
    console.error('Import error:', err);
    return res.status(500).json({ error: errMsg(err) });
  }
});

app.post(
  '/api/upload',
  upload.fields([
    { name: 'f41File', maxCount: 1 },
    { name: 'fbl3nFile', maxCount: 1 }
  ]),
  (req: Request, res: Response) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      if (!files || !files.f41File || !files.fbl3nFile) {
        return res
          .status(400)
          .json({ error: 'Veuillez sélectionner les deux fichiers : F.41 et FBL3N' });
      }

      const f41Path = files.f41File[0].path;
      const fbl3nPath = files.fbl3nFile[0].path;

      const f41List = parser.parseF41(f41Path);
      const fbl3nMap = parser.parseFBL3N(fbl3nPath);

      const sourceName = `${files.f41File[0].originalname} + ${files.fbl3nFile[0].originalname}`;
      const result = storage.importData(f41List, fbl3nMap, sourceName);

      try {
        fs.unlinkSync(f41Path);
        fs.unlinkSync(fbl3nPath);
      } catch {
        // ignore
      }

      return res.json({
        success: true,
        message: 'Fichiers importés avec succès !',
        ...result
      });
    } catch (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: errMsg(err) });
    }
  }
);

app.get('/api/dashboard', (req: Request, res: Response) => {
  try {
    const filters: InvoiceFilterOptions = {
      category: req.query.category as string | undefined,
      market: req.query.market as string | undefined,
      year: req.query.year as string | undefined,
      month: req.query.month as string | undefined,
      supplier: req.query.supplier as string | undefined,
      search: req.query.search as string | undefined
    };
    const data = storage.getDashboardData(filters);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

app.get('/api/invoices', async (req: Request, res: Response) => {
  try {
    const filters = {
      category: req.query.category as string | undefined,
      market: req.query.market as string | undefined,
      search: req.query.search as string | undefined,
      year: req.query.year as string | undefined,
      month: req.query.month as string | undefined
    };

    try {
      const sqlList = await sqlDb.getInvoicesFromDb(filters);
      if (Array.isArray(sqlList)) {
        return res.json({
          total: sqlList.length,
          invoices: sqlList,
          source: 'SQL_SERVER_SQLEXPRESS'
        });
      }
    } catch (sqlErr) {
      console.warn('[SQL Server Warning] Fallback to memory store:', errMsg(sqlErr));
    }

    const list = storage.getInvoices(filters);
    return res.json({
      total: list.length,
      invoices: list,
      source: 'LOCAL_STORE'
    });
  } catch (err) {
    return res.status(500).json({ error: errMsg(err) });
  }
});

app.post('/api/invoices/update-category', async (req: Request, res: Response) => {
  try {
    const { piece, category, applyToSupplier } = req.body as {
      piece?: string;
      category?: ExpenseCategory;
      applyToSupplier?: boolean;
    };
    if (!piece || !category) {
      return res.status(400).json({ error: 'Nº pièce et catégorie requis' });
    }
    const updated = storage.updateCategory(piece, category, applyToSupplier);
    try {
      await sqlDb.updateInvoiceCategoryInDb(piece, category);
    } catch (sqlErr) {
      console.warn('SQL update category error:', errMsg(sqlErr));
    }
    return res.json({ success: true, invoice: updated });
  } catch (err) {
    return res.status(400).json({ error: errMsg(err) });
  }
});

app.post('/api/invoices/delete', async (req: Request, res: Response) => {
  try {
    const { piece } = req.body as { piece?: string };
    if (!piece) return res.status(400).json({ error: 'Nº de pièce requis' });
    const inv = storage.deleteInvoice(piece);
    if (!inv) return res.status(404).json({ error: 'Pièce non trouvée' });
    try {
      await sqlDb.deleteInvoiceInDb(piece);
    } catch (sqlErr) {
      console.warn('SQL delete invoice error:', errMsg(sqlErr));
    }
    return res.json({ success: true, piece, isDeleted: true, wasPreviouslyDeleted: true });
  } catch (err) {
    return res.status(500).json({ error: errMsg(err) });
  }
});

app.post('/api/invoices/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { pieces } = req.body as { pieces?: string[] };
    if (!Array.isArray(pieces) || pieces.length === 0) {
      return res.status(400).json({ error: 'Liste de pièces requise' });
    }
    const result = storage.deleteInvoicesBulk(pieces);
    for (const p of pieces) {
      try {
        await sqlDb.deleteInvoiceInDb(p);
      } catch {
        // ignore
      }
    }
    return res.json({ success: true, count: result.count });
  } catch (err) {
    return res.status(500).json({ error: errMsg(err) });
  }
});

app.post('/api/invoices/restore', async (req: Request, res: Response) => {
  try {
    const { piece } = req.body as { piece?: string };
    if (!piece) return res.status(400).json({ error: 'Nº de pièce requis' });
    const inv = storage.restoreInvoice(piece);
    if (!inv) return res.status(404).json({ error: 'Pièce non trouvée' });
    try {
      await sqlDb.restoreInvoiceInDb(piece);
    } catch (sqlErr) {
      console.warn('SQL restore invoice error:', errMsg(sqlErr));
    }
    return res.json({ success: true, piece, isDeleted: false });
  } catch (err) {
    return res.status(500).json({ error: errMsg(err) });
  }
});

app.post('/api/invoices/bulk-update', async (req: Request, res: Response) => {
  try {
    const { pieces, category } = req.body as { pieces?: string[]; category?: ExpenseCategory };
    if (!Array.isArray(pieces) || !category) {
      return res.status(400).json({ error: 'Liste de pièces et catégorie requises' });
    }
    let count = 0;
    pieces.forEach((p) => {
      try {
        storage.updateCategory(p, category, false);
        count++;
      } catch {
        // ignore
      }
    });
    return res.json({ success: true, count });
  } catch (err) {
    return res.status(400).json({ error: errMsg(err) });
  }
});

app.post('/api/suppliers/update-category', (req: Request, res: Response) => {
  try {
    const { supplierId, category, applyToAllInvoices } = req.body as {
      supplierId?: string;
      category?: ExpenseCategory;
      applyToAllInvoices?: boolean;
    };
    if (!supplierId || !category) {
      return res.status(400).json({ error: 'Fournisseur et catégorie requis' });
    }
    const result = storage.updateSupplierDefaultCategory(
      supplierId,
      category,
      applyToAllInvoices !== false
    );
    return res.json({ ...result, success: true });
  } catch (err) {
    return res.status(400).json({ error: errMsg(err) });
  }
});

app.get('/api/report/summary', (req: Request, res: Response) => {
  try {
    const filters: InvoiceFilterOptions = {
      year: req.query.year as string | undefined,
      month: req.query.month as string | undefined
    };
    const unit = (req.query.unit as string) || 'KDA';
    const report = storage.getManagementReport(filters, unit);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

app.get('/api/report/export-summary-excel', (req: Request, res: Response) => {
  try {
    const filters: InvoiceFilterOptions = {
      year: req.query.year as string | undefined,
      month: req.query.month as string | undefined
    };
    const unit = (req.query.unit as string) || 'KDA';
    const report = storage.getManagementReport(filters, unit) as Record<string, any>;

    const formatRatio = (val: unknown) =>
      (val !== undefined && val !== null
        ? Number(val).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0,00') + '%';

    const rows = [
      ['Rubriques', '', report.periodLabel],
      ['', `Val ${unit}`, 'RATIO'],
      ...report.rubriques.map((r: any) => [r.label, r.val || '-', formatRatio(r.ratio)]),
      ['TOTAL', report.totalVal, '100,00%'],
      [],
      ['ACHATS PAR FOURNISSEUR', '', ''],
      ['', report.periodLabel, ''],
      ['Fournisseur', 'valeur achats', 'ratios /global'],
      ...report.suppliers.map((s: any) => [s.label, s.val || '-', formatRatio(s.ratio)]),
      ['Total', report.totalVal, '100,00%'],
      [],
      ['ACHATS PAR TYPE LOC ETRANGER', '', ''],
      ['', report.periodLabel, ''],
      ["type d'achat", 'valeur achats', 'ratios /global'],
      ...report.markets.map((m: any) => [m.label, m.val || '-', formatRatio(m.ratio)]),
      ['Total', report.totalVal, '100,00%']
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 15 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Synthese ${unit}`);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const filename = `Synthese_Achats_${unit}_${String(report.periodLabel || '2026').replace(/\s+/g, '_')}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

app.get('/api/report/export-summary-word', (req: Request, res: Response) => {
  try {
    const filters: InvoiceFilterOptions = {
      year: req.query.year as string | undefined,
      month: req.query.month as string | undefined
    };
    const unit = (req.query.unit as string) || 'KDA';
    const report = storage.getManagementReport(filters, unit) as Record<string, any>;

    const formatNum = (val: unknown) => (val ? Number(val).toLocaleString('fr-FR') : '-');
    const formatRatio = (val: unknown) =>
      (val !== undefined && val !== null
        ? Number(val).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0,00') + '%';
    const sanitizeForWord = (text: unknown, isNumeric = false) => {
      if (text === null || text === undefined || text === '') return '&nbsp;';
      let clean = String(text).trim();
      if (clean === '-' || clean === '0' || clean === '0,00%') return clean;
      if (isNumeric || /\d/.test(clean)) {
        clean = clean.replace(/(\d)\s+(\d)/g, '$1&nbsp;$2');
        clean = clean.replace(/(\d)\s+%/g, '$1%');
      }
      return clean;
    };

    const wordHtml = `
<html xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <title>Synthèse de Gestion - ${report.periodLabel}</title>
  <style>
    @page { size: A4 portrait; margin: 0.5cm; }
    body { font-family: 'Arial Narrow', Calibri, Arial, sans-serif; font-size: 8.5pt; color: #0f172a; margin: 0; padding: 0; }
    h1.doc-title { font-size: 13pt; font-weight: bold; color: #0f172a; margin: 0 0 2pt 0; border-bottom: 2pt solid #1e3a8a; padding-bottom: 3pt; }
    p.doc-subtitle { font-size: 8pt; color: #475569; margin: 0 0 12pt 0; }
    h2.table-title { font-size: 10.5pt; font-weight: bold; color: #0f172a; margin: 10pt 0 1.5pt 0; }
    p.table-subtitle { font-size: 7.5pt; color: #475569; margin: 0 0 4pt 0; }
    table.word-a4-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; border: 1pt solid #0f172a; margin-bottom: 14pt; }
    table.word-a4-table th { border: 0.5pt solid #94a3b8; background-color: #0f172a; color: #ffffff; padding: 3pt 2.5pt; font-weight: bold; text-align: center; }
    table.word-a4-table td { border: 0.5pt solid #cbd5e1; padding: 2.2pt 2.5pt; vertical-align: middle; }
    table.word-a4-table tfoot td { border: 0.5pt solid #475569; background-color: #0f172a; color: #ffffff; font-weight: bold; padding: 3pt 2.5pt; }
  </style>
</head>
<body>
<div class="Section1">
  <h1 class="doc-title">SENSUS SPA - RAPPORT DE GESTION &amp; SYNTHÈSE DES ACHATS</h1>
  <p class="doc-subtitle">Période : <strong>${report.periodLabel}</strong> &nbsp;|&nbsp; Unité : <strong>Val ${unit}</strong> &nbsp;|&nbsp; Total Net HT : <strong style="color:#1e3a8a;">${sanitizeForWord(formatNum(report.totalVal), true)} ${unit}</strong></p>

  <h2 class="table-title">1. RUBRIQUES &amp; POSTES DE DÉPENSES</h2>
  <p class="table-subtitle">9 Catégories d'arbitrage budgétaire • Période : ${report.periodLabel} • Unité : Val ${unit}</p>
  <table class="word-a4-table" width="100%" border="1" cellpadding="1" cellspacing="0">
    <thead>
      <tr style="background-color:#0f172a; color:#ffffff;">
        <th style="text-align:left;">RUBRIQUE</th>
        <th style="text-align:right;">VALEUR (${unit})</th>
        <th style="text-align:right;">RATIO GLOBAL</th>
      </tr>
    </thead>
    <tbody>
      ${report.rubriques
        .map(
          (r: any, i: number) => `
      <tr style="background-color:${i % 2 === 1 ? '#f8fafc' : '#ffffff'};">
        <td style="text-align:left;"><strong>${r.label}</strong></td>
        <td style="text-align:right; font-weight:bold;">${sanitizeForWord(formatNum(r.val), true)}</td>
        <td style="text-align:right; font-weight:bold; color:#1e40af;">${sanitizeForWord(formatRatio(r.ratio), true)}</td>
      </tr>`
        )
        .join('')}
    </tbody>
    <tfoot>
      <tr>
        <td style="text-align:left;">TOTAL GÉNÉRAL</td>
        <td style="text-align:right;">${sanitizeForWord(formatNum(report.totalVal), true)}</td>
        <td style="text-align:right;">100,00%</td>
      </tr>
    </tfoot>
  </table>

  <h2 class="table-title">2. ACHATS PAR FOURNISSEUR PARTENAIRE</h2>
  <p class="table-subtitle">Fournisseurs stratégiques &amp; Autres • Période : ${report.periodLabel} • Unité : Val ${unit}</p>
  <table class="word-a4-table" width="100%" border="1" cellpadding="1" cellspacing="0">
    <thead>
      <tr style="background-color:#0f172a; color:#ffffff;">
        <th style="text-align:left;">FOURNISSEUR</th>
        <th style="text-align:right;">VALEUR ACHATS (${unit})</th>
        <th style="text-align:right;">RATIO GLOBAL</th>
      </tr>
    </thead>
    <tbody>
      ${report.suppliers
        .map(
          (s: any, i: number) => `
      <tr style="background-color:${i % 2 === 1 ? '#f8fafc' : '#ffffff'};">
        <td style="text-align:left;"><strong>${s.label}</strong></td>
        <td style="text-align:right; font-weight:bold;">${sanitizeForWord(formatNum(s.val), true)}</td>
        <td style="text-align:right; font-weight:bold; color:#1e40af;">${sanitizeForWord(formatRatio(s.ratio), true)}</td>
      </tr>`
        )
        .join('')}
    </tbody>
    <tfoot>
      <tr>
        <td style="text-align:left;">TOTAL FOURNISSEURS</td>
        <td style="text-align:right;">${sanitizeForWord(formatNum(report.totalVal), true)}</td>
        <td style="text-align:right;">100,00%</td>
      </tr>
    </tfoot>
  </table>

  <h2 class="table-title">3. RÉPARTITION DES ACHATS PAR MARCHÉ</h2>
  <p class="table-subtitle">Ventilation géographique des flux d'achats • Période : ${report.periodLabel} • Unité : Val ${unit}</p>
  <table class="word-a4-table" width="100%" border="1" cellpadding="1" cellspacing="0">
    <thead>
      <tr style="background-color:#0f172a; color:#ffffff;">
        <th style="text-align:left;">TYPE D'ACHAT</th>
        <th style="text-align:right;">VALEUR ACHATS (${unit})</th>
        <th style="text-align:right;">RATIO GLOBAL</th>
      </tr>
    </thead>
    <tbody>
      ${report.markets
        .map(
          (m: any, i: number) => `
      <tr style="background-color:${i % 2 === 1 ? '#f8fafc' : '#ffffff'};">
        <td style="text-align:left;"><strong>${m.label}</strong></td>
        <td style="text-align:right; font-weight:bold;">${sanitizeForWord(formatNum(m.val), true)}</td>
        <td style="text-align:right; font-weight:bold; color:#1e40af;">${sanitizeForWord(formatRatio(m.ratio), true)}</td>
      </tr>`
        )
        .join('')}
    </tbody>
    <tfoot>
      <tr>
        <td style="text-align:left;">TOTAL FLUX ACHATS</td>
        <td style="text-align:right;">${sanitizeForWord(formatNum(report.totalVal), true)}</td>
        <td style="text-align:right;">100,00%</td>
      </tr>
    </tfoot>
  </table>
</div>
</body>
</html>
    `;

    const filename = `Synthese_Achats_${unit}_${String(report.periodLabel || '2026').replace(/\s+/g, '_')}.doc`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/msword; charset=utf-8');
    res.send(Buffer.from(wordHtml, 'utf-8'));
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

app.get('/api/export-excel', (req: Request, res: Response) => {
  try {
    const filters: InvoiceFilterOptions = {
      category: req.query.category as string | undefined,
      market: req.query.market as string | undefined,
      year: req.query.year as string | undefined,
      month: req.query.month as string | undefined,
      supplierId: req.query.supplierId as string | undefined,
      supplier: req.query.supplier as string | undefined,
      onlyMultiCategory: req.query.onlyMultiCategory === 'true',
      search: req.query.search as string | undefined,
      status: (req.query.status as string) || 'ACTIVE'
    };
    const list = storage.getInvoices(filters);

    const exportRows = list.map((i) => ({
      'Nº Pièce': i.piece,
      'Réf. Facture (Affectation)': i.affectation || '',
      'Type Pièce': i.docType,
      Fournisseur: i.supplierName,
      'Code Fournisseur': i.supplierId,
      'Date Comptable': i.dateComptable,
      Mois: i.month,
      Année: i.year,
      Marché: i.isLocal ? 'Local' : 'Étranger',
      Devise: i.currency,
      'Montant en Devise': !i.isLocal && i.foreignAmount ? i.foreignAmount : '',
      Catégorie: i.category,
      'Montant F.41': i.f41Amount,
      'Retenue 5% (+)': i.retunie,
      'TVA Déduite (-)': i.tva,
      'Débours Déduits (-)': i.debours,
      'Dépense Réelle HT': i.netHT
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dépenses Consolidées');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    res.setHeader('Content-Disposition', 'attachment; filename="Depenses_Consolidees_SAP.xlsx"');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

app.get('/api/reports/document9', (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'AOUT_2026';
    const report = reportingEngine.getDocument9Report(period);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

app.post('/api/reports/document9/export-docx', async (req: Request, res: Response) => {
  try {
    const period = (req.body.period as string) || 'AOUT_2026';
    const customObservations = req.body.observations as
      | Array<string | { text: string }>
      | string
      | null;
    const unit = (req.body.unit as string) || 'KDA';
    const reportData = reportingEngine.getDocument9Report(period);
    const buffer = await reportingEngine.generateWordReport(
      reportData,
      customObservations,
      unit
    );

    const filename = `SENSUS_Synthese_Appro_${period}_${unit}.docx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.send(buffer);
  } catch (err) {
    console.error('Word export error:', err);
    res.status(500).json({ error: errMsg(err) });
  }
});

app.get('/api/reports/stocks', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'AOUT_2026';
    const year = (req.query.year as string) || '2026';
    const doc9 = reportingEngine.getDocument9Report(period);
    let stocksList: Record<string, any>[] = [];
    const balanceKey = year === '2025' ? '2025' : '102026';
    try {
      stocksList = await sqlDb.getGLBalancesFromDb(balanceKey, 'stocks');
    } catch (e) {
      console.warn('SQL stocks fallback:', errMsg(e));
    }
    if (!stocksList || stocksList.length === 0) {
      const sourceBalance =
        balanceKey === '2025' ? reportingEngine.balance25 : reportingEngine.balance1026;
      stocksList = Array.from(sourceBalance.values()).filter(
        (b) =>
          String(b.dz).startsWith('3') ||
          String(b.boal).startsWith('3000') ||
          String(b.boal).startsWith('7800') ||
          String(b.boal).startsWith('7900') ||
          String(b.desc || '').includes('STOCK') ||
          String(b.desc || '').includes('MATIERE')
      );
    }
    res.json({
      stocks: stocksList,
      summaryTable: doc9.stocks,
      year,
      source: 'SQL_SERVER'
    });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

app.get('/api/reports/consommation', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'AOUT_2026';
    const year = req.query.year ? parseInt(String(req.query.year), 10) : null;
    const month =
      req.query.month && req.query.month !== 'ALL'
        ? parseInt(String(req.query.month), 10)
        : null;
    const doc9 = reportingEngine.getDocument9Report(period);
    let chargesList: Record<string, any>[] = [];

    if (year) {
      try {
        chargesList = await fbl3nManager.getConsommationChargesByYear(year, month);
      } catch (fblErr) {
        console.warn('FBL3N charges query error:', errMsg(fblErr));
      }
    }

    if (!chargesList || chargesList.length === 0) {
      try {
        chargesList = await sqlDb.getGLBalancesFromDb('102026', 'charges');
      } catch (e) {
        console.warn('SQL charges fallback:', errMsg(e));
      }
    }
    if (!chargesList || chargesList.length === 0) {
      chargesList = Array.from(reportingEngine.balance1026.values()).filter(
        (b) =>
          String(b.dz).startsWith('60') ||
          String(b.boal).startsWith('4000') ||
          String(b.boal).startsWith('4001') ||
          String(b.boal).startsWith('4403') ||
          String(b.boal).startsWith('4404') ||
          String(b.boal).startsWith('4409') ||
          String(b.desc || '').includes('ACHATS CONSOM')
      );
    }
    res.json({
      charges: chargesList,
      summary: doc9.consommation,
      year: year || 2026,
      month: month || 'ALL',
      source: year && chargesList.length > 0 ? 'FBL3N_DATABASE' : 'SQL_SERVER'
    });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

app.get('/api/reports/fiscalite', async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(String(req.query.year), 10) : null;
    const month =
      req.query.month && req.query.month !== 'ALL'
        ? parseInt(String(req.query.month), 10)
        : null;
    try {
      const sqlFiscal = await sqlDb.getTransitSummaryFromDb(year, month);
      if (
        sqlFiscal &&
        sqlFiscal.totals &&
        (sqlFiscal.totals.totalDebours > 0 ||
          sqlFiscal.totals.totalTva > 0 ||
          sqlFiscal.totals.totalRetenue > 0)
      ) {
        return res.json(sqlFiscal);
      }
    } catch (e) {
      console.warn('SQL fiscal fallback:', errMsg(e));
    }

    let invoices = Array.from(storage.invoices.values()).filter((i) => !i.isDeleted);
    if (year) {
      invoices = invoices.filter(
        (i) =>
          Number(i.year) === year ||
          (i.dateComptable && i.dateComptable.startsWith(String(year)))
      );
    }
    if (month) {
      invoices = invoices.filter(
        (i) =>
          Number(i.month) === month ||
          (i.dateComptable && parseInt(i.dateComptable.substring(5, 7), 10) === month)
      );
    }
    let totalDebours = 0;
    let totalTva = 0;
    let totalRetenue = 0;
    const deboursBySupplier: Record<string, number> = {};
    invoices.forEach((i) => {
      totalDebours += i.debours || 0;
      totalTva += i.tva || 0;
      totalRetenue += i.retunie || 0;
      if ((i.debours || 0) > 0) {
        const s = i.supplierName || 'Inconnu';
        deboursBySupplier[s] = (deboursBySupplier[s] || 0) + (i.debours || 0);
      }
    });
    return res.json({
      totals: {
        totalDebours: Number(totalDebours.toFixed(2)),
        totalTva: Number(totalTva.toFixed(2)),
        totalRetenue: Number(totalRetenue.toFixed(2))
      },
      deboursBySupplier: Object.entries(deboursBySupplier)
        .map(([supplier, amount]) => ({ supplier, amount: Number(amount.toFixed(2)) }))
        .sort((a, b) => b.amount - a.amount)
    });
  } catch (err) {
    return res.status(500).json({ error: errMsg(err) });
  }
});

app.get('/api/reports/status', async (_req: Request, res: Response) => {
  try {
    const dbStats = await sqlDb.getDatabaseStats();
    res.json({
      database: dbStats,
      files: reportingEngine.getStatus(),
      invoicesCount: dbStats.stats?.invoicesCount || storage.invoices.size
    });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

app.post('/api/reports/sync', async (_req: Request, res: Response) => {
  try {
    await reportingEngine.loadMasterFiles();
    const dbStats = await sqlDb.getDatabaseStats();
    res.json({
      success: true,
      database: dbStats
    });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

app.get('/api/tcr', async (req: Request, res: Response) => {
  try {
    const year = (req.query.year as string) || '2026';
    const month = (req.query.month as string) || 'ALL';
    const source = (req.query.source as string) || 'balance';
    const tcr = await reportingEngine.getTCRReport(year, month, source);
    tcr.month = month;
    tcr.source = tcr.sourceUsed || source;
    res.json({
      success: true,
      tcr
    });
  } catch (err) {
    console.error('TCR error:', err);
    res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.get('/api/bilan', async (req: Request, res: Response) => {
  try {
    const year = (req.query.year as string) || '2026';
    const month = (req.query.month as string) || 'ALL';
    const source = (req.query.source as string) || 'balance';
    const bilan = await reportingEngine.getBilanReport(year, month, source);
    bilan.month = month;
    bilan.source = bilan.sourceUsed || source;
    res.json({
      success: true,
      bilan
    });
  } catch (err) {
    console.error('Bilan error:', err);
    res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.get('/api/tft', async (req: Request, res: Response) => {
  try {
    const year = (req.query.year as string) || '2025';
    const month = (req.query.month as string) || 'ALL';
    const tft = await reportingEngine.getTFTReport(year, month);
    res.json({
      success: true,
      tft
    });
  } catch (err) {
    console.error('TFT error:', err);
    res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.get('/api/balance/periods', async (_req: Request, res: Response) => {
  try {
    const periods = await balanceManager.getPeriodsSummary();
    res.json({
      success: true,
      periods
    });
  } catch (err) {
    console.error('Balance periods error:', err);
    res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.get('/api/balance', async (req: Request, res: Response) => {
  try {
    const periodKey =
      (req.query.period as string) || (req.query.period_key as string) || '102026';
    const filterClass = (req.query.class as string) || null;
    const search = (req.query.search as string) || null;

    const rows = await balanceManager.getBalances(periodKey, filterClass, search);
    res.json({
      success: true,
      period: periodKey,
      total: rows.length,
      balances: rows
    });
  } catch (err) {
    console.error('Balance query error:', err);
    res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.post(
  '/api/balance/upload',
  upload.single('balanceFile'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
      }

      const periodKeyOverride = (req.body.periodKey as string) || null;
      const parsed = await balanceManager.parseBalanceFile(req.file.path, periodKeyOverride);
      const saveRes = await balanceManager.saveBalanceToDb(
        parsed.records,
        parsed.periodKey,
        req.file.originalname
      );
      await reportingEngine.loadMasterFiles();

      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // ignore
      }

      const periods = await balanceManager.getPeriodsSummary();

      return res.json({
        success: true,
        message: `Balance importée avec succès : ${saveRes.count} comptes enregistrés pour la période ${parsed.periodKey}`,
        periodKey: parsed.periodKey,
        count: saveRes.count,
        periods
      });
    } catch (err) {
      console.error('Balance upload error:', err);
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // ignore
        }
      }
      return res.status(500).json({ success: false, error: errMsg(err) });
    }
  }
);

app.delete('/api/balance/:periodKey', async (req: Request, res: Response) => {
  try {
    const periodKey = String(req.params.periodKey);
    await balanceManager.deletePeriod(periodKey);
    await reportingEngine.loadMasterFiles();
    const periods = await balanceManager.getPeriodsSummary();
    res.json({
      success: true,
      message: `Période ${periodKey} supprimée avec succès`,
      periods
    });
  } catch (err) {
    console.error('Balance delete error:', err);
    res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.get('/api/years', async (_req: Request, res: Response) => {
  try {
    const fbl3nYears = await fbl3nManager.getAvailableYears();

    const glYears: number[] = [];
    const monthsByYear: Record<string, number[]> = {};

    try {
      const glRows = await sqlDb.query('SELECT DISTINCT period_key FROM GeneralLedgerBalances;');
      glRows.forEach((r) => {
        const pk = String(r.period_key || '').trim();
        if (pk.length >= 4) {
          const yr = parseInt(pk.slice(-4), 10);
          if (yr && yr > 2000 && !glYears.includes(yr)) {
            glYears.push(yr);
          }
          if (pk.length === 6) {
            const mo = parseInt(pk.slice(0, 2), 10);
            const yrStr = String(yr);
            if (!monthsByYear[yrStr]) monthsByYear[yrStr] = [];
            if (mo && !monthsByYear[yrStr].includes(mo)) {
              monthsByYear[yrStr].push(mo);
            }
          }
        }
      });
    } catch (e) {
      console.warn('Error reading years from GeneralLedgerBalances:', errMsg(e));
    }

    try {
      const mRes = await sqlDb.query(`
        SELECT DISTINCT fiscal_year AS [year], fiscal_month AS [month]
        FROM FBL3NLineItems
        WHERE fiscal_year IS NOT NULL AND fiscal_month IS NOT NULL AND doc_number <> ''
        ORDER BY fiscal_year DESC, fiscal_month ASC;
      `);
      mRes.forEach((r) => {
        const yStr = String(r.year);
        if (!monthsByYear[yStr]) monthsByYear[yStr] = [];
        const mNum = parseInt(String(r.month), 10);
        if (mNum && !monthsByYear[yStr].includes(mNum)) {
          monthsByYear[yStr].push(mNum);
        }
      });
    } catch {
      // ignore
    }

    Object.keys(monthsByYear).forEach((k) => {
      monthsByYear[k].sort((a, b) => a - b);
    });

    const distinctDataYears = Array.from(new Set([...fbl3nYears, ...glYears]))
      .map((y) => parseInt(String(y), 10))
      .filter((y) => !isNaN(y) && y > 2000)
      .sort((a, b) => b - a);

    const combinedYears = distinctDataYears.length > 0 ? distinctDataYears : [2026, 2025, 2024];

    res.json({
      success: true,
      years: combinedYears,
      activeDataYears: distinctDataYears,
      monthsByYear
    });
  } catch (err) {
    console.error('Years discovery error:', err);
    res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.get('/api/fbl3n/filters', async (_req: Request, res: Response) => {
  try {
    const filters = await fbl3nManager.getFilterOptions();
    res.json({ success: true, ...filters });
  } catch (err) {
    console.error('FBL3N filters error:', err);
    res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.get('/api/fbl3n', async (req: Request, res: Response) => {
  try {
    const data = await fbl3nManager.getLineItems(req.query as FBL3NLineItemFilters);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('FBL3N query error:', err);
    res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.post('/api/fbl3n/upload', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Aucun fichier Excel transmis.' });
  }
  const filePath = req.file.path;
  try {
    const clearExisting =
      req.body.clearExisting === 'true' || req.body.clearExisting === true;
    const importMode = (req.body.importMode as string) || (clearExisting ? 'all' : 'month');
    const result = await fbl3nManager.importFromExcel(filePath, {
      importMode,
      clearExisting: importMode === 'all',
      sourceFileName: req.file.originalname
    });
    reportingEngine.invalidateTFTCache();
    await reportingEngine.loadMasterFiles();
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
    return res.json({ ...result, success: true });
  } catch (err) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
    console.error('FBL3N Upload error:', err);
    return res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.get('/api/reconciliation', async (req: Request, res: Response) => {
  try {
    const year = (req.query.year as string) || 2026;
    const month = (req.query.month as string) || 10;
    const periodKey = (req.query.periodKey as string) || null;
    const report = await reconciliationManager.reconcile(year, month, periodKey);
    res.json({ success: true, ...report });
  } catch (err) {
    console.error('Reconciliation error:', err);
    res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.post('/api/upload/fbl3n', upload.any(), async (req: Request, res: Response) => {
  try {
    const uploadedFiles =
      (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    if (uploadedFiles.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: 'Aucun fichier FBL3N sélectionné.' });
    }

    const importMode = (req.body.importMode as string) || 'month';
    const batchResults: Record<string, unknown>[] = [];
    let totalInserted = 0;
    const allDiffs: unknown[] = [];

    for (const f of uploadedFiles) {
      try {
        const result = (await reconciliationManager.importFBL3NWithDiff(f.path, {
          importMode,
          sourceFileName: f.originalname
        })) as Record<string, any>;
        batchResults.push({
          fileName: f.originalname,
          success: true,
          totalInserted: result.insertedCount ?? result.totalInserted,
          periods: result.periods,
          diffs: result.diffs || []
        });
        totalInserted += Number(result.insertedCount ?? result.totalInserted ?? 0);
        if (Array.isArray(result.diffs)) {
          allDiffs.push(...result.diffs);
        }
      } catch (fileErr) {
        batchResults.push({
          fileName: f.originalname,
          success: false,
          error: errMsg(fileErr)
        });
      } finally {
        if (fs.existsSync(f.path)) {
          try {
            fs.unlinkSync(f.path);
          } catch {
            // ignore
          }
        }
      }
    }

    reportingEngine.invalidateTFTCache();
    await reportingEngine.loadMasterFiles();
    return res.json({
      success: true,
      filesCount: uploadedFiles.length,
      totalInserted,
      batchResults,
      diffs: allDiffs
    });
  } catch (err) {
    console.error('FBL3N upload error:', err);
    return res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.post('/api/upload/balance', upload.any(), async (req: Request, res: Response) => {
  try {
    const uploadedFiles =
      (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    if (uploadedFiles.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: 'Aucun fichier Balance sélectionné.' });
    }

    const periodOverride = (req.body.periodKey as string) || null;
    const batchResults: Record<string, unknown>[] = [];
    let totalInserted = 0;
    const allDiffs: unknown[] = [];

    for (const f of uploadedFiles) {
      try {
        const result = (await reconciliationManager.importBalanceWithDiff(
          f.path,
          periodOverride
        )) as Record<string, any>;
        batchResults.push({
          fileName: f.originalname,
          success: true,
          periodKey: result.periodKey,
          insertedCount: result.count ?? result.insertedCount,
          diffs: result.diffs || []
        });
        totalInserted += Number(result.count ?? result.insertedCount ?? 0);
        if (Array.isArray(result.diffs)) {
          allDiffs.push(...result.diffs);
        }
      } catch (fileErr) {
        batchResults.push({
          fileName: f.originalname,
          success: false,
          error: errMsg(fileErr)
        });
      } finally {
        if (fs.existsSync(f.path)) {
          try {
            fs.unlinkSync(f.path);
          } catch {
            // ignore
          }
        }
      }
    }

    await reportingEngine.loadMasterFiles();
    return res.json({
      success: true,
      filesCount: uploadedFiles.length,
      totalInserted,
      batchResults,
      diffs: allDiffs
    });
  } catch (err) {
    console.error('Balance upload error:', err);
    return res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.get('/api/import/history', (_req: Request, res: Response) => {
  res.json({ success: true, history: reconciliationManager.getHistory() });
});

app.get('/api/import/summary', async (_req: Request, res: Response) => {
  try {
    const glPeriods = await sqlDb.query(`
      SELECT fiscal_year, fiscal_month, COUNT(*) AS count, 
             SUM(amount_local) AS net_sum,
             SUM(CASE WHEN amount_local > 0 THEN amount_local ELSE 0 END) AS debit_sum,
             SUM(CASE WHEN amount_local < 0 THEN ABS(amount_local) ELSE 0 END) AS credit_sum
      FROM FBL3NLineItems
      WHERE doc_number <> ''
      GROUP BY fiscal_year, fiscal_month
      ORDER BY fiscal_year DESC, fiscal_month ASC
    `);
    const balPeriods = await sqlDb.query(`
      SELECT period_key, COUNT(*) AS accounts_count, 
             SUM(debit) AS total_debit, SUM(credit) AS total_credit,
             MAX(updated_at) AS last_updated
      FROM GeneralLedgerBalances
      GROUP BY period_key
      ORDER BY period_key DESC
    `);
    res.json({ success: true, glPeriods, balPeriods });
  } catch (err) {
    res.status(500).json({ success: false, error: errMsg(err) });
  }
});

app.post('/api/import/delete', async (req: Request, res: Response) => {
  try {
    const { target, year, month, periodKey } = req.body as {
      target?: string;
      year?: string | number;
      month?: string | number;
      periodKey?: string;
    };
    let message = '';
    let deletedCount = 0;

    if (target === 'fbl3n') {
      if (year && month) {
        const delRes = await sqlDb.query(`
          DELETE FROM FBL3NLineItems WHERE fiscal_year = ${parseInt(String(year), 10)} AND fiscal_month = ${parseInt(String(month), 10)};
          SELECT @@ROWCOUNT AS affected;
        `);
        deletedCount = Number(delRes[0]?.affected) || 0;
        message = `Écritures FBL3N supprimées pour le mois ${String(month).padStart(2, '0')}/${year} (${deletedCount} lignes).`;
      } else if (year) {
        const delRes = await sqlDb.query(`
          DELETE FROM FBL3NLineItems WHERE fiscal_year = ${parseInt(String(year), 10)};
          SELECT @@ROWCOUNT AS affected;
        `);
        deletedCount = Number(delRes[0]?.affected) || 0;
        message = `Toutes les écritures FBL3N de l'exercice ${year} ont été supprimées (${deletedCount} lignes).`;
      } else {
        await sqlDb.query('TRUNCATE TABLE FBL3NLineItems');
        message = 'Toutes les écritures FBL3N (Grand Livre) ont été vidées avec succès.';
      }
    } else if (target === 'balance') {
      if (periodKey) {
        const safePeriodKey = String(periodKey).replace(/'/g, "''").trim();
        const delRes = await sqlDb.query(`
          DELETE FROM GeneralLedgerBalances WHERE period_key = '${safePeriodKey}';
          SELECT @@ROWCOUNT AS affected;
        `);
        deletedCount = Number(delRes[0]?.affected) || 0;
        message = `Soldes de Balance supprimés pour la période ${periodKey} (${deletedCount} comptes).`;
      } else {
        await sqlDb.query('TRUNCATE TABLE GeneralLedgerBalances');
        message = 'Toutes les Balances Générales ont été vidées avec succès.';
      }
    } else if (target === 'all') {
      await sqlDb.query(`
        TRUNCATE TABLE FBL3NLineItems;
        TRUNCATE TABLE GeneralLedgerBalances;
      `);
      reconciliationManager.clearHistory();
      message =
        'Toutes les données importées (Grand Livre, Balances, Journal des écarts) ont été réinitialisées.';
    } else {
      return res
        .status(400)
        .json({ success: false, error: 'Cible de suppression invalide (fbl3n, balance, all).' });
    }

    reportingEngine.invalidateTFTCache();
    await reportingEngine.loadMasterFiles();

    return res.json({
      success: true,
      target,
      message,
      deletedCount
    });
  } catch (err) {
    console.error('Delete import error:', err);
    return res.status(500).json({ success: false, error: errMsg(err) });
  }
});

const spaRoutes = [
  '/doc9',
  '/achats',
  '/consommation',
  '/stocks',
  '/fiscalite',
  '/tcr',
  '/bilan',
  '/tft',
  '/fbl3n',
  '/fournisseurs',
  '/parametres',
  '/import'
];
spaRoutes.forEach((r) => {
  app.get(r, (_req: Request, res: Response) => {
    res.sendFile('index.html', { root: STATIC_DIR });
  });
});

const TARGET_PORT = parseInt(process.env.PORT || '50', 10);

function startServer(port: number): void {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(
      `🚀 SENSUS SAP Reporting System running on port ${port} (http://localhost:${port})`
    );
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
      console.warn(
        `[Port ${port} unavailable (${err.code}), attempting port ${port === 50 ? 8050 : port + 1}...]`
      );
      startServer(port === 50 ? 8050 : port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(TARGET_PORT);
