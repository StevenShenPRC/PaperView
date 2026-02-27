import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SearchResult, HistorySearchResults, ChatSession } from '../../../types';

export function useChatSearch(
    sessions: ChatSession[],
    currentSessionId: string | null,
    switchSession: (session: ChatSession) => void,
    setCurrentSessionId: (id: string) => void
) {
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<HistorySearchResults | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const results = await invoke<HistorySearchResults>('search_history', { query: searchQuery });
            setSearchResults(results);
        } catch (e) {
            console.error("Search failed", e);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchResultClick = async (result: SearchResult) => {
        if (result.session_id !== currentSessionId) {
            const session = sessions.find(s => s.id === result.session_id);
            if (session) {
                switchSession(session);
            } else {
                setCurrentSessionId(result.session_id);
            }
        }
        setShowSearch(false);
    };

    return {
        showSearch, setShowSearch, searchQuery, setSearchQuery,
        searchResults, setSearchResults, isSearching,
        handleSearch, handleSearchResultClick
    };
}
