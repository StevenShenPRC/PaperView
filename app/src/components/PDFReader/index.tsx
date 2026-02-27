import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Paper, PaperPdf, PendingContext } from '../../types';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { usePdfScale } from './hooks/usePdfScale';
import { usePdfNavigation } from './hooks/usePdfNavigation';
import { usePdfDocument } from './hooks/usePdfDocument';
import { usePdfContextMenu } from './hooks/usePdfContextMenu';

import { PDFTopBar } from './components/PDFTopBar';
import { PDFControls } from './components/PDFControls';
import { PDFContextMenu } from './components/PDFContextMenu';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

const PAGE_PADDING = 40;

interface PDFReaderProps {
    paper: Paper;
    pdf: PaperPdf;
    onClose: () => void;
    onPdfChange: (pdf: PaperPdf) => void;
    isResizing?: boolean;
    onAddContext?: (context: PendingContext) => void;
}

const PDFReader: React.FC<PDFReaderProps> = ({ paper, pdf, onClose, onPdfChange, isResizing = false, onAddContext }) => {
    const { t } = useTranslation();
    const theme = useTheme();

    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    const availableWidth = Math.max(containerWidth - PAGE_PADDING, 100);
    const availableHeight = Math.max(containerHeight - PAGE_PADDING, 100);

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

    const {
        numPages, setNumPages, pdfUrl, loading, error
    } = usePdfDocument(pdf);

    const {
        scale, setScale, customScaleInput, setCustomScaleInput, isScaleInputFocused,
        pageWidth, pageHeight, contentOverflows,
        handleZoomIn, handleZoomOut, handleWheelZoom,
        handleScaleInputFocus, handleScaleInputBlur
    } = usePdfScale({ availableWidth, availableHeight, t });

    const {
        currentPage, setCurrentPage, pageInput, setPageInput, jumpHistory,
        handlePageInputCommit, handlePrevPage, handleNextPage,
        handleScroll, handleLinkClick, handleJumpBack, handlePageClickCapture
    } = usePdfNavigation({ numPages, containerRef });

    const {
        contextMenu, setContextMenu, handleMouseUp,
        handleCopy, handleNewChat, handleAppendChat
    } = usePdfContextMenu({ containerRef, pdf, onAddContext });

    // Reset pagination when pdf changes
    useEffect(() => {
        if (pdf) {
            setCurrentPage(1);
            setPageInput("1");
        }
    }, [pdf, setCurrentPage, setPageInput]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default', position: 'relative' }}>
            <PDFTopBar
                t={t}
                paper={paper}
                pdf={pdf}
                onPdfChange={onPdfChange}
                onClose={onClose}
            />

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
                                        id={`pdf-page-${pageNum}`}
                                        key={`page_${pageNum}`}
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

            <PDFControls
                t={t}
                loading={loading}
                pdfUrl={pdfUrl}
                jumpHistory={jumpHistory}
                handleJumpBack={handleJumpBack}
                handleZoomOut={handleZoomOut}
                handleZoomIn={handleZoomIn}
                customScaleInput={customScaleInput}
                setCustomScaleInput={setCustomScaleInput}
                handleScaleInputFocus={handleScaleInputFocus}
                handleScaleInputBlur={handleScaleInputBlur}
                isScaleInputFocused={isScaleInputFocused}
                scale={scale}
                setScale={setScale}
                handlePrevPage={handlePrevPage}
                handleNextPage={handleNextPage}
                currentPage={currentPage}
                numPages={numPages}
                pageInput={pageInput}
                setPageInput={setPageInput}
                handlePageInputCommit={handlePageInputCommit}
            />

            <PDFContextMenu
                t={t}
                contextMenu={contextMenu}
                setContextMenu={setContextMenu}
                handleCopy={handleCopy}
                handleNewChat={handleNewChat}
                handleAppendChat={handleAppendChat}
            />
        </Box>
    );
};

export default PDFReader;
