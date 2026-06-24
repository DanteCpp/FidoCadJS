import { getString } from './i18n.js';

export class AccessResources {
    getString(s: string): string {
        return getString(s);
    }
}
