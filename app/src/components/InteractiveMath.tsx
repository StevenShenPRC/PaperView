import React, { useState } from 'react';
import katex from 'katex';
import { Menu, MenuItem, Tooltip, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface InteractiveMathProps {
    latex: string;
    block?: boolean;
}

const InteractiveMath: React.FC<InteractiveMathProps> = ({ latex, block }) => {
    const { t } = useTranslation();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [html, setHtml] = useState<string>('');

    React.useEffect(() => {
        try {
            const rendered = katex.renderToString(latex, {
                displayMode: block,
                throwOnError: false,
                output: 'html' // Ensure we get HTML output
            });
            setHtml(rendered);
        } catch (e) {
            console.error("KaTeX render error:", e);
            setHtml(`<span class="error">${latex}</span>`);
        }
    }, [latex, block]);

    const handleContextMenu = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation(); // Prevent bubbling to message copy listener
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleCopy = (type: 'latex' | 'text' | 'mathml') => {
        let content = '';
        if (type === 'latex') {
            content = latex;
        } else if (type === 'text') {
            // Simple strip? Or maybe use mml text?
            // For now, raw latex is often what people want for "text" of math?
            // Or maybe the rendered text content?
            content = latex;
        } else if (type === 'mathml') {
            try {
                content = katex.renderToString(latex, {
                    displayMode: block,
                    throwOnError: false,
                    output: 'mathml'
                });
            } catch (e) {
                content = latex;
            }
        }
        navigator.clipboard.writeText(content);
        handleClose();
    };

    return (
        <>
            <Tooltip title={t('app.math_context_menu_hint') || "Right click to copy formula"} arrow>
                <Box
                    component="span"
                    sx={{
                        display: block ? 'block' : 'inline-block',
                        textAlign: block ? 'center' : 'left',
                        my: block ? 1 : 0,
                        cursor: 'pointer',
                        borderRadius: 1,

                        // Scrollable for block math
                        overflowX: block ? 'auto' : 'visible',
                        maxWidth: '100%',
                        p: block ? 0.5 : 0, // Slight padding

                        transition: 'background-color 0.2s',
                        color: 'text.primary',
                        '& .katex': { color: 'inherit !important' },

                        '&:hover': {
                            backgroundColor: 'action.hover', // MUI theme color
                            outline: '1px dashed',
                            outlineColor: 'primary.main'
                        }
                    }}
                    onContextMenu={handleContextMenu}
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </Tooltip>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
            >
                <MenuItem onClick={() => handleCopy('latex')}>{t('app.copy_latex') || "Copy LaTeX"}</MenuItem>
                <MenuItem onClick={() => handleCopy('mathml')}>{t('app.copy_mathml') || "Copy MathML"}</MenuItem>
            </Menu>
        </>
    );

};

export default InteractiveMath;
