/* Country suggestions use the pinned, locally hosted libphonenumber-js metadata. */
function phoneCountryName(country) {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(country);
}

function parsedClientPhone(value, country) {
    const raw = String(value || '').trim();
    if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return null;
    const international = raw.startsWith('00') ? '+' + raw.slice(2) : raw;
    // A complete international number may also be pasted without +.
    if (!international.startsWith('+') && international.replace(/\D/g, '').length > 10) {
        const candidate = libphonenumber.parsePhoneNumberFromString('+' + international);
        if (candidate?.isValid()) return candidate;
    }
    return libphonenumber.parsePhoneNumberFromString(international, country || 'PA');
}

function clientPhoneValue() {
    const input = document.getElementById('clientPhone');
    if (!input.value.trim()) return '';
    const parsed = parsedClientPhone(input.value, document.getElementById('clientPhoneCountry').value);
    return parsed?.isPossible() ? parsed.number : null;
}

function suggestPhoneCountry(format = false) {
    const input = document.getElementById('clientPhone');
    const select = document.getElementById('clientPhoneCountry');
    const hint = document.getElementById('clientPhoneHelp');
    const raw = input.value.trim();
    if (!raw) {
        const country = select.value || 'PA';
        hint.textContent = `${phoneCountryName(country)} (+${libphonenumber.getCountryCallingCode(country)}). Escriba un número local o use + para otro indicativo.`;
        input.removeAttribute('aria-invalid');
        return;
    }
    const parsed = parsedClientPhone(raw, select.value);
    const explicit = raw.startsWith('+') || raw.startsWith('00');
    const bareInternational = !explicit && raw.replace(/\D/g, '').length > 10 && parsed?.isValid();
    if ((explicit || bareInternational) && parsed?.country) select.value = parsed.country;
    if (parsed?.isPossible()) {
        const country = parsed.country ? phoneCountryName(parsed.country) : 'Número internacional';
        hint.textContent = `${country} (+${parsed.countryCallingCode}): ${parsed.formatInternational()}`;
        input.removeAttribute('aria-invalid');
        if (format) input.value = parsed.formatInternational();
        return;
    }
    const formatter = new libphonenumber.AsYouType();
    if (explicit) formatter.input(raw.replace(/^00/, '+'));
    const detected = formatter.getCountry();
    const callingCode = formatter.getCallingCode();
    if (detected) select.value = detected;
    const country = detected || (!explicit ? select.value : '');
    hint.textContent = country
        ? `${phoneCountryName(country)} (+${libphonenumber.getCountryCallingCode(country)}). Complete o revise el número.`
        : callingCode
            ? `Indicativo +${callingCode}. Complete el número; algunos indicativos son compartidos por varios países.`
            : 'Escriba el número completo o seleccione el país. Use + o 00 para un indicativo internacional.';
    if (format) input.setAttribute('aria-invalid', 'true');
}

function resetClientPhoneCountry() {
    document.getElementById('clientPhoneCountry').value = 'PA';
    suggestPhoneCountry();
}

function initClientPhoneCountry() {
    const select = document.getElementById('clientPhoneCountry');
    const input = document.getElementById('clientPhone');
    const countries = libphonenumber.getCountries().sort((a, b) => phoneCountryName(a).localeCompare(phoneCountryName(b), 'es'));
    for (const country of countries) {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = `${phoneCountryName(country)} (+${libphonenumber.getCountryCallingCode(country)})`;
        select.appendChild(option);
    }
    select.value = 'PA';
    input.addEventListener('input', () => suggestPhoneCountry());
    input.addEventListener('blur', () => suggestPhoneCountry(true));
    select.addEventListener('change', () => {
        const previous = parsedClientPhone(input.value, select.value);
        if (input.value.trim()) {
            const national = previous?.nationalNumber || input.value.replace(/\D/g, '');
            input.value = `+${libphonenumber.getCountryCallingCode(select.value)} ${national}`;
        }
        suggestPhoneCountry(true);
    });
    suggestPhoneCountry();
}
