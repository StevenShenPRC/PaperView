import React from 'react';
import {
    Card, CardContent, Typography, CardActions, Button,
    Box, Chip, Link, Tooltip, IconButton, Menu,
    MenuItem, ListItemIcon, ListItemText, Divider,
    Checkbox, AppBar, Toolbar, Fade
} from '@mui/material';
import { Paper, PaperPdf, Group, PendingContext, ContextItem } from '../types';
import { Batch } from '../types';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ChatIcon from '@mui/icons-material/Chat';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import TranslateIcon from '@mui/icons-material/Translate';
import RefreshIcon from '@mui/icons-material/Refresh';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Badge from '@mui/material/Badge';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOffIcon from '@mui/icons-material/FolderOff';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { Virtuoso } from 'react-virtuoso';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

interface PaperListProps {
    papers: Paper[];
    onUpdateMetadata: (paper: Paper) => Promise<void>;
    onTranslate: (paper: Paper) => void;
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

// Maximum lines to show before collapsing
const ABSTRACT_COLLAPSED_LINES = 3;
const LINE_HEIGHT_EM = 1.5;
const COLLAPSED_MAX_HEIGHT = `${ABSTRACT_COLLAPSED_LINES * LINE_HEIGHT_EM}em`;

/**
 * A collapsible text block with a text-link toggle ("展开"/"收起").
 * The entire gradient overlay area is clickable.
 * Collapsed state is only used when readerActive=true.
 */
const CollapsibleText: React.FC<{
    text: string;
    isHighlighted?: boolean;
    readerActive: boolean;
    expandLabel: string;
    collapseLabel: string;
    onContextMenu?: (e: React.MouseEvent, text: string) => void;
}> = ({ text, isHighlighted, readerActive, expandLabel, collapseLabel, onContextMenu }) => {
    const [expanded, setExpanded] = React.useState(false);
    const textRef = React.useRef<HTMLDivElement>(null);
    const [needsCollapse, setNeedsCollapse] = React.useState(false);

    // Check if text actually overflows the collapsed height
    React.useEffect(() => {
        if (textRef.current && readerActive) {
            const lineHeightPx = parseFloat(getComputedStyle(textRef.current).lineHeight) || 20;
            const maxHeight = ABSTRACT_COLLAPSED_LINES * lineHeightPx;
            setNeedsCollapse(textRef.current.scrollHeight > maxHeight + 4);
        }
    }, [text, readerActive]);

    // When reader becomes inactive, force expand
    React.useEffect(() => {
        if (!readerActive) {
            setExpanded(false);
        }
    }, [readerActive]);

    const isCollapsed = readerActive && !expanded && needsCollapse;
    const showToggle = readerActive && needsCollapse;

    return (
        <Box sx={{ position: 'relative', mb: 1 }}>
            <Box
                sx={{
                    overflow: isCollapsed ? 'hidden' : 'visible',
                    maxHeight: isCollapsed ? COLLAPSED_MAX_HEIGHT : 'none',
                    transition: 'max-height 0.3s ease',
                }}
            >
                <Typography
                    ref={textRef}
                    variant="body2"
                    color={isHighlighted ? 'text.primary' : 'text.secondary'}
                    sx={{
                        lineHeight: LINE_HEIGHT_EM,
                        ...((isHighlighted && !isCollapsed) && {
                            bgcolor: 'action.selected',
                            p: 1,
                            borderRadius: 1,
                        }),
                    }}
                    onContextMenu={(e) => onContextMenu && onContextMenu(e, text)}
                >
                    {text}
                </Typography>
            </Box>

            {/* Gradient overlay + expand trigger (entire area clickable) */}
            {isCollapsed && (
                <Box
                    onClick={() => setExpanded(true)}
                    sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '2.5em',
                        background: (theme) =>
                            `linear-gradient(transparent, ${isHighlighted
                                ? theme.palette.action.selected
                                : theme.palette.background.paper
                            })`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'flex-end',
                        pr: 1,
                        pb: 0.25,
                    }}
                >
                    <Typography
                        variant="caption"
                        color="primary"
                        sx={{
                            fontWeight: 500,
                            '&:hover': { textDecoration: 'underline' },
                        }}
                    >
                        {expandLabel}
                    </Typography>
                </Box>
            )}

            {/* Collapse link */}
            {showToggle && expanded && (
                <Box
                    onClick={() => setExpanded(false)}
                    sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        cursor: 'pointer',
                        pr: 1,
                        mt: 0.25,
                    }}
                >
                    <Typography
                        variant="caption"
                        color="primary"
                        sx={{
                            fontWeight: 500,
                            '&:hover': { textDecoration: 'underline' },
                        }}
                    >
                        {collapseLabel}
                    </Typography>
                </Box>
            )}
        </Box>
    );
};


const PaperList: React.FC<PaperListProps> = ({
    papers, onUpdateMetadata, onTranslate, onReadPdf, batch, readerActive = false,
    groups, selectedGroupId, onAddToGroup, onRemoveFromGroup, onContextSelect
}) => {
    const { t } = useTranslation();

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

    // Reset selection when list changes significantly (e.g. batch change)
    // Actually, papers prop changes reference every time update happens.
    // We should only reset when the batch/group context changes.
    // Use a ref to track current context ID?
    // Or just manually reset in parent? 
    // Ideally, parent should control selection if we want valid state.
    // But local state is easier. Let's assume papers completely change when batch changes.
    React.useEffect(() => {
        setSelectedIds(new Set());
    }, [batch?.id, selectedGroupId]);

    const handleSelectPaper = (id: number, shiftKey: boolean) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
            setLastSelectedId(null);
        } else {
            newSelected.add(id);
            // Handle shift select (range)
            if (shiftKey && lastSelectedId !== null) {
                const start = papers.findIndex(p => p.id === lastSelectedId);
                const end = papers.findIndex(p => p.id === id);
                if (start !== -1 && end !== -1) {
                    const lower = Math.min(start, end);
                    const upper = Math.max(start, end);
                    for (let i = lower; i <= upper; i++) {
                        newSelected.add(papers[i].id);
                    }
                }
            }
            setLastSelectedId(id);
        }
        setSelectedIds(newSelected);
    };

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

    const handleUpdateClick = async (paper: Paper) => {
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
    };

    const handleBatchTranslate = async () => {
        const selectedPapers = papers.filter(p => selectedIds.has(p.id));
        for (const paper of selectedPapers) {
            onTranslate(paper);
        }
        setSelectedIds(new Set());
    };

    const handleBatchUpdate = async () => {
        const selectedPapers = papers.filter(p => selectedIds.has(p.id));
        for (const paper of selectedPapers) {
            handleUpdateClick(paper);
        }
        setSelectedIds(new Set());
    };

    const handleAttachPdf = async (paper: Paper) => {
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
            alert('Failed to attach PDF: ' + error);
        } finally {
            setAttachingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(paper.id);
                return newSet;
            });
        }
    };

    const handleDeletePdf = async (pdf: PaperPdf) => {
        try {
            await invoke('delete_pdf_command', {
                pdfId: pdf.id,
                paperId: pdf.paper_id,
                filename: pdf.filename,
            });
        } catch (error) {
            console.error('Failed to delete PDF:', error);
            alert('Failed to delete PDF: ' + error);
        }
        setPdfMenuAnchor(null);
        setPdfMenuPaper(null);
    };

    const handleOpenPdfMenu = (event: React.MouseEvent<HTMLElement>, paper: Paper) => {
        setPdfMenuAnchor(event.currentTarget as HTMLElement);
        setPdfMenuPaper(paper);
    };

    const handleClosePdfMenu = () => {
        setPdfMenuAnchor(null);
        setPdfMenuPaper(null);
    };


    // MUI Menu doesn't support "anchorPosition" with just state easily unless we use a virtual element.
    // Let's use virtual element for mouse position.
    const [contextMenuPos, setContextMenuPos] = React.useState<{ top: number, left: number } | null>(null);

    const handleContextMenuOpen = (event: React.MouseEvent, text: string, paper: Paper, label: string) => {
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
    };

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
                        {`${batch.issueVolume} - ${batch.issueDate}`}
                    </Typography>
                )}
            </Box>

            {/* Batch Action Toolbar */}
            <Fade in={selectedIds.size > 0}>
                <AppBar position="absolute" color="default" sx={{
                    top: 0, left: 0, right: 0,
                    zIndex: 10,
                    display: selectedIds.size > 0 ? 'flex' : 'none',
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    boxShadow: 2
                }}>
                    <Toolbar variant="dense">
                        <IconButton edge="start" color="inherit" onClick={() => setSelectedIds(new Set())}>
                            <CloseIcon />
                        </IconButton>
                        <Typography sx={{ ml: 2, flex: 1 }} variant="subtitle1" component="div">
                            {selectedIds.size} {t('app.selected') || "selected"}
                        </Typography>

                        <Button
                            color="inherit"
                            startIcon={<TranslateIcon />}
                            onClick={handleBatchTranslate}
                            sx={{ mr: 1 }}
                        >
                            {t('app.batch_translate') || "Translate"}
                        </Button>

                        <Button
                            color="inherit"
                            startIcon={<RefreshIcon />}
                            onClick={handleBatchUpdate}
                            sx={{ mr: 1 }}
                        >
                            {t('app.batch_update') || "Update"}
                        </Button>

                        {selectedGroupId ? (
                            <Button color="error" startIcon={<FolderOffIcon />} onClick={handleRemoveFromGroupClick}>
                                {t('app.remove_from_group') || "Remove"}
                            </Button>
                        ) : (
                            <Button
                                color="inherit"
                                startIcon={<FolderIcon />}
                                onClick={(e) => setGroupMenuAnchor(e.currentTarget)}
                            >
                                {t('app.add_to_group') || "Group"}
                            </Button>
                        )}
                    </Toolbar>
                </AppBar>
            </Fade>

            {/* Select All Checkbox - maybe put in header? */}
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

            <Virtuoso
                style={{ flex: 1 }}
                data={papers}
                itemContent={(_index: number, paper: Paper) => {
                    const hasPdfs = paper.pdfs && paper.pdfs.length > 0;
                    const abstractText = paper.abstract || t('app.no_abstract');
                    const abstractCn = paper.abstract_cn;

                    return (
                        <Box sx={{ pb: 2 }}>
                            <Card sx={{ mb: 0 }}>
                                <CardContent>
                                    {/* Title row with PDF indicator */}
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                        <Checkbox
                                            checked={selectedIds.has(paper.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => {
                                                // @ts-ignore
                                                handleSelectPaper(paper.id, e.nativeEvent.shiftKey);
                                            }}
                                            sx={{ p: 0.5, mr: 1, mt: 0.5 }}
                                        />
                                        <Box sx={{ flex: 1 }}>
                                            <Typography
                                                variant="h6"
                                                color="primary"
                                                gutterBottom
                                                onContextMenu={(e) => handleContextMenuOpen(e, paper.title, paper, t('app.title') || "Title")}
                                            >
                                                {paper.title}
                                            </Typography>
                                            {paper.title_cn && (
                                                <Typography
                                                    variant="subtitle1"
                                                    color="textSecondary"
                                                    gutterBottom
                                                    onContextMenu={(e) => handleContextMenuOpen(e, paper.title_cn!, paper, t('app.translated_title') || "Translated Title")}
                                                >
                                                    {paper.title_cn}
                                                </Typography>
                                            )}
                                        </Box>
                                        {hasPdfs && (
                                            <Tooltip title={`${paper.pdfs.length} PDF(s)`}>
                                                <Badge badgeContent={paper.pdfs.length} color="primary" sx={{ ml: 2, mt: 1 }}>
                                                    <AttachFileIcon color="action" fontSize="small" />
                                                </Badge>
                                            </Tooltip>
                                        )}
                                    </Box>

                                    {/* Metadata chips */}
                                    <Box sx={{ mb: 1 }}>
                                        <Chip label={paper.journalName} size="small" sx={{ mr: 1 }} />
                                        <Link href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener">
                                            {paper.doi}
                                        </Link>
                                    </Box>

                                    {/* English abstract - independently collapsible */}
                                    <CollapsibleText
                                        text={abstractText}
                                        readerActive={readerActive}
                                        expandLabel={t('app.expand_text')}
                                        collapseLabel={t('app.collapse_text')}
                                        onContextMenu={(e, txt) => handleContextMenuOpen(e, txt, paper, t('app.abstract') || "Abstract")}
                                    />

                                    {/* Chinese abstract - independently collapsible */}
                                    {abstractCn && (
                                        <CollapsibleText
                                            text={abstractCn}
                                            isHighlighted
                                            readerActive={readerActive}
                                            expandLabel={t('app.expand_text')}
                                            collapseLabel={t('app.collapse_text')}
                                            onContextMenu={(e, txt) => handleContextMenuOpen(e, txt, paper, t('app.translated_abstract') || "Translated Abstract")}
                                        />
                                    )}
                                </CardContent>

                                <CardActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                                    {/* PDF actions */}
                                    {hasPdfs ? (
                                        <>
                                            <Button
                                                startIcon={<MenuBookIcon />}
                                                size="small"
                                                variant="outlined"
                                                color="primary"
                                                onClick={() => onReadPdf?.(paper, paper.pdfs[0])}
                                            >
                                                {t('app.read_pdf')}
                                            </Button>

                                            {/* Always show management menu button if has PDFs */}
                                            <IconButton
                                                size="small"
                                                onClick={(e) => handleOpenPdfMenu(e, paper)}
                                            >
                                                <MoreVertIcon fontSize="small" />
                                            </IconButton>

                                            {/* Always allow attaching more */}
                                            <Button
                                                startIcon={<AttachFileIcon />}
                                                size="small"
                                                onClick={() => handleAttachPdf(paper)}
                                                disabled={attachingIds.has(paper.id)}
                                            >
                                                {t('app.attach_pdf')}
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            startIcon={<AttachFileIcon />}
                                            size="small"
                                            onClick={() => handleAttachPdf(paper)}
                                            disabled={attachingIds.has(paper.id)}
                                        >
                                            {t('app.attach_pdf')}
                                        </Button>
                                    )}

                                    <Tooltip title={t('app.open_external')}>
                                        <IconButton
                                            size="small"
                                            onClick={() => window.open(`https://doi.org/${paper.doi}`, '_blank')}
                                        >
                                            <OpenInNewIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>

                                    <Button
                                        startIcon={<TranslateIcon />}
                                        size="small"
                                        onClick={() => onTranslate(paper)}
                                    >
                                        {t('app.translate')}
                                    </Button>

                                    <Button
                                        startIcon={<RefreshIcon sx={{
                                            animation: updatingIds.has(paper.id) ? 'spin 1s linear infinite' : 'none',
                                            '@keyframes spin': {
                                                '0%': { transform: 'rotate(0deg)' },
                                                '100%': { transform: 'rotate(360deg)' }
                                            }
                                        }} />}
                                        size="small"
                                        onClick={() => handleUpdateClick(paper)}
                                        disabled={updatingIds.has(paper.id)}
                                    >
                                        {t('app.update_metadata')}
                                    </Button>
                                </CardActions>
                            </Card>
                        </Box>
                    );
                }}
            />

            {/* PDF management menu (for papers with multiple PDFs) */}
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

            {/* Group Selection Menu */}
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

            {/* AI Context Menu */}
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
                    <ListItemText primary={t('app.copy') || "Copy"} />
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => handleContextAction('new')}>
                    <ListItemIcon><ChatIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary={t('app.chat_new_context') || "New Chat with Context"} />
                </MenuItem>
                <MenuItem onClick={() => handleContextAction('append')}>
                    <ListItemIcon><PlaylistAddIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary={t('app.chat_append_context') || "Add to Current Chat"} />
                </MenuItem>
            </Menu>
        </Box>
    );
};

export default PaperList;
