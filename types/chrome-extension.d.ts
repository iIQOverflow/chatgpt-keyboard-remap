interface ChromeStorageChange<T = unknown> {
  oldValue?: T;
  newValue?: T;
}

interface ChromeEvent<Callback extends (...args: any[]) => void> {
  addListener(callback: Callback): void;
  removeListener(callback: Callback): void;
  hasListener?(callback: Callback): boolean;
}

interface ChromeStorageArea {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, any>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface ChromeStorageNamespace {
  sync: ChromeStorageArea;
  onChanged: ChromeEvent<
    (changes: Record<string, ChromeStorageChange>, areaName: string) => void
  >;
}

interface ChromeRuntimeNamespace {
  getManifest(): {
    version: string;
    [key: string]: unknown;
  };
}

interface ChromeExtensionApi {
  storage: ChromeStorageNamespace;
  runtime: ChromeRuntimeNamespace;
}

declare const chrome: ChromeExtensionApi;

interface NavigatorUAData {
  platform?: string;
}

interface Navigator {
  userAgentData?: NavigatorUAData;
}
