/**
 * Deployed RecallForge Move package ids, per network.
 *
 * Set these via Vite env vars after `sui client publish` (see `.env.example`):
 *   VITE_RECALLFORGE_PACKAGE_ID_TESTNET=0x...
 * Until then, on-chain actions are disabled and the UI shows a clear notice.
 */
export type SuiNetwork = "mainnet" | "testnet" | "devnet";

export const RECALLFORGE_PACKAGE_IDS: Record<SuiNetwork, string | undefined> = {
  mainnet: import.meta.env.VITE_RECALLFORGE_PACKAGE_ID_MAINNET,
  testnet: import.meta.env.VITE_RECALLFORGE_PACKAGE_ID_TESTNET,
  devnet: import.meta.env.VITE_RECALLFORGE_PACKAGE_ID_DEVNET,
};

/** The on-chain Move module name within the package. */
export const MODULE = "recallforge";

/** Default network the app targets. */
export const DEFAULT_NETWORK: SuiNetwork = "testnet";

/** Base URL of the backend API (empty string → same origin, proxied in dev). */
export const API_BASE = import.meta.env.VITE_SERVER_URL ?? "";

/**
 * Resolve the package id for a network, throwing a friendly error if the app
 * hasn't been pointed at a deployed package yet.
 */
export function getPackageId(network: SuiNetwork): string {
  const id = RECALLFORGE_PACKAGE_IDS[network];
  if (!id) {
    throw new Error(
      `RecallForge package id not set for ${network}. Publish the Move package ` +
        `and set VITE_RECALLFORGE_PACKAGE_ID_${network.toUpperCase()} in your .env.`,
    );
  }
  return id;
}

/** Whether a deployed package exists for the given network. */
export function isDeployed(network: SuiNetwork): boolean {
  return Boolean(RECALLFORGE_PACKAGE_IDS[network]);
}

/** Sui explorer links (suiscan supports all networks). */
export function explorerObjectUrl(id: string, network: SuiNetwork): string {
  return `https://suiscan.xyz/${network}/object/${id}`;
}
export function explorerTxUrl(digest: string, network: SuiNetwork): string {
  return `https://suiscan.xyz/${network}/tx/${digest}`;
}
