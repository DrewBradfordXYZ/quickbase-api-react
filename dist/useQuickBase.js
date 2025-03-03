import { useRef } from "react";
import { initializeQuickBaseManager, } from "./quickbaseConfig";
export const useQuickBase = (options) => {
    const { debug = false, onError, mode = "production", ...managerOptions } = options;
    const quickbaseService = initializeQuickBaseManager({
        ...managerOptions,
        mode,
        debug,
    });
    const isProduction = mode === "production";
    const requestCache = useRef(new Map());
    const qbRef = useRef(null);
    if (!qbRef.current) {
        const instance = quickbaseService.instance;
        const handler = {
            get(target, prop) {
                if (prop === "logMap") {
                    return quickbaseService.logMap.bind(quickbaseService); // Bind context explicitly
                }
                const originalMethod = target[prop];
                if (typeof originalMethod !== "function" || prop === "setTempToken") {
                    return originalMethod;
                }
                return async function (...args) {
                    const arg = args[0];
                    let dbid;
                    if (typeof arg === "object" && arg !== null) {
                        dbid = arg.appId || arg.tableId || arg.dbid;
                    }
                    else if (typeof arg === "string") {
                        dbid = arg;
                    }
                    const cacheKey = dbid ? `${prop}:${dbid}` : prop;
                    try {
                        let token;
                        if (dbid) {
                            if (!quickbaseService.tempTokens.has(dbid)) {
                                await quickbaseService.ensureTempToken(dbid);
                            }
                            token = quickbaseService.tempTokens.get(dbid);
                            if (debug) {
                                console.log(`Using token from tempTokens for request: ${dbid}: ${token || "none"}`);
                            }
                        }
                        else if (debug) {
                            console.warn(`No DBID found for method ${prop}, proceeding without token setup`);
                        }
                        const cachedRequest = requestCache.current.get(cacheKey);
                        if (cachedRequest) {
                            return (await cachedRequest).data;
                        }
                        const callArgs = dbid && isProduction && token
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
                        const requestPromise = originalMethod.apply(target, callArgs);
                        requestCache.current.set(cacheKey, requestPromise);
                        setTimeout(() => requestCache.current.delete(cacheKey), 100);
                        const response = await requestPromise;
                        if (dbid && response.config && response.config.headers) {
                            const finalToken = response.config.headers["Authorization"]?.replace("QB-TEMP-TOKEN ", "") || "No token set";
                            const initialToken = quickbaseService.tempTokens.get(dbid);
                            const url = response.config.url || "Unknown URL";
                            const params = JSON.stringify(response.config.params) || "{No params}";
                            if (debug) {
                                console.log(`${url} API request. Params: ${params} Token: ${finalToken}`);
                                if (isProduction &&
                                    finalToken !== initialToken &&
                                    !finalToken.startsWith("QB-USER-TOKEN")) {
                                    console.log(`API response provided new token: ${finalToken}`);
                                }
                            }
                            if (isProduction &&
                                finalToken !== initialToken &&
                                !finalToken.startsWith("QB-USER-TOKEN")) {
                                instance.setTempToken(dbid, finalToken);
                            }
                        }
                        return response.data;
                    }
                    catch (error) {
                        const errorMsg = `Error in QuickBase method ${prop}${dbid ? ` for: ${dbid}` : ""}`;
                        if (debug) {
                            console.error(errorMsg, error);
                            console.log("Error details:", error);
                        }
                        if (onError)
                            onError(error instanceof Error ? error : new Error(String(error)), prop, dbid);
                        throw error;
                    }
                };
            },
        };
        const proxiedInstance = new Proxy(instance, handler);
        qbRef.current = proxiedInstance;
    }
    return qbRef.current;
};
