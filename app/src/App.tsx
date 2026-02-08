import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Box, CssBaseline, ThemeProvider, CircularProgress, Typography, useMediaQuery } from '@mui/material';
import { createAppTheme } from './theme';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import SettingsDialog from './components/SettingsDialog';
import PaperList from './components/PaperList';
import { Batch, Paper } from './types';
import { useTranslation } from 'react-i18next';

import { listen } from '@tauri-apps/api/event';

export type ThemeMode = 'light' | 'dark' | 'system';

function App() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // Default to collapsed
  const { t } = useTranslation();

  // Theme State
  const [mode, setMode] = useState<ThemeMode>('system');
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = useMemo(() => {
    let resolvedMode: 'light' | 'dark';
    if (mode === 'system') {
      resolvedMode = prefersDarkMode ? 'dark' : 'light';
    } else {
      resolvedMode = mode;
    }
    return createAppTheme(resolvedMode);
  }, [mode, prefersDarkMode]);

  const refreshPapersForBatch = async (batch: Batch) => {
    // Silent refresh (no global loading)
    try {
      const result = await invoke<Paper[]>('get_papers', {
        journal: batch.journalName,
        volume: batch.issueVolume,
        date: batch.issueDate
      });
      setPapers(result);
    } catch (error) {
      console.error('Failed to refresh papers:', error);
    }
  };

  useEffect(() => {
    loadBatches();

    let unlistenData: (() => void) | undefined;
    let unlistenPaper: (() => void) | undefined;

    const setupListeners = async () => {
      console.log("Setting up event listeners...");

      unlistenData = await listen('data-updated', (event: any) => {
        console.log('Frontend received [data-updated]:', event.payload);
        loadBatches();

        setSelectedBatch(currentBatch => {
          if (currentBatch &&
            currentBatch.journalName === event.payload.journalName &&
            currentBatch.issueVolume === event.payload.issueVolume) {
            console.log("Refreshing current batch papers...");
            refreshPapersForBatch(currentBatch);
          }
          return currentBatch;
        });
      });

      unlistenPaper = await listen('paper-updated', (event: any) => {
        console.log('Frontend received [paper-updated]:', event.payload);
        const updatedPaper = event.payload as Paper;
        setPapers(prev => {
          const exists = prev.find(p => p.id === updatedPaper.id);
          if (exists) {
            console.log("Updating paper in list:", updatedPaper.title);
            return prev.map(p => p.id === updatedPaper.id ? updatedPaper : p);
          }
          return prev;
        });
      });

      console.log("Event listeners set up successfully.");
    };

    setupListeners();

    return () => {
      if (unlistenData) unlistenData();
      if (unlistenPaper) unlistenPaper();
    };
  }, []);

  const loadBatches = async () => {
    try {
      const result = await invoke<Batch[]>('get_batches');
      setBatches(result);
      // Don't auto-select on reload, preserve selection
      if (result.length > 0 && !selectedBatch) {
        // Only select first if nothing selected
        // Logic specific to initial load moved to separate effect if needed or checked via ref
      }
    } catch (error) {
      console.error('Failed to load batches:', error);
    }
  };

  const handleSelectBatch = async (batch: Batch) => {
    setSelectedBatch(batch);
    setLoading(true);
    try {
      const result = await invoke<Paper[]>('get_papers', {
        journal: batch.journalName,
        volume: batch.issueVolume,
        date: batch.issueDate
      });
      setPapers(result);
    } catch (error) {
      console.error('Failed to load papers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMetadata = async (paper: Paper) => {
    try {
      // Don't set global loading to true to avoid full list refresh
      // setLoading(true); 
      const updatedPaper = await invoke<Paper>('update_metadata', { id: paper.id, doi: paper.doi });
      setPapers(prev => prev.map(p => p.id === updatedPaper.id ? updatedPaper : p));
    } catch (error) {
      console.error('Failed to update metadata:', error);
      alert('Failed to update metadata: ' + error);
    } finally {
      // setLoading(false);
    }
  };

  const handleTranslate = async (paper: Paper) => {
    try {
      // Don't set global loading to true to avoid full list refresh if not needed, 
      // but here we might want to show some indicator on the card.
      // For now, let's just let it be async update.
      const updatedPaper = await invoke<Paper>('translate_paper', { id: paper.id });
      setPapers(prev => prev.map(p => p.id === updatedPaper.id ? updatedPaper : p));
    } catch (error) {
      console.error('Failed to translate:', error);
      alert('Failed to translate: ' + error);
    }
  };

  /*
  const handleSettingsOpen = () => {
    setSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
  };
  */

  return (


    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar
          batches={batches}
          onSelectBatch={handleSelectBatch}
          selectedBatchId={selectedBatch?.id || null}
          onSettingsClick={() => setSettingsOpen(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flexGrow: 1, overflow: 'hidden', p: 0, display: 'flex', flexDirection: 'column' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : selectedBatch ? (
              papers.length > 0 ? (
                <PaperList
                  papers={papers}
                  onUpdateMetadata={handleUpdateMetadata}
                  onTranslate={handleTranslate}
                  batch={selectedBatch}
                />
              ) : (
                <Box sx={{ p: 3, mt: 5, textAlign: 'center' }}>
                  <Typography variant="h6" color="textSecondary">
                    {t('app.no_batches')}
                  </Typography>
                </Box>
              )
            ) : (
              <Box sx={{ p: 3, mt: 5, textAlign: 'center' }}>
                <Typography variant="h5" color="textSecondary">
                  {t('app.select_batch_hint')}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <RightSidebar />
      </Box>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mode={mode}
        onModeChange={setMode}
      />
    </ThemeProvider>
  );
}

export default App;
