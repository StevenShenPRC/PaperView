import React from 'react';
import {
    Card, CardContent, Typography, CardActions, Button,
    Box, Chip, Link, Tooltip, IconButton, Menu,
    MenuItem, ListItemIcon, ListItemText, Divider
} from '@mui/material';
import { Paper, PaperPdf } from '../types';
import { Batch } from '../types';
import TranslateIcon from '@mui/icons-material/Translate';
import RefreshIcon from '@mui/icons-material/Refresh';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Badge from '@mui/material/Badge';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
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
}> = ({ text, isHighlighted, readerActive, expandLabel, collapseLabel }) => {
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
    papers, onUpdateMetadata, onTranslate, onReadPdf, batch, readerActive = false
}) => {
    const { t } = useTranslation();

    const [updatingIds, setUpdatingIds] = React.useState<Set<number>>(new Set());
    const [attachingIds, setAttachingIds] = React.useState<Set<number>>(new Set());

    // PDF menu anchor state
    const [pdfMenuAnchor, setPdfMenuAnchor] = React.useState<null | HTMLElement>(null);
    const [pdfMenuPaper, setPdfMenuPaper] = React.useState<Paper | null>(null);

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
        setPdfMenuAnchor(event.currentTarget);
        setPdfMenuPaper(paper);
    };

    const handleClosePdfMenu = () => {
        setPdfMenuAnchor(null);
        setPdfMenuPaper(null);
    };

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
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
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="h6" color="primary" gutterBottom>
                                                {paper.title}
                                            </Typography>
                                            {paper.title_cn && (
                                                <Typography variant="subtitle1" color="textSecondary" gutterBottom>
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
                                    />

                                    {/* Chinese abstract - independently collapsible */}
                                    {abstractCn && (
                                        <CollapsibleText
                                            text={abstractCn}
                                            isHighlighted
                                            readerActive={readerActive}
                                            expandLabel={t('app.expand_text')}
                                            collapseLabel={t('app.collapse_text')}
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
        </Box>
    );
};

export default PaperList;
