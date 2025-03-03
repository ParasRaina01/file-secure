import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/axios";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Loader2, Share2, Calendar, Link as LinkIcon, FileText as FileIcon, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

interface ShareDialogProps {
  fileId: number;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ShareLinkResponse {
  id: string;
  share_url: string;
  expires_at: string;
  is_download_enabled: boolean;
  message: string;
  status: 'success' | 'error';
  detail?: string | Record<string, string>;
  expiry_display?: string;
  share_link_token?: string;
}

interface ErrorResponse {
  status: 'error';
  message: string;
  detail?: string | Record<string, string>;
}

export function ShareDialog({ fileId, fileName, isOpen, onClose }: ShareDialogProps) {
  const { toast } = useToast();
  const { token } = useAppSelector((state) => state.auth);
  const [isLoading, setIsLoading] = React.useState(false);
  const [shareLink, setShareLink] = React.useState<string | null>(null);
  const [allowDownload, setAllowDownload] = React.useState(false);
  const [expiryMinutes, setExpiryMinutes] = React.useState<string>("10080"); // Default to 7 days

  const showToast = (response: ShareLinkResponse | ErrorResponse) => {
    if (response.status === 'success') {
      toast({
        title: "Success",
        description: response.message || "Share link created successfully",
        variant: "default",
      });
    } else {
      let errorMessage = response.message || "Failed to create share link";
      if (response.detail) {
        if (typeof response.detail === 'string') {
          errorMessage += `: ${response.detail}`;
        } else {
          errorMessage += `: ${Object.values(response.detail).join(', ')}`;
        }
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleGenerateLink = async () => {
    setIsLoading(true);
    try {
      console.log("Generating link with params:", { allowDownload, expiryMinutes });
      
      const response = await api.post<ShareLinkResponse>(
        `/shares/files/${fileId}/create-link/`,
        {
          is_download_enabled: allowDownload,
          expiry_minutes: parseInt(expiryMinutes),
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log("Share link response:", response.data);

      if (response.data.share_link_token) {
        // Just encode the token, no need to clean it as it's a UUID
        const frontendUrl = new URL(`/share/${encodeURIComponent(response.data.share_link_token)}`, window.location.origin).toString();
        console.log("Generated frontend URL:", frontendUrl);
        setShareLink(frontendUrl);
        showToast(response.data);
      } else {
        throw new Error("Share token not found in response");
      }
    } catch (error: any) {
      console.error("Share link generation error:", error);
      const errorResponse: ErrorResponse = {
        status: 'error',
        message: "Failed to create share link",
        detail: error.response?.data?.detail || error.message
      };
      showToast(errorResponse);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (shareLink) {
      try {
        await navigator.clipboard.writeText(shareLink);
        toast({
          title: "Success",
          description: "Share link copied to clipboard",
          variant: "default",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to copy link. Please copy manually.",
          variant: "destructive",
        });
      }
    }
  };

  const handleClose = () => {
    setShareLink(null);
    setAllowDownload(false);
    setExpiryMinutes("10080");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1 px-6 pt-6">
          <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
            <Share2 className="h-6 w-6" />
            Share File
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6 space-y-8">
          {/* File Info Card */}
          <Card className="p-4 bg-muted/50 border-2">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-lg shrink-0">
                <FileIcon className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 
                  className="font-medium text-base break-words" 
                  style={{ 
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    hyphens: 'auto',
                    maxWidth: '100%'
                  }}
                >
                  {fileName}
                </h3>
              </div>
            </div>
          </Card>

          {/* Link Settings */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-base shrink-0">Link Settings</h4>
              <Separator className="flex-1" />
            </div>
            
            <div className="space-y-6">
              {/* Expiry Setting */}
              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Expires in
                </Label>
                <Select value={expiryMinutes} onValueChange={setExpiryMinutes}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 minute (testing)</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="1440">1 day</SelectItem>
                    <SelectItem value="10080">7 days</SelectItem>
                    <SelectItem value="43200">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Download Permission */}
              <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-sm flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Allow download
                  </Label>
                  <p className="text-[13px] text-muted-foreground">
                    Recipients can download the file
                  </p>
                </div>
                <Switch
                  checked={allowDownload}
                  onCheckedChange={setAllowDownload}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Share Link Section */}
          {shareLink ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-base flex items-center gap-2 shrink-0">
                  <LinkIcon className="h-4 w-4" />
                  Share Link
                </h4>
                <Separator className="flex-1" />
              </div>
              <div className="flex gap-2">
                <code className="flex-1 p-3 bg-muted rounded-lg text-sm font-mono break-all border">
                  {shareLink}
                </code>
                <Button 
                  variant="secondary" 
                  size="icon" 
                  onClick={handleCopyLink}
                  className="h-[42px] w-[42px] shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShareLink(null)}
              >
                Generate New Link
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerateLink}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Link...
                </>
              ) : (
                <>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Generate Link
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 