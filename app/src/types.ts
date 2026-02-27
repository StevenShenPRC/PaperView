export interface Paper {
    id: number;
    website: string;
    journalName: string;
    issueVolume: string;
    issueDate: string;
    /** Publication Date or Import Date */
    date?: string;
    title: string;
    doi: string;
    abstract: string;
    title_cn?: string;
    abstract_cn?: string;
    local_path?: string;
    pdfs: PaperPdf[];
    groups?: number[];
    tags?: string[];
}

export interface Group {
    id: number;
    name: string;
    created_at: string;
}


export interface PaperPdf {
    id: number;
    paper_id: number;
    filename: string;
    display_name: string;
    added_time: string;
}

export interface Batch {
    id: number;
    website: string;
    journalName: string;
    issueVolume: string;
    issueDate: string;
    latest_time: string;
}

export interface AiProvider {
    name: string;
    base_url: string;
    api_key: string;
    models: string[];
    default_model?: string;
    embedding_model?: string;
    embedding_dimensions?: number;
    additional_headers?: Record<string, string>;
}

export interface AppSettings {
    proxy_mode: 'none' | 'system' | 'custom';
    proxy_url?: string;
    ai_providers: AiProvider[];
    active_ai_provider?: string;
    server_port?: number;
    theme_mode: 'light' | 'dark' | 'system';
    translation_target_lang?: string;
    translation_prompt?: string;
    translation_timeout?: number;
    batch_translate_merge?: boolean;
    batch_translate_size?: number;
}

export interface ChatMessage {
    id?: number;
    session_id: string;
    role: 'user' | 'assistant' | 'system';
    content: any; // JSONB
    context_items?: ContextItem[];
    created_at: string;
}

export interface ChatSession {
    id: string;
    title: string;
    model: string;
    metadata?: any;
    created_at: string;
}

export interface SearchResult {
    message_id: number;
    session_id: string;
    role: string;
    distance: number;
    content: any;
    created_at: string;
}

export interface HistorySearchResults {
    rag: SearchResult[];
    fts: SearchResult[];
}

export interface ContextItem {
    id: string;
    text: string;
    source: string; // e.g., "filename.pdf" or "Paper Title"
    label: string;  // e.g., "Abstract", "Selection", "Title"
}

export interface PendingContext {
    items: ContextItem[];
    mode: 'new' | 'append';
}

export interface SnackbarMessage {
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
}
