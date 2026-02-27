import React from 'react';
import { Box, Typography } from '@mui/material';

// Maximum lines to show before collapsing
const ABSTRACT_COLLAPSED_LINES = 3;
const LINE_HEIGHT_EM = 1.5;
const COLLAPSED_MAX_HEIGHT = `${ABSTRACT_COLLAPSED_LINES * LINE_HEIGHT_EM}em`;

/**
 * A collapsible text block with a text-link toggle ("展开"/"收起").
 * The entire gradient overlay area is clickable.
 * Collapsed state is only used when readerActive=true.
 */
export const CollapsibleText: React.FC<{
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
