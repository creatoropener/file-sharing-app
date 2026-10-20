// app/upload/[id]/page.tsx
import { DownloadView } from '@/components/download-view';

export default async function DownloadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4 py-16">
      <DownloadView manifestId={id} />
    </main>
  );
}
