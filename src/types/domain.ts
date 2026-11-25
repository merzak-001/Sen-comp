export type UserRole = 'admin' | 'user';

export interface AuthUser {
  username: string;
  displayName: string;
  role: UserRole;
  allowedPages: string[];
}

export interface AuthLoginResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
}

export type ExpenseCategory =
  | 'PD'
  | 'MA'
  | 'MP'
  | 'GD'
  | 'EQUIP'
  | 'PR'
  | 'TE'
  | 'S'
  | 'Diver';

export interface RubriqueConfig {
  code: ExpenseCategory;
  label: string;
}

export interface InvoiceRecord {
  piece: string;
  docType: string;
  postingKey: string;
  datePiece: string;
  dateComptable: string;
  year: string;
  month: string;
  yearMonth: string;
  currency: string;
  isLocal: boolean;
  supplierId: string;
  supplierName: string;
  affectation: string;
  foreignAmount: number | null;
  f41Amount: number;
  debours?: number;
  retunie?: number;
  tva?: number;
  glAccounts?: string[];
  category?: ExpenseCategory | string;
  isForeign?: boolean;
  montantHT?: number;
  montantTTC?: number;
  [key: string]: unknown;
}

export interface FBL3NPieceSummary {
  debours: number;
  retunie: number;
  tva: number;
  glAccounts: string[];
}

export interface SupplierInfo {
  supplierId: string;
  supplierName: string;
  category?: string;
  isForeign?: boolean;
  currency?: string;
  totalAmount?: number;
  invoiceCount?: number;
  [key: string]: unknown;
}

export interface ChartOfAccountEntry {
  dz: string;
  desc: string;
}

export interface BalanceAccountItem {
  boal: string;
  desc: string;
  dz: string;
  report: number;
  debit: number;
  credit: number;
  solde: number;
}

export interface SpreadsheetData {
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface SqlTestResult {
  success: boolean;
  db?: string;
  version?: string;
  error?: string;
}

export interface DiffLogRecord {
  id: string;
  timestamp: string;
  type?: string;
  message?: string;
  [key: string]: unknown;
}
