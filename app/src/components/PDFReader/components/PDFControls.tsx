import React from 'react';
import { Box, IconButton, TextField, InputAdornment } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import UndoIcon from '@mui/icons-material/Undo';

interface PDFControlsProps {
    t?: any; loading?: boolean; pdfUrl?: string | null; jumpHistory: number[]; handleJumpBack: () => void;
    handleZoomOut: () => void; handleZoomIn: () => void;
    customScaleInput: string; setCustomScaleInput: (s: string) => void;
    handleScaleInputFocus: (e: any) => void; handleScaleInputBlur: () => void;
    isScaleInputFocused?: boolean; scale: number | 'page-width' | 'page-height'; setScale: (s: any) => void;
    handlePrevPage: () => void; handleNextPage: () => void;
    currentPage: number; numPages: number | undefined;
    pageInput: string; setPageInput: (s: string) => void; handlePageInputCommit: () => void;
    handlePageInputFocus?: (e: any) => void; handlePageInputBlur?: () => void;
}

export const PDFControls: React.FC<PDFControlsProps> = ({
    t, jumpHistory, handleJumpBack, handleZoomOut, handleZoomIn, customScaleInput, setCustomScaleInput,
    handleScaleInputFocus, handleScaleInputBlur, scale, setScale,
    handlePrevPage, handleNextPage, currentPage, numPages, pageInput, setPageInput, handlePageInputCommit,
    handlePageInputFocus, handlePageInputBlur
}) => {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton disabled={jumpHistory.length === 0} onClick={handleJumpBack} size="small"><UndoIcon /></IconButton>
                <IconButton disabled={currentPage <= 1} onClick={handlePrevPage} size="small"><NavigateBeforeIcon /></IconButton>
                <TextField
                    size="small" value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)} onFocus={handlePageInputFocus} onBlur={handlePageInputBlur}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePageInputCommit(); (e.target as HTMLInputElement).blur(); } }}
                    sx={{ width: '80px' }} InputProps={{ endAdornment: <InputAdornment position="end">/ {numPages || '?'}</InputAdornment>, style: { textAlign: 'center' } }}
                />
                <IconButton disabled={numPages ? currentPage >= numPages : true} onClick={handleNextPage} size="small"><NavigateNextIcon /></IconButton>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton onClick={handleZoomOut} size="small"><ZoomOutIcon /></IconButton>
                <TextField select={false} size="small" value={customScaleInput} onChange={(e) => setCustomScaleInput(e.target.value)} onFocus={handleScaleInputFocus} onBlur={handleScaleInputBlur} sx={{ width: '100px', mx: 1, '& .MuiInputBase-input': { textAlign: 'center' } }} />
                <IconButton onClick={handleZoomIn} size="small"><ZoomInIcon /></IconButton>
                <Box sx={{ ml: 2, display: 'flex', gap: 1 }}>
                    <IconButton size="small" color={scale === 'page-width' ? 'primary' : 'default'} onClick={() => setScale('page-width')} title={t ? t('app.fit_width') : "Fit Width"}>↔</IconButton>
                    <IconButton size="small" color={scale === 'page-height' ? 'primary' : 'default'} onClick={() => setScale('page-height')} title={t ? t('app.fit_height') : "Fit Height"}>↕</IconButton>
                </Box>
            </Box>
        </Box>
    );
};
