import { useState, useMemo } from 'react';
import {
    Box, Typography, IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, FormControl, InputLabel, Select, MenuItem, Tooltip, CircularProgress, Collapse, Chip,
    Accordion, AccordionSummary, AccordionDetails, List, ListItem, ListItemButton, ListItemText, InputAdornment,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HearingIcon from '@mui/icons-material/Hearing';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import BuildIcon from '@mui/icons-material/Build';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import StorageIcon from '@mui/icons-material/Storage';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';

import { useTranslation } from 'react-i18next';
import { AiProvider, ModelMetadata } from '../../types';
import { invoke } from '@tauri-apps/api/core';
import { useDialog } from '../../context/DialogContext';
import { resolveModelMeta, searchModelDb, applyDbEntryToModel, formatContextShort, formatContextDetail } from '../../utils/modelUtils';

interface ProviderManagerProps {
    providers: AiProvider[];
    onChange: (providers: AiProvider[]) => void;
    modelDb: Record<string, any>;
}

const PRESETS = [
    { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-3.5-turbo', 'text-embedding-3-small'] },
    { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-coder'] },
    { name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
    { name: 'Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-max'] },
    { name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', models: ['Qwen/Qwen2.5-7B-Instruct', 'THUDM/glm-4-9b-chat'] },
    { name: 'Ollama', baseUrl: 'http://localhost:11434/v1', models: ['llama3', 'mistral', 'nomic-embed-text'] }
];

// ─── Metadata presets for custom metadata ───
const META_PRESETS: { label: string; type: ModelMetadata['type']; ctx?: number; vision?: boolean; audio?: boolean; fn?: boolean; reasoning?: boolean }[] = [
    { label: 'Chat (4K)', type: 'chat', ctx: 4096 },
    { label: 'Chat (8K)', type: 'chat', ctx: 8192 },
    { label: 'Chat (32K)', type: 'chat', ctx: 32768 },
    { label: 'Chat (128K)', type: 'chat', ctx: 128000 },
    { label: 'Chat Vision (128K)', type: 'chat', ctx: 128000, vision: true },
    { label: 'Chat Reasoning (128K)', type: 'chat', ctx: 128000, reasoning: true },
    { label: 'Embedding (8K)', type: 'embedding', ctx: 8192 },
    { label: 'Audio (16K)', type: 'audio', ctx: 16000, audio: true },
    { label: 'Image Generation', type: 'image' },
    { label: 'Rerank', type: 'rerank' },
];

function typeColor(type: string): 'primary' | 'secondary' | 'warning' | 'error' | 'info' | 'success' | 'default' {
    switch (type) {
        case 'chat': return 'primary'; case 'embedding': return 'secondary';
        case 'audio': return 'warning'; case 'image': return 'success';
        case 'rerank': return 'info'; default: return 'default';
    }
}

export default function ProviderManager({ providers, onChange, modelDb }: ProviderManagerProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({});
    const toggleModels = (name: string) => setExpandedModels(prev => ({ ...prev, [name]: !prev[name] }));

    // ─── Provider Dialog ───
    const [openDialog, setOpenDialog] = useState(false);
    const [editingProvider, setEditingProvider] = useState<AiProvider | null>(null);
    const [pName, setPName] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [modelsList, setModelsList] = useState<ModelMetadata[]>([]);
    const [headers, setHeaders] = useState('');
    const [isFetchingModels, setIsFetchingModels] = useState(false);

    // ─── Unified Model Info Dialog ───
    const [infoDialogOpen, setInfoDialogOpen] = useState(false);
    const [infoModel, setInfoModel] = useState<ModelMetadata | null>(null);
    const [infoModelIndex, setInfoModelIndex] = useState<number>(-1);
    const [infoContext, setInfoContext] = useState<'edit' | 'external'>('edit');
    const [infoProviderName, setInfoProviderName] = useState<string | null>(null);
    const [infoDisplayName, setInfoDisplayName] = useState('');

    // ─── Metadata Search/Custom Dialog ───
    const [metaDialogOpen, setMetaDialogOpen] = useState(false);
    const [metaSearchQuery, setMetaSearchQuery] = useState('');
    const [metaDialogTab, setMetaDialogTab] = useState<'search' | 'custom'>('search');
    const [customType, setCustomType] = useState<ModelMetadata['type']>('chat');
    const [customContextLen, setCustomContextLen] = useState('');
    const [customVision, setCustomVision] = useState(false);
    const [customAudioIn, setCustomAudioIn] = useState(false);
    const [customFnCalling, setCustomFnCalling] = useState(false);
    const [customReasoning, setCustomReasoning] = useState(false);

    const metaSearchResults = useMemo(() => searchModelDb(modelDb, metaSearchQuery, 30), [modelDb, metaSearchQuery]);

    // ══════════════════════════════════════
    // Provider Dialog Handlers
    // ══════════════════════════════════════
    const handleOpenProvider = (provider?: AiProvider) => {
        if (provider) {
            setEditingProvider(provider); setPName(provider.name); setBaseUrl(provider.base_url);
            setApiKey(provider.api_key); setModelsList(provider.models || []);
            setHeaders(provider.additional_headers ? JSON.stringify(provider.additional_headers, null, 2) : '');
        } else {
            setEditingProvider(null); setPName(''); setBaseUrl(''); setApiKey(''); setModelsList([]); setHeaders('');
        }
        setOpenDialog(true);
    };

    const handleSaveProvider = () => {
        let parsedHeaders = undefined;
        if (headers.trim()) { try { parsedHeaders = JSON.parse(headers); } catch { dialog.alert(t('settings.invalid_json_headers') || 'Invalid JSON headers.'); return; } }
        const np: AiProvider = { name: pName.trim(), base_url: baseUrl.trim(), api_key: apiKey.trim(), models: modelsList, additional_headers: parsedHeaders };
        if (editingProvider) {
            const arr = [...providers]; const idx = arr.findIndex(p => p.name === editingProvider.name);
            if (idx !== -1) arr[idx] = np; onChange(arr);
        } else {
            if (providers.some(p => p.name === np.name)) { dialog.alert(t('settings.provider_exists') || 'Already exists.'); return; }
            onChange([...providers, np]);
        }
        setOpenDialog(false);
    };

    const handleDeleteProvider = async (n: string) => { if (await dialog.confirm(t('settings.confirm_delete_provider') || 'Delete provider?')) onChange(providers.filter(p => p.name !== n)); };

    const handlePreset = (pn: string) => { const pr = PRESETS.find(p => p.name === pn); if (pr) { if (!pName) setPName(pr.name); setBaseUrl(pr.baseUrl); setModelsList(pr.models.map(m => resolveModelMeta(m, modelDb))); } };

    const handleFetchModels = async () => {
        if (!baseUrl) { dialog.alert(t('settings.fill_basepath_apikey_first') || 'Fill Base URL first.'); return; }
        setIsFetchingModels(true);
        try {
            let ph: any = undefined; if (headers.trim()) try { ph = JSON.parse(headers); } catch { /* */ }
            const fetched = await invoke<string[]>('fetch_models_command', { baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), additionalHeaders: ph });
            if (fetched?.length) {
                setModelsList(fetched.map(m => { const old = modelsList.find(o => o.id === m); return resolveModelMeta(m, modelDb, old?.display_name); }));
            } else dialog.alert(t('settings.no_models_found') || 'No models found.');
        } catch (e) { dialog.alert(`${t('settings.fetch_failed') || 'Fetch failed'}: ${e}`); }
        finally { setIsFetchingModels(false); }
    };

    const handleDeleteModel = (i: number) => { const a = [...modelsList]; a.splice(i, 1); setModelsList(a); };
    const handleAddBlankModel = () => {
        setModelsList([...modelsList, { id: 'new-model', type: 'unknown', custom: true }]);
        openModelInfo(modelsList.length, 'edit');
    };

    // ══════════════════════════════════════
    // Unified Model Info Dialog
    // ══════════════════════════════════════
    const openModelInfo = (index: number, context: 'edit' | 'external', providerName?: string) => {
        const models = context === 'edit' ? modelsList : providers.find(p => p.name === providerName)?.models;
        const m = models?.[index]; if (!m) return;
        setInfoModel({ ...m }); setInfoModelIndex(index); setInfoContext(context);
        setInfoProviderName(providerName || null); setInfoDisplayName(m.display_name || '');
        setInfoDialogOpen(true);
    };

    const saveModelInfo = () => {
        if (!infoModel) return;
        const updated = { ...infoModel, display_name: infoDisplayName.trim() || undefined };
        if (infoContext === 'edit') {
            const arr = [...modelsList]; arr[infoModelIndex] = updated; setModelsList(arr);
        } else if (infoProviderName) {
            const np = [...providers]; const pi = np.findIndex(p => p.name === infoProviderName);
            if (pi !== -1) { const ml = [...np[pi].models]; ml[infoModelIndex] = updated; np[pi] = { ...np[pi], models: ml }; onChange(np); }
        }
        setInfoDialogOpen(false);
    };

    // Opens the search/custom dialog from within the info dialog
    const openMetaFromInfo = () => {
        if (!infoModel) return;
        // Try auto-match first
        const resolved = resolveModelMeta(infoModel.id, modelDb, infoDisplayName || infoModel.display_name);
        if (!resolved.custom || resolved.type !== 'unknown') {
            // Auto-matched: update directly
            setInfoModel(resolved); setInfoDisplayName(resolved.display_name || '');
            return;
        }
        // Open search dialog
        setMetaSearchQuery(infoModel.id); setMetaDialogTab('search');
        setCustomType('chat'); setCustomContextLen(''); setCustomVision(false); setCustomAudioIn(false); setCustomFnCalling(false); setCustomReasoning(false);
        setMetaDialogOpen(true);
    };

    // Called when clicking the error icon on external list
    const handleMissingMetaClick = (index: number, context: 'edit' | 'external', providerName?: string) => {
        const models = context === 'edit' ? modelsList : providers.find(p => p.name === providerName)?.models;
        const m = models?.[index]; if (!m) return;
        const resolved = resolveModelMeta(m.id, modelDb, m.display_name);
        if (!resolved.custom || resolved.type !== 'unknown') {
            // Auto-matched: apply and done
            if (context === 'edit') { const a = [...modelsList]; a[index] = resolved; setModelsList(a); }
            else if (providerName) {
                const np = [...providers]; const pi = np.findIndex(p => p.name === providerName);
                if (pi !== -1) { const ml = [...np[pi].models]; ml[index] = resolved; np[pi] = { ...np[pi], models: ml }; onChange(np); }
            }
            return;
        }
        // Open the model info dialog which gives access to search
        openModelInfo(index, context, providerName);
    };

    // ══════════════════════════════════════
    // Metadata Search/Custom Dialog actions
    // ══════════════════════════════════════
    const applySearchResult = (_key: string, entry: any) => {
        if (!infoModel) return;
        const updated = applyDbEntryToModel(infoModel.id, entry, infoDisplayName || infoModel.display_name);
        setInfoModel(updated); setInfoDisplayName(updated.display_name || '');
        setMetaDialogOpen(false);
    };

    const applyCustomMeta = () => {
        if (!infoModel) return;
        const ctxLen = parseInt(customContextLen) || undefined;
        const updated: ModelMetadata = {
            ...infoModel, type: customType, context_length: ctxLen,
            supports_vision: customVision, supports_audio_input: customAudioIn,
            supports_function_calling: customFnCalling, supports_reasoning: customReasoning,
            custom: false, raw_info: undefined,
            display_name: infoDisplayName || infoModel.display_name
        };
        setInfoModel(updated); setInfoDisplayName(updated.display_name || '');
        setMetaDialogOpen(false);
    };

    const loadMetaPreset = (p: typeof META_PRESETS[0]) => {
        setCustomType(p.type);
        setCustomContextLen(p.ctx?.toString() || '');
        setCustomVision(!!p.vision);
        setCustomAudioIn(!!p.audio);
        setCustomFnCalling(!!p.fn);
        setCustomReasoning(!!p.reasoning);
    };

    // ─── Icons ───
    const CapIcons = ({ m, clickable, onClick }: { m: ModelMetadata, clickable?: boolean, onClick?: () => void }) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
            {m.context_length && <Tooltip title={`${t('settings.context_length') || 'Context'}: ${m.context_length.toLocaleString()}`}><Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}><StorageIcon sx={{ fontSize: 14 }} color="primary" /><Typography variant="caption" color="primary" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>{formatContextShort(m.context_length)}</Typography></Box></Tooltip>}
            {m.supports_vision && <Tooltip title="Vision"><VisibilityIcon sx={{ fontSize: 16 }} color="info" /></Tooltip>}
            {m.supports_audio_input && <Tooltip title="Audio Input"><HearingIcon sx={{ fontSize: 16 }} color="warning" /></Tooltip>}
            {m.supports_audio_output && <Tooltip title="Audio Output"><RecordVoiceOverIcon sx={{ fontSize: 16 }} color="warning" /></Tooltip>}
            {m.supports_function_calling && <Tooltip title="Function Calling"><BuildIcon sx={{ fontSize: 16 }} color="action" /></Tooltip>}
            {m.supports_reasoning && <Tooltip title="Reasoning"><PsychologyIcon sx={{ fontSize: 16 }} color="secondary" /></Tooltip>}
            {m.supports_web_search && <Tooltip title="Web Search"><TravelExploreIcon sx={{ fontSize: 16 }} color="success" /></Tooltip>}
            {m.custom && m.type === 'unknown' && (
                <Tooltip title={t('settings.missing_metadata') || 'Metadata missing — click to fix'}>
                    {clickable ? <IconButton size="small" onClick={onClick} sx={{ p: 0 }}><ErrorOutlineIcon sx={{ fontSize: 16 }} color="error" /></IconButton>
                        : <ErrorOutlineIcon sx={{ fontSize: 16 }} color="error" />}
                </Tooltip>
            )}
        </Box>
    );

    // ─── Model Row (shared between external & edit lists) ───
    const ModelRow = ({ m, index, context, providerName }: { m: ModelMetadata, index: number, context: 'edit' | 'external', providerName?: string }) => (
        <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden', flex: 1 }}>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{m.display_name || m.id}</Typography>
                <Chip label={m.type} size="small" color={typeColor(m.type)} variant="outlined" sx={{ height: 20, fontSize: '0.7rem', flexShrink: 0 }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, ml: 1 }}>
                <CapIcons m={m} clickable onClick={() => handleMissingMetaClick(index, context, providerName)} />
                <Tooltip title={t('settings.model_info') || 'Info & Edit'}><IconButton size="small" onClick={() => openModelInfo(index, context, providerName)}><InfoOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                {context === 'edit' && (
                    <Tooltip title={t('common.delete') || 'Delete'}><IconButton size="small" color="error" onClick={() => handleDeleteModel(index)}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                )}
            </Box>
        </Box>
    );

    // ══════════════════ RENDER ══════════════════
    return (
        <>
            <Accordion defaultExpanded elevation={0} variant="outlined" sx={{ '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderBottom: 1, borderColor: 'divider', flexDirection: 'row-reverse', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2 }}>
                        <Typography variant="h6">{t('settings.ai_providers')}</Typography>
                        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={(e) => { e.stopPropagation(); handleOpenProvider(); }}>{t('common.add')}</Button>
                    </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                    {providers.length === 0 ? (
                        <Typography variant="body2" color="textSecondary" sx={{ p: 4, textAlign: 'center' }}>{t('settings.no_providers') || 'No providers configured.'}</Typography>
                    ) : (
                        <List disablePadding>
                            {providers.map((prov, i) => {
                                const isExp = expandedModels[prov.name] ?? false;
                                return (
                                    <ListItem key={prov.name} divider={i !== providers.length - 1} sx={{ flexDirection: 'column', alignItems: 'flex-start', p: 0 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', px: 3, pt: 2, pb: 1 }}>
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight="bold">{prov.name}</Typography>
                                                <Typography variant="body2" color="textSecondary">{prov.base_url}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <Button size="small" variant="text" endIcon={isExp ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                    onClick={() => toggleModels(prov.name)} sx={{ mr: 1, textTransform: 'none' }}>
                                                    {t('settings.model_list') || '模型列表'}：{prov.models.length}
                                                </Button>
                                                <Tooltip title={t('common.edit')}><IconButton size="small" onClick={() => handleOpenProvider(prov)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                                                <Tooltip title={t('common.delete')}><IconButton size="small" color="error" onClick={() => handleDeleteProvider(prov.name)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                                            </Box>
                                        </Box>
                                        <Collapse in={isExp} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
                                            <Box sx={{ maxHeight: 280, overflowY: 'auto', mx: 3, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.default', width: 'calc(100% - 48px)' }}>
                                                <List dense disablePadding>
                                                    {prov.models.map((m, j) => (
                                                        <ListItem key={j} divider={j !== prov.models.length - 1} sx={{ pr: 1 }}>
                                                            <ModelRow m={m} index={j} context="external" providerName={prov.name} />
                                                        </ListItem>
                                                    ))}
                                                    {prov.models.length === 0 && <Typography variant="body2" color="textSecondary" sx={{ p: 2, textAlign: 'center' }}>{t('settings.no_model') || 'No models.'}</Typography>}
                                                </List>
                                            </Box>
                                        </Collapse>
                                    </ListItem>
                                );
                            })}
                        </List>
                    )}
                </AccordionDetails>

                {/* ═══ Provider Edit Dialog ═══ */}
                <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>{editingProvider ? t('settings.edit_provider') : t('settings.add_provider')}</DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
                            {!editingProvider && (
                                <FormControl fullWidth size="small"><InputLabel>{t('settings.load_preset')}</InputLabel>
                                    <Select label={t('settings.load_preset')} onChange={(e) => handlePreset(e.target.value)} defaultValue="">
                                        <MenuItem value="" disabled>{t('settings.select_preset')}</MenuItem>
                                        {PRESETS.map(p => <MenuItem key={p.name} value={p.name}>{p.name}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            )}
                            <TextField label={t('settings.provider_name')} value={pName} onChange={e => setPName(e.target.value)} fullWidth size="small" />
                            <TextField label={t('settings.base_url')} value={baseUrl} onChange={e => setBaseUrl(e.target.value)} fullWidth size="small" placeholder="https://api.openai.com/v1" />
                            <TextField label={t('settings.api_key')} value={apiKey} onChange={e => setApiKey(e.target.value)} fullWidth size="small" type="password" helperText={t('settings.api_key_optional')} />

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="subtitle2">{t('settings.models')}</Typography>
                                    <Box>
                                        <Tooltip title={t('settings.fetch_models_tooltip') || 'Fetch'}><span>
                                            <IconButton size="small" onClick={handleFetchModels} disabled={isFetchingModels || !baseUrl} color="primary">
                                                {isFetchingModels ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                                            </IconButton>
                                        </span></Tooltip>
                                        <Tooltip title={t('settings.add_custom_model') || 'Add'}><span>
                                            <IconButton size="small" onClick={handleAddBlankModel} color="primary"><AddIcon fontSize="small" /></IconButton>
                                        </span></Tooltip>
                                    </Box>
                                </Box>
                                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 300, overflowY: 'auto' }}>
                                    <List dense disablePadding>
                                        {modelsList.map((m, idx) => (
                                            <ListItem key={idx} divider={idx !== modelsList.length - 1} sx={{ pr: 1 }}>
                                                <ModelRow m={m} index={idx} context="edit" />
                                            </ListItem>
                                        ))}
                                        {modelsList.length === 0 && <Typography variant="body2" color="textSecondary" sx={{ p: 2, textAlign: 'center' }}>{t('settings.no_model') || 'No models.'}</Typography>}
                                    </List>
                                </Box>
                            </Box>

                            <Accordion elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography variant="body2" color="text.secondary">{t('settings.advanced_settings') || 'Advanced'}</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <TextField label={t('settings.custom_headers')} value={headers} onChange={e => setHeaders(e.target.value)} fullWidth size="small" multiline rows={3} placeholder='{ "X-Custom-Header": "Value" }' />
                                </AccordionDetails>
                            </Accordion>
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button onClick={() => setOpenDialog(false)}>{t('common.cancel')}</Button>
                        <Button onClick={handleSaveProvider} variant="contained" disableElevation>{t('common.save')}</Button>
                    </DialogActions>
                </Dialog>
            </Accordion>

            {/* ═══ Unified Model Info & Edit Dialog ═══ */}
            <Dialog open={infoDialogOpen} onClose={() => setInfoDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t('settings.model_info') || 'Model Info'}</DialogTitle>
                <DialogContent>
                    {infoModel && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                            {/* Core info */}
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, alignItems: 'center' }}>
                                <Typography variant="body2" fontWeight="bold">ID:</Typography>
                                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{infoModel.id}</Typography>
                            </Box>

                            <TextField
                                label={t('settings.model_display_name') || 'Display Name'}
                                value={infoDisplayName}
                                onChange={e => setInfoDisplayName(e.target.value)}
                                size="small" fullWidth
                                placeholder={infoModel.id}
                                helperText={t('settings.display_name_hint') || 'Friendly name shown in the UI. Leave blank to use ID.'}
                            />

                            {/* Type & Capabilities */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" fontWeight="bold">{t('settings.model_type') || 'Type'}:</Typography>
                                <Chip label={infoModel.type} size="small" color={typeColor(infoModel.type)} variant="outlined" />
                                {infoModel.context_length && <Typography variant="body2" sx={{ ml: 1 }}>Context: {formatContextDetail(infoModel.context_length)}</Typography>}
                            </Box>

                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {infoModel.supports_vision && <Chip icon={<VisibilityIcon />} label="Vision" size="small" color="info" variant="outlined" />}
                                {infoModel.supports_audio_input && <Chip icon={<HearingIcon />} label="Audio In" size="small" color="warning" variant="outlined" />}
                                {infoModel.supports_audio_output && <Chip icon={<RecordVoiceOverIcon />} label="Audio Out" size="small" color="warning" variant="outlined" />}
                                {infoModel.supports_function_calling && <Chip icon={<BuildIcon />} label="Functions" size="small" variant="outlined" />}
                                {infoModel.supports_reasoning && <Chip icon={<PsychologyIcon />} label="Reasoning" size="small" color="secondary" variant="outlined" />}
                                {infoModel.supports_web_search && <Chip icon={<TravelExploreIcon />} label="Web Search" size="small" color="success" variant="outlined" />}
                            </Box>

                            {/* Match metadata button */}
                            <Button variant="outlined" size="small" startIcon={<SearchIcon />} onClick={openMetaFromInfo} sx={{ alignSelf: 'flex-start' }}>
                                {infoModel.custom && infoModel.type === 'unknown' ? (t('settings.match_metadata') || 'Match Metadata') : (t('settings.rematch_metadata') || 'Rematch Metadata')}
                            </Button>

                            {/* Raw JSON */}
                            {infoModel.raw_info && (
                                <Accordion elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography variant="body2" color="text.secondary">{t('settings.raw_metadata') || 'Raw JSON'}</Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ p: 0 }}>
                                        <Box component="pre" sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, overflow: 'auto', maxHeight: 200, fontSize: '0.7rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', m: 0 }}>
                                            {JSON.stringify(infoModel.raw_info, null, 2)}
                                        </Box>
                                    </AccordionDetails>
                                </Accordion>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setInfoDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={saveModelInfo} variant="contained" disableElevation>{t('common.save')}</Button>
                </DialogActions>
            </Dialog>

            {/* ═══ Metadata Search / Custom Dialog ═══ */}
            <Dialog open={metaDialogOpen} onClose={() => setMetaDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t('settings.match_metadata') || 'Match Metadata'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 1 }}>
                        <Button size="small" variant={metaDialogTab === 'search' ? 'contained' : 'outlined'} onClick={() => setMetaDialogTab('search')}>{t('settings.search_database') || 'Search'}</Button>
                        <Button size="small" variant={metaDialogTab === 'custom' ? 'contained' : 'outlined'} onClick={() => setMetaDialogTab('custom')}>{t('settings.custom_metadata') || 'Custom'}</Button>
                    </Box>

                    {metaDialogTab === 'search' ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <TextField
                                size="small" fullWidth autoFocus
                                placeholder={t('settings.search_hint') || 'e.g. "gpt 4o" or "qwen max"'}
                                value={metaSearchQuery} onChange={e => setMetaSearchQuery(e.target.value)}
                                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
                                helperText={t('settings.search_space_hint') || 'Use spaces for AND matching'}
                            />
                            <Box sx={{ maxHeight: 320, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <List dense disablePadding>
                                    {metaSearchResults.length === 0 && <Typography variant="body2" color="textSecondary" sx={{ p: 2, textAlign: 'center' }}>{t('settings.no_search_results') || 'No results.'}</Typography>}
                                    {metaSearchResults.map(([key, info], ri) => (
                                        <ListItemButton key={ri} divider onClick={() => applySearchResult(key, info)}>
                                            <ListItemText
                                                primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{key}</Typography><Chip label={info.mode || '?'} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} /></Box>}
                                                secondary={`${info.litellm_provider || ''} · ctx: ${(info.max_input_tokens || info.max_tokens || '?').toLocaleString()}`}
                                            />
                                        </ListItemButton>
                                    ))}
                                </List>
                            </Box>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('settings.load_preset') || 'Load Preset'}</InputLabel>
                                <Select label={t('settings.load_preset') || 'Load Preset'} value="" onChange={e => { const p = META_PRESETS.find(mp => mp.label === e.target.value); if (p) loadMetaPreset(p); }}>
                                    <MenuItem value="" disabled>{t('settings.select_preset') || 'Select...'}</MenuItem>
                                    {META_PRESETS.map(p => <MenuItem key={p.label} value={p.label}>{p.label}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('settings.model_type') || 'Type'}</InputLabel>
                                <Select label={t('settings.model_type')} value={customType} onChange={e => setCustomType(e.target.value as ModelMetadata['type'])}>
                                    <MenuItem value="chat">Chat</MenuItem><MenuItem value="embedding">Embedding</MenuItem>
                                    <MenuItem value="audio">Audio</MenuItem><MenuItem value="image">Image</MenuItem><MenuItem value="rerank">Rerank</MenuItem>
                                </Select>
                            </FormControl>
                            <TextField size="small" label={t('settings.context_length') || 'Context Length'} value={customContextLen} onChange={e => setCustomContextLen(e.target.value)} type="number" />
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                <Button size="small" variant={customVision ? 'contained' : 'outlined'} startIcon={<VisibilityIcon />} onClick={() => setCustomVision(!customVision)}>Vision</Button>
                                <Button size="small" variant={customAudioIn ? 'contained' : 'outlined'} startIcon={<HearingIcon />} onClick={() => setCustomAudioIn(!customAudioIn)}>Audio</Button>
                                <Button size="small" variant={customFnCalling ? 'contained' : 'outlined'} startIcon={<BuildIcon />} onClick={() => setCustomFnCalling(!customFnCalling)}>Functions</Button>
                                <Button size="small" variant={customReasoning ? 'contained' : 'outlined'} startIcon={<PsychologyIcon />} onClick={() => setCustomReasoning(!customReasoning)}>Reasoning</Button>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setMetaDialogOpen(false)}>{t('common.cancel')}</Button>
                    {metaDialogTab === 'custom' && <Button variant="contained" onClick={applyCustomMeta}>{t('common.apply') || 'Apply'}</Button>}
                </DialogActions>
            </Dialog>
        </>
    );
}
