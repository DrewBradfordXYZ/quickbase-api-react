import { useRef } from "react";
import { QuickBase } from "quickbase";
import {
  initializeQuickBaseManager,
  QuickBaseManagerOptions,
} from "./quickbaseConfig";

export interface QuickBaseHookOptions extends QuickBaseManagerOptions {
  onError?: (err: Error, method: string, dbid?: string) => void;
}

export const useQuickBase = (options: QuickBaseHookOptions): QuickBase => {
  const {
    debug = false,
    onError,
    mode = "production",
    ...managerOptions
  } = options;
  const quickbaseService = initializeQuickBaseManager({
    ...managerOptions,
    mode,
    debug,
  });
  const isProduction = mode === "production";

  const requestCache = useRef<Map<string, Promise<any>>>(new Map());
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

          const cacheKey = dbid ? `${prop}:${dbid}` : prop;

          try {
            if (dbid) {
              if (!quickbaseService.tempTokens.has(dbid)) {
                await quickbaseService.ensureTempToken(dbid);
              }
              const currentToken = quickbaseService.tempTokens.get(dbid);
              const currentDbid = (instance as any).settings.tempTokenDbid;
              if (currentToken && currentDbid !== dbid) {
                if (debug)
                  console.log(
                    `Assigning token from tempTokens map to QuickBase.js: ${dbid}: ${currentToken}`
                  );
                instance.setTempToken(dbid, currentToken);
              } else if (debug && currentDbid === dbid) {
                console.log(
                  `Token already assigned to QuickBase.js: ${dbid}: ${currentToken}`
                );
              } else if (debug) {
                console.warn(`No token found in tempTokens for: ${dbid}`);
              }
            } else if (debug) {
              console.warn(
                `No DBID found for method ${prop}, proceeding without token setup`
              );
            }

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
                  console.log(
                    `${url} API request. Params: ${params} Token: ${finalToken}`
                  );
                  if (
                    isProduction &&
                    finalToken !== initialToken &&
                    !finalToken.startsWith("QB-USER-TOKEN")
                  ) {
                    console.log(
                      `API response provided new token: ${finalToken}`
                    );
                  }
                }

                if (
                  isProduction &&
                  finalToken !== initialToken &&
                  !finalToken.startsWith("QB-USER-TOKEN")
                ) {
                  instance.setTempToken(dbid, finalToken);
                }
              }

              return response.data;
            }

            return (await cachedRequest).data;
          } catch (error) {
            const errorMsg = `Error in QuickBase method ${prop}${
              dbid ? ` for: ${dbid}` : ""
            }`;
            if (debug) {
              console.error(errorMsg, error);
              console.log("Error details:", error);
            }
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
