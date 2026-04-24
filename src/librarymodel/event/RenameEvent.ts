/**
 * @file RenameEvent.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief Event data for a library node rename.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

export class RenameEvent {
    constructor(
        public readonly parentNode: unknown,
        public readonly renamedNode: unknown,
        public readonly oldName: string,
    ) {}
}
