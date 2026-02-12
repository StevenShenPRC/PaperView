
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
    Box, IconButton, Typography, CircularProgress,
    Tooltip, Toolbar, AppBar, Select, MenuItem,
    FormControl, Paper as MuiPaper, Fade, useTheme,
    TextField, Stack, InputAdornment, Menu, ListItemIcon, ListItemText
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import HeightIcon from '@mui/icons-material/Height';
import UndoIcon from '@mui/icons-material/Undo';
import { Paper, PaperPdf, PendingContext } from '../types';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { ContextItem } from '../types';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

// ─── Types ───────────────────────────────────────────────────────────────────

interface PDFReaderProps {
    paper: Paper;
    pdf: PaperPdf;
    onClose: () => void;
    onPdfChange: (pdf: PaperPdf) => void;
    isResizing?: boolean;
    onAddContext?: (context: PendingContext) => void;
}

interface JumpHistory {
    scrollTop: number;
    page: number;
}

/** Scale mode: 'page-width' | 'page-height' | number (percentage, 1.0 = 100%) */
type ScaleMode = number | 'page-width' | 'page-height';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Padding around pages inside the scroll container (px) */
const PAGE_PADDING = 40;
/** Minimum zoom percentage */
const MIN_SCALE = 0.1;
/** Maximum zoom percentage */
const MAX_SCALE = 5.0;
/** Zoom step per click / wheel tick */
const ZOOM_STEP = 0.1;
/** Minimum wheel delta to trigger zoom */
const WHEEL_THRESHOLD = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Clamp a numeric scale to [MIN_SCALE, MAX_SCALE], rounded to 1 decimal */
const clampScale = (val: number): number =>
    Math.min(Math.max(Math.round(val * 10) / 10, MIN_SCALE), MAX_SCALE);

// ─── Component ───────────────────────────────────────────────────────────────

const PDFReader: React.FC<PDFReaderProps> = ({ paper, pdf, onClose, onPdfChange, isResizing = false, onAddContext }) => {
    const { t } = useTranslation();
    const theme = useTheme();

    // ── PDF document state ────────────────────────────────────────────────
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Navigation state ──────────────────────────────────────────────────
    const [currentPage, setCurrentPage] = useState(1);
    const [pageInput, setPageInput] = useState("1");
    const [jumpHistory, setJumpHistory] = useState<JumpHistory[]>([]);

    // ── Scale state ───────────────────────────────────────────────────────
    const [scale, setScale] = useState<ScaleMode>('page-width');
    const [customScaleInput, setCustomScaleInput] = useState("Fit Width");
    const [isScaleInputFocused, setIsScaleInputFocused] = useState(false);

    // ── Container dimensions ──────────────────────────────────────────────
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    // ── Derived: compute the actual width to pass to react-pdf <Page> ────
    // All scale modes are resolved to a single `width` value.
    //   - 'page-width':  fill the container width
    //   - 'page-height': we pass this as height prop instead
    //   - number (1.0 = 100%): multiply the base (fit-width) size
    const availableWidth = Math.max(containerWidth - PAGE_PADDING, 100);
    const availableHeight = Math.max(containerHeight - PAGE_PADDING, 100);

    const pageWidth = useMemo(() => {
        if (scale === 'page-width') return availableWidth;
        if (scale === 'page-height') return undefined; // height-driven
        // Numeric scale: relative to fit-width. 1.0 = fit width, 2.0 = 2× fit width
        return availableWidth * scale;
    }, [scale, availableWidth]);

    const pageHeight = useMemo(() => {
        if (scale === 'page-height') return availableHeight;
        return undefined;
    }, [scale, availableHeight]);

    // ── Observe container resize ──────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect;
            if (rect) {
                setContainerWidth(rect.width);
                setContainerHeight(rect.height);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // ── Load PDF binary ───────────────────────────────────────────────────
    useEffect(() => {
        let currentUrl: string | null = null;
        setJumpHistory([]);

        const loadPdf = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await invoke<number[]>('read_pdf', { filename: pdf.filename });
                const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' });
                currentUrl = URL.createObjectURL(blob);
                setPdfUrl(currentUrl);
            } catch (err) {
                console.error("Failed to load PDF:", err);
                setError(String(err));
            } finally {
                setLoading(false);
            }
        };

        if (pdf) {
            loadPdf();
            setCurrentPage(1);
            setPageInput("1");
        }

        return () => {
            if (currentUrl) URL.revokeObjectURL(currentUrl);
        };
    }, [pdf]);

    // ── Sync scale display text ───────────────────────────────────────────
    useEffect(() => {
        if (isScaleInputFocused) return;
        if (scale === 'page-width') setCustomScaleInput(t('app.fit_width'));
        else if (scale === 'page-height') setCustomScaleInput(t('app.fit_height'));
        else setCustomScaleInput(`${Math.round(scale * 100)}% `);
    }, [scale, t, isScaleInputFocused]);

    // ── Sync page input text ──────────────────────────────────────────────
    useEffect(() => {
        setPageInput(String(currentPage));
    }, [currentPage]);

    // ── Zoom handlers ─────────────────────────────────────────────────────
    const getNumericScale = useCallback((): number => {
        return typeof scale === 'number' ? scale : 1.0;
    }, [scale]);

    const handleZoomIn = useCallback(() => {
        setScale(clampScale(getNumericScale() + ZOOM_STEP));
    }, [getNumericScale]);

    const handleZoomOut = useCallback(() => {
        setScale(clampScale(getNumericScale() - ZOOM_STEP));
    }, [getNumericScale]);

    const handleWheelZoom = useCallback((e: React.WheelEvent) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const delta = e.deltaY;
        if (Math.abs(delta) > WHEEL_THRESHOLD) {
            const direction = delta > 0 ? -ZOOM_STEP : ZOOM_STEP;
            const newVal = clampScale(getNumericScale() + direction);
            if (newVal !== getNumericScale()) setScale(newVal);
        }
    }, [getNumericScale]);

    // ── Scale input handlers ──────────────────────────────────────────────
    const handleScaleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        setIsScaleInputFocused(true);
        e.target.select();
        setCustomScaleInput(typeof scale === 'string' ? "100" : `${Math.round(scale * 100)} `);
    }, [scale]);

    const handleScaleInputCommit = useCallback(() => {
        const val = parseFloat(customScaleInput.replace('%', ''));
        if (!isNaN(val)) {
            setScale(Math.max(10, Math.min(val, 500)) / 100);
        } else {
            // Revert display
            if (scale === 'page-width') setCustomScaleInput(t('app.fit_width'));
            else if (scale === 'page-height') setCustomScaleInput(t('app.fit_height'));
            else setCustomScaleInput(`${Math.round(scale * 100)}% `);
        }
    }, [customScaleInput, scale, t]);

    const handleScaleInputBlur = useCallback(() => {
        setIsScaleInputFocused(false);
        handleScaleInputCommit();
    }, [handleScaleInputCommit]);

    // ── Page navigation handlers ──────────────────────────────────────────
    const scrollToPage = useCallback((pageNum: number) => {
        document.getElementById(`pdf - page - ${pageNum} `)
            ?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, []);

    const handlePageInputCommit = useCallback(() => {
        const val = parseInt(pageInput);
        if (!isNaN(val) && val >= 1 && val <= (numPages || 1)) {
            scrollToPage(val);
        } else {
            setPageInput(String(currentPage));
        }
    }, [pageInput, numPages, currentPage, scrollToPage]);

    const handlePrevPage = useCallback(() => {
        if (currentPage > 1) scrollToPage(currentPage - 1);
    }, [currentPage, scrollToPage]);

    const handleNextPage = useCallback(() => {
        if (numPages && currentPage < numPages) scrollToPage(currentPage + 1);
    }, [numPages, currentPage, scrollToPage]);

    // ── Scroll tracking (current page detection) ──────────────────────────
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const pages = target.querySelectorAll('.pdf-page-container');
        let detected = 1;
        const midpoint = target.scrollTop + target.clientHeight / 2;

        for (let i = 0; i < pages.length; i++) {
            if ((pages[i] as HTMLElement).offsetTop <= midpoint) {
                detected = i + 1;
            } else {
                break;
            }
        }
        if (detected !== currentPage) setCurrentPage(detected);
    }, [currentPage]);

    // ── Internal link handling ─────────────────────────────────────────────
    const handleLinkClick = useCallback((destPage: number) => {
        if (containerRef.current) {
            setJumpHistory(prev => [...prev, {
                page: currentPage,
                scrollTop: containerRef.current!.scrollTop
            }]);
        }
        scrollToPage(destPage);
    }, [currentPage, scrollToPage]);

    const handleJumpBack = useCallback(() => {
        if (jumpHistory.length === 0) return;
        const last = jumpHistory[jumpHistory.length - 1];
        setJumpHistory(prev => prev.slice(0, -1));
        if (containerRef.current) {
            containerRef.current.scrollTop = last.scrollTop;
            setCurrentPage(last.page);
        }
    }, [jumpHistory]);

    // ── Internal link click capture on page ───────────────────────────────
    const handlePageClickCapture = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (href?.startsWith('#page=')) {
            e.preventDefault();
            e.stopPropagation();
            const match = href.match(/#page=(\d+)/);
            if (match?.[1]) handleLinkClick(parseInt(match[1]));
        } else if (target.closest('.react-pdf__Page__annotationLayer')) {
            handleLinkClick(currentPage);
        }
    }, [currentPage, handleLinkClick]);

    // ── Determine if content will overflow (for centering logic) ──────────
    const contentOverflows = pageWidth !== undefined && pageWidth > availableWidth;

    // ── Context Menu State ──
    const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; text: string } | null>(null);

    const handleMouseUp = (event: React.MouseEvent) => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (selectedText && selectedText.length > 0) {
            // Check if selection is inside PDF container
            if (containerRef.current && containerRef.current.contains(selection?.anchorNode?.parentElement || null)) {
                setContextMenu({
                    mouseX: event.clientX,
                    mouseY: event.clientY,
                    text: selectedText
                });
            }
        } else {
            // Don't close immediately if clicking menu, but Menu handles its own close.
            // Only clear if clicking elsewhere.
            // setContextMenu(null); // Menu handles backdrop click
        }
    };

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default', position: 'relative' }}>
            {/* ── Top Bar: PDF file selector ── */}
            <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Toolbar variant="dense" sx={{ minHeight: 48, gap: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select
                            value={pdf.id}
                            onChange={(e) => {
                                const selected = paper.pdfs.find(p => p.id === e.target.value);
                                if (selected) onPdfChange(selected);
                            }}
                            variant="standard"
                            disableUnderline
                            sx={{ fontSize: '0.875rem', fontWeight: 500 }}
                        >
                            {paper.pdfs.map(p => (
                                <MenuItem key={p.id} value={p.id}>
                                    {p.display_name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Tooltip title={paper.title}>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ flexGrow: 1, fontStyle: 'italic', cursor: 'default' }}>
                            {paper.title}
                        </Typography>
                    </Tooltip>

                    <Tooltip title={t('app.collapse_reader') || "Collapse Reader"}>
                        <IconButton onClick={onClose} size="small" color="inherit">
                            <ChevronRightIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Toolbar>
            </AppBar>

            {/* ── Scroll Container ── */}
            <Box
                ref={containerRef}
                onScroll={handleScroll}
                onWheel={handleWheelZoom}
                onMouseUp={handleMouseUp}
                sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    overflowX: 'auto',
                    scrollbarGutter: 'stable',
                    bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.200',
                    p: 2,
                    scrollBehavior: 'smooth',
                }}
            >
                {/* Inner wrapper: centers content when smaller than viewport,
                    expands naturally when larger to allow horizontal scroll */}
                <Box sx={{
                    minWidth: '100%',
                    width: contentOverflows ? 'fit-content' : '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minHeight: '100%',
                }}>
                    {loading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
                            <CircularProgress />
                        </Box>
                    )}

                    {error && (
                        <Typography color="error" sx={{ mt: 5, textAlign: 'center' }}>
                            Error loading PDF: {error}
                        </Typography>
                    )}

                    {pdfUrl && !isResizing && (
                        <Document
                            file={pdfUrl}
                            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                            onLoadError={(err) => setError(err.message)}
                            onItemClick={({ pageNumber }) => {
                                if (pageNumber && pageNumber !== currentPage) {
                                    handleLinkClick(pageNumber);
                                }
                            }}
                            loading={null}
                        >
                            {Array.from({ length: numPages ?? 0 }, (_, i) => {
                                const pageNum = i + 1;
                                return (
                                    <Box
                                        id={`pdf - page - ${pageNum} `}
                                        key={`page_${pageNum} `}
                                        className="pdf-page-container"
                                        sx={{ mb: 2 }}
                                        onClickCapture={handlePageClickCapture}
                                    >
                                        <Box sx={{ boxShadow: 3, bgcolor: 'background.paper' }}>
                                            <Page
                                                pageNumber={pageNum}
                                                width={pageWidth}
                                                height={pageHeight}
                                                renderTextLayer={true}
                                                renderAnnotationLayer={true}
                                            />
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Document>
                    )}

                    {isResizing && (
                        <Box sx={{
                            height: '100%',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'action.hover',
                            borderRadius: 2,
                            border: '2px dashed',
                            borderColor: 'divider',
                            flexGrow: 1,
                        }}>
                            <CircularProgress />
                        </Box>
                    )}
                </Box>
            </Box>

            {/* ── Floating Controls ── */}
            <Fade in={!loading && !!pdfUrl}>
                <MuiPaper
                    elevation={6}
                    sx={{
                        position: 'absolute',
                        bottom: 24,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 0.5,
                        px: 2,
                        borderRadius: 8,
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(8px)',
                        border: 1,
                        borderColor: 'divider',
                        gap: 1,
                        zIndex: 100,
                        maxWidth: '90%',
                    }}
                >
                    {/* Jump Back */}
                    {jumpHistory.length > 0 && (
                        <>
                            <Tooltip title={t('app.jump_back')}>
                                <IconButton size="small" onClick={handleJumpBack} color="primary">
                                    <UndoIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Box sx={{ width: 1, height: 20, bgcolor: 'divider', mx: 0.5 }} />
                        </>
                    )}

                    {/* Zoom Controls */}
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Tooltip title={t('app.zoom_out')}>
                            <IconButton size="small" onClick={handleZoomOut}>
                                <ZoomOutIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>

                        <TextField
                            variant="outlined"
                            size="small"
                            value={customScaleInput}
                            onChange={(e) => setCustomScaleInput(e.target.value)}
                            onFocus={handleScaleInputFocus}
                            onBlur={handleScaleInputBlur}
                            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                            InputProps={{
                                endAdornment: isScaleInputFocused ? <InputAdornment position="end">%</InputAdornment> : null,
                                sx: {
                                    fontSize: '0.8125rem',
                                    textAlign: 'center',
                                    width: '80px',
                                    height: '32px',
                                    '& input': { textAlign: 'center', p: 0 }
                                }
                            }}
                        />

                        <Tooltip title={t('app.zoom_in')}>
                            <IconButton size="small" onClick={handleZoomIn}>
                                <ZoomInIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>

                    <Box sx={{ width: 1, height: 20, bgcolor: 'divider', mx: 0.5 }} />

                    {/* Fit Controls */}
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Tooltip title={t('app.fit_width')}>
                            <IconButton size="small" onClick={() => setScale('page-width')} color={scale === 'page-width' ? 'primary' : 'default'}>
                                <FitScreenIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={t('app.fit_height')}>
                            <IconButton size="small" onClick={() => setScale('page-height')} color={scale === 'page-height' ? 'primary' : 'default'}>
                                <HeightIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>

                    <Box sx={{ width: 1, height: 20, bgcolor: 'divider', mx: 0.5 }} />

                    {/* Page Navigation */}
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Tooltip title={t('app.prev_page')}>
                            <span>
                                <IconButton size="small" onClick={handlePrevPage} disabled={currentPage <= 1}>
                                    <NavigateBeforeIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <TextField
                            variant="outlined"
                            size="small"
                            value={pageInput}
                            onChange={(e) => setPageInput(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onBlur={handlePageInputCommit}
                            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                            InputProps={{
                                sx: {
                                    fontSize: '0.8125rem',
                                    textAlign: 'center',
                                    width: '40px',
                                    height: '32px',
                                    '& input': { textAlign: 'center', p: 0, fontWeight: 'bold' }
                                }
                            }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', mx: 0.5 }}>/ {numPages || '?'}</Typography>

                        <Tooltip title={t('app.next_page')}>
                            <span>
                                <IconButton size="small" onClick={handleNextPage} disabled={!numPages || currentPage >= numPages}>
                                    <NavigateNextIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>
                </MuiPaper>
            </Fade>

            {/* Context Menu */}
            <Menu
                open={contextMenu !== null}
                onClose={() => setContextMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
            >
                <MenuItem onClick={() => {
                    if (contextMenu) {
                        navigator.clipboard.writeText(contextMenu.text);
                        setContextMenu(null);
                    }
                }}>
                    <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>{t('app.copy') || "Copy"}</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => {
                    const newItem: ContextItem = {
                        id: crypto.randomUUID(),
                        text: contextMenu!.text,
                        source: pdf.filename,
                        label: 'PDF Selection'
                    };
                    onAddContext?.({ items: [newItem], mode: 'new' });
                    setContextMenu(null);
                }}>
                    <ListItemIcon><AutoAwesomeIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>{t('app.new_chat_with_context') || "New Chat with Context"}</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => {
                    const newItem: ContextItem = {
                        id: crypto.randomUUID(),
                        text: contextMenu!.text,
                        source: pdf.filename,
                        label: 'PDF Selection'
                    };
                    onAddContext?.({ items: [newItem], mode: 'append' });
                    setContextMenu(null);
                }}>
                    <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>{t('app.append_to_chat') || "Append to Chat"}</ListItemText>
                </MenuItem>
            </Menu>
        </Box>
    );
};

export default PDFReader;
