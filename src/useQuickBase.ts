import { useRef } from "react";
import { QuickBase } from "quickbase";
import {
  initializeQuickBaseManager,
  QuickBaseManagerOptions,
} from "./quickbaseConfig";

export interface QuickBaseHookOptions extends QuickBaseManagerOptions {
  onError?: (err: Error, method: string, dbid?: string) => void;
}

export type QuickBaseExtended = QuickBase;

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

  const requestQueue = useRef<
    Array<{
      promise: Promise<any>;
      resolve: (value: any) => void;
      reject: (reason: any) => void;
    }>
  >([]);
  const processing = useRef(false);
  const activeRequests = useRef(new Set<Promise<any>>());
  const tokenPromises = useRef<Map<string, Promise<string>>>(new Map());
  const qbRef = useRef<QuickBaseExtended | null>(null);

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

  const ensureToken = async (dbid: string): Promise<string> => {
    if (!isProduction) return managerOptions.userToken || "";
    if (!quickbaseService.tempTokens.has(dbid)) {
      let tokenPromise = tokenPromises.current.get(dbid);
      if (!tokenPromise) {
        if (debug) {
          console.log(`Fetching token for ${dbid}`);
        }
        tokenPromise = quickbaseService.instance
          .getTempTokenDBID({ dbid })
          .then((response) => {
            const token = response.temporaryAuthorization;
            quickbaseService.tempTokens.set(dbid, token);
            tokenPromises.current.delete(dbid);
            return token;
          });
        tokenPromises.current.set(dbid, tokenPromise);
      }
      return await tokenPromise;
    }
    return quickbaseService.tempTokens.get(dbid)!;
  };

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

          const executeRequest = async (attempt = 0): Promise<any> => {
            let promise: Promise<any>;
            promise = new Promise(async (resolve, reject) => {
              try {
                let token: string | undefined;

                if (dbid) {
                  token = await ensureToken(dbid);
                  const currentInstanceToken = (instance as any).settings
                    ?.tempToken;
                  if (currentInstanceToken !== token) {
                    instance.setTempToken(dbid, token);
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
                  const url = response.config.url || "Unknown URL";
                  const params =
                    JSON.stringify(response.config.params) || "{No params}";

                  if (debug) {
                    console.log(
                      `${url} API request. Params: ${params} Token: ${finalToken}`
                    );
                  }

                  if (
                    isProduction &&
                    finalToken !== initialToken &&
                    !finalToken.startsWith("QB-USER-TOKEN")
                  ) {
                    instance.setTempToken(dbid, finalToken);
                    quickbaseService.tempTokens.set(dbid, finalToken);
                    if (debug) {
                      console.log(
                        `API response provided new token: ${finalToken}`
                      );
                    }
                  }
                }

                resolve(response);
              } catch (error) {
                const errorMsg = `Error in QuickBase method ${prop}${
                  dbid ? ` for: ${dbid}` : ""
                }`;
                if (debug) {
                  console.error(errorMsg, error);
                  console.log("Error details:", error);
                }
                if (
                  error instanceof Error &&
                  error.message === "Unauthorized" &&
                  dbid &&
                  attempt < 1
                ) {
                  // Retry with a fresh token on 401
                  if (debug) {
                    console.log(`Retrying ${prop} for ${dbid} due to 401`);
                  }
                  quickbaseService.tempTokens.delete(dbid); // Force refresh
                  const retryResponse = await executeRequest(attempt + 1);
                  resolve(retryResponse);
                } else {
                  if (onError)
                    onError(
                      error instanceof Error ? error : new Error(String(error)),
                      prop,
                      dbid
                    );
                  reject(error);
                }
              } finally {
                activeRequests.current.delete(promise);
              }
            });

            activeRequests.current.add(promise);
            return promise;
          };

          // Queue all requests unless part of a Promise.all batch
          const isConcurrentBatch =
            activeRequests.current.size > 0 &&
            new Error().stack?.includes("Promise.all");

          if (!isConcurrentBatch) {
            return new Promise<any>((resolve, reject) => {
              const promise = executeRequest();
              requestQueue.current.push({ promise, resolve, reject });
              processQueue();
            });
          } else {
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
