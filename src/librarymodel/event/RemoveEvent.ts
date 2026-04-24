/**
 * @file RemoveEvent.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief Event data for a library node removal.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

export class RemoveEvent {
    constructor(
        public readonly parentNode: unknown,
        public readonly removedNode: unknown,
    ) {}
}
