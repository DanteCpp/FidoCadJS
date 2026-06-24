/**
 * Escape special LaTeX characters in user-supplied text.
 * Characters escaped: \ { } # $ % & _ ^ ~
 * This prevents malformed output when user labels contain characters
 * that are active in LaTeX (e.g. underscores in component names).
 */
export function escapeLatex(s: string): string {
    // Escape special LaTeX characters: \ { } # $ % & _ ^ ~
    //
    // The tricky part is that replacement strings (e.g. \textbackslash{})
    // themselves contain special chars (\, {, }). We use the standard
    // approach: replace \ with a placeholder token first, do all other
    // escaping, then replace the placeholder last.
    //
    // Sentinel: \x00 is forbidden in JavaScript strings so it cannot
    // appear in user-supplied FidoCad text (which is ASCII text lines).
    const BS = '\x00BS\x00';
    const CIRC = '\x00CIRC\x00';
    const TILDE = '\x00TILDE\x00';

    return s
        .replace(/\\/g, BS)
        .replace(/\^/g, CIRC)
        .replace(/~/g, TILDE)
        .replace(/[#$%&_]/g, (c) => '\\' + c)
        .replace(/[{}]/g, (c) => '\\' + c)
        .replace(new RegExp(BS, 'g'), '\\textbackslash{}')
        .replace(new RegExp(CIRC, 'g'), '\\textasciicircum{}')
        .replace(new RegExp(TILDE, 'g'), '\\textasciitilde{}');
}
