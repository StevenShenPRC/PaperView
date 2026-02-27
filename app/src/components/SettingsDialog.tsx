import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Tabs, Tab,
    FormControl, InputLabel, Select, MenuItem, SelectChangeEvent, Typography, TextField
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../context/DialogContext';
import { ThemeMode } from '../context/ThemeContext';
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
    const dialog = useDialog();
    const [tabValue, setTabValue] = useState(0);
    const [settings, setSettings] = useState<AppSettings>({
        proxy_mode: 'system',
        proxy_url: '',
        ai_providers: [],
        active_ai_provider: '',
        theme_mode: 'system',
        translation_target_lang: 'zh',
        translation_prompt: '',
        translation_timeout: 120,
        batch_translate_merge: false,
        batch_translate_size: 5,
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
            const server_port = await store.get<number>('server_port') || 8080;
            const translation_prompt = await store.get<string>('translation_prompt') || '';
            const translation_timeout = await store.get<number>('translation_timeout') || 120;
            const translation_target_lang = await store.get<string>('translation_target_lang') || 'zh';
            const batch_translate_merge = await store.get<boolean>('batch_translate_merge') || false;
            const batch_translate_size = await store.get<number>('batch_translate_size') || 5;
            // theme_mode is passed via props for now, but we should sync it

            setSettings({
                proxy_mode: proxy_mode as any,
                proxy_url,
                ai_providers,
                active_ai_provider,
                theme_mode: mode,
                translation_target_lang,
                server_port,
                translation_prompt,
                translation_timeout,
                batch_translate_merge,
                batch_translate_size
            });
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    };

    const handleSave = async () => {
        try {
            // Check if port changed
            const oldPort = await store.get<number>('server_port');
            const portChanged = oldPort !== settings.server_port;

            await store.set('proxy_mode', settings.proxy_mode);
            await store.set('proxy_url', settings.proxy_url);
            await store.set('ai_providers', settings.ai_providers);
            await store.set('active_ai_provider', settings.active_ai_provider);
            await store.set('server_port', settings.server_port);

            // Translation settings
            await store.set('translation_target_lang', settings.translation_target_lang);
            await store.set('translation_prompt', settings.translation_prompt);
            await store.set('translation_timeout', settings.translation_timeout);
            await store.set('batch_translate_merge', settings.batch_translate_merge);
            await store.set('batch_translate_size', settings.batch_translate_size);

            await store.save();

            if (portChanged) {
                dialog.alert(t('app.restart_required_alert') || "Port changed. Please restart the application for changes to take effect.");
            }

            onClose();
        } catch (e) {
            console.error('Failed to save settings', e);
            dialog.alert('Failed to save settings');
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
                                value={(i18n.language || 'en').split('-')[0]}
                                label={t('app.language')}
                                onChange={handleLanguageChange}
                            >
                                <MenuItem value="en">English</MenuItem>
                                <MenuItem value="zh">简体中文</MenuItem>
                                <MenuItem value="ja">日本語</MenuItem>
                                <MenuItem value="ko">한국어</MenuItem>
                                <MenuItem value="fr">Français</MenuItem>
                                <MenuItem value="de">Deutsch</MenuItem>
                                <MenuItem value="es">Español</MenuItem>
                                <MenuItem value="ru">Русский</MenuItem>
                                <MenuItem value="it">Italiano</MenuItem>
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
                        settings={settings}
                        onChange={setSettings}
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
                                defaultValue="0.0.0.0"
                                InputProps={{ readOnly: true }}
                                variant="outlined"
                                size="small"
                            />
                            <TextField
                                label={t('app.port')}
                                value={settings.server_port || 8080}
                                onChange={(e) => setSettings({ ...settings, server_port: parseInt(e.target.value) || 8080 })}
                                variant="outlined"
                                size="small"
                                type="number"
                                helperText={t('app.restart_required_note') || "Restart required to apply changes"}
                                sx={(theme) => ({
                                    '& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button': {
                                        filter: theme.palette.mode === 'dark' ? 'invert(1)' : 'none',
                                        opacity: 1,
                                    }
                                })}
                            />
                        </Box>

                        <Box sx={{ mt: 3 }}>
                            <Button
                                variant="outlined"
                                color="primary"
                                onClick={() => {
                                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
                                    const downloadAnchorNode = document.createElement('a');
                                    downloadAnchorNode.setAttribute("href", dataStr);
                                    downloadAnchorNode.setAttribute("download", "paperview_config.json");
                                    document.body.appendChild(downloadAnchorNode);
                                    downloadAnchorNode.click();
                                    downloadAnchorNode.remove();
                                }}
                            >
                                {t('app.export_config') || "Export Configuration"}
                            </Button>
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
