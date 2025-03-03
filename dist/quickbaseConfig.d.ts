import { QuickBase } from "quickbase";
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
export declare const initializeQuickBaseManager: ({ realm, userToken, appToken, mode, debug, }: QuickBaseManagerOptions) => QuickBaseManager;
