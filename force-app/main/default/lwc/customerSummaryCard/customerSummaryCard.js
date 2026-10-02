import { LightningElement, api, wire } from 'lwc';
import getCustomerSummary from '@salesforce/apex/ServiceConsoleController.getCustomerSummary';

const TIER_CLASSES = {
    Private: 'slds-badge slds-badge_inverse tier-badge',
    Premier: 'slds-badge slds-theme_success tier-badge',
    Standard: 'slds-badge tier-badge'
};

export default class CustomerSummaryCard extends LightningElement {
    /** Account Id. Set automatically on an Account record page. */
    @api recordId;

    summary;
    error;

    @wire(getCustomerSummary, { accountId: '$recordId' })
    wiredSummary({ data, error }) {
        if (data) {
            this.summary = data;
            this.error = undefined;
        } else if (error) {
            this.summary = undefined;
            this.error = error;
        }
    }

    get hasRecord() {
        return Boolean(this.recordId);
    }

    get showSummary() {
        return this.hasRecord && Boolean(this.summary) && !this.error;
    }

    get isLoading() {
        return this.hasRecord && !this.summary && !this.error;
    }

    get tierClass() {
        return TIER_CLASSES[this.summary?.memberTier] || 'slds-badge tier-badge';
    }

    get tierLabel() {
        return this.summary?.memberTier || 'Unknown tier';
    }

    get hasHighPriority() {
        return (this.summary?.highPriorityOpenCases || 0) > 0;
    }

    get highPriorityMessage() {
        const count = this.summary?.highPriorityOpenCases || 0;
        return `${count} high priority ${count === 1 ? 'case is' : 'cases are'} open for this customer.`;
    }
}
