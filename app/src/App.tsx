import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Box, CircularProgress, Typography, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import ChatIcon from '@mui/icons-material/Chat';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import SettingsDialog from './components/SettingsDialog';
import PaperList from './components/PaperList';
import PDFReader from './components/PDFReader';
import { PendingContext } from './types';
import { useTranslation } from 'react-i18next';

import { useDialog } from './context/DialogContext';
import { useFileDrop } from './hooks/useFileDrop';
import { useAppTheme } from './context/ThemeContext';

import { useAppNotifications } from './hooks/useAppNotifications';
import { useAppData } from './hooks/useAppData';
import { usePaperActions } from './hooks/usePaperActions';
import { useAppLayout } from './hooks/useAppLayout';

function App() {
  const { t } = useTranslation();
  const dialog = useDialog();
  const { mode, setMode } = useAppTheme();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingContext, setPendingContext] = useState<PendingContext | null>(null);

  // Global Context Menu State
  const [globalMenuPos, setGlobalMenuPos] = useState<{ top: number, left: number } | null>(null);
  const [globalSelectedText, setGlobalSelectedText] = useState('');

  // Handle global context menu (right click)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Don't override if clicking on something that already has a context menu (like paper list items)
      // A simple heuristic: if a selection exists and we're not in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 0) {
        // Prevent default only if we are actually going to show our menu
        // and let specific components stopPropagation if they want to handle it themselves
        setGlobalSelectedText(text);
        setGlobalMenuPos({ top: e.clientY, left: e.clientX });
        e.preventDefault();
      } else {
        setGlobalMenuPos(null);
      }
    };

    const handleClick = () => {
      setGlobalMenuPos(null);
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', handleClick);
    };
  }, []);

  const handleGlobalContextAction = (mode: 'new' | 'append') => {
    if (globalSelectedText) {
      setPendingContext({
        items: [{
          id: Date.now().toString(),
          text: globalSelectedText,
          source: t('app.global_selection') || 'Global Selection',
          label: t('app.selected_text') || 'Selected Text'
        }],
        mode
      });
    }
    setGlobalMenuPos(null);
  };

  const {
    snackbarOpen, snackbarMessage, snackbarSeverity, handleCloseSnackbar, showSnackbar,
    rateLimitOpen, setRateLimitOpen, rateLimitMessage, showRateLimitError
  } = useAppNotifications();

  const {
    batches, selectedBatch, handleSelectBatch,
    groups, selectedGroup, handleSelectGroup, loadGroups,
    papers, setPapers, loading
  } = useAppData();

  const {
    handleCreateGroup, handleRenameGroup, handleDeleteGroup,
    handleUpdateMetadata, handleTranslate, handleBatchTranslate,
    handleAddToGroup, handleRemoveFromGroup
  } = usePaperActions({
    dialog, t, showSnackbar, showRateLimitError, setPapers, loadGroups, selectedGroup, handleSelectGroup
  });

  const {
    sidebarCollapsed, setSidebarCollapsed,
    activePaper, activePdf, setActivePdf,
    pdfCollapsed,
    readerWidth, isResizing,
    handleReadPdf, handleCollapseReader, handleExpandReader, handleMouseDown
  } = useAppLayout();

  const { isDragging, dragZone } = useFileDrop({
    onDrop: async (files, zone) => {
      const risFiles = files.filter(f => f.name.toLowerCase().endsWith('.ris'));
      if (risFiles.length > 0) {
        const confirmed = await dialog.confirm(
          t('app.import_ris_confirm', { count: risFiles.length }) || `Import ${risFiles.length} RIS file(s)? This will add them to 'Manual Import'.`,
          { title: t('app.import_ris_title') || "Import RIS Files" }
        );

        if (confirmed) {
          try {
            for (const file of risFiles) {
              const text = await file.text();
              await invoke('import_ris', {
                risContent: text,
                groupId: selectedGroup?.id || null
              });
            }
            showSnackbar(t('app.import_success') || "Import successful", 'success');
          } catch (e) {
            console.error("Import failed", e);
            showSnackbar("Import failed: " + e, 'error');
          }
        }
        return;
      }

      if (zone === 'ai-sidebar') {
        const contextFiles = files.filter(f => !f.name.toLowerCase().endsWith('.ris'));
        if (contextFiles.length > 0) {
          const confirmed = await dialog.confirm(
            t('app.add_context_confirm', { count: contextFiles.length }) || `Add ${contextFiles.length} file(s) as context for AI?`,
            { title: t('app.add_context_title') || "Add to AI Context" }
          );

          if (confirmed) {
            showSnackbar("File context attachment is generic placeholder for now.", 'info');
          }
        }
      }
    }
  });

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
              setSidebarCollapsed(!sidebarCollapsed);
            }
          }}
        />

        <Box component="main" sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
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
                  onBatchTranslate={handleBatchTranslate}
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
                  onBatchTranslate={handleBatchTranslate}
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
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle color="error">
          {t('app.warning') || "Warning"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary', fontWeight: 'bold' }}>
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

      {isDragging && (
        <Box sx={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          bgcolor: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
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

      {/* Global Context Menu */}
      <Menu
        open={globalMenuPos !== null}
        onClose={() => setGlobalMenuPos(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          globalMenuPos !== null
            ? { top: globalMenuPos.top, left: globalMenuPos.left }
            : undefined
        }
        sx={{ zIndex: 9999 }}
      >
        <MenuItem onClick={() => handleGlobalContextAction('new')}>
          <ListItemIcon><ChatIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('app.chat_new_context') || "New Chat with Context"}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleGlobalContextAction('append')}>
          <ListItemIcon><PlaylistAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('app.chat_append_context') || "Append to Chat"}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

export default App;
