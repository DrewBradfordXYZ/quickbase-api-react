// src/useQuickBase.ts
import { useRef } from "react";
import { QuickBase } from "quickbase";
import {
  initializeQuickBaseManager,
  QuickBaseManagerOptions,
} from "./quickbaseConfig";

export interface QuickBaseHookOptions extends QuickBaseManagerOptions {
  onError?: (error: Error, method: string, dbid?: string) => void;
}

export const useQuickBase = (options: QuickBaseHookOptions): QuickBase => {
  const {
    debug = false,
    mode = "production",
    onError,
    ...managerOptions
  } = options;
  const quickbaseService = initializeQuickBaseManager({
    ...managerOptions,
    mode,
    debug,
  });
  const isProduction = mode === "production";

  // requestCache: A ref to a Map that caches API request promises by a unique key (method:dbid).
  // Purpose: Prevents duplicate API calls in development mode when React Strict Mode double-runs useEffect.
  // How it works: If a request is already in progress (e.g., getApp for buwai2zpe), the cached promise is reused,
  // ensuring only one network request is sent despite multiple calls within a short timeframe (100ms).
  const requestCache = useRef<Map<string, Promise<any>>>(new Map());

  // qbRef: A ref to hold the QuickBase proxy instance, ensuring it remains stable across renders.
  // Purpose: Prevents infinite re-rendering loops by avoiding recreation of the proxy on every render,
  // which would happen if useMemo depended on unstable props like inline onError functions.
  // How it works: Initialized once when null and reused thereafter, keeping the qb instance constant
  // unless the component unmounts and remounts, thus stabilizing useEffect dependencies.
  const qbRef = useRef<QuickBase | null>(null);

  if (!qbRef.current) {
    const instance = quickbaseService.instance;

    const handler: ProxyHandler<QuickBase> = {
      get(target: QuickBase, prop: string) {
        const originalMethod = (target as any)[prop];
        if (typeof originalMethod !== "function" || prop === "setTempToken") {
          return originalMethod;
        }

        return async function (...args: any[]) {
          const arg = args[0];
          let dbid: string | undefined;
          if (typeof arg === "object" && arg !== null) {
            dbid = arg.appId || arg.tableId || arg.dbid;
          } else if (typeof arg === "string") {
            dbid = arg;
          }

          try {
            if (dbid) {
              await quickbaseService.ensureTempToken(dbid);
            } else if (debug) {
              console.warn(
                `No DBID found for method ${prop}, proceeding without token setup`
              );
            }

            const cacheKey = dbid ? `${prop}:${dbid}` : prop;
            const cachedRequest = requestCache.current.get(cacheKey);

            if (!cachedRequest) {
              const callArgs = dbid
                ? [...args.slice(0, -2), { ...args[0], returnAxios: true }]
                : args;
              const requestPromise = originalMethod.apply(target, callArgs);
              requestCache.current.set(cacheKey, requestPromise);
              setTimeout(() => requestCache.current.delete(cacheKey), 100);
              const response = await requestPromise;

              if (dbid && response.config && response.config.headers) {
                const finalToken =
                  response.config.headers["Authorization"]?.replace(
                    "QB-TEMP-TOKEN ",
                    ""
                  ) || "No token set";
                const initialToken = quickbaseService.tempTokens.get(dbid);
                const url = response.config.url || "Unknown URL";
                const params =
                  JSON.stringify(response.config.params) || "{No params}";

                if (debug) {
                  if (isProduction) {
                    console.log(
                      `${url} API request. Params: ${params} Token: ${
                        initialToken || "No initial token"
                      }`
                    );
                    if (
                      finalToken !== initialToken &&
                      !finalToken.startsWith("QB-USER-TOKEN")
                    ) {
                      console.log(
                        `Token renewed for DBID: ${dbid}: ${finalToken}`
                      );
                    }
                  } else {
                    console.log(
                      `${url} API request (dev mode). Params: ${params} User Token: ${finalToken}`
                    );
                  }
                }

                if (
                  isProduction &&
                  finalToken !== initialToken &&
                  !finalToken.startsWith("QB-USER-TOKEN")
                ) {
                  quickbaseService.tempTokens.set(dbid, finalToken);
                }
              }

              return response.data;
            }

            return (await cachedRequest).data;
          } catch (error) {
            const errorMsg = `Error in QuickBase method ${prop}${
              dbid ? ` for DBID: ${dbid}` : ""
            }`;
            if (debug) console.error(errorMsg, error);
            if (onError)
              onError(
                error instanceof Error ? error : new Error(String(error)),
                prop,
                dbid
              );
            throw error;
          }
        };
      },
    };

    qbRef.current = new Proxy(instance, handler);
  }

  return qbRef.current;
};
