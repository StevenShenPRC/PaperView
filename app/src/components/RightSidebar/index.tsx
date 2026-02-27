import React, { useState, useEffect, useRef } from 'react';
import { Drawer, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { PendingContext } from '../../types';
import { useChat } from './hooks/useChat';
import { useChatSearch } from './hooks/useChatSearch';
import { useCopyLogic } from './hooks/useCopyLogic';
import { useSidebarResize } from './hooks/useSidebarResize';

import { ChatHeader } from './components/ChatHeader';
import { ChatSearchPanel } from './components/ChatSearchPanel';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatInputArea } from './components/ChatInputArea';

const COLLAPSED_WIDTH = 60;
const DEFAULT_WIDTH = 350;

interface RightSidebarProps {
    hasCollapsedPdf?: boolean;
    onExpandReader?: () => void;
    pendingContext?: PendingContext | null;
    onContextHandled?: () => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({
    hasCollapsedPdf = false, onExpandReader, pendingContext, onContextHandled
}) => {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);
    const [historyAnchorEl, setHistoryAnchorEl] = useState<HTMLButtonElement | null>(null);

    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { width, isResizing, startResizing } = useSidebarResize(DEFAULT_WIDTH);

    const {
        input, setInput, contextItems, setContextItems, isInputExpanded, setIsInputExpanded,
        messages, isLoading, sessions, currentSessionId, setCurrentSessionId,
        selectedModel, availableModels, activeProviderName,
        startNewChat, switchSession, deleteSession, updateCurrentSessionModel, handleSend, handlePendingContext
    } = useChat(t, onContextHandled);

    const {
        showSearch, setShowSearch, searchQuery, setSearchQuery,
        searchResults, isSearching, handleSearch, handleSearchResultClick
    } = useChatSearch(sessions, currentSessionId, switchSession, setCurrentSessionId);

    const { handleCopyClick, handleCopyContextMenu } = useCopyLogic();

    useEffect(() => {
        if (pendingContext) {
            if (collapsed) setCollapsed(false);
            handlePendingContext(pendingContext);
        }
    }, [pendingContext]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString(undefined, {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

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
            {!collapsed && (
                <Box
                    onMouseDown={startResizing}
                    sx={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: '4px', cursor: 'ew-resize', zIndex: 100,
                        '&:hover': { bgcolor: 'primary.main' }
                    }}
                />
            )}

            <Box sx={{ p: collapsed ? 0.5 : 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <ChatHeader
                    collapsed={collapsed}
                    setCollapsed={setCollapsed}
                    t={t}
                    hasCollapsedPdf={hasCollapsedPdf}
                    onExpandReader={onExpandReader}
                    historyAnchorEl={historyAnchorEl}
                    setHistoryAnchorEl={setHistoryAnchorEl}
                    sessions={sessions}
                    currentSessionId={currentSessionId}
                    switchSession={switchSession}
                    deleteSession={deleteSession}
                    showSearch={showSearch}
                    setShowSearch={setShowSearch}
                    startNewChat={startNewChat}
                    activeProviderName={activeProviderName}
                    selectedModel={selectedModel}
                    availableModels={availableModels}
                    updateCurrentSessionModel={updateCurrentSessionModel}
                    formatDate={formatDate}
                />

                {!collapsed && (
                    <>
                        {showSearch ? (
                            <ChatSearchPanel
                                t={t}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                handleSearch={handleSearch}
                                isSearching={isSearching}
                                searchResults={searchResults}
                                handleSearchResultClick={handleSearchResultClick}
                            />
                        ) : (
                            <>
                                <ChatMessageList
                                    t={t}
                                    messages={messages}
                                    messagesContainerRef={messagesContainerRef}
                                    messagesEndRef={messagesEndRef}
                                    handleCopyClick={handleCopyClick}
                                    handleCopyContextMenu={handleCopyContextMenu}
                                />
                                <ChatInputArea
                                    t={t}
                                    input={input}
                                    setInput={setInput}
                                    contextItems={contextItems}
                                    setContextItems={setContextItems}
                                    isInputExpanded={isInputExpanded}
                                    setIsInputExpanded={setIsInputExpanded}
                                    handleKeyDown={handleKeyDown}
                                    handleSend={handleSend}
                                    isLoading={isLoading}
                                />
                            </>
                        )}
                    </>
                )}
            </Box>
        </Drawer>
    );
};

export default RightSidebar;
