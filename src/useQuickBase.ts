import { useRef } from "react";
import { QuickBase } from "quickbase";
import {
  initializeQuickBaseManager,
  QuickBaseManagerOptions,
} from "./quickbaseConfig";

export interface QuickBaseHookOptions extends QuickBaseManagerOptions {
  onError?: (err: Error, method: string, dbid?: string) => void;
}

export interface QuickBaseExtended extends QuickBase {
  logMap: () => void;
}

export const useQuickBase = (
  options: QuickBaseHookOptions
): QuickBaseExtended => {
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

  // Queue for non-concurrent requests
  const requestQueue = useRef<
    Array<{
      promise: Promise<any>;
      resolve: (value: any) => void;
      reject: (reason: any) => void;
    }>
  >([]);
  const processing = useRef(false);
  const qbRef = useRef<QuickBaseExtended | null>(null);

  // Process the queue sequentially
  const processQueue = async () => {
    if (processing.current || requestQueue.current.length === 0) return;
    processing.current = true;

    while (requestQueue.current.length > 0) {
      const { promise, resolve, reject } = requestQueue.current.shift()!;
      try {
        const response = await promise;
        resolve(response.data);
      } catch (error) {
        reject(error);
      }
    }

    processing.current = false;
  };

  if (!qbRef.current) {
    const instance = quickbaseService.instance;

    const handler: ProxyHandler<QuickBase> = {
      get(target: QuickBase, prop: string) {
        if (prop === "logMap") {
          return quickbaseService.logMap.bind(quickbaseService);
        }
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

          const executeRequest = async () => {
            try {
              let token: string | undefined;

              if (dbid) {
                if (!quickbaseService.tempTokens.has(dbid)) {
                  await quickbaseService.ensureTempToken(dbid);
                }
                token = quickbaseService.tempTokens.get(dbid);

                if (token) {
                  const currentInstanceToken = (instance as any).settings
                    ?.tempToken;
                  if (currentInstanceToken !== token) {
                    instance.setTempToken(dbid, token);
                  }
                } else if (debug && isProduction) {
                  console.warn(`No token found in tempTokens for: ${dbid}`);
                }
              } else if (debug) {
                console.warn(
                  `No DBID found for method ${prop}, proceeding without token setup`
                );
              }

              const callArgs =
                dbid && isProduction && token
                  ? [
                      ...args.slice(0, -2),
                      {
                        ...args[0],
                        headers: { Authorization: `QB-TEMP-TOKEN ${token}` },
                        returnAxios: true,
                      },
                    ]
                  : dbid && !isProduction && managerOptions.userToken
                  ? [
                      ...args.slice(0, -2),
                      {
                        ...args[0],
                        headers: {
                          Authorization: `QB-USER-TOKEN ${managerOptions.userToken}`,
                        },
                        returnAxios: true,
                      },
                    ]
                  : args;

              const response = await originalMethod.apply(target, callArgs);

              if (dbid && response.config && response.config.headers) {
                const finalToken =
                  response.config.headers["Authorization"]?.replace(
                    "QB-TEMP-TOKEN ",
                    ""
                  ) || "No token set";
                const initialToken = quickbaseService.tempTokens.get(dbid);

                if (
                  isProduction &&
                  finalToken !== initialToken &&
                  !finalToken.startsWith("QB-USER-TOKEN")
                ) {
                  instance.setTempToken(dbid, finalToken);
                  if (debug) {
                    console.log(
                      `API response provided new token: ${finalToken}`
                    );
                  }
                }
              }

              return response;
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

          // Detect if this is part of a concurrent call (e.g., Promise.all)
          const isConcurrent =
            Promise.all.length > 0 &&
            new Error().stack?.includes("Promise.all");

          if (!isConcurrent) {
            // Non-concurrent: Queue the request
            return new Promise<any>((resolve, reject) => {
              const promise = executeRequest();
              requestQueue.current.push({ promise, resolve, reject });
              processQueue();
            });
          } else {
            // Concurrent: Execute directly without queuing
            const response = await executeRequest();
            return response.data;
          }
        };
      },
    };

    const proxiedInstance = new Proxy(instance, handler) as QuickBaseExtended;
    qbRef.current = proxiedInstance;
  }

  return qbRef.current;
};
