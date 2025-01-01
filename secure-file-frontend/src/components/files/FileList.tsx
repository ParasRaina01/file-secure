import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Upload, FileIcon, Loader2, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import api from '@/lib/axios';
import { FileDownload } from './FileDownload';
import {
  generateEncryptionKey,
  generateIV,
  ivToHex,
  encryptFile,
  storeKey,
  removeKey,
  createEncryptedBlob
} from '@/lib/crypto';
import { useAppSelector } from '@/store/hooks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

interface File {
  id: number;
  filename: string;
  original_file_size: number;
  upload_timestamp: string;
  mime_type: string;
}

export function FileList() {
  const { toast } = useToast();
  const [files, setFiles] = React.useState<File[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { token } = useAppSelector((state) => state.auth);
  const [fileToDelete, setFileToDelete] = React.useState<File | null>(null);

  // Fetch user's files on component mount
  React.useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const response = await api.get('/files/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setFiles(response.data);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch files. Please try again.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Maximum file size is 10MB.",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Generate encryption key and IV
      const key = await generateEncryptionKey();
      const iv = generateIV();
      
      // Read and encrypt the file
      const fileData = await file.arrayBuffer();
      const encryptedData = await encryptFile(fileData, key, iv);

      // Create form data with encrypted file
      const formData = new FormData();
      formData.append('file', createEncryptedBlob(encryptedData, file.name), file.name);
      formData.append('filename', file.name);
      formData.append('encryption_iv', ivToHex(iv));
      formData.append('original_file_size', file.size.toString());
      formData.append('mime_type', file.type || 'application/octet-stream');

      // Upload the encrypted file
      const response = await api.post('/files/upload/', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      // Store the encryption key for later use
      const fileId = response.data.file.id;
      await storeKey(fileId, key);

      // Refresh the file list
      await fetchFiles();

      toast({
        title: "Success",
        description: "File uploaded successfully.",
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.response?.data?.error || error.response?.data?.detail || "Failed to upload file. Please try again.",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const handleDeleteFile = async (file: File) => {
    try {
      await api.delete(`/files/${file.id}/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Remove the file's encryption key from local storage
      removeKey(file.id);

      // Refresh the file list
      await fetchFiles();

      toast({
        title: "Success",
        description: "File deleted successfully.",
      });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.response?.data?.error || error.response?.data?.detail || "Failed to delete file. Please try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <span className="text-xl sm:text-2xl">My Files</span>
          <div className="w-full sm:w-auto">
            <Input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={isUploading}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full sm:w-auto"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadProgress}%
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </>
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No files uploaded yet
          </div>
        ) : (
          <div className="space-y-4">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border gap-4"
              >
                <div className="flex items-start sm:items-center space-x-4 min-w-0">
                  <FileIcon className="h-8 w-8 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{file.filename}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.original_file_size)} • {formatDate(file.upload_timestamp)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <FileDownload fileId={file.id} filename={file.filename} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFileToDelete(file)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!fileToDelete} onOpenChange={() => setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fileToDelete?.filename}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (fileToDelete) {
                  handleDeleteFile(fileToDelete);
                  setFileToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}