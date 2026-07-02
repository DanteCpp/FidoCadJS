/**
 * Trigger a browser download of the given blob with the given filename.
 *
 * The anchor must be attached to the document for the programmatic click to
 * work in Firefox, and the object URL must outlive the click: Safari resolves
 * blob URLs asynchronously after the download starts, so revoking the URL
 * synchronously aborts the download there ("WebKitBlobResource error 1").
 */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
