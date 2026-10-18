import { getCurrentWebview } from "@tauri-apps/api/webview";

export interface ZoomClient {
  /** Scales the whole webview: every text, the terminals included (SRS-FR-068). */
  setZoom(scale: number): Promise<void>;
}

export const tauriZoomClient: ZoomClient = {
  setZoom: (scale) => getCurrentWebview().setZoom(scale),
};
