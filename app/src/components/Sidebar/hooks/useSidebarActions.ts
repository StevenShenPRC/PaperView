import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { Group } from '../../../types';

export function useSidebarActions({
    onCreateGroup,
    onRenameGroup,
    onDeleteGroup,
    selectedGroupId,
    dialog,
    t
}: {
    onCreateGroup: (name: string) => void;
    onRenameGroup: (group: Group, name: string) => void;
    onDeleteGroup: (group: Group) => void;
    selectedGroupId: number | null;
    dialog: any;
    t: any;
}) {
    // Group UI State
    const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");

    // Context Menu State
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [activeGroup, setActiveGroup] = useState<Group | null>(null);

    // Rename Dialog State
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [renameName, setRenameName] = useState("");

    // Import State
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importDois, setImportDois] = useState("");
    const [importing, setImporting] = useState(false);

    const handleCreateGroup = () => {
        if (newGroupName.trim()) {
            onCreateGroup(newGroupName.trim());
            setNewGroupName("");
            setNewGroupDialogOpen(false);
        }
    };

    const handleGroupMenuOpen = (event: React.MouseEvent<HTMLElement>, group: Group) => {
        event.stopPropagation();
        setMenuAnchor(event.currentTarget);
        setActiveGroup(group);
    };

    const handleGroupMenuClose = () => {
        setMenuAnchor(null);
        setActiveGroup(null);
    };

    const handleRenameClick = () => {
        if (activeGroup) {
            setRenameName(activeGroup.name);
            setRenameDialogOpen(true);
            setMenuAnchor(null);
        }
    };

    const handleRenameConfirm = () => {
        if (activeGroup && renameName.trim()) {
            onRenameGroup(activeGroup, renameName.trim());
            setRenameDialogOpen(false);
            setActiveGroup(null);
        }
    };

    const handleDeleteClick = async () => {
        if (activeGroup) {
            const confirmed = await dialog.confirm(t('app.confirm_delete_group') || "Delete this group?", {
                title: t('app.delete_group') || "Delete Group"
            });
            if (confirmed) {
                onDeleteGroup(activeGroup);
            }
            setMenuAnchor(null);
            setActiveGroup(null);
        }
    };

    const handleImportDois = async () => {
        if (!importDois.trim()) return;
        setImporting(true);
        try {
            const dois = importDois.split('\n').map(d => d.trim()).filter(d => d);
            await invoke('import_from_doi', {
                dois: dois,
                groupId: selectedGroupId
            });
            setImportDois("");
            setImportDialogOpen(false);
            dialog.alert(t('app.import_success') || "Import successful");
        } catch (e) {
            console.error("Import failed:", e);
            dialog.alert("Import failed: " + e);
        } finally {
            setImporting(false);
        }
    };

    const handleSelectRisFile = async () => {
        try {
            const selected = await openFileDialog({
                multiple: false,
                filters: [{ name: 'RIS File', extensions: ['ris'] }]
            });

            if (selected) {
                setImporting(true);
                const content = await readTextFile(selected as string);
                await invoke('import_ris', {
                    risContent: content,
                    groupId: selectedGroupId
                });
                setImportDialogOpen(false);
                dialog.alert(t('app.import_success') || "Import successful");
                setImporting(false);
            }
        } catch (e) {
            console.error("File selection failed", e);
            setImporting(false);
        }
    };

    return {
        newGroupDialogOpen, setNewGroupDialogOpen, newGroupName, setNewGroupName,
        menuAnchor, activeGroup,
        renameDialogOpen, setRenameDialogOpen, renameName, setRenameName,
        importDialogOpen, setImportDialogOpen, importDois, setImportDois, importing,
        handleCreateGroup, handleGroupMenuOpen, handleGroupMenuClose,
        handleRenameClick, handleRenameConfirm, handleDeleteClick,
        handleImportDois, handleSelectRisFile
    };
}
