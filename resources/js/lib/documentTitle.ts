/** Derive an editable document title from an uploaded file name. */
export function titleFromFileName(fileName: string): string {
    return fileName
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
