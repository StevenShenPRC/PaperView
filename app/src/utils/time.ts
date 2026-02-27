export const formatLocalTime = (dateStr: string | null | undefined) => {
    if (!dateStr || dateStr === "Unknown Date") return dateStr;
    if (dateStr.includes("T") && dateStr.includes("Z")) {
        try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                return d.toLocaleString();
            }
        } catch { }
    }
    return dateStr;
};
