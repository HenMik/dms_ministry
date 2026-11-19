export function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not load image'));
        img.src = src;
    });
}

/** Crops transparent margins off a canvas, keeping a small padding. Returns null for an empty canvas. */
export function trimCanvas(source: HTMLCanvasElement, padding = 8): HTMLCanvasElement | null {
    const ctx = source.getContext('2d');
    if (!ctx) return null;
    const { width, height } = source;
    const { data } = ctx.getImageData(0, 0, width, height);

    let top = height, left = width, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 10) {
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
            }
        }
    }
    if (right < 0) return null;

    left = Math.max(0, left - padding);
    top = Math.max(0, top - padding);
    right = Math.min(width - 1, right + padding);
    bottom = Math.min(height - 1, bottom + padding);

    const out = document.createElement('canvas');
    out.width = right - left + 1;
    out.height = bottom - top + 1;
    out.getContext('2d')!.drawImage(source, left, top, out.width, out.height, 0, 0, out.width, out.height);
    return out;
}

/** Makes light background pixels transparent so a photographed signature sits cleanly on the page. */
export async function removeBackground(src: string, maxSize = 1200): Promise<string> {
    const img = await loadImage(src);
    const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;

    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const mean = sum / (d.length / 4);
    const threshold = Math.min(235, mean - 25);

    for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (lum >= threshold) {
            d[i + 3] = 0;
        } else {
            const edge = threshold - lum;
            d[i + 3] = edge < 40 ? Math.round((edge / 40) * 255) : 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);

    return (trimCanvas(canvas) ?? canvas).toDataURL('image/png');
}

export async function normalizeSignature(dataUrl: string): Promise<string> {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return (trimCanvas(canvas, 4) ?? canvas).toDataURL('image/png');
}

/** Renders plain text into a transparent PNG for burning onto a PDF page. */
export function composeTextStamp(
    text: string,
    options?: { fontSize?: number; color?: string; bold?: boolean; italic?: boolean },
): { dataUrl: string; aspect: number } {
    const lines = text.split('\n').map((line) => line.trimEnd());
    const content = lines.length ? lines : [' '];
    const fontSize = options?.fontSize ?? 36;
    const color = options?.color ?? '#0f172a';
    const weight = options?.bold ? 700 : 500;
    const style = options?.italic ? 'italic' : 'normal';
    const font = `${style} ${weight} ${fontSize}px Inter, system-ui, sans-serif`;
    const lineGap = Math.round(fontSize * 0.28);
    const padX = 8;
    const padY = 6;

    const measure = document.createElement('canvas').getContext('2d')!;
    measure.font = font;
    const textWidth = Math.max(...content.map((line) => measure.measureText(line || ' ').width));
    const width = Math.ceil(Math.max(textWidth + padX * 2, 8));
    const height = Math.ceil(Math.max(content.length * fontSize + (content.length - 1) * lineGap + padY * 2, 8));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    content.forEach((line, index) => {
        ctx.fillText(line, padX, padY + index * (fontSize + lineGap));
    });

    return { dataUrl: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height };
}

/** Renders the signature with an optional "Signed by … · date" caption into a single PNG. */
export async function composeSignatureStamp(signature: string, caption: string | null): Promise<{ dataUrl: string; aspect: number }> {
    const img = await loadImage(signature);
    const targetWidth = 600;
    const scale = targetWidth / img.width;
    const sigHeight = Math.max(1, Math.round(img.height * scale));

    if (!caption) {
        const c = document.createElement('canvas');
        c.width = targetWidth;
        c.height = sigHeight;
        c.getContext('2d')!.drawImage(img, 0, 0, targetWidth, sigHeight);
        return { dataUrl: c.toDataURL('image/png'), aspect: targetWidth / sigHeight };
    }

    const fontSize = 22;
    const captionHeight = fontSize * 2 + 14;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = sigHeight + captionHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, targetWidth, sigHeight);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, sigHeight + 4);
    ctx.lineTo(targetWidth, sigHeight + 4);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    const [line1, line2] = caption.split('\n');
    ctx.fillText(fitText(ctx, line1 ?? '', targetWidth), 0, sigHeight + 12);
    if (line2) {
        ctx.font = `400 ${fontSize - 2}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#64748b';
        ctx.fillText(fitText(ctx, line2, targetWidth), 0, sigHeight + 14 + fontSize);
    }

    return { dataUrl: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height };
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t + '…';
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
    const base64 = dataUrl.split(',')[1] ?? '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}
