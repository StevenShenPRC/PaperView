import { useState, useEffect, useCallback } from 'react';
import { Paper, PaperPdf } from '../types';

export function useAppLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [userSidebarCollapsed, setUserSidebarCollapsed] = useState(true);

    const [activePaper, setActivePaper] = useState<Paper | null>(null);
    const [activePdf, setActivePdf] = useState<PaperPdf | null>(null);
    const [pdfCollapsed, setPdfCollapsed] = useState(false);

    const [readerWidth, setReaderWidth] = useState(800);
    const [isResizing, setIsResizing] = useState(false);

    const handleReadPdf = useCallback((paper: Paper, pdf: PaperPdf) => {
        if (!activePdf || pdfCollapsed) {
            setUserSidebarCollapsed(sidebarCollapsed);
            setSidebarCollapsed(true);
        }
        setActivePaper(paper);
        setActivePdf(pdf);
        setPdfCollapsed(false);
    }, [activePdf, pdfCollapsed, sidebarCollapsed]);

    const handleCollapseReader = useCallback(() => {
        setPdfCollapsed(true);
        setSidebarCollapsed(userSidebarCollapsed);
    }, [userSidebarCollapsed]);

    const handleExpandReader = useCallback(() => {
        setPdfCollapsed(false);
        setUserSidebarCollapsed(sidebarCollapsed);
        setSidebarCollapsed(true);
    }, [sidebarCollapsed]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsResizing(true);
        e.preventDefault();
    }, []);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = window.innerWidth - e.clientX - 350;
            if (newWidth > 400 && newWidth < window.innerWidth - 600) {
                setReaderWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    return {
        sidebarCollapsed, setSidebarCollapsed,
        userSidebarCollapsed, setUserSidebarCollapsed,
        activePaper, setActivePaper,
        activePdf, setActivePdf,
        pdfCollapsed, setPdfCollapsed,
        readerWidth, isResizing,
        handleReadPdf, handleCollapseReader, handleExpandReader, handleMouseDown
    };
}
