declare const Zotero: any

export const is7 = Zotero.platformMajorVersion >= 102
export const platform = ['Win', 'Mac', 'Linux'].find(n => Zotero[`is${n}`]) || 'Unknown',
export const client = Zotero.clientName.toLowerCase().replace('-', '')
