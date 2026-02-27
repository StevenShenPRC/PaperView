import { useState, useEffect } from 'react';
import store from '../../../store';
// @ts-ignore
import removeMd from 'remove-markdown';

export function useCopyLogic() {
    const [copyAnchorEl, setCopyAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedCopyContent, setSelectedCopyContent] = useState('');
    const [copyFormatAnchorEl, setCopyFormatAnchorEl] = useState<null | HTMLElement>(null);
    const [defaultCopyFormat, setDefaultCopyFormat] = useState<'text' | 'markdown'>('text');

    useEffect(() => {
        store.get<string>('default_copy_format').then(fmt => {
            if (fmt === 'text' || fmt === 'markdown') {
                setDefaultCopyFormat(fmt);
            }
        });
    }, []);

    const handleCopyClick = (e: React.MouseEvent<HTMLElement>, content: string) => {
        e.preventDefault();
        if (e.button === 0) {
            handleCopyAction(content, defaultCopyFormat);
        }
    };

    const handleCopyContextMenu = (e: React.MouseEvent<HTMLElement>, content: string) => {
        e.preventDefault();
        setSelectedCopyContent(content);
        setCopyAnchorEl(e.currentTarget);
    };

    const handleCopyAction = (content: string, format: 'text' | 'markdown') => {
        let textToCopy = content;
        if (format === 'text') {
            try {
                textToCopy = removeMd(content);
            } catch (e) {
                console.error("Failed to strip markdown", e);
                textToCopy = content.replace(/[#*`]/g, '');
            }
        }
        navigator.clipboard.writeText(textToCopy);
        setCopyAnchorEl(null);
    };

    const saveDefaultCopyFormat = (format: 'text' | 'markdown') => {
        setDefaultCopyFormat(format);
        store.set('default_copy_format', format).then(() => store.save());
        setCopyFormatAnchorEl(null);
        setCopyAnchorEl(null);
    };

    return {
        copyAnchorEl, setCopyAnchorEl, selectedCopyContent, setSelectedCopyContent,
        copyFormatAnchorEl, setCopyFormatAnchorEl, defaultCopyFormat,
        handleCopyClick, handleCopyContextMenu, handleCopyAction, saveDefaultCopyFormat
    };
}
