export interface Paper {
    id: number;
    website: string;
    journalName: string;
    issueVolume: string;
    issueDate: string;
    title: string;
    doi: string;
    abstract: string;
    title_cn?: string;
    abstract_cn?: string;
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
    additional_headers?: Record<string, string>;
}

export interface AppSettings {
    proxy_mode: 'none' | 'system' | 'custom';
    proxy_url?: string;
    ai_providers: AiProvider[];
    active_ai_provider?: string;
    server_port?: number;
    theme_mode: 'light' | 'dark' | 'system';
}
