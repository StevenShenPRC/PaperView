import React, { useState, useEffect } from 'react';
import { Drawer, List, ListItem, ListItemText, ListItemButton, Typography, Box, Button, Divider, IconButton, Tooltip, ListItemIcon } from '@mui/material';
import { Menu as MenuIcon, ChevronLeft as ChevronLeftIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useDialog } from '../../context/DialogContext';
import store from '../../store';
import { Batch, Group } from '../../types';

import logoLight from '../../assets/logo.svg';
import logoDark from '../../assets/logo_dark.svg';

import { useSidebarActions } from './hooks/useSidebarActions';
import { BatchesAccordion } from './components/BatchesAccordion';
import { GroupsAccordion } from './components/GroupsAccordion';
import { SidebarDialogs } from './components/SidebarDialogs';

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
    const [expandedBatches, setExpandedBatches] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState(true);

    useEffect(() => {
        store.get<number>('server_port').then(p => {
            if (p) setPort(p);
        });
    }, []);

    const actions = useSidebarActions({
        onCreateGroup, onRenameGroup, onDeleteGroup, selectedGroupId, dialog, t
    });

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
                width: collapsed ? miniDrawerWidth : drawerWidth,
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
                <BatchesAccordion
                    t={t}
                    collapsed={collapsed}
                    expandedBatches={expandedBatches}
                    setExpandedBatches={setExpandedBatches}
                    onToggleCollapse={onToggleCollapse}
                    batches={batches}
                    selectedBatchId={selectedBatchId}
                    onSelectBatch={onSelectBatch}
                />
                <Divider />
                <GroupsAccordion
                    t={t}
                    collapsed={collapsed}
                    expandedGroups={expandedGroups}
                    setExpandedGroups={setExpandedGroups}
                    onToggleCollapse={onToggleCollapse}
                    groups={groups}
                    selectedGroupId={selectedGroupId}
                    onSelectGroup={onSelectGroup}
                    setImportDialogOpen={actions.setImportDialogOpen}
                    setNewGroupDialogOpen={actions.setNewGroupDialogOpen}
                    handleGroupMenuOpen={actions.handleGroupMenuOpen}
                />
            </Box>

            <SidebarDialogs t={t} {...actions} />

            <Divider />

            <List>
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
