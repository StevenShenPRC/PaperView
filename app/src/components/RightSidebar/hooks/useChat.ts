import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import store from '../../../store';
import { ChatMessage, ChatSession, PendingContext, ContextItem, ModelMetadata } from '../../../types';

export interface ChatModelOption {
    provider: string;
    model: ModelMetadata;
}

export function useChat(t: any, onContextHandled?: () => void) {
    const [input, setInput] = useState('');
    const [contextItems, setContextItems] = useState<ContextItem[]>([]);
    const [isInputExpanded, setIsInputExpanded] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

    const currentSessionIdRef = useRef<string | null>(null);
    const streamingContentRef = useRef<string>("");

    const [selectedModel, setSelectedModel] = useState('');
    const [selectedProvider, setSelectedProvider] = useState('');
    const [defaultModel, setDefaultModel] = useState('gpt-3.5-turbo');
    const [availableModels, setAvailableModels] = useState<ChatModelOption[]>([]);
    const [activeProviderName, setActiveProviderName] = useState<string | null>(null);

    useEffect(() => {
        currentSessionIdRef.current = currentSessionId;
    }, [currentSessionId]);

    const loadProviderSettings = useCallback(async () => {
        try {
            let defaultModelToUse = 'gpt-3.5-turbo';
            let defaultProviderToUse = '';
            const providers = await store.get<any[]>('ai_providers');

            // 1. Try to use decoupled ModelRouting (new system)
            const chatRouting = await store.get<{ provider: string, model_id: string }>('default_chat_model');
            if (chatRouting && chatRouting.provider && chatRouting.model_id) {
                defaultProviderToUse = chatRouting.provider;
                defaultModelToUse = chatRouting.model_id;
            } else {
                // 2. Fallback to active_ai_provider (legacy)
                const active = await store.get<string>('active_ai_provider');
                if (active) defaultProviderToUse = active;
                // Find first chat model from active provider
                if (defaultProviderToUse && providers) {
                    const activeProv = providers.find((p: any) => p.name === defaultProviderToUse);
                    if (activeProv) {
                        const firstChat = (activeProv.models || []).find((m: any) => {
                            const meta = typeof m === 'string' ? { type: 'unknown' } : m;
                            return meta.type === 'chat' || meta.type === 'unknown';
                        });
                        if (firstChat) {
                            defaultModelToUse = typeof firstChat === 'string' ? firstChat : firstChat.id;
                        }
                    }
                }
            }

            setActiveProviderName(defaultProviderToUse || null);

            // Collect chat-eligible models from ALL providers
            const options: ChatModelOption[] = [];
            if (providers) {
                providers.forEach((p: any) => {
                    (p.models || []).forEach((m: any) => {
                        const meta: ModelMetadata = typeof m === 'string' ? { id: m, type: 'unknown' as const } : m;
                        if (meta.type === 'chat' || meta.type === 'unknown') {
                            options.push({ provider: p.name, model: meta });
                        }
                    });
                });
            }

            setAvailableModels(options);
            setDefaultModel(defaultModelToUse);
            return defaultModelToUse;
        } catch (err) {
            console.error("Failed to load provider info", err);
            return 'gpt-3.5-turbo';
        }
    }, []);

    useEffect(() => {
        let unlistenFn: (() => void) | undefined;
        const setupListeners = async () => {
            const u1 = await store.onKeyChange('active_ai_provider', async () => loadProviderSettings());
            const u2 = await store.onKeyChange('ai_providers', async () => loadProviderSettings());
            const u3 = await store.onKeyChange('default_chat_model', async () => loadProviderSettings());
            unlistenFn = () => { u1(); u2(); u3(); };
        };
        setupListeners();
        return () => { if (unlistenFn) unlistenFn(); };
    }, [loadProviderSettings]);

    const loadSessionsFromDb = useCallback(async () => {
        try {
            const sessionsFromDb = await invoke<ChatSession[]>('get_chat_sessions');
            setSessions(sessionsFromDb);
            if (sessionsFromDb.length === 0) {
                startNewChat();
            }
        } catch (e) {
            console.error("Failed to load sessions", e);
        }
    }, []);

    const initializeChat = useCallback(async () => {
        try {
            const defaultModelToUse = await loadProviderSettings();
            if (!selectedModel) setSelectedModel(defaultModelToUse);

            const storedHistory = await store.get<any[]>('chat_history');
            if (storedHistory && Array.isArray(storedHistory) && storedHistory.length > 0) {
                console.log("Migrating chat history to DB...", storedHistory.length);
                for (const s of storedHistory.slice().reverse()) {
                    try {
                        const newId = await invoke<string>('create_chat_session', {
                            title: s.title || 'Migrated Chat',
                            model: s.model || 'gpt-3.5-turbo'
                        });
                        if (s.messages && Array.isArray(s.messages)) {
                            for (const m of s.messages) {
                                await invoke('create_chat_message', {
                                    sessionId: newId,
                                    role: m.role,
                                    content: { text: m.content }
                                });
                            }
                        }
                    } catch (migErr) { console.error("Failed to migrate", s.id, migErr); }
                }
                await store.set('chat_history', null);
                await store.save();
                console.log("Migration complete.");
            }
            await loadSessionsFromDb();
        } catch (e) { console.error("Failed to initialize chat", e); }
    }, [loadProviderSettings, loadSessionsFromDb, selectedModel]);

    useEffect(() => { initializeChat(); }, [initializeChat]);

    const loadMessages = useCallback(async (sessionId: string) => {
        try {
            const msgs = await invoke<ChatMessage[]>('get_chat_messages', { sessionId });
            const uiMsgs = msgs.map(m => {
                let contentText = "";
                let contextItems: ContextItem[] | undefined = undefined;
                if (typeof m.content === 'string') {
                    contentText = m.content;
                } else {
                    contentText = m.content.text || JSON.stringify(m.content);
                    if (m.content.context_items && Array.isArray(m.content.context_items)) {
                        contextItems = m.content.context_items;
                    }
                }
                return { ...m, content: contentText, context_items: contextItems };
            });
            setMessages(uiMsgs);
        } catch (e) { console.error("Failed to load messages", e); }
    }, []);

    useEffect(() => {
        if (currentSessionId) {
            loadMessages(currentSessionId);
        } else {
            setMessages([]);
        }
    }, [currentSessionId, loadMessages]);

    const startNewChat = useCallback(async (modelOverride?: string): Promise<string | null> => {
        const modelToUse = modelOverride || defaultModel || 'gpt-3.5-turbo';
        try {
            if (sessions.length > 0) {
                const latestSession = sessions[0];
                const msgs = await invoke<ChatMessage[]>('get_chat_messages', { sessionId: latestSession.id });
                if (msgs.length === 0) {
                    setCurrentSessionId(latestSession.id);
                    setMessages([]);
                    if (latestSession.model !== modelToUse) {
                        await invoke('update_chat_session', { id: latestSession.id, model: modelToUse });
                        setSessions(prev => prev.map(s => s.id === latestSession.id ? { ...s, model: modelToUse } : s));
                    }
                    setSelectedModel(modelToUse);
                    return latestSession.id;
                }
            }

            const newId = await invoke<string>('create_chat_session', {
                title: t('app.new_chat'),
                model: modelToUse
            });
            await loadSessionsFromDb();
            setCurrentSessionId(newId);
            setMessages([]);
            setSelectedModel(modelToUse);
            return newId;
        } catch (e) { console.error("Failed to create session", e); return null; }
    }, [defaultModel, sessions, t, loadSessionsFromDb]);

    const switchSession = useCallback((session: ChatSession) => {
        setCurrentSessionId(session.id);
        setSelectedModel(session.model || defaultModel);
    }, [defaultModel]);

    const deleteSession = useCallback(async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await invoke('delete_chat_session', { id });
            setSessions(prev => prev.filter(s => s.id !== id));
            if (currentSessionId === id) {
                setCurrentSessionId(null);
                setMessages([]);
            }
        } catch (err) { console.error("Failed to delete", err); }
    }, [currentSessionId]);

    const updateCurrentSessionModel = useCallback(async (providerName: string, model: string) => {
        setSelectedModel(model);
        setSelectedProvider(providerName);
        if (currentSessionId) {
            await invoke('update_chat_session', { id: currentSessionId, model });
            setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, model } : s));
        }
        // Also update active_ai_provider in store when user picks a model from a different provider
        if (providerName && providerName !== activeProviderName) {
            await store.set('active_ai_provider', providerName);
            await store.save();
            setActiveProviderName(providerName);
        }
    }, [currentSessionId, activeProviderName]);

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
                        newGlobal[newGlobal.length - 1] = { ...lastMsg, content: streamingContentRef.current };
                        return newGlobal;
                    } else {
                        return [...prev, {
                            role: 'assistant',
                            content: event.payload,
                            session_id: currentSessionIdRef.current || "",
                            created_at: new Date().toISOString()
                        }];
                    }
                });
            });

            if (!isMounted) { h1(); return; }
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

                        const allMsgs = await invoke<ChatMessage[]>('get_chat_messages', { sessionId });
                        if (allMsgs.length <= 2) {
                            try {
                                const providerName = await store.get<string>('active_ai_provider') || "";
                                const titleMessages = allMsgs.map(m => ({
                                    role: m.role,
                                    content: typeof m.content === 'string' ? m.content : (m.content.text || "")
                                }));

                                let titleModel = 'gpt-3.5-turbo';
                                const providers = await store.get<any[]>('ai_providers');
                                if (providerName && providers) {
                                    const provider = providers.find((p: any) => p.name === providerName);
                                    if (provider && provider.models && provider.models.length > 0) {
                                        const firstModel = provider.models[0];
                                        titleModel = typeof firstModel === 'string' ? firstModel : firstModel.id;
                                    }
                                }
                                let finalTitle = "";
                                try {
                                    const title = await invoke<string>('generate_chat_title_command', {
                                        messages: titleMessages, model: titleModel, providerName: providerName
                                    });
                                    if (title && title.trim()) { finalTitle = title.trim().replace(/^["']|["']$/g, ''); }
                                } catch (titleErr) { console.error("Failed title generation via AI", titleErr); }

                                if (!finalTitle && allMsgs.length > 0) {
                                    const firstMsg = allMsgs[0];
                                    const content = typeof firstMsg.content === 'string' ? firstMsg.content : (firstMsg.content.text || "");
                                    finalTitle = content.substring(0, 30).trim() + (content.length > 30 ? "..." : "");
                                }

                                if (finalTitle) {
                                    await invoke('update_chat_session', { id: sessionId, title: finalTitle, model: null as string | null });
                                    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: finalTitle } : s));
                                }
                            } catch (titleErr) { console.error("Error generating title", titleErr); }
                        }
                    } catch (e) { console.error("Failed to save assistant msg", e); }
                }
                streamingContentRef.current = "";
            });

            if (!isMounted) { h2(); return; }
            unlistenHandlers.push(h2);
        };
        setupListeners();
        return () => {
            isMounted = false;
            unlistenHandlers.forEach(fn => fn());
        };
    }, []);

    const handleSend = async () => {
        if (!input.trim() && contextItems.length === 0) return;
        if (isLoading) return;

        let sessionId = currentSessionId;
        if (!sessionId) sessionId = await startNewChat();
        if (!sessionId) return;

        const userMsg: ChatMessage = {
            role: 'user', content: input, session_id: sessionId,
            context_items: contextItems.length > 0 ? contextItems : undefined,
            created_at: new Date().toISOString()
        };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setContextItems([]);
        setIsLoading(true);
        streamingContentRef.current = "";

        invoke('create_chat_message', {
            sessionId: sessionId, role: 'user',
            content: { text: input, context_items: contextItems.length > 0 ? contextItems : undefined }
        }).catch(e => console.error("Failed to save user msg", e));

        const assistantPlaceholder: ChatMessage = { role: 'assistant', content: '', session_id: sessionId, created_at: new Date().toISOString() };
        setMessages(prev => [...prev, assistantPlaceholder]);

        const contextMessages = newMessages.map(m => {
            let contentStr = typeof m.content === 'string' ? m.content : (m.content.text || "");
            if (m.context_items && m.context_items.length > 0) {
                const contextStr = m.context_items.map(item => `[Context from ${item.source} (${item.label})]:\n${item.text}`).join("\n\n");
                contentStr += `\n\n---\n${contextStr}`;
            }
            return { role: m.role, content: contentStr };
        });

        try {
            let providerToUse = selectedProvider || activeProviderName || await store.get<string>('active_ai_provider') || "";
            let modelToUse = selectedModel || "gpt-3.5-turbo";
            await invoke('chat_command', { messages: contextMessages, model: modelToUse, providerName: providerToUse });
        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => [...prev, { role: 'system', content: `Error: ${error}`, session_id: sessionId || "", created_at: new Date().toISOString() }]);
            setIsLoading(false);
        }
    };

    const handlePendingContext = useCallback(async (ctx: PendingContext) => {
        if (ctx.mode === 'new') {
            await startNewChat();
            setContextItems(ctx.items);
            setTimeout(() => { document.getElementById('chat-input')?.focus(); }, 100);
        } else if (ctx.mode === 'append') {
            setContextItems(prev => {
                const existingIds = new Set(prev.map(i => i.id));
                const newItems = ctx.items.filter(i => !existingIds.has(i.id));
                return [...prev, ...newItems];
            });
        }
        if (onContextHandled) onContextHandled();
    }, [startNewChat, onContextHandled]);

    return {
        input, setInput, contextItems, setContextItems, isInputExpanded, setIsInputExpanded,
        messages, isLoading, sessions, currentSessionId, setCurrentSessionId, setMessages,
        selectedModel, defaultModel, availableModels, activeProviderName,
        startNewChat, switchSession, deleteSession, updateCurrentSessionModel, handleSend, handlePendingContext
    };
}
