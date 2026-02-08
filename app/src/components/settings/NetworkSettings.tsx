import React from 'react';
import { Box, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../../types';

interface NetworkSettingsProps {
    settings: AppSettings;
    onChange: (newSettings: AppSettings) => void;
}

const NetworkSettings: React.FC<NetworkSettingsProps> = ({ settings, onChange }) => {
    const { t } = useTranslation();

    const handleProxyModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...settings, proxy_mode: event.target.value as any });
    };

    const handleProxyUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...settings, proxy_url: event.target.value });
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControl>
                <FormLabel id="proxy-mode-label">{t('app.proxy_mode')}</FormLabel>
                <RadioGroup
                    aria-labelledby="proxy-mode-label"
                    value={settings.proxy_mode}
                    onChange={handleProxyModeChange}
                >
                    <FormControlLabel value="none" control={<Radio />} label={t('app.proxy_none')} />
                    <FormControlLabel value="system" control={<Radio />} label={t('app.proxy_system')} />
                    <FormControlLabel value="custom" control={<Radio />} label={t('app.proxy_custom')} />
                </RadioGroup>
            </FormControl>

            {settings.proxy_mode === 'custom' && (
                <TextField
                    label={t('app.proxy_url')}
                    value={settings.proxy_url || ''}
                    onChange={handleProxyUrlChange}
                    fullWidth
                    size="small"
                    placeholder="socks5://127.0.0.1:7890"
                />
            )}
        </Box>
    );
};

export default NetworkSettings;
