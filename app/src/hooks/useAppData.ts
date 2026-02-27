import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Batch, Group, Paper } from '../types';

export function useAppData() {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
    const [papers, setPapers] = useState<Paper[]>([]);
    const [loading, setLoading] = useState(true);



    const fetchBatches = useCallback(async () => {
        try {
            const data = await invoke<Batch[]>('get_batches');
            setBatches(data || []);
            if (data && data.length > 0 && selectedBatchId === null && selectedGroupId === null) {
                const manualBatches = data.filter(b => b.issueVolume === "PaperView_Manually_Imported");
                if (manualBatches.length > 0) {
                    setSelectedBatchId(-1);
                } else {
                    setSelectedBatchId(data[0].id);
                }
            } else if (data && data.length === 0 && selectedGroupId === null) {
                setSelectedBatchId(null);
            }
        } catch (error) { console.error('Failed to fetch batches:', error); }
    }, [selectedBatchId, selectedGroupId]);

    const fetchGroups = useCallback(async () => {
        try {
            const data = await invoke<Group[]>('get_groups');
            setGroups(data || []);
        } catch (error) { console.error('Failed to fetch groups:', error); }
    }, []);



    const fetchPapers = useCallback(async () => {
        if (selectedBatchId === null && selectedGroupId === null) {
            setPapers([]);
            return;
        }

        setLoading(true);
        try {
            let data: Paper[] = [];
            if (selectedGroupId !== null && selectedGroupId > 0) {
                data = await invoke<Paper[]>('get_papers_by_group', { groupId: selectedGroupId });
            } else if (selectedBatchId === -1) {
                data = await invoke<Paper[]>('get_papers', {
                    journal: '手动导入',
                    volume: 'PaperView_Manually_Imported',
                    date: 'PaperView_Manually_Imported'
                });
            } else if (selectedBatchId !== null) {
                const batch = batches.find(b => b.id === selectedBatchId);
                if (batch) {
                    data = await invoke<Paper[]>('get_papers', {
                        journal: batch.journalName,
                        volume: batch.issueVolume,
                        date: batch.issueDate
                    });
                }
            }

            const sortedData = [...(data || [])].sort((a, b) => {
                const tagA = (a.tags || []).includes('starred') ? 1 : 0;
                const tagB = (b.tags || []).includes('starred') ? 1 : 0;
                if (tagA !== tagB) return tagB - tagA;

                const pA = a.id || 0;
                const pB = b.id || 0;
                return pB - pA;
            });
            setPapers(sortedData);
        } catch (error) {
            console.error('Failed to fetch papers:', error);
            setPapers([]);
        } finally {
            setLoading(false);
        }
    }, [selectedBatchId, selectedGroupId, batches]);

    const refreshAll = useCallback(() => {
        fetchBatches();
        fetchGroups();
        fetchPapers();
    }, [fetchBatches, fetchGroups, fetchPapers]);

    useEffect(() => {
        refreshAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchPapers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBatchId, selectedGroupId]);

    useEffect(() => {
        const unlistenIssue = listen('issue-crawled', () => { refreshAll(); });
        const unlistenDoi = listen('doi-crawled', () => { refreshAll(); });
        const unlistenPdf = listen('pdf-downloaded', () => { refreshAll(); });
        const unlistenPaperUpdate = listen('paper-updated', () => {
            // For paper updates, a full refresh is safest to ensure sorting/filtering are applied, 
            // but if we only want to update one item we could optimize. For now, fetchPapers is fine.
            fetchPapers();
        });
        const unlistenDataUpdate = listen('data-updated', () => { refreshAll(); });

        return () => {
            unlistenIssue.then(f => f());
            unlistenDoi.then(f => f());
            unlistenPdf.then(f => f());
            unlistenPaperUpdate.then(f => f());
            unlistenDataUpdate.then(f => f());
        };
    }, [refreshAll, fetchPapers]);

    const handleSelectBatch = useCallback((batch: Batch) => {
        setSelectedBatchId(batch.id);
        setSelectedGroupId(null);
    }, []);

    const handleSelectGroup = useCallback((group: Group) => {
        setSelectedGroupId(group.id);
        setSelectedBatchId(null);
    }, []);

    const selectedBatch = selectedBatchId === -1 ? {
        id: -1,
        website: 'Local',
        journalName: '手动导入',
        issueVolume: 'PaperView_Manually_Imported',
        issueDate: 'PaperView_Manually_Imported',
        latest_time: ''
    } : batches.find(b => b.id === selectedBatchId) || null;
    const selectedGroup = groups.find(g => g.id === selectedGroupId) || null;

    return {
        batches,
        selectedBatch,
        handleSelectBatch,
        groups,
        selectedGroup,
        handleSelectGroup,
        loadGroups: fetchGroups,
        papers,
        setPapers,
        loading,
        selectedBatchId,
        selectedGroupId,
        refreshAll
    };
}
