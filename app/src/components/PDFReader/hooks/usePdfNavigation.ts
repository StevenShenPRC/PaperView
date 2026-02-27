import { useState, useCallback, useRef } from 'react';

export function usePdfNavigation({ numPages, containerRef }: { numPages: number | undefined, containerRef: React.RefObject<HTMLDivElement | null> }) {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageInput, setPageInput] = useState("1");
    const [jumpHistory, setJumpHistory] = useState<number[]>([]);
    const isClickingRef = useRef(false);

    const scrollToPage = useCallback((page: number) => {
        if (!containerRef.current) return;
        const pageEl = containerRef.current.querySelector(`#pdf-page-${page}`);
        if (pageEl) {
            pageEl.scrollIntoView({ behavior: 'smooth' });
        }
    }, [containerRef]);

    const handlePageInputCommit = useCallback(() => {
        const p = parseInt(pageInput);
        if (!isNaN(p) && p >= 1 && p <= (numPages || 1)) {
            setJumpHistory(prev => [...prev, currentPage]);
            setCurrentPage(p);
            scrollToPage(p);
        } else {
            setPageInput(currentPage.toString());
        }
    }, [pageInput, numPages, currentPage, scrollToPage]);

    const handlePrevPage = useCallback(() => {
        if (currentPage > 1) {
            setCurrentPage(p => p - 1);
            setPageInput((currentPage - 1).toString());
            scrollToPage(currentPage - 1);
        }
    }, [currentPage, scrollToPage]);

    const handleNextPage = useCallback(() => {
        if (numPages && currentPage < numPages) {
            setCurrentPage(p => p + 1);
            setPageInput((currentPage + 1).toString());
            scrollToPage(currentPage + 1);
        }
    }, [currentPage, numPages, scrollToPage]);

    const handleScroll = useCallback(() => {
        if (!containerRef.current || isClickingRef.current) return;
        const container = containerRef.current;
        const elements = container.getElementsByClassName('pdf-page-container');
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            const rect = el.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            if (rect.top >= containerRect.top - 100 && rect.top <= containerRect.bottom) {
                const pageNum = i + 1;
                if (pageNum !== currentPage) {
                    setCurrentPage(pageNum);
                    setPageInput(pageNum.toString());
                }
                break;
            }
        }
    }, [currentPage, containerRef]);

    const handleLinkClick = useCallback((page: number) => {
        setJumpHistory(prev => [...prev, currentPage]);
        setCurrentPage(page);
        setPageInput(page.toString());
        scrollToPage(page);
    }, [currentPage, scrollToPage]);

    const handleJumpBack = useCallback(() => {
        if (jumpHistory.length > 0) {
            const h = [...jumpHistory];
            const p = h.pop()!;
            setJumpHistory(h);
            setCurrentPage(p);
            setPageInput(p.toString());
            scrollToPage(p);
        }
    }, [jumpHistory, scrollToPage]);

    const handlePageClickCapture = useCallback(() => {
        isClickingRef.current = true;
        setTimeout(() => isClickingRef.current = false, 500);
    }, []);

    return {
        currentPage, setCurrentPage, pageInput, setPageInput, jumpHistory,
        handlePageInputCommit, handlePrevPage, handleNextPage,
        handleScroll, handleLinkClick, handleJumpBack, handlePageClickCapture
    };
}
