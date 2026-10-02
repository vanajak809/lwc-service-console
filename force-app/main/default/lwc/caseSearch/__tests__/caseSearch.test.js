import { createElement } from 'lwc';
import CaseSearch from 'c/caseSearch';
import searchCases from '@salesforce/apex/ServiceConsoleController.searchCases';

jest.mock(
    '@salesforce/apex/ServiceConsoleController.searchCases',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

const mockCases = require('./data/searchCases.json');

function flushPromises() {
    return Promise.resolve();
}

function render() {
    const element = createElement('c-case-search', { is: CaseSearch });
    document.body.appendChild(element);
    return element;
}

function typeSearch(element, value) {
    const input = element.shadowRoot.querySelector('lightning-input');
    input.value = value;
    input.dispatchEvent(new CustomEvent('change'));
}

describe('c-case-search', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it('renders a labelled search input', () => {
        const element = render();
        const input = element.shadowRoot.querySelector('lightning-input');
        expect(input.label).toBe('Search cases');
        expect(input.type).toBe('search');
    });

    it('debounces input before updating the wire search term', async () => {
        const element = render();
        typeSearch(element, 'ca');
        typeSearch(element, 'card');

        jest.advanceTimersByTime(299);
        await flushPromises();
        expect(searchCases.getLastConfig().searchTerm).toBeUndefined();

        jest.advanceTimersByTime(1);
        await flushPromises();
        expect(searchCases.getLastConfig()).toEqual({ searchTerm: 'card', limitSize: 25 });
        expect(element.shadowRoot.querySelector('lightning-spinner')).not.toBeNull();
    });

    it('shows a hint and does not search for terms shorter than 2 characters', async () => {
        const element = render();
        typeSearch(element, 'c');
        jest.runAllTimers();
        await flushPromises();

        expect(element.shadowRoot.querySelector('.hint')).not.toBeNull();
        expect(searchCases.getLastConfig().searchTerm).toBeUndefined();
    });

    it('renders results with accessible labels and priority badges', async () => {
        const element = render();
        typeSearch(element, 'synthetic');
        jest.runAllTimers();
        await flushPromises();

        searchCases.emit(mockCases);
        await flushPromises();

        const buttons = element.shadowRoot.querySelectorAll('.result-button');
        expect(buttons).toHaveLength(mockCases.length);
        expect(buttons[0].getAttribute('aria-label')).toBe(
            `Open case ${mockCases[0].caseNumber}: ${mockCases[0].subject}`
        );
        expect(element.shadowRoot.querySelector('.slds-theme_error').textContent).toBe('High');
        expect(element.shadowRoot.querySelector('.results-summary').textContent).toBe('3 cases found');
        expect(element.shadowRoot.querySelector('lightning-spinner')).toBeNull();
        // Third record has no account and no subject
        expect(buttons[2].getAttribute('aria-label')).toBe(`Open case ${mockCases[2].caseNumber}: No subject`);
        expect(buttons[2].querySelector('.account').textContent).toBe('No customer');
    });

    it('dispatches caseselect with case and account ids', async () => {
        const element = render();
        const handler = jest.fn();
        element.addEventListener('caseselect', handler);
        typeSearch(element, 'synthetic');
        jest.runAllTimers();
        await flushPromises();
        searchCases.emit(mockCases);
        await flushPromises();

        element.shadowRoot.querySelectorAll('.result-button')[0].click();
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail).toEqual({
            caseId: mockCases[0].id,
            accountId: mockCases[0].accountId
        });

        element.shadowRoot.querySelectorAll('.result-button')[2].click();
        expect(handler.mock.calls[1][0].detail.accountId).toBeNull();
    });

    it('shows the empty state when nothing matches', async () => {
        const element = render();
        typeSearch(element, 'nothing');
        jest.runAllTimers();
        await flushPromises();
        searchCases.emit([]);
        await flushPromises();

        expect(element.shadowRoot.querySelector('.no-results')).not.toBeNull();
        expect(element.shadowRoot.querySelector('.results-summary').textContent).toBe('0 cases found');
    });

    it('renders the error panel when the wire errors', async () => {
        const element = render();
        typeSearch(element, 'synthetic');
        jest.runAllTimers();
        await flushPromises();
        searchCases.error({ message: 'Unable to search cases.' });
        await flushPromises();

        const panel = element.shadowRoot.querySelector('c-error-panel');
        expect(panel).not.toBeNull();
        expect(panel.errors.body.message).toBe('Unable to search cases.');
        expect(element.shadowRoot.querySelector('.no-results')).toBeNull();
    });

    it('clears results when the term becomes too short again', async () => {
        const element = render();
        typeSearch(element, 'synthetic');
        jest.runAllTimers();
        await flushPromises();
        searchCases.emit(mockCases);
        await flushPromises();

        typeSearch(element, 's');
        jest.runAllTimers();
        await flushPromises();
        expect(element.shadowRoot.querySelectorAll('.result-button')).toHaveLength(0);
        expect(element.shadowRoot.querySelector('.results-summary').textContent).toBe('');
    });

    it('does not show a spinner when the same term is submitted again', async () => {
        const element = render();
        typeSearch(element, 'synthetic');
        jest.runAllTimers();
        await flushPromises();
        searchCases.emit([mockCases[0]]);
        await flushPromises();

        typeSearch(element, 'synthetic ');
        jest.runAllTimers();
        await flushPromises();
        expect(element.shadowRoot.querySelector('lightning-spinner')).toBeNull();
        expect(element.shadowRoot.querySelector('.results-summary').textContent).toBe('1 case found');
    });

    it('clears a pending debounce timer when removed from the DOM', () => {
        const element = render();
        typeSearch(element, 'synthetic');
        document.body.removeChild(element);
        jest.runAllTimers();
        expect(searchCases.getLastConfig().searchTerm).toBeUndefined();
    });

    it('is accessible with results', async () => {
        jest.useRealTimers();
        const element = render();
        await expect(element).toBeAccessible();
    });
});
