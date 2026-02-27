import { useState, useEffect } from 'react';
import { PaperPdf } from '../../../types';
import { invoke } from '@tauri-apps/api/core';

export function usePdfDocument(pdf: PaperPdf | null) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!pdf) {
            setPdfUrl(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        invoke<number[]>('read_pdf', { filename: pdf.filename })
            .then(bytes => {
                const uint8 = new Uint8Array(bytes);
                let binary = '';
                for (let i = 0; i < uint8.byteLength; i++) {
                    binary += String.fromCharCode(uint8[i]);
                }
                const base64 = btoa(binary);
                setPdfUrl(`data:application/pdf;base64,${base64}`);
                setLoading(false);
            })
            .catch(err => {
                setError(String(err));
                setLoading(false);
            });
    }, [pdf]);

    return { numPages, setNumPages, pdfUrl, loading, error };
}
