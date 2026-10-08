declare global {
  interface Window {
    bestand: { invoke: (channel: string, ...args: any[]) => Promise<any> };
  }
}
export {};
