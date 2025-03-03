import { QuickBase } from "quickbase";
export const initializeQuickBaseManager = ({ realm, userToken = "", appToken = "", mode = "production", debug = false, }) => {
    if (!realm)
        throw new Error("Realm is required for QuickBase initialization");
    if (!window.quickBaseManager) {
        const isProduction = mode === "production";
        if (!isProduction && !userToken)
            throw new Error("User token is required in development mode");
        const tempTokens = new Map();
        const tokenPromises = new Map();
        if (debug) {
            console.log("Initializing QuickBase manager");
            console.log(`Mode: ${mode}`);
            console.log(`User Token: ${userToken ? "Set" : "Not set"}`);
            console.log(`App Token: ${appToken ? "Set" : "Not set"}`);
            console.log(`Realm: ${realm}`);
        }
        const qbOptions = {
            realm,
            autoRenewTempTokens: true,
        };
        if (isProduction) {
            qbOptions.appToken = appToken;
        }
        else {
            qbOptions.userToken = userToken;
        }
        const instance = new QuickBase(qbOptions);
        const originalSetTempToken = instance.setTempToken.bind(instance);
        instance.setTempToken = (dbid, tempToken) => {
            if (debug) {
                const existingToken = tempTokens.get(dbid);
                if (!tempTokens.has(dbid)) {
                    console.log(`QuickBase.js set temp token for: ${dbid}: ${tempToken}`);
                    console.log(`Adding token to tempTokens map: ${dbid}: ${tempToken}`);
                }
                else if (existingToken !== tempToken) {
                    console.log(`QuickBase.js generating renewed temp token for: ${dbid}`);
                    console.log(`QuickBase.js set temp token for: ${dbid}: ${tempToken}`);
                    console.log(`Updating tempTokens for: ${dbid}: ${tempToken}`);
                }
                else {
                    console.log(`QuickBase.js set temp token for: ${dbid}: ${tempToken}`);
                }
            }
            tempTokens.set(dbid, tempToken);
            originalSetTempToken(dbid, tempToken);
            return instance;
        };
        const ensureTempToken = async (dbid) => {
            if (!isProduction)
                return;
            if (!tempTokens.has(dbid)) {
                let promise = tokenPromises.get(dbid);
                if (!promise) {
                    if (debug) {
                        console.log(`Generating initial temp token for: ${dbid}`);
                    }
                    promise = instance.getTempTokenDBID({ dbid }).then((response) => {
                        tempTokens.set(dbid, response.temporaryAuthorization);
                        tokenPromises.delete(dbid);
                        return response.temporaryAuthorization;
                    });
                    tokenPromises.set(dbid, promise);
                }
                await promise;
            }
        };
        const logMap = () => {
            if (debug) {
                if (!tempTokens) {
                    console.error("tempTokens is undefined in logMap");
                    return;
                }
                console.log("Current tempTokens map state:", Object.fromEntries(tempTokens));
            }
        };
        window.quickBaseManager = {
            instance,
            ensureTempToken,
            tempTokens,
            logMap,
        };
    }
    return window.quickBaseManager;
};
