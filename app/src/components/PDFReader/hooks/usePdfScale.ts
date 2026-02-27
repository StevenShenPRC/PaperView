import { useState, useCallback, useMemo, useEffect } from 'react';

type ScaleMode = number | 'page-width' | 'page-height';

const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;
const ZOOM_STEP = 0.1;
const WHEEL_THRESHOLD = 5;

const clampScale = (val: number): number =>
    Math.min(Math.max(Math.round(val * 10) / 10, MIN_SCALE), MAX_SCALE);

export function usePdfScale({
    availableWidth,
    availableHeight,
    t
}: {
    availableWidth: number;
    availableHeight: number;
    t: any;
}) {
    const [scale, setScale] = useState<ScaleMode>('page-width');
    const [customScaleInput, setCustomScaleInput] = useState("Fit Width");
    const [isScaleInputFocused, setIsScaleInputFocused] = useState(false);

    const pageWidth = useMemo(() => {
        if (scale === 'page-width') return availableWidth;
        if (scale === 'page-height') return undefined;
        return availableWidth * scale;
    }, [scale, availableWidth]);

    const pageHeight = useMemo(() => {
        if (scale === 'page-height') return availableHeight;
        return undefined;
    }, [scale, availableHeight]);

    useEffect(() => {
        if (isScaleInputFocused) return;
        if (scale === 'page-width') setCustomScaleInput(t('app.fit_width') || 'Fit Width');
        else if (scale === 'page-height') setCustomScaleInput(t('app.fit_height') || 'Fit Height');
        else setCustomScaleInput(`${Math.round(scale * 100)}% `);
    }, [scale, t, isScaleInputFocused]);

    const getNumericScale = useCallback((): number => {
        return typeof scale === 'number' ? scale : 1.0;
    }, [scale]);

    const handleZoomIn = useCallback(() => {
        setScale(clampScale(getNumericScale() + ZOOM_STEP));
    }, [getNumericScale]);

    const handleZoomOut = useCallback(() => {
        setScale(clampScale(getNumericScale() - ZOOM_STEP));
    }, [getNumericScale]);

    const handleWheelZoom = useCallback((e: React.WheelEvent) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const delta = e.deltaY;
        if (Math.abs(delta) > WHEEL_THRESHOLD) {
            const direction = delta > 0 ? -ZOOM_STEP : ZOOM_STEP;
            const newVal = clampScale(getNumericScale() + direction);
            if (newVal !== getNumericScale()) setScale(newVal);
        }
    }, [getNumericScale]);

    const handleScaleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        setIsScaleInputFocused(true);
        e.target.select();
        setCustomScaleInput(typeof scale === 'string' ? "100" : `${Math.round(scale * 100)} `);
    }, [scale]);

    const handleScaleInputCommit = useCallback(() => {
        const val = parseFloat(customScaleInput.replace('%', ''));
        if (!isNaN(val)) {
            setScale(Math.max(10, Math.min(val, 500)) / 100);
        } else {
            if (scale === 'page-width') setCustomScaleInput(t('app.fit_width') || 'Fit Width');
            else if (scale === 'page-height') setCustomScaleInput(t('app.fit_height') || 'Fit Height');
            else setCustomScaleInput(`${Math.round(scale * 100)}% `);
        }
    }, [customScaleInput, scale, t]);

    const handleScaleInputBlur = useCallback(() => {
        setIsScaleInputFocused(false);
        handleScaleInputCommit();
    }, [handleScaleInputCommit]);

    const contentOverflows = pageWidth !== undefined && pageWidth > availableWidth;

    return {
        scale, setScale,
        customScaleInput, setCustomScaleInput,
        isScaleInputFocused,
        pageWidth, pageHeight, contentOverflows,
        handleZoomIn, handleZoomOut, handleWheelZoom,
        handleScaleInputFocus, handleScaleInputBlur, handleScaleInputCommit
    };
}
