import { Button } from '@/Components/ui/Button';
import { Dialog } from '@/Components/ui/Dialog';
import { Checkbox, Input } from '@/Components/ui/Form';
import { Alert, SegmentedControl } from '@/Components/ui/misc';
import { cn } from '@/lib/cn';
import { normalizeSignature, removeBackground, trimCanvas } from '@/lib/image';
import { Bookmark, ImageUp, PenLine, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SignaturePad, SignaturePadHandle } from './SignaturePad';

type Mode = 'saved' | 'draw' | 'type' | 'upload';

const FONTS = [
    { family: 'Dancing Script', weight: 600 },
    { family: 'Great Vibes', weight: 400 },
    { family: 'Caveat', weight: 600 },
];

export interface SignatureResult {
    image: string;
    save: boolean;
}

async function renderTyped(text: string, font: (typeof FONTS)[number]): Promise<string | null> {
    const spec = `${font.weight} 96px "${font.family}"`;
    try {
        await document.fonts.load(spec, text);
    } catch {
        /* fall back to whatever is available */
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = spec;
    const width = Math.ceil(ctx.measureText(text).width) + 60;
    canvas.width = Math.max(200, width);
    canvas.height = 180;
    ctx.font = spec;
    ctx.fillStyle = '#0f172a';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 30, 95);
    return trimCanvas(canvas, 6)?.toDataURL('image/png') ?? null;
}

export function SignatureModal({
    open,
    onClose,
    onConfirm,
    savedSignature,
    defaultName,
    title = 'Add your signature',
    confirmLabel = 'Use this signature',
    allowSave = true,
    allowCreate = false,
    defaultSave,
    /** Stamps keep original colors; signatures remove light backgrounds. */
    preserveColors = false,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: (result: SignatureResult) => void;
    savedSignature?: string | null;
    defaultName: string;
    title?: string;
    confirmLabel?: string;
    allowSave?: boolean;
    /** When false, only an admin-assigned saved signature can be used. */
    allowCreate?: boolean;
    defaultSave?: boolean;
    preserveColors?: boolean;
}) {
    const [mode, setMode] = useState<Mode>(savedSignature ? 'saved' : allowCreate ? 'draw' : 'saved');
    const [typed, setTyped] = useState(defaultName);
    const [font, setFont] = useState(0);
    const [upload, setUpload] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [drawEmpty, setDrawEmpty] = useState(true);
    const [save, setSave] = useState(defaultSave ?? !savedSignature);
    const [busy, setBusy] = useState(false);
    const padRef = useRef<SignaturePadHandle>(null);

    useEffect(() => {
        if (open) {
            setMode(savedSignature ? 'saved' : allowCreate ? 'draw' : 'saved');
            setSave(defaultSave ?? !savedSignature);
            setUpload(null);
            setUploadError(null);
            setTyped(defaultName);
        }
    }, [open, savedSignature, defaultName, defaultSave, allowCreate]);

    const canConfirm =
        (mode === 'saved' && !!savedSignature) ||
        (allowCreate && mode === 'draw' && !drawEmpty) ||
        (allowCreate && mode === 'type' && typed.trim().length > 0) ||
        (allowCreate && mode === 'upload' && !!upload);

    const confirm = async () => {
        setBusy(true);
        try {
            let image: string | null = null;
            if (mode === 'saved') image = savedSignature ?? null;
            if (mode === 'draw') image = padRef.current?.toDataUrl() ?? null;
            if (mode === 'type') image = await renderTyped(typed.trim(), FONTS[font]);
            if (mode === 'upload') image = upload;
            if (!image) return;
            if (mode !== 'saved') {
                image = await normalizeSignature(image);
            }
            onConfirm({ image, save: allowSave && mode !== 'saved' && save });
        } finally {
            setBusy(false);
        }
    };

    const options: { value: Mode; label: string; icon: JSX.Element }[] = [
        ...(savedSignature ? [{ value: 'saved' as Mode, label: 'Saved', icon: <Bookmark className="h-4 w-4" /> }] : []),
        ...(allowCreate
            ? [
                  { value: 'draw' as Mode, label: 'Draw', icon: <PenLine className="h-4 w-4" /> },
                  { value: 'type' as Mode, label: 'Type', icon: <Type className="h-4 w-4" /> },
                  { value: 'upload' as Mode, label: 'Upload', icon: <ImageUp className="h-4 w-4" /> },
              ]
            : []),
    ];

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title}
            description={
                allowCreate
                    ? preserveColors
                        ? 'Upload a stamp image. Colors are kept as-is.'
                        : 'Your signature will be applied wherever you place it.'
                    : 'Only an administrator-assigned signature can be used.'
            }
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={confirm} disabled={!canConfirm} loading={busy}>
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            {options.length > 1 && <SegmentedControl options={options} value={mode} onChange={setMode} className="mb-4" />}

            {mode === 'saved' && savedSignature && (
                <div className="flex h-44 items-center justify-center rounded-lg border border-slate-200 bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_10px,#fff_10px,#fff_20px)] p-4">
                    <img src={savedSignature} alt="Saved signature" className="max-h-full max-w-full object-contain" />
                </div>
            )}

            {mode === 'saved' && !savedSignature && (
                <Alert tone="warning">
                    No signature has been assigned to this account. Ask an administrator to add one under Users.
                </Alert>
            )}

            {allowCreate && mode === 'draw' && <SignaturePad ref={padRef} onChange={setDrawEmpty} />}

            {allowCreate && mode === 'type' && (
                <div className="space-y-3">
                    <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your full name" maxLength={60} autoFocus />
                    <div className="grid gap-2 sm:grid-cols-3">
                        {FONTS.map((f, i) => (
                            <button
                                key={f.family}
                                type="button"
                                onClick={() => setFont(i)}
                                className={cn(
                                    'flex h-20 items-center justify-center overflow-hidden rounded-lg border bg-white px-3 text-slate-900 transition',
                                    font === i ? 'border-brand-600 ring-2 ring-brand-600/20' : 'border-slate-200 hover:border-slate-300',
                                )}
                                style={{ fontFamily: `"${f.family}", cursive`, fontWeight: f.weight, fontSize: 30 }}
                            >
                                <span className="truncate">{typed || 'Your name'}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {allowCreate && mode === 'upload' && (
                <div className="space-y-3">
                    <label className="flex h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center hover:bg-slate-100">
                        {upload ? (
                            <img src={upload} alt={preserveColors ? 'Uploaded stamp' : 'Uploaded signature'} className="max-h-36 max-w-[90%] object-contain" />
                        ) : (
                            <>
                                <ImageUp className="h-6 w-6 text-slate-400" />
                                <span className="mt-2 text-sm font-medium text-slate-700">
                                    {preserveColors ? 'Choose a stamp image' : 'Choose an image of your signature'}
                                </span>
                                <span className="text-xs text-slate-500">
                                    {preserveColors
                                        ? 'PNG or JPG · original colors are preserved'
                                        : 'PNG or JPG · white background is removed automatically'}
                                </span>
                            </>
                        )}
                        <input
                            type="file"
                            accept="image/png,image/jpeg"
                            className="sr-only"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadError(null);
                                if (file.size > 5 * 1024 * 1024) {
                                    setUploadError('Image must be smaller than 5 MB.');
                                    return;
                                }
                                const reader = new FileReader();
                                reader.onload = async () => {
                                    try {
                                        const raw = String(reader.result);
                                        setUpload(preserveColors ? raw : await removeBackground(raw));
                                    } catch {
                                        setUploadError('That image could not be processed.');
                                    }
                                };
                                reader.readAsDataURL(file);
                            }}
                        />
                    </label>
                    {uploadError && <Alert tone="error">{uploadError}</Alert>}
                </div>
            )}

            {allowCreate && allowSave && mode !== 'saved' && (
                <Checkbox
                    className="mt-4"
                    label="Save as my signature"
                    description="Reuse it next time without drawing again."
                    checked={save}
                    onChange={(e) => setSave(e.target.checked)}
                />
            )}
        </Dialog>
    );
}
