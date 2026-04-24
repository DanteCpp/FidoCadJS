/**
 * @file AccessResources.ts
 * @author Dante Loi
 * @date 2026-04-24
 * @brief Thin wrapper around loaded locale bundles, mirroring Java's AccessResources.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import { getString } from './i18n.js';

export class AccessResources {
    getString(s: string): string {
        return getString(s);
    }
}
