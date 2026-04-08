/**
 * Crypto markets are always open.
 * Included for interface consistency when composing market-aware strategies.
 */
export function isCryptoMarketOpen(): boolean {
  return true;
}
