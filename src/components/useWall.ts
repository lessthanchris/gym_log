"use client";

import { useCallback, useEffect, useState } from "react";
import type { WallDetail } from "@/lib/types";
import { api } from "./api";

/** Load a wall's full detail, polling while AI detection is running. */
export function useWall(initial: WallDetail) {
  const [detail, setDetail] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const id = initial.wall.id;

  const reload = useCallback(async () => {
    try {
      setDetail(await api.getWall(id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  const detecting = detail.wall.status === "detecting";
  useEffect(() => {
    if (!detecting) return;
    const timer = setInterval(reload, 3000);
    return () => clearInterval(timer);
  }, [detecting, reload]);

  /** Run a mutation; on failure surface the error and resync from the server. */
  const mutate = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        setError(null);
      } catch (e) {
        setError((e as Error).message);
        await reload();
      }
    },
    [reload],
  );

  return { detail, setDetail, error, setError, reload, mutate };
}
