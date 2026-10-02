/**
 * Normalises the many error shapes an LWC can receive (Apex, UI API reads,
 * UI API DML, JavaScript errors, plain strings) into a flat, de-duplicated
 * array of human readable messages.
 *
 * @param {object|object[]|string} errors
 * @returns {string[]}
 */
export function reduceErrors(errors) {
    if (!errors) {
        return [];
    }
    const list = Array.isArray(errors) ? errors : [errors];
    const messages = list.filter(Boolean).flatMap(messagesFromError);
    return [...new Set(messages.filter(Boolean))];
}

function messagesFromError(error) {
    if (typeof error === 'string') {
        return [error];
    }
    if (error.body !== undefined && error.body !== null) {
        const fromBody = messagesFromBody(error.body);
        if (fromBody.length > 0) {
            return fromBody;
        }
    }
    if (typeof error.message === 'string') {
        return [error.message];
    }
    if (typeof error.statusText === 'string') {
        return [error.statusText];
    }
    return [];
}

function messagesFromBody(body) {
    if (Array.isArray(body)) {
        // UI API DML errors: [{ message, errorCode }]
        return body.map((item) => item && item.message);
    }
    if (typeof body === 'string') {
        return [body];
    }
    const messages = [];
    if (Array.isArray(body.pageErrors)) {
        body.pageErrors.forEach((item) => messages.push(item.message));
    }
    if (body.fieldErrors && typeof body.fieldErrors === 'object') {
        Object.values(body.fieldErrors).forEach((fieldList) => {
            fieldList.forEach((item) => messages.push(item.message));
        });
    }
    if (body.output && Array.isArray(body.output.errors)) {
        body.output.errors.forEach((item) => messages.push(item.message));
    }
    if (messages.length === 0 && typeof body.message === 'string') {
        // Apex AuraHandledException and UI API read errors
        messages.push(body.message);
    }
    return messages;
}
