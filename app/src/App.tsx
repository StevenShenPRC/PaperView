import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Box, CssBaseline, ThemeProvider, CircularProgress, Typography, useMediaQuery, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import { createAppTheme } from './theme';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import SettingsDialog from './components/SettingsDialog';
import PaperList from './components/PaperList';
import PDFReader from './components/PDFReader';
import { Batch, Paper, PaperPdf } from './types';
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

  // Snackbar State
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('info');

  // Rate Limit Dialog State
  const [rateLimitOpen, setRateLimitOpen] = useState(false);
  const [rateLimitMessage, setRateLimitMessage] = useState('');

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const showSnackbar = (message: string, severity: 'success' | 'info' | 'warning' | 'error') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleUpdateMetadata = async (paper: Paper) => {
    try {
      // Don't set global loading to true to avoid full list refresh
      // setLoading(true); 
      const updatedPaper = await invoke<Paper>('update_metadata', { id: paper.id, doi: paper.doi });
      setPapers(prev => prev.map(p => p.id === updatedPaper.id ? updatedPaper : p));
    } catch (error: any) {
      console.error('Failed to update metadata:', error);
      const errMsg = String(error);
      if (errMsg.includes("Publisher policy limit") || errMsg.includes("risk control")) {
        setRateLimitMessage(t('app.rate_limit_error') || `Updates limited by publisher: ${errMsg}`);
        setRateLimitOpen(true);
      } else {
        showSnackbar(`Failed to update: ${errMsg}`, 'error');
      }
      throw error; // Propagate to PaperList to stop spinner
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

  const [activePaper, setActivePaper] = useState<Paper | null>(null);
  const [activePdf, setActivePdf] = useState<PaperPdf | null>(null);
  const [pdfCollapsed, setPdfCollapsed] = useState(false);
  const [userSidebarCollapsed, setUserSidebarCollapsed] = useState(true);
  const [readerWidth, setReaderWidth] = useState(800); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);

  const handleReadPdf = (paper: Paper, pdf: PaperPdf) => {
    if (!activePdf || pdfCollapsed) {
      // Entering reader mode: save current sidebar state and collapse it
      setUserSidebarCollapsed(sidebarCollapsed);
      setSidebarCollapsed(true);
    }
    setActivePaper(paper);
    setActivePdf(pdf);
    setPdfCollapsed(false);
  };

  // Collapse reader: unmounts PDFReader component (releases resources) but keeps paper/pdf references
  const handleCollapseReader = () => {
    setPdfCollapsed(true);
    // Restore user's manual sidebar state
    setSidebarCollapsed(userSidebarCollapsed);
  };

  // Expand reader: re-mounts PDFReader with preserved paper/pdf references
  const handleExpandReader = () => {
    setPdfCollapsed(false);
    setUserSidebarCollapsed(sidebarCollapsed);
    setSidebarCollapsed(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new width: viewport width - mouse X - RightSidebar width (approx 350)
      const newWidth = window.innerWidth - e.clientX - 350;
      if (newWidth > 400 && newWidth < window.innerWidth - 600) {
        setReaderWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
        <Sidebar
          batches={batches}
          onSelectBatch={handleSelectBatch}
          selectedBatchId={selectedBatch?.id || null}
          onSettingsClick={() => setSettingsOpen(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => {
            setSidebarCollapsed(!sidebarCollapsed);
            if (!activePdf) {
              setUserSidebarCollapsed(!sidebarCollapsed);
            }
          }}
        />

        <Box component="main" sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Paper List Column - shrinks when reader is active */}
          <Box sx={{
            flexGrow: (activePdf && !pdfCollapsed) ? 0 : 1,
            width: (activePdf && !pdfCollapsed) ? `calc(100% - ${readerWidth}px)` : '100%',
            minWidth: (activePdf && !pdfCollapsed) ? '350px' : 'auto',
            borderRight: (activePdf && !pdfCollapsed) ? 1 : 0,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
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
                  onReadPdf={handleReadPdf}
                  batch={selectedBatch}
                  readerActive={!!(activePdf && !pdfCollapsed)}
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

          {/* Resizer Handle */}
          {activePdf && !pdfCollapsed && (
            <Box
              onMouseDown={handleMouseDown}
              sx={{
                width: '4px',
                cursor: 'col-resize',
                bgcolor: isResizing ? 'primary.main' : 'transparent',
                '&:hover': { bgcolor: 'primary.light' },
                transition: 'background-color 0.2s',
                zIndex: 10,
              }}
            />
          )}

          {/* Reader Column - only rendered when not collapsed (unmounts to release resources) */}
          {activePaper && activePdf && !pdfCollapsed && (
            <Box sx={{ width: `${readerWidth}px`, height: '100%', overflow: 'hidden' }}>
              <PDFReader
                paper={activePaper}
                pdf={activePdf}
                onClose={handleCollapseReader}
                onPdfChange={(pdf) => setActivePdf(pdf)}
                isResizing={isResizing}
              />
            </Box>
          )}
        </Box>

        <RightSidebar
          hasCollapsedPdf={!!(activePaper && activePdf && pdfCollapsed)}
          onExpandReader={handleExpandReader}
        />
      </Box>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mode={mode}
        onModeChange={setMode}
      />
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

      <Dialog
        open={rateLimitOpen}
        onClose={() => setRateLimitOpen(false)}
        aria-labelledby="rate-limit-dialog-title"
        aria-describedby="rate-limit-dialog-description"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="rate-limit-dialog-title" color="error">
          {t('app.warning') || "Warning"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="rate-limit-dialog-description" sx={{ color: 'text.primary', fontWeight: 'bold' }}>
            {rateLimitMessage}
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            {t('app.rate_limit_hint') || "Please wait a moment before trying again to avoid being blocked by the publisher."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRateLimitOpen(false)} color="primary" variant="contained" autoFocus>
            {t('app.confirm') || "I Understand"}
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

export default App;
