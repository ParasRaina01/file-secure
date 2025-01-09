import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/axios";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Loader2, Share, Calendar, Link as LinkIcon, FileText as FileIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface ShareDialogProps {
  fileId: number;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ShareLinkResponse {
  id: number;
  url: string;
  expires_at: string;
  allow_download: boolean;
}

export function ShareDialog({ fileId, fileName, isOpen, onClose }: ShareDialogProps) {
  const { toast } = useToast();
  const { token } = useAppSelector((state) => state.auth);
  const [isLoading, setIsLoading] = React.useState(false);
  const [shareLink, setShareLink] = React.useState<string | null>(null);
  const [allowDownload, setAllowDownload] = React.useState(false);
  const [expiryDays, setExpiryDays] = React.useState<string>("7");

  const handleGenerateLink = async () => {
    setIsLoading(true);
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
      const utcExpiryDate = new Date(expiryDate.toISOString());

      console.log('Sending expiry date:', utcExpiryDate.toISOString());

      const response = await api.post<ShareLinkResponse>(
        `/shares/files/${fileId}/create-link/`,
        {
          allow_download: allowDownload,
          expires_at: utcExpiryDate.toISOString(),
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const baseUrl = window.location.origin;
      const shareableUrl = `${baseUrl}${response.data.url}`;
      setShareLink(shareableUrl);

      toast({
        title: "Share link generated",
        description: "The link has been created successfully.",
      });
    } catch (error: any) {
      console.error("Share link generation error:", error);
      toast({
        variant: "destructive",
        title: "Failed to generate share link",
        description: error.response?.data?.detail || "An error occurred while generating the share link.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (shareLink) {
      try {
        await navigator.clipboard.writeText(shareLink);
        toast({
          title: "Link copied",
          description: "Share link copied to clipboard.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Failed to copy",
          description: "Please copy the link manually.",
        });
      }
    }
  };

  const handleClose = () => {
    setShareLink(null);
    setAllowDownload(false);
    setExpiryDays("7");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Share className="h-5 w-5" />
            Share File
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-6">
          {/* File Info Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">FILE NAME</Label>
            <div className="group relative bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-md">
                  <FileIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate" title={fileName}>
                    {fileName}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Link Settings Section */}
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">LINK SETTINGS</Label>
              <div className="rounded-lg border bg-card">
                <div className="p-4 space-y-4">
                  {/* Expiry Selection */}
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-md">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <Select value={expiryDays} onValueChange={setExpiryDays}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Expires in 1 day</SelectItem>
                        <SelectItem value="7">Expires in 7 days</SelectItem>
                        <SelectItem value="30">Expires in 30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Download Permission */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer">Allow download</Label>
                      <p className="text-sm text-muted-foreground">Recipients can download the file</p>
                    </div>
                    <Switch
                      checked={allowDownload}
                      onCheckedChange={setAllowDownload}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Generate Link Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerateLink}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <LinkIcon className="mr-2 h-5 w-5" />
                  Generate Link
                </>
              )}
            </Button>
          </div>

          {/* Generated Link Section */}
          {shareLink && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">SHARE LINK</Label>
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono truncate" title={shareLink}>
                        {shareLink}
                      </code>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCopyLink}
                        className="shrink-0 h-8"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShareLink(null)}
                  className="w-full"
                >
                  Generate New Link
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 