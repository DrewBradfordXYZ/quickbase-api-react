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
    // Queue for non-concurrent requests
    const requestQueue = useRef([]);
    const processing = useRef(false);
    const qbRef = useRef(null);
    // Process the queue sequentially
    const processQueue = async () => {
        if (processing.current || requestQueue.current.length === 0)
            return;
        processing.current = true;
        while (requestQueue.current.length > 0) {
            const { promise, resolve, reject } = requestQueue.current.shift();
            try {
                const response = await promise;
                resolve(response.data);
            }
            catch (error) {
                reject(error);
            }
        }
        processing.current = false;
    };
    if (!qbRef.current) {
        const instance = quickbaseService.instance;
        const handler = {
            get(target, prop) {
                if (prop === "logMap") {
                    return quickbaseService.logMap.bind(quickbaseService);
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
                    const executeRequest = async () => {
                        try {
                            let token;
                            if (dbid) {
                                if (!quickbaseService.tempTokens.has(dbid)) {
                                    await quickbaseService.ensureTempToken(dbid);
                                }
                                token = quickbaseService.tempTokens.get(dbid);
                                if (token) {
                                    const currentInstanceToken = instance.settings
                                        ?.tempToken;
                                    if (currentInstanceToken !== token) {
                                        instance.setTempToken(dbid, token);
                                    }
                                }
                                else if (debug && isProduction) {
                                    console.warn(`No token found in tempTokens for: ${dbid}`);
                                }
                            }
                            else if (debug) {
                                console.warn(`No DBID found for method ${prop}, proceeding without token setup`);
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
                            const response = await originalMethod.apply(target, callArgs);
                            if (dbid && response.config && response.config.headers) {
                                const finalToken = response.config.headers["Authorization"]?.replace("QB-TEMP-TOKEN ", "") || "No token set";
                                const initialToken = quickbaseService.tempTokens.get(dbid);
                                if (isProduction &&
                                    finalToken !== initialToken &&
                                    !finalToken.startsWith("QB-USER-TOKEN")) {
                                    instance.setTempToken(dbid, finalToken);
                                    if (debug) {
                                        console.log(`API response provided new token: ${finalToken}`);
                                    }
                                }
                            }
                            return response;
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
                    // Detect if this is part of a concurrent call (e.g., Promise.all)
                    const isConcurrent = Promise.all.length > 0 &&
                        new Error().stack?.includes("Promise.all");
                    if (!isConcurrent) {
                        // Non-concurrent: Queue the request
                        return new Promise((resolve, reject) => {
                            const promise = executeRequest();
                            requestQueue.current.push({ promise, resolve, reject });
                            processQueue();
                        });
                    }
                    else {
                        // Concurrent: Execute directly without queuing
                        const response = await executeRequest();
                        return response.data;
                    }
                };
            },
        };
        const proxiedInstance = new Proxy(instance, handler);
        qbRef.current = proxiedInstance;
    }
    return qbRef.current;
};
