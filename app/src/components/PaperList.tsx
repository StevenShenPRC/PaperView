import React from 'react';
import {
    Box, Typography, Menu,
    MenuItem, ListItemIcon, ListItemText, Divider,
    Checkbox, Accordion, AccordionSummary, AccordionDetails,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ChatIcon from '@mui/icons-material/Chat';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../context/DialogContext';
import { Virtuoso } from 'react-virtuoso';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

import { Paper, PaperPdf, Group, PendingContext, ContextItem, Batch } from '../types';
import { formatLocalTime } from '../utils/time';
import { PaperCardItem } from './PaperList/PaperCardItem';
import { BatchActionToolbar } from './PaperList/BatchActionToolbar';

interface PaperListProps {
    papers: Paper[];
    onUpdateMetadata: (paper: Paper) => Promise<void>;
    onTranslate: (paper: Paper) => void;
    onBatchTranslate?: (papers: Paper[]) => void;
    onReadPdf?: (paper: Paper, pdf: PaperPdf) => void;
    batch: Batch | null;
    /** When true (PDF reader is open), abstracts collapse by default */
    readerActive?: boolean;
    groups: Group[];
    selectedGroupId: number | null;
    onAddToGroup: (paperIds: number[], groupId: number) => void;
    onRemoveFromGroup: (paperIds: number[], groupId: number) => void;
    onContextSelect?: (ctx: PendingContext) => void;
}

const PaperList: React.FC<PaperListProps> = ({
    papers, onUpdateMetadata, onTranslate, onBatchTranslate, onReadPdf, batch, readerActive = false,
    groups, selectedGroupId, onAddToGroup, onRemoveFromGroup, onContextSelect
}) => {
    const { t } = useTranslation();
    const dialog = useDialog();

    const [updatingIds, setUpdatingIds] = React.useState<Set<number>>(new Set());
    const [attachingIds, setAttachingIds] = React.useState<Set<number>>(new Set());

    // Selection State
    const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
    const [lastSelectedId, setLastSelectedId] = React.useState<number | null>(null);

    // Group Menu State
    const [groupMenuAnchor, setGroupMenuAnchor] = React.useState<null | HTMLElement>(null);

    // PDF menu anchor state
    const [pdfMenuAnchor, setPdfMenuAnchor] = React.useState<null | HTMLElement>(null);
    const [pdfMenuPaper, setPdfMenuPaper] = React.useState<Paper | null>(null);

    // Context Menu State
    const [selectedContextText, setSelectedContextText] = React.useState('');
    const [contextSourcePaper, setContextSourcePaper] = React.useState<Paper | null>(null);
    const [contextSourceLabel, setContextSourceLabel] = React.useState('');

    React.useEffect(() => {
        setSelectedIds(new Set());
        setLastSelectedId(null);
    }, [batch?.id, selectedGroupId]);

    const handleSelectPaper = React.useCallback((id: number, shiftKey: boolean) => {
        setSelectedIds(prev => {
            const newSelected = new Set(prev);

            if (newSelected.has(id)) {
                newSelected.delete(id);
                setLastSelectedId(id); // Keep last selected for shift-click range start, even if deselected
            } else {
                newSelected.add(id);

                // Handle shift select (range)
                if (shiftKey && lastSelectedId !== null) {
                    const start = papers.findIndex(p => p.id === lastSelectedId);
                    const end = papers.findIndex(p => p.id === id);

                    if (start !== -1 && end !== -1) {
                        const lower = Math.min(start, end);
                        const upper = Math.max(start, end);

                        // Add all items in range
                        for (let i = lower; i <= upper; i++) {
                            newSelected.add(papers[i].id);
                        }
                    }
                }
                setLastSelectedId(id);
            }
            return newSelected;
        });
    }, [papers, lastSelectedId]);

    const handleSelectAll = () => {
        if (selectedIds.size === papers.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(papers.map(p => p.id)));
        }
    };

    const handleAddToGroupClick = (group: Group) => {
        onAddToGroup(Array.from(selectedIds), group.id);
        setGroupMenuAnchor(null);
        setSelectedIds(new Set());
    };

    const handleRemoveFromGroupClick = () => {
        if (selectedGroupId) {
            onRemoveFromGroup(Array.from(selectedIds), selectedGroupId);
            setSelectedIds(new Set());
        }
    };

    const handleUpdateClick = React.useCallback(async (paper: Paper) => {
        setUpdatingIds(prev => new Set(prev).add(paper.id));
        try {
            await onUpdateMetadata(paper);
        } catch (e) {
            // Error handled in parent
        } finally {
            setUpdatingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(paper.id);
                return newSet;
            });
        }
    }, [onUpdateMetadata]);

    const handleBatchTranslate = () => {
        const selectedPapers = papers.filter(p => selectedIds.has(p.id));
        if (onBatchTranslate) {
            onBatchTranslate(selectedPapers);
        } else {
            for (const paper of selectedPapers) {
                onTranslate(paper);
            }
        }
        setSelectedIds(new Set());
    };

    const [exportMenuAnchor, setExportMenuAnchor] = React.useState<null | HTMLElement>(null);
    const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
    const [exportContent, setExportContent] = React.useState('');
    const [exportFormat, setExportFormat] = React.useState<'ris' | 'bibtex'>('ris');

    const handleExportReferences = async (format: 'ris' | 'bibtex') => {
        setExportMenuAnchor(null);
        try {
            const paperIds = Array.from(selectedIds);
            const content: string = await invoke('export_references', { paperIds, format });

            setExportContent(content);
            setExportFormat(format);
            setExportDialogOpen(true);
        } catch (e) {
            console.error("Export failed:", e);
            dialog.alert("Export failed: " + e);
        }
    };

    const handleExportCopy = async () => {
        try {
            await navigator.clipboard.writeText(exportContent);
            dialog.alert(t('app.copied') || "Copied");
        } catch (e) {
            console.error("Copy failed:", e);
        }
    };

    const handleExportSave = async () => {
        try {
            const path = await save({
                filters: [{
                    name: exportFormat === 'ris' ? 'RIS File' : 'BibTeX File',
                    extensions: [exportFormat === 'ris' ? 'ris' : 'bib']
                }],
                defaultPath: `export.${exportFormat === 'ris' ? 'ris' : 'bib'}`
            });

            if (path) {
                await writeTextFile(path, exportContent);
                setExportDialogOpen(false);
                setExportContent('');
                setSelectedIds(new Set()); // Clear selection after successful save
                dialog.alert(t('app.export_success') || "Export Successful");
            }
        } catch (e) {
            console.error("Save failed:", e);
            dialog.alert("Save failed: " + e);
        }
    };

    const handleBatchUpdate = async () => {
        const selectedPapers = papers.filter(p => selectedIds.has(p.id));
        for (const paper of selectedPapers) {
            handleUpdateClick(paper);
        }
        setSelectedIds(new Set());
    };

    const handleAttachPdf = React.useCallback(async (paper: Paper) => {
        try {
            const filePath = await open({
                multiple: false,
                filters: [{ name: 'PDF', extensions: ['pdf'] }],
            });

            if (!filePath) return;

            setAttachingIds(prev => new Set(prev).add(paper.id));

            await invoke('attach_pdf', {
                id: paper.id,
                sourcePath: filePath,
            });

        } catch (error) {
            console.error('Failed to attach PDF:', error);
            dialog.alert('Failed to attach PDF: ' + error);
        } finally {
            setAttachingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(paper.id);
                return newSet;
            });
        }
    }, [dialog]);

    const handleDeletePdf = async (pdf: PaperPdf) => {
        try {
            await invoke('delete_pdf_command', {
                pdfId: pdf.id,
                paperId: pdf.paper_id,
                filename: pdf.filename,
            });
        } catch (error) {
            console.error('Failed to delete PDF:', error);
            dialog.alert('Failed to delete PDF: ' + error);
        }
        setPdfMenuAnchor(null);
        setPdfMenuPaper(null);
    };

    const handleOpenPdfMenu = React.useCallback((event: React.MouseEvent<HTMLElement>, paper: Paper) => {
        setPdfMenuAnchor(event.currentTarget as HTMLElement);
        setPdfMenuPaper(paper);
    }, []);

    const handleClosePdfMenu = () => {
        setPdfMenuAnchor(null);
        setPdfMenuPaper(null);
    };

    const [contextMenuPos, setContextMenuPos] = React.useState<{ top: number, left: number } | null>(null);

    const handleContextMenuOpen = React.useCallback((event: React.MouseEvent, text: string, paper: Paper, label: string) => {
        event.preventDefault();
        event.stopPropagation();
        const selection = window.getSelection();
        const selectedText = selection && selection.toString().trim().length > 0 ? selection.toString() : text;

        setSelectedContextText(selectedText);
        setContextSourcePaper(paper);
        setContextSourceLabel(label);
        setContextMenuPos({
            top: event.clientY,
            left: event.clientX,
        });
    }, []);

    const handleContextAction = (action: 'copy' | 'new' | 'append') => {
        if (!selectedContextText) return;

        if (action === 'copy') {
            navigator.clipboard.writeText(selectedContextText);
        } else if (onContextSelect && contextSourcePaper) {
            const item: ContextItem = {
                id: Date.now().toString(), // Simple ID
                text: selectedContextText,
                source: contextSourcePaper.title,
                label: contextSourceLabel
            };

            onContextSelect({
                items: [item],
                mode: action === 'new' ? 'new' : 'append'
            });
        }

        setContextMenuPos(null);
    };

    const renderPaperCard = React.useCallback((paper: Paper) => {
        return (
            <PaperCardItem
                paper={paper}
                isSelected={selectedIds.has(paper.id)}
                isUpdating={updatingIds.has(paper.id)}
                isAttaching={attachingIds.has(paper.id)}
                readerActive={readerActive}
                t={t}
                formatLocalTime={formatLocalTime}
                onSelect={handleSelectPaper}
                onContextMenu={handleContextMenuOpen}
                onReadPdf={onReadPdf}
                onOpenPdfMenu={handleOpenPdfMenu}
                onAttachPdf={handleAttachPdf}
                onTranslate={onTranslate}
                onUpdateMetadata={handleUpdateClick}
            />
        );
    }, [selectedIds, updatingIds, attachingIds, readerActive, t, handleSelectPaper, handleContextMenuOpen, onReadPdf, handleOpenPdfMenu, handleAttachPdf, onTranslate, handleUpdateClick]);

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <Box sx={{ flexShrink: 0, mb: 2 }}>
                <Typography variant="h5" component="span" sx={{ fontWeight: 'bold' }}>
                    {batch ? batch.journalName : t('app.papers')}
                </Typography>
                {batch && (
                    <Typography
                        variant="body1"
                        component="span"
                        color="text.secondary"
                        sx={{ ml: 2, display: 'inline-block' }}
                    >
                        {`${batch.issueVolume} - ${formatLocalTime(batch.issueDate)}`}
                    </Typography>
                )}
            </Box>

            <BatchActionToolbar
                selectedCount={selectedIds.size}
                selectedGroupId={selectedGroupId}
                t={t}
                onClearSelection={() => setSelectedIds(new Set())}
                onBatchTranslate={handleBatchTranslate}
                onBatchUpdate={handleBatchUpdate}
                onExportMenuOpen={(e) => setExportMenuAnchor(e.currentTarget)}
                onGroupMenuOpen={(e) => setGroupMenuAnchor(e.currentTarget)}
                onRemoveFromGroup={handleRemoveFromGroupClick}
                exportMenuAnchor={exportMenuAnchor}
                onExportMenuClose={() => setExportMenuAnchor(null)}
                onExportReferences={handleExportReferences}
            />

            <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                <Checkbox
                    checked={papers.length > 0 && selectedIds.size === papers.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < papers.length}
                    onChange={handleSelectAll}
                />
                <Typography variant="caption" color="textSecondary" onClick={handleSelectAll} sx={{ cursor: 'pointer' }}>
                    {t('app.select_all') || "Select All"}
                </Typography>
            </Box>

            {batch?.issueVolume === "PaperView_Manually_Imported" ? (
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    {Object.entries(
                        papers.reduce((acc, paper) => {
                            const date = formatLocalTime(paper.issueDate) || "Unknown Date";
                            if (!acc[date]) acc[date] = [];
                            acc[date].push(paper);
                            return acc;
                        }, {} as Record<string, Paper[]>)
                    ).sort((a, b) => b[0].localeCompare(a[0])) // Sort by date desc
                        .map(([date, groupPapers]) => (
                            <Accordion
                                key={date}
                                defaultExpanded
                                disableGutters
                                elevation={0}
                                sx={{ '&:before': { display: 'none' }, borderBottom: 1, borderColor: 'divider' }}
                                slotProps={{ transition: { timeout: 500 } }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={{
                                        bgcolor: 'background.paper',
                                        minHeight: 48,
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 1
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }} onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            size="small"
                                            checked={groupPapers.every(p => selectedIds.has(p.id))}
                                            indeterminate={groupPapers.some(p => selectedIds.has(p.id)) && !groupPapers.every(p => selectedIds.has(p.id))}
                                            onChange={(e) => {
                                                const newSelected = new Set(selectedIds);
                                                const isChecked = e.target.checked;
                                                groupPapers.forEach(p => {
                                                    if (isChecked) newSelected.add(p.id);
                                                    else newSelected.delete(p.id);
                                                });
                                                setSelectedIds(newSelected);
                                            }}
                                            sx={{ mr: 1, p: 0.5 }}
                                        />
                                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                            {date} ({groupPapers.length})
                                        </Typography>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ p: 0 }}>
                                    {groupPapers.map((paper) => (
                                        <Box key={paper.id} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                                            {renderPaperCard(paper)}
                                        </Box>
                                    ))}
                                </AccordionDetails>
                            </Accordion>
                        ))}
                </Box>
            ) : (
                <Virtuoso
                    style={{ flex: 1 }}
                    data={papers}
                    itemContent={(_index: number, paper: Paper) => (
                        <Box sx={{ pb: 2 }}>
                            {renderPaperCard(paper)}
                        </Box>
                    )}
                />
            )}

            <Menu
                anchorEl={pdfMenuAnchor}
                open={Boolean(pdfMenuAnchor)}
                onClose={handleClosePdfMenu}
            >
                {pdfMenuPaper?.pdfs.map((pdf) => (
                    <Box key={pdf.id}>
                        <MenuItem onClick={() => {
                            onReadPdf?.(pdfMenuPaper!, pdf);
                            handleClosePdfMenu();
                        }}>
                            <ListItemIcon>
                                <PictureAsPdfIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={pdf.display_name} secondary={pdf.added_time} />
                        </MenuItem>
                        <MenuItem onClick={() => handleDeletePdf(pdf)} sx={{ color: 'error.main' }}>
                            <ListItemIcon>
                                <DeleteIcon fontSize="small" color="error" />
                            </ListItemIcon>
                            <ListItemText primary={t('app.delete_pdf')} />
                        </MenuItem>
                        <Divider />
                    </Box>
                ))}
            </Menu>

            <Menu
                anchorEl={groupMenuAnchor}
                open={Boolean(groupMenuAnchor)}
                onClose={() => setGroupMenuAnchor(null)}
            >
                {groups.map(group => (
                    <MenuItem key={group.id} onClick={() => handleAddToGroupClick(group)}>
                        <ListItemIcon><FolderIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary={group.name} />
                    </MenuItem>
                ))}
                {groups.length === 0 && (
                    <MenuItem disabled>
                        <ListItemText primary={t('app.no_groups') || "No groups available"} />
                    </MenuItem>
                )}
            </Menu>

            <Menu
                open={contextMenuPos !== null}
                onClose={() => setContextMenuPos(null)}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenuPos !== null
                        ? { top: contextMenuPos.top, left: contextMenuPos.left }
                        : undefined
                }
            >
                <MenuItem onClick={() => handleContextAction('copy')}>
                    <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>{t('app.copy') || "Copy"}</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleContextAction('new')}>
                    <ListItemIcon><ChatIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>{t('app.chat_new_context') || "New Chat with Context"}</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleContextAction('append')}>
                    <ListItemIcon><PlaylistAddIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>{t('app.chat_append_context') || "Append to Chat"}</ListItemText>
                </MenuItem>
            </Menu>

            <Dialog
                open={exportDialogOpen}
                onClose={() => setExportDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>{t('app.export_title') || "Export References"}</DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 2 }}>
                        <TextField
                            multiline
                            fullWidth
                            rows={15}
                            value={exportContent}
                            variant="outlined"
                            InputProps={{
                                readOnly: true,
                                sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                            }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setExportDialogOpen(false)}>
                        {t('app.close') || "Close"}
                    </Button>
                    <Button onClick={handleExportCopy} startIcon={<ContentCopyIcon />}>
                        {t('app.export_copy') || "Copy"}
                    </Button>
                    <Button onClick={handleExportSave} variant="contained" startIcon={<FolderIcon />}>
                        {t('app.export_file') || "Save as File"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default PaperList;
