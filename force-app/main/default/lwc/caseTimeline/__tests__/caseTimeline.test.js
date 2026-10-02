import { createElement } from 'lwc';
import CaseTimeline from 'c/caseTimeline';
import getCaseTimeline from '@salesforce/apex/ServiceConsoleController.getCaseTimeline';
import { refreshApex } from '@salesforce/apex';

jest.mock(
    '@salesforce/apex/ServiceConsoleController.getCaseTimeline',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

jest.mock('@salesforce/apex', () => ({ refreshApex: jest.fn(() => Promise.resolve()) }), { virtual: true });

const mockTimeline = require('./data/caseTimeline.json');
const CASE_ID = '500000000000001AAA';

function render(props = {}) {
    const element = createElement('c-case-timeline', { is: CaseTimeline });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('c-case-timeline', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('shows a placeholder and no refresh button without a case', () => {
        const element = render();
        expect(element.shadowRoot.querySelector('.placeholder')).not.toBeNull();
        expect(element.shadowRoot.querySelector('.refresh-button')).toBeNull();
    });

    it('accepts caseId and recordId interchangeably', async () => {
        const fromCaseId = render({ caseId: CASE_ID });
        await flushPromises();
        expect(fromCaseId.caseId).toBe(CASE_ID);
        expect(getCaseTimeline.getLastConfig()).toEqual({ caseId: CASE_ID });

        const fromRecordId = render({ recordId: '500000000000009AAA' });
        await flushPromises();
        expect(fromRecordId.recordId).toBe('500000000000009AAA');
        expect(getCaseTimeline.getLastConfig()).toEqual({ caseId: '500000000000009AAA' });
    });

    it('renders entries in server order with icons and actors', async () => {
        const element = render({ caseId: CASE_ID });
        getCaseTimeline.emit(mockTimeline);
        await flushPromises();

        const items = element.shadowRoot.querySelectorAll('.timeline-entry');
        expect(items).toHaveLength(3);
        expect(Array.from(items).map((item) => item.dataset.type)).toEqual(['comment', 'fieldChange', 'created']);
        const icons = element.shadowRoot.querySelectorAll('lightning-icon');
        expect(icons[0].iconName).toBe('standard:quick_text');
        expect(icons[1].iconName).toBe('standard:record_update');
        expect(icons[2].iconName).toBe('standard:case');
        expect(items[0].textContent).toContain('by Test Agent');
        expect(items[2].textContent).not.toContain('by ');
        expect(element.shadowRoot.querySelector('ol').getAttribute('aria-label')).toBe('Case activity, newest first');
    });

    it('uses a default icon for unknown entry types and hides empty bodies', async () => {
        const element = render({ caseId: CASE_ID });
        getCaseTimeline.emit([{ id: 'x1', entryType: 'other', title: 'Unknown', occurredAt: null }]);
        await flushPromises();
        expect(element.shadowRoot.querySelector('lightning-icon').iconName).toBe('standard:default');
        expect(element.shadowRoot.querySelector('.entry-body')).toBeNull();
    });

    it('shows an empty state when there is no activity', async () => {
        const element = render({ caseId: CASE_ID });
        getCaseTimeline.emit([]);
        await flushPromises();
        expect(element.shadowRoot.querySelector('.empty')).not.toBeNull();
    });

    it('renders the error panel on error', async () => {
        const element = render({ caseId: CASE_ID });
        getCaseTimeline.error({ message: 'Unable to load the case timeline.' });
        await flushPromises();
        expect(element.shadowRoot.querySelector('c-error-panel')).not.toBeNull();
        expect(element.shadowRoot.querySelector('.timeline-entry')).toBeNull();
        expect(element.shadowRoot.querySelector('.empty')).toBeNull();
    });

    it('refreshes the wired result when refresh is clicked', async () => {
        const element = render({ caseId: CASE_ID });
        getCaseTimeline.emit(mockTimeline);
        await flushPromises();

        element.shadowRoot.querySelector('.refresh-button').click();
        await flushPromises();

        expect(refreshApex).toHaveBeenCalledTimes(1);
        expect(refreshApex.mock.calls[0][0].data).toEqual(mockTimeline);
        expect(element.shadowRoot.querySelector('.refresh-button').disabled).toBe(false);
    });

    it('is accessible when populated', async () => {
        const element = render({ caseId: CASE_ID });
        getCaseTimeline.emit(mockTimeline);
        await flushPromises();
        await expect(element).toBeAccessible();
    });
});
