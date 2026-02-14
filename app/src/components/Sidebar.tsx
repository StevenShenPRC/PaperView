import React from 'react';
import {
    Drawer, List, ListItem, ListItemText, ListItemButton,
    Typography, Box, Button, Divider, IconButton, Tooltip,
    ListItemIcon
} from '@mui/material';
import {
    Menu as MenuIcon,
    ChevronLeft as ChevronLeftIcon,
    Settings as SettingsIcon,
    Folder as FolderIcon,
    ExpandMore as ExpandMoreIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon,
    Publish as PublishIcon
} from '@mui/icons-material';
import { Batch, Group } from '../types';
import {
    Accordion, AccordionSummary, AccordionDetails,
    Menu, MenuItem, TextField, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';

import { useTranslation } from 'react-i18next';
import { useDialog } from '../context/DialogContext';
import logoLight from '../assets/logo.svg';
import logoDark from '../assets/logo_dark.svg';
import { useTheme } from '@mui/material/styles';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import store from '../store';
import { useState, useEffect } from 'react';

interface SidebarProps {
    batches: Batch[];
    groups: Group[];
    onSelectBatch: (batch: Batch) => void;
    onSelectGroup: (group: Group) => void;
    selectedBatchId: number | null;
    selectedGroupId: number | null;
    onCreateGroup: (name: string) => void;
    onRenameGroup: (group: Group, name: string) => void;
    onDeleteGroup: (group: Group) => void;
    onSettingsClick: () => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
}

const drawerWidth = 280;
const miniDrawerWidth = 73;

const Sidebar: React.FC<SidebarProps> = ({
    batches, groups, onSelectBatch, onSelectGroup, selectedBatchId, selectedGroupId,
    onCreateGroup, onRenameGroup, onDeleteGroup,
    onSettingsClick, collapsed, onToggleCollapse
}) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const dialog = useDialog();
    const [port, setPort] = useState(8080);

    // Group UI State
    const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");

    // Context Menu State
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [activeGroup, setActiveGroup] = useState<Group | null>(null);

    // Rename Dialog State
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [renameName, setRenameName] = useState("");

    // Accordion State
    const [expandedBatches, setExpandedBatches] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState(true);

    useEffect(() => {
        store.get<number>('server_port').then(p => {
            if (p) setPort(p);
        });
    }, []);

    // ... handlers ...
    const handleCreateGroup = () => {
        if (newGroupName.trim()) {
            onCreateGroup(newGroupName.trim());
            setNewGroupName("");
            setNewGroupDialogOpen(false);
        }
    };

    const handleGroupMenuOpen = (event: React.MouseEvent<HTMLElement>, group: Group) => {
        event.stopPropagation(); // Prevent selection
        setMenuAnchor(event.currentTarget);
        setActiveGroup(group);
    };

    const handleGroupMenuClose = () => {
        setMenuAnchor(null);
        setActiveGroup(null);
    };

    const handleRenameClick = () => {
        if (activeGroup) {
            setRenameName(activeGroup.name);
            setRenameDialogOpen(true);
            setMenuAnchor(null); // Keep activeGroup for dialog
        }
    };

    const handleRenameConfirm = () => {
        if (activeGroup && renameName.trim()) {
            onRenameGroup(activeGroup, renameName.trim());
            setRenameDialogOpen(false);
            setActiveGroup(null);
        }
    };

    const handleDeleteClick = async () => {
        if (activeGroup) {
            const confirmed = await dialog.confirm(t('app.confirm_delete_group') || "Delete this group?", {
                title: t('app.delete_group') || "Delete Group"
            });
            if (confirmed) {
                onDeleteGroup(activeGroup);
            }
            setMenuAnchor(null);
            setActiveGroup(null);
        }
    };

    const handleInstallScript = async () => {
        const url = `http://localhost:${port}/paperview.user.js`;
        try {
            await openUrl(url);
        } catch (e) {
            console.error("Failed to open script url", e);
        }
    };

    // DOI Import State
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importDois, setImportDois] = useState("");
    const [importing, setImporting] = useState(false);

    const handleImportDois = async () => {
        if (!importDois.trim()) return;
        setImporting(true);
        try {
            const dois = importDois.split('\n').map(d => d.trim()).filter(d => d);
            await invoke('import_from_doi', {
                dois: dois,
                groupId: selectedGroupId
            });
            setImportDois("");
            setImportDialogOpen(false);
            dialog.alert(t('app.import_success') || "Import successful");
        } catch (e) {
            console.error("Import failed:", e);
            dialog.alert("Import failed: " + e);
        } finally {
            setImporting(false);
        }
    };

    const handleSelectRisFile = async () => {
        try {
            const selected = await openFileDialog({
                multiple: false,
                filters: [{
                    name: 'RIS File',
                    extensions: ['ris']
                }]
            });

            if (selected) {
                setImporting(true);
                const path = selected as string;
                // Read file content
                const content = await readTextFile(path);
                await invoke('import_ris', {
                    risContent: content,
                    groupId: selectedGroupId
                });
                setImportDialogOpen(false);
                dialog.alert(t('app.import_success') || "Import successful");
                setImporting(false);
            }
        } catch (e) {
            console.error("File selection failed", e);
            setImporting(false);
        }
    };

    // Aggregate batches
    const manualBatches = batches.filter(b => b.issueVolume === "PaperView_Manually_Imported");
    // Sort by date desc
    manualBatches.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());

    const otherBatches = batches.filter(b => b.issueVolume !== "PaperView_Manually_Imported");

    // Create a virtual batch for Manual Import aggregation if needed
    // Actually we can just show one item if manualBatches > 0
    const latestManualBatch = manualBatches.length > 0 ? manualBatches[0] : null;

    return (
        <Drawer
            variant="permanent"
            sx={(theme) => ({
                width: collapsed ? miniDrawerWidth : drawerWidth, // Dynamic width at root level pushes content
                flexShrink: 0,
                whiteSpace: 'nowrap',
                transition: theme.transitions.create('width', {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.enteringScreen,
                }),
                [`& .MuiDrawer-paper`]: {
                    width: collapsed ? miniDrawerWidth : drawerWidth,
                    boxSizing: 'border-box',
                    overflowX: 'hidden',
                    transition: theme.transitions.create('width', {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.enteringScreen,
                    }),
                },
            })}
        >
            <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
                {!collapsed && (
                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, overflow: 'hidden' }}>
                        <img
                            src={theme.palette.mode === 'dark' ? logoDark : logoLight}
                            alt="Logo"
                            style={{ height: '32px', marginRight: '10px' }}
                        />
                        <Typography variant="h6" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            PaperView
                        </Typography>
                    </Box>
                )}
                <Box>
                    <IconButton onClick={onToggleCollapse}>
                        {collapsed ? <MenuIcon /> : <ChevronLeftIcon />}
                    </IconButton>
                </Box>
            </Box>
            <Divider />

            <Box sx={{ overflowX: 'hidden', overflowY: 'auto', flex: 1 }}>
                {/* Imported Batches Accordion */}
                <Accordion
                    expanded={!collapsed && expandedBatches}
                    onChange={(_, ex) => {
                        if (collapsed) {
                            if (onToggleCollapse) onToggleCollapse();
                        } else {
                            setExpandedBatches(ex);
                        }
                    }}
                    disableGutters
                    sx={{ boxShadow: 'none', '&:before': { display: 'none' }, bgcolor: 'transparent', width: '100%' }}
                >
                    <AccordionSummary
                        expandIcon={!collapsed && <ExpandMoreIcon />}
                        sx={{
                            minHeight: 48,
                            px: collapsed ? 0 : 2,
                            justifyContent: 'center',
                            '& .MuiAccordionSummary-content': {
                                flexGrow: 1,
                                display: 'flex',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                m: 0
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', minWidth: 24 }}>
                            <PublishIcon color="action" sx={{ mr: collapsed ? 0 : 2 }} />
                            {!collapsed && (
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                    {t('app.batches') || "Imported Batches"}
                                </Typography>
                            )}
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                        <List disablePadding>
                            {/* Manual Import Aggregated Item */}
                            {latestManualBatch && (
                                <ListItem key="manual-import-agg" disablePadding sx={{ display: 'block' }}>
                                    <Tooltip title={collapsed ? (t('app.manual_import') || "Manual Import") : ""} placement="right">
                                        <ListItemButton
                                            selected={selectedBatchId === -1}
                                            onClick={() => onSelectBatch({
                                                id: -1,
                                                journalName: "手动导入",
                                                issueVolume: "PaperView_Manually_Imported", // Unified volume
                                                issueDate: ""
                                            } as any)}
                                            sx={{
                                                minHeight: 40,
                                                px: collapsed ? 1.5 : 2.5,
                                                pl: collapsed ? 1.5 : 4,
                                                justifyContent: collapsed ? 'center' : 'initial',
                                                '&.Mui-selected': { bgcolor: 'action.selected', '&:hover': { bgcolor: 'action.hover' } },
                                                '&:hover': { bgcolor: 'action.hover' }
                                            }}
                                        >
                                            <ListItemText
                                                primary={t('app.manual_import') || "Manual Import"}
                                                primaryTypographyProps={{ variant: 'body2', style: { fontWeight: 'bold' } }}
                                                secondary={
                                                    <Typography variant="caption" component="span" sx={{ display: 'block', lineHeight: 1.2 }}>
                                                        {t('app.latest')}: {latestManualBatch.issueDate}
                                                    </Typography>
                                                }
                                                secondaryTypographyProps={{ component: 'div' }}
                                                sx={{ m: 0 }}
                                            />
                                        </ListItemButton>
                                    </Tooltip>
                                </ListItem>
                            )}

                            {otherBatches.map((batch) => (
                                <ListItem key={batch.id} disablePadding sx={{ display: 'block' }}>
                                    <Tooltip title={collapsed ? `${batch.journalName} - ${batch.issueVolume}` : ""} placement="right">
                                        <ListItemButton
                                            selected={selectedBatchId === batch.id}
                                            onClick={() => onSelectBatch(batch)}
                                            sx={{
                                                minHeight: 40,
                                                px: collapsed ? 1.5 : 2.5,
                                                pl: collapsed ? 1.5 : 4,
                                                justifyContent: collapsed ? 'center' : 'initial',
                                                '&.Mui-selected': {
                                                    bgcolor: 'action.selected',
                                                    '&:hover': {
                                                        bgcolor: 'action.hover',
                                                    }
                                                },
                                                '&:hover': {
                                                    bgcolor: 'action.hover',
                                                    // ... 
                                                }
                                            }}
                                        >
                                            <ListItemText
                                                primary={batch.journalName}
                                                primaryTypographyProps={{
                                                    variant: 'body2',
                                                    style: { fontWeight: 'bold' }
                                                }}
                                                secondary={
                                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                        <Typography variant="caption" component="span" sx={{ display: 'block', lineHeight: 1.2 }}>{batch.issueVolume}</Typography>
                                                        <Typography variant="caption" component="span" sx={{ display: 'block', lineHeight: 1.2 }}>{batch.issueDate}</Typography>
                                                    </Box>
                                                }
                                                secondaryTypographyProps={{ component: 'div' }}
                                                sx={{ m: 0 }}
                                            />
                                        </ListItemButton>
                                    </Tooltip>
                                </ListItem>
                            ))}
                        </List>
                    </AccordionDetails>
                </Accordion>

                <Divider />

                {/* My Groups Accordion */}
                <Accordion
                    expanded={!collapsed && expandedGroups}
                    onChange={(_, ex) => {
                        if (collapsed) {
                            if (onToggleCollapse) onToggleCollapse();
                        } else {
                            setExpandedGroups(ex);
                        }
                    }}
                    disableGutters
                    sx={{ boxShadow: 'none', '&:before': { display: 'none' }, bgcolor: 'transparent', width: '100%' }}
                >
                    <AccordionSummary
                        expandIcon={!collapsed && <ExpandMoreIcon />}
                        sx={{
                            minHeight: 48,
                            px: collapsed ? 0 : 2,
                            justifyContent: 'center',
                            '& .MuiAccordionSummary-content': {
                                flexGrow: 1,
                                display: 'flex',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                m: 0
                            }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: collapsed ? 0 : 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <FolderIcon color="action" sx={{ mr: collapsed ? 0 : 2 }} />
                                {!collapsed && (
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                        {t('app.my_groups') || "My Groups"}
                                    </Typography>
                                )}
                            </Box>
                            {!collapsed && (
                                <Tooltip title={t('app.import_from_doi')}>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setImportDialogOpen(true);
                                        }}
                                        color="primary"
                                        sx={{ ml: 'auto', mr: 1 }}
                                    >
                                        <AddIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                        {!collapsed && (
                            <Box sx={{ px: 2, py: 1 }}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    fullWidth
                                    onClick={() => setNewGroupDialogOpen(true)}
                                >
                                    {t('app.new_group') || "New Group"}
                                </Button>
                            </Box>
                        )}
                        <List disablePadding>
                            {groups.map((group) => (
                                <ListItem
                                    key={group.id}
                                    disablePadding
                                    sx={{ display: 'block' }}
                                    secondaryAction={!collapsed && (
                                        <IconButton size="small" onClick={(e) => handleGroupMenuOpen(e, group)}>
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                >
                                    <Tooltip title={collapsed ? group.name : ""} placement="right">
                                        <ListItemButton
                                            selected={selectedGroupId === group.id}
                                            onClick={() => onSelectGroup(group)}
                                            sx={{
                                                minHeight: 40,
                                                px: collapsed ? 1.5 : 2.5,
                                                pl: collapsed ? 1.5 : 4,
                                                justifyContent: collapsed ? 'center' : 'initial',
                                                '&.Mui-selected': {
                                                    bgcolor: 'action.selected',
                                                    '&:hover': {
                                                        bgcolor: 'action.hover',
                                                    }
                                                },
                                                '&:hover': {
                                                    bgcolor: 'action.hover',
                                                }
                                            }}
                                        >
                                            <ListItemText
                                                primary={group.name}
                                                primaryTypographyProps={{ variant: 'body2' }}
                                                sx={{ m: 0, pr: 2 }}
                                            />
                                        </ListItemButton>
                                    </Tooltip>
                                </ListItem>
                            ))}
                        </List>
                    </AccordionDetails>
                </Accordion>
            </Box>

            {/* Dialogs & Menus */}
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
                    <Button onClick={() => setNewGroupDialogOpen(false)}>{t('app.cancel')}</Button>
                    <Button onClick={handleCreateGroup} variant="contained">{t('app.create')}</Button>
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
                    <Button onClick={() => setRenameDialogOpen(false)}>{t('app.cancel')}</Button>
                    <Button onClick={handleRenameConfirm} variant="contained">{t('app.save')}</Button>
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
                            placeholder="10.1038/s41586-021-03430-8
10.1126/science.abc1234"
                            variant="outlined"
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                            <Button
                                onClick={handleImportDois}
                                variant="contained"
                                disabled={importing || !importDois.trim()}
                                size="small"
                            >
                                {importing ? t('app.loading') : t('app.import_doi')}
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
                    <Button onClick={() => setImportDialogOpen(false)} disabled={importing}>{t('app.close')}</Button>
                </DialogActions>
            </Dialog>

            <Divider />



            <List>
                {/* Install Script Link */}
                <ListItem key="install-script" disablePadding sx={{ display: 'block' }}>
                    <ListItemButton
                        sx={{
                            minHeight: 48,
                            justifyContent: collapsed ? 'center' : 'initial',
                            px: 2.5,
                        }}
                        onClick={handleInstallScript}
                    >
                        <ListItemIcon
                            sx={{
                                minWidth: 0,
                                mr: collapsed ? 'auto' : 3,
                                justifyContent: 'center',
                            }}
                        >
                            <Box sx={{ fontWeight: 'bold', fontSize: '1.2rem' }}>JS</Box>
                        </ListItemIcon>
                        <ListItemText primary={t('app.install_script') || "Install Script"} sx={{ opacity: collapsed ? 0 : 1 }} />
                    </ListItemButton>
                </ListItem>
            </List>

            <Divider />

            {/* Settings Section */}
            <Box sx={{ p: collapsed ? 1 : 2, display: 'flex', justifyContent: 'center' }}>
                {collapsed ? (
                    <Tooltip title={t('app.settings')} placement="right">
                        <IconButton onClick={onSettingsClick}>
                            <SettingsIcon />
                        </IconButton>
                    </Tooltip>
                ) : (
                    <Button
                        variant="outlined"
                        fullWidth
                        startIcon={<SettingsIcon />}
                        onClick={onSettingsClick}
                    >
                        {t('app.settings')}
                    </Button>
                )}
            </Box>
        </Drawer >
    );
};

export default Sidebar;
