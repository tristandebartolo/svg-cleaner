import localforage from 'localforage';

export interface SvgItem {
  id: string;
  name: string;
  originalRaw: string;
  cleanedRaw: string;
  lastUpdated: number;
}

// Ensure the storage is initialized
localforage.config({
  name: 'SvgCleanerEditor',
  storeName: 'cleaned_svgs',
  description: 'Stocke les SVGs importés et nettoyés'
});

export const svgStore = {
  async saveItem(item: SvgItem): Promise<SvgItem> {
    item.lastUpdated = Date.now();
    return localforage.setItem(item.id, item);
  },

  async getItem(id: string): Promise<SvgItem | null> {
    return localforage.getItem(id);
  },

  async getAllItems(): Promise<SvgItem[]> {
    const items: SvgItem[] = [];
    await localforage.iterate((value: SvgItem) => {
      items.push(value);
    });
    return items.sort((a, b) => b.lastUpdated - a.lastUpdated);
  },

  async removeItem(id: string): Promise<void> {
    return localforage.removeItem(id);
  },

  async clearAll(): Promise<void> {
    return localforage.clear();
  }
};
