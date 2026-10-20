const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const libphonenumber = require(path.join(root, 'vendor/libphonenumber-max-1.13.15.js'));

function setup(value, country = 'PA') {
    const fields = {
        clientPhone: { value, setAttribute() {}, removeAttribute() {} },
        clientPhoneCountry: { value: country },
        clientPhoneHelp: { textContent: '' }
    };
    const context = vm.createContext({ libphonenumber, Intl, document: { getElementById: id => fields[id] } });
    vm.runInContext(readFileSync(path.join(root, 'phone-country.js'), 'utf8'), context);
    return { fields, context };
}

test('international prefixes identify country and preserve the complete recipient', () => {
    for (const [input, country, expected] of [
        ['+57 3001234567', 'CO', '+573001234567'],
        ['00506 88881234', 'CR', '+50688881234'],
        ['+34 612345678', 'ES', '+34612345678'],
        ['+1 2025550123', 'US', '+12025550123'],
        ['573001234567', 'CO', '+573001234567']
    ]) {
        const { fields, context } = setup(input);
        vm.runInContext('suggestPhoneCountry(true)', context);
        assert.equal(fields.clientPhoneCountry.value, country);
        assert.equal(vm.runInContext('clientPhoneValue()', context), expected);
    }
});

test('national numbers use the selected country and default to Panama', () => {
    for (const [input, country, expected] of [
        ['60001234', 'PA', '+50760001234'],
        ['612345678', 'ES', '+34612345678']
    ]) {
        const { context } = setup(input, country);
        assert.equal(vm.runInContext('clientPhoneValue()', context), expected);
    }
});

test('incomplete or malformed numbers are not stored as WhatsApp recipients', () => {
    for (const input of ['+', '00', '123', '+507600012345', 'abc60001234', '123+4567890']) {
        const { context } = setup(input);
        vm.runInContext('suggestPhoneCountry(true)', context);
        assert.equal(vm.runInContext('clientPhoneValue()', context), null, input);
    }
    assert.equal(vm.runInContext('clientPhoneValue()', setup('').context), '');
});
