import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Tabs, Tab,
    FormControl, InputLabel, Select, MenuItem, SelectChangeEvent, Typography, TextField
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ThemeMode } from '../App';
import { AppSettings } from '../types';
import store from '../store';
import NetworkSettings from './settings/NetworkSettings';
import AiSettings from './settings/AiSettings';

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
    const [settings, setSettings] = useState<AppSettings>({
        proxy_mode: 'system',
        proxy_url: '',
        ai_providers: [],
        active_ai_provider: '',
        theme_mode: 'system'
    });

    useEffect(() => {
        if (open) {
            loadSettings();
        }
    }, [open]);

    const loadSettings = async () => {
        try {
            // Need to reload store to get fresh data from disk if changed elsewhere
            // await store.load();

            const proxy_mode = await store.get<string>('proxy_mode') || 'system';
            const proxy_url = await store.get<string>('proxy_url') || '';
            const ai_providers = await store.get<any[]>('ai_providers') || [];
            const active_ai_provider = await store.get<string>('active_ai_provider') || '';
            // theme_mode is passed via props for now, but we should sync it

            setSettings({
                proxy_mode: proxy_mode as any,
                proxy_url,
                ai_providers,
                active_ai_provider,
                theme_mode: mode
            });
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    };

    const handleSave = async () => {
        try {
            await store.set('proxy_mode', settings.proxy_mode);
            await store.set('proxy_url', settings.proxy_url);
            await store.set('ai_providers', settings.ai_providers);
            await store.set('active_ai_provider', settings.active_ai_provider);
            await store.save();
            onClose();
        } catch (e) {
            console.error('Failed to save settings', e);
            alert('Failed to save settings');
        }
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleThemeChange = (event: SelectChangeEvent) => {
        onModeChange(event.target.value as ThemeMode);
        // Also update local settings state to reflect
        setSettings({ ...settings, theme_mode: event.target.value as any });
    };

    const handleLanguageChange = (event: SelectChangeEvent) => {
        i18n.changeLanguage(event.target.value);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{t('app.settings')}</DialogTitle>
            <DialogContent>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
                        <Tab label={t('app.general')} />
                        <Tab label={t('app.network')} />
                        <Tab label={t('app.ai')} />
                        <Tab label={t('app.connection')} />
                    </Tabs>
                </Box>

                {/* General Tab */}
                <CustomTabPanel value={tabValue} index={0}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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

                        <FormControl fullWidth size="small">
                            <InputLabel id="language-select-label">{t('app.language')}</InputLabel>
                            <Select
                                labelId="language-select-label"
                                value={i18n.language.startsWith('zh') ? 'zh' : 'en'}
                                label={t('app.language')}
                                onChange={handleLanguageChange}
                            >
                                <MenuItem value="en">English</MenuItem>
                                <MenuItem value="zh">简体中文</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </CustomTabPanel>

                {/* Network Tab */}
                <CustomTabPanel value={tabValue} index={1}>
                    <NetworkSettings
                        settings={settings}
                        onChange={setSettings}
                    />
                </CustomTabPanel>

                {/* AI Tab */}
                <CustomTabPanel value={tabValue} index={2}>
                    <AiSettings
                        providers={settings.ai_providers}
                        activeProvider={settings.active_ai_provider || null}
                        onUpdateProviders={(providers) => setSettings({ ...settings, ai_providers: providers })}
                        onUpdateActive={(active) => setSettings({ ...settings, active_ai_provider: active || undefined })}
                    />
                </CustomTabPanel>

                {/* Connection Tab */}
                <CustomTabPanel value={tabValue} index={3}>
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
                                InputProps={{ readOnly: true }}
                                variant="outlined"
                                size="small"
                            />
                            <TextField
                                label={t('app.port')}
                                defaultValue="8080"
                                InputProps={{ readOnly: true }}
                                variant="outlined"
                                size="small"
                            />
                        </Box>
                    </Box>
                </CustomTabPanel>

            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">
                    {t('app.cancel')}
                </Button>
                <Button onClick={handleSave} color="primary" variant="contained">
                    {t('app.save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SettingsDialog;
