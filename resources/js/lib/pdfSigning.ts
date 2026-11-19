import { Placement } from '@/types/models';
import { degrees, PDFDocument } from 'pdf-lib';
import { dataUrlToBytes } from './image';

export class PdfSigningError extends Error {}

type StampDraw = { png: string; placement: Placement };

function loadPdf(source: ArrayBuffer): Promise<PDFDocument> {
    return PDFDocument.load(source, { updateMetadata: false }).catch((error: unknown) => {
        if (error instanceof Error && /encrypt/i.test(error.message)) {
            throw new PdfSigningError('This PDF is password-protected or encrypted, so it cannot be updated in the browser. Upload an unprotected copy.');
        }
        throw new PdfSigningError('This PDF could not be read. It may be damaged.');
    });
}

function drawStamp(page: ReturnType<PDFDocument['getPages']>[number], image: Awaited<ReturnType<PDFDocument['embedPng']>>, p: Placement): void {
    const crop = page.getCropBox();
    const rotation = (((page.getRotation().angle ?? 0) % 360) + 360) % 360;
    const swapped = rotation === 90 || rotation === 270;
    const displayW = swapped ? crop.height : crop.width;
    const displayH = swapped ? crop.width : crop.height;

    const dx = p.x * displayW;
    const dy = p.y * displayH;
    const w = p.w * displayW;
    const h = p.h * displayH;

    let x: number;
    let y: number;
    switch (rotation) {
        case 90:
            x = crop.x + dy + h;
            y = crop.y + dx;
            break;
        case 180:
            x = crop.x + crop.width - dx;
            y = crop.y + dy + h;
            break;
        case 270:
            x = crop.x + crop.width - dy - h;
            y = crop.y + crop.height - dx;
            break;
        default:
            x = crop.x + dx;
            y = crop.y + crop.height - dy - h;
    }

    page.drawImage(image, { x, y, width: w, height: h, rotate: degrees(rotation) });
}

/**
 * Burns PNG stamps into the PDF at each placement.
 * Placements are normalised (0–1) against the page as displayed, i.e. after /Rotate and the crop box are applied.
 */
export async function stampPdf(
    source: ArrayBuffer,
    stamps: StampDraw[],
    meta: { reason?: string } = {},
): Promise<Uint8Array> {
    const pdf = await loadPdf(source);

    if (pdf.isEncrypted) {
        throw new PdfSigningError('This PDF is encrypted, so it cannot be updated in the browser. Upload an unprotected copy.');
    }

    const pages = pdf.getPages();

    for (const stamp of stamps) {
        const page = pages[stamp.placement.page - 1];
        if (!page) {
            continue;
        }
        const image = await pdf.embedPng(dataUrlToBytes(stamp.png));
        drawStamp(page, image, stamp.placement);
    }

    pdf.setModificationDate(new Date());
    pdf.setProducer('DMS');
    if (meta.reason) {
        pdf.setSubject(meta.reason);
    }

    return pdf.save({ useObjectStreams: false });
}

/**
 * Burns a single PNG stamp into the PDF at each placement (signature flow).
 */
export async function signPdf(
    source: ArrayBuffer,
    stampPng: string,
    placements: Placement[],
    meta: { signer: string; reason?: string },
): Promise<Uint8Array> {
    return stampPdf(
        source,
        placements.map((placement) => ({ png: stampPng, placement })),
        { reason: meta.reason ?? `Signed by ${meta.signer}` },
    );
}

export async function fetchPdf(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) {
        throw new PdfSigningError(`Could not download the document (HTTP ${res.status}).`);
    }

    return res.arrayBuffer();
}
