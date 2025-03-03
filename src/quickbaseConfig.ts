import { QuickBase, QuickBaseOptions } from "quickbase";

export interface QuickBaseManagerOptions {
  realm: string;
  userToken?: string;
  appToken?: string;
  mode?: string;
  debug?: boolean;
}

export interface QuickBaseManager {
  instance: QuickBase;
  ensureTempToken: (dbid: string) => Promise<void>;
  tempTokens: Map<string, string>;
  logMap: () => void;
}

export const initializeQuickBaseManager = ({
  realm,
  userToken = "",
  appToken = "",
  mode = "production",
  debug = false,
}: QuickBaseManagerOptions): QuickBaseManager => {
  if (!realm) throw new Error("Realm is required for QuickBase initialization");

  if (!(window as any).quickBaseManager) {
    const isProduction = mode === "production";
    if (!isProduction && !userToken)
      throw new Error("User token is required in development mode");

    const tempTokens: Map<string, string> = new Map();
    const tokenPromises: Map<string, Promise<string>> = new Map();

    if (debug) {
      console.log("Initializing QuickBase manager");
      console.log(`Mode: ${mode}`);
      console.log(`User Token: ${userToken ? "Set" : "Not set"}`);
      console.log(`App Token: ${appToken ? "Set" : "Not set"}`);
      console.log(`Realm: ${realm}`);
    }

    const qbOptions: QuickBaseOptions = {
      realm,
      autoRenewTempTokens: true,
    };

    if (isProduction) {
      qbOptions.appToken = appToken;
    } else {
      qbOptions.userToken = userToken;
    }

    const instance = new QuickBase(qbOptions);

    const originalSetTempToken = instance.setTempToken.bind(instance);
    instance.setTempToken = (dbid: string, tempToken: string) => {
      if (debug) {
        const existingToken = tempTokens.get(dbid);
        if (!tempTokens.has(dbid)) {
          console.log(`QuickBase.js set temp token for: ${dbid}: ${tempToken}`);
          console.log(`Adding token to tempTokens map: ${dbid}: ${tempToken}`);
        } else if (existingToken !== tempToken) {
          console.log(
            `QuickBase.js generating renewed temp token for: ${dbid}`
          );
          console.log(`QuickBase.js set temp token for: ${dbid}: ${tempToken}`);
          console.log(`Updating tempTokens for: ${dbid}: ${tempToken}`);
        } else {
          console.log(`QuickBase.js set temp token for: ${dbid}: ${tempToken}`);
        }
      }

      tempTokens.set(dbid, tempToken);
      originalSetTempToken(dbid, tempToken);
      return instance;
    };

    const ensureTempToken = async (dbid: string): Promise<void> => {
      if (!isProduction) return;
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
        console.log(
          "Current tempTokens map state:",
          Object.fromEntries(tempTokens)
        );
      }
    };

    (window as any).quickBaseManager = {
      instance,
      ensureTempToken,
      tempTokens,
      logMap,
    };
  }

  return (window as any).quickBaseManager;
};
