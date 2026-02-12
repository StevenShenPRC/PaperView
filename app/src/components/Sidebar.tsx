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
import logoLight from '../assets/logo.svg';
import logoDark from '../assets/logo_dark.svg';
import { useTheme } from '@mui/material/styles';
import { openUrl } from '@tauri-apps/plugin-opener';
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

    const handleDeleteClick = () => {
        if (activeGroup) {
            if (confirm(t('app.confirm_delete_group') || "Delete this group?")) {
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
                <IconButton onClick={onToggleCollapse}>
                    {collapsed ? <MenuIcon /> : <ChevronLeftIcon />}
                </IconButton>
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
                            {batches.map((batch) => (
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
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', minWidth: 24 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <FolderIcon color="action" sx={{ mr: collapsed ? 0 : 2 }} />
                                {!collapsed && (
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                        {t('app.my_groups') || "My Groups"}
                                    </Typography>
                                )}
                            </Box>
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
