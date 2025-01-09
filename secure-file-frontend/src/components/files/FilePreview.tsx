import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Loader2, X, Eye } from 'lucide-react';
import api from '@/lib/axios';
import { hexToIV, getKey, decryptFile } from '@/lib/crypto';
import { useAppSelector } from '@/store/hooks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FilePreviewProps {
  fileId: number;
  filename: string;
  mimeType: string;
}

export function FilePreview({ fileId, filename, mimeType }: FilePreviewProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [previewContent, setPreviewContent] = React.useState<{ url: string; type: string } | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const { token } = useAppSelector((state) => state.auth);

  const isSupportedPreviewType = React.useMemo(() => {
    return (
      mimeType.startsWith('image/') ||
      mimeType === 'application/pdf' ||
      mimeType.startsWith('text/') ||
      mimeType === 'application/json'
    );
  }, [mimeType]);

  const handlePreview = async () => {
    if (!isSupportedPreviewType) return;

    setIsLoading(true);
    setIsOpen(true);

    try {
      // First, get the file metadata which includes the IV
      const metadataResponse = await api.get(`/files/${fileId}/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const { encryption_iv } = metadataResponse.data;

      // Get the stored encryption key
      const key = await getKey(fileId);
      if (!key) {
        throw new Error('Encryption key not found. The file may have been uploaded in a different session.');
      }

      // Download the encrypted file
      const response = await api.get(`/files/${fileId}/content/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'arraybuffer',
      });

      // Convert IV from hex string to Uint8Array
      const iv = hexToIV(encryption_iv);

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
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup preview URL when dialog closes
  React.useEffect(() => {
    if (!isOpen && previewContent) {
      URL.revokeObjectURL(previewContent.url);
      setPreviewContent(null);
    }
  }, [isOpen, previewContent]);

  if (!isSupportedPreviewType) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handlePreview}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
                  onClick={() => setIsOpen(false)}
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
                    />
                  </div>
                ) : previewContent.type === 'pdf' ? (
                  <object
                    data={previewContent.url}
                    type="application/pdf"
                    className="w-full h-full"
                  >
                    <p>Unable to display PDF. <a href={previewContent.url} download={filename}>Download</a> instead.</p>
                  </object>
                ) : (
                  <iframe
                    src={previewContent.url}
                    className="w-full h-full border-0"
                    title={filename}
                    sandbox="allow-same-origin allow-scripts"
                  />
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 