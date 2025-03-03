import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Loader2, X } from 'lucide-react';
import api from '@/lib/axios';
import { hexToIV, decryptFile } from '@/lib/crypto';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SecureFilePreviewProps {
  fileId: number;
  filename: string;
  mimeType: string;
  previewUrl: string;
  encryptionIv: string;
  encryptionKey: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SecureFilePreview({
  fileId,
  filename,
  mimeType,
  previewUrl,
  encryptionIv,
  encryptionKey,
  isOpen,
  onClose,
}: SecureFilePreviewProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [previewContent, setPreviewContent] = React.useState<{ url: string; type: string } | null>(null);

  const loadPreview = React.useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    try {
      // Download the encrypted file
      const response = await api.get(previewUrl, {
        responseType: 'arraybuffer',
      });

      // Convert IV from hex string to Uint8Array
      const iv = hexToIV(encryptionIv);

      // Import the encryption key
      const keyBytes = new Uint8Array(encryptionKey.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
      const key = await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        {
          name: "AES-GCM",
          length: 256,
        },
        true,
        ["encrypt", "decrypt"]
      );

      // Decrypt the file
      const decryptedData = await decryptFile(response.data, key, iv);

      // Handle different file types
      if (mimeType.startsWith('text/') || mimeType === 'application/json') {
        // For text files, create a text decoder
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(decryptedData);
        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'">
              <style>
                body {
                  margin: 0;
                  padding: 20px;
                  font-family: monospace;
                  white-space: pre-wrap;
                  word-wrap: break-word;
                  background: white;
                  color: black;
                }
              </style>
            </head>
            <body>${text}</body>
          </html>
        `;
        const blob = new Blob([htmlContent], { type: 'text/html' });
        setPreviewContent({ url: URL.createObjectURL(blob), type: 'text' });
      } else {
        // For other files (images, PDFs)
        const blob = new Blob([decryptedData], { type: mimeType });
        setPreviewContent({ url: URL.createObjectURL(blob), type: mimeType.startsWith('image/') ? 'image' : 'pdf' });
      }
    } catch (error: any) {
      console.error('Preview error:', error);
      toast({
        variant: "destructive",
        title: "Preview failed",
        description: error.message || "Failed to load preview. Please try again.",
      });
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, previewUrl, encryptionIv, encryptionKey, mimeType, toast, onClose]);

  // Load preview when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      loadPreview();
    }
  }, [isOpen, loadPreview]);

  // Cleanup preview URL when dialog closes
  React.useEffect(() => {
    if (!isOpen && previewContent) {
      URL.revokeObjectURL(previewContent.url);
      setPreviewContent(null);
    }
  }, [isOpen, previewContent]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-screen-xl w-[95vw] h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-3 border-b">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <span className="truncate">{filename}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 w-full overflow-hidden bg-white dark:bg-gray-950">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : previewContent ? (
            <div className="h-full w-full">
              {previewContent.type === 'image' ? (
                <div className="h-full w-full flex items-center justify-center bg-black/5">
                  <img
                    src={previewContent.url}
                    alt={filename}
                    className="max-h-[85vh] max-w-full object-contain"
                    style={{ 
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      msUserSelect: 'none',
                      pointerEvents: 'none'
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                </div>
              ) : previewContent.type === 'pdf' ? (
                <iframe
                  src={`${previewContent.url}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0&download=0`}
                  className="w-full h-full border-0"
                  title={filename}
                  sandbox="allow-same-origin"
                  style={{ 
                    pointerEvents: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    msUserSelect: 'none'
                  }}
                />
              ) : (
                <iframe
                  src={previewContent.url}
                  className="w-full h-full border-0"
                  title={filename}
                  sandbox="allow-same-origin allow-scripts"
                  style={{ 
                    pointerEvents: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    msUserSelect: 'none'
                  }}
                />
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
} 