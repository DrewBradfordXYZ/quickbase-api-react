import { QuickBase, QuickBaseOptions } from "quickbase";

// Define the options for initializing the QuickBaseManager
export interface QuickBaseManagerOptions {
  realm: string;
  userToken?: string;
  appToken?: string;
  mode?: string;
  debug?: boolean;
}

// Define the QuickBaseManager interface
export interface QuickBaseManager {
  instance: QuickBase;
  ensureTempToken: (dbid: string) => Promise<void>;
  tempTokens: Map<string, string>;
}

// Function to initialize the QuickBaseManager
export const initializeQuickBaseManager = ({
  realm,
  userToken = "",
  appToken = "",
  mode = "production",
  debug = false,
}: QuickBaseManagerOptions): QuickBaseManager => {
  // Ensure the realm is provided
  if (!realm) throw new Error("Realm is required for QuickBase initialization");

  // Check if the QuickBaseManager is already initialized
  if (!(window as any).quickBaseManager) {
    const isProduction = mode === "production";
    // In development mode, userToken is required
    if (!isProduction && !userToken)
      throw new Error("User token is required in development mode");

    const tempTokens: Map<string, string> = new Map();
    const tokenPromises: Map<string, Promise<string>> = new Map();

    // Debug logging for initialization
    if (debug) {
      console.log("Initializing QuickBase manager");
      console.log(`Mode: ${mode}`); // Log the mode (production or development)
      console.log(`User Token: ${userToken ? "Set" : "Not set"}`); // Log if user token is set
      console.log(`App Token: ${appToken ? "Set" : "Not set"}`); // Log if app token is set
      console.log(`Realm: ${realm}`); // Log the realm
    }

    // Set QuickBase options
    const qbOptions: QuickBaseOptions = {
      realm,
      autoRenewTempTokens: true,
    };

    // Set the appropriate token based on the mode
    if (isProduction) {
      qbOptions.appToken = appToken;
    } else {
      qbOptions.userToken = userToken;
    }

    // Create a new QuickBase instance
    const instance = new QuickBase(qbOptions);

    // Override the setTempToken method to include debug logging and update tempTokens map
    const originalSetTempToken = instance.setTempToken.bind(instance);
    instance.setTempToken = (dbid: string, tempToken: string) => {
      if (debug) {
        const existingToken = tempTokens.get(dbid);
        if (!tempTokens.has(dbid)) {
          // Token doesn't exist in tempTokens map
          console.log(`Adding token to tempTokens map`); // Log adding token to map
          console.log(`Instance set temp token for: ${dbid}: ${tempToken}`); // Log setting a new temp token
        } else if (existingToken !== tempToken) {
          // The tempTokens map already has a token for the dbid
          // but it doesn't match the token in QuickBase.js.
          // Which means the peerDependency QuickBase.js generated a new token.
          console.log(`Instance generating renewed temp token for: ${dbid}`);
          console.log(`Updating tempTokens map with generated token`); // Log updating token in map
          console.log(`Instance set temp token for: ${dbid}: ${tempToken}`); // Log setting renewed temp token
        } else if (instance.settings?.tempToken !== tempToken) {
          // If the token in the instance doesn't match the token in the map
          // set the dbid and token in the instance
          console.log(`Instance set temp token for: ${dbid}: ${tempToken}`); // Log setting temp token
        }
      }

      // Update the tempTokens map and call the original setTempToken method
      tempTokens.set(dbid, tempToken);
      originalSetTempToken(dbid, tempToken);
      return instance;
    };

    // Function to ensure a temporary token is available for a given dbid
    const ensureTempToken = async (dbid: string): Promise<void> => {
      if (!isProduction) return;
      if (!tempTokens.has(dbid)) {
        let promise = tokenPromises.get(dbid);
        if (!promise) {
          if (debug) {
            console.log(`Generating initial temp token for: ${dbid}`); // Log generating initial temp token
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

    // Store the QuickBaseManager in the global window object
    (window as any).quickBaseManager = {
      instance,
      ensureTempToken,
      tempTokens,
    };
  }

  // Return the QuickBaseManager
  return (window as any).quickBaseManager;
};
