// src/quickbaseConfig.ts
import { QuickBase, QuickBaseOptions } from "quickbase";

export interface QuickBaseManagerOptions {
  userToken?: string;
  appToken?: string;
  realm: string;
  mode?: string;
  debug?: boolean; // Changed from logTokens
}

export interface QuickBaseManager {
  instance: QuickBase;
  ensureTempToken: (dbid: string) => Promise<void>;
  tempTokens: Map<string, string>;
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

    const ensureTempToken = async (dbid: string) => {
      if (!isProduction) return;
      if (!tempTokens.has(dbid)) {
        if (debug)
          console.log(`Generating initial temp token for DBID: ${dbid}`);
        const response = await instance.getTempTokenDBID({ dbid });
        if (debug)
          console.log(
            `Generated temp token for DBID: ${dbid}: ${response.temporaryAuthorization}`
          );
        tempTokens.set(dbid, response.temporaryAuthorization);
      }
      instance.setTempToken(dbid, tempTokens.get(dbid)!);
    };

    (window as any).quickBaseManager = {
      instance,
      ensureTempToken,
      tempTokens,
    };
  }

  return (window as any).quickBaseManager;
};
