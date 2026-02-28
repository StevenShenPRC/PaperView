import { ModelMetadata } from '../types';

/**
 * Format context length as a short abbreviation: 128K, 1.00M, etc.
 * Keeps 3 significant digits.
 */
export function formatContextShort(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toPrecision(3) + 'M';
    if (n >= 1_000) return (n / 1_000).toPrecision(3) + 'K';
    return n.toString();
}

/**
 * Format context length for detail view: "128K (128,000)"
 */
export function formatContextDetail(n: number): string {
    return `${formatContextShort(n)} (${n.toLocaleString()})`;
}

/**
 * Find the matching key in the model database for a given model ID.
 * Returns [key, info] or [null, null] if not found.
 */
export function findModelInDb(
    id: string,
    db: Record<string, any>
): [string | null, any | null] {
    // Exact match
    if (db[id]) return [id, db[id]];

    // Suffix match: e.g. 'qwen-max' matches 'dashscope/qwen-max'
    const suffixKey = Object.keys(db).find(k => k.endsWith('/' + id));
    if (suffixKey) return [suffixKey, db[suffixKey]];

    // Contains match (less precise)
    const fuzzyKey = Object.keys(db).find(k => k.includes(id));
    if (fuzzyKey) return [fuzzyKey, db[fuzzyKey]];

    return [null, null];
}

/**
 * Build a ModelMetadata from a raw database entry.
 */
function buildMetaFromInfo(id: string, info: any, displayName?: string): ModelMetadata {
    let type: ModelMetadata['type'] = 'unknown';
    if (info.mode === 'chat' || info.mode === 'completion') type = 'chat';
    else if (info.mode === 'embedding') type = 'embedding';
    else if (info.mode === 'audio_transcription' || info.mode === 'audio_speech') type = 'audio';
    else if (info.mode === 'image_generation') type = 'image';
    else if (info.mode === 'rerank') type = 'rerank';

    return {
        id,
        display_name: displayName,
        type,
        context_length: info.max_input_tokens || info.max_tokens,
        multimodal: info.supports_vision || info.supports_audio_input || false,
        supports_vision: info.supports_vision || false,
        supports_audio_input: info.supports_audio_input || false,
        supports_audio_output: info.supports_audio_output || false,
        supports_function_calling: info.supports_function_calling || false,
        supports_reasoning: info.supports_reasoning || false,
        supports_web_search: info.supports_web_search || false,
        custom: false,
        raw_info: info
    };
}

/**
 * Resolve a model ID against the database, returning full metadata.
 */
export function resolveModelMeta(
    id: string,
    db: Record<string, any>,
    existingDisplayName?: string
): ModelMetadata {
    const [, info] = findModelInDb(id, db);

    if (info) {
        return buildMetaFromInfo(id, info, existingDisplayName);
    }

    return {
        id,
        display_name: existingDisplayName,
        type: 'unknown',
        custom: true
    };
}

/**
 * Apply a raw database entry (chosen by user or from search) to a model.
 */
export function applyDbEntryToModel(
    id: string,
    dbEntry: any,
    displayName?: string
): ModelMetadata {
    return buildMetaFromInfo(id, dbEntry, displayName);
}

/**
 * Search the model database with fuzzy multi-word matching.
 * Spaces act as AND operators (like a search engine).
 * e.g. "gpt 4o" matches "gpt-4o", "openai/gpt-4o-mini", etc.
 */
export function searchModelDb(
    db: Record<string, any>,
    query: string,
    maxResults = 50
): [string, any][] {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return [];
    const results: [string, any][] = [];
    for (const key of Object.keys(db)) {
        if (key === 'sample_spec') continue;
        const lk = key.toLowerCase();
        if (terms.every(term => lk.includes(term))) {
            results.push([key, db[key]]);
            if (results.length >= maxResults) break;
        }
    }
    return results;
}
