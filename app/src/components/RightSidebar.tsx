import React, { useState, useEffect, useRef } from 'react';
import {
    Drawer, Typography, Box, TextField, Button, Divider, IconButton,
    CircularProgress, Tooltip, Select, MenuItem, FormControl,
    List, ListItem, ListItemText, ListItemButton, Popover, Menu
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import DeleteIcon from '@mui/icons-material/Delete';
import CopyIcon from '@mui/icons-material/ContentCopy';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
// import rehypeKatex from 'rehype-katex'; // Removed in favor of custom component
// import 'katex/dist/katex.min.css'; // Removed, using CDN in index.html for font fix
import InteractiveMath from './InteractiveMath';
import CodeBlock from './CodeBlock';
// @ts-ignore
import removeMd from 'remove-markdown';
import store from '../store';
// import { v4 as uuidv4 } from 'uuid'; 

const DEFAULT_WIDTH = 350;
const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const COLLAPSED_WIDTH = 60;

import { ChatMessage, ChatSession, SearchResult, HistorySearchResults } from '../types';

interface RightSidebarProps {
    hasCollapsedPdf?: boolean;
    onExpandReader?: () => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ hasCollapsedPdf = false, onExpandReader }) => {
    const { t } = useTranslation();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Sidebar State
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const [isResizing, setIsResizing] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    // History State
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [historyAnchorEl, setHistoryAnchorEl] = useState<HTMLButtonElement | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Refs for streaming management to avoid closure staleness
    const currentSessionIdRef = useRef<string | null>(null);
    const streamingContentRef = useRef<string>("");

    // Search State
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<HistorySearchResults | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        currentSessionIdRef.current = currentSessionId;
    }, [currentSessionId]);


    // Model Selection State
    const [selectedModel, setSelectedModel] = useState('');
    const [defaultModel, setDefaultModel] = useState('gpt-3.5-turbo');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [activeProviderName, setActiveProviderName] = useState<string | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Resize Handlers
    const startResizing = (mouseDownEvent: React.MouseEvent) => {
        mouseDownEvent.preventDefault();
        setIsResizing(true);
    };

    useEffect(() => {
        const stopResizing = () => setIsResizing(false);
        const resize = (mouseMoveEvent: MouseEvent) => {
            if (isResizing) {
                // Determine new width based on window width - mouse X
                // RightSidebar is on the right, so width = window.innerWidth - mouseX
                const newWidth = window.innerWidth - mouseMoveEvent.clientX;
                if (newWidth > MIN_WIDTH && newWidth < MAX_WIDTH) {
                    setWidth(newWidth);
                }
            }
        };

        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        }

        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing]);

    // Helper for date formatting
    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString(undefined, {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }


    // Load Provider Settings Helper
    const loadProviderSettings = async () => {
        try {
            let defaultModelToUse = 'gpt-3.5-turbo';
            const active = await store.get<string>('active_ai_provider');
            const providers = await store.get<any[]>('ai_providers');

            setActiveProviderName(active || null);

            let models: string[] = [];
            if (active && providers) {
                const provider = providers.find((p: any) => p.name === active);
                if (provider) {
                    models = provider.models || [];
                    if (provider.default_model) {
                        defaultModelToUse = provider.default_model;
                    } else if (models.length > 0) {
                        defaultModelToUse = models[0];
                    }
                }
            }
            setAvailableModels(models);
            setDefaultModel(defaultModelToUse);
            return defaultModelToUse;
        } catch (err) {
            console.error("Failed to load provider info", err);
            return 'gpt-3.5-turbo';
        }
    };

    // Monitor Settings Changes
    useEffect(() => {
        let unlistenFn: (() => void) | undefined;

        const setupListeners = async () => {
            const u1 = await store.onKeyChange('active_ai_provider', async () => {
                await loadProviderSettings();
            });
            const u2 = await store.onKeyChange('ai_providers', async () => {
                await loadProviderSettings();
            });

            unlistenFn = () => {
                u1();
                u2();
            };
        };

        setupListeners();

        return () => {
            if (unlistenFn) unlistenFn();
        };
    }, []);

    // --- Session Management ---

    // Load sessions from DB (and migrate if needed)
    useEffect(() => {
        const initializeChat = async () => {
            try {
                // 1. Load Settings
                const defaultModelToUse = await loadProviderSettings();

                if (!selectedModel) {
                    setSelectedModel(defaultModelToUse);
                }

                // 2. Migration Check
                const storedHistory = await store.get<any[]>('chat_history');
                if (storedHistory && Array.isArray(storedHistory) && storedHistory.length > 0) {
                    // Perform Migration
                    console.log("Migrating chat history to DB...", storedHistory.length);
                    for (const s of storedHistory.slice().reverse()) { // Newest first usually in UI, but DB insert order... 
                        // Check if session exists? Just insert. 
                        // But we want to keep ID? Rust generates UUID. 
                        // If we want to keep ID, we need `create_chat_session_with_id` or just create new.
                        // Let's create new for simplicity and fresh start text, or strict migration?
                        // Plan didn't specify strict ID retention. keeping content is key.
                        try {
                            const newId = await invoke<string>('create_chat_session', {
                                title: s.title || 'Migrated Chat',
                                model: s.model || 'gpt-3.5-turbo'
                            });

                            if (s.messages && Array.isArray(s.messages)) {
                                for (const m of s.messages) {
                                    let content = m.content;
                                    // Handle legacy structure?
                                    await invoke('create_chat_message', {
                                        sessionId: newId,
                                        role: m.role,
                                        content: { text: content } // Store as JSON object
                                    });
                                }
                            }
                        } catch (migErr) {
                            console.error("Failed to migrate session", s.id, migErr);
                        }
                    }
                    // Clear old history
                    await store.set('chat_history', null);
                    await store.save();
                    console.log("Migration complete.");
                }

                // 3. Load from DB
                await loadSessionsFromDb();

            } catch (e) {
                console.error("Failed to initialize chat", e);
            }
        };

        initializeChat();
    }, []);

    const loadSessionsFromDb = async () => {
        try {
            const sessionsFromDb = await invoke<ChatSession[]>('get_chat_sessions');
            setSessions(sessionsFromDb);

            // If we have sessions, select the first one? Or start new if empty?
            if (sessionsFromDb.length > 0) {
                // Don't auto-select to avoid flashing? 
                // Maybe just let user pick or auto-pick first.
                // switchSession(sessionsFromDb[0]); // This might trigger message load
            } else {
                startNewChat();
            }
        } catch (e) {
            console.error("Failed to load sessions", e);
        }
    }

    // Effect to monitor selected session and load messages
    useEffect(() => {
        if (currentSessionId) {
            loadMessages(currentSessionId);
        } else {
            setMessages([]);
        }
    }, [currentSessionId]);

    const loadMessages = async (sessionId: string) => {
        try {
            const msgs = await invoke<ChatMessage[]>('get_chat_messages', { sessionId });
            // content is JSONB, we need to extract text for UI or handle object
            // UI expects ChatMessage with content: string? 
            // Wait, UI code uses `msg.content`. If it's an object now, we need to adapt.
            // Let's adapt local state to string or update UI to handle object.
            // Updating UI to handle object is better (supports attachments later).
            // But for now, let's map it to string for ReactMarkdown.
            const uiMsgs = msgs.map(m => ({
                ...m,
                content: typeof m.content === 'string' ? m.content : (m.content.text || JSON.stringify(m.content))
            }));
            setMessages(uiMsgs);
        } catch (e) {
            console.error("Failed to load messages", e);
        }
    };

    // START NEW CHAT
    const startNewChat = async (modelOverride?: string) => {
        // Use default model for new chats unless overridden, don't stick to previously selected if it was from another session
        const modelToUse = modelOverride || defaultModel || 'gpt-3.5-turbo';
        try {
            // Check if latest session is empty
            if (sessions.length > 0) {
                const latestSession = sessions[0]; // Assuming sorted desc by created_at
                const msgs = await invoke<ChatMessage[]>('get_chat_messages', { sessionId: latestSession.id });
                if (msgs.length === 0) {
                    // Reuse this session
                    setCurrentSessionId(latestSession.id);
                    setMessages([]);
                    // Update model if different
                    if (latestSession.model !== modelToUse) {
                        await invoke('update_chat_session', { id: latestSession.id, model: modelToUse });
                        // Update local list
                        setSessions(prev => prev.map(s => s.id === latestSession.id ? { ...s, model: modelToUse } : s));
                    }
                    setSelectedModel(modelToUse);
                    return;
                }
            }

            const newId = await invoke<string>('create_chat_session', {
                title: t('app.new_chat'),
                model: modelToUse
            });
            await loadSessionsFromDb(); // Refresh list
            setCurrentSessionId(newId);
            setMessages([]);
            // Update UI to show the model we just used
            setSelectedModel(modelToUse);
        } catch (e) {
            console.error("Failed to create session", e);
        }
    };

    const switchSession = (session: ChatSession) => {
        setCurrentSessionId(session.id);
        // Use session model, or fallback to default if missing (migration/legacy case)
        setSelectedModel(session.model || defaultModel);
        setHistoryAnchorEl(null);
    };

    const deleteSession = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await invoke('delete_chat_session', { id });
            setSessions(prev => prev.filter(s => s.id !== id));
            if (currentSessionId === id) {
                setCurrentSessionId(null);
                setMessages([]);
                // Optionally select next
            }
        } catch (err) {
            console.error("Failed to delete", err);
        }
    };

    // Auto-update title logic? 
    // Maybe we simple update title in DB when first message is sent?
    // Or just update local state and DB?

    const updateCurrentSessionModel = async (model: string) => {
        setSelectedModel(model);
        if (currentSessionId) {
            await invoke('update_chat_session', { id: currentSessionId, model });
            setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, model } : s));
        }
    };


    // Unified initialization above replaces this individual effect
    // keeping empty or removing it. Removing it to avoid double loading.
    // However, listen to settings change might be needed later.
    /*
    useEffect(() => {
        const loadProviderInfo = async () => {
             // ... moved to init ...
        };
        loadProviderInfo();
    }, []); 
    */

    useEffect(() => {
        let unlistenHandlers: UnlistenFn[] = [];
        let isMounted = true;

        const setupListeners = async () => {
            const h1 = await listen<string>('ai-response-chunk', (event) => {
                streamingContentRef.current += event.payload;

                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                        const newGlobal = [...prev];
                        newGlobal[newGlobal.length - 1] = {
                            ...lastMsg,
                            content: streamingContentRef.current
                        };
                        return newGlobal;
                    } else {
                        // This path likely won't be hit if we add placeholder first, but safely:
                        return [...prev, {
                            role: 'assistant',
                            content: event.payload,
                            session_id: currentSessionIdRef.current || "",
                            created_at: new Date().toISOString()
                        }];
                    }
                });
            });

            if (!isMounted) {
                h1();
                return;
            }
            unlistenHandlers.push(h1);

            const h2 = await listen('ai-response-done', async () => {
                setIsLoading(false);
                const fullContent = streamingContentRef.current;
                const sessionId = currentSessionIdRef.current;

                if (sessionId && fullContent) {
                    try {
                        await invoke('create_chat_message', {
                            sessionId: sessionId,
                            role: 'assistant',
                            content: { text: fullContent }
                        });
                        console.log("Assistant message saved to DB");
                    } catch (e) {
                        console.error("Failed to save assistant message", e);
                    }
                }
                streamingContentRef.current = ""; // Reset
            });

            if (!isMounted) {
                h2();
                return;
            }
            unlistenHandlers.push(h2);
        };

        setupListeners();

        return () => {
            isMounted = false;
            unlistenHandlers.forEach(fn => fn());
        };
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading || !currentSessionId) return; // Ensure session ID

        const userMsg: ChatMessage = { role: 'user', content: input, session_id: currentSessionId, created_at: new Date().toISOString() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);
        streamingContentRef.current = ""; // Reset for new response

        // Save User Message to DB
        invoke('create_chat_message', {
            sessionId: currentSessionId,
            role: 'user',
            content: { text: input }
        }).catch(e => console.error("Failed to save user msg", e));

        // Add empty assistant message to start with
        const assistantPlaceholder: ChatMessage = { role: 'assistant', content: '', session_id: currentSessionId, created_at: new Date().toISOString() };
        setMessages(prev => [...prev, assistantPlaceholder]);

        // We need to pass valid messages to backend for context. 
        // Backend `chat_command` expects generic message objects. We map our `ChatMessage` to what it expects?
        // `chat_command` defines `ChatMessage` struct in `ai.rs` or `main.rs`? 
        // `ai.rs` has `ChatMessage { role: String, content: String }`.
        // Our updated `ChatMessage` has `content: any`. We need to normalize.
        const contextMessages = newMessages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : (m.content.text || "")
        }));

        try {
            // Use local state activeProvider and selectedModel if available
            let providerToUse = activeProviderName;
            let modelToUse = selectedModel;

            if (!providerToUse) {
                providerToUse = await store.get<string>('active_ai_provider') || "";
            }
            if (!modelToUse) {
                modelToUse = "gpt-3.5-turbo";
            }

            await invoke('chat_command', {
                messages: contextMessages,
                model: modelToUse,
                providerName: providerToUse || ""
            });

            // Note: chat_command streams response. 
            // We need to save the FINAL assistant message to DB when done.
            // The `ai-response-done` event is handled. 
            // BUT `chat_command` doesn't return the full string. 
            // We can save in `ai-response-done` or track it. 
            // Better: update the DB with the full content in `ai-response-done` listener?
            // OR `chat_command` could return the full text? It currently returns `Result<(), String>`.
            // Let's use a ref or state to track current streaming content and save on done.
        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => [...prev, { role: 'system', content: `Error: ${error}`, session_id: currentSessionId, created_at: new Date().toISOString() }]);
            setIsLoading(false);
        }
    };


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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // --- Copy Logic ---
    const [copyAnchorEl, setCopyAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedCopyContent, setSelectedCopyContent] = useState('');
    const [copyFormatAnchorEl, setCopyFormatAnchorEl] = useState<null | HTMLElement>(null);
    const [defaultCopyFormat, setDefaultCopyFormat] = useState<'text' | 'markdown'>('text');

    // Load default copy format
    useEffect(() => {
        store.get<string>('default_copy_format').then(fmt => {
            if (fmt === 'text' || fmt === 'markdown') {
                setDefaultCopyFormat(fmt);
            }
        });
    }, []);

    const handleCopyClick = (e: React.MouseEvent<HTMLElement>, content: string) => {
        e.preventDefault();
        // If left click, just copy with default format
        if (e.button === 0) {
            handleCopyAction(content, defaultCopyFormat);
        }
    };

    const handleCopyContextMenu = (e: React.MouseEvent<HTMLElement>, content: string) => {
        e.preventDefault();
        setSelectedCopyContent(content);
        setCopyAnchorEl(e.currentTarget);
    };

    const handleCopyAction = (content: string, format: 'text' | 'markdown') => {
        let textToCopy = content;
        // If markdown requested, content is already markdown. 
        if (format === 'text') {
            try {
                textToCopy = removeMd(content);
            } catch (e) {
                console.error("Failed to strip markdown", e);
                // Fallback to simple replace
                textToCopy = content.replace(/[#*`]/g, '');
            }
        }

        navigator.clipboard.writeText(textToCopy);
        setCopyAnchorEl(null);
    };

    const saveDefaultCopyFormat = (format: 'text' | 'markdown') => {
        setDefaultCopyFormat(format);
        store.set('default_copy_format', format).then(() => store.save());
        setCopyFormatAnchorEl(null);
        setCopyAnchorEl(null);
    };

    return (
        <Drawer
            variant="permanent"
            anchor="right"
            sx={{
                width: collapsed ? COLLAPSED_WIDTH : width,
                flexShrink: 0,
                transition: isResizing ? 'none' : 'width 0.3s',
                [`& .MuiDrawer-paper`]: {
                    width: collapsed ? COLLAPSED_WIDTH : width,
                    boxSizing: 'border-box',
                    transition: isResizing ? 'none' : 'width 0.3s',
                    overflowX: 'hidden'
                },
            }}
        >
            {/* Resize Handle (Left) */}
            {!collapsed && (
                <Box
                    onMouseDown={startResizing}
                    sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '4px',
                        cursor: 'ew-resize',
                        zIndex: 100,
                        '&:hover': {
                            bgcolor: 'primary.main'
                        }
                    }}
                />
            )}

            {/* Padding reduced from 2 to 1 (or 0.5) as requested */}
            <Box sx={{ p: collapsed ? 0.5 : 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center', mb: 1 }}>
                    {!collapsed ? (
                        <>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Tooltip title={t('app.history')}>
                                    <IconButton onClick={(e) => setHistoryAnchorEl(e.currentTarget)} size="small" sx={{ mr: 1 }}>
                                        <HistoryIcon />
                                    </IconButton>
                                </Tooltip>
                                <Typography variant="h6" noWrap>
                                    {t('app.ai_assistant')}
                                </Typography>
                            </Box>
                            <Box>
                                <Tooltip title={t('app.search') || "Search"}>
                                    <IconButton onClick={() => setShowSearch(!showSearch)} size="small" color={showSearch ? "primary" : "default"}>
                                        <SearchIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title={t('app.new_chat')}>
                                    <IconButton onClick={() => startNewChat()} size="small">
                                        <AddIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title={t('app.collapse')}>
                                    <IconButton onClick={() => setCollapsed(true)} size="small">
                                        <ChevronRightIcon />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </>
                    ) : (
                        <Tooltip title={t('app.expand')}>
                            <IconButton onClick={() => setCollapsed(false)}>
                                <AutoAwesomeIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>

                {/* Collapsed View: Show minimal/nothing or just expand button above */}
                {collapsed ? (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 2 }}>
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
                        {/* History Popover */}
                        <Popover
                            open={Boolean(historyAnchorEl)}
                            anchorEl={historyAnchorEl}
                            onClose={() => setHistoryAnchorEl(null)}
                            anchorOrigin={{
                                vertical: 'bottom',
                                horizontal: 'left',
                            }}
                        >
                            <List sx={{ width: 250, maxHeight: 300, overflow: 'auto' }}>
                                {sessions.map(s => (
                                    <ListItem
                                        key={s.id}
                                        disablePadding
                                        secondaryAction={
                                            <Tooltip title={t('app.delete')}>
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

                        {/* Model Selector */}
                        {activeProviderName && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                                <Typography variant="body2" sx={{ whiteSpace: 'nowrap', minWidth: 'fit-content' }}>
                                    {t('settings.models') || "Model"}:
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <Select
                                        value={selectedModel}
                                        onChange={(e) => updateCurrentSessionModel(e.target.value)}
                                        displayEmpty
                                        renderValue={(selected) => {
                                            if (selected.length === 0) {
                                                return <em>{t('app.select_model') || "Select Model"}</em>;
                                            }
                                            return selected;
                                        }}
                                    >
                                        <MenuItem disabled value="">
                                            <em>{t('app.select_model') || "Select Model"}</em>
                                        </MenuItem>
                                        {availableModels.map((m) => (
                                            <MenuItem key={m} value={m}>{m}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>
                        )}

                        <Divider sx={{ mb: 2 }} />

                        {showSearch ? (
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
                                    {/* RAG Results */}
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
                                                            secondary={
                                                                typeof res.content === 'string'
                                                                    ? res.content.slice(0, 100) + "..."
                                                                    : (res.content.text || "").slice(0, 100) + "..."
                                                            }
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

                                    {/* FTS Results */}
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
                                                            secondary={
                                                                typeof res.content === 'string'
                                                                    ? res.content.slice(0, 100) + "..."
                                                                    : (res.content.text || "").slice(0, 100) + "..."
                                                            }
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
                        ) : (
                            <>

                                <style>{`
                            @keyframes fadeIn {
                                from { opacity: 0; transform: translateY(5px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                            .message-fade-in {
                                animation: fadeIn 0.3s ease-out forwards;
                            }
                        `}</style>

                                {/* Messages Area */}
                                <Box sx={{
                                    flex: 1,
                                    bgcolor: 'action.hover',
                                    mb: 2,
                                    borderRadius: 1,
                                    px: 1, // Reduced padding
                                    py: 2,
                                    overflowY: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2 // Increased gap for sticky overlap safety
                                }} ref={messagesContainerRef}>
                                    {messages.length === 0 && (
                                        <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 4 }}>
                                            {t('app.hello_message')}
                                        </Typography>
                                    )}

                                    {messages.map((msg, index) => {
                                        const isUser = msg.role === 'user';
                                        return (
                                            <Box key={index}
                                                className={index === messages.length - 1 && !isUser ? 'message-fade-in' : ''}
                                                sx={{
                                                    alignSelf: isUser ? 'flex-end' : 'stretch', // Stretch for AI
                                                    maxWidth: isUser ? '90%' : '100%', // Full width for AI
                                                    width: isUser ? 'auto' : '100%',
                                                    display: 'flex',
                                                    flexDirection: 'column', // Stack divider/content
                                                    position: 'relative',
                                                    my: isUser ? 1 : 0
                                                }}>

                                                {/* Top Divider for Assistant */}
                                                {!isUser && (
                                                    <Divider sx={{ my: 1, borderColor: 'divider', opacity: 1 }} />
                                                )}


                                                <Box sx={{
                                                    display: 'flex',
                                                    flexDirection: 'row',
                                                    width: '100%', // Ensure row takes full width
                                                    position: 'relative'
                                                }}>
                                                    {/* Sticky Copy Button Wrapper */}
                                                    <Box sx={{
                                                        position: 'sticky',
                                                        top: 0,
                                                        height: 0,
                                                        zIndex: 10,
                                                        order: isUser ? 0 : 1,
                                                        // Adjusted transform logic
                                                        transform: isUser
                                                            ? 'translateX(-32px)'
                                                            : 'translateX(0)', // For AI, we might want it inside or right aligned
                                                        right: isUser ? 'auto' : 0, // Align right for AI inside the relative container
                                                        left: isUser ? 0 : 'auto',
                                                        display: 'flex',
                                                        justifyContent: 'flex-end',
                                                        width: isUser ? 'auto' : 0, // CRITICAL FIX: 0 width for AI to prevent flex split
                                                        flexShrink: 0, // Prevent shrinking
                                                        pointerEvents: 'none', // Don't block clicks on text
                                                        overflow: 'visible' // Ensure button is visible even with 0 width
                                                    }}>
                                                        {/* For AI: Float button to right? */}
                                                        <Box sx={{
                                                            pt: 1,
                                                            ...(!isUser && {
                                                                position: 'absolute',
                                                                right: 0,
                                                                top: 0
                                                            }),
                                                            pointerEvents: 'auto' // Re-enable clicks
                                                        }}>
                                                            <Tooltip title={t('app.copy')}>
                                                                <IconButton
                                                                    size="small"
                                                                    sx={{
                                                                        bgcolor: isUser ? 'primary.light' : 'background.paper', // Match bubble bg roughly
                                                                        color: isUser ? 'primary.contrastText' : 'text.primary',
                                                                        boxShadow: 1,
                                                                        opacity: 0.6, // Higher base opacity
                                                                        '&:hover': { opacity: 1 },
                                                                        transition: 'opacity 0.2s'
                                                                    }}
                                                                    onClick={(e) => handleCopyClick(e, msg.content)}
                                                                    onContextMenu={(e) => handleCopyContextMenu(e, msg.content)}
                                                                >
                                                                    <CopyIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    </Box>

                                                    {/* Message Content */}
                                                    <Box sx={{
                                                        bgcolor: isUser ? 'primary.light' : 'transparent', // No bg for AI
                                                        color: isUser ? 'primary.contrastText' : 'text.primary',
                                                        p: isUser ? 1.5 : 0.5, // Less padding for AI text
                                                        borderRadius: isUser ? 2 : 0,
                                                        boxShadow: isUser ? 1 : 0,
                                                        order: isUser ? 1 : 0,
                                                        width: isUser ? 'auto' : '100%', // Full width for AI, auto for user
                                                        maxWidth: isUser ? '90%' : '100%', // User constrained
                                                        flexGrow: isUser ? 0 : 1, // AI grows to fill
                                                        overflow: 'hidden' // Ensure code blocks don't overflow
                                                    }}>
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkMath]}
                                                            remarkRehypeOptions={{
                                                                handlers: {
                                                                    math: (_state, node) => {
                                                                        return {
                                                                            type: 'element',
                                                                            tagName: 'interactive-math',
                                                                            properties: {
                                                                                latex: node.value,
                                                                                block: true
                                                                            },
                                                                            children: []
                                                                        };
                                                                    },
                                                                    inlineMath: (_state, node) => {
                                                                        return {
                                                                            type: 'element',
                                                                            tagName: 'interactive-math',
                                                                            properties: {
                                                                                latex: node.value,
                                                                                block: false
                                                                            },
                                                                            children: []
                                                                        };
                                                                    }
                                                                }
                                                            }}
                                                            components={{
                                                                // @ts-ignore
                                                                'interactive-math': ({ node, ...props }: any) => <InteractiveMath latex={props.latex} block={props.block} />,
                                                                p: ({ node, ...props }) => <Typography variant="body2" sx={{ wordBreak: "break-word" }} {...props} />,
                                                                code: ({ node, className, children, ...props }: any) => (
                                                                    <CodeBlock className={className} inline={props.inline} {...props}>
                                                                        {children}
                                                                    </CodeBlock>
                                                                )
                                                            }}
                                                        >
                                                            {msg.content}
                                                        </ReactMarkdown>
                                                    </Box>
                                                </Box>

                                                {!isUser && (
                                                    <Divider sx={{ my: 1, borderColor: 'divider', opacity: 1 }} />
                                                )}

                                            </Box>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </Box>
                            </>
                        )}

                        {/* Copy Format Menu */}
                        <Menu
                            anchorEl={copyAnchorEl}
                            open={Boolean(copyAnchorEl)}
                            onClose={() => setCopyAnchorEl(null)}
                        >
                            <MenuItem onClick={() => handleCopyAction(selectedCopyContent, 'text')}>{t('app.copy_text') || "Copy Text"}</MenuItem>
                            <MenuItem onClick={() => handleCopyAction(selectedCopyContent, 'markdown')}>{t('app.copy_markdown') || "Copy Markdown"}</MenuItem>
                            <Divider />
                            <MenuItem onClick={(e) => setCopyFormatAnchorEl(e.currentTarget)}>{t('app.set_default_format') || "Set Default Format"}</MenuItem>
                        </Menu>

                        <Menu
                            anchorEl={copyFormatAnchorEl}
                            open={Boolean(copyFormatAnchorEl)}
                            onClose={() => setCopyFormatAnchorEl(null)}
                        >
                            <MenuItem selected={defaultCopyFormat === 'text'} onClick={() => saveDefaultCopyFormat('text')}>{t('app.format_text') || "Text"}</MenuItem>
                            <MenuItem selected={defaultCopyFormat === 'markdown'} onClick={() => saveDefaultCopyFormat('markdown')}>Markdown</MenuItem>
                        </Menu>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <TextField
                                size="small"
                                fullWidth
                                placeholder={t('app.ask_placeholder')}
                                variant="outlined"
                                multiline
                                maxRows={4}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                            />
                            <Button
                                variant="contained"
                                size="small"
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                            >
                                {isLoading ? <CircularProgress size={24} /> : <SendIcon />}
                            </Button>
                        </Box>
                    </>
                )}
            </Box>
        </Drawer>
    );
};

export default RightSidebar;
