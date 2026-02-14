import { useState, useEffect, useCallback } from 'react';

interface FileDropOptions {
    onDrop: (files: File[], targetZone?: string) => void;
}

export const useFileDrop = ({ onDrop }: FileDropOptions) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragZone, setDragZone] = useState<string | null>(null);

    const handleDragEnter = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);

        // Check if entering a specific zone
        const target = e.target as HTMLElement;
        const zone = target.closest('[data-drop-zone]')?.getAttribute('data-drop-zone');
        if (zone) setDragZone(zone);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Only if leaving the window or the drop overlay
        if (e.relatedTarget === null || (e.target as HTMLElement).id === 'drop-overlay') {
            setIsDragging(false);
            setDragZone(null);
        }
    }, []);

    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Update zone if moving over specific elements
        const target = e.target as HTMLElement;
        const zone = target.closest('[data-drop-zone]')?.getAttribute('data-drop-zone');
        if (zone !== dragZone) setDragZone(zone || null);
    }, [dragZone]);

    const handleDrop = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        setDragZone(null);

        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            // Detect zone from event target
            const target = e.target as HTMLElement;
            const zone = target.closest('[data-drop-zone]')?.getAttribute('data-drop-zone') || undefined;
            onDrop(files, zone);
        }
    }, [onDrop]);

    useEffect(() => {
        window.addEventListener('dragenter', handleDragEnter);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('drop', handleDrop);
        };
    }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

    return { isDragging, dragZone };
};
