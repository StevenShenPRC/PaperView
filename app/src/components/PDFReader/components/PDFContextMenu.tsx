import React from 'react';
import { Menu, MenuItem } from '@mui/material';

interface PDFContextMenuProps {
    t: any;
    contextMenu: { x: number, y: number } | null;
    setContextMenu: (m: { x: number, y: number } | null) => void;
    handleCopy: () => void;
    handleNewChat: (prefix: string) => void;
    handleAppendChat: () => void;
}

export const PDFContextMenu: React.FC<PDFContextMenuProps> = ({
    t, contextMenu, setContextMenu, handleCopy, handleNewChat, handleAppendChat
}) => {
    return (
        <Menu
            open={contextMenu !== null}
            onClose={() => setContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
            disableAutoFocusItem
            hideBackdrop
            sx={{ pointerEvents: 'none' }}
            MenuListProps={{ sx: { pointerEvents: 'auto' } }}
        >
            <MenuItem onClick={handleCopy}>{t('app.copy_text') || 'Copy Text'}</MenuItem>
            <MenuItem onClick={() => handleNewChat("Summarize")}>{t('app.ai_summary') || 'AI Summary'}</MenuItem>
            <MenuItem onClick={() => handleNewChat("Translate tightly into Chinese")}>{t('app.ai_translate') || 'AI Translate'}</MenuItem>
            <MenuItem onClick={() => handleNewChat("Explain clearly")}>{t('app.ai_explain') || 'AI Explain'}</MenuItem>
            <MenuItem onClick={handleAppendChat}>{t('app.add_to_chat_context') || 'Add to Chat Context'}</MenuItem>
        </Menu>
    );
};
