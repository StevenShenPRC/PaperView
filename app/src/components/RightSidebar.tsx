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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
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

    // Load sessions and provider info on mount
    useEffect(() => {
        const initializeChat = async () => {
            try {
                // 1. Load Settings (Provider & Default Model)
                let defaultModelToUse = 'gpt-3.5-turbo';
                try {
                    const active = await store.get<string>('active_ai_provider');
                    const providers = await store.get<any[]>('ai_providers');

                    setActiveProviderName(active || null);

                    if (active && providers) {
                        const provider = providers.find((p: any) => p.name === active);
                        if (provider) {
                            let models: string[] = provider.models || [];
                            setAvailableModels(models);

                            // Determine default model
                            if (provider.default_model) {
                                defaultModelToUse = provider.default_model;
                            } else if (models.length > 0) {
                                defaultModelToUse = models[0];
                            }
                        }
                    }
                } catch (err) {
                    console.error("Failed to load provider info", err);
                }

                // Set the selected model state
                setSelectedModel(defaultModelToUse);

                // 2. Load History
                const stored = await store.get<ChatSession[]>('chat_history');
                let historySessions: ChatSession[] = [];
                if (stored && Array.isArray(stored)) {
                    setSessions(stored);
                    historySessions = stored;
                }

                // 3. Check for existing empty "New Chat" or Start New
                // If the latest session is empty, reuse it instead of creating a new one
                let reused = false;
                if (historySessions.length > 0) {
                    const latest = historySessions[0];
                    if (latest.messages.length === 0) {
                        setCurrentSessionId(latest.id);
                        setMessages([]); // It's empty anyway
                        // Update the model to the current default if we reuse it
                        // or keep it? explicit request was "load default model... into this *new* chat".
                        // If we reuse, it's effectively the "new" chat. 
                        // Let's set the selected model to the default one we determined above.
                        setSelectedModel(defaultModelToUse);

                        // We also need to update the session's model in the state/store if it differs?
                        // For now just setting selectedModel allows the user to send with that model.
                        // The session object in 'sessions' will be updated when the user sends a message.
                        reused = true;
                    }
                }

                if (!reused) {
                    startNewChat(defaultModelToUse);
                }

            } catch (e) {
                console.error("Failed to initialize chat", e);
                startNewChat('gpt-3.5-turbo');
            }
        };

        initializeChat();
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

    const startNewChat = (modelOverride?: string) => {
        // Optimization: If the latest session is empty, reuse it
        if (sessions.length > 0 && sessions[0].messages.length === 0) {
            const reusedSession = { ...sessions[0] };
            reusedSession.createdAt = Date.now(); // Update timestamp

            const modelToUse = modelOverride || selectedModel || 'gpt-3.5-turbo';
            reusedSession.model = modelToUse;

            // Update sessions list with modified first session
            setSessions(prev => [reusedSession, ...prev.slice(1)]);
            setCurrentSessionId(reusedSession.id);
            setMessages([]);

            if (modelOverride) setSelectedModel(modelOverride);
            return;
        }

        const newId = crypto.randomUUID();
        const modelToUse = modelOverride || selectedModel || 'gpt-3.5-turbo';

        const newSession: ChatSession = {
            id: newId,
            title: t('app.new_chat'),
            messages: [],
            createdAt: Date.now(),
            model: modelToUse
        };
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newId);
        setMessages([]);
        if (modelOverride) setSelectedModel(modelOverride);
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
                        <IconButton onClick={() => startNewChat()}>
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
                                                secondary={formatDate(s.createdAt)}
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
