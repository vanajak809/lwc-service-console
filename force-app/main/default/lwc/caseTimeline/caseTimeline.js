import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getCaseTimeline from '@salesforce/apex/ServiceConsoleController.getCaseTimeline';

const ENTRY_ICONS = {
    created: 'standard:case',
    comment: 'standard:quick_text',
    fieldChange: 'standard:record_update'
};

export default class CaseTimeline extends LightningElement {
    currentCaseId;
    entries = [];
    error;
    isRefreshing = false;
    wiredResult;

    /** Case Id when used inside another component. */
    @api
    get caseId() {
        return this.currentCaseId;
    }
    set caseId(value) {
        this.currentCaseId = value;
    }

    /** Case Id when placed on a Case record page. */
    @api
    get recordId() {
        return this.currentCaseId;
    }
    set recordId(value) {
        this.currentCaseId = value;
    }

    @wire(getCaseTimeline, { caseId: '$currentCaseId' })
    wiredTimeline(result) {
        this.wiredResult = result;
        const { data, error } = result;
        if (data) {
            this.entries = data.map((entry) => ({
                ...entry,
                iconName: ENTRY_ICONS[entry.entryType] || 'standard:default',
                actorLabel: entry.actor ? `by ${entry.actor}` : ''
            }));
            this.error = undefined;
        } else if (error) {
            this.entries = [];
            this.error = error;
        }
    }

    get hasCase() {
        return Boolean(this.currentCaseId);
    }

    get hasEntries() {
        return this.entries.length > 0;
    }

    get showEmpty() {
        return this.hasCase && !this.error && this.wiredResult?.data && this.entries.length === 0;
    }

    async handleRefresh() {
        if (!this.wiredResult) {
            return;
        }
        this.isRefreshing = true;
        try {
            await refreshApex(this.wiredResult);
        } finally {
            this.isRefreshing = false;
        }
    }
}
