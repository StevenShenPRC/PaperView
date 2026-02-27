import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography, Divider, Menu, MenuItem, ListItemIcon } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

interface SidebarDialogsProps {
    t: any;
    menuAnchor: HTMLElement | null;
    handleGroupMenuClose: () => void;
    handleRenameClick: () => void;
    handleDeleteClick: () => void;
    newGroupDialogOpen: boolean;
    setNewGroupDialogOpen: (open: boolean) => void;
    newGroupName: string;
    setNewGroupName: (name: string) => void;
    handleCreateGroup: () => void;
    renameDialogOpen: boolean;
    setRenameDialogOpen: (open: boolean) => void;
    renameName: string;
    setRenameName: (name: string) => void;
    handleRenameConfirm: () => void;
    importDialogOpen: boolean;
    setImportDialogOpen: (open: boolean) => void;
    importDois: string;
    setImportDois: (dois: string) => void;
    importing: boolean;
    handleImportDois: () => void;
    handleSelectRisFile: () => void;
}

export const SidebarDialogs: React.FC<SidebarDialogsProps> = ({
    t, menuAnchor, handleGroupMenuClose, handleRenameClick, handleDeleteClick,
    newGroupDialogOpen, setNewGroupDialogOpen, newGroupName, setNewGroupName, handleCreateGroup,
    renameDialogOpen, setRenameDialogOpen, renameName, setRenameName, handleRenameConfirm,
    importDialogOpen, setImportDialogOpen, importDois, setImportDois, importing, handleImportDois, handleSelectRisFile
}) => {
    return (
        <>
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleGroupMenuClose}
            >
                <MenuItem onClick={handleRenameClick}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    {t('app.rename') || "Rename"}
                </MenuItem>
                <MenuItem onClick={handleDeleteClick}>
                    <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
                    {t('app.delete') || "Delete"}
                </MenuItem>
            </Menu>

            <Dialog open={newGroupDialogOpen} onClose={() => setNewGroupDialogOpen(false)}>
                <DialogTitle>{t('app.new_group') || "Create New Group"}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label={t('app.group_name') || "Group Name"}
                        fullWidth
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNewGroupDialogOpen(false)}>{t('app.cancel') || "Cancel"}</Button>
                    <Button onClick={handleCreateGroup} variant="contained">{t('app.create') || "Create"}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
                <DialogTitle>{t('app.rename_group') || "Rename Group"}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label={t('app.group_name') || "Group Name"}
                        fullWidth
                        value={renameName}
                        onChange={(e) => setRenameName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleRenameConfirm()}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRenameDialogOpen(false)}>{t('app.cancel') || "Cancel"}</Button>
                    <Button onClick={handleRenameConfirm} variant="contained">{t('app.save') || "Save"}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={importDialogOpen} onClose={() => !importing && setImportDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t('app.import_title') || "Manual Import"}</DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            {t('app.import_doi_batch') || "Batch DOI Import (One per line)"}
                        </Typography>
                        <TextField
                            autoFocus
                            margin="dense"
                            fullWidth
                            multiline
                            rows={4}
                            value={importDois}
                            onChange={(e) => setImportDois(e.target.value)}
                            disabled={importing}
                            placeholder="10.1038/s41586-021-03430-8&#10;10.1126/science.abc1234"
                            variant="outlined"
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                            <Button
                                onClick={handleImportDois}
                                variant="contained"
                                disabled={importing || !importDois.trim()}
                                size="small"
                            >
                                {importing ? (t('app.loading') || "Loading...") : (t('app.import_doi') || "Import DOI")}
                            </Button>
                        </Box>
                    </Box>

                    <Divider sx={{ my: 2 }}>OR</Divider>

                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            {t('app.import_ris_file') || "Import RIS File"}
                        </Typography>
                        <Box
                            sx={{
                                border: '2px dashed',
                                borderColor: 'text.secondary',
                                borderRadius: 1,
                                p: 3,
                                textAlign: 'center',
                                cursor: importing ? 'default' : 'pointer',
                                bgcolor: 'action.hover',
                                '&:hover': {
                                    bgcolor: importing ? 'action.hover' : 'action.selected'
                                }
                            }}
                            onClick={!importing ? handleSelectRisFile : undefined}
                        >
                            <Typography color="textSecondary">
                                {t('app.click_to_select_ris') || "Click to select .ris file"}
                            </Typography>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setImportDialogOpen(false)} disabled={importing}>{t('app.close') || "Close"}</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};
