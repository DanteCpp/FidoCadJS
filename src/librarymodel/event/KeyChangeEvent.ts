/**
 * @file KeyChangeEvent.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief Event data for a macro key change.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

export class KeyChangeEvent {
    constructor(
        public readonly parentNode: unknown,
        public readonly changedNode: unknown,
        public readonly oldKey: string,
    ) {}
}
