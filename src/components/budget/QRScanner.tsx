import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface QRScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (result: string) => void;
  title?: string;
  description?: string;
}

export function QRScanner({
  open,
  onOpenChange,
  onScan,
  title = 'Scan QR Code',
  description = 'Point your camera at a QR code',
}: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.error('Error stopping scanner:', e);
      }
    }
    setIsScanning(false);
  };

  const startScanner = async (cameraId?: string) => {
    if (!containerRef.current) return;

    setError(null);

    try {
      // Get available cameras
      const devices = await Html5Qrcode.getCameras();
      if (devices.length === 0) {
        setError('No cameras found on this device');
        return;
      }

      setCameras(devices);

      // Create scanner instance
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader');
      }

      const selectedCameraId = cameraId || devices[currentCameraIndex]?.id || devices[0].id;

      await scannerRef.current.start(
        selectedCameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          // Success callback
          onScan(decodedText);
          stopScanner();
          onOpenChange(false);
        },
        () => {
          // Error callback - ignore scan errors (no QR found)
        }
      );

      setIsScanning(true);
    } catch (e) {
      console.error('Error starting scanner:', e);
      if (e instanceof Error) {
        if (e.message.includes('Permission')) {
          setError('Camera permission denied. Please allow camera access.');
        } else {
          setError('Failed to start camera. Please try again.');
        }
      }
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;

    await stopScanner();
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await startScanner(cameras[nextIndex].id);
  };

  // Start scanner when dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        stopScanner();
      }
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scanner container */}
          <div
            ref={containerRef}
            className="relative w-full aspect-square bg-black rounded-lg overflow-hidden"
          >
            <div id="qr-reader" className="w-full h-full" />

            {/* Overlay when not scanning */}
            {!isScanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center text-white">
                  <Camera className="h-12 w-12 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm">Starting camera...</p>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
                <div className="text-center text-white">
                  <X className="h-12 w-12 mx-auto mb-2 text-destructive" />
                  <p className="text-sm">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startScanner()}
                    className="mt-4"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Camera switch button */}
          {cameras.length > 1 && isScanning && (
            <Button
              variant="outline"
              onClick={switchCamera}
              className="w-full"
            >
              <SwitchCamera className="h-4 w-4 mr-2" />
              Switch Camera
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Position the QR code within the frame to scan
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
