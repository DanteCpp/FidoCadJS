/**
 * @file LibraryListener.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief Observer interface for library state-change events.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { AddEvent } from './AddEvent.js';
import type { RemoveEvent } from './RemoveEvent.js';
import type { RenameEvent } from './RenameEvent.js';
import type { KeyChangeEvent } from './KeyChangeEvent.js';

export interface LibraryListener {
    libraryLoaded(): void;
    libraryNodeRenamed(e: RenameEvent): void;
    libraryNodeRemoved(e: RemoveEvent): void;
    libraryNodeAdded(e: AddEvent): void;
    libraryNodeKeyChanged(e: KeyChangeEvent): void;
}
