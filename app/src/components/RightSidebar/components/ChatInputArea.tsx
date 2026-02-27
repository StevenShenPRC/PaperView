import React from 'react';
import { Box, TextField, Tooltip, IconButton, CircularProgress, Chip, Typography } from '@mui/material';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import SendIcon from '@mui/icons-material/Send';
import { ContextItem } from '../../../types';

interface ChatInputAreaProps {
    t: any;
    input: string;
    setInput: (s: string) => void;
    contextItems: ContextItem[];
    setContextItems: React.Dispatch<React.SetStateAction<ContextItem[]>>;
    isInputExpanded: boolean;
    setIsInputExpanded: (b: boolean) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    handleSend: () => void;
    isLoading: boolean;
}

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
    t, input, setInput, contextItems, setContextItems,
    isInputExpanded, setIsInputExpanded, handleKeyDown, handleSend, isLoading
}) => {
    return (
        <Box sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            height: isInputExpanded ? '80%' : 'auto',
            transition: 'height 0.3s ease-in-out',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <Box sx={{ position: 'relative', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                {contextItems.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                        {contextItems.map((item) => (
                            <Tooltip
                                key={item.id}
                                title={
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', p: 0.5 }}>
                                        {item.text}
                                    </Typography>
                                }
                                arrow
                                placement="top"
                                enterDelay={300}
                                slotProps={{
                                    tooltip: { sx: { maxWidth: 400, bgcolor: 'background.paper', color: 'text.primary', boxShadow: 3, border: '1px solid', borderColor: 'divider' } }
                                }}
                            >
                                <Chip
                                    label={`${item.source.substring(0, 20)}${item.source.length > 20 ? '...' : ''}: ${item.label}`}
                                    onDelete={() => setContextItems(prev => prev.filter(i => i.id !== item.id))}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    sx={{ bgcolor: 'action.selected', cursor: 'pointer' }}
                                />
                            </Tooltip>
                        ))}
                    </Box>
                )}

                <TextField
                    id="chat-input"
                    fullWidth
                    multiline
                    minRows={isInputExpanded ? 10 : 3}
                    maxRows={isInputExpanded ? undefined : 6}
                    placeholder={t('app.type_message') || "Type a message..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    variant="outlined"
                    size="small"
                    sx={{
                        flexGrow: 1,
                        '& .MuiOutlinedInput-root': {
                            paddingRight: '40px',
                            height: '100%',
                            alignItems: 'flex-start',
                            paddingTop: '8px',
                            paddingBottom: '8px'
                        }
                    }}
                />

                <IconButton
                    size="small"
                    onClick={() => setIsInputExpanded(!isInputExpanded)}
                    sx={{ position: 'absolute', top: 6, right: 6, color: 'text.secondary', zIndex: 2 }}
                >
                    {isInputExpanded ? <CloseFullscreenIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
                </IconButton>

                <IconButton
                    color="primary"
                    onClick={handleSend}
                    disabled={(!input.trim() && contextItems.length === 0) || isLoading}
                    sx={{ position: 'absolute', bottom: 6, right: 6, zIndex: 2 }}
                >
                    {isLoading ? <CircularProgress size={20} /> : <SendIcon />}
                </IconButton>
            </Box>
        </Box>
    );
};
