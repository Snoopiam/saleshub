/**
 * Templates Module
 * Template switching and CSS loading
 */

import { getById, toast } from '../utils/helpers.js';
import { getSettings, saveSettings } from './storage.js';

// Available templates
const templates = {
    landscape: {
        name: 'Landscape',
        description: 'A4 landscape format (default)',
        cssFile: 'css/templates/landscape.css',
        pageClass: 'template-landscape'
    },
    portrait: {
        name: 'Portrait',
        description: 'A4 portrait format',
        cssFile: 'css/templates/portrait.css',
        pageClass: 'template-portrait'
    },
    minimal: {
        name: 'Minimal',
        description: 'Clean minimal design',
        cssFile: 'css/templates/minimal.css',
        pageClass: 'template-minimal'
    }
};

let currentTemplate = 'landscape';

/**
 * Initialize templates module
 */
export function initTemplates() {
    const settings = getSettings();
    currentTemplate = settings.currentTemplate || 'landscape';

    // Set up template selector
    const selector = getById('templateSelect');
    if (selector) {
        selector.value = currentTemplate;
        selector.addEventListener('change', (e) => {
            switchTemplate(e.target.value);
        });
    }

    // Apply initial template
    applyTemplate(currentTemplate);
}

/**
 * Switch to a different template
 * @param {string} templateId - Template ID
 */
export function switchTemplate(templateId) {
    if (!templates[templateId]) {
        toast('Template not found', 'error');
        return;
    }

    currentTemplate = templateId;
    applyTemplate(templateId);

    // Save preference
    saveSettings({ currentTemplate: templateId });
    toast(`Switched to ${templates[templateId].name} template`, 'success');
}

/**
 * Apply template CSS and classes
 * @param {string} templateId - Template ID
 */
function applyTemplate(templateId) {
    const template = templates[templateId];
    if (!template) return;

    // Update stylesheet link
    const styleLink = getById('templateStylesheet');
    if (styleLink) {
        styleLink.href = template.cssFile;
    }

    // Update page class
    const page = getById('a4Page');
    if (page) {
        // Remove all template classes
        Object.values(templates).forEach(t => {
            page.classList.remove(t.pageClass);
        });
        // Add new template class
        page.classList.add(template.pageClass);
    }
}

/**
 * Get current template ID
 * @returns {string} Current template ID
 */
export function getCurrentTemplate() {
    return currentTemplate;
}

/**
 * Get all available templates
 * @returns {Object} Templates object
 */
export function getAvailableTemplates() {
    return templates;
}
