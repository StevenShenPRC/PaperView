import React from 'react';
import { Accordion, AccordionSummary, AccordionDetails, List, ListItem, ListItemButton, ListItemText, Box, Typography, Tooltip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PublishIcon from '@mui/icons-material/Publish';
import { Batch } from '../../../types';
import { formatLocalTime } from '../../../utils/time';

interface BatchesAccordionProps {
    t: any;
    collapsed: boolean;
    expandedBatches: boolean;
    setExpandedBatches: (expanded: boolean) => void;
    onToggleCollapse: () => void;
    batches: Batch[];
    selectedBatchId: number | null;
    onSelectBatch: (batch: Batch) => void;
}

export const BatchesAccordion: React.FC<BatchesAccordionProps> = ({
    t, collapsed, expandedBatches, setExpandedBatches, onToggleCollapse,
    batches, selectedBatchId, onSelectBatch
}) => {
    const manualBatches = batches.filter(b => b.issueVolume === "PaperView_Manually_Imported");
    manualBatches.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    const otherBatches = batches.filter(b => b.issueVolume !== "PaperView_Manually_Imported");
    const latestManualBatch = manualBatches.length > 0 ? manualBatches[0] : null;

    return (
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
                    {latestManualBatch && (
                        <ListItem key="manual-import-agg" disablePadding sx={{ display: 'block' }}>
                            <Tooltip title={collapsed ? (t('app.manual_import') || "Manual Import") : ""} placement="right">
                                <ListItemButton
                                    selected={selectedBatchId === -1}
                                    onClick={() => onSelectBatch({
                                        id: -1,
                                        journalName: "手动导入",
                                        issueVolume: "PaperView_Manually_Imported",
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
                                                {t('app.latest')}: {formatLocalTime(latestManualBatch.issueDate)}
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
                                        '&.Mui-selected': { bgcolor: 'action.selected', '&:hover': { bgcolor: 'action.hover' } },
                                        '&:hover': { bgcolor: 'action.hover' }
                                    }}
                                >
                                    <ListItemText
                                        primary={batch.journalName}
                                        primaryTypographyProps={{ variant: 'body2', style: { fontWeight: 'bold' } }}
                                        secondary={
                                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                <Typography variant="caption" component="span" sx={{ display: 'block', lineHeight: 1.2 }}>{batch.issueVolume}</Typography>
                                                <Typography variant="caption" component="span" sx={{ display: 'block', lineHeight: 1.2 }}>{formatLocalTime(batch.issueDate)}</Typography>
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
    );
};
