import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Upload, FileIcon, Loader2, Trash2, Search, ArrowUpDown, Share } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { cn } from "@/lib/utils";
import { FilePreview } from './FilePreview';
import { Checkbox } from "../ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ShareDialog } from './ShareDialog';

interface FileItem {
  id: number;
  filename: string;
  original_file_size: number;
  upload_timestamp: string;
  mime_type: string;
}

type SortField = 'filename' | 'upload_timestamp' | 'original_file_size';
type SortOrder = 'asc' | 'desc';

export function FileList() {
  const { toast } = useToast();
  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { token } = useAppSelector((state) => state.auth);
  const [fileToDelete, setFileToDelete] = React.useState<FileItem | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortField, setSortField] = React.useState<SortField>('upload_timestamp');
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('desc');
  const [isDragging, setIsDragging] = React.useState(false);
  const dropZoneRef = React.useRef<HTMLDivElement>(null);
  const [selectedFiles, setSelectedFiles] = React.useState<Set<number>>(new Set());
  const [fileToShare, setFileToShare] = React.useState<FileItem | null>(null);

  // Fetch user's files on component mount
  React.useEffect(() => {
    fetchFiles();
  }, []);

  React.useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
        setIsDragging(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        // For now, we'll just handle the first file
        const file = files[0];
        await handleFileUpload(file);
      }
    };

    const dropZone = dropZoneRef.current;
    if (dropZone) {
      dropZone.addEventListener('dragover', handleDragOver);
      dropZone.addEventListener('dragenter', handleDragEnter);
      dropZone.addEventListener('dragleave', handleDragLeave);
      dropZone.addEventListener('drop', handleDrop);

      return () => {
        dropZone.removeEventListener('dragover', handleDragOver);
        dropZone.removeEventListener('dragenter', handleDragEnter);
        dropZone.removeEventListener('dragleave', handleDragLeave);
        dropZone.removeEventListener('drop', handleDrop);
      };
    }
  }, []);

  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/files/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Log the response data for debugging
      console.log('Files response:', response.data);

      setFiles(response.data);
    } catch (error: any) {
      console.error('Fetch error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.detail || "Failed to fetch files.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: globalThis.File) => {
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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    try {
      // Log the input date string for debugging
      console.log('Input date string:', dateString);
      
      // Ensure we have a valid date string
      if (!dateString) {
        throw new Error('Date string is empty or undefined');
      }

      // Parse the date string and ensure UTC
      const date = new Date(dateString);
      
      // Validate the parsed date
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
      }
      
      // Format the date using Intl.DateTimeFormat with explicit UTC timezone
      const formattedDate = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      }).format(date);

      // Log the formatted date for debugging
      console.log('Parsed date:', date.toISOString());
      console.log('Formatted date:', formattedDate);
      
      return formattedDate;
    } catch (error) {
      // Log the full error details
      console.error('Date parsing error:', {
        error,
        dateString,
        type: typeof dateString,
        stack: error instanceof Error ? error.stack : undefined
      });
      return 'Date unavailable';
    }
  };

  const handleDeleteFile = async (file: FileItem) => {
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

  const sortFiles = (files: FileItem[]): FileItem[] => {
    return [...files].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'filename':
          comparison = a.filename.localeCompare(b.filename);
          break;
        case 'upload_timestamp':
          try {
            const dateA = new Date(a.upload_timestamp);
            const dateB = new Date(b.upload_timestamp);
            
            if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
              throw new Error('Invalid date format');
            }
            
            comparison = dateA.getTime() - dateB.getTime();
          } catch (error) {
            console.error('Date sorting error:', error);
            comparison = 0;
          }
          break;
        case 'original_file_size':
          comparison = a.original_file_size - b.original_file_size;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const filteredAndSortedFiles = React.useMemo(() => {
    const filtered = files.filter(file =>
      file.filename.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return sortFiles(filtered);
  }, [files, searchQuery, sortField, sortOrder]);

  const handleSelectFile = (fileId: number) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredAndSortedFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredAndSortedFiles.map(f => f.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedFiles).map(fileId =>
          api.delete(`/files/${fileId}/`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
        )
      );

      // Remove encryption keys for deleted files
      selectedFiles.forEach(fileId => removeKey(fileId));

      // Refresh the file list
      await fetchFiles();
      setSelectedFiles(new Set());

      toast({
        title: "Success",
        description: `${selectedFiles.size} files deleted successfully.`,
      });
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Failed to delete some files. Please try again.",
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
      <div
        ref={dropZoneRef}
        className={cn(
          "relative w-full transition-colors",
          isDragging && "bg-primary/5 border-primary",
          filteredAndSortedFiles.length === 0 ? "min-h-[200px]" : "min-h-0"
        )}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary rounded-lg z-50">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-primary" />
              <h3 className="mt-2 text-lg font-semibold">Drop your file here</h3>
              <p className="text-sm text-muted-foreground">File size up to 10MB</p>
            </div>
          </div>
        )}
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              {filteredAndSortedFiles.length > 0 && (
                <Checkbox
                  checked={selectedFiles.size === filteredAndSortedFiles.length}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all files"
                />
              )}
              <span className="text-xl sm:text-2xl">My Files</span>
              {selectedFiles.size > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedFiles.size} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedFiles.size > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      Bulk Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={handleBulkDelete}
                    >
                      Delete Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
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
            </div>
          </CardTitle>
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={`${sortField}-${sortOrder}`}
              onValueChange={(value) => {
                const [field, order] = value.split('-') as [SortField, SortOrder];
                setSortField(field);
                setSortOrder(order);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="filename-asc">Name (A-Z)</SelectItem>
                <SelectItem value="filename-desc">Name (Z-A)</SelectItem>
                <SelectItem value="upload_timestamp-desc">Newest First</SelectItem>
                <SelectItem value="upload_timestamp-asc">Oldest First</SelectItem>
                <SelectItem value="original_file_size-desc">Size (Largest)</SelectItem>
                <SelectItem value="original_file_size-asc">Size (Smallest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "transition-all duration-200",
            filteredAndSortedFiles.length === 0 ? "py-8" : "space-y-4"
          )}>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredAndSortedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-muted-foreground">No files found</p>
                {searchQuery && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Try adjusting your search query
                  </p>
                )}
              </div>
            ) : (
              filteredAndSortedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start space-x-4 min-w-0 flex-1">
                    <Checkbox
                      checked={selectedFiles.has(file.id)}
                      onCheckedChange={() => handleSelectFile(file.id)}
                      aria-label={`Select ${file.filename}`}
                      className="mt-1"
                    />
                    <div className="flex-shrink-0">
                      <FileIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="group relative">
                        <p className="font-medium truncate pr-4" title={file.filename}>
                          {file.filename}
                        </p>
                        <div className="absolute left-0 right-0 -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground z-10 bg-background/95 p-1 rounded">
                          {file.filename}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(file.original_file_size)} • {formatDate(file.upload_timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-12 sm:ml-0">
                    <FilePreview
                      fileId={file.id}
                      filename={file.filename}
                      mimeType={file.mime_type}
                    />
                    <FileDownload fileId={file.id} filename={file.filename} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFileToShare(file)}
                    >
                      <Share className="h-4 w-4" />
                    </Button>
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
              ))
            )}
          </div>
        </CardContent>
      </div>

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

      <ShareDialog
        fileId={fileToShare?.id || 0}
        fileName={fileToShare?.filename || ''}
        isOpen={!!fileToShare}
        onClose={() => setFileToShare(null)}
      />
    </Card>
  );
}