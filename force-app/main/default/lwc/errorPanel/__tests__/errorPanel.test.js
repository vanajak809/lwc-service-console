import { createElement } from 'lwc';
import ErrorPanel from 'c/errorPanel';

function render(props = {}) {
    const element = createElement('c-error-panel', { is: ErrorPanel });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-error-panel', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('shows the default friendly message with role=alert', () => {
        const element = render();
        const alert = element.shadowRoot.querySelector('[role="alert"]');
        expect(alert).not.toBeNull();
        expect(element.shadowRoot.querySelector('.friendly-message').textContent).toBe('Something went wrong.');
        expect(element.shadowRoot.querySelector('.toggle-details')).toBeNull();
    });

    it('toggles error details and updates aria-expanded', async () => {
        const element = render({
            friendlyMessage: 'Search failed.',
            errors: { body: { message: 'Detailed reason' } }
        });
        const toggle = element.shadowRoot.querySelector('.toggle-details');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(element.shadowRoot.querySelector('.details')).toBeNull();

        toggle.click();
        await Promise.resolve();

        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(toggle.textContent).toBe('Hide details');
        const items = element.shadowRoot.querySelectorAll('.details li');
        expect(items).toHaveLength(1);
        expect(items[0].textContent).toBe('Detailed reason');
    });

    it('is accessible', async () => {
        const element = render({ errors: 'Something specific' });
        await expect(element).toBeAccessible();
    });
});
