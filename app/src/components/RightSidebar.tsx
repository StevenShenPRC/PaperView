import React from 'react';
import {
    Drawer, Typography, Box, TextField, Button, Divider
} from '@mui/material';
import { useTranslation } from 'react-i18next';

// We might want to pass props for height or width if needed, but for now hardcode
const drawerWidth = 300;

interface RightSidebarProps {
    // Add any props needed for chat state later
}

const RightSidebar: React.FC<RightSidebarProps> = () => {
    const { t } = useTranslation();
    return (
        <Drawer
            variant="permanent"
            anchor="right"
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
            }}
        >
            <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" gutterBottom>
                    {t('app.ai_assistant')}
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Box sx={{
                    flex: 1,
                    bgcolor: 'action.hover', // Use theme color instead of hardcoded #f0f0f0
                    mb: 2,
                    borderRadius: 1,
                    p: 2,
                    overflowY: 'auto'
                }}>
                    <Typography variant="body2" color="textSecondary">
                        {t('app.hello_message')}
                    </Typography>
                    {/* Chat messages would go here */}
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder={t('app.ask_placeholder')}
                        variant="outlined"
                        multiline
                        maxRows={4}
                    />
                    <Button variant="contained" size="small">
                        {t('app.send')}
                    </Button>
                </Box>
            </Box>
        </Drawer>
    );
};

export default RightSidebar;
