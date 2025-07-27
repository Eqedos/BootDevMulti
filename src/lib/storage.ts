export const chromeStorage = {
    getItem: (key: string) =>
      new Promise<string | null>(resolve =>
        chrome.storage.local.get(key, r => resolve(r[key] ?? null))
      ),
    setItem: (key: string, value: string) =>
      new Promise<void>(resolve =>
        chrome.storage.local.set({ [key]: value }, () => resolve())
      ),
    removeItem: (key: string) =>
      new Promise<void>(resolve =>
        chrome.storage.local.remove(key, () => resolve())
      ),
  };
  
  export const localStorageFallback = {
    getItem: async (key: string) => localStorage.getItem(key),
    setItem: async (key: string, value: string) => {
      localStorage.setItem(key, value);
    },
    removeItem: async (key: string) => {
      localStorage.removeItem(key);
    },
  };
  