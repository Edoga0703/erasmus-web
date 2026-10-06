import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import type { StatusResponse } from "@/lib/api/types";

export type ConnState = "checking" | "online" | "offline" | "denied";

export function useConnection() {
  const [state, setState] = useState<ConnState>("checking");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [message, setMessage] = useState<string>("");

  const check = useCallback(async () => {
    setState("checking");
    try {
      await api.session();
      const s = await api.status();
      setStatus(s);
      setState("online");
      setMessage("");
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, "network", "Sin conexión");
      setState(err.status === 403 || err.status === 401 ? "denied" : "offline");
      setMessage(err.status === 0 ? "No se pudo conectar con Erasmus." : err.message);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return { state, status, message, retry: check };
}
