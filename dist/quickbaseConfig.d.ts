import { QuickBase } from "quickbase";
export interface QuickBaseManagerOptions {
    userToken?: string;
    appToken?: string;
    realm: string;
    mode?: string;
    debug?: boolean;
}
export interface QuickBaseManager {
    instance: QuickBase;
    ensureTempToken: (dbid: string) => Promise<void>;
    tempTokens: Map<string, string>;
}
export declare const initializeQuickBaseManager: ({ realm, userToken, appToken, mode, debug, }: QuickBaseManagerOptions) => QuickBaseManager;
