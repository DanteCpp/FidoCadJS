/**
 * @file LibraryListenerAdapter.ts
 * @author Dante Loi
 * @date 2026-04-23
 * @brief Default no-op adapter for LibraryListener.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 */

import type { LibraryListener } from './LibraryListener.js';
import type { AddEvent } from './AddEvent.js';
import type { RemoveEvent } from './RemoveEvent.js';
import type { RenameEvent } from './RenameEvent.js';
import type { KeyChangeEvent } from './KeyChangeEvent.js';

export class LibraryListenerAdapter implements LibraryListener {
    libraryLoaded(): void {}
    libraryNodeRenamed(_e: RenameEvent): void {}
    libraryNodeRemoved(_e: RemoveEvent): void {}
    libraryNodeAdded(_e: AddEvent): void {}
    libraryNodeKeyChanged(_e: KeyChangeEvent): void {}
}
