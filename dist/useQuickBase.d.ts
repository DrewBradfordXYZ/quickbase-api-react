import { QuickBase } from "quickbase";
import { QuickBaseManagerOptions } from "./quickbaseConfig";
export interface QuickBaseHookOptions extends QuickBaseManagerOptions {
    onError?: (err: Error, method: string, dbid?: string) => void;
}
export declare const useQuickBase: (options: QuickBaseHookOptions) => QuickBase;
