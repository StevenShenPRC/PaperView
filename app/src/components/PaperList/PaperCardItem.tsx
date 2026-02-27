import React from 'react';
import {
    Card, CardContent, Typography, CardActions, Button,
    Box, Chip, Link, Tooltip, IconButton, Checkbox
} from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TranslateIcon from '@mui/icons-material/Translate';
import RefreshIcon from '@mui/icons-material/Refresh';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Paper, PaperPdf } from '../../types';
import { CollapsibleText } from './CollapsibleText';

interface PaperCardItemProps {
    paper: Paper;
    isSelected: boolean;
    isUpdating: boolean;
    isAttaching: boolean;
    readerActive: boolean;
    t: any;
    formatLocalTime: (dateStr: string | null | undefined) => string | null | undefined;
    onSelect: (id: number, shiftKey: boolean) => void;
    onContextMenu: (e: React.MouseEvent, text: string, paper: Paper, label: string) => void;
    onReadPdf?: (paper: Paper, pdf: PaperPdf) => void;
    onOpenPdfMenu: (e: React.MouseEvent<HTMLElement>, paper: Paper) => void;
    onAttachPdf: (paper: Paper) => void;
    onTranslate: (paper: Paper) => void;
    onUpdateMetadata: (paper: Paper) => void;
}

export const PaperCardItem = React.memo(({
    paper,
    isSelected,
    isUpdating,
    isAttaching,
    readerActive,
    t,
    formatLocalTime,
    onSelect,
    onContextMenu,
    onReadPdf,
    onOpenPdfMenu,
    onAttachPdf,
    onTranslate,
    onUpdateMetadata
}: PaperCardItemProps) => {
    const hasPdfs = paper.pdfs && paper.pdfs.length > 0;
    const abstractText = paper.abstract || t('app.no_abstract') || "No abstract available";
    const abstractCn = paper.abstract_cn;

    return (
        <Box sx={{ mb: 2 }}>
            <Card
                elevation={isSelected ? 2 : 1}
                sx={(theme) => ({
                    outline: isSelected ? `2px solid ${theme.palette.primary.main}` : '1px solid transparent',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: isSelected
                        ? (theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.12)' : 'rgba(25, 118, 210, 0.08)')
                        : 'background.paper',
                    transition: 'box-shadow 0.2s, outline 0.2s, background-color 0.2s',
                    '&:hover': {
                        boxShadow: 3,
                        outline: isSelected ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
                    },
                    position: 'relative'
                })}
            >
                <Box
                    sx={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        zIndex: 1
                    }}
                >
                    <Checkbox
                        size="small"
                        checked={isSelected}
                        onChange={(e) => onSelect(paper.id, (e.nativeEvent as MouseEvent).shiftKey)}
                    />
                </Box>

                <CardContent onClick={(e) => {
                    // Prevent click from toggling abstract if clicking checkbox or buttons
                    if ((e.target as HTMLElement).closest('.MuiButtonBase-root')) return;
                    onSelect(paper.id, (e.nativeEvent as MouseEvent).shiftKey);
                }} sx={{ cursor: 'pointer', pt: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ pr: 4 }}>
                        <Box component="span" onContextMenu={(e) => onContextMenu(e, paper.title, paper, t('app.title') || "Title")}>
                            {paper.title}
                        </Box>
                    </Typography>

                    {paper.title_cn && (
                        <Typography variant="h6" color="primary" gutterBottom sx={{ fontWeight: 500 }}>
                            <Box component="span" onContextMenu={(e) => onContextMenu(e, paper.title_cn!, paper, t('app.translated_title') || "Translated Title")}>
                                {paper.title_cn}
                            </Box>
                        </Typography>
                    )}

                    <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        <Chip size="small" label={paper.journalName || t('app.unknown_journal')} variant="outlined" />
                        <Chip size="small" label={paper.issueVolume || t('app.unknown_volume')} variant="outlined" />
                        <Chip size="small" label={formatLocalTime(paper.issueDate) || t('app.unknown_date')} variant="outlined" />
                        {paper.doi && (
                            <Link
                                href={`https://doi.org/${paper.doi}`}
                                target="_blank"
                                variant="caption"
                                sx={{ display: 'flex', alignItems: 'center', ml: 'auto' }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                DOI: {paper.doi}
                            </Link>
                        )}
                    </Box>

                    <CollapsibleText
                        text={abstractText}
                        readerActive={readerActive}
                        expandLabel={t('app.expand_text')}
                        collapseLabel={t('app.collapse_text')}
                        onContextMenu={(e, txt) => onContextMenu(e, txt, paper, t('app.abstract') || "Abstract")}
                    />

                    {/* Chinese abstract - independently collapsible */}
                    {abstractCn && (
                        <CollapsibleText
                            text={abstractCn}
                            isHighlighted
                            readerActive={readerActive}
                            expandLabel={t('app.expand_text')}
                            collapseLabel={t('app.collapse_text')}
                            onContextMenu={(e, txt) => onContextMenu(e, txt, paper, t('app.translated_abstract') || "Translated Abstract")}
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
                                onClick={(e) => onOpenPdfMenu(e, paper)}
                            >
                                <MoreVertIcon fontSize="small" />
                            </IconButton>

                            {/* Always allow attaching more */}
                            <Button
                                startIcon={<AttachFileIcon />}
                                size="small"
                                onClick={() => onAttachPdf(paper)}
                                disabled={isAttaching}
                            >
                                {t('app.attach_pdf')}
                            </Button>
                        </>
                    ) : (
                        <Button
                            startIcon={<AttachFileIcon />}
                            size="small"
                            onClick={() => onAttachPdf(paper)}
                            disabled={isAttaching}
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
                            animation: isUpdating ? 'spin 1s linear infinite' : 'none',
                            '@keyframes spin': {
                                '0%': { transform: 'rotate(0deg)' },
                                '100%': { transform: 'rotate(360deg)' }
                            }
                        }} />}
                        size="small"
                        onClick={() => onUpdateMetadata(paper)}
                        disabled={isUpdating}
                    >
                        {t('app.update_metadata')}
                    </Button>
                </CardActions>
            </Card>
        </Box>
    );
}, (prevProps, nextProps) => {
    return prevProps.paper.id === nextProps.paper.id &&
        prevProps.paper === nextProps.paper &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.isUpdating === nextProps.isUpdating &&
        prevProps.isAttaching === nextProps.isAttaching &&
        prevProps.readerActive === nextProps.readerActive;
});
