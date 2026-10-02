import { LightningElement, api } from 'lwc';
import { reduceErrors } from 'c/ldsUtils';

export default class ErrorPanel extends LightningElement {
    /** Short, user-facing summary shown above the details. */
    @api friendlyMessage = 'Something went wrong.';
    /** Any error shape supported by reduceErrors. */
    @api errors;

    showDetails = false;

    get messages() {
        return reduceErrors(this.errors);
    }

    get hasDetails() {
        return this.messages.length > 0;
    }

    get toggleLabel() {
        return this.showDetails ? 'Hide details' : 'Show details';
    }

    get ariaExpanded() {
        return String(this.showDetails);
    }

    handleToggle() {
        this.showDetails = !this.showDetails;
    }
}
