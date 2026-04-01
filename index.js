// ST-Ghostwrite Extension
// 대필 입력 및 실행 확장 프로그램
// ─────────────────────────────────────────────────────

import {
    eventSource,
    event_types,
    getRequestHeaders,
    saveSettingsDebounced,
} from '../../../../script.js';

import { extension_settings, getContext } from '../../../extensions.js';
import { SECRET_KEYS, secret_state } from '../../../secrets.js';
import { getSortedEntries, selected_world_info } from '../../../world-info.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';

const MODULE_NAME = 'ST-ghostwrite';

// ── Provider → oai_settings field name map ────────────
// oai_settings stores the model name per provider in a field like openai_model, claude_model, etc.
const PROVIDER_MODEL_FIELD = {
    openai: 'openai_model',
    claude: 'claude_model',
    google: 'google_model',
    openrouter: 'openrouter_model',
    deepseek: 'deepseek_model',
    cohere: 'cohere_model',
    mistralai: 'mistralai_model',
    groq: 'groq_model',
    xai: 'xai_model',
    perplexity: 'perplexity_model',
    ai21: 'ai21_model',
    fireworks: 'fireworks_model',
    moonshot: 'moonshot_model',
    siliconflow: 'siliconflow_model',
    vertexai: 'vertexai_model',
    azure_openai: 'azure_openai_model',
    nanogpt: 'nanogpt_model',
    electronhub: 'electronhub_model',
    chutes: 'chutes_model',
    aimlapi: 'aimlapi_model',
    pollinations: 'pollinations_model',
    cometapi: 'cometapi_model',
    zai: 'zai_model',
    custom: 'custom_model',
    makersuite: 'google_model',
};

// ── Provider label map ────────────────────────────────
const PROVIDERS = {
    openai: { label: 'OpenAI', source: 'openai' },
    claude: { label: 'Claude', source: 'claude' },
    makersuite: { label: 'Google AI Studio', source: 'makersuite' },
    openrouter: { label: 'OpenRouter', source: 'openrouter' },
    deepseek: { label: 'DeepSeek', source: 'deepseek' },
    cohere: { label: 'Cohere', source: 'cohere' },
    mistralai: { label: 'MistralAI', source: 'mistralai' },
    groq: { label: 'Groq', source: 'groq' },
    xai: { label: 'xAI (Grok)', source: 'xai' },
    perplexity: { label: 'Perplexity', source: 'perplexity' },
    ai21: { label: 'AI21', source: 'ai21' },
    fireworks: { label: 'Fireworks AI', source: 'fireworks' },
    moonshot: { label: 'Moonshot', source: 'moonshot' },
    siliconflow: { label: 'SiliconFlow', source: 'siliconflow' },
    vertexai: { label: 'Google Vertex AI', source: 'vertexai' },
    azure_openai: { label: 'Azure OpenAI', source: 'azure_openai' },
    nanogpt: { label: 'NanoGPT', source: 'nanogpt' },
    electronhub: { label: 'ElectronHub', source: 'electronhub' },
    chutes: { label: 'Chutes', source: 'chutes' },
    aimlapi: { label: 'AIML API', source: 'aimlapi' },
    pollinations: { label: 'Pollinations', source: 'pollinations' },
    cometapi: { label: 'Comet API', source: 'cometapi' },
    zai: { label: 'ZAI', source: 'zai' },
    custom: { label: 'Custom (OpenAI 호환)', source: 'custom' },
};

const DEFAULT_MODELS = {
    openai: 'gpt-4o-mini',
    claude: 'claude-sonnet-4-5',
    makersuite: 'gemini-2.5-flash',
    openrouter: 'OR_Website',
    deepseek: 'deepseek-chat',
    cohere: 'command-r-plus',
    mistralai: 'mistral-large-latest',
    groq: 'llama-3.3-70b-versatile',
    xai: 'grok-3-beta',
    perplexity: 'sonar-pro',
    ai21: 'jamba-large',
    fireworks: '',
    moonshot: 'kimi-latest',
    siliconflow: 'deepseek-ai/DeepSeek-V3',
    vertexai: 'gemini-2.5-flash',
    azure_openai: '',
    nanogpt: 'gpt-4o-mini',
    electronhub: 'gpt-4o-mini',
    chutes: '',
    aimlapi: 'chatgpt-4o-latest',
    pollinations: 'openai',
    cometapi: 'gpt-4o',
    zai: 'glm-4.6',
    custom: '',
};

const PROVIDER_MODELS = {
    openai: [
        'gpt-5.2', 'gpt-5.2-2025-12-11', 'gpt-5.2-chat-latest', 'gpt-5.1', 'gpt-5.1-2025-11-13', 'gpt-5.1-chat-latest',
        'gpt-5', 'gpt-5-2025-08-07', 'gpt-5-chat-latest', 'gpt-5-mini', 'gpt-5-nano',
        'gpt-4o', 'gpt-4o-2024-11-20', 'gpt-4o-2024-08-06', 'gpt-4o-2024-05-13', 'chatgpt-4o-latest',
        'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
        'o1', 'o1-2024-12-17', 'o1-mini', 'o1-mini-2024-09-12', 'o1-preview',
        'o3', 'o3-mini', 'o4-mini', 'gpt-4.5-preview', 'gpt-4-turbo', 'gpt-4-turbo-2024-04-09',
        'gpt-4', 'gpt-3.5-turbo',
    ],
    claude: [
        'claude-opus-4-6', 'claude-opus-4-5', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5',
        'claude-opus-4-1', 'claude-opus-4-0', 'claude-sonnet-4-0',
        'claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest',
        'claude-3-opus-20240229', 'claude-3-haiku-20240307',
    ],
    makersuite: [
        'gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-3-pro-image-preview', 'gemini-3-flash-preview',
        'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-image',
        'gemini-2.0-pro-exp-02-05', 'gemini-2.0-pro-exp', 'gemini-exp-1206',
        'gemini-2.0-flash-001', 'gemini-2.0-flash', 'gemini-2.0-flash-exp',
        'gemini-2.0-flash-thinking-exp-01-21', 'gemini-2.0-flash-thinking-exp',
        'gemini-2.0-flash-lite-001', 'gemini-2.0-flash-lite',
        'gemma-3n-e4b-it', 'gemma-3n-e2b-it', 'gemma-3-27b-it', 'gemma-3-12b-it',
    ],
    openrouter: ['OR_Website'],
    deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    cohere: ['command-a-vision-07-2025', 'command-a-03-2025', 'command-r-plus', 'command-r', 'command', 'command-light', 'c4ai-aya-vision-32b', 'c4ai-aya-expanse-32b', 'c4ai-aya-23'],
    mistralai: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mistral-nemo', 'codestral-latest', 'pixtral-large-latest', 'ministral-8b-latest', 'open-mixtral-8x22b'],
    groq: ['qwen/qwen3-32b', 'deepseek-r1-distill-llama-70b', 'deepseek-r1-distill-qwen-32b', 'gemma2-9b-it', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.1-70b-versatile', 'llama-3.2-11b-vision-preview', 'mistral-saba-24b', 'mixtral-8x7b-32768', 'qwen-qwq-32b', 'qwen-2.5-32b'],
    xai: ['grok-4', 'grok-3', 'grok-3-mini', 'grok-code', 'grok-2', 'grok-2-mini', 'grok-2-vision', 'grok-beta'],
    perplexity: ['sonar-pro', 'sonar', 'sonar-deep-research', 'sonar-reasoning-pro', 'sonar-reasoning', 'r1-1776'],
    ai21: ['jamba-mini', 'jamba-large', 'jamba-1.5-mini', 'jamba-1.5-large'],
    fireworks: [],
    moonshot: ['kimi-k2-0711-preview', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-latest', 'kimi-k2.5'],
    siliconflow: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen3-235B-A22B-Instruct-2507', 'meta-llama/Llama-3.3-70B-Instruct', 'moonshotai/Kimi-K2-Instruct', 'zai-org/GLM-4.6', 'THUDM/glm-4-9b-chat'],
    vertexai: [
        'gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-3-pro-image-preview', 'gemini-3-flash-preview',
        'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-image',
        'gemini-2.0-pro-exp-02-05', 'gemini-2.0-pro-exp', 'gemini-exp-1206',
        'gemini-2.0-flash-001', 'gemini-2.0-flash', 'gemini-2.0-flash-exp',
        'gemini-2.0-flash-thinking-exp-01-21', 'gemini-2.0-flash-thinking-exp',
        'gemini-2.0-flash-lite-001', 'gemini-2.0-flash-lite',
        'gemma-3n-e4b-it', 'gemma-3n-e2b-it', 'gemma-3-27b-it', 'gemma-3-12b-it',
    ],
    azure_openai: [],
    nanogpt: [],
    electronhub: [],
    chutes: [],
    aimlapi: [],
    pollinations: [],
    cometapi: [],
    zai: ['glm-5', 'glm-4.7', 'glm-4.6', 'glm-4.5', 'glm-4.5-air', 'glm-4-32b-0414-128k'],
    custom: [],
};

// ── Default instruction template ──────────────────────
const DEFAULT_INSTRUCTION_TEMPLATE = `You are {{user}}. Next story development: [대필]`;

// ── Default Settings ──────────────────────────────────
const defaultSettings = {
    enabled: true,
    // Generation mode: true = main API (no model swap), false = custom model via model swap
    useMainApi: true,
    // Custom model settings (used when useMainApi is false)
    provider: 'openai',
    model: 'gpt-4o-mini',
    // Instruction template
    instructionTemplate: DEFAULT_INSTRUCTION_TEMPLATE,
    // Template presets { name: templateString }
    templatePresets: { 'Default': DEFAULT_INSTRUCTION_TEMPLATE },
    // Persist custom model name
    customModelName: '',
    // History
    inputHistory: [],
    maxHistory: 30,
    // Extensions to exclude during ghostwrite (by extension folder name)
    excludedExtensions: [],
    // World Info exclusion: entire books or specific entries
    excludedWIBooks: [],       // ['bookName1', 'bookName2']
    excludedWIEntries: [],     // [{ world: 'bookName', uid: 0 }, ...]
    // Persist active draft input
    draftInput: '',
};

// ── State ─────────────────────────────────────────────
let panelVisible = false;
let isGenerating = false;

// ── Settings Management ───────────────────────────────
function getSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = JSON.parse(JSON.stringify(defaultSettings));
    }
    const s = extension_settings[MODULE_NAME];
    for (const key of Object.keys(defaultSettings)) {
        if (s[key] === undefined || s[key] === null) {
            // Deep clone arrays/objects so they aren't shared with defaults
            const def = defaultSettings[key];
            s[key] = (typeof def === 'object' && def !== null) ? JSON.parse(JSON.stringify(def)) : def;
        }
    }
    return s;
}

function saveSettings() {
    saveSettingsDebounced();
}

// ── Utility ───────────────────────────────────────────
function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function normalizeId(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/^third-party\//, '')
        .replace(/^st[-_]/, '')
        .replace(/[\s._-]+/g, '');
}

function getExcludedPromptKeys(settings, ctx) {
    const selected = settings.excludedExtensions || [];
    const prompts = ctx?.extensionPrompts || {};
    const keys = Object.keys(prompts);
    const normalizedKeyMap = new Map(keys.map(k => [normalizeId(k), k]));
    const result = new Set();

    for (const raw of selected) {
        const name = String(raw || '');
        if (!name) continue;

        if (keys.includes(name)) {
            result.add(name);
            continue;
        }

        const normalized = normalizeId(name);
        const direct = normalizedKeyMap.get(normalized);
        if (direct) {
            result.add(direct);
            continue;
        }

        for (const key of keys) {
            const nk = normalizeId(key);
            if (!nk) continue;
            if (nk.includes(normalized) || normalized.includes(nk)) {
                result.add(key);
            }
        }
    }

    return Array.from(result);
}

function getExclusionCandidateNames() {
    const settingsDriven = Object.keys(extension_settings)
        .filter(name => {
            if (name === MODULE_NAME) return false;
            const conf = extension_settings[name];
            if (!conf || typeof conf !== 'object') return false;
            if (conf.promptInjection) return true;
            if (conf.injection) return true;
            if (conf.insertType !== undefined) return true;
            if (typeof conf.prompt === 'string' && conf.prompt.length > 0) return true;
            if (typeof conf.systemPrompt === 'string') return true;
            if (typeof conf.injectionPrompt === 'string') return true;
            return false;
        });

    const ctx = getContext();
    const runtimeDriven = Object.keys(ctx.extensionPrompts || {})
        .filter(name => name && name !== MODULE_NAME);

    return Array.from(new Set([...settingsDriven, ...runtimeDriven])).sort();
}

function normalizeExcludedWIEntries(entries) {
    const result = [];
    const seen = new Set();

    for (const item of Array.isArray(entries) ? entries : []) {
        const world = String(item?.world || '').trim();
        const uid = Number(item?.uid);
        if (!world || !Number.isFinite(uid)) continue;
        const key = normalizeWIEntryKey(world, uid);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ world, uid });
    }

    return result;
}

function runOptimization() {
    const s = getSettings();
    const candidates = getExclusionCandidateNames();
    const normalizedCandidateMap = new Map(candidates.map(name => [normalizeId(name), name]));

    let extRemoved = 0;
    let extRemapped = 0;
    let wiBookRemoved = 0;

    const optimizedExcludedExt = [];
    const seenExt = new Set();

    for (const raw of Array.isArray(s.excludedExtensions) ? s.excludedExtensions : []) {
        const src = String(raw || '').trim();
        if (!src) continue;

        let canonical = null;

        if (candidates.includes(src)) {
            canonical = src;
        } else {
            const normalized = normalizeId(src);
            canonical = normalizedCandidateMap.get(normalized) || null;
            if (!canonical) {
                canonical = candidates.find(name => {
                    const nk = normalizeId(name);
                    return nk.includes(normalized) || normalized.includes(nk);
                }) || null;
            }
            if (canonical) extRemapped++;
        }

        if (!canonical) {
            extRemoved++;
            continue;
        }

        if (!seenExt.has(canonical)) {
            seenExt.add(canonical);
            optimizedExcludedExt.push(canonical);
        }
    }

    const optimizedWIBooks = [];
    const seenBooks = new Set();
    for (const raw of Array.isArray(s.excludedWIBooks) ? s.excludedWIBooks : []) {
        const name = String(raw || '').trim();
        if (!name) {
            wiBookRemoved++;
            continue;
        }
        if (seenBooks.has(name)) continue;
        seenBooks.add(name);
        optimizedWIBooks.push(name);
    }

    const optimizedWIEntries = normalizeExcludedWIEntries(s.excludedWIEntries);
    const wiEntryRemoved = (Array.isArray(s.excludedWIEntries) ? s.excludedWIEntries.length : 0) - optimizedWIEntries.length;

    s.excludedExtensions = optimizedExcludedExt;
    s.excludedWIBooks = optimizedWIBooks;
    s.excludedWIEntries = optimizedWIEntries;
    s.recoveryVersion = 2;

    saveSettings();
    populateExcludedExtensionsList();

    const message = `최적화 완료: 확장 remap ${extRemapped}개, 확장 삭제 ${extRemoved}개, WI 책 정리 ${wiBookRemoved}개, WI 항목 정리 ${Math.max(wiEntryRemoved, 0)}개`;
    toastr.success(message);
    console.info('[ST-ghostwrite] Optimization summary', {
        extRemapped,
        extRemoved,
        wiBookRemoved,
        wiEntryRemoved: Math.max(wiEntryRemoved, 0),
        totalExtCandidates: candidates.length,
    });

}

function runDiagnostics() {
    const s = getSettings();
    const ctx = getContext();
    const candidates = getExclusionCandidateNames();
    const matchedPromptKeys = getExcludedPromptKeys(s, ctx);

    const selectedExt = Array.isArray(s.excludedExtensions) ? s.excludedExtensions.length : 0;
    const selectedBooks = Array.isArray(s.excludedWIBooks) ? s.excludedWIBooks.length : 0;
    const selectedEntries = Array.isArray(s.excludedWIEntries) ? s.excludedWIEntries.length : 0;

    toastr.info(`진단: 제외 확장 ${selectedExt}개, 매칭 프롬프트 ${matchedPromptKeys.length}개, 제외 WI 책 ${selectedBooks}개, 제외 WI 항목 ${selectedEntries}개`);

    console.info('[ST-ghostwrite] Diagnostics', {
        excludedExtensions: s.excludedExtensions || [],
        exclusionCandidates: candidates,
        matchedPromptKeys,
        excludedWIBooks: s.excludedWIBooks || [],
        excludedWIEntries: s.excludedWIEntries || [],
        selectedWorldInfoBooks: selected_world_info,
        runtimePromptKeyCount: Object.keys(ctx.extensionPrompts || {}).length,
    });
}

function normalizeWIEntryKey(world, uid) {
    return `${String(world || '')}::${String(uid)}`;
}

function shouldExcludeWIEntry(entry, excludedBooks, excludedEntryKeys) {
    if (!entry || typeof entry !== 'object') return false;
    if (excludedBooks.has(String(entry.world || ''))) return true;
    return excludedEntryKeys.has(normalizeWIEntryKey(entry.world, entry.uid));
}

function filterWIEntriesInPlace(entries, excludedBooks, excludedEntryKeys) {
    if (!Array.isArray(entries) || entries.length === 0) return;
    for (let i = entries.length - 1; i >= 0; i--) {
        if (shouldExcludeWIEntry(entries[i], excludedBooks, excludedEntryKeys)) {
            entries.splice(i, 1);
        }
    }
}

function createWILoadFilterHandler(settings, stateRef = { active: true }) {
    const excludedBooks = new Set((settings.excludedWIBooks || []).map(String));
    const excludedEntryKeys = new Set(
        (settings.excludedWIEntries || []).map(e => normalizeWIEntryKey(e?.world, e?.uid)),
    );

    return function onWILoaded(payload) {
        if (!stateRef.active) return;
        if (!payload || (!excludedBooks.size && !excludedEntryKeys.size)) return;
        filterWIEntriesInPlace(payload.globalLore, excludedBooks, excludedEntryKeys);
        filterWIEntriesInPlace(payload.characterLore, excludedBooks, excludedEntryKeys);
        filterWIEntriesInPlace(payload.chatLore, excludedBooks, excludedEntryKeys);
        filterWIEntriesInPlace(payload.personaLore, excludedBooks, excludedEntryKeys);
    };
}

// ══════════════════════════════════════════════════════
//  MODEL SWAP HELPER
// ══════════════════════════════════════════════════════

/**
 * Temporarily swap oai_settings to a different provider/model,
 * run main pipeline (inject + impersonate), then restore.
 * This way the full context (world info, presets, etc.) is used,
 * but with a different model.
 */
function swapModel(settings) {
    const ctx = getContext();
    const oaiSettings = ctx.chatCompletionSettings;

    // Keep a full snapshot to guarantee exact restoration after ghostwrite.
    // Partial-field restore can miss edge cases and leave the model changed.
    const originalSnapshot = JSON.parse(JSON.stringify(oaiSettings));

    const provider = settings.provider;
    const model = settings.model || DEFAULT_MODELS[provider] || '';
    const source = PROVIDERS[provider]?.source || provider;
    const modelField = PROVIDER_MODEL_FIELD[source] || PROVIDER_MODEL_FIELD[provider];

    // Swap
    oaiSettings.chat_completion_source = source;
    if (modelField) {
        oaiSettings[modelField] = model;
    }

    // Return restore function
    return function restore() {
        // Remove keys added during temporary swap, then restore snapshot.
        for (const key of Object.keys(oaiSettings)) {
            if (!Object.prototype.hasOwnProperty.call(originalSnapshot, key)) {
                delete oaiSettings[key];
            }
        }
        Object.assign(oaiSettings, originalSnapshot);
    };
}

// ══════════════════════════════════════════════════════
//  GHOSTWRITE GENERATION
// ══════════════════════════════════════════════════════

function buildInstructionPrompt(userInput) {
    const settings = getSettings();
    const template = settings.instructionTemplate || DEFAULT_INSTRUCTION_TEMPLATE;
    // Replace [대필] macro with user input
    return template.replace(/\[대필\]/g, userInput);
}

async function runImpersonate(userInput) {
    const ctx = getContext();
    const instruction = buildInstructionPrompt(userInput);

    // Use slash commands to inject and impersonate, same as the original QR
    const commands = `/inject ephemeral=true id=ghostwrite_instructions position=chat depth=0 ${instruction} |
/impersonate await=true`;

    try {
        const result = await ctx.executeSlashCommandsWithOptions(commands, {
            handleParserErrors: true,
            handleExecutionErrors: false,
        });

        // The result of /impersonate goes to #send_textarea
        const textarea = document.querySelector('#send_textarea');
        if (textarea) {
            return textarea.value || '';
        }
        return result?.pipe || '';
    } catch (err) {
        console.error('[ST-ghostwrite] Slash command error:', err);
        throw err;
    }
}

async function doGhostwrite() {
    const settings = getSettings();
    const input = document.querySelector('#gw-input');
    if (!input) return;

    const userInput = input.value.trim();
    if (!userInput) {
        toastr.warning('대필할 내용을 입력하세요.');
        return;
    }

    // Save to history
    addToHistory(userInput);

    isGenerating = true;
    updateGenerateButton();

    let restoreModel = null;
    let wiLoadFilterHandler = null;
    let wiFilterState = null;
    const savedPromptValues = new Map(); // key → original value string
    const savedInjectionFlags = new Map(); // extensionName → original enabled value

    try {
        const ctx = getContext();

        // ── WI exclusion: filter scan input arrays (safe, does not touch stored WI data) ──
        wiFilterState = { active: true };
        wiLoadFilterHandler = createWILoadFilterHandler(settings, wiFilterState);
        eventSource.on(event_types.WORLDINFO_ENTRIES_LOADED, wiLoadFilterHandler);

        // ── Layer 1: Blank extensionPrompts cache values ──
        // Handles extensions that use setExtensionPrompt() to inject via the
        // generation pipeline. Only the prompt text is hidden; restored in finally.
        for (const key of getExcludedPromptKeys(settings, ctx)) {
            const prompt = ctx.extensionPrompts?.[key];
            if (!prompt || !prompt.value) continue;
            savedPromptValues.set(key, prompt.value);
            prompt.value = '';
        }

        // ── Layer 2: Temporarily suppress event-based prompt injection ──
        // Some extensions (st-image-auto-generation, AutoPic, etc.) inject
        // prompts by directly modifying eventData.chat in the
        // CHAT_COMPLETION_PROMPT_READY event, bypassing the extensionPrompts
        // cache entirely. They all check promptInjection.enabled before
        // injecting, so we temporarily set it to false for excluded extensions.
        // The original value is restored in the finally block.
        for (const name of (settings.excludedExtensions || [])) {
            const extConf = extension_settings[name];
            if (!extConf?.promptInjection || extConf.promptInjection.enabled === undefined) continue;
            savedInjectionFlags.set(name, extConf.promptInjection.enabled);
            extConf.promptInjection.enabled = false;
        }

        // If custom model mode, swap model before running pipeline
        if (!settings.useMainApi) {
            restoreModel = swapModel(settings);
        }

        const result = await runImpersonate(userInput);

        if (result) {
            toastr.success('대필 완료!');
        } else {
            toastr.warning('대필 결과가 비어 있습니다.');
        }
    } catch (err) {
        console.error('[ST-ghostwrite] Generation error:', err);
        toastr.error('대필 실패: ' + (err.message || err));
    } finally {
        // ── Restore blanked extension prompt values ──
        try {
            const ctx = getContext();
            for (const [key, originalValue] of savedPromptValues) {
                if (ctx.extensionPrompts?.[key]) {
                    ctx.extensionPrompts[key].value = originalValue;
                }
            }
        } catch (e) {
            console.warn('[ST-ghostwrite] Extension prompt restore failed', e);
        }

        // ── Restore event-based injection flags ──
        for (const [name, originalEnabled] of savedInjectionFlags) {
            try {
                if (extension_settings[name]?.promptInjection) {
                    extension_settings[name].promptInjection.enabled = originalEnabled;
                }
            } catch (e) {
                console.warn(`[ST-ghostwrite] Injection flag restore failed for ${name}`, e);
            }
        }

        if (wiFilterState) wiFilterState.active = false;

        // Remove WI filter hook if still registered
        if (wiLoadFilterHandler) {
            eventSource.removeListener(event_types.WORLDINFO_ENTRIES_LOADED, wiLoadFilterHandler);
        }

        // Restore original model
        try {
            if (restoreModel) {
                restoreModel();
                // Force-save restored settings so a pending debounced save
                // doesn't accidentally persist the swapped model to disk.
                saveSettingsDebounced();
            }
        } catch (e) {
            console.warn('[ST-ghostwrite] Model restore failed', e);
        }

        isGenerating = false;
        updateGenerateButton();
    }
}

function cancelGhostwrite() {
    if (isGenerating) {
        try {
            const ctx = getContext();
            ctx.stopGeneration();
        } catch (_) { /* ignore */ }
    }
    isGenerating = false;
    updateGenerateButton();
}

// ── History Management ────────────────────────────────
function addToHistory(text) {
    const settings = getSettings();
    if (!settings.inputHistory) settings.inputHistory = [];

    // Remove duplicates
    const idx = settings.inputHistory.indexOf(text);
    if (idx !== -1) settings.inputHistory.splice(idx, 1);

    // Add to front
    settings.inputHistory.unshift(text);

    // Trim to max
    if (settings.inputHistory.length > (settings.maxHistory || 30)) {
        settings.inputHistory = settings.inputHistory.slice(0, settings.maxHistory || 30);
    }

    saveSettings();
}

function removeFromHistory(index) {
    const settings = getSettings();
    if (settings.inputHistory && index >= 0 && index < settings.inputHistory.length) {
        settings.inputHistory.splice(index, 1);
        saveSettings();
    }
}

function loadFromHistory(index) {
    const settings = getSettings();
    if (settings.inputHistory && index >= 0 && index < settings.inputHistory.length) {
        const input = document.querySelector('#gw-input');
        if (input) {
            input.value = settings.inputHistory[index];
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    closeHistoryModal();
}

// ══════════════════════════════════════════════════════
//  UI CONSTRUCTION
// ══════════════════════════════════════════════════════

function createGhostwriteUI() {
    // Idempotent: only create elements if they don't exist yet
    // This prevents the button position from changing on chat change

    const settings = getSettings();

    // ── Panel (above #send_form) ──
    let panel = document.querySelector('#gw-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'gw-panel';
        panel.className = 'gw-panel' + (panelVisible ? ' gw-panel-visible' : '');
        panel.innerHTML = `
            <div class="gw-panel-inner">
                <div class="gw-preset-row" style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
                    <select id="gw-panel-preset-select" style="flex:1; background:var(--SmartThemeChatTintColor, rgba(20,20,30,0.6)); color:var(--SmartThemeBodyColor, #e0e0e0); border:1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.1)); border-radius:6px; padding:4px 6px; font-size:12px; height:28px; cursor:pointer;">
                        <option value="">-- 프리셋 선택 --</option>
                    </select>
                </div>
                <div class="gw-input-row">
                    <textarea id="gw-input" class="gw-input" placeholder="대필할 내용을 입력하세요" rows="2" spellcheck="false">${escapeHtml(settings.draftInput || '')}</textarea>
                    <div class="gw-input-actions">
                        <div class="gw-util-btns">
                            <button id="gw-history-btn" class="gw-icon-btn" title="히스토리">
                                <i class="fa-solid fa-clock-rotate-left"></i>
                            </button>
                            <button id="gw-clear-btn" class="gw-icon-btn" title="입력 지우기">
                                <i class="fa-solid fa-eraser"></i>
                            </button>
                        </div>
                        <button id="gw-generate-btn" class="gw-generate-btn" title="대필 실행">
                            <i class="fa-solid fa-feather-pointed"></i>
                            <span style="font-size: 14px !important;">대필</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const sendForm = document.querySelector('#send_form');
        if (sendForm) {
            sendForm.style.position = 'relative';
            sendForm.appendChild(panel);
        }


        // ── 패널 프리셋 셀렉트 초기화 및 이벤트 ──
        function updatePanelPresetSelect() {
            const sel = panel.querySelector('#gw-panel-preset-select');
            if (!sel) return;
            const s = getSettings();
            const presets = s.templatePresets || {};
            const cur = s.instructionTemplate;
            let html = '<option value="">-- 프리셋 선택 --</option>';
            for (const k of Object.keys(presets).sort()) {
                const selected = presets[k] === cur ? ' selected' : '';
                html += `<option value="${escapeHtml(k)}"${selected}>${escapeHtml(k)}</option>`;
            }
            sel.innerHTML = html;
        }
        updatePanelPresetSelect();

        panel.querySelector('#gw-panel-preset-select')?.addEventListener('change', function () {
            const s = getSettings();
            const name = this.value;
            if (!name || !s.templatePresets?.[name]) return;
            s.instructionTemplate = s.templatePresets[name];
            saveSettings();
            // Settings 패널 textarea도 동기화
            const te = document.querySelector('#gw_instruction_template');
            if (te) te.value = s.instructionTemplate;
            const settingsSel = document.querySelector('#gw_template_preset_select');
            if (settingsSel) {
                for (const opt of settingsSel.options) {
                    opt.selected = opt.value === name;
                }
            }
            toastr.info(`프리셋 "${name}" 적용됨`);
        });
		
        panel.querySelector('#gw-history-btn')?.addEventListener('click', openHistoryModal);
        panel.querySelector('#gw-clear-btn')?.addEventListener('click', () => {
            const textarea = document.querySelector('#gw-input');
            if (textarea) {
                textarea.value = '';
                textarea.style.height = 'auto';
                const s = getSettings();
                s.draftInput = '';
                saveSettingsDebounced();
                textarea.focus();
            }
        });
        panel.querySelector('#gw-generate-btn')?.addEventListener('click', () => {
            if (isGenerating) {
                cancelGhostwrite();
            } else {
                doGhostwrite();
            }
        });

        // Persist draft
        const textarea = panel.querySelector('#gw-input');
        if (textarea) {
            textarea.addEventListener('input', () => {
                const s = getSettings();
                s.draftInput = textarea.value;
                saveSettingsDebounced();
            });
        }
    }

    // ── Left button (#leftSendForm) ──
    let leftBtn = document.querySelector('#gw-left-btn');
    if (!leftBtn) {
        leftBtn = document.createElement('div');
        leftBtn.id = 'gw-left-btn';
        leftBtn.className = 'gw-left-btn fa-solid fa-ghost interactable' + (panelVisible ? ' gw-tab-active' : '');
        leftBtn.title = '대필 패널 열기/닫기';

        const sendBut = document.querySelector('#send_but');
        if (sendBut) {
            sendBut.parentNode.insertBefore(leftBtn, sendBut);
        }

        leftBtn.addEventListener('click', togglePanel);
    }
}

/**
 * 텍스트 내용에 맞춰 인풋창 높이 조절
 */
function updateInputHeight() {
    // No-op - height managed by CSS
}

function togglePanel() {
    panelVisible = !panelVisible;
    const panel = document.querySelector('#gw-panel');
    const leftBtn = document.querySelector('#gw-left-btn');

    if (panel) {
        if (panel._gwAnimEndHandler) {
            panel.removeEventListener('animationend', panel._gwAnimEndHandler);
            panel._gwAnimEndHandler = null;
        }

        if (panelVisible) {
            panel.classList.remove('gw-panel-closing');
            panel.classList.add('gw-panel-visible');
        } else {
            panel.classList.remove('gw-panel-visible');
            panel.classList.add('gw-panel-closing');

            const onEnd = (e) => {
                if (e.target !== panel) return;
                if (e.animationName !== 'gw-slide-up') return;
                panel.removeEventListener('animationend', onEnd);
                panel._gwAnimEndHandler = null;
                panel.classList.remove('gw-panel-closing');
            };
            panel._gwAnimEndHandler = onEnd;
            panel.addEventListener('animationend', onEnd);
        }
    }

    if (leftBtn) leftBtn.classList.toggle('gw-tab-active', panelVisible);

    if (panelVisible) {
        setTimeout(() => {
            document.querySelector('#gw-input')?.focus();
        }, 100);
    }
}

function updateGenerateButton() {
    const btn = document.querySelector('#gw-generate-btn');
    if (!btn) return;

    if (isGenerating) {
        btn.innerHTML = '<i class="fa-solid fa-stop"></i><span style="font-size: 14px !important;">중지</span>';
        btn.classList.add('gw-generating');
    } else {
        btn.innerHTML = '<i class="fa-solid fa-feather-pointed"></i><span style="font-size: 14px !important;">대필</span>';
        btn.classList.remove('gw-generating');
    }
}

// ── History Modal ─────────────────────────────────────
function openHistoryModal() {
    const settings = getSettings();
    const history = settings.inputHistory || [];

    // Remove existing modal
    closeHistoryModal();

    const modal = document.createElement('div');
    modal.id = 'gw-history-modal';
    modal.className = 'gw-history-modal';
    modal.innerHTML = `
        <div class="gw-history-content">
            <div class="gw-history-header">
                <h3><i class="fa-solid fa-clock-rotate-left"></i> 대필 히스토리</h3>
                <button class="gw-history-close" title="닫기"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="gw-history-list">
                ${history.length === 0
            ? '<div class="gw-history-empty">히스토리가 비어 있습니다.</div>'
            : history.map((item, idx) => `
                        <div class="gw-history-item" data-index="${idx}">
                            <div class="gw-history-text">${escapeHtml(item)}</div>
                            <div class="gw-history-item-actions">
                                <button class="gw-history-load" data-index="${idx}" title="불러오기">
                                    <i class="fa-solid fa-arrow-rotate-left"></i>
                                </button>
                                <button class="gw-history-delete" data-index="${idx}" title="삭제">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')
        }
            </div>
            ${history.length > 0 ? `
            <div class="gw-history-footer">
                <button id="gw-history-clear-all" class="gw-history-clear-btn">
                    <i class="fa-solid fa-trash-can"></i> 전체 삭제
                </button>
            </div>
            ` : ''}
        </div>
    `;

    document.body.appendChild(modal);

    // Close on clicking outside content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeHistoryModal();
    });
    modal.querySelector('.gw-history-close')?.addEventListener('click', closeHistoryModal);

    modal.querySelectorAll('.gw-history-load').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadFromHistory(parseInt(btn.dataset.index));
        });
    });

    modal.querySelectorAll('.gw-history-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromHistory(parseInt(btn.dataset.index));
            openHistoryModal();
        });
    });

    modal.querySelector('#gw-history-clear-all')?.addEventListener('click', () => {
        const settings = getSettings();
        settings.inputHistory = [];
        saveSettings();
        openHistoryModal();
    });
}

function closeHistoryModal() {
    const modal = document.querySelector('#gw-history-modal');
    if (modal) modal.remove();
}

// ══════════════════════════════════════════════════════
//  SETTINGS PANEL
// ══════════════════════════════════════════════════════

function createSettingsUI() {
    const settings = getSettings();

    const sysProvider = settings.provider || 'openai';
    const sysModel = settings.model || 'gpt-4o-mini';

    let providerOptions = '';
    for (const key in PROVIDERS) {
        const selected = sysProvider === key ? 'selected' : '';
        providerOptions += `<option value="${key}" ${selected}>${escapeHtml(PROVIDERS[key].label)}</option>`;
    }

    const currentProviderModels = PROVIDER_MODELS[sysProvider] || [];
    const isCustomModel = currentProviderModels.indexOf(sysModel) === -1 && sysModel !== '';
    let modelOptions = '<option value="">모델 선택...</option>';
    currentProviderModels.forEach(m => {
        const selected = sysModel === m ? 'selected' : '';
        modelOptions += `<option value="${m}" ${selected}>${m}</option>`;
    });
    modelOptions += `<option value="__custom__" ${isCustomModel ? 'selected' : ''}>직접 입력</option>`;

    const html = `
        <div class="gw-settings" id="gw_settings_content">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>✍️ 대필</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label class="checkbox_label" style="margin: 5px 0 10px;">
                        <input type="checkbox" id="gw_enabled" ${settings.enabled ? 'checked' : ''} />
                        <span>대필 활성화</span>
                    </label>
                    <hr>

                    <label class="checkbox_label" style="margin: 5px 0 10px;">
                        <input type="checkbox" id="gw_use_main_api" ${settings.useMainApi ? 'checked' : ''} />
                        <span>메인 API 모델 사용</span>
                    </label>
                    <div style="font-size: 11px!important; opacity: 0.7; margin-bottom: 8px;">
                        체크 해제 시 대필 전용 프로바이더/모델을 설정할 수 있습니다.
                        월드인포, 프롬프트 프리셋 등은 그대로 사용됩니다.
                    </div>

                    <div id="gw_custom_model_settings" style="${settings.useMainApi ? 'display:none;' : ''}">
                        <div style="display:flex; gap:10px; margin-bottom:10px;">
                            <div style="flex:1;">
                                <label>프로바이더</label>
                                <select id="gw_provider" class="text_pole">
                                    ${providerOptions}
                                </select>
                            </div>
                            <div style="flex:1;">
                                <label>모델</label>
                                <select id="gw_model_select" class="text_pole">
                                    ${modelOptions}
                                </select>
                                <input type="text" id="gw_model_custom" class="text_pole" value="${escapeHtml(settings.customModelName || '')}" placeholder="모델명 직접 입력" style="margin-top:6px; ${isCustomModel ? '' : 'display:none;'}" />
                            </div>
                        </div>
                    </div>
                    <hr>

                    <div style="margin-bottom:10px;">
                        <label>히스토리 최대 저장 수: <span id="gw_max_history_val">${settings.maxHistory || 10}</span></label>
                        <input type="range" id="gw_max_history" class="text_pole" min="1" max="30" value="${settings.maxHistory || 10}" style="width:100%;" />
                    </div>
                    <hr>

                    <div style="margin-bottom:10px;">
                        <label>대필 시 제외할 확장 프롬프트</label>
                        <div style="font-size: 11px!important; opacity: 0.7; margin-bottom: 4px;">
                            체크된 확장의 프롬프트가 대필 생성 시 제외됩니다.
                        </div>
                        <div style="display:flex; gap:4px; margin-bottom:6px; flex-wrap:wrap;">
                            <button id="gw_optimize_btn" class="menu_button" style="flex:1; font-size:11px!important; gap:4px; min-width:0; padding: 6px 0;" title="구버전 설정 정리 및 매핑">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> 최적화
                            </button>
                            <button id="gw_diagnose_btn" class="menu_button" style="flex:1; font-size:11px!important; gap:4px; min-width:0; padding: 6px 0;" title="현재 제외 매칭 상태 진단">
                                <i class="fa-solid fa-stethoscope"></i> 진단
                            </button>
                            <button id="gw_refresh_ext_list_btn" class="menu_button" style="flex:1; font-size:11px!important; gap:4px; min-width:0; padding: 6px 0;" title="제외 목록 다시 불러오기">
                                <i class="fa-solid fa-rotate"></i> 새로고침
                            </button>
                        </div>
                        <div id="gw_excluded_extensions" style="max-height:150px; overflow-y:auto; border:1px solid var(--SmartThemeBorderColor); border-radius:6px; padding:6px;"></div>
                    </div>
                    <hr>

                    <div style="margin-bottom:10px;">
                        <label>대필 시 제외할 월드인포</label>
                        <div style="font-size: 11px!important; opacity: 0.7; margin-bottom: 4px;">
                            전체 책 또는 개별 항목을 체크하여 대필 생성 시 제외합니다.
                        </div>
                        <button id="gw_load_wi" class="menu_button" style="margin-bottom:6px; width:100%; gap: 5px; font-size: 12px !important;padding: 6px 0;">
                            <i class="fa-solid fa-book-open"></i> 월드인포 불러오기
                        </button>
                        <div id="gw_wi_exclusion_list" style="max-height:200px; overflow-y:auto; border:1px solid var(--SmartThemeBorderColor); border-radius:6px; padding:6px; font-size:12px!important;"></div>
                    </div>
                    <hr>

                    <div style="margin-bottom:10px;">
                        <label>대필 지시문 템플릿</label>
                        <div style="font-size: 11px!important; opacity: 0.7; margin-bottom: 4px;">
                            <code>[대필]</code>이 유저 입력으로 대체됩니다. <code>{{user}}</code> 등 ST 매크로 사용 가능.
                        </div>
                        <div style="display:flex; gap:6px; margin-bottom:6px; align-items:center;">
                            <select id="gw_template_preset_select" class="text_pole" style="flex:1; height:auto; font-size:12px !important;box-sizing: border-box;">
                                <option value="">-- 템플릿 선택 --</option>
                            </select>
                        </div>
                        <div style="display:flex; gap:4px; margin-bottom:6px; flex-wrap:wrap;">
                            <button id="gw_tpl_new" class="menu_button" style="flex:1; font-size:11px!important; gap:4px; min-width:0;padding: 6px 0;" title="새 템플릿">
                                <i class="fa-solid fa-plus"></i> 새로
                            </button>
                            <button id="gw_tpl_save" class="menu_button" style="flex:1; font-size:11px!important; gap:4px; min-width:0;padding: 6px 0;" title="현재 내용 저장">
                                <i class="fa-solid fa-floppy-disk"></i> 저장
                            </button>
                            <button id="gw_tpl_rename" class="menu_button" style="flex:1; font-size:11px!important; gap:4px; min-width:0;padding: 6px 0;" title="이름 변경">
                                <i class="fa-solid fa-pen"></i> 이름
                            </button>
                            <button id="gw_tpl_delete" class="menu_button" style="flex:1; font-size:11px!important; gap:4px; min-width:0;padding: 6px 0;" title="삭제">
                                <i class="fa-solid fa-trash"></i> 삭제
                            </button>
                        </div>
                        <textarea id="gw_instruction_template" class="text_pole" rows="8" style="font-size: 12px!important; font-family: monospace;">${escapeHtml(settings.instructionTemplate || DEFAULT_INSTRUCTION_TEMPLATE)}</textarea>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Append to Extensions settings area
    const settingsContainer = document.querySelector('#extensions_settings2');
    if (settingsContainer) {
        const div = document.createElement('div');
        div.innerHTML = html;
        settingsContainer.appendChild(div.firstElementChild);
    }

    // Bind settings events
    bindSettingsEvents();
    populateExcludedExtensionsList();
}

function populateExcludedExtensionsList() {
    const container = document.querySelector('#gw_excluded_extensions');
    if (!container) return;

    const settings = getSettings();
    const excluded = settings.excludedExtensions || [];
    const extNames = getExclusionCandidateNames();

    if (extNames.length === 0) {
        container.innerHTML = '<div style="font-size:12px!important; opacity:0.6; padding:4px;">감지된 확장 프롬프트가 없습니다.</div>';
        return;
    }

    container.innerHTML = extNames.map(name => `
        <label class="checkbox_label" style="margin:2px 0; font-size:12px!important;">
            <input type="checkbox" data-ext="${escapeHtml(name)}" ${excluded.includes(name) ? 'checked' : ''} />
            <span>${escapeHtml(name)}</span>
        </label>
    `).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', function () {
            const s = getSettings();
            if (!s.excludedExtensions) s.excludedExtensions = [];
            const extName = this.dataset.ext;
            if (this.checked) {
                if (!s.excludedExtensions.includes(extName)) {
                    s.excludedExtensions.push(extName);
                }
            } else {
                s.excludedExtensions = s.excludedExtensions.filter(e => e !== extName);
            }
            saveSettings();
        });
    });
}

async function populateWIExclusionList() {
    const container = document.querySelector('#gw_wi_exclusion_list');
    if (!container) return;

    container.innerHTML = '<div style="opacity:0.6; padding:4px;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩 중...</div>';

    try {
        const entries = await getSortedEntries();
        const settings = getSettings();
        if (!settings.excludedWIBooks) settings.excludedWIBooks = [];
        if (!settings.excludedWIEntries) settings.excludedWIEntries = [];

        // Group entries by book name
        const books = {};
        for (const entry of entries) {
            // Only show entries that are currently enabled (not already disabled)
            if (entry.disable) continue;
            const bookName = entry.world || '(unknown)';
            if (!books[bookName]) books[bookName] = [];
            books[bookName].push(entry);
        }

        if (Object.keys(books).length === 0) {
            container.innerHTML = '<div style="opacity:0.6; padding:4px;">활성화된 월드인포가 없습니다.</div>';
            return;
        }

        container.innerHTML = '';

        for (const [bookName, bookEntries] of Object.entries(books)) {
            const bookDiv = document.createElement('div');
            bookDiv.style.cssText = 'margin-bottom:6px;';

            const isBookExcluded = settings.excludedWIBooks.includes(bookName);

            // Book header with checkbox
            const bookHeader = document.createElement('div');
            bookHeader.style.cssText = 'display:flex; align-items:center; gap:4px; cursor:pointer; font-weight:bold; padding:2px 0;';
            bookHeader.innerHTML = `
                <input type="checkbox" class="gw-wi-book-cb" data-book="${escapeHtml(bookName)}" ${isBookExcluded ? 'checked' : ''} title="전체 책 제외" />
                <i class="fa-solid fa-caret-right gw-wi-toggle" style="width:12px; transition:transform 0.15s;"></i>
                <i class="fa-solid fa-book" style="opacity:0.6;"></i>
                <span>${escapeHtml(bookName)}</span>
                <span style="opacity:0.5; font-weight:normal; margin-left:auto;">(${bookEntries.length})</span>
            `;

            // Entry list (collapsible)
            const entryList = document.createElement('div');
            entryList.style.cssText = 'display:none; padding-left:20px; margin-top:2px;';

            for (const entry of bookEntries) {
                const label = entry.comment || (entry.key && entry.key.length ? entry.key.join(', ') : `UID ${entry.uid}`);
                const isEntryExcluded = settings.excludedWIEntries.some(e => e.world === bookName && e.uid === entry.uid);
                const entryLabel = document.createElement('label');
                entryLabel.className = 'checkbox_label';
                entryLabel.style.cssText = 'margin:1px 0; font-size:11px!important; display:flex; align-items:center; gap:4px;';
                entryLabel.innerHTML = `
                    <input type="checkbox" class="gw-wi-entry-cb" data-book="${escapeHtml(bookName)}" data-uid="${entry.uid}" ${isEntryExcluded ? 'checked' : ''} />
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(label)}</span>
                `;
                entryList.appendChild(entryLabel);
            }

            bookDiv.appendChild(bookHeader);
            bookDiv.appendChild(entryList);
            container.appendChild(bookDiv);

            // Toggle collapse
            const toggleIcon = bookHeader.querySelector('.gw-wi-toggle');
            bookHeader.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                const isOpen = entryList.style.display !== 'none';
                entryList.style.display = isOpen ? 'none' : 'block';
                toggleIcon.style.transform = isOpen ? '' : 'rotate(90deg)';
            });
        }

        // Book checkbox events
        container.querySelectorAll('.gw-wi-book-cb').forEach(cb => {
            cb.addEventListener('change', function () {
                const s = getSettings();
                const book = this.dataset.book;
                if (this.checked) {
                    if (!s.excludedWIBooks.includes(book)) s.excludedWIBooks.push(book);
                } else {
                    s.excludedWIBooks = s.excludedWIBooks.filter(b => b !== book);
                }
                saveSettings();
            });
        });

        // Entry checkbox events
        container.querySelectorAll('.gw-wi-entry-cb').forEach(cb => {
            cb.addEventListener('change', function () {
                const s = getSettings();
                const book = this.dataset.book;
                const uid = parseInt(this.dataset.uid, 10);
                if (this.checked) {
                    if (!s.excludedWIEntries.some(e => e.world === book && e.uid === uid)) {
                        s.excludedWIEntries.push({ world: book, uid });
                    }
                } else {
                    s.excludedWIEntries = s.excludedWIEntries.filter(e => !(e.world === book && e.uid === uid));
                }
                saveSettings();
            });
        });
    } catch (err) {
        console.error('[ST-ghostwrite] Failed to load WI entries:', err);
        container.innerHTML = '<div style="color:red; padding:4px;">월드인포 로딩 실패</div>';
    }
}

// disableExcludedWI removed: WI exclusion is now handled entirely via
// WORLDINFO_ENTRIES_LOADED event filter, which only modifies the temporary
// scan input arrays — never the stored WI data objects.

function bindSettingsEvents() {
    const settings = getSettings();

    document.querySelector('#gw_enabled')?.addEventListener('change', function () {
        settings.enabled = this.checked;
        saveSettings();
        if (settings.enabled) {
            createGhostwriteUI();
        } else {
            document.querySelector('#gw-left-btn')?.remove();
            document.querySelector('#gw-panel')?.remove();
        }
    });

    document.querySelector('#gw_use_main_api')?.addEventListener('change', function () {
        settings.useMainApi = this.checked;
        saveSettings();
        const apiSettings = document.querySelector('#gw_custom_model_settings');
        if (apiSettings) {
            apiSettings.style.display = this.checked ? 'none' : '';
        }
    });

    document.querySelector('#gw_provider')?.addEventListener('change', function () {
        const s = getSettings();
        s.provider = this.value;
        s.model = DEFAULT_MODELS[this.value] || '';
        saveSettings();
        updateModelDropdown();
    });

    document.querySelector('#gw_model_select')?.addEventListener('change', function () {
        const s = getSettings();
        if (this.value === '__custom__') {
            const customInput = document.querySelector('#gw_model_custom');
            if (customInput) {
                customInput.style.display = '';
                customInput.focus();
                // Apply current custom input value immediately
                if (s.customModelName) {
                    s.model = s.customModelName;
                    saveSettings();
                }
            }
        } else {
            s.model = this.value;
            saveSettings();
            const customInput = document.querySelector('#gw_model_custom');
            if (customInput) customInput.style.display = 'none';
        }
    });

    const customModelHandler = function () {
        const s = getSettings();
        s.customModelName = this.value;
        s.model = this.value;
        saveSettings();
    };
    document.querySelector('#gw_model_custom')?.addEventListener('input', customModelHandler);
    document.querySelector('#gw_model_custom')?.addEventListener('change', customModelHandler);

    document.querySelector('#gw_max_history')?.addEventListener('input', function () {
        settings.maxHistory = parseInt(this.value) || 10;
        const valEl = document.querySelector('#gw_max_history_val');
        if (valEl) valEl.textContent = settings.maxHistory;
        // Trim history if needed
        if (settings.inputHistory && settings.inputHistory.length > settings.maxHistory) {
            settings.inputHistory = settings.inputHistory.slice(0, settings.maxHistory);
        }
        saveSettings();
    });

    document.querySelector('#gw_load_wi')?.addEventListener('click', () => populateWIExclusionList());
    document.querySelector('#gw_optimize_btn')?.addEventListener('click', runOptimization);
    document.querySelector('#gw_diagnose_btn')?.addEventListener('click', runDiagnostics);
    document.querySelector('#gw_refresh_ext_list_btn')?.addEventListener('click', () => {
        populateExcludedExtensionsList();
        toastr.info('확장 프롬프트 목록을 다시 불러왔습니다.');
    });

    // ── Template Preset System ──
    function updateTplSelect(forceSelect) {
        const s = getSettings();
        const sel = document.querySelector('#gw_template_preset_select');
        if (!sel) return;
        const presets = s.templatePresets || {};
        const cur = s.instructionTemplate;
        let html = '<option value="">-- 템플릿 선택 --</option>';
        for (const k of Object.keys(presets).sort()) {
            const selected = forceSelect ? (k === forceSelect) : (presets[k] === cur);
            html += '<option value="' + escapeHtml(k) + '"' + (selected ? ' selected' : '') + '>' + escapeHtml(k) + '</option>';
        }
        sel.innerHTML = html;

        // 패널 프리셋 셀렉트도 동기화
        const panelSel = document.querySelector('#gw-panel-preset-select');
        if (panelSel) {
            let panelHtml = '<option value="">-- 프리셋 선택 --</option>';
            for (const k of Object.keys(presets).sort()) {
                const selected = forceSelect ? (k === forceSelect) : (presets[k] === cur);
                panelHtml += '<option value="' + escapeHtml(k) + '"' + (selected ? ' selected' : '') + '>' + escapeHtml(k) + '</option>';
            }
            panelSel.innerHTML = panelHtml;
        }
    }
    updateTplSelect(); // populate on init

    document.querySelector('#gw_template_preset_select')?.addEventListener('change', function () {
        const s = getSettings();
        const name = this.value;
        if (!name || !s.templatePresets?.[name]) return;
        s.instructionTemplate = s.templatePresets[name];
        const te = document.querySelector('#gw_instruction_template');
        if (te) te.value = s.instructionTemplate;
        saveSettings();
    });

    document.querySelector('#gw_tpl_new')?.addEventListener('click', async () => {
        const name = await callGenericPopup('새 템플릿 이름을 입력하세요:', POPUP_TYPE.INPUT, '');
        if (!name || !name.trim()) return;
        const clean = name.trim();
        const s = getSettings();
        if (!s.templatePresets) s.templatePresets = {};
        if (s.templatePresets[clean]) {
            toastr.warning('이미 존재하는 이름입니다.');
            return;
        }
        const te = document.querySelector('#gw_instruction_template');
        const content = te ? te.value : DEFAULT_INSTRUCTION_TEMPLATE;
        s.templatePresets[clean] = content;
        s.instructionTemplate = content;
        saveSettings();
        updateTplSelect(clean);
        toastr.success('템플릿 "' + clean + '"이(가) 생성되었습니다.');
    });

    document.querySelector('#gw_tpl_save')?.addEventListener('click', () => {
        const s = getSettings();
        const sel = document.querySelector('#gw_template_preset_select');
        const te = document.querySelector('#gw_instruction_template');
        if (!sel || !te) return;
        const selectedName = sel.value;
        const content = te.value;
        s.instructionTemplate = content;
        if (selectedName && s.templatePresets) {
            s.templatePresets[selectedName] = content;
            toastr.success('템플릿 "' + selectedName + '"이(가) 저장되었습니다.');
        } else {
            toastr.success('지시문 템플릿이 저장되었습니다.');
        }
        saveSettings();
    });

    document.querySelector('#gw_tpl_rename')?.addEventListener('click', async () => {
        const s = getSettings();
        const sel = document.querySelector('#gw_template_preset_select');
        if (!sel) return;
        const oldName = sel.value;
        if (!oldName) {
            toastr.warning('이름을 변경할 템플릿을 선택하세요.');
            return;
        }
        const newName = await callGenericPopup('"' + oldName + '"의 새 이름을 입력하세요:', POPUP_TYPE.INPUT, oldName);
        if (!newName || !newName.trim() || newName.trim() === oldName) return;
        const cleanNew = newName.trim();
        if (s.templatePresets[cleanNew]) {
            toastr.warning('이미 존재하는 이름입니다.');
            return;
        }
        s.templatePresets[cleanNew] = s.templatePresets[oldName];
        delete s.templatePresets[oldName];
        saveSettings();
        updateTplSelect(cleanNew);
        toastr.success('템플릿 이름이 변경되었습니다.');
    });

    document.querySelector('#gw_tpl_delete')?.addEventListener('click', async () => {
        const s = getSettings();
        const sel = document.querySelector('#gw_template_preset_select');
        if (!sel) return;
        const name = sel.value;
        if (!name) {
            toastr.warning('삭제할 템플릿을 선택하세요.');
            return;
        }
        const confirmed = await callGenericPopup('"' + name + '" 템플릿을 삭제하시겠습니까?', POPUP_TYPE.CONFIRM);
        if (!confirmed) return;
        delete s.templatePresets[name];
        s.instructionTemplate = DEFAULT_INSTRUCTION_TEMPLATE;
        const te = document.querySelector('#gw_instruction_template');
        if (te) te.value = DEFAULT_INSTRUCTION_TEMPLATE;
        saveSettings();
        updateTplSelect();
        toastr.success('템플릿 "' + name + '"이(가) 삭제되었습니다.');
    });
}

function updateModelDropdown() {
    const settings = getSettings();
    const selectEl = document.querySelector('#gw_model_select');
    if (!selectEl) return;

    const models = PROVIDER_MODELS[settings.provider] || [];
    const currentModel = settings.model || '';
    const isCustom = models.indexOf(currentModel) === -1 && currentModel !== '';

    let html = '<option value="">모델 선택...</option>';
    models.forEach(m => {
        const selected = currentModel === m ? 'selected' : '';
        html += `<option value="${m}" ${selected}>${m}</option>`;
    });
    html += `<option value="__custom__" ${isCustom ? 'selected' : ''}>직접 입력</option>`;
    selectEl.innerHTML = html;

    const customInput = document.querySelector('#gw_model_custom');
    if (customInput) {
        customInput.style.display = isCustom ? '' : 'none';
        customInput.value = settings.customModelName || '';
    }
}

// ══════════════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════════════

(function init() {
    const settings = getSettings();

    // Create settings panel
    createSettingsUI();

    // Create ghostwrite UI if enabled
    if (settings.enabled) {
        // Wait for DOM to be ready
        const tryCreate = () => {
            if (document.querySelector('#send_form')) {
                createGhostwriteUI();
            } else {
                setTimeout(tryCreate, 500);
            }
        };
        tryCreate();
    }

    // Re-create UI on chat change
    eventSource.on(event_types.CHAT_CHANGED, () => {
        if (getSettings().enabled) {
            setTimeout(() => createGhostwriteUI(), 300);
        }
    });

    console.log('[ST-ghostwrite] Extension loaded');
})();
