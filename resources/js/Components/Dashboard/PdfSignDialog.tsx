import DocumentViewer from '@/Components/Pdf/DocumentViewer';
import { Button } from '@/Components/ui/Button';
import { usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export function PdfSignDialog({
    open,
    file,
    savedSignature,
    signerName,
    onClose,
    onSigned,
}: {
    open: boolean;
    file: File | null;
    savedSignature: string | null;
    signerName: string;
    onClose: () => void;
    onSigned: (signedFile: File) => void;
}) {
    const { auth } = usePage<PageProps>().props;
    const [error, setError] = useState<string | null>(null);

    const fileUrl = useMemo(() => (file && open ? URL.createObjectURL(file) : null), [file, open]);

    useEffect(() => {
        return () => {
            if (fileUrl) {
                URL.revokeObjectURL(fileUrl);
            }
        };
    }, [fileUrl]);

    if (!open || !file || !fileUrl) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950/50 backdrop-blur-[1px]">
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">Place your signature · {file.name}</p>
                    <p className="truncate text-xs text-slate-500">
                        {savedSignature
                            ? 'Click Sign, then place your assigned signature on the page.'
                            : 'An administrator must assign your signature before you can sign.'}
                    </p>
                </div>
                <Button type="button" variant="secondary" icon={X} onClick={onClose}>
                    Cancel
                </Button>
            </div>
            {error && <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">{error}</p>}
            <div className="min-h-0 flex-1 bg-slate-100">
                <DocumentViewer
                    fileUrl={fileUrl}
                    annotations={[]}
                    signatures={[]}
                    currentUserId={auth.user.id}
                    signerName={signerName}
                    savedSignature={savedSignature}
                    canAnnotate={false}
                    canModerate={false}
                    canSign={!!savedSignature}
                    allowCreateSignature={false}
                    onAddAnnotation={async () => undefined}
                    onToggleResolve={() => undefined}
                    onDeleteAnnotation={() => undefined}
                    onSign={async ({ pdf }) => {
                        try {
                            setError(null);
                            onSigned(new File([pdf], file.name, { type: 'application/pdf', lastModified: Date.now() }));
                        } catch (err) {
                            setError(err instanceof Error ? err.message : 'Could not apply the signature.');
                        }
                    }}
                />
            </div>
        </div>
    );
}
