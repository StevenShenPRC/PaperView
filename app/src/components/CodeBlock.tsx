import React, { useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';

interface CodeBlockProps {
    children: React.ReactNode;
    className?: string;
    inline?: boolean;
    [key: string]: any;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ children, className, inline, ...props }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const match = /language-(\w+)/.exec(className || '');
    const isBlock = !inline && match;

    const handleCopy = async () => {
        if (!children) return;

        try {
            await navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    if (!isBlock) {
        return (
            <code className={className} {...props} style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace' }}>
                {children}
            </code>
        );
    }

    return (
        <Box sx={{ position: 'relative', my: 1, borderRadius: 1, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
            {/* Header / Language Label / Copy Button */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                bgcolor: 'action.hover',
                px: 2,
                py: 0.5,
                borderBottom: 1,
                borderColor: 'divider'
            }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'text.secondary', textTransform: 'uppercase' }}>
                    {match?.[1] || 'code'}
                </Typography>
                <Tooltip title={copied ? (t('app.copied') || "Copied!") : (t('app.copy_code') || "Copy Code")}>
                    <IconButton onClick={handleCopy} size="small" sx={{ ml: 1 }}>
                        {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Code Content */}
            <Box sx={{
                overflowX: 'auto',
                p: 2,
                bgcolor: 'background.paper', // Or a specific code block bg
                '& pre': { margin: 0 } // Reset pre margin
            }}>
                <code className={className} {...props} style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {children}
                </code>
            </Box>
        </Box>
    );
};

export default CodeBlock;
