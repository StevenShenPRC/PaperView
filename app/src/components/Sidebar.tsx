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
    Article as ArticleIcon
} from '@mui/icons-material';
import { Batch } from '../types';

import { useTranslation } from 'react-i18next';

interface SidebarProps {
    batches: Batch[];
    onSelectBatch: (batch: Batch) => void;
    selectedBatchId: number | null;
    onSettingsClick: () => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
}

const drawerWidth = 280;
const miniDrawerWidth = 73; // Width of collapsed sidebar (approx theme.spacing(9) + 1)

const Sidebar: React.FC<SidebarProps> = ({
    batches, onSelectBatch, selectedBatchId, onSettingsClick,
    collapsed, onToggleCollapse
}) => {
    const { t } = useTranslation();

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
                    <Typography variant="h6" sx={{ ml: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        PaperView
                    </Typography>
                )}
                <IconButton onClick={onToggleCollapse}>
                    {collapsed ? <MenuIcon /> : <ChevronLeftIcon />}
                </IconButton>
            </Box>
            <Divider />

            <Box sx={{ overflowX: 'hidden', overflowY: 'auto', flex: 1 }}>
                {!collapsed && (
                    <>
                        <Typography variant="subtitle2" color="textSecondary" sx={{ px: 2, py: 1 }}>
                            {t('app.batches')}
                        </Typography>
                        <List>
                            {batches.map((batch) => (
                                <ListItem key={batch.id} disablePadding sx={{ display: 'block' }}>
                                    <Tooltip title={collapsed ? `${batch.journalName} - ${batch.issueVolume}` : ""} placement="right">
                                        <ListItemButton
                                            selected={selectedBatchId === batch.id}
                                            onClick={() => onSelectBatch(batch)}
                                            sx={{
                                                minHeight: 48,
                                                justifyContent: collapsed ? 'center' : 'initial',
                                                px: 2.5,
                                                alignItems: 'flex-start', // Align to top for multi-line
                                                py: 1.5 // Add some vertical padding
                                            }}
                                        >
                                            <ListItemIcon
                                                sx={{
                                                    minWidth: 0,
                                                    mr: collapsed ? 0 : 3,
                                                    justifyContent: 'center',
                                                    mt: 0.5 // Align icon with first line
                                                }}
                                            >
                                                <ArticleIcon />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={batch.journalName}
                                                primaryTypographyProps={{
                                                    style: {
                                                        whiteSpace: 'normal',
                                                        fontWeight: 'bold',
                                                        wordBreak: 'break-word'
                                                    }
                                                }}
                                                secondary={
                                                    <Box component="span" sx={{ display: 'flex', flexDirection: 'column' }}>
                                                        <Typography component="span" variant="body2" color="text.primary" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                                            {batch.issueVolume}
                                                        </Typography>
                                                        <Typography component="span" variant="caption" color="text.secondary" sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                                            {batch.issueDate}
                                                        </Typography>
                                                    </Box>
                                                }
                                                secondaryTypographyProps={{
                                                    component: 'div',
                                                    style: { whiteSpace: 'normal' }
                                                }}
                                                sx={{ opacity: collapsed ? 0 : 1, my: 0 }}
                                            />
                                        </ListItemButton>
                                    </Tooltip>
                                </ListItem>
                            ))}
                        </List>
                    </>
                )}
            </Box>

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
