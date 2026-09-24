import { Injectable } from '@angular/core';

type CaptureSurfaceType = 'display' | 'browser';

type CapturePermissionCapable = {
  setDisplayMediaCapturePermission?: (type: CaptureSurfaceType) => Promise<void> | undefined;
};

@Injectable({ providedIn: 'root' })
export class CaptureGuardService {
  enable(): void {
    try {
      if (typeof window === 'undefined' || !window.isSecureContext) {
        return;
      }

      const mediaDevices = navigator.mediaDevices as
        | (MediaDevices & CapturePermissionCapable)
        | undefined;

      if (typeof mediaDevices?.setDisplayMediaCapturePermission === 'function') {
        mediaDevices.setDisplayMediaCapturePermission('display')?.catch?.(() => undefined);
        return;
      }

      const nav = navigator as Navigator & CapturePermissionCapable;

      if (typeof nav.setDisplayMediaCapturePermission === 'function') {
        nav.setDisplayMediaCapturePermission('display')?.catch?.(() => undefined);
      }
    } catch {
      /* unsupported browser - blur protection unavailable, silently skip */
    }
  }
}
