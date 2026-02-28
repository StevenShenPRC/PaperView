import { useState, useEffect } from 'react';
import {
    Box, Typography, Switch, FormControl, InputLabel, Select, MenuItem, Divider,
    Card, CardContent, Grid, TextField
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { AppSettings, ModelMetadata, ModelRouting } from '../../types';
import { invoke } from '@tauri-apps/api/core';
import ProviderManager from './ProviderManager';

interface AiSettingsProps {
    settings: AppSettings;
    onChange: (settings: AppSettings) => void;
}

export default function AiSettings({ settings, onChange }: AiSettingsProps) {
    const { t } = useTranslation();

    // Data State
    const [modelDb, setModelDb] = useState<Record<string, any>>({});

    useEffect(() => {
        invoke<Record<string, any>>('get_model_database').then(db => {
            if (db) setModelDb(db);
        }).catch(err => console.error("Failed to load model db", err));
    }, []);

    const providers = settings.ai_providers || [];

    // Component for Global Model Routing Select
    const ModelRoutingSelect = ({
        label,
        value,
        onChangeValue,
        targetType
    }: {
        label: string,
        value?: ModelRouting,
        onChangeValue: (route: ModelRouting) => void,
        targetType?: 'chat' | 'embedding'
    }) => {
        const typedModels: { provider: string, model: ModelMetadata }[] = [];
        const unknownModels: { provider: string, model: ModelMetadata }[] = [];
        providers.forEach(p => {
            p.models.forEach(m => {
                if (!targetType || m.type === targetType || m.type === 'unknown') {
                    if (m.type === 'unknown') unknownModels.push({ provider: p.name, model: m });
                    else typedModels.push({ provider: p.name, model: m });
                }
            });
        });

        const currentValue = value ? `${value.provider}::${value.model_id}` : '';

        const renderItem = (item: { provider: string, model: ModelMetadata }) => (
            <MenuItem key={`${item.provider}::${item.model.id}`} value={`${item.provider}::${item.model.id}`}>
                {item.provider} — {item.model.display_name || item.model.id}
                {item.model.type !== 'unknown' && ` (${item.model.type})`}
            </MenuItem>
        );

        return (
            <FormControl fullWidth size="small">
                <InputLabel>{label}</InputLabel>
                <Select
                    label={label}
                    value={currentValue}
                    onChange={(e) => {
                        const val = e.target.value as string;
                        if (!val) return;
                        const sep = val.indexOf('::');
                        onChangeValue({ provider: val.slice(0, sep), model_id: val.slice(sep + 2) });
                    }}
                >
                    {typedModels.map(renderItem)}
                    {unknownModels.length > 0 && typedModels.length > 0 && <Divider sx={{ my: 0.5 }} />}
                    {unknownModels.length > 0 && (
                        <MenuItem disabled sx={{ fontSize: '0.75rem', color: 'text.secondary', py: 0.5 }}>
                            — {t('settings.unclassified_models') || 'Unclassified'} —
                        </MenuItem>
                    )}
                    {unknownModels.map(renderItem)}
                    {typedModels.length === 0 && unknownModels.length === 0 && <MenuItem disabled>No configured models available</MenuItem>}
                </Select>
            </FormControl>
        );
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

            {/* Global AI Routing */}
            <Card variant="outlined">
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Typography variant="h6" gutterBottom>{t('settings.global_model_routing') || "Global Model Routing"}</Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                        {t('settings.global_routing_desc') || "Select the default models to use for different features across all configured providers."}
                    </Typography>

                    <Grid container spacing={3}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <ModelRoutingSelect
                                label={t('settings.default_chat_model') || "Default Chat Model"}
                                value={settings.default_chat_model}
                                targetType="chat"
                                onChangeValue={(val) => onChange({ ...settings, default_chat_model: val, active_ai_provider: val.provider })}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <ModelRoutingSelect
                                label={t('settings.default_translate_model') || "Default Translate Model"}
                                value={settings.default_translate_model}
                                targetType="chat"
                                onChangeValue={(val) => onChange({ ...settings, default_translate_model: val })}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <ModelRoutingSelect
                                label={t('settings.default_embedding_model') || "Default Embedding Model"}
                                value={settings.default_embedding_model}
                                targetType="embedding"
                                onChangeValue={(val) => onChange({ ...settings, default_embedding_model: val })}
                            />
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Provider Manager Extracted Component */}
            <ProviderManager
                providers={providers}
                onChange={(newProviders) => onChange({ ...settings, ai_providers: newProviders })}
                modelDb={modelDb}
            />

            {/* Global Translation Settings Section */}
            <Card variant="outlined" sx={{ overflow: 'visible' }}>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Typography variant="h6" gutterBottom>{t('settings.translation_settings') || "Translation Settings"}</Typography>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={3}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('settings.translation_target_lang') || "Target Language"}</InputLabel>
                                <Select
                                    label={t('settings.translation_target_lang') || "Target Language"}
                                    value={settings.translation_target_lang || 'zh'}
                                    onChange={(e) => onChange({ ...settings, translation_target_lang: e.target.value })}
                                >
                                    <MenuItem value="zh">简体中文 (Simplified Chinese)</MenuItem>
                                    <MenuItem value="en">English</MenuItem>
                                    <MenuItem value="ja">日本語 (Japanese)</MenuItem>
                                    <MenuItem value="ko">한국어 (Korean)</MenuItem>
                                    <MenuItem value="fr">Français (French)</MenuItem>
                                    <MenuItem value="de">Deutsch (German)</MenuItem>
                                    <MenuItem value="es">Español (Spanish)</MenuItem>
                                    <MenuItem value="ru">Русский (Russian)</MenuItem>
                                    <MenuItem value="it">Italiano (Italian)</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label={t('settings.translation_timeout') || "Translation Timeout (seconds)"}
                                value={settings.translation_timeout || 120}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    onChange({ ...settings, translation_timeout: isNaN(val) ? 120 : val });
                                }}
                                type="number"
                                fullWidth
                                size="small"
                                helperText={t('settings.translation_timeout_hint') || "Increase if you get timeout errors on large abstracts."}
                                sx={(theme) => ({
                                    '& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button': {
                                        filter: theme.palette.mode === 'dark' ? 'invert(1)' : 'none',
                                        opacity: 1,
                                    }
                                })}
                            />
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                            <TextField
                                label={t('settings.translation_prompt') || "Custom Translation Prompt"}
                                value={settings.translation_prompt || ''}
                                onChange={(e) => onChange({ ...settings, translation_prompt: e.target.value })}
                                fullWidth
                                multiline
                                rows={3}
                                placeholder={"Translate the following academic paper title and abstract into {{lang}}.\nReturn JSON format: { \"title_cn\": \"...\", \"abstract_cn\": \"...\" }."}
                                helperText={t('settings.translation_prompt_hint') || "Use {{lang}} to inject Target Language. Must ask for JSON format with title_cn and abstract_cn keys."}
                            />
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                            <Divider sx={{ my: 1 }} />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Box>
                                        <Typography variant="subtitle2">{t('settings.batch_translate_merge') || "Merge Batch Translation Requests"}</Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            {t('settings.batch_translate_merge_desc') || "Combines multiple papers into a single AI request."}
                                        </Typography>
                                    </Box>
                                    <Switch
                                        checked={settings.batch_translate_merge || false}
                                        onChange={(e) => onChange({ ...settings, batch_translate_merge: e.target.checked })}
                                    />
                                </Box>
                            </Box>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Box sx={{ opacity: settings.batch_translate_merge ? 1 : 0.4, transition: 'opacity 0.2s', pointerEvents: settings.batch_translate_merge ? 'auto' : 'none' }}>
                                <TextField
                                    label={t('settings.batch_translate_size') || "Merge Batch Size"}
                                    value={settings.batch_translate_size || 5}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        onChange({ ...settings, batch_translate_size: isNaN(val) ? 5 : val });
                                    }}
                                    type="number"
                                    fullWidth
                                    size="small"
                                    helperText={t('settings.batch_translate_size_hint') || "How many papers to translate in one API call."}
                                    sx={(theme) => ({
                                        '& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button': {
                                            filter: theme.palette.mode === 'dark' ? 'invert(1)' : 'none',
                                            opacity: 1,
                                        }
                                    })}
                                />
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        </Box>
    );
}

