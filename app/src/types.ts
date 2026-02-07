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
