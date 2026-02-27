import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Paper, PaperPdf } from '../../../types';

interface PDFTopBarProps { t?: any; paper: Paper; pdf: PaperPdf; onPdfChange?: (pdf: PaperPdf) => void; onClose: () => void; }

export const PDFTopBar: React.FC<PDFTopBarProps> = ({ paper, pdf, onClose }) => {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
            <Typography variant="subtitle2" noWrap sx={{ maxWidth: '80%', px: 1 }}>
                {pdf.display_name || pdf.filename} - {paper.title}
            </Typography>
            <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>
    );
};
