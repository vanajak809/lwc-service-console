import { LightningElement } from 'lwc';

export default class ServiceConsole extends LightningElement {
    selectedCaseId;
    selectedAccountId;

    handleCaseSelect(event) {
        this.selectedCaseId = event.detail.caseId;
        this.selectedAccountId = event.detail.accountId || undefined;
    }
}
