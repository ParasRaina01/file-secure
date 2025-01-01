import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { Download, Loader2 } from 'lucide-react';
import api from '@/lib/axios';
import { hexToIV, getKey, decryptFile, downloadBlob } from '@/lib/crypto';
import { useAppSelector } from '@/store/hooks';

interface FileDownloadProps {
  fileId: number;
  filename: string;
}

interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
  message?: string;
}

export function FileDownload({ fileId, filename }: FileDownloadProps) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = React.useState(false);
  const { token } = useAppSelector((state) => state.auth);

  const handleDownload = async () => {
    setIsDownloading(true);

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

      // Create a blob and trigger download
      const blob = new Blob([decryptedData]);
      downloadBlob(blob, filename);

      toast({
        title: "Success",
        description: "File downloaded successfully.",
      });
    } catch (error) {
      console.error('Download error:', error);
      const apiError = error as ApiError;
      toast({
        variant: "destructive",
        title: "Download failed",
        description: apiError.message || apiError.response?.data?.detail || "Failed to download file. Please try again.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={isDownloading}
    >
      {isDownloading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Downloading...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          Download
        </>
      )}
    </Button>
  );
} 