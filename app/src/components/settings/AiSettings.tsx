import React, { useState } from 'react';
import {
    Box, Typography, List, ListItem, ListItemText, ListItemSecondaryAction,
    IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Switch, FormControl, InputLabel, Select, MenuItem, Chip, Tooltip, CircularProgress, Divider,
    Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import { AiProvider } from '../../types';
import { invoke } from '@tauri-apps/api/core';

interface AiSettingsProps {
    providers: AiProvider[];
    activeProvider: string | null;
    onUpdateProviders: (providers: AiProvider[]) => void;
    onUpdateActive: (name: string | null) => void;
}

const PRESETS = [
    { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-3.5-turbo'] },
    { name: 'DeepSeek (深度求索)', baseUrl: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-coder'] },
    { name: 'Moonshot (Kimi)', baseUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
    { name: 'Qwen (通义千问)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-max'] },
    { name: 'SiliconFlow (硅基流动)', baseUrl: 'https://api.siliconflow.cn/v1', models: ['Qwen/Qwen2.5-7B-Instruct', 'THUDM/glm-4-9b-chat'] },
    { name: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1', models: ['llama3', 'mistral'] }
];

const AiSettings: React.FC<AiSettingsProps> = ({
    providers,
    activeProvider,
    onUpdateProviders,
    onUpdateActive
}) => {
    const { t } = useTranslation();
    const [openDialog, setOpenDialog] = useState(false);
    const [editingProvider, setEditingProvider] = useState<AiProvider | null>(null);

    // Dialog State
    const [name, setName] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [apiKey, setApiKey] = useState('');

    // Models State
    const [modelsList, setModelsList] = useState<string[]>([]);
    const [defaultModel, setDefaultModel] = useState('');

    const [headers, setHeaders] = useState(''); // JSON string
    const [isFetchingModels, setIsFetchingModels] = useState(false);

    // Custom Model Dialog
    const [openModelDialog, setOpenModelDialog] = useState(false);
    const [newModelName, setNewModelName] = useState('');

    const handleOpenDialog = (provider?: AiProvider) => {
        if (provider) {
            setEditingProvider(provider);
            setName(provider.name);
            setBaseUrl(provider.base_url);
            setApiKey(provider.api_key);
            setModelsList(provider.models);
            setDefaultModel(provider.default_model || provider.models[0] || '');
            setHeaders(provider.additional_headers ? JSON.stringify(provider.additional_headers, null, 2) : '');
        } else {
            setEditingProvider(null);
            setName('');
            setBaseUrl('');
            setApiKey('');
            setModelsList([]);
            setDefaultModel('');
            setHeaders('');
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
    };

    const handleSave = () => {
        let parsedHeaders = undefined;
        if (headers.trim()) {
            try {
                parsedHeaders = JSON.parse(headers);
            } catch (e) {
                alert(t('settings.invalid_json_headers'));
                return;
            }
        }

        const newProvider: AiProvider = {
            name: name.trim(),
            base_url: baseUrl.trim(),
            api_key: apiKey.trim(),
            models: modelsList,
            default_model: defaultModel,
            additional_headers: parsedHeaders
        };

        if (editingProvider) {
            // Update existing
            const index = providers.findIndex(p => p.name === editingProvider.name);
            const newProviders = [...providers];
            if (index !== -1) {
                newProviders[index] = newProvider;
                // If we renamed the active provider, update active
                if (activeProvider === editingProvider.name && name !== editingProvider.name) {
                    onUpdateActive(newProvider.name);
                }
            }
            onUpdateProviders(newProviders);
        } else {
            // Add new
            if (providers.some(p => p.name === newProvider.name)) {
                alert(t('settings.provider_exists'));
                return;
            }
            onUpdateProviders([...providers, newProvider]);
        }
        handleCloseDialog();
    };

    const handleDelete = (providerName: string) => {
        if (confirm(t('settings.confirm_delete_provider'))) {
            const newProviders = providers.filter(p => p.name !== providerName);
            onUpdateProviders(newProviders);
            if (activeProvider === providerName) {
                onUpdateActive(null);
            }
        }
    };

    const handlePresetSelect = (presetName: string) => {
        const preset = PRESETS.find(p => p.name === presetName);
        if (preset) {
            if (!name) setName(preset.name.split(' ')[0]);
            setBaseUrl(preset.baseUrl);
            setModelsList(preset.models);
            if (preset.models.length > 0) setDefaultModel(preset.models[0]);
        }
    };

    const handleFetchModels = async () => {
        if (!baseUrl) {
            alert(t('settings.fill_basepath_apikey_first'));
            return;
        }

        setIsFetchingModels(true);
        try {
            let parsedHeaders = undefined;
            if (headers.trim()) {
                try { parsedHeaders = JSON.parse(headers); } catch (e) { }
            }

            const fetchedModels = await invoke<string[]>('fetch_models_command', {
                baseUrl: baseUrl.trim(),
                apiKey: apiKey.trim(),
                additionalHeaders: parsedHeaders
            });

            if (fetchedModels && fetchedModels.length > 0) {
                setModelsList(fetchedModels);
                // If current default is not in list, set to first fetched
                if (!fetchedModels.includes(defaultModel)) {
                    setDefaultModel(fetchedModels[0]);
                }
            } else {
                alert(t('settings.no_models_found'));
            }
        } catch (error) {
            console.error(error);
            alert(`${t('settings.fetch_failed')}: ${error}`);
        } finally {
            setIsFetchingModels(false);
        }
    };

    const handleAddCustomModel = () => {
        const trimmed = newModelName.trim();
        if (trimmed) {
            if (!modelsList.includes(trimmed)) {
                const newList = [...modelsList, trimmed];
                setModelsList(newList);
            }
            setDefaultModel(trimmed);
            setNewModelName('');
            setOpenModelDialog(false);
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">{t('settings.ai_providers')}</Typography>
                <Button startIcon={<AddIcon />} variant="contained" onClick={() => handleOpenDialog()}>
                    {t('common.add')}
                </Button>
            </Box>

            <List>
                {providers.map((provider) => (
                    <ListItem key={provider.name} divider>
                        <ListItemText
                            primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {provider.name}
                                    {activeProvider === provider.name && (
                                        <Chip label={t('common.active')} color="primary" size="small" />
                                    )}
                                </Box>
                            }
                            secondary={`${provider.base_url} - ${provider.default_model || (provider.models.length > 0 ? provider.models[0] : 'No model')}`}
                        />
                        <ListItemSecondaryAction>
                            <Switch
                                edge="end"
                                checked={activeProvider === provider.name}
                                onChange={() => onUpdateActive(provider.name)}
                                sx={{ mr: 2 }}
                            />
                            <IconButton edge="end" onClick={() => handleOpenDialog(provider)}>
                                <EditIcon />
                            </IconButton>
                            <IconButton edge="end" onClick={() => handleDelete(provider.name)}>
                                <DeleteIcon />
                            </IconButton>
                        </ListItemSecondaryAction>
                    </ListItem>
                ))}
            </List>

            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{editingProvider ? t('settings.edit_provider') : t('settings.add_provider')}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        {!editingProvider && (
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('settings.load_preset')}</InputLabel>
                                <Select
                                    label={t('settings.load_preset')}
                                    onChange={(e) => handlePresetSelect(e.target.value)}
                                    defaultValue=""
                                >
                                    <MenuItem value="" disabled>{t('settings.select_preset')}</MenuItem>
                                    {PRESETS.map(p => (
                                        <MenuItem key={p.name} value={p.name}>{p.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        <TextField
                            label={t('settings.provider_name')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            fullWidth
                            size="small"
                        />
                        <TextField
                            label={t('settings.base_url')}
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            fullWidth
                            size="small"
                            placeholder="https://api.openai.com/v1"
                        />
                        <TextField
                            label={t('settings.api_key')}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            fullWidth
                            size="small"
                            type="password"
                            helperText={t('settings.api_key_optional')}
                        />

                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('settings.models')}</InputLabel>
                                <Select
                                    label={t('settings.models')}
                                    value={defaultModel}
                                    onChange={(e) => {
                                        if (e.target.value === '___add_custom___') {
                                            setOpenModelDialog(true);
                                        } else {
                                            setDefaultModel(e.target.value);
                                        }
                                    }}
                                    renderValue={(selected) => selected}
                                >
                                    {modelsList.map((m) => (
                                        <MenuItem key={m} value={m}>{m}</MenuItem>
                                    ))}
                                    <Divider />
                                    <MenuItem value="___add_custom___">
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                                            <AddIcon fontSize="small" />
                                            {t('settings.add_custom_model')}
                                        </Box>
                                    </MenuItem>
                                </Select>
                            </FormControl>
                            <Tooltip title={t('settings.fetch_models_tooltip')}>
                                <span>
                                    <IconButton onClick={handleFetchModels} disabled={isFetchingModels || !baseUrl}>
                                        {isFetchingModels ? <CircularProgress size={24} /> : <RefreshIcon />}
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Box>

                        <Accordion elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
                                    <WarningIcon fontSize="small" />
                                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                        {t('settings.advanced_settings')}
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <TextField
                                    label={t('settings.custom_headers')}
                                    value={headers}
                                    onChange={(e) => setHeaders(e.target.value)}
                                    fullWidth
                                    size="small"
                                    multiline
                                    rows={3}
                                    placeholder='{ "X-Custom-Header": "Value" }'
                                    helperText={t('settings.headers_warning')}
                                    FormHelperTextProps={{ sx: { color: 'warning.main' } }}
                                />
                            </AccordionDetails>
                        </Accordion>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
                    <Button onClick={handleSave} variant="contained">{t('common.save')}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openModelDialog} onClose={() => setOpenModelDialog(false)}>
                <DialogTitle>{t('settings.add_custom_model')}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label={t('settings.model_name')}
                        fullWidth
                        size="small"
                        value={newModelName}
                        onChange={(e) => setNewModelName(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleAddCustomModel();
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenModelDialog(false)}>{t('common.cancel')}</Button>
                    <Button onClick={handleAddCustomModel} variant="contained">{t('common.add')}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AiSettings;
