/// <reference types="vite/client" />

declare global {
  const Chart: any;

  interface HTMLElement {
    value: any;
    disabled: boolean;
    checked: boolean;
    files: FileList | null;
    getContext(contextId: string, options?: any): any;
  }

  interface Element {
    value: any;
    checked: boolean;
    style: CSSStyleDeclaration;
    click(): void;
    focus(): void;
  }

  interface EventTarget {
    value: any;
    checked: boolean;
    files: FileList | null;
    style: CSSStyleDeclaration;
    classList: DOMTokenList;
    getAttribute(qualifiedName: string): string | null;
  }

  interface Window {
    navigateToPage?: (targetPageId: string, updateHash?: boolean) => void;
    loadBalanceDataForPeriod?: (periodKey: string) => Promise<void>;
    drilldownAccountGL?: (boalAccount: string) => void;
    removeFileFromFBL3NQueue?: (index: number) => void;
    removeFileFromBalanceQueue?: (index: number) => void;
    saveSupplierChange?: (supplierId: string, changes: Record<string, any>) => Promise<void>;
    [key: string]: any;
  }
}

export {};
