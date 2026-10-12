import th from "./locales/th.json";
import en from "./locales/en.json";
import legacy from "./locales/legacy.json";

export type Language = "th" | "en";
export type TranslationKey = keyof typeof th;
export type UiMessage = {
  readonly kind: "ui-message";
  readonly key: TranslationKey;
  readonly params?: MessageParams;
};
export type MessageValue = string | number | UiMessage | null | undefined;
export type MessageParams = Readonly<Record<string, MessageValue>>;
export type Translator = (key: TranslationKey, params?: MessageParams) => string;
export const LANGUAGE_STORAGE_KEY = "pharmauto-language";
export const resources = { th, en, legacy };

// Descriptors belong only to frontend presentation state, never API payloads.
export function uiMessage(key: TranslationKey, params?: MessageParams): UiMessage {
  return { kind: "ui-message", key, params };
}

export function isExcludedPath(pathname: string) {
  return /^\/(dashboard|me-report)(?:\/|$)/.test(pathname);
}

export function readLanguage(storage: Pick<Storage, "getItem">): Language {
  try {
    return storage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "th";
  } catch {
    return "th";
  }
}

export function createTranslator(language: Language, excluded = false): Translator {
  const dictionary = resources[excluded ? "legacy" : language];
  return (key, params) => dictionary[key].replace(/\{(\w+)\}/g, (token, name: string) => {
    const value = params?.[name];
    return value === undefined ? token : resolveMessage(value, createTranslator(language, excluded));
  });
}

// Strings from API, form inputs and databases pass through byte-for-byte.
export function resolveMessage(value: MessageValue, t: Translator): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return t(value.key, value.params);
  return String(value);
}

export function frontendErrorMessage(error: unknown, fallback: UiMessage): string | UiMessage {
  if (!(error instanceof Error)) return fallback;
  if ("uiMessage" in error) {
    const value = error.uiMessage as UiMessage | undefined;
    if (value?.kind === "ui-message" && value.key in resources.th) return value;
  }
  return error.message;
}
