import { QuickBase } from "quickbase";
import { QuickBaseManagerOptions } from "./quickbaseConfig";
export interface QuickBaseHookOptions extends QuickBaseManagerOptions {
    onError?: (err: Error, method: string, dbid?: string) => void;
}
export type QuickBaseExtended = QuickBase;
export declare const useQuickBase: (options: QuickBaseHookOptions) => QuickBaseExtended;
