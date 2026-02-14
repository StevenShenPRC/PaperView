import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface DialogOptions {
    title?: string;
    confirmText?: string;
    cancelText?: string;
}

interface DialogContextType {
    alert: (message: string, options?: DialogOptions) => Promise<void>;
    confirm: (message: string, options?: DialogOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useDialog = () => {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
};

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [type, setType] = useState<'alert' | 'confirm'>('alert');
    const [message, setMessage] = useState('');
    const [options, setOptions] = useState<DialogOptions>({});
    const [resolveRef, setResolveRef] = useState<((value: any) => void) | null>(null);

    const alert = useCallback((msg: string, opts?: DialogOptions) => {
        return new Promise<void>((resolve) => {
            setMessage(msg);
            setOptions(opts || {});
            setType('alert');
            setResolveRef(() => resolve);
            setOpen(true);
        });
    }, []);

    const confirm = useCallback((msg: string, opts?: DialogOptions) => {
        return new Promise<boolean>((resolve) => {
            setMessage(msg);
            setOptions(opts || {});
            setType('confirm');
            setResolveRef(() => resolve);
            setOpen(true);
        });
    }, []);

    const handleClose = (result: boolean) => {
        setOpen(false);
        if (resolveRef) {
            resolveRef(result); // For confirm, true/false. For alert, just resolve(undefined) technically triggers true/false but void ignores it.
            setResolveRef(null);
        }
    };

    return (
        <DialogContext.Provider value={{ alert, confirm }}>
            {children}
            <Dialog
                open={open}
                onClose={() => type === 'confirm' ? handleClose(false) : handleClose(true)}
                aria-labelledby="global-dialog-title"
                aria-describedby="global-dialog-description"
                maxWidth="sm"
                fullWidth
                slotProps={{
                    backdrop: {
                        sx: {
                            backdropFilter: 'blur(4px)',
                            backgroundColor: (theme) => theme.palette.mode === 'dark'
                                ? 'rgba(0, 0, 0, 0.6)'
                                : 'rgba(0, 0, 0, 0.2)',
                        }
                    },
                    paper: {
                        sx: {
                            borderRadius: 3,
                            border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
                            boxShadow: (theme) => theme.palette.mode === 'dark'
                                ? '0 24px 48px rgba(0,0,0,0.8)'
                                : '0 12px 24px rgba(0,0,0,0.1)',
                            backgroundImage: 'none',
                            backgroundColor: (theme) => theme.palette.mode === 'dark'
                                ? 'rgba(22, 27, 34, 0.95)'
                                : 'rgba(255, 255, 255, 0.98)',
                            backdropFilter: 'blur(16px)',
                        }
                    }
                }}
            >
                <DialogTitle
                    id="global-dialog-title"
                    sx={{
                        fontWeight: 600,
                        fontSize: '1.25rem',
                        pb: 1,
                        color: (theme) => theme.palette.text.primary,
                    }}
                >
                    {options.title || (type === 'confirm' ? (t('app.confirm') || "Confirm") : (t('app.alert') || "Alert"))}
                </DialogTitle>
                <DialogContent sx={{ pb: 1 }}>
                    <DialogContentText
                        id="global-dialog-description"
                        sx={{
                            color: (theme) => theme.palette.text.secondary,
                            lineHeight: 1.6,
                        }}
                    >
                        {message}
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 2.5, pt: 1.5 }}>
                    {type === 'confirm' && (
                        <Button
                            onClick={() => handleClose(false)}
                            color="inherit"
                            sx={{
                                borderRadius: 1.5,
                                px: 2,
                                color: (theme) => theme.palette.text.secondary,
                                '&:hover': {
                                    backgroundColor: (theme) => theme.palette.action.hover,
                                }
                            }}
                        >
                            {options.cancelText || t('app.cancel') || "Cancel"}
                        </Button>
                    )}
                    <Button
                        onClick={() => handleClose(true)}
                        color="primary"
                        variant="contained"
                        autoFocus
                        sx={{
                            borderRadius: 1.5,
                            px: 3,
                            boxShadow: 'none',
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': {
                                boxShadow: (theme) => `0 4px 12px ${theme.palette.primary.main}40`,
                            }
                        }}
                    >
                        {options.confirmText || (type === 'confirm' ? (t('app.confirm') || "Confirm") : (t('app.ok') || "OK"))}
                    </Button>
                </DialogActions>
            </Dialog>
        </DialogContext.Provider>
    );
};
