/**
 * RecallForge app context.
 *
 * Holds the connected account, the learner's on-chain profile id (a pointer
 * persisted per-address in localStorage), and the derived on-chain state
 * (profile + checkpoints) used across views. Recall is fully decentralized:
 * everything here is read from Sui, with reports living on Walrus.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { DEFAULT_NETWORK, isDeployed, type SuiNetwork } from "../constants";
import {
  fetchCheckpoints,
  fetchOwnedProfile,
  fetchProfile,
  type OnchainCheckpoint,
  type OnchainProfile,
} from "../lib/suiRead";

interface RecallForgeState {
  network: SuiNetwork;
  address: string | null;
  deployed: boolean;
  profileId: string | null;
  setProfileId: (id: string | null) => void;
  /** True while we're discovering the profile from chain (fresh browser). */
  profileLoading: boolean;
  profile: OnchainProfile | null;
  checkpoints: OnchainCheckpoint[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<RecallForgeState | null>(null);

const STORAGE_KEY = "recallforge.profileId";

function profileKey(address: string): string {
  return `${STORAGE_KEY}:${address}`;
}

export function RecallForgeProvider({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  const address = account?.address ?? null;
  const network = DEFAULT_NETWORK;
  const deployed = isDeployed(network);

  const [profileId, setProfileIdState] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState<OnchainProfile | null>(null);
  const [checkpoints, setCheckpoints] = useState<OnchainCheckpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the learner's profile id whenever the address changes. We try the
  // local cache first (fast path), then fall back to discovering it on-chain —
  // so a returning learner on a fresh browser / private window / new device
  // lands on their dashboard instead of being asked to onboard again.
  useEffect(() => {
    if (!address) {
      setProfileIdState(null);
      setProfileLoading(false);
      return;
    }

    const stored = localStorage.getItem(profileKey(address));
    if (stored) {
      setProfileIdState(stored);
      setProfileLoading(false);
      return;
    }

    // No local pointer: discover the profile from Sui.
    setProfileIdState(null);
    if (!deployed) {
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    void (async () => {
      try {
        const prof = await fetchOwnedProfile(network, address);
        if (cancelled) return;
        if (prof) {
          setProfileIdState(prof.objectId);
          localStorage.setItem(profileKey(address), prof.objectId);
        }
      } catch {
        // Non-fatal: fall through to onboarding.
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, deployed, network]);

  const setProfileId = useCallback(
    (id: string | null) => {
      setProfileIdState(id);
      if (!address) return;
      if (id) localStorage.setItem(profileKey(address), id);
      else localStorage.removeItem(profileKey(address));
    },
    [address],
  );

  const refresh = useCallback(async () => {
    if (!address || !deployed) {
      setProfile(null);
      setCheckpoints([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [cps, prof] = await Promise.all([
        fetchCheckpoints(network, address),
        profileId ? fetchProfile(network, profileId) : Promise.resolve(null),
      ]);
      setCheckpoints(cps);
      setProfile(prof);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load on-chain data");
    } finally {
      setLoading(false);
    }
  }, [address, deployed, network, profileId]);

  // Refresh whenever the inputs to `refresh` change.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<RecallForgeState>(
    () => ({
      network,
      address,
      deployed,
      profileId,
      setProfileId,
      profileLoading,
      profile,
      checkpoints,
      loading,
      error,
      refresh,
    }),
    [
      network,
      address,
      deployed,
      profileId,
      setProfileId,
      profileLoading,
      profile,
      checkpoints,
      loading,
      error,
      refresh,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRecallForge(): RecallForgeState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRecallForge must be used within RecallForgeProvider");
  return ctx;
}
