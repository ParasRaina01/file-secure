import * as React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FileList } from '@/components/files/FileList';

export function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Manage and share your files securely.
          </p>
        </div>
        <FileList />
      </div>
    </DashboardLayout>
  );
} 