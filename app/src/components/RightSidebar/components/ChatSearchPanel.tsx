import React from 'react';
import { Box, TextField, IconButton, CircularProgress, List, ListItem, ListItemButton, ListItemText, Typography, Divider } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { SearchResult, HistorySearchResults } from '../../../types';

interface ChatSearchPanelProps {
    t: any;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    handleSearch: () => void;
    isSearching: boolean;
    searchResults: HistorySearchResults | null;
    handleSearchResultClick: (r: SearchResult) => void;
}

export const ChatSearchPanel: React.FC<ChatSearchPanelProps> = ({
    t, searchQuery, setSearchQuery, handleSearch, isSearching, searchResults, handleSearchResultClick
}) => {
    return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', px: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder={t('app.search_placeholder') || "Search history..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <IconButton onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? <CircularProgress size={24} /> : <SearchIcon />}
                </IconButton>
            </Box>
            <List sx={{ flex: 1, overflowY: 'auto' }}>
                {searchResults && searchResults.rag.length > 0 && (
                    <>
                        <Typography variant="overline" sx={{ px: 2, color: 'primary.main', fontWeight: 'bold' }}>
                            {t('app.semantic_search') || "Semantic Search (RAG)"}
                        </Typography>
                        {searchResults.rag.map((res) => (
                            <ListItem key={`rag-${res.message_id}`} disablePadding>
                                <ListItemButton onClick={() => handleSearchResultClick(res)} alignItems="flex-start">
                                    <ListItemText
                                        primary={res.role === 'user' ? "User" : "AI"}
                                        primaryTypographyProps={{ variant: 'subtitle2', color: 'text.secondary' }}
                                        secondary={typeof res.content === 'string' ? res.content.slice(0, 100) + "..." : (res.content.text || "").slice(0, 100) + "..."}
                                        secondaryTypographyProps={{
                                            variant: 'body2',
                                            color: 'text.primary',
                                            style: { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                        <Divider sx={{ my: 1 }} />
                    </>
                )}
                {searchResults && searchResults.fts.length > 0 && (
                    <>
                        <Typography variant="overline" sx={{ px: 2, color: 'secondary.main', fontWeight: 'bold' }}>
                            {t('app.fulltext_search') || "Full-text Search (FTS)"}
                        </Typography>
                        {searchResults.fts.map((res) => (
                            <ListItem key={`fts-${res.message_id}`} disablePadding>
                                <ListItemButton onClick={() => handleSearchResultClick(res)} alignItems="flex-start">
                                    <ListItemText
                                        primary={res.role === 'user' ? "User" : "AI"}
                                        primaryTypographyProps={{ variant: 'subtitle2', color: 'text.secondary' }}
                                        secondary={typeof res.content === 'string' ? res.content.slice(0, 100) + "..." : (res.content.text || "").slice(0, 100) + "..."}
                                        secondaryTypographyProps={{
                                            variant: 'body2',
                                            color: 'text.primary',
                                            style: { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </>
                )}
                {searchResults && searchResults.rag.length === 0 && searchResults.fts.length === 0 && !isSearching && searchQuery && (
                    <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 2 }}>
                        {t('app.no_results') || "No results found"}
                    </Typography>
                )}
            </List>
        </Box>
    );
};
