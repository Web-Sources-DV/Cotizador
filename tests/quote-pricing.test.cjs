const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
for (const filename of ['index.html','app.js']) {
    const source = fs.readFileSync(path.join(__dirname,'..',filename),'utf8');
    const helper = source.slice(source.indexOf('function quotePricingFromForm()'), source.indexOf('function updateQuotePricing()'));
    function pricing(people, discount = 0, price = 100) {
        const fields = {peopleCount:{value:String(people)},price_0:{value:String(price)},price_1:{value:String(discount)}};
        const context = vm.createContext({ document:{ getElementById:id=>fields[id], querySelectorAll:()=>[{checked:true,value:'Honorarios'},{checked:discount>0,value:'Descuento'}] }, getPriceFromInput:input=>Number(input.value) });
        vm.runInContext(helper,context);
        return vm.runInContext('quotePricingFromForm()',context);
    }
    test(`${filename}: multiplies services by people, keeps unit price and one discount`, () => {
        const quote=pricing(3,25);
        assert.equal(quote.subtotal,300);assert.equal(quote.total,275);
        assert.equal(quote.services[0].unitPrice,100);assert.equal(quote.services[0].quantity,3);assert.equal(quote.services[0].price,300);
        assert.equal(pricing(1).total,100);assert.equal(pricing(3,0,0.10).total,0.30);
    });
    test(`${filename}: rejects invalid people quantities`, () => {
        for(const people of [0,-1,1.5,21,''])assert.equal(pricing(people),null);
    });
}
