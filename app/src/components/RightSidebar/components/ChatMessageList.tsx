import React from 'react';
import { Box, Typography, Divider, Tooltip, IconButton, Chip } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import CopyIcon from '@mui/icons-material/ContentCopy';
import InteractiveMath from '../../InteractiveMath';
import CodeBlock from '../../CodeBlock';
import { ChatMessage } from '../../../types';

interface ChatMessageListProps {
    t: any;
    messages: ChatMessage[];
    messagesContainerRef: React.RefObject<HTMLDivElement | null>;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    handleCopyClick: (e: React.MouseEvent<HTMLElement>, content: string) => void;
    handleCopyContextMenu: (e: React.MouseEvent<HTMLElement>, content: string) => void;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
    t, messages, messagesContainerRef, messagesEndRef, handleCopyClick, handleCopyContextMenu
}) => {
    return (
        <Box sx={{
            flex: 1,
            bgcolor: 'action.hover',
            mb: 2,
            borderRadius: 1,
            px: 1,
            py: 2,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
        }} ref={messagesContainerRef}>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .message-fade-in {
                    animation: fadeIn 0.3s ease-out forwards;
                }
            `}</style>

            {messages.length === 0 && (
                <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 4 }}>
                    {t('app.hello_message') || "Hello, how can I help you today?"}
                </Typography>
            )}

            {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                    <Box key={index}
                        className={index === messages.length - 1 && !isUser ? 'message-fade-in' : ''}
                        sx={{
                            alignSelf: isUser ? 'flex-end' : 'stretch',
                            maxWidth: isUser ? '90%' : '100%',
                            width: isUser ? 'auto' : '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                            my: isUser ? 1 : 0
                        }}>

                        {!isUser && (
                            <Divider sx={{ my: 1, borderColor: 'divider', opacity: 1 }} />
                        )}

                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'row',
                            width: '100%',
                            position: 'relative'
                        }}>
                            <Box sx={{
                                position: 'sticky',
                                top: 0,
                                height: 0,
                                zIndex: 10,
                                order: isUser ? 0 : 1,
                                transform: isUser ? 'translateX(-32px)' : 'translateX(0)',
                                right: isUser ? 'auto' : 0,
                                left: isUser ? 0 : 'auto',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                width: isUser ? 'auto' : 0,
                                flexShrink: 0,
                                pointerEvents: 'none',
                                overflow: 'visible'
                            }}>
                                <Box sx={{
                                    pt: 1,
                                    ...(!isUser && { position: 'absolute', right: 0, top: 0 }),
                                    pointerEvents: 'auto'
                                }}>
                                    <Tooltip title={t('app.copy') || "Copy"}>
                                        <IconButton
                                            size="small"
                                            sx={{
                                                bgcolor: isUser ? 'primary.light' : 'background.paper',
                                                color: isUser ? 'primary.contrastText' : 'text.primary',
                                                boxShadow: 1,
                                                opacity: 0.6,
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
                                bgcolor: isUser ? 'primary.light' : 'transparent',
                                color: isUser ? 'primary.contrastText' : 'text.primary',
                                p: isUser ? 1.5 : 0.5,
                                borderRadius: isUser ? 2 : 0,
                                boxShadow: isUser ? 1 : 0,
                                order: isUser ? 1 : 0,
                                width: isUser ? 'auto' : '100%',
                                maxWidth: isUser ? '90%' : '100%',
                                flexGrow: isUser ? 0 : 1,
                                overflow: 'hidden'
                            }}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkMath]}
                                    remarkRehypeOptions={{
                                        handlers: {
                                            math: (_state, node) => ({
                                                type: 'element', tagName: 'interactive-math',
                                                properties: { latex: node.value, block: true }, children: []
                                            }),
                                            inlineMath: (_state, node) => ({
                                                type: 'element', tagName: 'interactive-math',
                                                properties: { latex: node.value, block: false }, children: []
                                            })
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

                        {msg.context_items && msg.context_items.length > 0 && (
                            <Box sx={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 0.5,
                                mt: 0.5,
                                justifyContent: isUser ? 'flex-end' : 'flex-start'
                            }}>
                                {msg.context_items.map((item, idx) => (
                                    <Tooltip
                                        key={`${item.id}-${idx}`}
                                        title={
                                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', p: 0.5 }}>
                                                {item.text}
                                            </Typography>
                                        }
                                        arrow
                                        placement="bottom"
                                        enterDelay={300}
                                        slotProps={{
                                            tooltip: { sx: { maxWidth: 400, bgcolor: 'background.paper', color: 'text.primary', boxShadow: 3, border: '1px solid', borderColor: 'divider' } }
                                        }}
                                    >
                                        <Chip
                                            label={`${item.source.substring(0, 20)}${item.source.length > 20 ? '…' : ''}: ${item.label}`}
                                            size="small"
                                            color="default"
                                            variant="outlined"
                                            sx={{ bgcolor: 'action.hover', fontSize: '0.7rem', cursor: 'pointer' }}
                                        />
                                    </Tooltip>
                                ))}
                            </Box>
                        )}

                        {!isUser && (
                            <Divider sx={{ my: 1, borderColor: 'divider', opacity: 1 }} />
                        )}
                    </Box>
                );
            })}
            <div ref={messagesEndRef} />
        </Box>
    );
};
