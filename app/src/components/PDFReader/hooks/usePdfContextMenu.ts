import { useState, useCallback } from 'react';
import { PaperPdf, ContextItem, PendingContext } from '../../../types';

export function usePdfContextMenu({ containerRef, pdf, onAddContext }: {
    containerRef: React.RefObject<HTMLDivElement | null>,
    pdf: PaperPdf,
    onAddContext?: (ctx: PendingContext) => void
}) {
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    const [selectionText, setSelectionText] = useState("");

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        if (!containerRef?.current) return;
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim()) {
            setSelectionText(selection.toString().trim());
            setContextMenu({ x: e.clientX, y: e.clientY });
        } else {
            setContextMenu(null);
        }
    }, [containerRef]);

    const handleCopy = useCallback(async () => {
        if (selectionText) {
            await navigator.clipboard.writeText(selectionText);
        }
        setContextMenu(null);
    }, [selectionText]);

    const createContextItem = useCallback((optLabel?: string): ContextItem => ({
        id: Math.random().toString(36).substring(7),
        text: selectionText,
        source: pdf.display_name || pdf.filename,
        label: optLabel || "PDF Selection"
    }), [selectionText, pdf]);

    const handleNewChat = useCallback((promptPrefix: string) => {
        if (onAddContext && selectionText) {
            const item = createContextItem(promptPrefix || "Context");
            item.text = (promptPrefix ? promptPrefix + ":\n\n" : "") + item.text;
            onAddContext({ items: [item], mode: 'new' });
        }
        setContextMenu(null);
    }, [onAddContext, selectionText, createContextItem]);

    const handleAppendChat = useCallback(() => {
        if (onAddContext && selectionText) {
            onAddContext({ items: [createContextItem("Selected Text")], mode: 'append' });
        }
        setContextMenu(null);
    }, [onAddContext, selectionText, createContextItem]);

    return {
        contextMenu, setContextMenu, handleMouseUp,
        handleCopy, handleNewChat, handleAppendChat
    };
}
