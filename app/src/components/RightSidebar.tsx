import React, { useState, useEffect, useRef } from 'react';
import {
    Drawer, Typography, Box, TextField, Button, Divider, IconButton,
    CircularProgress, Tooltip, Select, MenuItem, FormControl, InputLabel,
    List, ListItem, ListItemText, ListItemButton, Popover, Menu
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import CopyIcon from '@mui/icons-material/ContentCopy';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'; // For menu maybe
import MoreVertIcon from '@mui/icons-material/MoreVert'; // context menu
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import store from '../store';
// import { v4 as uuidv4 } from 'uuid'; 

const DEFAULT_WIDTH = 350;
const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const COLLAPSED_WIDTH = 60;

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    model: string;
}

const RightSidebar: React.FC = () => {
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


    // Model Selection State
    const [selectedModel, setSelectedModel] = useState('');
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


    // --- Session Management ---

    // Load sessions on mount
    useEffect(() => {
        const loadSessions = async () => {
            try {
                const stored = await store.get<ChatSession[]>('chat_history');
                if (stored && Array.isArray(stored)) {
                    setSessions(stored);
                    // Load last session if available
                    if (stored.length > 0) {
                        const last = stored[0];
                        setCurrentSessionId(last.id);
                        setMessages(last.messages);
                        if (last.model) setSelectedModel(last.model);
                    } else {
                        startNewChat();
                    }
                } else {
                    startNewChat();
                }
            } catch (e) {
                console.error("Failed to load history", e);
                startNewChat();
            }
        };
        loadSessions();
    }, []);

    // Save sessions whenever they change
    useEffect(() => {
        if (sessions.length > 0) {
            store.set('chat_history', sessions).then(() => store.save());
        }
    }, [sessions]);

    // Update current session messages when messages change
    useEffect(() => {
        if (!currentSessionId) return;

        setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
                return {
                    ...s,
                    messages: messages,
                    // Update title based on first message if generic
                    title: s.messages.length === 0 && messages.length > 0
                        ? (messages[0].content.slice(0, 30) + (messages[0].content.length > 30 ? '...' : ''))
                        : s.title
                };
            }
            return s;
        }));
    }, [messages]);

    const startNewChat = () => {
        const newId = crypto.randomUUID();
        const newSession: ChatSession = {
            id: newId,
            title: 'New Chat',
            messages: [],
            createdAt: Date.now(),
            model: selectedModel || 'gpt-3.5-turbo'
        };
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newId);
        setMessages([]);
    };

    const switchSession = (session: ChatSession) => {
        setCurrentSessionId(session.id);
        setMessages(session.messages);
        if (session.model) setSelectedModel(session.model);
        setHistoryAnchorEl(null);
    };

    const deleteSession = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newSessions = sessions.filter(s => s.id !== id);
        setSessions(newSessions);
        store.set('chat_history', newSessions).then(() => store.save());

        if (currentSessionId === id) {
            if (newSessions.length > 0) {
                switchSession(newSessions[0]);
            } else {
                startNewChat();
            }
        }
    };

    const updateCurrentSessionModel = (model: string) => {
        setSelectedModel(model);
        if (currentSessionId) {
            setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, model } : s));
        }
    };


    // Load active provider and models on mount or when sidebar opens
    useEffect(() => {
        const loadProviderInfo = async () => {
            try {
                const active = await store.get<string>('active_ai_provider');
                const providers = await store.get<any[]>('ai_providers');

                setActiveProviderName(active || null);

                if (active && providers) {
                    const provider = providers.find((p: any) => p.name === active);
                    if (provider) {
                        let models: string[] = provider.models || [];
                        setAvailableModels(models);

                        // If selectedModel is not set or not in valid list (optional check), reset it
                        // Prioritize default_model -> first model -> fallback
                        if (!selectedModel) {
                            if (provider.default_model) {
                                setSelectedModel(provider.default_model);
                            } else if (models.length > 0) {
                                setSelectedModel(models[0]);
                            } else {
                                setSelectedModel('gpt-3.5-turbo');
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to load provider info", err);
            }
        };

        loadProviderInfo();

        // Listen for settings changes if needed, but for now just load once or on focus could be good.
        // Simple polling or event listener for settings-changed would be better but let's stick to mount for now.
    }, []); // Empty deps means run once on mount. 

    useEffect(() => {
        let unlistenHandlers: UnlistenFn[] = [];
        let isMounted = true;

        const setupListeners = async () => {
            const h1 = await listen<string>('ai-response-chunk', (event) => {
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                        // Append to last message
                        const newGlobal = [...prev];
                        newGlobal[newGlobal.length - 1] = {
                            ...lastMsg,
                            content: lastMsg.content + event.payload
                        };
                        return newGlobal;
                    } else {
                        // Should not happen if we add empty assistant msg first or if we are just starting
                        // Actually, if it's the very first chunk and we don't have assistant msg (rare race), add it
                        return [...prev, { role: 'assistant', content: event.payload }];
                    }
                });
            });

            if (!isMounted) {
                h1();
                return;
            }
            unlistenHandlers.push(h1);

            const h2 = await listen('ai-response-done', () => {
                setIsLoading(false);
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
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = { role: 'user', content: input };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        // Add empty assistant message to start with
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        try {
            // Use local state activeProvider and selectedModel if available
            // If they are missing (e.g. failed load), try re-fetching or fallback
            let providerToUse = activeProviderName;
            let modelToUse = selectedModel;

            // Re-fetch if missing (safety net)
            if (!providerToUse) {
                providerToUse = await store.get<string>('active_ai_provider') || "";
            }
            if (!modelToUse) {
                modelToUse = "gpt-3.5-turbo";
            }

            await invoke('chat_command', {
                messages: newMessages,
                model: modelToUse,
                providerName: providerToUse || ""
            });
        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => [...prev, { role: 'system', content: `Error: ${error}` }]);
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setMessages([]);
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
            // Placeholder: textToCopy = content.replace(/[#*`]/g, ''); 
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

            <Box sx={{ p: collapsed ? 1 : 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center', mb: 1 }}>
                    {!collapsed ? (
                        <>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <IconButton onClick={(e) => setHistoryAnchorEl(e.currentTarget)} size="small" sx={{ mr: 1 }}>
                                    <HistoryIcon />
                                </IconButton>
                                <Typography variant="h6" noWrap>
                                    {t('app.ai_assistant')}
                                </Typography>
                            </Box>
                            <Box>
                                <Tooltip title="New Chat">
                                    <IconButton onClick={startNewChat} size="small">
                                        <AddIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Collapse">
                                    <IconButton onClick={() => setCollapsed(true)} size="small">
                                        <ChevronRightIcon />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </>
                    ) : (
                        <Tooltip title="Expand">
                            <IconButton onClick={() => setCollapsed(false)}>
                                <HistoryIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>

                {/* Collapsed View: Show minimal/nothing or just expand button above */}
                {collapsed ? (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 2 }}>
                        <IconButton onClick={startNewChat}>
                            <AddIcon />
                        </IconButton>
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
                                            <IconButton edge="end" aria-label="delete" onClick={(e) => deleteSession(e, s.id)} size="small">
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        }
                                    >
                                        <ListItemButton selected={s.id === currentSessionId} onClick={() => switchSession(s)}>
                                            <ListItemText
                                                primary={s.title || 'New Chat'}
                                                primaryTypographyProps={{ noWrap: true, style: { fontSize: '0.9rem' } }}
                                                secondary={formatDate(s.createdAt)}
                                                secondaryTypographyProps={{ style: { fontSize: '0.7rem' } }}
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                                {sessions.length === 0 && <ListItem><ListItemText primary="No history" /></ListItem>}
                            </List>
                        </Popover>

                        {/* Model Selector */}
                        {activeProviderName && (
                            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                                <Select
                                    value={selectedModel}
                                    onChange={(e) => updateCurrentSessionModel(e.target.value)}
                                    displayEmpty
                                    renderValue={(selected) => {
                                        if (selected.length === 0) {
                                            return <em>Select Model</em>;
                                        }
                                        return selected;
                                    }}
                                >
                                    <MenuItem disabled value="">
                                        <em>Select Model</em>
                                    </MenuItem>
                                    {availableModels.map((m) => (
                                        <MenuItem key={m} value={m}>{m}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        <Divider sx={{ mb: 2 }} />

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
                            p: 2,
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

                            {messages.map((msg, index) => (
                                <Box key={index}
                                    className={index === messages.length - 1 && msg.role === 'assistant' ? 'message-fade-in' : ''}
                                    sx={{
                                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                        maxWidth: '90%',
                                        display: 'flex',
                                        flexDirection: 'row',
                                        position: 'relative' // Needed?
                                    }}>
                                    {/* Sticky Copy Button Wrapper */}
                                    <Box sx={{
                                        position: 'sticky',
                                        top: 0,
                                        height: 0, // Don't take up vertical space
                                        zIndex: 10,
                                        order: msg.role === 'user' ? 0 : 1, // User: button left, Assistant: button right
                                        // Make button appear outside bubbles
                                        transform: msg.role === 'user' ? 'translateX(-32px)' : 'translateX(calc(100% + 8px))',
                                        visibility: 'visible', // Always visible or hover?
                                        // To stick properly, container needs height. message bubble gives height.
                                    }}>
                                        <Box sx={{ pt: 1 }}> {/* Small padding from top */}
                                            <Tooltip title="Copy (Right-click for options)">
                                                <IconButton
                                                    size="small"
                                                    sx={{
                                                        bgcolor: 'background.paper',
                                                        boxShadow: 1,
                                                        opacity: 0.1,
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

                                    <Box sx={{
                                        bgcolor: msg.role === 'user' ? 'primary.light' : 'background.paper',
                                        color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                                        p: 1.5,
                                        borderRadius: 2,
                                        boxShadow: 1,
                                        order: msg.role === 'user' ? 1 : 0
                                    }}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                            components={{
                                                p: ({ node, ...props }) => <Typography variant="body2" sx={{ wordBreak: "break-word" }} {...props} />,
                                                code: ({ node, className, children, ...props }: any) => {
                                                    const match = /language-(\w+)/.exec(className || '')
                                                    return !props.inline && match ? (
                                                        <Box component="div" sx={{ overflowX: 'auto', bgcolor: '#333', color: '#fff', p: 1, borderRadius: 1, my: 1 }}>
                                                            <code className={className} {...props}>
                                                                {children}
                                                            </code>
                                                        </Box>
                                                    ) : (
                                                        <code className={className} {...props} style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace' }}>
                                                            {children}
                                                        </code>
                                                    )
                                                }
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </Box>
                                </Box>
                            ))}
                            <div ref={messagesEndRef} />
                        </Box>

                        {/* Copy Format Menu */}
                        <Menu
                            anchorEl={copyAnchorEl}
                            open={Boolean(copyAnchorEl)}
                            onClose={() => setCopyAnchorEl(null)}
                        >
                            <MenuItem onClick={() => handleCopyAction(selectedCopyContent, 'text')}>Copy Text</MenuItem>
                            <MenuItem onClick={() => handleCopyAction(selectedCopyContent, 'markdown')}>Copy Markdown</MenuItem>
                            <Divider />
                            <MenuItem onClick={(e) => setCopyFormatAnchorEl(e.currentTarget)}>Set Default Format</MenuItem>
                        </Menu>

                        <Menu
                            anchorEl={copyFormatAnchorEl}
                            open={Boolean(copyFormatAnchorEl)}
                            onClose={() => setCopyFormatAnchorEl(null)}
                        >
                            <MenuItem selected={defaultCopyFormat === 'text'} onClick={() => saveDefaultCopyFormat('text')}>Text</MenuItem>
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
