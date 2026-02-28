import React from 'react';
import { Box, Typography, Tooltip, IconButton, Popover, List, ListItem, ListItemButton, ListItemText, Divider, FormControl, Select, MenuItem } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import DeleteIcon from '@mui/icons-material/Delete';
import { ChatSession } from '../../../types';
import { ChatModelOption } from '../hooks/useChat';

interface ChatHeaderProps {
    collapsed: boolean;
    setCollapsed: (c: boolean) => void;
    t: any;
    hasCollapsedPdf: boolean;
    onExpandReader?: () => void;
    historyAnchorEl: HTMLButtonElement | null;
    setHistoryAnchorEl: (el: HTMLButtonElement | null) => void;
    sessions: ChatSession[];
    currentSessionId: string | null;
    switchSession: (s: ChatSession) => void;
    deleteSession: (e: React.MouseEvent, id: string) => void;
    showSearch: boolean;
    setShowSearch: (s: boolean) => void;
    startNewChat: () => void;
    activeProviderName: string | null;
    selectedModel: string;
    availableModels: ChatModelOption[];
    updateCurrentSessionModel: (provider: string, model: string) => void;
    formatDate: (timestamp: number) => string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
    collapsed, setCollapsed, t, hasCollapsedPdf, onExpandReader,
    historyAnchorEl, setHistoryAnchorEl, sessions, currentSessionId, switchSession, deleteSession,
    showSearch, setShowSearch, startNewChat,
    selectedModel, availableModels, updateCurrentSessionModel, formatDate
}) => {
    // Group models: chat/unknown from active provider first, then others
    // Separate typed (chat) from unknown
    const chatModels = availableModels.filter(o => o.model.type === 'chat');
    const unknownModels = availableModels.filter(o => o.model.type === 'unknown');

    // Build the composite value: "provider::model_id"
    const currentValue = selectedModel
        ? availableModels.find(o => o.model.id === selectedModel)
            ? `${availableModels.find(o => o.model.id === selectedModel)!.provider}::${selectedModel}`
            : selectedModel
        : '';

    return (
        <Box sx={{ flexShrink: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center', mb: 1 }}>
                {!collapsed ? (
                    <>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Tooltip title={t('app.history') || 'History'}>
                                <IconButton onClick={(e) => setHistoryAnchorEl(e.currentTarget)} size="small" sx={{ mr: 1 }}>
                                    <HistoryIcon />
                                </IconButton>
                            </Tooltip>
                            <Typography variant="h6" noWrap>
                                {t('app.ai_assistant') || 'AI Assistant'}
                            </Typography>
                        </Box>
                        <Box>
                            <Tooltip title={t('app.search') || "Search"}>
                                <IconButton onClick={() => setShowSearch(!showSearch)} size="small" color={showSearch ? "primary" : "default"}>
                                    <SearchIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={t('app.new_chat') || 'New Chat'}>
                                <IconButton onClick={() => startNewChat()} size="small">
                                    <AddIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={t('app.collapse') || 'Collapse'}>
                                <IconButton onClick={() => setCollapsed(true)} size="small">
                                    <ChevronRightIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </>
                ) : (
                    <Tooltip title={t('app.expand') || 'Expand'}>
                        <IconButton onClick={() => setCollapsed(false)}>
                            <AutoAwesomeIcon />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>

            {collapsed ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 2 }}>
                    {hasCollapsedPdf && onExpandReader && (
                        <Tooltip title={t('app.open_reader') || "Open Reader"}>
                            <IconButton onClick={onExpandReader}>
                                <MenuBookIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            ) : (
                <>
                    <Popover
                        open={Boolean(historyAnchorEl)}
                        anchorEl={historyAnchorEl}
                        onClose={() => setHistoryAnchorEl(null)}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    >
                        <List sx={{ width: 250, maxHeight: 300, overflow: 'auto' }}>
                            {sessions.map(s => (
                                <ListItem
                                    key={s.id}
                                    disablePadding
                                    secondaryAction={
                                        <Tooltip title={t('app.delete') || 'Delete'}>
                                            <IconButton edge="end" aria-label="delete" onClick={(e) => deleteSession(e, s.id)} size="small">
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    }
                                >
                                    <ListItemButton selected={s.id === currentSessionId} onClick={() => switchSession(s)}>
                                        <ListItemText
                                            primary={s.title || 'New Chat'}
                                            primaryTypographyProps={{ noWrap: true, style: { fontSize: '0.9rem' } }}
                                            secondary={formatDate(new Date(s.created_at).getTime())}
                                            secondaryTypographyProps={{ style: { fontSize: '0.7rem' } }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                            {sessions.length === 0 && <ListItem><ListItemText primary={t('app.no_history') || "No history"} /></ListItem>}
                        </List>
                    </Popover>

                    {availableModels.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                            <Typography variant="body2" sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
                                {t('settings.models') || "Model"}:
                            </Typography>
                            <FormControl fullWidth size="small">
                                <Select
                                    value={currentValue}
                                    onChange={(e) => {
                                        const val = e.target.value as string;
                                        if (!val) return;
                                        const sep = val.indexOf('::');
                                        if (sep > 0) {
                                            updateCurrentSessionModel(val.slice(0, sep), val.slice(sep + 2));
                                        }
                                    }}
                                    displayEmpty
                                    renderValue={(selected) => {
                                        if (!selected) return <em>{t('app.select_model') || "Select Model"}</em>;
                                        // Show just the model name in the compact view
                                        const sep = (selected as string).indexOf('::');
                                        if (sep > 0) {
                                            const prov = (selected as string).slice(0, sep);
                                            const mid = (selected as string).slice(sep + 2);
                                            const opt = availableModels.find(o => o.provider === prov && o.model.id === mid);
                                            return opt?.model.display_name || mid;
                                        }
                                        return selected;
                                    }}
                                >
                                    <MenuItem disabled value="">
                                        <em>{t('app.select_model') || "Select Model"}</em>
                                    </MenuItem>
                                    {chatModels.map((o) => (
                                        <MenuItem key={`${o.provider}::${o.model.id}`} value={`${o.provider}::${o.model.id}`}>
                                            <Typography variant="body2" noWrap>
                                                {o.provider} — {o.model.display_name || o.model.id}
                                            </Typography>
                                        </MenuItem>
                                    ))}
                                    {unknownModels.length > 0 && chatModels.length > 0 && <Divider sx={{ my: 0.5 }} />}
                                    {unknownModels.length > 0 && (
                                        <MenuItem disabled sx={{ fontSize: '0.75rem', py: 0.5 }}>
                                            — {t('settings.unclassified_models') || 'Unclassified'} —
                                        </MenuItem>
                                    )}
                                    {unknownModels.map((o) => (
                                        <MenuItem key={`${o.provider}::${o.model.id}`} value={`${o.provider}::${o.model.id}`}>
                                            <Typography variant="body2" noWrap>
                                                {o.provider} — {o.model.display_name || o.model.id}
                                            </Typography>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    )}
                    <Divider sx={{ mb: 2 }} />
                </>
            )}
        </Box>
    );
};
