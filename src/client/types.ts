import type { AuthUser } from '../types/domain';

export type { AuthUser };

export interface FBL3NFiltersState {
  year: string;
  month: string;
  account: string;
  docType: string;
  search: string;
  page: number;
  limit: number;
}

export interface ClientAppState {
  unit: string;
  period: string;
  selectedYear: string;
  selectedMonth: string;
  availableYears: (string | number)[];
  activeDataYears?: (string | number)[];
  monthsByYear: Record<string, number[]>;
  doc9Data: Record<string, any> | null;
  allInvoices: Record<string, any>[];
  filteredInvoices: Record<string, any>[];
  allSuppliers: Record<string, any>[];
  filteredSuppliers: Record<string, any>[];
  supplierFilter: string;
  supplierSearch: string;
  stocksData: Record<string, any> | null;
  consommationData: Record<string, any> | null;
  fiscaliteData: Record<string, any> | null;
  tcrData: Record<string, any> | null;
  tcrSource: string;
  bilanData: Record<string, any> | null;
  bilanSource: string;
  tftData: Record<string, any> | null;
  balanceData: Record<string, any> | null;
  balancePeriods: Record<string, any>[];
  selectedBalancePeriod: string;
  balanceClassFilter: string;
  balanceSearch: string;
  settingsStatus: Record<string, any> | null;
  fbl3nData: Record<string, any> | null;
  fbl3nFilters: FBL3NFiltersState;
  fbl3nOptions: Record<string, any> | null;
  [key: string]: any;
}
