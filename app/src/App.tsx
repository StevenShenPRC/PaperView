import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Box, CircularProgress, Typography, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import SettingsDialog from './components/SettingsDialog';
import PaperList from './components/PaperList';
import PDFReader from './components/PDFReader';
import { Batch, Paper, PaperPdf, Group, PendingContext } from './types';
import { useTranslation } from 'react-i18next';

import { useDialog } from './context/DialogContext';
import { useFileDrop } from './hooks/useFileDrop';
import { listen } from '@tauri-apps/api/event';
import { useAppTheme } from './context/ThemeContext';

function App() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // AI Context State
  const [pendingContext, setPendingContext] = useState<PendingContext | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // Default to collapsed

  const { t } = useTranslation();
  const dialog = useDialog();
  const { mode, setMode } = useAppTheme();

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
    loadGroups();

    let unlistenData: (() => void) | undefined;
    let unlistenPaper: (() => void) | undefined;

    const setupListeners = async () => {
      console.log("Setting up event listeners...");

      unlistenData = await listen('data-updated', (event: any) => {
        console.log('Frontend received [data-updated]:', event.payload);
        loadBatches();

        if (!event.payload) {
          return;
        }

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
    } catch (error) {
      console.error('Failed to load batches:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const result = await invoke<Group[]>('get_groups');
      setGroups(result);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const handleSelectBatch = async (batch: Batch) => {
    setSelectedBatch(batch);
    setSelectedGroup(null); // Clear group selection
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

  const handleSelectGroup = async (group: Group) => {
    setSelectedGroup(group);
    setSelectedBatch(null); // Clear batch selection
    setLoading(true);
    try {
      const result = await invoke<Paper[]>('get_papers_by_group', { groupId: group.id });
      setPapers(result);
    } catch (error) {
      console.error('Failed to load group papers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (name: string) => {
    try {
      await invoke('create_group', { name });
      loadGroups();
      showSnackbar(t('app.group_created') || "Group created", 'success');
    } catch (error) {
      console.error('Failed to create group:', error);
      showSnackbar(t('app.error_creating_group') || "Failed to create group", 'error');
    }
  };

  const handleRenameGroup = async (group: Group, name: string) => {
    try {
      await invoke('rename_group', { id: group.id, newName: name });
      loadGroups();
      // If renamed group is selected, update selection? 
      // It's safer to just reload.
      if (selectedGroup?.id === group.id) {
        setSelectedGroup(prev => prev ? ({ ...prev, name }) : null);
      }
      showSnackbar(t('app.group_renamed') || "Group renamed", 'success');
    } catch (error) {
      console.error('Failed to rename group:', error);
      showSnackbar(t('app.error_renaming_group') || "Failed to rename group", 'error');
    }
  };

  const handleDeleteGroup = async (group: Group) => {
    const confirmed = await dialog.confirm(
      t('app.confirm_delete_group', { name: group.name }) || `Are you sure you want to delete group "${group.name}"?`,
      { title: t('app.delete_group') || "Delete Group" }
    );

    if (confirmed) {
      try {
        await invoke('delete_group', { id: group.id });
        loadGroups();
        if (selectedGroup?.id === group.id) {
          setSelectedGroup(null);
          setPapers([]);
        }
        showSnackbar(t('app.group_deleted') || "Group deleted", 'success');
      } catch (error) {
        console.error('Failed to delete group:', error);
        showSnackbar(t('app.error_deleting_group') || "Failed to delete group", 'error');
      }
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
      dialog.alert('Failed to translate: ' + error);
    }
  };

  const handleAddToGroup = async (paperIds: number[], groupId: number) => {
    try {
      await Promise.all(paperIds.map(pid => invoke('add_paper_to_group', { paperId: pid, groupId })));

      showSnackbar(t('app.added_to_group') || "Added to group", 'success');
      // If we are currently viewing this group, refresh
      if (selectedGroup?.id === groupId) {
        handleSelectGroup(selectedGroup);
      }
    } catch (error) {
      console.error('Failed to add to group:', error);
      showSnackbar(t('app.error_adding_to_group') || "Failed to add to group", 'error');
    }
  };

  const handleRemoveFromGroup = async (paperIds: number[], groupId: number) => {
    try {
      await Promise.all(paperIds.map(pid => invoke('remove_paper_from_group', { paperId: pid, groupId })));

      showSnackbar(t('app.removed_from_group') || "Removed from group", 'success');
      // Refresh current view if it's the group
      if (selectedGroup?.id === groupId) {
        handleSelectGroup(selectedGroup);
      }
    } catch (error) {
      console.error('Failed to remove from group:', error);
      showSnackbar(t('app.error_removing_from_group') || "Failed to remove from group", 'error');
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

  // File Drop Handler
  const { isDragging, dragZone } = useFileDrop({
    onDrop: async (files, zone) => {
      // console.log("Dropped files:", files, "in zone:", zone);

      // Handle RIS files (Global or List Zone)
      const risFiles = files.filter(f => f.name.toLowerCase().endsWith('.ris'));
      if (risFiles.length > 0) {
        const confirmed = await dialog.confirm(
          t('app.import_ris_confirm', { count: risFiles.length }) || `Import ${risFiles.length} RIS file(s)? This will add them to 'Manual Import'.`,
          { title: t('app.import_ris_title') || "Import RIS Files" }
        );

        if (confirmed) {
          try {
            for (const file of risFiles) {
              // Currently web File API doesn't give full path in some contexts, but Tauri Drop usually works if we use specific plugins. 
              // However, default HTML5 drag and drop gives File object.
              // We need to read content.
              const text = await file.text();
              await invoke('import_ris', {
                risContent: text,
                groupId: selectedGroup?.id || null
              });
            }
            showSnackbar(t('app.import_success') || "Import successful", 'success');
            // Refresh manually if needed, but backend emits event
          } catch (e) {
            console.error("Import failed", e);
            showSnackbar("Import failed: " + e, 'error');
          }
        }
        return;
      }

      // Handle PDF files -> Add to AI Context if dropped on RightSidebar
      if (zone === 'ai-sidebar') {
        const contextFiles = files.filter(f => !f.name.toLowerCase().endsWith('.ris')); // All non-ris
        if (contextFiles.length > 0) {
          const confirmed = await dialog.confirm(
            t('app.add_context_confirm', { count: contextFiles.length }) || `Add ${contextFiles.length} file(s) as context for AI?`,
            { title: t('app.add_context_title') || "Add to AI Context" }
          );

          if (confirmed) {
            // We need to handle this. Since we can't easily upload files to context yet without reading them,
            // we might need to rely on what PendingContext expects.
            // Currently PendingContext expects text items or file paths?
            // If we use file.path (non-standard), it might work in Tauri.
            // Let's assume we can get path or we read text.
            // PendingContext item structure: { id, text, source, label }
            // For PDF, we can't read text easily here without backend.
            // Maybe just pass file names as placeholder or implement later?
            // "拖放到AI侧栏作为附件扔给AI当上下文" -> imply attachments.
            // But PendingContext is text-based.
            // Let's defer actual implementation or just show not implemented.
            showSnackbar("File context attachment is generic placeholder for now.", 'info');
          }
        }
      }
    }
  });

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
    <>
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
        <Sidebar
          batches={batches}
          groups={groups}
          onSelectBatch={handleSelectBatch}
          onSelectGroup={handleSelectGroup}
          selectedBatchId={selectedBatch?.id || null}
          selectedGroupId={selectedGroup?.id || null}
          onCreateGroup={handleCreateGroup}
          onRenameGroup={handleRenameGroup}
          onDeleteGroup={handleDeleteGroup}
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
                  groups={groups}
                  selectedGroupId={null}
                  onAddToGroup={handleAddToGroup}
                  onRemoveFromGroup={handleRemoveFromGroup}
                  readerActive={!!(activePdf && !pdfCollapsed)}
                  onContextSelect={setPendingContext}
                />
              ) : (
                <Box sx={{ p: 3, mt: 5, textAlign: 'center' }}>
                  <Typography variant="h6" color="textSecondary">
                    {t('app.no_papers') || "No papers in this batch"}
                  </Typography>
                </Box>
              )
            ) : selectedGroup ? (
              papers.length > 0 ? (
                <PaperList
                  papers={papers}
                  onUpdateMetadata={handleUpdateMetadata}
                  onTranslate={handleTranslate}
                  onReadPdf={handleReadPdf}
                  batch={null}
                  groups={groups}
                  selectedGroupId={selectedGroup.id}
                  onAddToGroup={handleAddToGroup}
                  onRemoveFromGroup={handleRemoveFromGroup}
                  readerActive={!!(activePdf && !pdfCollapsed)}
                />
              ) : (
                <Box sx={{ p: 3, mt: 5, textAlign: 'center' }}>
                  <Typography variant="h6" color="textSecondary">
                    {t('app.group_empty') || "This group is empty"}
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
                onAddContext={setPendingContext}
              />
            </Box>
          )}
        </Box>

        <RightSidebar
          hasCollapsedPdf={!!(activePaper && activePdf && pdfCollapsed)}
          onExpandReader={handleExpandReader}
          pendingContext={pendingContext}
          onContextHandled={() => setPendingContext(null)}
          data-drop-zone="ai-sidebar"
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

      {/* Drop Overlay */}
      {isDragging && (
        <Box sx={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          bgcolor: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none' // Let events pass through to target zones
        }}>
          <Box sx={{
            bgcolor: 'background.paper',
            p: 4,
            borderRadius: 2,
            boxShadow: 6,
            pointerEvents: 'auto'
          }}>
            <Typography variant="h5" color="primary">
              {dragZone === 'ai-sidebar' ? (t('app.drop_ai') || "Drop to AI Chat") : (t('app.drop_import') || "Drop to Import")}
            </Typography>
          </Box>
        </Box>
      )}
    </>
  );
}

export default App;
