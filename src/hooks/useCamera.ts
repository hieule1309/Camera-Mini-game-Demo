import { useState, useEffect, useRef, useCallback } from 'react';
import { CameraPermissionState } from '../types/game';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  permissionState: CameraPermissionState;
  facingMode: 'user' | 'environment';
  hasTorch: boolean;
  isTorchOn: boolean;
  errorMessage: string | null;
  toggleFacingMode: () => void;
  toggleTorch: () => Promise<void>;
  requestCamera: () => Promise<boolean>;
  stopCamera: () => void;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionState, setPermissionState] = useState<CameraPermissionState>('checking');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check initial permissions API if supported
  const checkPermissionStatus = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionState('unavailable');
      setErrorMessage(window.isSecureContext
        ? 'Trình duyệt hoặc thiết bị này không hỗ trợ truy cập camera (MediaDevices API).'
        : 'Camera chỉ hoạt động trên HTTPS hoặc localhost. Hãy mở ứng dụng bằng kết nối an toàn rồi thử lại.');
      return;
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        // Query camera permission
        const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (status.state === 'granted') {
          // Permission being granted does not mean a camera stream is active.
          // Keep the start-camera prompt visible until getUserMedia succeeds.
          setPermissionState('prompt');
        } else if (status.state === 'denied') {
          setPermissionState('denied');
          setErrorMessage('Quyền camera đã bị từ chối. Hãy mở Cài đặt trình duyệt để cho phép.');
        } else {
          setPermissionState('prompt');
        }

        status.onchange = () => {
          if (status.state === 'granted') setPermissionState('prompt');
          else if (status.state === 'denied') setPermissionState('denied');
          else setPermissionState('prompt');
        };
      } else {
        setPermissionState('prompt');
      }
    } catch {
      // Some mobile browsers don't allow querying camera permissions
      setPermissionState('prompt');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsTorchOn(false);
    setHasTorch(false);
  }, [stream]);

  const startCameraStream = useCallback(async (facing: 'user' | 'environment'): Promise<boolean> => {
    stopCamera();
    setErrorMessage(null);

    // Try ideal resolution with fallback
    const constraintsList: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: facing,
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let newStream: MediaStream | null = null;
    let lastErr: unknown = null;

    for (const constraints of constraintsList) {
      try {
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (newStream) break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!newStream) {
      const err = lastErr as DOMException | undefined;
      console.error('Camera access failed:', err);

      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setErrorMessage('Bạn đã chặn quyền truy cập Camera. Vui lòng cấp quyền trong Cài đặt trình duyệt để tiếp tục.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setPermissionState('unavailable');
        setErrorMessage('Không tìm thấy thiết bị Camera nào trên máy của bạn.');
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        setPermissionState('unavailable');
        setErrorMessage('Camera đang được sử dụng bởi ứng dụng khác.');
      } else {
        setPermissionState('unavailable');
        setErrorMessage(err?.message || 'Không thể khởi động camera.');
      }
      return false;
    }

    setStream(newStream);
    setPermissionState('granted');

    // Check torch capability
    const track = newStream.getVideoTracks()[0];
    if (track) {
      const capabilities = track.getCapabilities ? (track.getCapabilities() as { torch?: boolean }) : {};
      setHasTorch(Boolean(capabilities?.torch));
    }

    return true;
  }, [stopCamera]);

  const requestCamera = useCallback(async (): Promise<boolean> => {
    return startCameraStream(facingMode);
  }, [facingMode, startCameraStream]);

  const toggleFacingMode = useCallback(() => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    if (permissionState === 'granted') {
      startCameraStream(nextFacing);
    }
  }, [facingMode, permissionState, startCameraStream]);

  const toggleTorch = useCallback(async () => {
    if (!stream || !hasTorch) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !isTorchOn;
      await (track as MediaStreamTrack & { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  }, [stream, hasTorch, isTorchOn]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.playsInline = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch((err) => {
        console.warn('Video play error:', err);
      });
    }
  }, [stream]);

  useEffect(() => {
    checkPermissionStatus();
    return () => {
      stopCamera();
    };
  }, []);

  return {
    videoRef,
    stream,
    permissionState,
    facingMode,
    hasTorch,
    isTorchOn,
    errorMessage,
    toggleFacingMode,
    toggleTorch,
    requestCamera,
    stopCamera,
  };
}
