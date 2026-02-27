import React from 'react';
import { Accordion, AccordionSummary, AccordionDetails, List, ListItem, ListItemButton, ListItemText, Box, Typography, Tooltip, IconButton, Button } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Group } from '../../../types';

interface GroupsAccordionProps {
    t: any;
    collapsed: boolean;
    expandedGroups: boolean;
    setExpandedGroups: (expanded: boolean) => void;
    onToggleCollapse: () => void;
    groups: Group[];
    selectedGroupId: number | null;
    onSelectGroup: (group: Group) => void;
    setImportDialogOpen: (open: boolean) => void;
    setNewGroupDialogOpen: (open: boolean) => void;
    handleGroupMenuOpen: (event: React.MouseEvent<HTMLElement>, group: Group) => void;
}

export const GroupsAccordion: React.FC<GroupsAccordionProps> = ({
    t, collapsed, expandedGroups, setExpandedGroups, onToggleCollapse,
    groups, selectedGroupId, onSelectGroup, setImportDialogOpen, setNewGroupDialogOpen, handleGroupMenuOpen
}) => {
    return (
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
                        <Tooltip title={t('app.import_from_doi') || "Import from DOI"}>
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
                                        '&.Mui-selected': { bgcolor: 'action.selected', '&:hover': { bgcolor: 'action.hover' } },
                                        '&:hover': { bgcolor: 'action.hover' }
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
    );
};
