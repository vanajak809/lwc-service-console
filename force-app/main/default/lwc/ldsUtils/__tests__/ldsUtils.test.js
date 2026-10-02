import { reduceErrors } from 'c/ldsUtils';

describe('c-lds-utils reduceErrors', () => {
    it('returns an empty array for empty input', () => {
        expect(reduceErrors(undefined)).toEqual([]);
        expect(reduceErrors(null)).toEqual([]);
        expect(reduceErrors([])).toEqual([]);
    });

    it('handles plain strings', () => {
        expect(reduceErrors('Plain failure')).toEqual(['Plain failure']);
    });

    it('handles Apex / AuraHandledException errors', () => {
        const error = { body: { message: 'Unable to search cases.' }, status: 500 };
        expect(reduceErrors(error)).toEqual(['Unable to search cases.']);
    });

    it('handles UI API DML array bodies', () => {
        const error = { body: [{ message: 'First' }, { message: 'Second' }] };
        expect(reduceErrors(error)).toEqual(['First', 'Second']);
    });

    it('handles page and field errors', () => {
        const error = {
            body: {
                pageErrors: [{ message: 'Page level' }],
                fieldErrors: { Subject: [{ message: 'Subject is required' }] }
            }
        };
        expect(reduceErrors(error)).toEqual(['Page level', 'Subject is required']);
    });

    it('handles output.errors from record forms', () => {
        const error = { body: { output: { errors: [{ message: 'Output error' }] } } };
        expect(reduceErrors(error)).toEqual(['Output error']);
    });

    it('handles string bodies, JS errors and statusText', () => {
        expect(reduceErrors({ body: 'Raw body' })).toEqual(['Raw body']);
        expect(reduceErrors(new TypeError('Broken'))).toEqual(['Broken']);
        expect(reduceErrors({ statusText: 'Service Unavailable' })).toEqual(['Service Unavailable']);
    });

    it('falls back from an empty body to the error message', () => {
        expect(reduceErrors({ body: {}, message: 'Fallback' })).toEqual(['Fallback']);
    });

    it('drops unknown shapes and de-duplicates messages', () => {
        expect(reduceErrors([{ foo: 'bar' }, 'Same', 'Same', null])).toEqual(['Same']);
    });
});
