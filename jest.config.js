const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    modulePathIgnorePatterns: ['<rootDir>/.localdevserver'],
    setupFilesAfterEnv: [...(jestConfig.setupFilesAfterEnv || []), '<rootDir>/jest-setup/sa11y.js'],
    collectCoverageFrom: ['**/lwc/**/*.js', '!**/__tests__/**', '!**/node_modules/**'],
    coverageThreshold: {
        global: {
            branches: 85,
            functions: 90,
            lines: 90,
            statements: 90
        }
    }
};
