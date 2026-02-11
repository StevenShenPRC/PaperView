import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
    Box, IconButton, Typography, CircularProgress,
    Tooltip, Toolbar, AppBar, Select, MenuItem,
    FormControl, Paper as MuiPaper, Fade, useTheme,
    TextField, Stack, InputAdornment
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import HeightIcon from '@mui/icons-material/Height';
import UndoIcon from '@mui/icons-material/Undo';
import { Paper, PaperPdf } from '../types';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

// Font loading fix
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface PDFReaderProps {
    paper: Paper;
    pdf: PaperPdf;
    onClose: () => void;
    onPdfChange: (pdf: PaperPdf) => void;
    isResizing?: boolean;
}

interface JumpHistory {
    scrollTop: number;
    page: number;
}

const PDFReader: React.FC<PDFReaderProps> = ({ paper, pdf, onClose, onPdfChange, isResizing = false }) => {
    const { t } = useTranslation();
    const theme = useTheme();

    const [numPages, setNumPages] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageInput, setPageInput] = useState("1");
    // Scale state: number or 'page-width' or 'page-height'
    const [scale, setScale] = useState<number | 'page-width' | 'page-height'>('page-width');
    const [customScaleInput, setCustomScaleInput] = useState("Fit Width");
    const [isScaleInputFocused, setIsScaleInputFocused] = useState(false);

    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    const [jumpHistory, setJumpHistory] = useState<JumpHistory[]>([]);

    // Watch container resize
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                const rect = entries[0].contentRect;
                // Leave space for scrollbar to avoid jitter if necessary, though
                // usually simple resize observation is enough. The jitter often comes from
                // the scrollbar appearing/disappearing.
                setContainerWidth(rect.width);
                setContainerHeight(rect.height);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Load PDF
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

    // Update customScaleInput when scale changes
    useEffect(() => {
        if (isScaleInputFocused) return; // Don't update while editing

        if (scale === 'page-width') {
            setCustomScaleInput(t('app.fit_width'));
        } else if (scale === 'page-height') {
            setCustomScaleInput(t('app.fit_height'));
        } else {
            setCustomScaleInput(`${Math.round(scale * 100)}%`);
        }
    }, [scale, t, isScaleInputFocused]);

    // Sync pageInput with currentPage
    useEffect(() => {
        setPageInput(String(currentPage));
    }, [currentPage]);

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
    };

    const handleZoomIn = () => {
        // Step 10%, round to 1 decimal
        let currentVal = typeof scale === 'string' ? 1.0 : scale;
        // If fit-width/height, we don't know exact start, default to 100% then zoom
        // Or better: try to estimate from container width? difficult without page width.
        // We accept 1.0 jump for now.
        const newVal = Math.min(Math.round((currentVal + 0.1) * 10) / 10, 5.0);
        setScale(newVal);
    };

    const handleZoomOut = () => {
        let currentVal = typeof scale === 'string' ? 1.0 : scale;
        const newVal = Math.max(Math.round((currentVal - 0.1) * 10) / 10, 0.1);
        setScale(newVal);
    };

    const handleScaleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsScaleInputFocused(true);
        e.target.select();

        // If current is Fit Width/Height, show approximate or default 100% just for editing start
        if (typeof scale === 'string') {
            // Ideally we'd know the real scale. 
            // Without it, maybe just show empty or 100?
            setCustomScaleInput("100");
        } else {
            setCustomScaleInput(`${Math.round(scale * 100)}`);
        }
    };

    const handleScaleInputBlur = () => {
        setIsScaleInputFocused(false);
        handleScaleInputCommit();
    };

    const handleScaleInputCommit = () => {
        const val = parseFloat(customScaleInput.replace('%', ''));
        if (!isNaN(val)) {
            const clamped = Math.max(10, Math.min(val, 500));
            setScale(clamped / 100);
        } else {
            // Revert
            if (scale === 'page-width') setCustomScaleInput(t('app.fit_width'));
            else if (scale === 'page-height') setCustomScaleInput(t('app.fit_height'));
            else setCustomScaleInput(`${Math.round(scale * 100)}%`);
        }
    };

    const handlePageInputCommit = () => {
        const val = parseInt(pageInput);
        if (!isNaN(val) && val >= 1 && val <= (numPages || 1)) {
            scrollToPage(val);
        } else {
            setPageInput(String(currentPage));
        }
    };

    const scrollToPage = (pageNum: number) => {
        const pageEl = document.getElementById(`pdf-page-${pageNum}`);
        if (pageEl) {
            pageEl.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) scrollToPage(currentPage - 1);
    };

    const handleNextPage = () => {
        if (numPages && currentPage < numPages) scrollToPage(currentPage + 1);
    };

    // Track scroll to update current page
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const pageElements = target.querySelectorAll('.pdf-page-container');
        let current = 1;

        for (let i = 0; i < pageElements.length; i++) {
            const el = pageElements[i] as HTMLElement;
            if (el.offsetTop <= target.scrollTop + target.clientHeight / 2) {
                current = i + 1;
            } else {
                break;
            }
        }
        if (current !== currentPage) {
            setCurrentPage(current);
        }
    };

    const handleLinkClick = (destPage: number) => {
        if (containerRef.current) {
            setJumpHistory([{
                page: currentPage,
                scrollTop: containerRef.current!.scrollTop
            }]);
        }
        scrollToPage(destPage);
    };

    const handleJumpBack = () => {
        if (jumpHistory.length === 0) return;
        const last = jumpHistory[jumpHistory.length - 1];
        setJumpHistory(prev => prev.slice(0, -1));

        if (containerRef.current) {
            containerRef.current.scrollTop = last.scrollTop;
            setCurrentPage(last.page);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default', position: 'relative' }}>
            {/* Top bar with file selector */}
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

            {/* Main Content (Continuous Scroll) */}
            <Box
                ref={containerRef}
                onScroll={handleScroll}
                onWheel={(e) => {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        const currentScale = typeof scale === 'string' ? 1.0 : scale;
                        // Accumulate delta to avoid jittery updates and ensure 10% steps
                        // Standard mouse wheel delta is usually +/- 100 or +/- 120
                        // We strictly want 0.1 change per "click" roughly
                        const delta = e.deltaY;
                        if (Math.abs(delta) > 5) { // Threshold
                            const direction = delta > 0 ? -0.1 : 0.1;
                            const newVal = Math.min(Math.max(Math.round((currentScale + direction) * 10) / 10, 0.1), 5.0);
                            if (newVal !== currentScale) {
                                setScale(newVal);
                            }
                        }
                    }
                }}
                sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden', // Prevent horizontal scrollbar from layout shift if possible
                    scrollbarGutter: 'stable', // Fix jitter
                    bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.200',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 2,
                    scrollBehavior: 'smooth'
                }}
            >
                {loading && (
                    <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
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
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={(err) => setError(err.message)}
                        onItemClick={({ pageNumber }) => {
                            if (pageNumber && pageNumber !== currentPage) {
                                handleLinkClick(pageNumber);
                            }
                        }}
                        loading={null}
                    >
                        {Array.from(new Array(numPages), (_, index) => {
                            const pageNum = index + 1;
                            return (
                                <Box
                                    id={`pdf-page-${pageNum}`}
                                    key={`page_${pageNum}`}
                                    className="pdf-page-container"
                                    sx={{ mb: 2 }}
                                    onClickCapture={(e) => {
                                        const target = e.target as HTMLElement;
                                        const anchor = target.closest('a');
                                        if (anchor) {
                                            const href = anchor.getAttribute('href');
                                            if (href && href.startsWith('#page=')) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const match = href.match(/#page=(\d+)/);
                                                if (match && match[1]) {
                                                    handleLinkClick(parseInt(match[1]));
                                                }
                                            } else if (target.closest('.react-pdf__Page__annotationLayer')) {
                                                handleLinkClick(currentPage);
                                            }
                                        }
                                    }}
                                >
                                    <Box sx={{ boxShadow: 3, bgcolor: 'background.paper' }}>
                                        <Page
                                            pageNumber={pageNum}
                                            width={scale === 'page-width' ? (containerWidth - 40) : undefined}
                                            height={scale === 'page-height' ? (containerHeight - 40) : undefined}
                                            scale={typeof scale === 'number' ? scale : 1}
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
                        borderColor: 'divider'
                    }}>
                        <CircularProgress />
                    </Box>
                )}
            </Box>

            {/* Floating Controls */}
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
                        maxWidth: '90%'
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
        </Box>
    );
};

export default PDFReader;
