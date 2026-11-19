import { cn } from '@/lib/cn';
import { trimCanvas } from '@/lib/image';
import { Eraser, Undo2 } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

type Point = { x: number; y: number; p: number };
type Stroke = { color: string; points: Point[] };

export interface SignaturePadHandle {
    toDataUrl: () => string | null;
    clear: () => void;
    isEmpty: () => boolean;
}

const INK = [
    { value: '#0f172a', label: 'Black' },
    { value: '#1e3a8a', label: 'Blue' },
];

export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void; className?: string }>(
    function SignaturePad({ onChange, className }, ref) {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const strokes = useRef<Stroke[]>([]);
        const current = useRef<Stroke | null>(null);
        const [color, setColor] = useState(INK[0].value);
        const [count, setCount] = useState(0);

        const redraw = useCallback(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d')!;
            const dpr = window.devicePixelRatio || 1;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const all = current.current ? [...strokes.current, current.current] : strokes.current;
            for (const stroke of all) {
                const pts = stroke.points;
                ctx.strokeStyle = stroke.color;
                ctx.fillStyle = stroke.color;
                if (pts.length === 1) {
                    ctx.beginPath();
                    ctx.arc(pts[0].x, pts[0].y, 1.6, 0, Math.PI * 2);
                    ctx.fill();
                    continue;
                }
                for (let i = 1; i < pts.length; i++) {
                    const a = pts[i - 1];
                    const b = pts[i];
                    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                    ctx.lineWidth = 1.4 + 2.2 * (b.p || 0.5);
                    ctx.beginPath();
                    if (i === 1) ctx.moveTo(a.x, a.y);
                    else ctx.moveTo((pts[i - 2].x + a.x) / 2, (pts[i - 2].y + a.y) / 2);
                    ctx.quadraticCurveTo(a.x, a.y, mid.x, mid.y);
                    ctx.stroke();
                }
            }
        }, []);

        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const resize = () => {
                const rect = canvas.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                canvas.width = Math.round(rect.width * dpr);
                canvas.height = Math.round(rect.height * dpr);
                redraw();
            };
            resize();
            const ro = new ResizeObserver(resize);
            ro.observe(canvas);
            return () => ro.disconnect();
        }, [redraw]);

        const point = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
            return { x: e.clientX - rect.left, y: e.clientY - rect.top, p: pressure };
        };

        const update = () => {
            setCount(strokes.current.length);
            onChange?.(strokes.current.length === 0);
        };

        useImperativeHandle(ref, () => ({
            isEmpty: () => strokes.current.length === 0,
            clear: () => {
                strokes.current = [];
                redraw();
                update();
            },
            toDataUrl: () => {
                const canvas = canvasRef.current;
                if (!canvas || strokes.current.length === 0) return null;
                return trimCanvas(canvas, 6)?.toDataURL('image/png') ?? null;
            },
        }));

        return (
            <div className={cn('relative', className)}>
                <canvas
                    ref={canvasRef}
                    className="h-44 w-full touch-none rounded-lg border border-dashed border-slate-300 bg-white"
                    style={{ cursor: 'crosshair' }}
                    onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        current.current = { color, points: [point(e)] };
                        redraw();
                    }}
                    onPointerMove={(e) => {
                        if (!current.current) return;
                        const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
                        const rect = e.currentTarget.getBoundingClientRect();
                        for (const ev of events) {
                            current.current.points.push({
                                x: ev.clientX - rect.left,
                                y: ev.clientY - rect.top,
                                p: ev.pointerType === 'pen' && ev.pressure > 0 ? ev.pressure : 0.5,
                            });
                        }
                        redraw();
                    }}
                    onPointerUp={() => {
                        if (current.current) strokes.current.push(current.current);
                        current.current = null;
                        redraw();
                        update();
                    }}
                    onPointerCancel={() => {
                        current.current = null;
                        redraw();
                    }}
                />
                <div className="pointer-events-none absolute inset-x-8 bottom-10 border-b border-slate-200" />
                {count === 0 && (
                    <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-slate-400">
                        Sign here with your mouse, trackpad or finger
                    </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        {INK.map((ink) => (
                            <button
                                key={ink.value}
                                type="button"
                                onClick={() => setColor(ink.value)}
                                className={cn(
                                    'h-6 w-6 rounded-full ring-offset-2 transition',
                                    color === ink.value ? 'ring-2 ring-brand-600' : 'ring-1 ring-slate-200',
                                )}
                                style={{ backgroundColor: ink.value }}
                                aria-label={`${ink.label} ink`}
                            />
                        ))}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            disabled={count === 0}
                            onClick={() => {
                                strokes.current.pop();
                                redraw();
                                update();
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        >
                            <Undo2 className="h-3.5 w-3.5" /> Undo
                        </button>
                        <button
                            type="button"
                            disabled={count === 0}
                            onClick={() => {
                                strokes.current = [];
                                redraw();
                                update();
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        >
                            <Eraser className="h-3.5 w-3.5" /> Clear
                        </button>
                    </div>
                </div>
            </div>
        );
    },
);
