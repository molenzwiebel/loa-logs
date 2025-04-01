import { PUBLIC_LOA_LOGS_MODE } from "$env/static/public";

export const isApplication = PUBLIC_LOA_LOGS_MODE === "meter";
export const isRemoteViewer = PUBLIC_LOA_LOGS_MODE === "live-viewer";
