import { useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useTranslation } from 'react-i18next';
import { useDialog } from '../context/DialogContext';

export default function Updater() {
    const { t } = useTranslation();
    const dialog = useDialog();

    useEffect(() => {
        const checkUpdate = async () => {
            try {
                const update = await check();
                if (update?.available) {
                    const confirmed = await dialog.confirm(
                        t('app.update_available_msg', { version: update.version }) ||
                        `A new version (${update.version}) is available. Do you want to download and install it now?`,
                        { title: t('app.update_available_title') || "Update Available" }
                    );

                    if (confirmed) {
                        await update.downloadAndInstall();
                        await relaunch();
                    }
                }
            } catch (error) {
                console.error("Update check failed:", error);
            }
        };

        // Check for updates on mount (app start)
        checkUpdate();
    }, [dialog, t]);

    return null; // This is a headless component
}
