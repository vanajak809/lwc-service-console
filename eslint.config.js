const { defineConfig } = require('eslint/config');
const lwcConfig = require('@salesforce/eslint-config-lwc');
const globals = require('globals');

module.exports = defineConfig([
    {
        ignores: ['**/node_modules/**', 'coverage/**', '.sfdx/**', '.sf/**']
    },
    {
        files: ['**/lwc/**/*.js'],
        extends: [lwcConfig.configs.recommended]
    },
    {
        files: ['**/lwc/**/__tests__/**/*.js'],
        rules: {
            '@lwc/lwc/no-unexpected-wire-adapter-usages': 'off',
            '@lwc/lwc/no-async-operation': 'off'
        },
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest
            }
        }
    }
]);
