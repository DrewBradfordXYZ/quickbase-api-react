import { QuickBase } from "quickbase";
export const initializeQuickBaseManager = ({ realm, userToken = "", appToken = "", mode = "production", debug = false, }) => {
    if (!realm)
        throw new Error("Realm is required for QuickBase initialization");
    if (!window.quickBaseManager) {
        const isProduction = mode === "production";
        if (!isProduction && !userToken)
            throw new Error("User token is required in development mode");
        const tempTokens = new Map();
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
                    console.log(`Updating tempTokens map for: ${dbid}: ${tempToken}`);
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
                if (debug) {
                    console.log(`Generating initial temp token for: ${dbid}`);
                }
                const response = await instance.getTempTokenDBID({ dbid });
                tempTokens.set(dbid, response.temporaryAuthorization); // Triggers setTempToken logs
            }
        };
        window.quickBaseManager = {
            instance,
            ensureTempToken,
            tempTokens,
        };
    }
    return window.quickBaseManager;
};
