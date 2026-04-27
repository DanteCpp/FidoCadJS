/**
 * @file OperationPermissions.ts
 * @author Dante Loi
 * @date 2026-04-27
 * @brief Permission model describing which context menu operations are available
 *        for the currently selected library tree node.
 * @copyright Copyright 2026 Dante Loi - GPL v3
 *
 * Browser port of fidocadj.macropicker.OperationPermissions (Kohta Ozaki, 2014).
 */

export class OperationPermissions {
    copyAvailable: boolean = false;
    pasteAvailable: boolean = false;
    renameAvailable: boolean = false;
    removeAvailable: boolean = false;
    renKeyAvailable: boolean = false;

    disableAll(): void {
        this.copyAvailable = false;
        this.pasteAvailable = false;
        this.renameAvailable = false;
        this.removeAvailable = false;
        this.renKeyAvailable = false;
    }
}
