import { beforeEach, describe, expect, it } from 'vitest';
import { UserLibraryStorage } from '../../src/librarymodel/UserLibraryStorage.js';

describe('UserLibraryStorage backups', () => {
    beforeEach(() => localStorage.clear());

    it('round-trips every browser-stored user library', () => {
        localStorage.setItem('fidocadts.libs.v1', JSON.stringify(['analog', 'digital']));
        localStorage.setItem('fidocadts.lib.v1.analog', '[FIDOLIB Analog]\n');
        localStorage.setItem('fidocadts.lib.v1.digital', '[FIDOLIB Digital]\n');

        const backup = UserLibraryStorage.createBackup();

        expect(UserLibraryStorage.parseBackup(backup)).toEqual([
            { prefix: 'analog', content: '[FIDOLIB Analog]\n' },
            { prefix: 'digital', content: '[FIDOLIB Digital]\n' },
        ]);
    });

    it('rejects unrelated or malformed JSON files', () => {
        expect(() => UserLibraryStorage.parseBackup('{}')).toThrow('Invalid library backup');
        expect(() =>
            UserLibraryStorage.parseBackup(
                JSON.stringify({
                    format: 'fidocadjs-user-libraries',
                    version: 1,
                    libraries: [{ prefix: '', content: 'invalid' }],
                }),
            ),
        ).toThrow('Invalid library backup');
    });
});
