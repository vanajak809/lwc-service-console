import { createElement } from 'lwc';
import CustomerSummaryCard from 'c/customerSummaryCard';
import getCustomerSummary from '@salesforce/apex/ServiceConsoleController.getCustomerSummary';

jest.mock(
    '@salesforce/apex/ServiceConsoleController.getCustomerSummary',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

const mockSummary = require('./data/customerSummary.json');

function render(recordId) {
    const element = createElement('c-customer-summary-card', { is: CustomerSummaryCard });
    element.recordId = recordId;
    document.body.appendChild(element);
    return element;
}

const flushPromises = () => Promise.resolve();

describe('c-customer-summary-card', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('shows a placeholder when no account is selected', () => {
        const element = render(undefined);
        expect(element.shadowRoot.querySelector('.placeholder')).not.toBeNull();
        expect(element.shadowRoot.querySelector('lightning-spinner')).toBeNull();
    });

    it('passes the record id to the wire and shows a spinner while loading', async () => {
        const element = render(mockSummary.accountId);
        await flushPromises();
        expect(getCustomerSummary.getLastConfig()).toEqual({ accountId: mockSummary.accountId });
        expect(element.shadowRoot.querySelector('lightning-spinner')).not.toBeNull();
    });

    it('renders the customer summary', async () => {
        const element = render(mockSummary.accountId);
        getCustomerSummary.emit(mockSummary);
        await flushPromises();

        const root = element.shadowRoot;
        expect(root.querySelector('.customer-name').textContent).toBe('Synthetic Harbor Member');
        expect(root.querySelector('.tier-badge').textContent).toBe('Premier');
        expect(root.querySelector('.tier-badge').classList).toContain('slds-theme_success');
        expect(root.querySelector('.open-cases').textContent).toBe('2');
        expect(root.querySelector('.closed-cases').textContent).toBe('4');
        expect(root.querySelector('lightning-formatted-date-time').value).toBe('2019-04-01');
        expect(root.querySelector('.high-priority').textContent.trim()).toBe(
            '1 high priority case is open for this customer.'
        );
        expect(root.querySelector('lightning-spinner')).toBeNull();
    });

    it('handles missing tier, member date and no high priority cases', async () => {
        const element = render(mockSummary.accountId);
        getCustomerSummary.emit({
            ...mockSummary,
            memberTier: null,
            memberSince: null,
            highPriorityOpenCases: 0
        });
        await flushPromises();

        const root = element.shadowRoot;
        expect(root.querySelector('.tier-badge').textContent).toBe('Unknown tier');
        expect(root.querySelector('.member-since').textContent).toBe('Not recorded');
        expect(root.querySelector('.high-priority')).toBeNull();
    });

    it('pluralises the high priority message', async () => {
        const element = render(mockSummary.accountId);
        getCustomerSummary.emit({ ...mockSummary, highPriorityOpenCases: 3 });
        await flushPromises();
        expect(element.shadowRoot.querySelector('.high-priority').textContent.trim()).toBe(
            '3 high priority cases are open for this customer.'
        );
    });

    it('renders the error panel on error', async () => {
        const element = render(mockSummary.accountId);
        getCustomerSummary.error({ message: 'Unable to load the customer summary.' });
        await flushPromises();

        const panel = element.shadowRoot.querySelector('c-error-panel');
        expect(panel).not.toBeNull();
        expect(panel.friendlyMessage).toBe('The customer summary could not be loaded.');
        expect(element.shadowRoot.querySelector('.customer-name')).toBeNull();
    });

    it('is accessible when populated', async () => {
        const element = render(mockSummary.accountId);
        getCustomerSummary.emit(mockSummary);
        await flushPromises();
        await expect(element).toBeAccessible();
    });
});
