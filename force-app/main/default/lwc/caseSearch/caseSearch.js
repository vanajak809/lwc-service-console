import { LightningElement, api, wire } from 'lwc';
import searchCases from '@salesforce/apex/ServiceConsoleController.searchCases';

const DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 2;

const PRIORITY_CLASSES = {
    High: 'slds-badge slds-theme_error',
    Medium: 'slds-badge slds-theme_warning',
    Low: 'slds-badge'
};

export default class CaseSearch extends LightningElement {
    /** Maximum number of rows to request (server clamps to 50). */
    @api limitSize = 25;

    inputValue = '';
    searchTerm;
    cases = [];
    error;
    isLoading = false;
    debounceTimer;

    @wire(searchCases, { searchTerm: '$searchTerm', limitSize: '$limitSize' })
    wiredCases({ data, error }) {
        if (data) {
            this.cases = data.map((item) => ({
                ...item,
                ariaLabel: `Open case ${item.caseNumber}: ${item.subject || 'No subject'}`,
                priorityClass: PRIORITY_CLASSES[item.priority] || 'slds-badge',
                accountLabel: item.accountName || 'No customer'
            }));
            this.error = undefined;
            this.isLoading = false;
        } else if (error) {
            this.cases = [];
            this.error = error;
            this.isLoading = false;
        }
    }

    disconnectedCallback() {
        clearTimeout(this.debounceTimer);
    }

    handleSearchInput(event) {
        const value = event.target.value || '';
        this.inputValue = value;
        clearTimeout(this.debounceTimer);
        // Debounce so the server is not called on every keystroke.
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.debounceTimer = setTimeout(() => this.applySearchTerm(value), DEBOUNCE_MS);
    }

    applySearchTerm(value) {
        const term = value.trim();
        if (term.length < MIN_SEARCH_LENGTH) {
            this.searchTerm = undefined;
            this.cases = [];
            this.error = undefined;
            this.isLoading = false;
            return;
        }
        if (term !== this.searchTerm) {
            this.isLoading = true;
            this.searchTerm = term;
        }
    }

    handleSelect(event) {
        const { caseId, accountId } = event.currentTarget.dataset;
        this.dispatchEvent(
            new CustomEvent('caseselect', {
                detail: { caseId, accountId: accountId || null }
            })
        );
    }

    get hasResults() {
        return this.cases.length > 0;
    }

    get showHint() {
        const length = this.inputValue.trim().length;
        return length > 0 && length < MIN_SEARCH_LENGTH;
    }

    get showNoResults() {
        return Boolean(this.searchTerm) && !this.isLoading && !this.error && this.cases.length === 0;
    }

    get resultsSummary() {
        if (!this.searchTerm || this.isLoading) {
            return '';
        }
        const count = this.cases.length;
        return `${count} ${count === 1 ? 'case' : 'cases'} found`;
    }
}
