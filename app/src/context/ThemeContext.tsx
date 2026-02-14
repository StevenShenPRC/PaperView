import { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { ThemeProvider, useMediaQuery, CssBaseline } from '@mui/material';
import { createAppTheme } from '../theme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    resolvedMode: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useAppTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useAppTheme must be used within an AppThemeProvider');
    }
    return context;
};

export const AppThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<ThemeMode>('system');
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

    const resolvedMode = useMemo(() => {
        if (mode === 'system') {
            return prefersDarkMode ? 'dark' : 'light';
        }
        return mode;
    }, [mode, prefersDarkMode]);

    const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode]);

    return (
        <ThemeContext.Provider value={{ mode, setMode, resolvedMode }}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeContext.Provider>
    );
};
