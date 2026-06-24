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
