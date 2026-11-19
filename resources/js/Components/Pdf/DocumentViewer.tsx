import { SignatureModal, SignatureResult } from '@/Components/Signature/SignatureModal';
import { Badge } from '@/Components/ui/Badge';
import { Button } from '@/Components/ui/Button';
import { Dialog } from '@/Components/ui/Dialog';
import { Textarea } from '@/Components/ui/Form';
import { Menu } from '@/Components/ui/Menu';
import { EmptyState } from '@/Components/ui/EmptyState';
import { Alert, Avatar, SegmentedControl } from '@/Components/ui/misc';
import { notify } from '@/Components/ui/Toaster';
import { cn } from '@/lib/cn';
import { formatDateTime, formatRelative } from '@/lib/format';
import { composeSignatureStamp, composeTextStamp, loadImage } from '@/lib/image';
import { deletePages as deletePdfPages, duplicatePage, mergePdf, rebuildPages } from '@/lib/pdfPages';
import { fetchPdf, PdfSigningError, signPdf, stampPdf } from '@/lib/pdfSigning';
import { Annotation, DocumentSignatureRecord, fullName, Placement } from '@/types/models';
import {
    BadgeCheck,
    Bold,
    CalendarDays,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Copy,
    Download,
    FilePlus2,
    FileWarning,
    Highlighter,
    Italic,
    LucideIcon,
    Maximize,
    MessageSquare,
    MessageSquarePlus,
    Minimize,
    MousePointer2,
    PanelLeft,
    PanelRight,
    PenLine,
    RotateCcw,
    Save,
    Stamp,
    Trash2,
    Type,
    UserRound,
    X,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs, Thumbnail } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const PDF_OPTIONS = {
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
};

const ZOOM_LEVELS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const GAP = 16;
const PAD = 24;

const HIGHLIGHT_COLORS = ['#FDE047', '#86EFAC', '#93C5FD', '#F9A8D4'];
const NOTE_COLORS = ['#0F172A', '#1D4ED8', '#B91C1C', '#047857', '#C2410C', '#7C3AED'];

type Tool = 'select' | 'comment' | 'highlight' | 'text' | 'name' | 'date' | 'sign' | 'stamp';
type MarkKind = 'sign' | 'stamp';
type ZoomMode = 'width' | 'page' | 'custom';
type Dim = { w: number; h: number };
type PlacedSignature = Placement & { id: string };
type StampPreview = { dataUrl: string; aspect: number };

type NoteCoords = {
    x: number;
    y: number;
    w?: number;
    h?: number;
    size?: number;
    bold?: boolean;
    italic?: boolean;
};

type Draft =
    | { type: 'COMMENT'; page: number; x: number; y: number }
    | { type: 'TEXT'; page: number; x: number; y: number }
    | { type: 'HIGHLIGHT'; page: number; x: number; y: number; w: number; h: number };

export interface NewAnnotation {
    annotation_type: 'COMMENT' | 'HIGHLIGHT' | 'NOTE';
    page_number: number;
    coordinates: NoteCoords | null;
    content: string;
    color?: string;
}

export interface AnnotationUpdate {
    content?: string;
    color?: string;
    coordinates?: NoteCoords | null;
}

const NOTE_SIZE_DEFAULT = 0.12;
const NOTE_SIZE_MIN_H = 0.016;
const NOTE_SIZE_MAX_H = 0.065;

function sizeToLineH(size: number) {
    return NOTE_SIZE_MIN_H + clamp(size, 0, 1) * (NOTE_SIZE_MAX_H - NOTE_SIZE_MIN_H);
}

function heightToSize(h: number) {
    return clamp((h - NOTE_SIZE_MIN_H) / (NOTE_SIZE_MAX_H - NOTE_SIZE_MIN_H), 0, 1);
}

function noteBox(
    text: string,
    x: number,
    y: number,
    style: { size?: number; bold?: boolean; italic?: boolean } = {},
): NoteCoords {
    const size = style.size ?? NOTE_SIZE_DEFAULT;
    const lines = text.split('\n');
    const maxLen = Math.max(...lines.map((line) => line.length), 4);
    const lineH = sizeToLineH(size);
    const charW = 0.007 + size * 0.01;
    const w = clamp(0.08 + maxLen * charW, 0.1, 0.7);
    const h = clamp(lineH * Math.max(lines.length, 1) * 1.25, lineH, 0.3);

    return {
        x: clamp(x, 0, 1 - w),
        y: clamp(y, 0, 1 - h),
        w,
        h,
        size,
        bold: !!style.bold,
        italic: !!style.italic,
    };
}

function todayLabel() {
    return new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export interface SignPayload {
    pdf: Blob;
    image: string;
    placements: Placement[];
    save: boolean;
}

export interface StampPayload {
    pdf: Blob;
    image: string;
    placements: Placement[];
}

export interface ViewerPanel {
    id: string;
    label: string;
    icon: LucideIcon;
    content: ReactNode;
}

interface Props {
    fileUrl: string;
    downloadUrl?: string;
    annotations: Annotation[];
    signatures: DocumentSignatureRecord[];
    currentUserId: number;
    signerName: string;
    savedSignature?: string | null;
    savedStamp?: string | null;
    canAnnotate: boolean;
    canModerate: boolean;
    canSign: boolean;
    alreadySigned?: boolean;
    /** When false, only an admin-assigned saved signature can be used. */
    allowCreateSignature?: boolean;
    canEditPages?: boolean;
    extraPanels?: ViewerPanel[];
    onAddAnnotation: (annotation: NewAnnotation) => Promise<void>;
    onUpdateAnnotation?: (id: number, patch: AnnotationUpdate) => Promise<void>;
    onSaveMarks?: (pdf: Blob) => Promise<void>;
    onToggleResolve: (id: number) => void;
    onDeleteAnnotation: (id: number) => void;
    onSign: (payload: SignPayload) => Promise<void>;
    onStamp?: (payload: StampPayload) => Promise<void>;
    onRemoveSignature?: (id: number) => void;
    onUpdatePages?: (pdf: Blob) => Promise<void>;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const uid = () => Math.random().toString(36).slice(2, 10);

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
    useEffect(() => {
        const mql = window.matchMedia(query);
        const handler = () => setMatches(mql.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [query]);
    return matches;
}

export default function DocumentViewer(props: Props) {
    const {
        fileUrl,
        downloadUrl,
        annotations,
        signatures,
        currentUserId,
        signerName,
        savedSignature,
        savedStamp,
        canAnnotate,
        canModerate,
        canSign,
        alreadySigned,
        allowCreateSignature = false,
        canEditPages = false,
        extraPanels = [],
    } = props;

    const isLarge = useMediaQuery('(min-width: 1024px)');
    const rootRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const [numPages, setNumPages] = useState(0);
    const [dims, setDims] = useState<Dim[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadProgress, setLoadProgress] = useState(0);
    const [docReady, setDocReady] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [zoomMode, setZoomMode] = useState<ZoomMode>('width');
    const [viewport, setViewport] = useState({ top: 0, height: 800, width: 800 });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageInput, setPageInput] = useState('1');
    const [tool, setTool] = useState<Tool>('select');
    const [showThumbs, setShowThumbs] = useState(isLarge);
    const [showPanel, setShowPanel] = useState(isLarge);
    const [panelTab, setPanelTab] = useState<string>('comments');
    const [commentFilter, setCommentFilter] = useState<'open' | 'all'>('open');
    const [activeId, setActiveId] = useState<number | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [dragRect, setDragRect] = useState<{ page: number; x0: number; y0: number; x1: number; y1: number } | null>(null);
    const [fullscreen, setFullscreen] = useState(false);

    const [signature, setSignature] = useState<SignatureResult | null>(null);
    const [stamp, setStamp] = useState<StampPreview | null>(null);
    const [rubberStamp, setRubberStamp] = useState<StampPreview | null>(null);
    const [markKind, setMarkKind] = useState<MarkKind | null>(null);
    const [includeCaption, setIncludeCaption] = useState(true);
    const [placements, setPlacements] = useState<PlacedSignature[]>([]);
    const [signModalOpen, setSignModalOpen] = useState(false);
    const [pendingPlace, setPendingPlace] = useState<{ page: number; x: number; y: number } | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [stampConfirmOpen, setStampConfirmOpen] = useState(false);
    const [signing, setSigning] = useState(false);
    const [stamping, setStamping] = useState(false);
    const [signError, setSignError] = useState<string | null>(null);
    const [stampError, setStampError] = useState<string | null>(null);
    const [savingMarks, setSavingMarks] = useState(false);
    const [savingPages, setSavingPages] = useState(false);
    const [editPages, setEditPages] = useState(false);
    const [workingUrl, setWorkingUrl] = useState(fileUrl);
    const [pagesDirty, setPagesDirty] = useState(false);
    const [pageOrder, setPageOrder] = useState<number[]>([]);
    const [pagesError, setPagesError] = useState<string | null>(null);
    const mergeInputRef = useRef<HTMLInputElement>(null);
    const workingUrlRef = useRef(workingUrl);
    workingUrlRef.current = workingUrl;

    const zoomAnchor = useRef<{ page: number; offset: number } | null>(null);

    // Reset when a new file version is loaded.
    useEffect(() => {
        setNumPages(0);
        setDims([]);
        setLoadError(null);
        setLoadProgress(0);
        setDocReady(false);
        setPlacements([]);
        setDraft(null);
        setTool('select');
        setMarkKind(null);
        setRubberStamp(null);
        setStampError(null);
        setEditPages(false);
        setPagesDirty(false);
        setPagesError(null);
        setPageOrder([]);
        setWorkingUrl((prev) => {
            if (prev.startsWith('blob:') && prev !== fileUrl) {
                URL.revokeObjectURL(prev);
            }
            return fileUrl;
        });
    }, [fileUrl]);

    useEffect(() => {
        return () => {
            const url = workingUrlRef.current;
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        };
    }, []);

    useEffect(() => {
        if (numPages > 0 && pageOrder.length === 0) {
            setPageOrder(Array.from({ length: numPages }, (_, i) => i + 1));
        }
    }, [numPages, pageOrder.length]);

    const activeStampPreview = markKind === 'stamp' ? rubberStamp : stamp;

    const replaceWorkingPdf = useCallback((bytes: Uint8Array) => {
        const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setWorkingUrl((prev) => {
            if (prev.startsWith('blob:')) {
                URL.revokeObjectURL(prev);
            }
            return url;
        });
        setPagesDirty(true);
        setPageOrder([]);
        setNumPages(0);
        setDims([]);
        setLoadProgress(0);
        setDocReady(false);
        setPlacements([]);
        setDraft(null);
    }, []);

    const applyPageMutation = useCallback(
        async (mutate: (source: ArrayBuffer) => Promise<Uint8Array>) => {
            setPagesError(null);
            try {
                const source = await fetchPdf(workingUrl);
                const bytes = await mutate(source);
                replaceWorkingPdf(bytes);
            } catch (error) {
                const message =
                    error instanceof PdfSigningError || (error instanceof Error && error.message)
                        ? (error as Error).message
                        : 'Could not update pages.';
                setPagesError(message);
                notify(message, 'error');
            }
        },
        [replaceWorkingPdf, workingUrl],
    );

    const savePageChanges = async () => {
        if (!props.onUpdatePages || !pagesDirty) {
            return;
        }
        setSavingPages(true);
        setPagesError(null);
        try {
            const source = await fetchPdf(workingUrl);
            await props.onUpdatePages(new Blob([source], { type: 'application/pdf' }));
            setPagesDirty(false);
            setEditPages(false);
            notify('Page changes saved.', 'success');
        } catch (error) {
            const message =
                error instanceof PdfSigningError || (error instanceof Error && error.message)
                    ? (error as Error).message
                    : 'Could not save page changes.';
            setPagesError(message);
            notify(message, 'error');
        } finally {
            setSavingPages(false);
        }
    };

    const discardPageChanges = () => {
        setWorkingUrl((prev) => {
            if (prev.startsWith('blob:')) {
                URL.revokeObjectURL(prev);
            }
            return fileUrl;
        });
        setPagesDirty(false);
        setPagesError(null);
        setPageOrder([]);
        setNumPages(0);
        setDims([]);
        setLoadProgress(0);
        setDocReady(false);
        setEditPages(false);
    };

    const reorderAndRebuild = async (fromIndex: number, toIndex: number) => {
        const currentOrder = pageOrder.length ? pageOrder : Array.from({ length: numPages }, (_, i) => i + 1);
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= currentOrder.length || toIndex >= currentOrder.length) {
            return;
        }
        const next = [...currentOrder];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        if (next.every((page, index) => page === index + 1)) {
            return;
        }
        setPageOrder(next);
        await applyPageMutation((source) => rebuildPages(source, next));
    };

    const handleMergeFile = async (file: File | null) => {
        if (!file) {
            return;
        }
        setPagesError(null);
        try {
            const base = await fetchPdf(workingUrl);
            const incoming = await file.arrayBuffer();
            const bytes = await mergePdf(base, incoming, numPages);
            replaceWorkingPdf(bytes);
            notify('Pages inserted. Save when you are done editing.', 'success');
        } catch (error) {
            const message =
                error instanceof PdfSigningError || (error instanceof Error && error.message)
                    ? (error as Error).message
                    : 'Could not merge that PDF.';
            setPagesError(message);
            notify(message, 'error');
        }
    };

    const tops = useMemo(() => {
        const out: number[] = [];
        let y = PAD;
        for (const d of dims) {
            out.push(y);
            y += d.h * zoom + GAP;
        }
        return out;
    }, [dims, zoom]);

    const captionText = useCallback(
        () => `Signed by ${signerName}\n${new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`,
        [signerName],
    );

    // Compose the stamp preview whenever the signature or caption option changes, and keep placements' aspect in sync.
    useEffect(() => {
        let cancelled = false;
        if (!signature) {
            setStamp(null);
            return;
        }
        composeSignatureStamp(signature.image, includeCaption ? captionText() : null)
            .then((s) => {
                if (cancelled) return;
                setStamp(s);
                setPlacements((prev) =>
                    prev.map((p) => {
                        const d = dims[p.page - 1];
                        if (!d) return p;
                        const h = (p.w * (d.w / d.h)) / s.aspect;
                        return { ...p, h, y: clamp(p.y, 0, 1 - h) };
                    }),
                );
            })
            .catch(() => {
                if (cancelled) return;
                setStamp(null);
                setSignError('Your signature image could not be prepared for placing.');
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature, includeCaption]);

    /* ---------- layout & zoom ---------- */

    const fitZoom = useCallback(
        (mode: ZoomMode) => {
            const el = scrollRef.current;
            if (!el || dims.length === 0) return zoom;
            const maxW = Math.max(...dims.map((d) => d.w));
            const availW = el.clientWidth - PAD * 2;
            const widthZoom = availW / maxW;
            if (mode === 'width') return clamp(widthZoom, MIN_ZOOM, 2);
            const d = dims[currentPage - 1] ?? dims[0];
            return clamp(Math.min(widthZoom, (el.clientHeight - PAD * 2) / d.h), MIN_ZOOM, MAX_ZOOM);
        },
        [dims, currentPage, zoom],
    );

    const applyZoom = useCallback(
        (next: number, mode: ZoomMode = 'custom') => {
            const el = scrollRef.current;
            if (el && dims.length) {
                const page = currentPage;
                const top = tops[page - 1] ?? 0;
                const h = (dims[page - 1]?.h ?? 1) * zoom;
                zoomAnchor.current = { page, offset: (el.scrollTop - top) / h };
            }
            setZoomMode(mode);
            setZoom(clamp(Number(next.toFixed(3)), MIN_ZOOM, MAX_ZOOM));
        },
        [currentPage, dims, tops, zoom],
    );

    useLayoutEffect(() => {
        const el = scrollRef.current;
        const anchor = zoomAnchor.current;
        if (!el || !anchor) return;
        zoomAnchor.current = null;
        const top = tops[anchor.page - 1] ?? 0;
        const h = (dims[anchor.page - 1]?.h ?? 1) * zoom;
        el.scrollTop = top + anchor.offset * h;
    }, [zoom, tops, dims]);

    const zoomIn = () => applyZoom(ZOOM_LEVELS.find((z) => z > zoom + 0.001) ?? Math.min(MAX_ZOOM, zoom * 1.25));
    const zoomOut = () => applyZoom([...ZOOM_LEVELS].reverse().find((z) => z < zoom - 0.001) ?? Math.max(MIN_ZOOM, zoom / 1.25));

    const bindScroll = useCallback((el: HTMLDivElement | null) => {
        scrollRef.current = el;
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const measure = () => setViewport({ top: el.scrollTop, height: el.clientHeight, width: el.clientWidth });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        let frame = 0;
        const onScroll = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(measure);
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            ro.disconnect();
            el.removeEventListener('scroll', onScroll);
            cancelAnimationFrame(frame);
        };
    }, [numPages, dims.length]);

    // Refit on container resize when a fit mode is active.
    useEffect(() => {
        if (zoomMode === 'custom' || dims.length === 0) return;
        const next = fitZoom(zoomMode);
        if (Math.abs(next - zoom) > 0.005) setZoom(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewport.width, viewport.height, dims, zoomMode, showThumbs, showPanel]);

    // Ctrl/Cmd + wheel zoom.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            applyZoom(zoom * Math.exp(-e.deltaY * 0.0025));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [applyZoom, zoom]);

    // Track the current page from scroll position.
    useEffect(() => {
        if (!tops.length) return;
        const probe = viewport.top + viewport.height * 0.35;
        let page = 1;
        for (let i = 0; i < tops.length; i++) {
            if (tops[i] <= probe) page = i + 1;
            else break;
        }
        setCurrentPage(page);
    }, [viewport.top, viewport.height, tops]);

    useEffect(() => setPageInput(String(currentPage)), [currentPage]);

    const goToPage = useCallback(
        (page: number, offset = 0, smooth = false) => {
            const el = scrollRef.current;
            if (!el || !tops.length) return;
            const p = clamp(page, 1, tops.length);
            const target = tops[p - 1] - 12 + offset * (dims[p - 1]?.h ?? 0) * zoom;
            el.scrollTo({ top: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' });
        },
        [tops, dims, zoom],
    );

    const visible = useMemo(() => {
        const set = new Set<number>();
        const from = viewport.top - viewport.height;
        const to = viewport.top + viewport.height * 2;
        dims.forEach((d, i) => {
            const top = tops[i];
            if (top + d.h * zoom >= from && top <= to) set.add(i + 1);
        });
        return set;
    }, [dims, tops, zoom, viewport.top, viewport.height]);

    /* ---------- keyboard ---------- */

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
            if (!rootRef.current) return;

            if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                zoomIn();
            } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                zoomOut();
            } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                applyZoom(fitZoom('width'), 'width');
            } else if (e.ctrlKey || e.metaKey || e.altKey) {
                return;
            } else if (e.key === 'ArrowRight') {
                goToPage(currentPage + 1);
            } else if (e.key === 'ArrowLeft') {
                goToPage(currentPage - 1);
            } else if (e.key === 'Home') {
                goToPage(1);
            } else if (e.key === 'End') {
                goToPage(numPages);
            } else if (e.key === 'Escape') {
                if (draft) setDraft(null);
                else if (activeId) setActiveId(null);
                else if (tool !== 'select' && placements.length === 0) setTool('select');
            } else if (e.key === 'v') {
                setTool('select');
            } else if (e.key === 'c' && canAnnotate) {
                setTool('comment');
            } else if (e.key === 'h' && canAnnotate) {
                setTool('highlight');
            } else if (e.key === 't' && canAnnotate) {
                setTool('text');
            } else if (e.key === 'n' && canAnnotate) {
                setTool('name');
            } else if (e.key === 'd' && canAnnotate) {
                setTool('date');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    /* ---------- fullscreen ---------- */

    useEffect(() => {
        const handler = () => setFullscreen(document.fullscreenElement === rootRef.current);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    const toggleFullscreen = () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else rootRef.current?.requestFullscreen?.();
    };

    /* ---------- document loading ---------- */

    const onLoadProgress = useCallback(({ loaded, total }: { loaded: number; total: number }) => {
        if (!total) {
            return;
        }
        setLoadProgress(Math.min(99, Math.round((loaded / total) * 100)));
    }, []);

    const onLoadSuccess = async (pdf: {
        numPages: number;
        getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number } }>;
    }) => {
        setLoadProgress(100);
        const sizes: Dim[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const vp = page.getViewport({ scale: 1 });
            sizes.push({ w: vp.width, h: vp.height });
        }
        setDims(sizes);
        setNumPages(pdf.numPages);
        setZoomMode('width');
        setDocReady(true);
    };

    /* ---------- annotations ---------- */

    const pageAnnotations = useMemo(() => {
        const map = new Map<number, Annotation[]>();
        if (pagesDirty) {
            return map;
        }
        for (const a of annotations) {
            if (!a.coordinates) continue;
            if (a.annotation_type !== 'NOTE' && commentFilter === 'open' && a.resolved && a.id !== activeId) continue;
            const list = map.get(a.page_number) ?? [];
            list.push(a);
            map.set(a.page_number, list);
        }
        return map;
    }, [annotations, commentFilter, activeId, pagesDirty]);

    const listed = useMemo(
        () =>
            annotations
                .filter((a) => a.annotation_type !== 'NOTE')
                .filter((a) => commentFilter === 'all' || !a.resolved)
                .sort((a, b) => a.page_number - b.page_number || (a.coordinates?.y ?? 0) - (b.coordinates?.y ?? 0)),
        [annotations, commentFilter],
    );

    const openCount = annotations.filter((a) => a.annotation_type !== 'NOTE' && !a.resolved).length;
    const textNotes = useMemo(() => annotations.filter((a) => a.annotation_type === 'NOTE' && a.coordinates), [annotations]);

    const placeNote = useCallback(
        async (
            page: number,
            x: number,
            y: number,
            content: string,
            color = '#0F172A',
            style: { size?: number; bold?: boolean; italic?: boolean } = {},
        ) => {
            const box = noteBox(content, x, y, { size: NOTE_SIZE_DEFAULT, ...style });
            await props.onAddAnnotation({
                annotation_type: 'NOTE',
                page_number: page,
                coordinates: box,
                content,
                color,
            });
            setTool('select');
            notify('Added on the page.', 'success');
        },
        [props],
    );

    const focusAnnotation = (a: Annotation) => {
        setActiveId(a.id);
        setShowPanel(true);
        setPanelTab('comments');
        goToPage(a.page_number, Math.max(0, (a.coordinates?.y ?? 0) - 0.15), true);
    };

    useEffect(() => {
        if (activeId === null) return;
        document.getElementById(`annotation-${activeId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [activeId]);

    /* ---------- signature placement ---------- */

    const placeAt = useCallback(
        (page: number, x: number, y: number, s?: StampPreview | null) => {
            const preview = s ?? activeStampPreview;
            const d = dims[page - 1];
            if (!d || !preview) return;
            // Default ~40mm wide on A4 (210mm) — a normal handwritten signature size.
            const w = markKind === 'stamp' ? 50 / 210 : 40 / 210;
            const h = ((d.w * w) / preview.aspect) / d.h;
            setPlacements((prev) => [...prev, { id: uid(), page, w, h, x: clamp(x - w / 2, 0, 1 - w), y: clamp(y - h / 2, 0, 1 - h) }]);
        },
        [activeStampPreview, dims, markKind],
    );

    useEffect(() => {
        if (pendingPlace && stamp && markKind === 'sign') {
            placeAt(pendingPlace.page, pendingPlace.x, pendingPlace.y, stamp);
            setPendingPlace(null);
        }
    }, [pendingPlace, stamp, placeAt, markKind]);

    const startSigning = () => {
        setMarkKind('sign');
        setTool('sign');
        setDraft(null);
        setPlacements([]);
        setRubberStamp(null);
        setStampError(null);
        setSignError(null);
        if (savedSignature) {
            setSignature({ image: savedSignature, save: false });
            return;
        }
        if (signature) {
            return;
        }
        if (allowCreateSignature) {
            setSignModalOpen(true);
            return;
        }
        setSignError('No signature has been assigned to your account. Ask an administrator to add one.');
    };

    const cancelSigning = () => {
        setPlacements([]);
        setTool('select');
        setMarkKind(null);
        setSignError(null);
    };

    const finishSigning = async () => {
        if (!signature || placements.length === 0) return;
        setSigning(true);
        setSignError(null);
        try {
            const finalStamp = await composeSignatureStamp(signature.image, includeCaption ? captionText() : null);
            const source = await fetchPdf(workingUrl);
            const clean = placements.map(({ page, x, y, w, h }) => ({ page, x, y, w, h }));
            const bytes = await signPdf(source, finalStamp.dataUrl, clean, { signer: signerName });
            await props.onSign({
                pdf: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
                image: signature.image,
                placements: clean,
                save: signature.save,
            });
            setConfirmOpen(false);
            setPlacements([]);
            setTool('select');
            setMarkKind(null);
        } catch (error) {
            const message =
                error instanceof PdfSigningError || (error instanceof Error && error.message)
                    ? (error as Error).message
                    : 'Signing failed. Please try again.';
            setSignError(message);
        } finally {
            setSigning(false);
        }
    };

    const startStamping = async () => {
        if (!savedStamp) {
            setMarkKind('stamp');
            setTool('stamp');
            setPlacements([]);
            setStampError('No stamp has been assigned to your account. Ask an administrator to add one under Users.');
            return;
        }

        setMarkKind('stamp');
        setTool('stamp');
        setDraft(null);
        setPlacements([]);
        setSignError(null);
        setStampError(null);

        try {
            const img = await loadImage(savedStamp);
            setRubberStamp({ dataUrl: savedStamp, aspect: img.width / Math.max(img.height, 1) });
        } catch {
            setRubberStamp(null);
            setStampError('The assigned stamp could not be loaded.');
        }
    };

    const cancelStamping = () => {
        setPlacements([]);
        setTool('select');
        setMarkKind(null);
        setRubberStamp(null);
        setStampError(null);
    };

    const finishStamping = async () => {
        if (!props.onStamp || !rubberStamp || !savedStamp || placements.length === 0) return;
        setStamping(true);
        setStampError(null);
        try {
            const source = await fetchPdf(workingUrl);
            const clean = placements.map(({ page, x, y, w, h }) => ({ page, x, y, w, h }));
            const bytes = await signPdf(source, rubberStamp.dataUrl, clean, { signer: signerName, reason: `Stamped by ${signerName}` });
            await props.onStamp({
                pdf: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
                image: savedStamp,
                placements: clean,
            });
            setStampConfirmOpen(false);
            setPlacements([]);
            setTool('select');
            setMarkKind(null);
            setRubberStamp(null);
        } catch (error) {
            const message =
                error instanceof PdfSigningError || (error instanceof Error && error.message)
                    ? (error as Error).message
                    : 'Stamping failed. Please try again.';
            setStampError(message);
        } finally {
            setStamping(false);
        }
    };

    /* ---------- overlay pointer handling ---------- */

    const relativePoint = (e: React.PointerEvent | React.MouseEvent, el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        return { x: clamp((e.clientX - rect.left) / rect.width, 0, 1), y: clamp((e.clientY - rect.top) / rect.height, 0, 1) };
    };

    const dismissEditor = () => {
        setActiveId(null);
        if (draft?.type === 'TEXT' || draft?.type === 'COMMENT') {
            setDraft(null);
        }
    };

    const saveMarksToDocument = async () => {
        if (!props.onSaveMarks || textNotes.length === 0) {
            return;
        }

        setSavingMarks(true);
        setActiveId(null);
        try {
            const source = await fetchPdf(workingUrl);
            const stamps = textNotes.flatMap((note) => {
                const c = note.coordinates!;
                if (c.w == null || c.h == null) {
                    return [];
                }
                const size = c.size ?? heightToSize(c.h);
                const stamp = composeTextStamp(note.content, {
                    fontSize: Math.round(36 + size * 84),
                    color: note.color || '#0F172A',
                    bold: !!c.bold,
                    italic: !!c.italic,
                });

                return [
                    {
                        png: stamp.dataUrl,
                        placement: { page: note.page_number, x: c.x, y: c.y, w: c.w, h: c.h },
                    },
                ];
            });

            if (stamps.length === 0) {
                notify('Nothing to save yet.', 'info');
                return;
            }

            const bytes = await stampPdf(source, stamps, { reason: 'Text marks applied' });
            await props.onSaveMarks(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
            notify('Text saved into the document.', 'success');
        } catch (error) {
            const message =
                error instanceof PdfSigningError || (error instanceof Error && error.message)
                    ? (error as Error).message
                    : 'Could not save text to the document.';
            notify(message, 'error');
        } finally {
            setSavingMarks(false);
        }
    };

    const onOverlayPointerDown = (page: number) => (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget || e.button !== 0) return;
        const pt = relativePoint(e, e.currentTarget);
        dismissEditor();

        if (tool === 'select') {
            return;
        }

        if (tool === 'comment') {
            setDraft({ type: 'COMMENT', page, x: pt.x, y: pt.y });
        } else if (tool === 'text') {
            setDraft({ type: 'TEXT', page, x: pt.x, y: pt.y });
        } else if (tool === 'name') {
            if (!signerName.trim()) {
                notify('Your name is not available on this account.', 'error');
                return;
            }
            void placeNote(page, pt.x, pt.y, signerName.trim());
        } else if (tool === 'date') {
            void placeNote(page, pt.x, pt.y, todayLabel());
        } else if (tool === 'highlight') {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDraft(null);
            setDragRect({ page, x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y });
        } else if (tool === 'sign') {
            if (!stamp) {
                setPendingPlace({ page, x: pt.x, y: pt.y });
                setSignModalOpen(true);
            } else {
                placeAt(page, pt.x, pt.y, stamp);
            }
        } else if (tool === 'stamp') {
            if (rubberStamp) {
                placeAt(page, pt.x, pt.y, rubberStamp);
            }
        }
    };

    const onOverlayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRect) return;
        const pt = relativePoint(e, e.currentTarget);
        setDragRect((r) => (r ? { ...r, x1: pt.x, y1: pt.y } : r));
    };

    const onOverlayPointerUp = () => {
        if (!dragRect) return;
        const x = Math.min(dragRect.x0, dragRect.x1);
        const y = Math.min(dragRect.y0, dragRect.y1);
        const w = Math.abs(dragRect.x1 - dragRect.x0);
        const h = Math.abs(dragRect.y1 - dragRect.y0);
        setDragRect(null);
        if (w > 0.01 && h > 0.005) setDraft({ type: 'HIGHLIGHT', page: dragRect.page, x, y, w, h });
    };

    const startPlacementDrag = (p: PlacedSignature, mode: 'move' | 'resize') => (e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const overlay = (e.currentTarget as HTMLElement).closest('[data-overlay]') as HTMLElement | null;
        if (!overlay) return;
        const rect = overlay.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const d = dims[p.page - 1];
        const aspect = activeStampPreview?.aspect ?? p.w / p.h;

        const move = (ev: PointerEvent) => {
            const dx = (ev.clientX - startX) / rect.width;
            const dy = (ev.clientY - startY) / rect.height;
            setPlacements((prev) =>
                prev.map((item) => {
                    if (item.id !== p.id) return item;
                    if (mode === 'move') {
                        return { ...item, x: clamp(p.x + dx, 0, 1 - p.w), y: clamp(p.y + dy, 0, 1 - p.h) };
                    }
                    const minW = 40 / rect.width;
                    const w = clamp(p.w + dx, minW, 1 - p.x);
                    const h = (w * (d.w / d.h)) / aspect;
                    if (p.y + h > 1) return item;
                    return { ...item, w, h };
                }),
            );
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    /* ---------- render ---------- */

    const panels: ViewerPanel[] = [
        { id: 'comments', label: 'Comments', icon: MessageSquare, content: null },
        { id: 'signatures', label: 'Signatures', icon: PenLine, content: null },
        ...extraPanels,
    ];

    const tools: { id: Tool; label: string; short: string; icon: LucideIcon; shortcut: string; hidden?: boolean }[] = [
        { id: 'select', label: 'Select & read', short: 'Select', icon: MousePointer2, shortcut: 'V' },
        { id: 'comment', label: 'Add comment', short: 'Comment', icon: MessageSquarePlus, shortcut: 'C', hidden: !canAnnotate },
        { id: 'highlight', label: 'Highlight area', short: 'Highlight', icon: Highlighter, shortcut: 'H', hidden: !canAnnotate },
        { id: 'text', label: 'Add text', short: 'Text', icon: Type, shortcut: 'T', hidden: !canAnnotate },
        { id: 'name', label: 'Add your full name', short: 'Name', icon: UserRound, shortcut: 'N', hidden: !canAnnotate },
        { id: 'date', label: "Add today's date", short: 'Date', icon: CalendarDays, shortcut: 'D', hidden: !canAnnotate },
    ];

    const cursor =
        tool === 'comment' || tool === 'text' || tool === 'name' || tool === 'date'
            ? 'cursor-copy'
            : tool === 'highlight'
              ? 'cursor-crosshair'
              : tool === 'sign' || tool === 'stamp'
                ? 'cursor-cell'
                : '';
    const overlayInteractive = tool !== 'select' || !!activeId || !!draft;
    const signMode = markKind === 'sign' && (tool === 'sign' || placements.length > 0);
    const stampMode = markKind === 'stamp' && (tool === 'stamp' || placements.length > 0);
    const showSaveMarks = !!props.onSaveMarks && textNotes.length > 0 && !signMode && !stampMode;

    return (
        <div ref={rootRef} className={cn('flex h-full min-h-0 flex-col bg-slate-100 dark:bg-night-950', fullscreen && 'h-screen')}>
            {/* Toolbar */}
            <div className="flex h-12 shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-2 dark:border-night-700 dark:bg-night-900 sm:gap-2 sm:px-3">
                <ToolbarButton icon={PanelLeft} label="Toggle page thumbnails" active={showThumbs} onClick={() => setShowThumbs((s) => !s)} />
                <Divider />
                <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-night-800">
                    {tools
                        .filter((t) => !t.hidden)
                        .map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                    setTool(t.id);
                                    setDraft(null);
                                }}
                                title={`${t.label} (${t.shortcut})`}
                                className={cn(
                                    'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition',
                                    tool === t.id
                                        ? 'bg-white text-slate-900 shadow-sm dark:bg-night-950 dark:text-night-100'
                                        : 'text-slate-500 hover:text-slate-800 dark:text-night-400 dark:hover:text-night-200',
                                )}
                            >
                                <t.icon className="h-4 w-4" />
                                <span className="hidden xl:inline">{t.short}</span>
                            </button>
                        ))}
                </div>
                {canSign && (
                    <Button size="sm" variant={tool === 'sign' ? 'primary' : 'subtle'} icon={PenLine} onClick={startSigning} className="ml-1">
                        <span className="hidden sm:inline">{alreadySigned ? 'Sign again' : 'Sign'}</span>
                    </Button>
                )}
                {canSign && props.onStamp && (
                    <Button size="sm" variant={tool === 'stamp' ? 'primary' : 'subtle'} icon={Stamp} onClick={() => void startStamping()}>
                        <span className="hidden sm:inline">Stamp</span>
                    </Button>
                )}

                <div className="mx-auto flex items-center gap-1">
                    <ToolbarButton icon={ChevronLeft} label="Previous page" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)} />
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const n = parseInt(pageInput, 10);
                            if (!Number.isNaN(n)) goToPage(n);
                            else setPageInput(String(currentPage));
                        }}
                        className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-night-400"
                    >
                        <input
                            value={pageInput}
                            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
                            onBlur={() => setPageInput(String(currentPage))}
                            onFocus={(e) => e.target.select()}
                            aria-label="Current page"
                            className="h-8 w-11 rounded-md border-0 bg-slate-100 px-1 text-center text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 dark:bg-night-800 dark:text-night-100 dark:focus:bg-night-950 focus:ring-brand-600"
                        />
                        <span className="whitespace-nowrap">of {numPages || '–'}</span>
                    </form>
                    <ToolbarButton icon={ChevronRight} label="Next page" disabled={currentPage >= numPages} onClick={() => goToPage(currentPage + 1)} />
                </div>

                <div className="flex items-center gap-0.5">
                    <ToolbarButton icon={ZoomOut} label="Zoom out (Ctrl −)" onClick={zoomOut} disabled={zoom <= MIN_ZOOM} />
                    <Menu
                        align="right"
                        widthClass="w-40"
                        triggerClassName="inline-flex h-8 min-w-[4.5rem] items-center justify-center gap-1 rounded-md px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-night-200 dark:hover:bg-night-800"
                        trigger={
                            <>
                                {Math.round(zoom * 100)}%
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                            </>
                        }
                        items={[
                            { label: 'Fit to width', onClick: () => applyZoom(fitZoom('width'), 'width') },
                            { label: 'Fit whole page', onClick: () => applyZoom(fitZoom('page'), 'page') },
                            ...ZOOM_LEVELS.map((z, i) => ({
                                label: `${Math.round(z * 100)}%`,
                                onClick: () => applyZoom(z),
                                separatorBefore: i === 0,
                            })),
                        ]}
                    />
                    <ToolbarButton icon={ZoomIn} label="Zoom in (Ctrl +)" onClick={zoomIn} disabled={zoom >= MAX_ZOOM} />
                    <Divider />
                    <ToolbarButton icon={fullscreen ? Minimize : Maximize} label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen} />
                    {downloadUrl && (
                        <a
                            href={downloadUrl}
                            title="Download"
                            aria-label="Download"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-night-400 dark:hover:bg-night-800 dark:hover:text-night-200"
                        >
                            <Download className="h-4 w-4" />
                        </a>
                    )}
                    <ToolbarButton icon={PanelRight} label="Toggle side panel" active={showPanel} onClick={() => setShowPanel((s) => !s)} />
                </div>
            </div>

            <div className="relative flex min-h-0 flex-1">
                {loadError ? (
                    <ViewerMessage
                        icon={<FileWarning className="h-6 w-6 text-red-500" />}
                        title={loadError}
                        action={
                            downloadUrl && (
                                <a className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" href={downloadUrl}>
                                    Download instead
                                </a>
                            )
                        }
                    />
                ) : (
                <Document
                    key={workingUrl}
                    file={workingUrl}
                    options={PDF_OPTIONS}
                    onLoadSuccess={onLoadSuccess}
                    onLoadProgress={onLoadProgress}
                    onLoadError={(err) => setLoadError(err?.message?.includes('Invalid PDF') ? 'This file is not a valid PDF.' : 'The document could not be loaded.')}
                    onPassword={() => setLoadError('This PDF is password-protected and cannot be previewed. Download it to open it locally.')}
                    onItemClick={({ pageNumber }) => goToPage(Number(pageNumber))}
                    className="relative flex min-h-0 min-w-0 flex-1"
                    loading={<DocumentLoadView progress={loadProgress} />}
                    error={<ViewerMessage icon={<FileWarning className="h-6 w-6 text-red-500" />} title="The document could not be loaded." />}
                >
                    <>
                            {!docReady && (
                                <DocumentLoadView
                                    progress={loadProgress}
                                    phase={loadProgress >= 100 ? 'prepare' : 'download'}
                                />
                            )}
                            {showThumbs && numPages > 0 && (
                                <ThumbnailRail
                                    numPages={numPages}
                                    current={currentPage}
                                    pageOrder={pageOrder.length ? pageOrder : Array.from({ length: numPages }, (_, i) => i + 1)}
                                    editMode={editPages}
                                    canEdit={canEditPages && !!props.onUpdatePages}
                                    pagesDirty={pagesDirty}
                                    saving={savingPages}
                                    error={pagesError}
                                    onSelect={(p) => goToPage(p)}
                                    onToggleEdit={() => {
                                        setShowThumbs(true);
                                        setEditPages((v) => !v);
                                    }}
                                    onReorder={(from, to) => void reorderAndRebuild(from, to)}
                                    onDelete={(page) => {
                                        if (numPages <= 1) {
                                            notify('A document must keep at least one page.', 'error');
                                            return;
                                        }
                                        void applyPageMutation((source) => deletePdfPages(source, [page]));
                                    }}
                                    onDuplicate={(page) => void applyPageMutation((source) => duplicatePage(source, page))}
                                    onInsertClick={() => mergeInputRef.current?.click()}
                                    onSave={() => void savePageChanges()}
                                    onDiscard={discardPageChanges}
                                    pageAnnotations={pageAnnotations}
                                />
                            )}
                            <input
                                ref={mergeInputRef}
                                type="file"
                                accept="application/pdf,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    e.target.value = '';
                                    void handleMergeFile(file);
                                }}
                            />
                            <div
                                ref={bindScroll}
                                className={cn(
                                    'relative min-w-0 flex-1 overflow-auto scrollbar-thin',
                                    tool !== 'select' && 'viewer-tool-active',
                                    !docReady && 'hidden',
                                )}
                            >
                                <div className="mx-auto flex w-max min-w-full flex-col items-center" style={{ padding: `${PAD}px`, gap: `${GAP}px` }}>
                                    {dims.map((d, i) => {
                                        const page = i + 1;
                                        const isVisible = visible.has(page);
                                        const pageNotes = pageAnnotations.get(page) ?? [];
                                        const pagePlacements = placements.filter((p) => p.page === page);
                                        return (
                                            <div
                                                key={page}
                                                data-page={page}
                                                className="relative bg-white ring-1 ring-slate-200/80 dark:ring-night-700/80"
                                                style={{ width: d.w * zoom, height: d.h * zoom }}
                                            >
                                                {isVisible ? (
                                                    <Page
                                                        pageNumber={page}
                                                        scale={zoom}
                                                        renderTextLayer={tool === 'select'}
                                                        renderAnnotationLayer
                                                        loading={<PageSkeleton />}
                                                    />
                                                ) : (
                                                    <PageSkeleton />
                                                )}
                                                <div
                                                    data-overlay
                                                    className={cn(
                                                        'absolute inset-0 z-10',
                                                        overlayInteractive ? cursor || 'cursor-default' : 'pointer-events-none',
                                                    )}
                                                    onPointerDown={onOverlayPointerDown(page)}
                                                    onPointerMove={onOverlayPointerMove}
                                                    onPointerUp={onOverlayPointerUp}
                                                >
                                                    {pageNotes.map((a) => {
                                                        if (a.annotation_type === 'HIGHLIGHT') {
                                                            return (
                                                                <button
                                                                    key={a.id}
                                                                    type="button"
                                                                    onClick={() => focusAnnotation(a)}
                                                                    className={cn(
                                                                        'pointer-events-auto absolute rounded-[2px] mix-blend-multiply transition',
                                                                        activeId === a.id ? 'ring-2 ring-brand-600 ring-offset-1' : 'hover:brightness-95',
                                                                        a.resolved && 'opacity-40',
                                                                    )}
                                                                    style={{
                                                                        left: `${a.coordinates!.x * 100}%`,
                                                                        top: `${a.coordinates!.y * 100}%`,
                                                                        width: `${(a.coordinates!.w ?? 0.1) * 100}%`,
                                                                        height: `${(a.coordinates!.h ?? 0.02) * 100}%`,
                                                                        backgroundColor: `${a.color}99`,
                                                                    }}
                                                                    aria-label={`Highlight by ${fullName(a.user)}`}
                                                                />
                                                            );
                                                        }

                                                        if (a.annotation_type === 'NOTE') {
                                                            return (
                                                                <TextNoteMark
                                                                    key={a.id}
                                                                    annotation={a}
                                                                    pageWidth={d.w * zoom}
                                                                    pageHeight={d.h * zoom}
                                                                    active={activeId === a.id}
                                                                    canEdit={!!props.onUpdateAnnotation && (a.user_id === currentUserId || canModerate)}
                                                                    canDelete={a.user_id === currentUserId || canModerate}
                                                                    onSelect={() => setActiveId(a.id)}
                                                                    onDelete={() => {
                                                                        props.onDeleteAnnotation(a.id);
                                                                        setActiveId(null);
                                                                    }}
                                                                    onUpdate={async (patch) => {
                                                                        if (!props.onUpdateAnnotation) return;
                                                                        await props.onUpdateAnnotation(a.id, patch);
                                                                    }}
                                                                />
                                                            );
                                                        }

                                                        const commentIndex =
                                                            pageNotes.filter((n) => n.annotation_type === 'COMMENT').findIndex((n) => n.id === a.id) + 1;

                                                        return (
                                                            <CommentPin
                                                                key={a.id}
                                                                annotation={a}
                                                                index={commentIndex}
                                                                active={activeId === a.id}
                                                                onClick={() => focusAnnotation(a)}
                                                            />
                                                        );
                                                    })}

                                                    {activeId !== null &&
                                                        pageNotes
                                                            .filter((a) => a.id === activeId && a.annotation_type !== 'NOTE')
                                                            .map((a) => (
                                                                <AnnotationPopover
                                                                    key={a.id}
                                                                    annotation={a}
                                                                    canDelete={a.user_id === currentUserId || canModerate}
                                                                    onClose={() => setActiveId(null)}
                                                                    onToggleResolve={() => props.onToggleResolve(a.id)}
                                                                    onDelete={() => {
                                                                        props.onDeleteAnnotation(a.id);
                                                                        setActiveId(null);
                                                                    }}
                                                                />
                                                            ))}

                                                    {dragRect?.page === page && (
                                                        <div
                                                            className="pointer-events-none absolute border border-amber-500 bg-yellow-300/40"
                                                            style={{
                                                                left: `${Math.min(dragRect.x0, dragRect.x1) * 100}%`,
                                                                top: `${Math.min(dragRect.y0, dragRect.y1) * 100}%`,
                                                                width: `${Math.abs(dragRect.x1 - dragRect.x0) * 100}%`,
                                                                height: `${Math.abs(dragRect.y1 - dragRect.y0) * 100}%`,
                                                            }}
                                                        />
                                                    )}

                                                    {draft?.type === 'TEXT' && draft.page === page && (
                                                        <OnPaperTextEditor
                                                            x={draft.x}
                                                            y={draft.y}
                                                            pageHeight={d.h * zoom}
                                                            onCancel={() => {
                                                                setDraft(null);
                                                                setTool('select');
                                                            }}
                                                            onSubmit={async (content, color, style) => {
                                                                await placeNote(draft.page, draft.x, draft.y, content, color, style);
                                                                setDraft(null);
                                                            }}
                                                        />
                                                    )}

                                                    {draft?.page === page && draft.type !== 'TEXT' && (
                                                        <DraftComposer
                                                            draft={draft}
                                                            onCancel={() => setDraft(null)}
                                                            onSubmit={async (content, color) => {
                                                                await props.onAddAnnotation({
                                                                    annotation_type: draft.type,
                                                                    page_number: draft.page,
                                                                    coordinates:
                                                                        draft.type === 'HIGHLIGHT'
                                                                            ? { x: draft.x, y: draft.y, w: draft.w, h: draft.h }
                                                                            : { x: draft.x, y: draft.y },
                                                                    content,
                                                                    color,
                                                                });
                                                                setDraft(null);
                                                                setShowPanel(true);
                                                                setPanelTab('comments');
                                                            }}
                                                        />
                                                    )}

                                                    {activeStampPreview &&
                                                        pagePlacements.map((p) => (
                                                            <div
                                                                key={p.id}
                                                                onPointerDown={startPlacementDrag(p, 'move')}
                                                                className="group pointer-events-auto absolute cursor-move touch-none rounded-sm outline-dashed outline-2 outline-offset-2 outline-brand-500 hover:bg-brand-50/30"
                                                                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.w * 100}%`, height: `${p.h * 100}%` }}
                                                            >
                                                                <img
                                                                    src={activeStampPreview.dataUrl}
                                                                    alt={markKind === 'stamp' ? 'Stamp' : 'Signature'}
                                                                    draggable={false}
                                                                    className="h-full w-full select-none"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                    onClick={() => setPlacements((prev) => prev.filter((x) => x.id !== p.id))}
                                                                    className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-600 shadow ring-1 ring-slate-200 hover:text-red-600"
                                                                    aria-label={markKind === 'stamp' ? 'Remove stamp' : 'Remove signature'}
                                                                >
                                                                    <X className="h-3.5 w-3.5" />
                                                                </button>
                                                                <span
                                                                    onPointerDown={startPlacementDrag(p, 'resize')}
                                                                    className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-brand-600 shadow"
                                                                    aria-hidden
                                                                />
                                                            </div>
                                                        ))}
                                                </div>
                                                <span className="pointer-events-none absolute -bottom-[14px] right-0 text-[10px] font-medium text-slate-400">{page}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                    </>
                </Document>
                )}

                {showSaveMarks && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4">
                        <div className="pointer-events-auto flex max-w-full animate-slide-up flex-wrap items-center gap-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-pop">
                            <Type className="h-4 w-4 text-brand-300" />
                            <span className="font-medium">
                                {textNotes.length} text mark{textNotes.length === 1 ? '' : 's'} on this document
                            </span>
                            <Button
                                size="sm"
                                icon={Save}
                                loading={savingMarks}
                                onClick={() => void saveMarksToDocument()}
                                className="bg-brand-500 hover:bg-brand-400"
                            >
                                Save to document
                            </Button>
                        </div>
                    </div>
                )}

                {signMode && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4">
                        <div className="pointer-events-auto flex max-w-full animate-slide-up flex-wrap items-center gap-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-pop">
                            {stamp ? (
                                <img src={stamp.dataUrl} alt="" className="h-8 max-w-[7rem] rounded bg-white object-contain p-0.5" />
                            ) : (
                                <PenLine className="h-4 w-4 text-brand-300" />
                            )}
                            <span className="font-medium">
                                {signError
                                    ? signError
                                    : placements.length === 0
                                      ? stamp
                                          ? 'Click on the page where you want to sign'
                                          : 'Waiting for an assigned signature…'
                                      : `${placements.length} signature${placements.length > 1 ? 's' : ''} placed — drag to move, use the corner to resize`}
                            </span>
                            {stamp && (
                                <label className="flex items-center gap-2 text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={includeCaption}
                                        onChange={(e) => setIncludeCaption(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-brand-500 focus:ring-brand-500"
                                    />
                                    Name & date
                                </label>
                            )}
                            <div className="flex items-center gap-1.5">
                                {(allowCreateSignature || savedSignature) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (savedSignature && !allowCreateSignature) {
                                                setSignature({ image: savedSignature, save: false });
                                                return;
                                            }
                                            setSignModalOpen(true);
                                        }}
                                        className="rounded-md px-2.5 py-1.5 font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                                    >
                                        {stamp ? 'Change' : allowCreateSignature ? 'Create signature' : 'Use assigned signature'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={cancelSigning}
                                    className="rounded-md px-2.5 py-1.5 font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <Button size="sm" icon={Check} disabled={placements.length === 0} onClick={() => setConfirmOpen(true)} className="bg-brand-500 hover:bg-brand-400">
                                    Finish & sign
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {stampMode && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4">
                        <div className="pointer-events-auto flex max-w-full animate-slide-up flex-wrap items-center gap-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-pop">
                            {rubberStamp ? (
                                <img src={rubberStamp.dataUrl} alt="" className="h-8 max-w-[7rem] rounded bg-white object-contain p-0.5" />
                            ) : (
                                <Stamp className="h-4 w-4 text-brand-300" />
                            )}
                            <span className="font-medium">
                                {stampError
                                    ? stampError
                                    : placements.length === 0
                                      ? rubberStamp
                                          ? 'Click on the page where you want to stamp'
                                          : 'Waiting for an assigned stamp…'
                                      : `${placements.length} stamp${placements.length > 1 ? 's' : ''} placed — drag to move, use the corner to resize`}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={cancelStamping}
                                    className="rounded-md px-2.5 py-1.5 font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <Button
                                    size="sm"
                                    icon={Check}
                                    disabled={placements.length === 0 || !rubberStamp}
                                    onClick={() => setStampConfirmOpen(true)}
                                    className="bg-brand-500 hover:bg-brand-400"
                                >
                                    Finish & stamp
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {showPanel && (
                    <aside
                        className={cn(
                            'flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white dark:border-night-700 dark:bg-night-900',
                            !isLarge && 'absolute inset-y-0 right-0 z-30 shadow-pop',
                        )}
                    >
                        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 px-2.5 dark:border-night-700">
                            <div
                                role="tablist"
                                className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-lg bg-slate-100 p-1 ring-1 ring-inset ring-slate-200/70 dark:bg-night-800 dark:ring-night-700/70"
                            >
                                {panels.map((p) => {
                                    const active = panelTab === p.id;
                                    const count =
                                        p.id === 'comments' ? openCount : p.id === 'signatures' ? signatures.length : 0;
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={active}
                                            onClick={() => setPanelTab(p.id)}
                                            className={cn(
                                                'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all',
                                                active
                                                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:bg-night-950 dark:text-night-100 dark:ring-night-700/80'
                                                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-800 dark:text-night-400 dark:hover:bg-night-700/50 dark:hover:text-night-200',
                                            )}
                                        >
                                            <p.icon className="h-3.5 w-3.5" />
                                            {p.label}
                                            {count > 0 && (
                                                <span
                                                    className={cn(
                                                        'min-w-4 rounded-md px-1 py-0.5 text-center text-[10px] font-semibold tabular-nums',
                                                        p.id === 'comments'
                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                                            : 'bg-brand-50 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200',
                                                    )}
                                                >
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowPanel(false)}
                                className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-night-800 dark:hover:text-night-300"
                                aria-label="Close panel"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
                            {panelTab === 'comments' && (
                                <CommentsPanel
                                    items={listed}
                                    filter={commentFilter}
                                    onFilter={setCommentFilter}
                                    openCount={openCount}
                                    totalCount={annotations.length}
                                    activeId={activeId}
                                    currentUserId={currentUserId}
                                    canModerate={canModerate}
                                    canAnnotate={canAnnotate}
                                    onSelect={focusAnnotation}
                                    onToggleResolve={props.onToggleResolve}
                                    onDelete={props.onDeleteAnnotation}
                                    onStartComment={() => setTool('comment')}
                                />
                            )}
                            {panelTab === 'signatures' && (
                                <SignaturesPanel
                                    signatures={signatures}
                                    canSign={canSign}
                                    alreadySigned={alreadySigned}
                                    canStamp={!!props.onStamp}
                                    currentUserId={currentUserId}
                                    canModerate={canModerate}
                                    onSign={startSigning}
                                    onStamp={() => void startStamping()}
                                    onRemove={props.onRemoveSignature}
                                    onJump={(p) => goToPage(p.page, Math.max(0, p.y - 0.2), true)}
                                />
                            )}
                            {extraPanels.map((p) => (panelTab === p.id ? <div key={p.id}>{p.content}</div> : null))}
                        </div>

                        {panelTab === 'comments' && canAnnotate && (
                            <PageCommentComposer
                                page={currentPage}
                                onSubmit={(content) =>
                                    props.onAddAnnotation({ annotation_type: 'COMMENT', page_number: currentPage, coordinates: null, content })
                                }
                            />
                        )}
                    </aside>
                )}
            </div>

            <SignatureModal
                open={signModalOpen}
                onClose={() => {
                    setSignModalOpen(false);
                    setPendingPlace(null);
                    if (!signature && placements.length === 0) {
                        setTool('select');
                        setMarkKind(null);
                    }
                }}
                onConfirm={(result) => {
                    setSignature({ ...result, save: false });
                    setSignModalOpen(false);
                    setMarkKind('sign');
                    setTool('sign');
                    if (!pendingPlace) notify('Signature ready. Click on the page to place it.', 'info');
                }}
                savedSignature={savedSignature}
                defaultName={signerName}
                allowCreate={allowCreateSignature}
                allowSave={false}
            />

            <Dialog
                open={confirmOpen}
                onClose={() => !signing && setConfirmOpen(false)}
                title="Sign this document?"
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={signing}>
                            Back
                        </Button>
                        <Button icon={PenLine} onClick={finishSigning} loading={signing}>
                            {signing ? 'Signing…' : 'Sign document'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4 text-sm text-slate-600 dark:text-night-400">
                    <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-night-700 dark:bg-night-900/50">
                        {stamp && <img src={stamp.dataUrl} alt="" className="h-14 max-w-[10rem] rounded bg-white object-contain p-1" />}
                        <div>
                            <p className="font-medium text-slate-900 dark:text-night-100">{signerName}</p>
                            <p>
                                {placements.length} placement{placements.length > 1 ? 's' : ''} on page
                                {new Set(placements.map((p) => p.page)).size > 1 ? 's' : ''}{' '}
                                {[...new Set(placements.map((p) => p.page))].sort((a, b) => a - b).join(', ')}
                            </p>
                        </div>
                    </div>
                    <p>
                        By selecting <strong>Sign document</strong>, you agree that this electronic signature is the legal equivalent of your
                        handwritten signature. Your name, time, IP address and a fingerprint (SHA-256) of the signed file will be recorded.
                    </p>
                    {signError && <Alert tone="error">{signError}</Alert>}
                </div>
            </Dialog>

            <Dialog
                open={stampConfirmOpen}
                onClose={() => !stamping && setStampConfirmOpen(false)}
                title="Apply stamp?"
                size="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setStampConfirmOpen(false)} disabled={stamping}>
                            Back
                        </Button>
                        <Button icon={Stamp} onClick={() => void finishStamping()} loading={stamping}>
                            {stamping ? 'Stamping…' : 'Apply stamp'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4 text-sm text-slate-600 dark:text-night-400">
                    <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-night-700 dark:bg-night-900/50">
                        {rubberStamp && <img src={rubberStamp.dataUrl} alt="" className="h-14 max-w-[10rem] rounded bg-white object-contain p-1" />}
                        <div>
                            <p className="font-medium text-slate-900 dark:text-night-100">{signerName}</p>
                            <p>
                                {placements.length} placement{placements.length > 1 ? 's' : ''} on page
                                {new Set(placements.map((p) => p.page)).size > 1 ? 's' : ''}{' '}
                                {[...new Set(placements.map((p) => p.page))].sort((a, b) => a - b).join(', ')}
                            </p>
                        </div>
                    </div>
                    <p>The stamp will be burned into the PDF. Your name, time, IP address and a file fingerprint will be recorded.</p>
                    {stampError && <Alert tone="error">{stampError}</Alert>}
                </div>
            </Dialog>
        </div>
    );
}

/* ---------------------------------------------------------------- */

function ToolbarButton({
    icon: Icon,
    label,
    onClick,
    disabled,
    active,
}: {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-40',
                active
                    ? 'bg-slate-100 text-slate-900 dark:bg-night-800 dark:text-night-100'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-night-400 dark:hover:bg-night-800 dark:hover:text-night-200',
            )}
        >
            <Icon className="h-4 w-4" />
        </button>
    );
}

function Divider() {
    return <span className="mx-1 hidden h-5 w-px bg-slate-200 dark:bg-night-700 sm:block" />;
}

const SKELETON_LINE_WIDTHS = ['92%', '78%', '88%', '100%', '100%', '94%', '86%', '100%', '72%', '100%', '90%', '55%', '35%'] as const;

function PageSkeleton() {
    return (
        <div className="absolute inset-0 flex flex-col bg-white" aria-hidden>
            <div className="h-8 shrink-0" />
            <div className="mx-6 h-5 w-3/5 animate-pulse rounded-sm bg-slate-200/90" />
            <div className="h-6 shrink-0" />
            <div className="flex flex-1 flex-col gap-3.5 px-6 pb-8">
                {SKELETON_LINE_WIDTHS.map((width, i) => (
                    <div key={i} className="h-2.5 animate-pulse rounded-sm bg-slate-100" style={{ width }} />
                ))}
            </div>
        </div>
    );
}

function DocumentLoadView({ progress, phase = 'download' }: { progress: number; phase?: 'download' | 'prepare' }) {
    const pct = Math.max(0, Math.min(100, progress));
    const label = phase === 'prepare' ? 'Preparing pages…' : 'Loading document…';

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-start overflow-auto bg-slate-100/80 px-4 py-8 dark:bg-night-950 sm:py-10">
            <div className="w-full max-w-[min(100%,42rem)]">
                <div
                    className="relative mx-auto flex aspect-[210/297] w-full max-h-[min(72vh,52rem)] flex-col overflow-hidden bg-white ring-1 ring-slate-200/90 dark:ring-night-700"
                    role="status"
                    aria-live="polite"
                    aria-label={`${label} ${pct}%`}
                >
                    <div className="h-10 shrink-0 border-b border-slate-100 px-7 pt-7">
                        <div className="h-4 w-[55%] animate-pulse rounded-sm bg-slate-200" />
                    </div>
                    <div className="flex flex-1 flex-col gap-3.5 px-7 py-6">
                        {SKELETON_LINE_WIDTHS.map((width, i) => (
                            <div
                                key={i}
                                className="h-2.5 animate-pulse rounded-sm bg-slate-100"
                                style={{ width, animationDelay: `${i * 40}ms` }}
                            />
                        ))}
                    </div>
                    <div className="mt-auto border-t border-slate-100 px-7 py-3">
                        <div className="h-2 w-20 animate-pulse rounded-sm bg-slate-100" />
                    </div>
                </div>

                <div className="mx-auto mt-5 w-full max-w-xs">
                    <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-night-400">
                        <span>{label}</span>
                        <span className="tabular-nums text-slate-700 dark:text-night-200">{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-night-800">
                        <div
                            className="h-full rounded-full bg-brand-600 transition-[width] duration-200 ease-out dark:bg-brand-500"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function ViewerMessage({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white ring-1 ring-slate-200 dark:bg-night-900 dark:ring-night-700">{icon}</div>
            <p className="max-w-sm text-sm font-medium text-slate-700 dark:text-night-200">{title}</p>
            {action}
        </div>
    );
}

function ThumbnailRail({
    numPages,
    current,
    pageOrder,
    editMode,
    canEdit,
    pagesDirty,
    saving,
    error,
    onSelect,
    onToggleEdit,
    onReorder,
    onDelete,
    onDuplicate,
    onInsertClick,
    onSave,
    onDiscard,
    pageAnnotations,
}: {
    numPages: number;
    current: number;
    pageOrder: number[];
    editMode: boolean;
    canEdit: boolean;
    pagesDirty: boolean;
    saving: boolean;
    error: string | null;
    onSelect: (page: number) => void;
    onToggleEdit: () => void;
    onReorder: (fromIndex: number, toIndex: number) => void;
    onDelete: (page: number) => void;
    onDuplicate: (page: number) => void;
    onInsertClick: () => void;
    onSave: () => void;
    onDiscard: () => void;
    pageAnnotations: Map<number, Annotation[]>;
}) {
    const railRef = useRef<HTMLDivElement>(null);
    const dragIndex = useRef<number | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);

    useEffect(() => {
        railRef.current?.querySelector(`[data-thumb="${current}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [current]);

    const displayPages = editMode ? pageOrder : Array.from({ length: numPages }, (_, i) => i + 1);

    return (
        <div
            ref={railRef}
            className={cn(
                'hidden shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 px-3 py-4 scrollbar-thin dark:border-night-700 dark:bg-night-900/50 md:block',
                editMode ? 'w-48' : 'w-40',
            )}
        >
            {canEdit && (
                <div className="mb-3 space-y-2">
                    <Button size="sm" variant={editMode ? 'primary' : 'secondary'} className="w-full" onClick={onToggleEdit}>
                        {editMode ? 'Done editing' : 'Edit pages'}
                    </Button>
                    {editMode && (
                        <div className="flex flex-col gap-1.5">
                            <Button size="sm" variant="subtle" icon={FilePlus2} className="w-full" onClick={onInsertClick}>
                                Insert PDF
                            </Button>
                            {pagesDirty && (
                                <>
                                    <Button size="sm" icon={Save} loading={saving} className="w-full" onClick={onSave}>
                                        Save pages
                                    </Button>
                                    <Button size="sm" variant="ghost" className="w-full" onClick={onDiscard} disabled={saving}>
                                        Discard
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                    {error && <p className="text-[11px] leading-snug text-red-600 dark:text-red-400">{error}</p>}
                    {editMode && (
                        <p className="text-[11px] leading-snug text-slate-500 dark:text-night-400">Drag to reorder. Saving clears comments and signatures.</p>
                    )}
                </div>
            )}
            <div className="space-y-4">
                {displayPages.map((page, index) => (
                    <LazyThumb
                        key={`${page}-${index}`}
                        page={page}
                        label={index + 1}
                        active={page === current}
                        notes={pageAnnotations.get(page)?.length ?? 0}
                        editMode={editMode}
                        dropTarget={dropIndex === index}
                        onClick={() => onSelect(page)}
                        onDelete={() => onDelete(page)}
                        onDuplicate={() => onDuplicate(page)}
                        onDragStart={() => {
                            dragIndex.current = index;
                        }}
                        onDragOver={() => setDropIndex(index)}
                        onDrop={() => {
                            if (dragIndex.current !== null && dragIndex.current !== index) {
                                onReorder(dragIndex.current, index);
                            }
                            dragIndex.current = null;
                            setDropIndex(null);
                        }}
                        onDragEnd={() => {
                            dragIndex.current = null;
                            setDropIndex(null);
                        }}
                        root={railRef}
                    />
                ))}
            </div>
        </div>
    );
}

function LazyThumb({
    page,
    label,
    active,
    notes,
    editMode,
    dropTarget,
    onClick,
    onDelete,
    onDuplicate,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    root,
}: {
    page: number;
    label: number;
    active: boolean;
    notes: number;
    editMode?: boolean;
    dropTarget?: boolean;
    onClick: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
    onDragStart?: () => void;
    onDragOver?: () => void;
    onDrop?: () => void;
    onDragEnd?: () => void;
    root: React.RefObject<HTMLDivElement | null>;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(page <= 6);

    useEffect(() => {
        if (shown || !ref.current) return;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setShown(true);
                    io.disconnect();
                }
            },
            { root: root.current, rootMargin: '400px' },
        );
        io.observe(ref.current);
        return () => io.disconnect();
    }, [shown, root]);

    return (
        <div
            ref={ref}
            data-thumb={page}
            draggable={editMode}
            onDragStart={(e) => {
                if (!editMode) return;
                e.dataTransfer.effectAllowed = 'move';
                onDragStart?.();
            }}
            onDragOver={(e) => {
                if (!editMode) return;
                e.preventDefault();
                onDragOver?.();
            }}
            onDrop={(e) => {
                if (!editMode) return;
                e.preventDefault();
                onDrop?.();
            }}
            onDragEnd={onDragEnd}
            className={cn('group block w-full text-center', dropTarget && 'rounded-lg ring-2 ring-brand-400')}
        >
            <button type="button" onClick={onClick} className="w-full">
                <span
                    className={cn(
                        'relative mx-auto block min-h-[140px] w-[112px] overflow-hidden rounded bg-white ring-2 transition',
                        active ? 'ring-brand-600' : 'ring-transparent group-hover:ring-slate-300 dark:group-hover:ring-night-600',
                    )}
                >
                    {shown && <Thumbnail pageNumber={page} width={112} loading={<span className="block h-[140px] animate-pulse bg-slate-100 dark:bg-night-800" />} />}
                    {notes > 0 && !editMode && (
                        <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full bg-amber-400 px-1 text-[10px] font-semibold text-amber-950">
                            {notes}
                        </span>
                    )}
                </span>
                <span className={cn('mt-1.5 block text-xs', active ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-night-400')}>{label}</span>
            </button>
            {editMode && (
                <div className="mt-1.5 flex justify-center gap-1">
                    <button
                        type="button"
                        title="Duplicate page"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDuplicate?.();
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-800 dark:text-night-400 dark:hover:bg-night-800 dark:hover:text-night-200"
                    >
                        <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        title="Delete page"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete?.();
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-night-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}

function CommentPin({ annotation, index, active, onClick }: { annotation: Annotation; index: number; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={annotation.content}
            className={cn(
                'pointer-events-auto absolute flex h-7 w-7 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none text-[11px] font-bold shadow-md ring-2 ring-white transition hover:scale-110',
                annotation.resolved ? 'bg-slate-400 text-white' : 'bg-amber-400 text-amber-950',
                active && 'scale-110 ring-brand-600',
            )}
            style={{ left: `${annotation.coordinates!.x * 100}%`, top: `${annotation.coordinates!.y * 100}%` }}
        >
            {annotation.resolved ? <Check className="h-3.5 w-3.5" /> : index}
        </button>
    );
}

function popoverPosition(x: number, y: number): React.CSSProperties {
    const style: React.CSSProperties = { top: `${y * 100}%` };
    if (x > 0.55) style.right = `${(1 - x) * 100}%`;
    else style.left = `${x * 100}%`;
    if (y > 0.7) {
        style.top = undefined;
        style.bottom = `${(1 - y) * 100 + 2}%`;
    }
    return style;
}

function AnnotationPopover({
    annotation,
    canDelete,
    onClose,
    onToggleResolve,
    onDelete,
}: {
    annotation: Annotation;
    canDelete: boolean;
    onClose: () => void;
    onToggleResolve: () => void;
    onDelete: () => void;
}) {
    const c = annotation.coordinates!;
    const anchorY = annotation.annotation_type === 'HIGHLIGHT' ? c.y + (c.h ?? 0) : c.y;
    return (
        <div
            className="pointer-events-auto absolute z-20 mt-2 w-72 animate-slide-up rounded-lg bg-white p-3 shadow-pop ring-1 ring-slate-900/10 dark:bg-night-900 dark:ring-white/10"
            style={popoverPosition(c.x, anchorY)}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="flex items-start gap-2.5">
                <Avatar name={fullName(annotation.user)} size="sm" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-night-100">{fullName(annotation.user)}</p>
                    <p className="text-xs text-slate-500 dark:text-night-400">{formatRelative(annotation.created_at)}</p>
                </div>
                <button type="button" onClick={onClose} className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-night-300" aria-label="Close">
                    <X className="h-4 w-4" />
                </button>
            </div>
            {annotation.content ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-night-200">{annotation.content}</p>
            ) : (
                <p className="mt-2 text-sm italic text-slate-400 dark:text-night-500">Highlighted area</p>
            )}
            <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-2 dark:border-night-800">
                {canDelete && (
                    <Button size="xs" variant="ghost" icon={Trash2} onClick={onDelete} className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300">
                        Delete
                    </Button>
                )}
                <Button size="xs" variant="secondary" icon={annotation.resolved ? RotateCcw : Check} onClick={onToggleResolve}>
                    {annotation.resolved ? 'Reopen' : 'Resolve'}
                </Button>
            </div>
        </div>
    );
}

function NoteStyleBar({
    color,
    size,
    bold,
    italic,
    disabled,
    onColor,
    onSize,
    onBold,
    onItalic,
    trailing,
}: {
    color: string;
    size: number;
    bold: boolean;
    italic: boolean;
    disabled?: boolean;
    onColor: (color: string) => void;
    onSize: (size: number) => void;
    onBold: () => void;
    onItalic: () => void;
    trailing?: ReactNode;
}) {
    return (
        <div className="inline-flex w-max flex-nowrap items-center gap-1 rounded-lg bg-white px-1.5 py-1 shadow-pop ring-1 ring-slate-200 dark:bg-night-900 dark:ring-night-700">
            {NOTE_COLORS.map((c) => (
                <button
                    key={c}
                    type="button"
                    disabled={disabled}
                    onClick={() => onColor(c)}
                    className={cn('h-5 w-5 shrink-0 rounded-full ring-offset-1', color === c ? 'ring-2 ring-slate-800 dark:ring-night-200' : 'ring-1 ring-slate-200 dark:ring-night-600', 'dark:ring-offset-night-900')}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                />
            ))}
            <span className="mx-0.5 h-4 w-px shrink-0 bg-slate-200 dark:bg-night-700" />
            <button
                type="button"
                disabled={disabled}
                onClick={onBold}
                className={cn('shrink-0 rounded p-1', bold ? 'bg-slate-900 text-white dark:bg-night-100 dark:text-night-900' : 'text-slate-600 hover:bg-slate-100 dark:text-night-400 dark:hover:bg-night-800')}
                aria-label="Bold"
                aria-pressed={bold}
            >
                <Bold className="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                disabled={disabled}
                onClick={onItalic}
                className={cn('shrink-0 rounded p-1', italic ? 'bg-slate-900 text-white dark:bg-night-100 dark:text-night-900' : 'text-slate-600 hover:bg-slate-100 dark:text-night-400 dark:hover:bg-night-800')}
                aria-label="Italic"
                aria-pressed={italic}
            >
                <Italic className="h-3.5 w-3.5" />
            </button>
            <span className="mx-0.5 h-4 w-px shrink-0 bg-slate-200 dark:bg-night-700" />
            <label className="flex shrink-0 items-center gap-1.5 px-0.5 text-slate-500 dark:text-night-400" title="Text size">
                <Type className="h-3.5 w-3.5 shrink-0" />
                <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(size * 100)}
                    disabled={disabled}
                    onChange={(e) => onSize(Number(e.target.value) / 100)}
                    className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-700 dark:bg-night-700"
                    aria-label="Text size"
                />
            </label>
            {trailing}
        </div>
    );
}

function TextNoteMark({
    annotation,
    pageWidth,
    pageHeight,
    active,
    canEdit,
    canDelete,
    onSelect,
    onDelete,
    onUpdate,
}: {
    annotation: Annotation;
    pageWidth: number;
    pageHeight: number;
    active: boolean;
    canEdit: boolean;
    canDelete: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onUpdate: (patch: AnnotationUpdate) => Promise<void>;
}) {
    const base = annotation.coordinates as NoteCoords;
    const [local, setLocal] = useState<NoteCoords>({
        ...base,
        size: base.size ?? heightToSize(base.h ?? sizeToLineH(NOTE_SIZE_DEFAULT)),
        bold: !!base.bold,
        italic: !!base.italic,
    });
    const [color, setColor] = useState(annotation.color || '#0F172A');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setLocal({
            ...base,
            size: base.size ?? heightToSize(base.h ?? sizeToLineH(NOTE_SIZE_DEFAULT)),
            bold: !!base.bold,
            italic: !!base.italic,
        });
        setColor(annotation.color || '#0F172A');
    }, [base.x, base.y, base.w, base.h, base.size, base.bold, base.italic, annotation.color, annotation.content]);

    const size = local.size ?? NOTE_SIZE_DEFAULT;
    const fontSize = Math.max(10, Math.min(42, sizeToLineH(size) * pageHeight * 0.75));

    const persist = async (next: NoteCoords, nextColor = color) => {
        setBusy(true);
        try {
            await onUpdate({ coordinates: next, color: nextColor });
        } finally {
            setBusy(false);
        }
    };

    const startDrag = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
        if (!canEdit) return;
        e.stopPropagation();
        e.preventDefault();
        onSelect();
        const startX = e.clientX;
        const startY = e.clientY;
        const origin = { ...local };

        const move = (ev: PointerEvent) => {
            const dx = (ev.clientX - startX) / pageWidth;
            const dy = (ev.clientY - startY) / pageHeight;
            if (mode === 'move') {
                setLocal({
                    ...origin,
                    x: clamp(origin.x + dx, 0, 1 - (origin.w ?? 0.2)),
                    y: clamp(origin.y + dy, 0, 1 - (origin.h ?? 0.03)),
                });
            } else {
                const w = clamp((origin.w ?? 0.2) + dx, 0.08, 1 - origin.x);
                const h = clamp((origin.h ?? 0.03) + dy, NOTE_SIZE_MIN_H, 1 - origin.y);
                setLocal({ ...origin, w, h, size: heightToSize(h / Math.max(annotation.content.split('\n').length, 1) / 1.25) });
            }
        };

        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            setLocal((current) => {
                void persist(current);
                return current;
            });
        };

        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const applySize = async (nextSize: number) => {
        const next = noteBox(annotation.content, local.x, local.y, {
            size: nextSize,
            bold: local.bold,
            italic: local.italic,
        });
        setLocal(next);
        await persist(next);
    };

    const applyColor = async (nextColor: string) => {
        setColor(nextColor);
        await persist(local, nextColor);
    };

    const toggleBold = async () => {
        const next = { ...local, bold: !local.bold };
        setLocal(next);
        await persist(next);
    };

    const toggleItalic = async () => {
        const next = { ...local, italic: !local.italic };
        setLocal(next);
        await persist(next);
    };

    return (
        <div
            className={cn(
                'pointer-events-auto absolute touch-none rounded-sm',
                active ? 'z-20 ring-2 ring-brand-600 ring-offset-1' : 'hover:ring-1 hover:ring-slate-300',
                canEdit && 'cursor-move',
            )}
            style={{
                left: `${local.x * 100}%`,
                top: `${local.y * 100}%`,
                width: `${(local.w ?? 0.2) * 100}%`,
                height: `${(local.h ?? sizeToLineH(NOTE_SIZE_DEFAULT)) * 100}%`,
            }}
            onPointerDown={canEdit ? startDrag('move') : undefined}
            onClick={(e) => {
                e.stopPropagation();
                onSelect();
            }}
        >
            <p
                className="h-full w-full overflow-hidden whitespace-pre leading-none tracking-tight"
                style={{
                    color,
                    fontSize,
                    fontWeight: local.bold ? 700 : 500,
                    fontStyle: local.italic ? 'italic' : 'normal',
                }}
            >
                {annotation.content}
            </p>

            {active && (
                <>
                    <div
                        className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-max"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <NoteStyleBar
                            color={color}
                            size={size}
                            bold={!!local.bold}
                            italic={!!local.italic}
                            disabled={!canEdit || busy}
                            onColor={(c) => void applyColor(c)}
                            onSize={(s) => void applySize(s)}
                            onBold={() => void toggleBold()}
                            onItalic={() => void toggleItalic()}
                            trailing={
                                canDelete ? (
                                    <button
                                        type="button"
                                        onClick={onDelete}
                                        className="shrink-0 rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-night-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                                        aria-label="Remove text"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                ) : undefined
                            }
                        />
                    </div>
                    {canEdit && (
                        <span
                            onPointerDown={startDrag('resize')}
                            className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-brand-600 shadow"
                            aria-hidden
                        />
                    )}
                </>
            )}
        </div>
    );
}

function OnPaperTextEditor({
    x,
    y,
    pageHeight,
    onCancel,
    onSubmit,
}: {
    x: number;
    y: number;
    pageHeight: number;
    onCancel: () => void;
    onSubmit: (content: string, color: string, style: { size: number; bold: boolean; italic: boolean }) => Promise<void>;
}) {
    const [text, setText] = useState('');
    const [color, setColor] = useState(NOTE_COLORS[0]);
    const [size, setSize] = useState(NOTE_SIZE_DEFAULT);
    const [bold, setBold] = useState(false);
    const [italic, setItalic] = useState(false);
    const [busy, setBusy] = useState(false);
    const fontSize = Math.max(10, Math.min(42, sizeToLineH(size) * pageHeight * 0.75));

    const submit = async () => {
        if (!text.trim()) return;
        setBusy(true);
        try {
            await onSubmit(text.trim(), color, { size, bold, italic });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="pointer-events-auto absolute z-30 min-w-[12rem] max-w-[70%]"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <textarea
                autoFocus
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type here…"
                className="w-full resize-none rounded-md border border-brand-400 bg-white/95 px-2 py-1.5 leading-tight shadow-lg outline-none ring-2 ring-brand-500/30"
                style={{
                    color,
                    fontSize,
                    fontWeight: bold ? 700 : 500,
                    fontStyle: italic ? 'italic' : 'normal',
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void submit();
                    }
                    if (e.key === 'Escape') onCancel();
                }}
            />
            <div className="mt-1.5 w-max max-w-none">
                <NoteStyleBar
                    color={color}
                    size={size}
                    bold={bold}
                    italic={italic}
                    disabled={busy}
                    onColor={setColor}
                    onSize={setSize}
                    onBold={() => setBold((v) => !v)}
                    onItalic={() => setItalic((v) => !v)}
                    trailing={
                        <>
                            <Button size="xs" variant="ghost" className="shrink-0" onClick={onCancel}>
                                Cancel
                            </Button>
                            <Button size="xs" className="shrink-0" loading={busy} disabled={!text.trim()} onClick={() => void submit()}>
                                Place
                            </Button>
                        </>
                    }
                />
            </div>
        </div>
    );
}

function DraftComposer({
    draft,
    onCancel,
    onSubmit,
}: {
    draft: Draft;
    onCancel: () => void;
    onSubmit: (content: string, color?: string) => Promise<void>;
}) {
    const [text, setText] = useState('');
    const [color, setColor] = useState(HIGHLIGHT_COLORS[0]);
    const [busy, setBusy] = useState(false);
    const isHighlight = draft.type === 'HIGHLIGHT';
    const anchorY = isHighlight ? draft.y + draft.h : draft.y;

    const submit = async () => {
        if (!isHighlight && !text.trim()) return;
        setBusy(true);
        try {
            await onSubmit(text.trim(), isHighlight ? color : undefined);
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            {isHighlight ? (
                <div
                    className="pointer-events-none absolute rounded-[2px] mix-blend-multiply"
                    style={{
                        left: `${draft.x * 100}%`,
                        top: `${draft.y * 100}%`,
                        width: `${draft.w * 100}%`,
                        height: `${draft.h * 100}%`,
                        backgroundColor: `${color}99`,
                    }}
                />
            ) : (
                <span
                    className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none bg-brand-600 text-white shadow-md ring-2 ring-white"
                    style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}
                >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                </span>
            )}
            <div
                className="pointer-events-auto absolute z-20 mt-2 w-72 animate-slide-up rounded-lg bg-white p-3 shadow-pop ring-1 ring-slate-900/10 dark:bg-night-900 dark:ring-white/10"
                style={popoverPosition(draft.x, anchorY)}
                onPointerDown={(e) => e.stopPropagation()}
            >
                {isHighlight && (
                    <div className="mb-2 flex items-center gap-1.5">
                        {HIGHLIGHT_COLORS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setColor(c)}
                                className={cn(
                                    'h-6 w-6 rounded-full ring-offset-1 dark:ring-offset-night-900',
                                    color === c ? 'ring-2 ring-slate-700 dark:ring-night-200' : 'ring-1 ring-slate-200 dark:ring-night-600',
                                )}
                                style={{ backgroundColor: c }}
                                aria-label="Highlight colour"
                            />
                        ))}
                    </div>
                )}
                <Textarea
                    autoFocus
                    rows={3}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={isHighlight ? 'Add a note (optional)' : 'Write a comment…'}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
                        if (e.key === 'Escape') onCancel();
                    }}
                />
                <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 dark:text-night-500">Ctrl + Enter to save</span>
                    <div className="flex gap-1.5">
                        <Button size="xs" variant="ghost" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button size="xs" onClick={() => void submit()} loading={busy} disabled={!isHighlight && !text.trim()}>
                            {isHighlight ? 'Save highlight' : 'Comment'}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}

function CommentsPanel({
    items,
    filter,
    onFilter,
    openCount,
    totalCount,
    activeId,
    currentUserId,
    canModerate,
    canAnnotate,
    onSelect,
    onToggleResolve,
    onDelete,
    onStartComment,
}: {
    items: Annotation[];
    filter: 'open' | 'all';
    onFilter: (f: 'open' | 'all') => void;
    openCount: number;
    totalCount: number;
    activeId: number | null;
    currentUserId: number;
    canModerate: boolean;
    canAnnotate: boolean;
    onSelect: (a: Annotation) => void;
    onToggleResolve: (id: number) => void;
    onDelete: (id: number) => void;
    onStartComment: () => void;
}) {
    return (
        <div>
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-3 py-2 dark:border-night-800 dark:bg-night-900">
                <SegmentedControl
                    className="w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:text-xs"
                    value={filter}
                    onChange={onFilter}
                    options={[
                        { value: 'open', label: `Open (${openCount})` },
                        { value: 'all', label: `All (${totalCount})` },
                    ]}
                />
            </div>
            {items.length === 0 ? (
                <EmptyState
                    compact
                    icon={MessageSquare}
                    title={filter === 'open' && totalCount > 0 ? 'All comments resolved' : 'No comments yet'}
                    description={canAnnotate ? 'Use the comment or highlight tool to mark up the document.' : undefined}
                    action={
                        canAnnotate && (
                            <Button size="sm" variant="secondary" icon={MessageSquarePlus} onClick={onStartComment}>
                                Add a comment
                            </Button>
                        )
                    }
                />
            ) : (
                <ul className="divide-y divide-slate-100 dark:divide-night-800">
                    {items.map((a) => (
                        <li
                            key={a.id}
                            id={`annotation-${a.id}`}
                            className={cn('group cursor-pointer px-4 py-3 transition', activeId === a.id ? 'bg-brand-50/60 dark:bg-brand-500/10' : 'hover:bg-slate-50 dark:hover:bg-night-800/50')}
                            onClick={() => onSelect(a)}
                        >
                            <div className="flex items-start gap-2.5">
                                <Avatar name={fullName(a.user)} size="sm" />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-semibold text-slate-900 dark:text-night-100">{fullName(a.user)}</span>
                                        <span className="shrink-0 text-xs text-slate-400 dark:text-night-500">{formatRelative(a.created_at)}</span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                        <Badge tone="gray">Page {a.page_number}</Badge>
                                        {a.annotation_type === 'HIGHLIGHT' && (
                                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-night-400">
                                                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: a.color }} /> Highlight
                                            </span>
                                        )}
                                        {a.resolved && <Badge tone="green">Resolved</Badge>}
                                    </div>
                                    {a.content && <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700 dark:text-night-200">{a.content}</p>}
                                    <div className="mt-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleResolve(a.id);
                                            }}
                                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-night-400 dark:hover:bg-night-700"
                                        >
                                            {a.resolved ? <RotateCcw className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                                            {a.resolved ? 'Reopen' : 'Resolve'}
                                        </button>
                                        {(a.user_id === currentUserId || canModerate) && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(a.id);
                                                }}
                                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                                            >
                                                <Trash2 className="h-3 w-3" /> Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function PageCommentComposer({ page, onSubmit }: { page: number; onSubmit: (content: string) => Promise<void> }) {
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        if (!text.trim()) return;
        setBusy(true);
        try {
            await onSubmit(text.trim());
            setText('');
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="shrink-0 border-t border-slate-200 p-3 dark:border-night-700">
            <Textarea
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Comment on page ${page}…`}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
                }}
            />
            <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={submit} loading={busy} disabled={!text.trim()}>
                    Post comment
                </Button>
            </div>
        </div>
    );
}

function SignaturesPanel({
    signatures,
    canSign,
    alreadySigned,
    canStamp,
    currentUserId,
    canModerate,
    onSign,
    onStamp,
    onRemove,
    onJump,
}: {
    signatures: DocumentSignatureRecord[];
    canSign: boolean;
    alreadySigned?: boolean;
    canStamp?: boolean;
    currentUserId: number;
    canModerate: boolean;
    onSign: () => void;
    onStamp?: () => void;
    onRemove?: (id: number) => void;
    onJump: (p: Placement) => void;
}) {
    return (
        <div className="p-4">
            {canSign && (
                <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50/60 p-4 dark:border-brand-500/20 dark:bg-brand-500/10">
                    <p className="text-sm font-semibold text-slate-900 dark:text-night-100">{alreadySigned ? 'You have signed this document' : 'Your signature is requested'}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-night-400">
                        {alreadySigned
                            ? 'Signing again replaces your previous signature record.'
                            : 'Draw, type or upload your signature, then place it on the page.'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" icon={PenLine} onClick={onSign}>
                            {alreadySigned ? 'Sign again' : 'Sign document'}
                        </Button>
                        {canStamp && onStamp && (
                            <Button size="sm" variant="secondary" icon={Stamp} onClick={onStamp}>
                                Apply stamp
                            </Button>
                        )}
                    </div>
                </div>
            )}
            {signatures.length === 0 ? (
                <EmptyState compact icon={PenLine} title="No signatures yet" />
            ) : (
                <ul className="space-y-3">
                    {signatures.map((s) => {
                        const isStamp = s.signature_type === 'STAMP';
                        const canRemove =
                            !!onRemove &&
                            !!s.is_current &&
                            (s.user_id === currentUserId || canModerate);
                        return (
                            <li key={s.id} className="rounded-lg border border-slate-200 p-3 dark:border-night-700">
                                <div className="flex items-center gap-2.5">
                                    <Avatar name={fullName(s.user)} size="sm" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-night-100">{fullName(s.user)}</p>
                                        <p className="text-xs text-slate-500 dark:text-night-400">{formatDateTime(s.signed_at)}</p>
                                    </div>
                                    <Badge tone="gray">{isStamp ? 'Stamp' : 'Signature'}</Badge>
                                    <BadgeCheck className="h-5 w-5 text-emerald-500" aria-label="Verified" />
                                </div>
                                {s.signature_data?.image && (
                                    <div className="mt-2.5 flex h-14 items-center justify-center rounded-md bg-slate-50">
                                        <img src={s.signature_data.image} alt="" className="max-h-12 max-w-[85%] object-contain" />
                                    </div>
                                )}
                                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-night-400">
                                    <span className="truncate font-mono" title={s.verification_certificate}>
                                        SHA-256 {s.verification_certificate?.slice(0, 16)}…
                                    </span>
                                    <div className="flex shrink-0 items-center gap-2">
                                        {s.signature_data?.placements?.[0] && (
                                            <button
                                                type="button"
                                                onClick={() => onJump(s.signature_data!.placements![0])}
                                                className="font-medium text-brand-700 hover:underline dark:text-brand-300"
                                            >
                                                View on page {s.signature_data.placements[0].page}
                                            </button>
                                        )}
                                        {canRemove && (
                                            <button
                                                type="button"
                                                onClick={() => onRemove(s.id)}
                                                className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline dark:text-red-400"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {s.user_id === currentUserId && !s.is_current && (
                                    <p className="mt-2 text-[11px] text-slate-400 dark:text-night-500">
                                        A later mark was applied after this one, so it cannot be removed directly.
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
