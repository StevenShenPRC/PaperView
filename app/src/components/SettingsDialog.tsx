import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, TextField, Tabs, Tab,
    FormControl, InputLabel, Select, MenuItem, SelectChangeEvent
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ThemeMode } from '../App';

interface SettingsDialogProps {
    open: boolean;
    onClose: () => void;
    mode: ThemeMode;
    onModeChange: (mode: ThemeMode) => void;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function CustomTabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`settings-tabpanel-${index}`}
            aria-labelledby={`settings-tab-${index}`}
            {...other}
            style={{ padding: '20px 0' }}
        >
            {value === index && (
                <Box>
                    {children}
                </Box>
            )}
        </div>
    );
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose, mode, onModeChange }) => {
    const { t, i18n } = useTranslation();
    const [tabValue, setTabValue] = useState(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleThemeChange = (event: SelectChangeEvent) => {
        onModeChange(event.target.value as ThemeMode);
    };

    const handleLanguageChange = (event: SelectChangeEvent) => {
        i18n.changeLanguage(event.target.value);
        // Save to localStorage or similar if needed, typically i18next handles detection or persistence plugin
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('app.settings')}</DialogTitle>
            <DialogContent>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
                        <Tab label={t('app.general')} />
                        <Tab label={t('app.connection')} />
                    </Tabs>
                </Box>

                <CustomTabPanel value={tabValue} index={0}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* Theme Selection */}
                        <FormControl fullWidth size="small">
                            <InputLabel id="theme-select-label">{t('app.theme')}</InputLabel>
                            <Select
                                labelId="theme-select-label"
                                value={mode}
                                label={t('app.theme')}
                                onChange={handleThemeChange}
                            >
                                <MenuItem value="light">{t('app.theme_light')}</MenuItem>
                                <MenuItem value="dark">{t('app.theme_dark')}</MenuItem>
                                <MenuItem value="system">{t('app.theme_system')}</MenuItem>
                            </Select>
                        </FormControl>

                        {/* Language Selection */}
                        <FormControl fullWidth size="small">
                            <InputLabel id="language-select-label">{t('app.language')}</InputLabel>
                            <Select
                                labelId="language-select-label"
                                value={i18n.language.startsWith('zh') ? 'zh' : 'en'} // Simple check for now
                                label={t('app.language')}
                                onChange={handleLanguageChange}
                            >
                                <MenuItem value="en">English</MenuItem>
                                <MenuItem value="zh">简体中文</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </CustomTabPanel>

                <CustomTabPanel value={tabValue} index={1}>
                    <Box sx={{ mt: 0 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            {t('app.connection_info')}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" paragraph>
                            {t('app.connection_desc')}
                        </Typography>

                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <TextField
                                label={t('app.host')}
                                defaultValue="127.0.0.1"
                                InputProps={{
                                    readOnly: true,
                                }}
                                variant="outlined"
                                size="small"
                            />
                            <TextField
                                label={t('app.port')}
                                defaultValue="8080" // Hardcoded for now as per server implementation
                                InputProps={{
                                    readOnly: true,
                                }}
                                variant="outlined"
                                size="small"
                            />
                        </Box>
                    </Box>
                </CustomTabPanel>

            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary">
                    {t('app.close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SettingsDialog;
