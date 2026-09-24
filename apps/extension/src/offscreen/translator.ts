import { env, pipeline, type TranslationPipeline } from "@huggingface/transformers";
import type { TranslateResult, TranslatorStatus } from "../lib/messages.js";
import { dictionaryStatus, lookup } from "./dictionary.js";

export interface LanguagePair {
  sourceLanguage: string;
  targetLanguage: string;
}

/**
 * Offline models, keyed "source>target". To support a new pair offline, add a
 * Xenova/opus-mt-* model here. Pairs not listed only work through Chrome's API.
 */
const LOCAL_MODELS: Record<string, string> = {
  "en>vi": "Xenova/opus-mt-en-vi"
};

// Model weights download from the Hugging Face Hub once, then load from Cache Storage.
env.allowLocalModels = false;
if (env.backends.onnx.wasm) {
  // transformers.js points ONNX Runtime at a CDN by default, which MV3 blocks (no remote code).
  // Clearing it makes the runtime use the copy Vite bundled into the extension.
  env.backends.onnx.wasm.wasmPaths = undefined;
  // Offscreen documents are not cross-origin isolated, so WASM threads are unavailable.
  env.backends.onnx.wasm.numThreads = 1;
}

// --- Engine 1: Chrome's built-in Translator API (Chrome 138+, on-device, tiny) ---

interface ChromeTranslator {
  translate(text: string): Promise<string>;
}
interface ChromeTranslatorFactory {
  availability(pair: LanguagePair): Promise<Exclude<TranslatorStatus["chrome"], "unsupported">>;
  create(pair: LanguagePair): Promise<ChromeTranslator>;
}
const chromeApi = (globalThis as { Translator?: ChromeTranslatorFactory }).Translator;
const chromeTranslators = new Map<string, Promise<ChromeTranslator>>();

async function chromeAvailability(pair: LanguagePair): Promise<TranslatorStatus["chrome"]> {
  if (!chromeApi) return "unsupported";
  return chromeApi.availability(pair).catch(() => "unavailable" as const);
}

function chromeTranslator(pair: LanguagePair): Promise<ChromeTranslator> {
  const key = pairKey(pair);
  if (!chromeTranslators.has(key)) {
    chromeTranslators.set(key, chromeApi!.create(pair).catch((error) => {
      chromeTranslators.delete(key);
      throw error;
    }));
  }
  return chromeTranslators.get(key)!;
}

// --- Engine 2: opus-mt via transformers.js (WASM, ~100 MB once, works everywhere) ---

interface ProgressInfo {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
}

// `pipeline`'s overloads are too complex for TypeScript to infer here; pin the one we use.
const loadTranslationPipeline = (
  model: string,
  options: { dtype: "q8"; progress_callback: (info: ProgressInfo) => void }
): Promise<TranslationPipeline> =>
  (pipeline as unknown as (task: "translation", model: string, options: object) => Promise<TranslationPipeline>)(
    "translation",
    model,
    options
  );

const localTranslators = new Map<string, Promise<TranslationPipeline>>();
const localStates = new Map<string, TranslatorStatus["local"]>();

function localTranslator(pair: LanguagePair): Promise<TranslationPipeline> {
  const key = pairKey(pair);
  const model = LOCAL_MODELS[key];
  if (!model) {
    return Promise.reject(new Error(`No offline model for ${pair.sourceLanguage} → ${pair.targetLanguage}.`));
  }
  if (!localTranslators.has(key)) {
    const files = new Map<string, { loaded: number; total: number }>();
    localStates.set(key, { state: "loading", progress: 0 });
    const loading = loadTranslationPipeline(model, {
      dtype: "q8",
      progress_callback: (info) => {
        if (info.status !== "progress" || !info.file || !info.total) return;
        files.set(info.file, { loaded: info.loaded ?? 0, total: info.total });
        const totals = [...files.values()].reduce((sum, file) => ({ loaded: sum.loaded + file.loaded, total: sum.total + file.total }), { loaded: 0, total: 0 });
        localStates.set(key, { state: "loading", progress: Math.round((totals.loaded / totals.total) * 100) });
      }
    });
    localTranslators.set(key, loading.then(
      (translator) => {
        localStates.set(key, { state: "ready", progress: 100 });
        return translator;
      },
      (error: unknown) => {
        localTranslators.delete(key);
        localStates.set(key, { state: "error", progress: 0, error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    ));
  }
  return localTranslators.get(key)!;
}

// --- Public API used by offscreen/index.ts ---

export async function translate(text: string, pair: LanguagePair): Promise<TranslateResult> {
  // Words and short phrases: the dictionary gives every meaning, which machine translation can't.
  const entry = await lookup(text, pair);
  if (entry) return entry;
  if ((await chromeAvailability(pair)) === "available") {
    try {
      return { translation: composed(await (await chromeTranslator(pair)).translate(text)), engine: "chrome" };
    } catch {
      // Fall through to the offline model.
    }
  }
  const output = await (await localTranslator(pair))(text);
  const first = (Array.isArray(output) ? output[0] : output) as { translation_text?: string } | undefined;
  if (!first?.translation_text) {
    throw new Error("The translator returned no text.");
  }
  return { translation: composed(first.translation_text), engine: "local" };
}

/**
 * Machine translation can return Vietnamese with decomposed accents ("e" + U+0300),
 * which many fonts draw detached ("Chiề u"). NFC composes them into single characters.
 */
function composed(text: string): string {
  return text.normalize("NFC");
}

export async function status(pair: LanguagePair): Promise<TranslatorStatus> {
  const key = pairKey(pair);
  return {
    chrome: await chromeAvailability(pair),
    local: LOCAL_MODELS[key] ? (localStates.get(key) ?? { state: "idle", progress: 0 }) : { state: "unsupported", progress: 0 },
    dictionary: await dictionaryStatus(pair)
  };
}

/** Start loading (downloading on first use) the offline model without waiting for it. */
export async function preloadLocal(pair: LanguagePair): Promise<TranslatorStatus> {
  localTranslator(pair).catch(() => undefined);
  return status(pair);
}

function pairKey(pair: LanguagePair): string {
  return `${pair.sourceLanguage}>${pair.targetLanguage}`;
}
