import { createElement } from 'lwc';
import ServiceConsole from 'c/serviceConsole';

jest.mock(
    '@salesforce/apex/ServiceConsoleController.searchCases',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);
jest.mock(
    '@salesforce/apex/ServiceConsoleController.getCustomerSummary',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);
jest.mock(
    '@salesforce/apex/ServiceConsoleController.getCaseTimeline',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

describe('c-service-console', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('passes the selected case and account to the child components', async () => {
        const element = createElement('c-service-console', { is: ServiceConsole });
        document.body.appendChild(element);

        const search = element.shadowRoot.querySelector('c-case-search');
        search.dispatchEvent(
            new CustomEvent('caseselect', {
                detail: { caseId: '500000000000001AAA', accountId: '001000000000001AAA' }
            })
        );
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('c-customer-summary-card').recordId).toBe('001000000000001AAA');
        expect(element.shadowRoot.querySelector('c-case-timeline').caseId).toBe('500000000000001AAA');
    });

    it('clears the account when the selected case has no customer', async () => {
        const element = createElement('c-service-console', { is: ServiceConsole });
        document.body.appendChild(element);

        element.shadowRoot
            .querySelector('c-case-search')
            .dispatchEvent(
                new CustomEvent('caseselect', { detail: { caseId: '500000000000003AAA', accountId: null } })
            );
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('c-customer-summary-card').recordId).toBeUndefined();
        expect(element.shadowRoot.querySelector('c-case-timeline').caseId).toBe('500000000000003AAA');
    });
});
