import * as React from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Clock, AlertCircle, Eye, Loader2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SharedLayout } from "@/components/layout/SharedLayout";
import { hexToIV, decryptFile } from '@/lib/crypto';
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ShareResponse {
  status: string;
  message: string;
  data: {
    file_id: number;
    filename: string;
    download_url: string;
    preview_url: string;
    allow_download: boolean;
    expiry: string | null;
    downloads_remaining: number;
    mime_type: string;
    encryption_iv: string;
    encryption_key: string;
  };
}

export function PublicShareView() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [shareData, setShareData] = React.useState<ShareResponse["data"] | null>(null);
  const [fetchAttempted, setFetchAttempted] = React.useState(false);
  const [decodedToken, setDecodedToken] = React.useState<string | null>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [previewContent, setPreviewContent] = React.useState<{ url: string; type: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);

  // Cleanup preview URL when component unmounts or dialog closes
  React.useEffect(() => {
    return () => {
      if (previewContent?.url) {
        URL.revokeObjectURL(previewContent.url);
        setPreviewContent(null);
      }
    };
  }, []);

  const loadPreview = React.useCallback(async () => {
    if (!shareData || !showPreview) return;
    if (previewContent) return; // Don't reload if we already have content

    setIsLoadingPreview(true);
    try {
      // Download the encrypted file
      const response = await api.get(shareData.preview_url, {
        responseType: 'arraybuffer',
      });

      // Convert IV from hex string to Uint8Array
      const iv = hexToIV(shareData.encryption_iv);

      // Import the encryption key
      const keyBytes = new Uint8Array(shareData.encryption_key.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
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
      if (shareData.mime_type.startsWith('text/') || shareData.mime_type === 'application/json') {
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
        const blob = new Blob([decryptedData], { type: shareData.mime_type });
        setPreviewContent({ 
          url: URL.createObjectURL(blob), 
          type: shareData.mime_type.startsWith('image/') ? 'image' : 'pdf' 
        });
      }
    } catch (error: any) {
      console.error('Preview error:', error);
      toast({
        variant: "destructive",
        title: "Preview failed",
        description: error.message || "Failed to load preview. Please try again.",
      });
      setShowPreview(false);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [shareData, showPreview, previewContent, toast]);

  // Load preview when dialog is opened
  React.useEffect(() => {
    if (showPreview) {
      loadPreview();
    }
  }, [showPreview, loadPreview]);

  const handleClosePreview = React.useCallback(() => {
    setShowPreview(false);
    if (previewContent?.url) {
      URL.revokeObjectURL(previewContent.url);
      setPreviewContent(null);
    }
  }, [previewContent]);

  const fetchShareData = React.useCallback(async (cleanToken: string) => {
    try {
      console.log("Fetching share data for token:", cleanToken);
      
      const response = await api.get<ShareResponse>(`/shares/share/${cleanToken}/`);
      console.log("Share data response:", response.data);
      
      if (response.data?.data) {
        setShareData(response.data.data);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error: any) {
      console.error("Error fetching share data:", error);
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || "Failed to load shared file";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setFetchAttempted(true);
    }
  }, [toast]);

  React.useEffect(() => {
    if (!token || fetchAttempted) return;
    
    // Just decode the token, no need to clean it as it's a UUID
    const decodedToken = decodeURIComponent(token);
    setDecodedToken(decodedToken);
    fetchShareData(decodedToken);
  }, [token, fetchAttempted, fetchShareData]);

  const handleDownload = async () => {
    if (!shareData || !decodedToken) return;
    
    setIsDownloading(true);
    try {
      console.log("Starting download for file:", shareData.filename);
      const response = await api.get(shareData.download_url, {
        responseType: 'arraybuffer'
      });
      
      // Convert IV from hex string to Uint8Array
      const iv = hexToIV(shareData.encryption_iv);

      // Import the encryption key
      const keyBytes = new Uint8Array(shareData.encryption_key.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
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
      
      // Create blob and trigger download
      const blob = new Blob([decryptedData], { type: shareData.mime_type });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', shareData.filename);
      
      // Append to html link element page
      document.body.appendChild(link);
      
      // Start download
      link.click();
      
      // Clean up and remove the link
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "File download started",
      });

      // Refresh share data to get updated download count
      await fetchShareData(decodedToken);
    } catch (error: any) {
      console.error("Download error:", error);
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || "Failed to download file";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const LoadingView = () => (
    <SharedLayout>
      <div className="flex items-center justify-center">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    </SharedLayout>
  );

  const ErrorView = () => (
    <SharedLayout>
      <div className="flex items-center justify-center">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error Loading Share
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </SharedLayout>
  );

  if (loading) return <LoadingView />;
  if (error) return <ErrorView />;
  if (!shareData || !decodedToken) return null;

  const isDownloadDisabled = !shareData.allow_download || shareData.downloads_remaining === 0 || isDownloading;
  const downloadButtonText = isDownloading 
    ? "Downloading..." 
    : shareData.downloads_remaining === 0 
      ? "No downloads remaining" 
      : "Download File";

  return (
    <SharedLayout>
      <div className="flex flex-col gap-6">
        {/* File Info Card */}
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Shared File</CardTitle>
            <CardDescription>
              This file has been shared with you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-primary/10 rounded-md">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate" title={shareData.filename}>
                    {shareData.filename}
                  </h3>
                  {shareData.downloads_remaining > -1 && (
                    <p className="text-sm text-muted-foreground">
                      Downloads remaining: {shareData.downloads_remaining}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Expiry Info */}
            {shareData.expiry && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Expires at: {new Date(shareData.expiry).toLocaleString()}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setShowPreview(true)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview File
              </Button>

              {shareData.allow_download && (
                <Button
                  className={cn(
                    "flex-1",
                    isDownloadDisabled && "cursor-not-allowed opacity-50"
                  )}
                  disabled={isDownloadDisabled}
                  onClick={handleDownload}
                >
                  {isDownloading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {downloadButtonText}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={handleClosePreview}>
          <DialogContent className="max-w-screen-xl w-[95vw] h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0">
            <div className="flex-1 min-h-0 w-full overflow-hidden bg-white dark:bg-gray-950">
              {isLoadingPreview ? (
                <div className="h-full w-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : previewContent ? (
                <div className="h-full w-full">
                  {previewContent.type === 'image' ? (
                    <div className="h-full w-full flex items-center justify-center bg-black/5">
                      <img
                        src={previewContent.url}
                        alt={shareData.filename}
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
                      title={shareData.filename}
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
                      title={shareData.filename}
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
      </div>
    </SharedLayout>
  );
} 