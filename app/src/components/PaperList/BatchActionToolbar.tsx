import React from 'react';
import {
    AppBar, Toolbar, Fade, Box, IconButton, Typography, Button, Menu, MenuItem
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TranslateIcon from '@mui/icons-material/Translate';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOffIcon from '@mui/icons-material/FolderOff';

interface BatchActionToolbarProps {
    selectedCount: number;
    selectedGroupId: number | null;
    t: any;
    onClearSelection: () => void;
    onBatchTranslate: () => void;
    onBatchUpdate: () => void;
    onExportMenuOpen: (e: React.MouseEvent<HTMLElement>) => void;
    onGroupMenuOpen: (e: React.MouseEvent<HTMLElement>) => void;
    onRemoveFromGroup: () => void;
    exportMenuAnchor: null | HTMLElement;
    onExportMenuClose: () => void;
    onExportReferences: (format: 'ris' | 'bibtex') => void;
}

export const BatchActionToolbar: React.FC<BatchActionToolbarProps> = ({
    selectedCount,
    selectedGroupId,
    t,
    onClearSelection,
    onBatchTranslate,
    onBatchUpdate,
    onExportMenuOpen,
    onGroupMenuOpen,
    onRemoveFromGroup,
    exportMenuAnchor,
    onExportMenuClose,
    onExportReferences
}) => {
    return (
        <Fade in={selectedCount > 0}>
            <AppBar position="absolute" color="default" sx={{
                top: 0, left: 0, right: 0,
                zIndex: 10,
                display: selectedCount > 0 ? 'flex' : 'none',
                bgcolor: 'background.paper',
                color: 'text.primary',
                boxShadow: 2
            }}>
                <Toolbar variant="dense" sx={{ flexWrap: 'wrap', py: 0.5, minHeight: 'auto' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2, py: 0.5 }}>
                        <IconButton edge="start" color="inherit" onClick={onClearSelection} size="small">
                            <CloseIcon />
                        </IconButton>
                        <Typography sx={{ ml: 1 }} variant="subtitle1" component="div">
                            {t('app.selected_count', { count: selectedCount })}
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, py: 0.5, ml: 'auto' }}>
                        <Button
                            color="inherit"
                            startIcon={<TranslateIcon />}
                            onClick={onBatchTranslate}
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            {t('app.batch_translate') || "Translate"}
                        </Button>

                        <Button
                            color="inherit"
                            startIcon={<RefreshIcon />}
                            onClick={onBatchUpdate}
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            {t('app.batch_update') || "Update"}
                        </Button>

                        <Button
                            color="inherit"
                            startIcon={<ContentCopyIcon />}
                            onClick={onExportMenuOpen}
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            {t('app.batch_export') || "Export"}
                        </Button>

                        {selectedGroupId ? (
                            <Button
                                color="error"
                                startIcon={<FolderOffIcon />}
                                onClick={onRemoveFromGroup}
                                sx={{ whiteSpace: 'nowrap' }}
                            >
                                {t('app.remove_from_group') || "Remove"}
                            </Button>
                        ) : (
                            <Button
                                color="inherit"
                                startIcon={<FolderIcon />}
                                onClick={onGroupMenuOpen}
                                sx={{ whiteSpace: 'nowrap' }}
                            >
                                {t('app.add_to_group') || "Group"}
                            </Button>
                        )}
                    </Box>

                    <Menu
                        anchorEl={exportMenuAnchor}
                        open={Boolean(exportMenuAnchor)}
                        onClose={onExportMenuClose}
                    >
                        <MenuItem onClick={() => onExportReferences('ris')}>
                            {t('app.export_ris') || "Export RIS"}
                        </MenuItem>
                        <MenuItem onClick={() => onExportReferences('bibtex')}>
                            {t('app.export_bibtex') || "Export BibTeX"}
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>
        </Fade>
    );
};
