import { useState } from 'react';

export function useAppNotifications() {
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('info');

    const [rateLimitOpen, setRateLimitOpen] = useState(false);
    const [rateLimitMessage, setRateLimitMessage] = useState('');

    const showSnackbar = (msg: string, severity: 'success' | 'info' | 'warning' | 'error' = 'info') => {
        setSnackbarMessage(msg);
        setSnackbarSeverity(severity);
        setSnackbarOpen(true);
    };

    const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') return;
        setSnackbarOpen(false);
    };

    const showRateLimitError = (msg: string) => {
        setRateLimitMessage(msg);
        setRateLimitOpen(true);
    };

    return {
        snackbarOpen, snackbarMessage, snackbarSeverity, handleCloseSnackbar, showSnackbar,
        rateLimitOpen, setRateLimitOpen, rateLimitMessage, showRateLimitError
    };
}
