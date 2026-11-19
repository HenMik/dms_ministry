import { PDFDocument } from 'pdf-lib';
import { PdfSigningError } from './pdfSigning';

async function loadPdf(source: ArrayBuffer): Promise<PDFDocument> {
    return PDFDocument.load(source, { updateMetadata: false }).catch((error: unknown) => {
        if (error instanceof Error && /encrypt/i.test(error.message)) {
            throw new PdfSigningError('This PDF is password-protected or encrypted, so it cannot be updated in the browser. Upload an unprotected copy.');
        }
        throw new PdfSigningError('This PDF could not be read. It may be damaged.');
    });
}

function assertEditable(pdf: PDFDocument): void {
    if (pdf.isEncrypted) {
        throw new PdfSigningError('This PDF is encrypted, so it cannot be updated in the browser. Upload an unprotected copy.');
    }
}

/** Rebuild the PDF with pages in the given 1-based order (may include duplicates). */
export async function rebuildPages(source: ArrayBuffer, order: number[]): Promise<Uint8Array> {
    if (order.length === 0) {
        throw new PdfSigningError('A document must keep at least one page.');
    }

    const src = await loadPdf(source);
    assertEditable(src);
    const pageCount = src.getPageCount();

    for (const page of order) {
        if (page < 1 || page > pageCount) {
            throw new PdfSigningError(`Page ${page} is out of range.`);
        }
    }

    const out = await PDFDocument.create();
    const copied = await out.copyPages(
        src,
        order.map((page) => page - 1),
    );
    copied.forEach((page) => out.addPage(page));
    out.setModificationDate(new Date());
    out.setProducer('DMS');

    return out.save({ useObjectStreams: false });
}

export async function deletePages(source: ArrayBuffer, pageNumbers: number[]): Promise<Uint8Array> {
    const src = await loadPdf(source);
    assertEditable(src);
    const remove = new Set(pageNumbers);
    const order = Array.from({ length: src.getPageCount() }, (_, i) => i + 1).filter((page) => !remove.has(page));

    return rebuildPages(source, order);
}

export async function duplicatePage(source: ArrayBuffer, page: number, insertAfter = true): Promise<Uint8Array> {
    const src = await loadPdf(source);
    assertEditable(src);
    const order = Array.from({ length: src.getPageCount() }, (_, i) => i + 1);
    const index = order.indexOf(page);
    if (index < 0) {
        throw new PdfSigningError(`Page ${page} is out of range.`);
    }
    order.splice(insertAfter ? index + 1 : index, 0, page);

    return rebuildPages(source, order);
}

/** Insert all pages from `incoming` into `base` at a 0-based index (append when index >= pageCount). */
export async function mergePdf(base: ArrayBuffer, incoming: ArrayBuffer, insertAtIndex: number): Promise<Uint8Array> {
    const baseDoc = await loadPdf(base);
    const incomingDoc = await loadPdf(incoming);
    assertEditable(baseDoc);
    assertEditable(incomingDoc);

    const out = await PDFDocument.create();
    const baseCount = baseDoc.getPageCount();
    const at = Math.max(0, Math.min(insertAtIndex, baseCount));

    const before = await out.copyPages(
        baseDoc,
        Array.from({ length: at }, (_, i) => i),
    );
    before.forEach((page) => out.addPage(page));

    const inserted = await out.copyPages(
        incomingDoc,
        Array.from({ length: incomingDoc.getPageCount() }, (_, i) => i),
    );
    inserted.forEach((page) => out.addPage(page));

    const after = await out.copyPages(
        baseDoc,
        Array.from({ length: baseCount - at }, (_, i) => at + i),
    );
    after.forEach((page) => out.addPage(page));

    out.setModificationDate(new Date());
    out.setProducer('DMS');

    return out.save({ useObjectStreams: false });
}
