import { invoke } from '@tauri-apps/api/core';
import { Paper, Group } from '../types';
import store from '../store';

interface PaperActionsOptions {
    dialog?: any; t: any; showSnackbar: any; showRateLimitError?: any;
    setPapers?: any; loadGroups?: any; selectedGroup?: any; handleSelectGroup?: any;
}

export function usePaperActions({
    dialog, t, showSnackbar, showRateLimitError, setPapers, loadGroups, selectedGroup, handleSelectGroup
}: PaperActionsOptions) {
    const handleCreateGroup = async (name: string) => { await invoke('create_group', { name }); if (loadGroups) await loadGroups(); };
    const handleRenameGroup = async (group: Group, name: string) => { await invoke('rename_group', { id: group.id, newName: name }); if (loadGroups) await loadGroups(); };
    const handleDeleteGroup = async (group: Group) => { await invoke('delete_group', { id: group.id }); if (loadGroups) await loadGroups(); if (selectedGroup?.id === group.id && handleSelectGroup) handleSelectGroup(null); };

    const handleUpdateMetadata = async (paper: Paper) => {
        try {
            const updated = await invoke<Paper>('update_metadata_command', { id: paper.id });
            if (setPapers) {
                setPapers((prev: Paper[]) => prev.map(p => p.id === updated.id ? updated : p));
            }
            showSnackbar(t('app.update_success') || 'Metadata updated successfully', 'success');
        } catch (error: any) {
            console.error('Failed to update metadata:', error);
            if (showRateLimitError && error.includes('429')) {
                showRateLimitError(error);
            } else {
                showSnackbar(t('app.update_failed') || 'Failed to update metadata: ' + error, 'error');
            }
        }
    };

    const handleTranslate = async (paper: Paper) => {
        try {
            const updated = await invoke<Paper>('translate_paper', { id: paper.id });
            if (setPapers) {
                setPapers((prev: Paper[]) => prev.map(p => p.id === updated.id ? updated : p));
            }
            showSnackbar(t('app.translate_success') || 'Translated successfully', 'success');
        } catch (error) {
            console.error('Failed to translate:', error);
            showSnackbar(t('app.translate_failed') || 'Translation failed: ' + error, 'error');
        }
    };

    const handleBatchTranslate = async (selectedPapers: Paper[]) => {
        if (selectedPapers.length === 0) return;

        let batchSize = await store.get<number>('batch_translate_size') || 5;
        if (batchSize < 1) batchSize = 1;

        let pendingIds = selectedPapers.map(p => p.id);
        const totalCount = pendingIds.length;
        let successCount = 0;

        while (pendingIds.length > 0) {
            const currentBatchIds = pendingIds.slice(0, batchSize);
            showSnackbar(t('app.batch_translate_progress', { current: successCount, total: totalCount }) || `Translating ${successCount}/${totalCount}...`, 'info');

            try {
                const updatedPapers = await invoke<Paper[]>('translate_batch', { ids: currentBatchIds });

                if (setPapers) {
                    setPapers((prev: Paper[]) => {
                        const map = new Map(updatedPapers.map(p => [p.id, p]));
                        return prev.map(p => map.has(p.id) ? map.get(p.id)! : p);
                    });
                }

                successCount += currentBatchIds.length;
                pendingIds = pendingIds.slice(batchSize);
            } catch (error: any) {
                console.error('Batch translation failed for chunk:', error);
                if (dialog && dialog.confirm) {
                    const retry = await dialog.confirm(t('app.batch_translate_failed_retry', { error }) || `Batch translation failed: ${error}. Retry?`);
                    if (!retry) {
                        break;
                    }
                } else {
                    showSnackbar(t('app.batch_translate_failed') || 'Batch translation failed: ' + error, 'error');
                    break;
                }
            }
        }

        if (successCount === totalCount && totalCount > 0) {
            showSnackbar(t('app.batch_translate_success', { count: totalCount }) || `Successfully translated all ${totalCount} papers.`, 'success');
        } else if (successCount > 0) {
            showSnackbar(t('app.batch_translate_partial_success', { count: successCount, total: totalCount }) || `Translated ${successCount}/${totalCount} papers.`, 'warning');
        }
    };
    const handleAddToGroup = async (paperIds: number[], groupId: number) => {
        for (const id of paperIds) await invoke('update_paper', { id, updates: { group_id: groupId } });
        showSnackbar(t('app.add_success') || 'Added successfully', 'success');
    };
    const handleRemoveFromGroup = async (paperIds: number[]) => {
        for (const id of paperIds) await invoke('update_paper', { id, updates: { group_id: null } });
        showSnackbar(t('app.remove_success') || 'Removed successfully', 'success');
    };

    return { handleCreateGroup, handleRenameGroup, handleDeleteGroup, handleUpdateMetadata, handleTranslate, handleBatchTranslate, handleAddToGroup, handleRemoveFromGroup };
}
